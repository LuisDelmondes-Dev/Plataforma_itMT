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
import subprocess
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Callable

import certifi
import pandas as pd
import psycopg
import requests

RAIZ = Path(__file__).resolve().parents[1]
API_DIR = RAIZ / "api"
CONFIGS = API_DIR / "ingest-configs"
SAIDA = Path(__file__).resolve().parent / ".baixados"
UF_MT, TIMEOUT = "51", 90

log = logging.getLogger("coletores")
_http = requests.Session()
_http.verify = certifi.where()  # cadeia de CAs confiável (evita SSLError do INEP)
_http.headers["User-Agent"] = "ITMT-coletor/1.0 (+dados abertos)"


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


def fetch_cnes(competencia: str | None = None) -> tuple[date, pd.DataFrame]:
    """Leitos de UTI por município (MT) via TabNet/DATASUS (tabela HTML → dados)."""
    hoje = date.today()
    comp = competencia or f"{hoje.year if hoje.month > 2 else hoje.year - 1}"
    url = "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?cnes/cnv/leiintmt.def"
    # Campos do formulário TabNet — ponto único de calibração desta fonte.
    params = {
        "Linha": "Munic%EDpio", "Coluna": "--N%E3o-Ativa--",
        "Incremento": "Quantidade_SUS", "Arquivos": f"leiintmt{comp}.dbf",
        "SLeito_UTI": "TODAS_AS_CATEGORIAS__", "formato": "table", "mostre": "Mostra",
    }
    r = _http.post(url, data=params, timeout=TIMEOUT)
    r.raise_for_status()
    df = max(pd.read_html(io.StringIO(r.text), decimal=",", thousands="."), key=len)
    df.columns = ["municipio", "valor"] + list(df.columns[2:])
    return date(int(comp[:4]), 12, 31), _normalizar(df, "municipio", "valor")


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
    "cnes": Coletor("cnes", "cnes-leitos.json", "Leitos de UTI", fetch_cnes),
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
