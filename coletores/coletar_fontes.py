"""Coletores automáticos de fontes que exigem download (CNES, INEP).

Rodam nos bastidores (diariamente): baixam da fonte oficial, normalizam para
o CSV que o conector auditado do ITMT espera e delegam a importação ao
pipeline Node (`ingestar-csv.mjs`, Bronze→Prata→Ouro). O upsert é idempotente
(RF-INGEST-006): reexecutar só grava o que falta. Indicador novo nasce
EM_ANALISE — publicar segue sendo ato humano (RG-09). Nada disso é visível ao
usuário final: é operação de dados, agendada.

Uso:  python -m coletores.coletar_fontes [--fonte cnes|inep] [--ano 2024]
Requer DATABASE_URL (dono do banco, p/ as migrações do conector).
"""
from __future__ import annotations

import argparse
import io
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import unicodedata
import zipfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Callable
from urllib.parse import urlencode

import truststore
import pandas as pd
import psycopg
import requests
import openpyxl
from lxml import html
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

RAIZ = Path(__file__).resolve().parents[1]
API_DIR = RAIZ / "api"
CONFIGS = API_DIR / "ingest-configs"
SAIDA = Path(__file__).resolve().parent / ".baixados"
UF_MT, TIMEOUT = "51", 90

log = logging.getLogger("coletores")

# Usa o repositório de certificados do sistema operacional. Necessário em
# redes institucionais com CA corporativa e mais seguro que desabilitar TLS.
truststore.inject_into_ssl()


def _sessao() -> requests.Session:
    """Sessão HTTP resiliente: CAs do certifi + retry para endpoints gov instáveis."""
    s = requests.Session()
    # truststore usa a cadeia do SO; REQUESTS_CA_BUNDLE permite CA dedicada no contêiner.
    s.verify = os.environ.get("REQUESTS_CA_BUNDLE", True)
    s.headers["User-Agent"] = "ITMT-coletor/1.0 (+dados abertos)"
    retry = Retry(total=4, backoff_factor=1.5,
                  status_forcelist=(429, 500, 502, 503, 504), allowed_methods=("GET", "POST"))
    for esquema in ("http://", "https://"):
        s.mount(esquema, HTTPAdapter(max_retries=retry))
    return s


_http = _sessao()


def _baixar_cache(url: str, nome: str, timeout: int = 300) -> bytes:
    """Cache local por versão/ano; evita baixar novamente após falha de parsing."""
    SAIDA.mkdir(exist_ok=True)
    caminho = SAIDA / nome
    if caminho.exists() and caminho.stat().st_size:
        return caminho.read_bytes()
    headers = {"Connection": "close"} if "download.inep.gov.br" in url else None
    resposta = _http.get(url, timeout=timeout, headers=headers)
    resposta.raise_for_status()
    caminho.write_bytes(resposta.content)
    return resposta.content


def _chave_nome(valor: str) -> str:
    texto = unicodedata.normalize("NFKD", str(valor)).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Z0-9]", "", texto.upper())


def _municipios() -> dict[str, str]:
    """Nome normalizado -> código IBGE; impede aproximações silenciosas."""
    with psycopg.connect(os.environ["DATABASE_URL"]) as con, con.cursor() as cur:
        cur.execute('SELECT "Municipio_Nome", "Municipio_CodigoIbge" FROM "Municipio"')
        return {_chave_nome(nome): codigo for nome, codigo in cur.fetchall()}


