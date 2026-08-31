-- ============================================================
-- 49-f1-dimensao-causa-e-fator-escala.sql (Gauntlet P3 · MOTOR-CAUSAS)
--
-- Dois limites do motor apareceram no caso de teste #1 (mortalidade infantil):
--
-- 1) O RECALCULO fixava ×100 no código (consultarNucleo/ranking) — correto
--    para cobertura vacinal (%), errado para taxa de mortalidade infantil,
--    que o mundo inteiro publica POR MIL nascidos vivos. A escala é um fato
--    do CATÁLOGO (metadado do indicador), não do código: nasce a coluna
--    "Indicador_FatorEscala" com DEFAULT 100, que preserva byte a byte o
--    comportamento de todo indicador RECALCULO existente (cobertura vacinal
--    continua ×100; só a taxa nova declara 1000 em db/50).
--
-- 2) A "Observacao" é (indicador, município, data, valor) — não tem eixo de
--    categoria, então "óbitos infantis POR capítulo CID-10 / causa evitável /
--    componente etário" não cabia nela. Modelagem escolhida (PLANO §3/P3):
--    tabela irmã "ObservacaoCausa", um valor por (indicador, território,
--    referência, dimensão, categoria). Alternativa descartada: um indicador
--    por capítulo poluiria o catálogo com ~50 indicadores por decomposição e
--    quebraria a idempotência da carga. A irmã preserva o RECALCULO intacto
--    (a taxa continua vindo de Observacao num/den) e dá ao Xingú o eixo
--    explicativo que o painel SVS/MS (referência R3) oferece.
--
-- Decisões de modelagem que não são óbvias no DDL:
-- - "_CodigoIbge" NULL = recorte ESTADUAL (o TabNet só publica a dimensão
--   "Causas evitáveis" como linha da tabulação, então o recorte municipal
--   dessa dimensão é coletado por município — e o estadual é a tabulação
--   oficial completa). Por isso o UNIQUE precisa de NULLS NOT DISTINCT:
--   sem ele, duas cargas do recorte estadual duplicariam em silêncio.
-- - Catálogo global SEM RLS, como "Observacao": dado público de fonte
--   aberta, não é TENANT_OWNED.
-- - GRANT INSERT (sem UPDATE/DELETE) a itmt_app: a API só acrescenta; a
--   correção de carga é recarga idempotente. Lembrete da catraca: a linha
--   'ObservacaoCausa:INSERT' entra na allowlist de
--   api/test/least-privilege.unit.mjs (EV-044) junto com esta migração.
-- ============================================================

ALTER TABLE "Indicador"
  ADD COLUMN IF NOT EXISTS "Indicador_FatorEscala" numeric NOT NULL DEFAULT 100;

CREATE TABLE IF NOT EXISTS "ObservacaoCausa" (
  "ObservacaoCausa_Id"             bigserial PRIMARY KEY,
  "ObservacaoCausa_IndicadorId"    int NOT NULL REFERENCES "Indicador"("Indicador_Id"),
  -- NULL = estado (recorte estadual da decomposição)
  "ObservacaoCausa_CodigoIbge"     char(7) REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "ObservacaoCausa_DataReferencia" date NOT NULL,
  "ObservacaoCausa_Dimensao"       text NOT NULL
    CHECK ("ObservacaoCausa_Dimensao" IN ('CAPITULO_CID10','CAUSA_EVITAVEL','COMPONENTE')),
  "ObservacaoCausa_Categoria"      text NOT NULL,
  "ObservacaoCausa_Valor"          numeric NOT NULL,
  "ObservacaoCausa_FonteId"        int NOT NULL REFERENCES "Fonte"("Fonte_Id"),
  "ObservacaoCausa_CargaId"        int REFERENCES "Carga"("Carga_Id"),
  CONSTRAINT observacaocausa_unica UNIQUE NULLS NOT DISTINCT
    ("ObservacaoCausa_IndicadorId","ObservacaoCausa_CodigoIbge","ObservacaoCausa_DataReferencia",
     "ObservacaoCausa_Dimensao","ObservacaoCausa_Categoria","ObservacaoCausa_FonteId")
);

CREATE INDEX IF NOT EXISTS idx_obscausa_lookup
  ON "ObservacaoCausa" ("ObservacaoCausa_IndicadorId","ObservacaoCausa_CodigoIbge","ObservacaoCausa_DataReferencia");
CREATE INDEX IF NOT EXISTS idx_obscausa_dimensao
  ON "ObservacaoCausa" ("ObservacaoCausa_IndicadorId","ObservacaoCausa_Dimensao","ObservacaoCausa_DataReferencia");

GRANT SELECT, INSERT ON "ObservacaoCausa" TO itmt_app;
GRANT USAGE ON SEQUENCE "ObservacaoCausa_ObservacaoCausa_Id_seq" TO itmt_app;
