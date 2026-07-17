-- ============================================================
-- DDL-ITMT.sql — Núcleo F1 (subconjunto executável do MVP)
-- Convenção: NomeTabela_NomeAtributo em PascalCase (PRD §11)
-- Derivado de: PRD-ITMT.md v2.0
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;  -- RF-PORTAL-001: busca tolerante a acentos

-- ------------------------------------------------------------
-- 11.1 Núcleo territorial
-- ------------------------------------------------------------
CREATE TABLE "RegiaoIntermediaria" (
  "RegiaoIntermediaria_Codigo"  varchar(4) PRIMARY KEY,
  "RegiaoIntermediaria_Nome"    text NOT NULL
);

CREATE TABLE "RegiaoImediata" (
  "RegiaoImediata_Codigo"       varchar(6) PRIMARY KEY,
  "RegiaoImediata_Nome"         text NOT NULL,
  "RegiaoImediata_CodigoRgint"  varchar(4) NOT NULL
    REFERENCES "RegiaoIntermediaria"("RegiaoIntermediaria_Codigo")
);

CREATE TABLE "Municipio" (
  "Municipio_CodigoIbge"    char(7) PRIMARY KEY,          -- RN-001: discriminador universal
  "Municipio_Nome"          text NOT NULL,
  "Municipio_CodigoUf"      char(2) NOT NULL DEFAULT '51',
  "Municipio_CodigoRgi"     varchar(6) NOT NULL
    REFERENCES "RegiaoImediata"("RegiaoImediata_Codigo"),
  "Municipio_CodigoRgint"   varchar(4) NOT NULL
    REFERENCES "RegiaoIntermediaria"("RegiaoIntermediaria_Codigo"),
  "Municipio_AreaKm2"       numeric(12,3),
  "Municipio_DataInstalacao" date
);
CREATE INDEX idx_municipio_nome ON "Municipio" (lower("Municipio_Nome"));

CREATE TABLE "Consorcio" (
  "Consorcio_Id"    serial PRIMARY KEY,
  "Consorcio_Nome"  text NOT NULL,
  "Consorcio_Tipo"  text NOT NULL CHECK ("Consorcio_Tipo" IN ('SAUDE','INFRA_DESENVOLVIMENTO')),
  "Consorcio_Cnpj"  varchar(18)
);

-- RN-002: composição TEMPORAL — resolvida na data de referência do indicador
CREATE TABLE "ConsorcioMunicipio" (
  "ConsorcioMunicipio_ConsorcioId" int NOT NULL REFERENCES "Consorcio"("Consorcio_Id"),
  "ConsorcioMunicipio_CodigoIbge"  char(7) NOT NULL REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "ConsorcioMunicipio_DataInicio"  date NOT NULL,
  "ConsorcioMunicipio_DataFim"     date,
  PRIMARY KEY ("ConsorcioMunicipio_ConsorcioId","ConsorcioMunicipio_CodigoIbge","ConsorcioMunicipio_DataInicio")
);

-- ------------------------------------------------------------
-- 11.2 Taxonomia (RN-004: taxonomia é dado, não código)
-- ------------------------------------------------------------
CREATE TABLE "TemaConsulta" (
  "TemaConsulta_Id"    serial PRIMARY KEY,
  "TemaConsulta_Nome"  text NOT NULL,
  "TemaConsulta_Ordem" int NOT NULL
);

CREATE TABLE "SubtemaConsulta" (
  "SubtemaConsulta_Id"     serial PRIMARY KEY,
  "SubtemaConsulta_TemaId" int NOT NULL REFERENCES "TemaConsulta"("TemaConsulta_Id"),
  "SubtemaConsulta_Nome"   text NOT NULL,
  "SubtemaConsulta_Status" text NOT NULL DEFAULT 'SEM_FONTE'
    CHECK ("SubtemaConsulta_Status" IN ('DISPONIVEL','EM_CONSTRUCAO','SEM_FONTE'))
);

-- ------------------------------------------------------------
-- 11.3 Fontes, cargas, indicadores e observações
-- ------------------------------------------------------------
CREATE TABLE "Fonte" (
  "Fonte_Id"            serial PRIMARY KEY,
  "Fonte_Nome"          text NOT NULL,
  "Fonte_Origem"        text,
  "Fonte_Url"           text,
  -- RG-06 / RC-07: fonte sem base legal ⇒ conector não executa
  "Fonte_BaseLegal"     text NOT NULL
    CHECK ("Fonte_BaseLegal" IN ('AUTORIZACAO_FORMAL','API_PUBLICA','DADO_ABERTO','LICENCA_COMERCIAL')),
  "Fonte_Licenca"       text NOT NULL,
  "Fonte_Periodicidade" text,
  "Fonte_VigenciaInicio" date,
  "Fonte_VigenciaFim"    date
);