def _por_nome(df: pd.DataFrame, coluna_nome: str, coluna_valor: str,
              *, preencher_zeros: bool = False) -> pd.DataFrame:
    municipios = _municipios()
    # Alias explícito e auditável para grafia divergente da fonte; nunca fuzzy match.
    aliases = {"SANTOANTONIODOLEVERGER": "SANTOANTONIODELEVERGER"}
    nomes = df[coluna_nome].map(_chave_nome).replace(aliases)
    desconhecidos = sorted(set(nomes) - set(municipios))
    if desconhecidos:
        raise ValueError(f"municípios da fonte sem correspondência no IBGE: {desconhecidos[:10]}")
    # E20 (db/64): `fillna(0)` INVENTAVA zero para célula ilegível — o pior
    # dos três defeitos que a auditoria de 31/08 achou, porque produzia um
    # número falso em vez de apenas perder um. Este caminho agrega por SOMA e
    # não tem como preservar a célula original até o conector, então a saída
    # honesta é FALHAR ALTO: quem decide o que uma célula ilegível significa é
    # a curadoria da convenção da fonte, nunca o coletor.
    valores = pd.to_numeric(df[coluna_valor], errors="coerce")
    ilegiveis = df.loc[valores.isna(), coluna_valor]
    if len(ilegiveis):
        raise ValueError(
            f"{len(ilegiveis)} célula(s) não numérica(s) em '{coluna_valor}': "
            f"{list(ilegiveis.head(5))}. O coletor NÃO decide o que elas "
            "significam (E20/db/64) — registre a convenção da fonte em "
            '"ConvencaoValorSimbolo" ou trate a origem.'
        )
    out = pd.DataFrame({"codigo_ibge": nomes.map(municipios), "valor": valores})
    out = out.groupby("codigo_ibge", as_index=False)["valor"].sum()
    # `preencher_zeros` é outra coisa, e continua válido: município SEM LINHA
    # numa tabulação COMPLETA de eventos é zero eventos — a mesma doutrina que
    # o db/50 documentou para o TabNet. Aqui não se inventa nada sobre uma
    # célula: afirma-se sobre uma linha ausente de um recorte completo.
    if preencher_zeros:
        base = pd.DataFrame({"codigo_ibge": list(municipios.values())})
        out = base.merge(out, how="left", on="codigo_ibge").fillna({"valor": 0})
    return out.sort_values("codigo_ibge").reset_index(drop=True)


# ---------------------------------------------------------------- fetchers
_INEP_CACHE: dict[int, dict[str, pd.DataFrame]] = {}


def _tabelas_inep(ano: int) -> dict[str, pd.DataFrame]:
    """Lê apenas duas abas da sinopse de 232 MB em modo streaming."""
    if ano in _INEP_CACHE:
        return _INEP_CACHE[ano]
    ano = ano or date.today().year - 1
    base = "https://download.inep.gov.br/dados_abertos/sinopses_estatisticas"
    conteudo = _baixar_cache(
        f"{base}/sinopse_estatistica_censo_escolar_{ano}.zip", f"inep-sinopse-{ano}.zip", 900,
    )
    with zipfile.ZipFile(io.BytesIO(conteudo)) as z:
        xlsx = next(n for n in z.namelist() if n.lower().endswith(".xlsx"))
        xlsx_cache = SAIDA / f"inep-sinopse-{ano}.xlsx"
        if not xlsx_cache.exists() or not xlsx_cache.stat().st_size:
            with z.open(xlsx) as origem, xlsx_cache.open("wb") as destino:
                shutil.copyfileobj(origem, destino, 1024 * 1024)
        livro = openpyxl.load_workbook(xlsx_cache, read_only=True, data_only=True)
        try:
            def extrair(aba: str, indice_valor: int) -> pd.DataFrame:
                linhas = []
                for row in livro[aba].iter_rows(values_only=True):
                    codigo = str(row[3]).strip() if len(row) > 3 and row[3] is not None else ""
                    if re.fullmatch(r"51\d{5}", codigo):
                        linhas.append({"codigo_ibge": codigo, "valor": row[indice_valor]})
                return _normalizar(pd.DataFrame(linhas), "codigo_ibge", "valor")

            resultado = {
                "matriculas": extrair("1.2", 5),       # Rede Pública / Total
                "escolas": extrair("Educação Básica 3.1", 4),  # Total de estabelecimentos ativos
            }
        finally:
            livro.close()
    _INEP_CACHE[ano] = resultado
    return resultado


def fetch_inep(ano: int | None = None) -> tuple[date, pd.DataFrame]:
    ano = ano or date.today().year - 1
    return date(ano, 12, 31), _tabelas_inep(ano)["matriculas"]


def fetch_inep_escolas(ano: int | None = None) -> tuple[date, pd.DataFrame]:
    ano = ano or date.today().year - 1
    return date(ano, 12, 31), _tabelas_inep(ano)["escolas"]


CNES_HOST = "http://tabnet.datasus.gov.br"
CNES_DEF = "cnes/cnv/leiintmt.def"  # Leitos de INTERNAÇÃO, MT (UTI é cubo distinto — ver README)


