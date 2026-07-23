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
import subprocess
import sys
import zipfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Callable
from urllib.parse import urlencode

import certifi
import pandas as pd
import psycopg
import requests
from lxml import html
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

RAIZ = Path(__file__).resolve().parents[1]
API_DIR = RAIZ / "api"
CONFIGS = API_DIR / "ingest-configs"
SAIDA = Path(__file__).resolve().parent / ".baixados"
UF_MT, TIMEOUT = "51", 90

log = logging.getLogger("coletores")


def _sessao() -> requests.Session:
    """Sessão HTTP resiliente: CAs do certifi + retry para endpoints gov instáveis."""
    s = requests.Session()
    s.verify = certifi.where()  # cadeia de CAs confiável (evita SSLError do INEP)
    s.headers["User-Agent"] = "ITMT-coletor/1.0 (+dados abertos)"
    retry = Retry(total=4, backoff_factor=1.5,
                  status_forcelist=(429, 500, 502, 503, 504), allowed_methods=("GET", "POST"))
    for esquema in ("http://", "https://"):
        s.mount(esquema, HTTPAdapter(max_retries=retry))
    return s


_http = _sessao()


# ---------------------------------------------------------------- fetchers
def fetch_inep(ano: int | None = None) -> tuple[date, pd.DataFrame]:
    """Sinopse da Educação Básica: matrículas por município (MT, rede pública)."""
    ano = ano or date.today().year - 1
    base = "https://download.inep.gov.br/dados_abertos/sinopses_estatisticas/sinopses_educacao_basica"
    r = _http.get(f"{base}/sinopse_estatistica_da_educacao_basica_{ano}.zip", timeout=TIMEOUT)
    r.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        xlsx = next(n for n in z.namelist() if n.lower().endswith(".xlsx"))
        planilha = pd.ExcelFile(z.open(xlsx))
    aba = next(s for s in planilha.sheet_names if "matríc" in s.lower() or "matric" in s.lower())
    bruto = planilha.parse(aba, header=None)
    # a linha de cabeçalho é a que contém "Código do Município"; abaixo dela, os dados
    cab = bruto.index[bruto.astype(str).apply(lambda r: r.str.contains("Município", case=False)).any(axis=1)][0]
    df = planilha.parse(aba, header=cab)
    col_cod = _coluna(df, "código do município", "cod")
    col_val = _coluna(df, "pública", "total")  # matrículas na rede pública
    return date(ano, 12, 31), _normalizar(df, col_cod, col_val)


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


# ---------------------------------------------------------------- utilidades
def _coluna(df: pd.DataFrame, *pistas: str) -> str:
    for pista in pistas:
        for c in df.columns:
            if pista in str(c).lower():
                return c
    raise KeyError(f"coluna não encontrada (pistas: {pistas}); cabeçalho: {list(df.columns)}")


def _normalizar(df: pd.DataFrame, col_cod: str, col_val: str) -> pd.DataFrame:
    out = pd.DataFrame({
        "codigo_ibge": df[col_cod].astype(str).str.extract(r"(\d{6,7})")[0],
        "valor": pd.to_numeric(df[col_val], errors="coerce"),
    }).dropna()
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
    "inep": Coletor("inep", "inep-matriculas.json", "Matrículas na rede pública", fetch_inep),
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
    p.add_argument("--ano", type=int, help="ano do INEP (padrão: ano anterior)")
    args = p.parse_args()
    if args.ano:
        COLETORES["inep"] = Coletor("inep", "inep-matriculas.json", "Matrículas na rede pública",
                                    lambda: fetch_inep(args.ano))
    sys.exit(1 if rodar([args.fonte] if args.fonte else list(COLETORES)) else 0)


if __name__ == "__main__":
    main()