CREATE TABLE "Carga" (
  "Carga_Id"            serial PRIMARY KEY,
  "Carga_FonteId"       int NOT NULL REFERENCES "Fonte"("Fonte_Id"),
  "Carga_DataExtracao"  timestamptz NOT NULL,
  "Carga_HashSha256"    char(64) NOT NULL,     -- hash do bruto (camada Bronze)
  "Carga_CaminhoBronze" text NOT NULL,
  "Carga_Status"        text NOT NULL DEFAULT 'PROMOVIDA',
  "Carga_LinhasLidas"       int DEFAULT 0,
  "Carga_LinhasQuarentena"  int DEFAULT 0
);

CREATE TABLE "Indicador" (
  "Indicador_Id"            serial PRIMARY KEY,
  "Indicador_SubtemaId"     int NOT NULL REFERENCES "SubtemaConsulta"("SubtemaConsulta_Id"),
  "Indicador_Nome"          text NOT NULL,
  "Indicador_Unidade"       text NOT NULL,
  -- RN-003: estoque soma; taxa recalcula; o bloqueio é na camada de serviço
  "Indicador_TipoAgregacao" text NOT NULL
    CHECK ("Indicador_TipoAgregacao" IN ('SOMA','MEDIA_PONDERADA','RECALCULO','NAO_AGREGAVEL')),
  "Indicador_NumeradorId"   int REFERENCES "Indicador"("Indicador_Id"),
  "Indicador_DenominadorId" int REFERENCES "Indicador"("Indicador_Id"),
  "Indicador_MetodologiaUrl" text,
  "Indicador_StatusValidacao" text NOT NULL DEFAULT 'APROVADO'
);

-- Observação: particionada por ano de DataReferencia (PRD §11.3)
CREATE TABLE "Observacao" (
  "Observacao_Id"             bigserial,
  "Observacao_IndicadorId"    int NOT NULL REFERENCES "Indicador"("Indicador_Id"),
  "Observacao_CodigoIbge"     char(7) NOT NULL REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "Observacao_DataReferencia" date NOT NULL,
  "Observacao_Valor"          numeric NOT NULL,
  "Observacao_FonteId"        int NOT NULL REFERENCES "Fonte"("Fonte_Id"),
  "Observacao_CargaId"        int NOT NULL REFERENCES "Carga"("Carga_Id"),
  PRIMARY KEY ("Observacao_Id","Observacao_DataReferencia"),
  UNIQUE ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_FonteId")
) PARTITION BY RANGE ("Observacao_DataReferencia");

CREATE TABLE "Observacao_2020" PARTITION OF "Observacao" FOR VALUES FROM ('2020-01-01') TO ('2023-01-01');
CREATE TABLE "Observacao_2023" PARTITION OF "Observacao" FOR VALUES FROM ('2023-01-01') TO ('2026-01-01');
CREATE TABLE "Observacao_2026" PARTITION OF "Observacao" FOR VALUES FROM ('2026-01-01') TO ('2029-01-01');
CREATE INDEX idx_obs_lookup ON "Observacao" ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia");

-- ------------------------------------------------------------
-- 11.5 Auditoria imutável (RN-007 / RG-10 / RF-ADMIN-005)
-- ------------------------------------------------------------
CREATE TABLE "EventoAuditoria" (
  "EventoAuditoria_Id"          bigserial PRIMARY KEY,
  "EventoAuditoria_Timestamp"   timestamptz NOT NULL DEFAULT now(),
  "EventoAuditoria_Ator"        text NOT NULL,
  "EventoAuditoria_Acao"        text NOT NULL,
  "EventoAuditoria_Entidade"    text NOT NULL,
  "EventoAuditoria_EntidadeId"  text,
  "EventoAuditoria_Payload"     jsonb NOT NULL,
  "EventoAuditoria_HashAnterior" char(64) NOT NULL,
  "EventoAuditoria_HashAtual"    char(64) NOT NULL
);

-- INSERT-ONLY imposto por grant de banco, não por convenção de equipe.
-- Role é objeto do CLUSTER: criação idempotente. Senha 'itmt_app' é de
-- DEV — em produção: ALTER ROLE itmt_app PASSWORD '<segredo>';
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'itmt_app') THEN
    CREATE ROLE itmt_app LOGIN PASSWORD 'itmt_app';
  END IF;
END $$;
GRANT CONNECT ON DATABASE itmt TO itmt_app;
GRANT USAGE ON SCHEMA public TO itmt_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO itmt_app;
GRANT INSERT ON "EventoAuditoria" TO itmt_app;
GRANT USAGE ON SEQUENCE "EventoAuditoria_EventoAuditoria_Id_seq" TO itmt_app;
REVOKE UPDATE, DELETE ON "EventoAuditoria" FROM itmt_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO itmt_app;