def _parse_tabnet_csv(texto: str) -> pd.DataFrame:
    """CSV do TabNet: metadados no topo, cabeçalho '"Município";"<medida>"',
    linhas '"<cod> NOME";<valor>' e rodapé de notas. Extrai codigo_ibge+valor."""
    linhas = texto.splitlines()
    ini = next((i for i, l in enumerate(linhas) if l.lower().startswith('"munic')), None)
    if ini is None:
        return pd.DataFrame(columns=["codigo_ibge", "valor"])
    regs = []
    for l in linhas[ini + 1:]:
        if not l.startswith('"'):
            break  # fim dos dados (rodapé de notas)
        p = l.split(";")
        if len(p) >= 2:
            regs.append({"municipio": p[0].strip('"'), "valor": p[1].strip('"')})
    return _normalizar(pd.DataFrame(regs), "municipio", "valor")


def fetch_cnes(competencia: str | None = None) -> tuple[date, pd.DataFrame]:
    """Leitos de internação existentes por município (MT), via TabNet/DATASUS.

    Fluxo real do TabNet: lê o formulário (deftohtm) para montar o corpo
    (cada dimensão em "todas as categorias"), POSTa a consulta em tabcgi (que
    tabula) e SEGUE o link do CSV que o TabNet gera — a forma limpa de obter
    os dados. Arquivo mensal `ltmt<AAMM>.dbf`; tenta as competências recentes.
    NB: este cubo é INTERNAÇÃO, não UTI (cubo distinto).
    """
    form = html.fromstring(
        _http.get(f"{CNES_HOST}/cgi/deftohtm.exe?{CNES_DEF}", timeout=TIMEOUT).text
    ).xpath("//form")[0]
    campos = {}
    for s in form.xpath(".//select"):
        nome, vals = s.get("name"), [o.get("value") for o in s.xpath("./option")]
        if nome:
            campos[nome] = "TODAS_AS_CATEGORIAS__" if "TODAS_AS_CATEGORIAS__" in vals else (vals[0] if vals else "")
    arquivos = [o.get("value") for o in form.xpath(".//select[@name='Arquivos']/option")]
    if competencia:
        arquivos = [a for a in arquivos if competencia in a] or arquivos[:1]

    for arq in arquivos[:4]:
        # Valores RAW (com acento) — o urlencode(latin-1) codifica uma vez só.
        campos.update({"Linha": "Município", "Coluna": "--Não-Ativa--",
                       "Incremento": "Qtd_existente", "Arquivos": arq})
        res = _http.post(f"{CNES_HOST}/cgi/tabcgi.exe?{CNES_DEF}",
                         data=urlencode(campos, encoding="latin-1").encode("latin-1"),
                         headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=TIMEOUT)
        links = html.fromstring(res.text).xpath("//a[contains(@href,'.csv')]/@href")
        if not links:
            continue
        csv = _http.get(CNES_HOST + links[0], timeout=TIMEOUT)
        csv.encoding = "latin-1"
        df = _parse_tabnet_csv(csv.text)
        if not df.empty:
            m = re.search(r"(\d{2})(\d{2})", arq)  # AAMM
            ref = date(2000 + int(m.group(1)), int(m.group(2)), 28) if m else date.today()
            log.info("cnes: %s (%d municípios)", arq, len(df))
            return ref, df
    raise RuntimeError("CNES: TabNet não gerou CSV com dados — ver README.")


def fetch_cnes_estabelecimentos(competencia: str | None = None) -> tuple[date, pd.DataFrame]:
    """Quantidade de estabelecimentos de saúde ativos por município gestor."""
    definicao = "cnes/cnv/estabmt.def"
    form = html.fromstring(
        _http.get(f"{CNES_HOST}/cgi/deftohtm.exe?{definicao}", timeout=TIMEOUT).text
    ).xpath("//form")[0]
    campos = {}
    for s in form.xpath(".//select"):
        nome, vals = s.get("name"), [o.get("value") for o in s.xpath("./option")]
        if nome:
            campos[nome] = "TODAS_AS_CATEGORIAS__" if "TODAS_AS_CATEGORIAS__" in vals else (vals[0] if vals else "")
    arquivos = [o.get("value") for o in form.xpath(".//select[@name='Arquivos']/option")]
    if competencia:
        arquivos = [a for a in arquivos if competencia in a] or arquivos[:1]
    for arq in arquivos[:4]:
        campos.update({"Linha": "Município_gestor", "Coluna": "--Não-Ativa--",
                       "Incremento": "Quantidade", "Arquivos": arq})
        res = _http.post(f"{CNES_HOST}/cgi/tabcgi.exe?{definicao}",
                         data=urlencode(campos, encoding="latin-1").encode("latin-1"),
                         headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=TIMEOUT)
        links = html.fromstring(res.text).xpath("//a[contains(@href,'.csv')]/@href")
        if not links:
            continue
        csv = _http.get(CNES_HOST + links[0], timeout=TIMEOUT)
        csv.encoding = "latin-1"
        df = _parse_tabnet_csv(csv.text)
        if not df.empty:
            m = re.search(r"(\d{2})(\d{2})", arq)
            ref = date(2000 + int(m.group(1)), int(m.group(2)), 28) if m else date.today()
            log.info("cnes-estabelecimentos: %s (%d municípios)", arq, len(df))
            return ref, df
    raise RuntimeError("CNES estabelecimentos: TabNet não gerou CSV com dados.")


