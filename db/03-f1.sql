-- ============================================================
-- 03-f1.sql — complemento do F1: governança ADMIN e INGEST
-- (aplicar após 01-ddl.sql; idempotente onde possível)
-- ============================================================

-- RF-ADMIN-003/004: fluxo de validação técnica de indicador
CREATE TABLE IF NOT EXISTS "ParecerValidacao" (
  "ParecerValidacao_Id"          serial PRIMARY KEY,
  "ParecerValidacao_IndicadorId" int NOT NULL REFERENCES "Indicador"("Indicador_Id"),
  "ParecerValidacao_Parecerista" text NOT NULL,
  "ParecerValidacao_Decisao"     text NOT NULL CHECK ("ParecerValidacao_Decisao" IN ('APROVADO','REJEITADO')),
  "ParecerValidacao_Justificativa" text NOT NULL,
  "ParecerValidacao_Timestamp"   timestamptz NOT NULL DEFAULT now()
);

-- RF-ADMIN-001: cadastro de autorizações/termos/licenças com vigência
CREATE TABLE IF NOT EXISTS "Autorizacao" (
  "Autorizacao_Id"            serial PRIMARY KEY,
  "Autorizacao_Tipo"          text NOT NULL,          -- ex.: AUTORIZACAO_VOO, TERMO_CESSAO, LICENCA_DADOS
  "Autorizacao_Numero"        text NOT NULL,
  "Autorizacao_Orgao"         text NOT NULL,
  "Autorizacao_Descricao"     text,
  "Autorizacao_VigenciaInicio" date NOT NULL,
  "Autorizacao_VigenciaFim"    date NOT NULL
);

-- RF-INGEST-010: quarentena — registro inválido não bloqueia a carga do restante
CREATE TABLE IF NOT EXISTS "Quarentena" (
  "Quarentena_Id"        bigserial PRIMARY KEY,
  "Quarentena_CargaId"   int NOT NULL REFERENCES "Carga"("Carga_Id"),
  "Quarentena_Registro"  jsonb NOT NULL,
  "Quarentena_Motivo"    text NOT NULL,
  "Quarentena_Timestamp" timestamptz NOT NULL DEFAULT now()
);

-- RF-INGEST-005: contrato de esquema por fonte (detecção de drift)
CREATE TABLE IF NOT EXISTS "EsquemaFonte" (
  "EsquemaFonte_FonteId"     int PRIMARY KEY REFERENCES "Fonte"("Fonte_Id"),
  "EsquemaFonte_Fingerprint" text NOT NULL,
  "EsquemaFonte_AtualizadoEm" timestamptz NOT NULL DEFAULT now()
);

-- Status de carga bloqueada por drift
-- (Carga_Status já é texto livre: 'PROMOVIDA' | 'BLOQUEADA_DRIFT')

GRANT SELECT ON ALL TABLES IN SCHEMA public TO itmt_app;
