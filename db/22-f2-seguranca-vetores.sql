-- ============================================================
-- 22-f2-seguranca-vetores.sql — quarentena, fila concorrente e
-- embeddings da biblioteca documental.
--
-- O pgvector é ativado quando instalado no servidor. Em instalações
-- legadas sem a extensão, os embeddings continuam registrados em real[]
-- e a API degrada explicitamente para busca lexical.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
  END IF;
END $$;

ALTER TABLE "DocumentoVersao"
  ADD COLUMN IF NOT EXISTS "DocumentoVersao_StatusSeguranca" text NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS "DocumentoVersao_AntivirusAssinatura" text,
  ADD COLUMN IF NOT EXISTS "DocumentoVersao_AntivirusDetalhe" text,
  ADD COLUMN IF NOT EXISTS "DocumentoVersao_VerificadoEm" timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'DocumentoVersao_StatusSeguranca_check'
       AND conrelid = '"DocumentoVersao"'::regclass
  ) THEN
    ALTER TABLE "DocumentoVersao" ADD CONSTRAINT "DocumentoVersao_StatusSeguranca_check"
      CHECK ("DocumentoVersao_StatusSeguranca" IN ('PENDENTE','LIMPO','INFECTADO','ERRO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DocumentoVersao_SegurancaPendente_idx"
  ON "DocumentoVersao" ("DocumentoVersao_CriadoEm")
  WHERE "DocumentoVersao_StatusSeguranca" IN ('PENDENTE','ERRO');

CREATE TABLE IF NOT EXISTS "DocumentoTarefa" (
  "DocumentoTarefa_Id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "DocumentoTarefa_VersaoId" bigint NOT NULL
    REFERENCES "DocumentoVersao"("DocumentoVersao_Id") ON DELETE CASCADE,
  "DocumentoTarefa_Tipo" text NOT NULL CHECK
    ("DocumentoTarefa_Tipo" IN ('SCAN_EXTRAIR','GERAR_EMBEDDINGS')),
  "DocumentoTarefa_Status" text NOT NULL DEFAULT 'PENDENTE' CHECK
    ("DocumentoTarefa_Status" IN ('PENDENTE','PROCESSANDO','CONCLUIDA','FALHOU')),
  "DocumentoTarefa_Tentativas" smallint NOT NULL DEFAULT 0 CHECK
    ("DocumentoTarefa_Tentativas" BETWEEN 0 AND 10),
  "DocumentoTarefa_DisponivelEm" timestamptz NOT NULL DEFAULT now(),
  "DocumentoTarefa_ReivindicadaEm" timestamptz,
  "DocumentoTarefa_Worker" text,
  "DocumentoTarefa_Erro" text,
  "DocumentoTarefa_CriadaEm" timestamptz NOT NULL DEFAULT now(),
  "DocumentoTarefa_ConcluidaEm" timestamptz,
  UNIQUE ("DocumentoTarefa_VersaoId", "DocumentoTarefa_Tipo")
);

CREATE INDEX IF NOT EXISTS "DocumentoTarefa_Fila_idx"
  ON "DocumentoTarefa" ("DocumentoTarefa_DisponivelEm", "DocumentoTarefa_Id")
  WHERE "DocumentoTarefa_Status" = 'PENDENTE';
CREATE INDEX IF NOT EXISTS "DocumentoTarefa_VersaoId_idx"
  ON "DocumentoTarefa" ("DocumentoTarefa_VersaoId", "DocumentoTarefa_Tipo");

INSERT INTO "DocumentoTarefa"
  ("DocumentoTarefa_VersaoId", "DocumentoTarefa_Tipo")
SELECT v."DocumentoVersao_Id", 'SCAN_EXTRAIR'
  FROM "DocumentoVersao" v
 WHERE v."DocumentoVersao_StatusSeguranca" = 'PENDENTE'
ON CONFLICT ("DocumentoTarefa_VersaoId", "DocumentoTarefa_Tipo") DO NOTHING;

CREATE TABLE IF NOT EXISTS "DocumentoEmbedding" (
  "DocumentoEmbedding_Id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "DocumentoEmbedding_TrechoId" bigint NOT NULL
    REFERENCES "DocumentoTrecho"("DocumentoTrecho_Id") ON DELETE CASCADE,
  "DocumentoEmbedding_Modelo" text NOT NULL,
  "DocumentoEmbedding_Dimensoes" smallint NOT NULL CHECK
    ("DocumentoEmbedding_Dimensoes" BETWEEN 1 AND 2000),
  "DocumentoEmbedding_VetorArray" real[] NOT NULL,
  "DocumentoEmbedding_ConteudoHash" char(64) NOT NULL CHECK
    ("DocumentoEmbedding_ConteudoHash" ~ '^[0-9a-f]{64}$'),
  "DocumentoEmbedding_CriadoEm" timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality("DocumentoEmbedding_VetorArray") = "DocumentoEmbedding_Dimensoes"),
  UNIQUE ("DocumentoEmbedding_TrechoId", "DocumentoEmbedding_Modelo")
);

CREATE INDEX IF NOT EXISTS "DocumentoEmbedding_TrechoId_idx"
  ON "DocumentoEmbedding" ("DocumentoEmbedding_TrechoId");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'DocumentoEmbedding'
         AND column_name = 'DocumentoEmbedding_Vetor'
    ) THEN
      ALTER TABLE "DocumentoEmbedding"
        ADD COLUMN "DocumentoEmbedding_Vetor" vector(1536);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'DocumentoEmbedding_Vetor_hnsw_idx'
    ) THEN
      CREATE INDEX "DocumentoEmbedding_Vetor_hnsw_idx"
        ON "DocumentoEmbedding" USING hnsw ("DocumentoEmbedding_Vetor" vector_cosine_ops)
        WHERE "DocumentoEmbedding_Vetor" IS NOT NULL;
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "fn_documento_publicacao_segura"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."Documento_Status" = 'PUBLICADO' AND OLD."Documento_Status" IS DISTINCT FROM 'PUBLICADO' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "DocumentoVersao" v
      JOIN "DocumentoRevisao" r ON r."DocumentoRevisao_VersaoId" = v."DocumentoVersao_Id"
      WHERE v."DocumentoVersao_DocumentoId" = NEW."Documento_Id"
        AND v."DocumentoVersao_StatusSeguranca" = 'LIMPO'
        AND v."DocumentoVersao_StatusExtracao" = 'PROCESSADO'
        AND r."DocumentoRevisao_Decisao" = 'APROVADO'
    ) THEN
      RAISE EXCEPTION 'Documento só publica após antivírus, extração e revisão humana favorável.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "trg_documento_publicacao_segura" ON "Documento";
CREATE TRIGGER "trg_documento_publicacao_segura"
  BEFORE UPDATE OF "Documento_Status" ON "Documento"
  FOR EACH ROW EXECUTE FUNCTION "fn_documento_publicacao_segura"();

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "DocumentoTarefa", "DocumentoEmbedding" TO itmt_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO itmt_app;