def fetch_cnes_uti() -> tuple[date, pd.DataFrame]:
    """Leitos de UTI existentes, no cubo mensal específico do CNES/TabNet."""
    definicao = "cnes/cnv/leiutimt.def"
    form = html.fromstring(
        _http.get(f"{CNES_HOST}/cgi/deftohtm.exe?{definicao}", timeout=TIMEOUT).text
    ).xpath("//form")[0]
    campos = {}
    for seletor in form.xpath(".//select"):
        nome, vals = seletor.get("name"), [o.get("value") for o in seletor.xpath("./option")]
        if nome:
            campos[nome] = "TODAS_AS_CATEGORIAS__" if "TODAS_AS_CATEGORIAS__" in vals else (vals[0] if vals else "")
    arquivos = [o.get("value") for o in form.xpath(".//select[@name='Arquivos']/option")]
    for arq in arquivos[:4]:
        campos.update({"Linha": "Município", "Coluna": "--Não-Ativa--",
                       "Incremento": "Quantidade_existente", "Arquivos": arq})
        res = _http.post(
            f"{CNES_HOST}/cgi/tabcgi.exe?{definicao}",
            data=urlencode(campos, encoding="latin-1").encode("latin-1"),
            headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=TIMEOUT,
        )
        links = html.fromstring(res.text).xpath("//a[contains(@href,'.csv')]/@href")
        if not links:
            continue
        csv = _http.get(CNES_HOST + links[0], timeout=TIMEOUT)
        csv.encoding = "latin-1"
        dados = _parse_tabnet_csv(csv.text)
        if not dados.empty:
            m = re.search(r"(\d{2})(\d{2})", arq)
            ref = date(2000 + int(m.group(1)), int(m.group(2)), 28) if m else date.today()
            log.info("cnes-uti: %s (%d municípios)", arq, len(dados))
            return ref, dados
    raise RuntimeError("CNES UTI: TabNet não gerou CSV com dados.")


def fetch_inpe(ano: int | None = None) -> tuple[date, pd.DataFrame]:
    """Focos anuais consolidados do satélite de referência do INPE."""
    ano = ano or date.today().year - 1
    url = ("https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/anual/"
           f"Brasil_sat_ref/focos_br_ref_{ano}.zip")
    conteudo = _baixar_cache(url, f"inpe-focos-{ano}.zip")
    with zipfile.ZipFile(io.BytesIO(conteudo)) as z:
        csv = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        dados = pd.read_csv(z.open(csv), usecols=["estado", "municipio"])
    mt = dados[dados["estado"].eq("MATO GROSSO")].groupby("municipio", as_index=False).size()
    mt = mt.rename(columns={"size": "focos"})
    return date(ano, 12, 31), _por_nome(mt, "municipio", "focos", preencher_zeros=True)


