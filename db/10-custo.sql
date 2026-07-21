-- ============================================================
-- 10-custo.sql — A15 (Custo): governador de gasto do LLM.
-- Registra o consumo de tokens por chamada de provedor para que o
-- CustoService aplique tetos diário/mensal e corte para o léxico
-- (RG-05) ao estourar. Distinto da cadeia de auditoria: é um log
-- operacional consultável (mutável), não a trilha imutável.
-- ============================================================
CREATE TABLE IF NOT EXISTS "ConsumoLlm" (
  "ConsumoLlm_Id"            bigserial PRIMARY KEY,
  "ConsumoLlm_Quando"       timestamptz NOT NULL DEFAULT now(),
  "ConsumoLlm_Provedor"     text NOT NULL,
  "ConsumoLlm_Borda"        text NOT NULL CHECK ("ConsumoLlm_Borda" IN ('A01','A05','SITUACAO')),
  "ConsumoLlm_TokensEntrada" int NOT NULL DEFAULT 0,
  "ConsumoLlm_TokensSaida"   int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_consumo_quando ON "ConsumoLlm" ("ConsumoLlm_Quando");

GRANT INSERT, SELECT ON "ConsumoLlm" TO itmt_app;
GRANT USAGE, SELECT ON SEQUENCE "ConsumoLlm_ConsumoLlm_Id_seq" TO itmt_app;
