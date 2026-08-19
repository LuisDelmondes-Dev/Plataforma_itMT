-- ============================================================
-- 23-f2-api-parceiros.sql — credenciais de integração e quotas F2.
-- A chave secreta nunca é persistida: somente derivação scrypt com pepper + prefixo exibível.
-- O consumo agregado por minuto/dia permite cobrança de quota atômica.
-- ============================================================

CREATE TABLE IF NOT EXISTS "ApiCliente" (
  "ApiCliente_Id"                 bigserial PRIMARY KEY,
  "ApiCliente_Proprietario"       text NOT NULL,
  "ApiCliente_Nome"               text NOT NULL CHECK (char_length("ApiCliente_Nome") BETWEEN 3 AND 100),
  "ApiCliente_Prefixo"            text NOT NULL UNIQUE,
  "ApiCliente_HashChave"          text NOT NULL UNIQUE CHECK ("ApiCliente_HashChave" ~ '^[0-9a-f]{64}$'),
  "ApiCliente_Escopos"            text[] NOT NULL DEFAULT ARRAY['catalogo:ler','indicadores:ler']::text[],
  "ApiCliente_QuotaMinuto"        integer NOT NULL DEFAULT 60 CHECK ("ApiCliente_QuotaMinuto" BETWEEN 1 AND 10000),
  "ApiCliente_QuotaDia"           integer NOT NULL DEFAULT 5000 CHECK ("ApiCliente_QuotaDia" BETWEEN 1 AND 1000000),
  "ApiCliente_Status"             text NOT NULL DEFAULT 'ATIVA' CHECK ("ApiCliente_Status" IN ('ATIVA','REVOGADA')),
  "ApiCliente_CriadaEm"           timestamptz NOT NULL DEFAULT now(),
  "ApiCliente_ExpiraEm"           timestamptz,
  "ApiCliente_UltimoUsoEm"        timestamptz,
  "ApiCliente_RevogadaEm"         timestamptz,
  CONSTRAINT "ApiCliente_Escopos_check" CHECK (
    "ApiCliente_Escopos" <@ ARRAY['catalogo:ler','indicadores:ler']::text[]
    AND cardinality("ApiCliente_Escopos") > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_api_cliente_proprietario
  ON "ApiCliente" ("ApiCliente_Proprietario", "ApiCliente_CriadaEm" DESC);
CREATE INDEX IF NOT EXISTS idx_api_cliente_hash_ativa
  ON "ApiCliente" ("ApiCliente_HashChave") WHERE "ApiCliente_Status" = 'ATIVA';

CREATE TABLE IF NOT EXISTS "ApiConsumoJanela" (
  "ApiConsumoJanela_ClienteId"    bigint NOT NULL
    REFERENCES "ApiCliente"("ApiCliente_Id") ON DELETE CASCADE,
  "ApiConsumoJanela_Tipo"         text NOT NULL CHECK ("ApiConsumoJanela_Tipo" IN ('MINUTO','DIA')),
  "ApiConsumoJanela_Inicio"       timestamptz NOT NULL,
  "ApiConsumoJanela_Total"        integer NOT NULL DEFAULT 0 CHECK ("ApiConsumoJanela_Total" >= 0),
  "ApiConsumoJanela_AtualizadaEm" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("ApiConsumoJanela_ClienteId", "ApiConsumoJanela_Tipo", "ApiConsumoJanela_Inicio")
);

CREATE INDEX IF NOT EXISTS idx_api_consumo_janela_recente
  ON "ApiConsumoJanela" ("ApiConsumoJanela_Inicio" DESC);

GRANT SELECT, INSERT, UPDATE ON "ApiCliente", "ApiConsumoJanela" TO itmt_app;
GRANT USAGE, SELECT ON SEQUENCE "ApiCliente_ApiCliente_Id_seq" TO itmt_app;