def fetch_mapbiomas(ano: int | None = None) -> tuple[date, pd.DataFrame]:
    """Área natural municipal da versão mais recente do DOI oficial."""
    meta = _http.get(
        "https://data.mapbiomas.org/api/datasets/:persistentId/",
        params={"persistentId": "doi:10.58053/MapBiomas/SJZOLT"}, timeout=TIMEOUT,
    )
    meta.raise_for_status()
    arquivos = meta.json()["data"]["latestVersion"]["files"]
    arquivo = next(
        f["dataFile"] for f in arquivos
        if f["label"].lower().endswith(".xlsx") and "coverage" in f["label"].lower()
    )
    conteudo = _baixar_cache(
        f"https://data.mapbiomas.org/api/access/datafile/{arquivo['id']}",
        f"mapbiomas-cobertura-{arquivo['id']}.xlsx", 600,
    )
    if ano is None:
        cabecalho = pd.read_excel(io.BytesIO(conteudo), sheet_name="COVERAGE_10.1", nrows=0)
        ano = max(c for c in cabecalho.columns if isinstance(c, int) and 1985 <= c <= date.today().year)
    dados = pd.read_excel(
        io.BytesIO(conteudo), sheet_name="COVERAGE_10.1",
        usecols=lambda coluna: coluna in {"state_acronym", "municipality", "class_level_0", ano},
    )
    natural = dados[(dados["state_acronym"] == "MT") & (dados["class_level_0"] == "Natural")]
    # A planilha 10.1 contém três linhas limítrofes rotuladas como MT para
    # municípios de GO/MS. Filtramos pela base IBGE oficial, por igualdade exata.
    nomes_mt = set(_municipios())
    natural = natural[natural["municipality"].map(_chave_nome).isin(nomes_mt)]
    natural = natural.groupby("municipality", as_index=False)[ano].sum().rename(columns={ano: "area_ha"})
    if len(natural) < 141:  # 2024 antecede Boa Esperança do Norte
        raise RuntimeError(f"MapBiomas retornou cobertura municipal incompleta: {len(natural)}/141")
    return date(ano, 12, 31), _por_nome(natural, "municipality", "area_ha")


# ---------------------------------------------------------------- utilidades
def _coluna(df: pd.DataFrame, *pistas: str) -> str:
    for pista in pistas:
        for c in df.columns:
            if pista in str(c).lower():
                return c
    raise KeyError(f"coluna não encontrada (pistas: {pistas}); cabeçalho: {list(df.columns)}")


def _celula_bruta(valor: object) -> str:
    """A célula tal como a fonte a serviu, só sem espaços em volta.

    Vazio/NaN vira string vazia — que NÃO é zero: é uma célula que o conector
    auditado vai classificar (e, sem convenção curada, quarentenar).
    """
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return ""
    return str(valor).strip()


def _normalizar(df: pd.DataFrame, col_cod: str, col_val: str) -> pd.DataFrame:
    """Extrai codigo_ibge + valor PRESERVANDO a célula original (E20 / db/64).

    Antes, esta função fazia `to_numeric(errors="coerce")` seguido de
    `dropna()`: célula vazia, '-', '...' e 'X' viravam NaN e SUMIAM do CSV
    antes de o conector Node auditado ver qualquer coisa. Para CNES e INEP a
    supressão da fonte era invisível ao pipeline — e '-', que na simbologia
    das Normas de Apresentação Tabular é ZERO ABSOLUTO, era tratado como se
    o município não existisse. Isso contradizia a doutrina do CLAUDE.md: o
    coletor NORMALIZA e DELEGA; quem interpreta a célula é o conector, contra
    a convenção curada da fonte ("ConvencaoValorSimbolo", db/64).

    O único descarte que sobra aqui é TERRITORIAL — linha sem código IBGE de
    MT não é dado deste estado. Isso não destrói informação de valor.
    """
    codigos = df[col_cod].astype(str).str.extract(r"(\d{6,7})")[0]
    out = pd.DataFrame({
        "codigo_ibge": codigos,
        "valor": df[col_val].map(_celula_bruta) if len(df) else pd.Series(dtype=str),
    }).dropna(subset=["codigo_ibge"])
    return out[out["codigo_ibge"].str.startswith(UF_MT)].reset_index(drop=True)


def ja_importado(indicador: str, referencia: date) -> bool:
    """True se o indicador já tem observação com referência >= a que vamos importar."""
    with psycopg.connect(os.environ["DATABASE_URL"]) as con, con.cursor() as cur:
        cur.execute(
            'SELECT max(o."Observacao_DataReferencia") '
            'FROM "Observacao" o JOIN "Indicador" i ON i."Indicador_Id" = o."Observacao_IndicadorId" '
            'WHERE i."Indicador_Nome" = %s',
            (indicador,),
        )
        atual = cur.fetchone()[0]
    return atual is not None and atual >= referencia


def importar(config_json: str, referencia: date, df: pd.DataFrame) -> None:
    """Escreve o CSV normalizado + um config derivado e chama o conector auditado."""
    SAIDA.mkdir(exist_ok=True)
    base = json.loads((CONFIGS / config_json).read_text(encoding="utf-8"))
    base["colunas"] = {"codigoIbge": "codigo_ibge", "valor": "valor"}
    base["dataReferencia"] = referencia.isoformat()
    csv = SAIDA / f"{config_json.replace('.json','')}-{referencia:%Y%m%d}.csv"
    df.to_csv(csv, sep=";", index=False, encoding="utf-8")
    cfg = SAIDA / f"run-{config_json}"
    cfg.write_text(json.dumps(base, ensure_ascii=False), encoding="utf-8")
    subprocess.run(
        ["node", "scripts/ingestar-csv.mjs", str(cfg), str(csv)],
        cwd=API_DIR, check=True,
    )


# ---------------------------------------------------------------- orquestração
@dataclass(frozen=True)
class Coletor:
    slug: str
    config_json: str
    indicador: str
    fetch: Callable[[], tuple[date, pd.DataFrame]]


COLETORES = {
    "cnes": Coletor("cnes", "cnes-internacao.json", "Leitos de internação", fetch_cnes),
    "cnes-estabelecimentos": Coletor(
        "cnes-estabelecimentos", "cnes-estabelecimentos.json",
        "Estabelecimentos de saúde ativos", fetch_cnes_estabelecimentos,
    ),
    "inep": Coletor("inep", "inep-matriculas.json", "Matrículas na rede pública", fetch_inep),
    "inep-escolas": Coletor("inep-escolas", "inep-escolas.json", "Escolas ativas", fetch_inep_escolas),
    "cnes-uti": Coletor("cnes-uti", "cnes-leitos.json", "Leitos de UTI", fetch_cnes_uti),
    "inpe": Coletor("inpe", "inpe-queimadas.json", "Focos de queimadas", fetch_inpe),
    "mapbiomas": Coletor("mapbiomas", "mapbiomas-cobertura.json", "Cobertura vegetal nativa", fetch_mapbiomas),
}

GRUPOS = {
    "cnes": ["cnes", "cnes-estabelecimentos", "cnes-uti"],
    "inep": ["inep", "inep-escolas"],
}


def rodar(alvos: list[str]) -> int:
    falhas = 0
    for slug in alvos:
        c = COLETORES[slug]
        try:
            referencia, df = c.fetch()
            if df.empty:
                log.warning("%s: fonte retornou vazio — nada importado (ausência é resposta)", slug)
                continue
            if ja_importado(c.indicador, referencia):
                log.info("%s: %s já está no banco — nada a fazer", slug, referencia)
                continue
            importar(c.config_json, referencia, df)
            log.info("%s: %d municípios importados (ref. %s) — nasce EM_ANALISE (RG-09)",
                     slug, len(df), referencia)
        except Exception:  # um coletor não derruba os outros
            log.exception("%s: coleta falhou", slug)
            falhas += 1
    return falhas


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    p = argparse.ArgumentParser(description="Coleta diária de fontes com download (CNES, INEP).")
    p.add_argument("--fonte", choices=list(COLETORES), help="só uma fonte (padrão: todas)")
    p.add_argument("--grupo", choices=list(GRUPOS), help="fontes com a mesma periodicidade")
    p.add_argument("--ano", type=int, help="ano do INEP (padrão: ano anterior)")
    args = p.parse_args()
    if args.ano:
        COLETORES["inep"] = Coletor("inep", "inep-matriculas.json", "Matrículas na rede pública",
                                    lambda: fetch_inep(args.ano))
        COLETORES["inep-escolas"] = Coletor("inep-escolas", "inep-escolas.json", "Escolas ativas",
                                            lambda: fetch_inep_escolas(args.ano))
        COLETORES["inpe"] = Coletor("inpe", "inpe-queimadas.json", "Focos de queimadas",
                                    lambda: fetch_inpe(args.ano))
        COLETORES["mapbiomas"] = Coletor("mapbiomas", "mapbiomas-cobertura.json", "Cobertura vegetal nativa",
                                         lambda: fetch_mapbiomas(args.ano))
    alvos = [args.fonte] if args.fonte else (GRUPOS[args.grupo] if args.grupo else list(COLETORES))
    sys.exit(1 if rodar(alvos) else 0)


if __name__ == "__main__":
    main()
