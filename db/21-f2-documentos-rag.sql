-- ============================================================
-- 21-f2-documentos-rag.sql — biblioteca documental da Fase 2.
-- Upload e extração não publicam conteúdo: uma revisão humana explícita
-- é obrigatória. A busca pública usa FTS nativo do PostgreSQL e sempre
-- devolve documento, versão e trecho para permitir citação verificável.
-- ============================================================

CREATE TABLE IF NOT EXISTS "Documento" (
  "Documento_Id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "Documento_Titulo" text NOT NULL CHECK (length(btrim("Documento_Titulo")) BETWEEN 3 AND 240),
  "Documento_Descricao" text,
  "Documento_Orgao" text NOT NULL CHECK (length(btrim("Documento_Orgao")) BETWEEN 2 AND 180),
  "Documento_Tipo" text NOT NULL CHECK ("Documento_Tipo" IN
    ('RELATORIO','ESTUDO','LEGISLACAO','PLANO','NOTA_TECNICA','BASE_METODOLOGICA','OUTRO')),
  "Documento_CodigoIbge" char(7) REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "Documento_Licenca" text NOT NULL,
  "Documento_FonteUrl" text,
  "Documento_Status" text NOT NULL DEFAULT 'EM_ANALISE' CHECK
    ("Documento_Status" IN ('EM_ANALISE','PUBLICADO','REJEITADO')),
  "Documento_CriadoPor" text NOT NULL,
  "Documento_CriadoEm" timestamptz NOT NULL DEFAULT now(),
  "Documento_AtualizadoEm" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Documento_Status_CriadoEm_idx"
  ON "Documento" ("Documento_CriadoEm" DESC)
  WHERE "Documento_Status" = 'PUBLICADO';
CREATE INDEX IF NOT EXISTS "Documento_CodigoIbge_idx"
  ON "Documento" ("Documento_CodigoIbge")
  WHERE "Documento_CodigoIbge" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "DocumentoVersao" (
  "DocumentoVersao_Id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "DocumentoVersao_DocumentoId" bigint NOT NULL REFERENCES "Documento"("Documento_Id") ON DELETE CASCADE,
  "DocumentoVersao_Numero" integer NOT NULL CHECK ("DocumentoVersao_Numero" > 0),
  "DocumentoVersao_NomeArquivo" text NOT NULL,
  "DocumentoVersao_Mime" text NOT NULL,
  "DocumentoVersao_TamanhoBytes" bigint NOT NULL CHECK
    ("DocumentoVersao_TamanhoBytes" > 0 AND "DocumentoVersao_TamanhoBytes" <= 15728640),
  "DocumentoVersao_HashSha256" char(64) NOT NULL CHECK
    ("DocumentoVersao_HashSha256" ~ '^[0-9a-f]{64}$'),
  "DocumentoVersao_CaminhoObjeto" text NOT NULL,
  "DocumentoVersao_StatusExtracao" text NOT NULL DEFAULT 'PENDENTE' CHECK
    ("DocumentoVersao_StatusExtracao" IN ('PENDENTE','PROCESSADO','REVISAO_NECESSARIA','ERRO')),
  "DocumentoVersao_MetodoExtracao" text,
  "DocumentoVersao_Confianca" numeric(4,3) CHECK
    ("DocumentoVersao_Confianca" BETWEEN 0 AND 1),
  "DocumentoVersao_TextoExtraido" text,
  "DocumentoVersao_CriadoEm" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("DocumentoVersao_DocumentoId", "DocumentoVersao_Numero"),
  UNIQUE ("DocumentoVersao_DocumentoId", "DocumentoVersao_HashSha256")
);

CREATE INDEX IF NOT EXISTS "DocumentoVersao_DocumentoId_idx"
  ON "DocumentoVersao" ("DocumentoVersao_DocumentoId", "DocumentoVersao_Numero" DESC);
CREATE INDEX IF NOT EXISTS "DocumentoVersao_Revisao_idx"
  ON "DocumentoVersao" ("DocumentoVersao_CriadoEm")
  WHERE "DocumentoVersao_StatusExtracao" IN ('PENDENTE','REVISAO_NECESSARIA','ERRO');

CREATE TABLE IF NOT EXISTS "DocumentoTrecho" (
  "DocumentoTrecho_Id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "DocumentoTrecho_VersaoId" bigint NOT NULL REFERENCES "DocumentoVersao"("DocumentoVersao_Id") ON DELETE CASCADE,
  "DocumentoTrecho_Ordem" integer NOT NULL CHECK ("DocumentoTrecho_Ordem" >= 0),
  "DocumentoTrecho_Pagina" integer CHECK ("DocumentoTrecho_Pagina" > 0),
  "DocumentoTrecho_Conteudo" text NOT NULL CHECK (length(btrim("DocumentoTrecho_Conteudo")) > 0),
  "DocumentoTrecho_Busca" tsvector GENERATED ALWAYS AS
    (to_tsvector('portuguese', coalesce("DocumentoTrecho_Conteudo", ''))) STORED,
  UNIQUE ("DocumentoTrecho_VersaoId", "DocumentoTrecho_Ordem")
);

CREATE INDEX IF NOT EXISTS "DocumentoTrecho_VersaoId_idx"
  ON "DocumentoTrecho" ("DocumentoTrecho_VersaoId", "DocumentoTrecho_Ordem");
CREATE INDEX IF NOT EXISTS "DocumentoTrecho_Busca_idx"
  ON "DocumentoTrecho" USING gin ("DocumentoTrecho_Busca");

CREATE TABLE IF NOT EXISTS "DocumentoRevisao" (
  "DocumentoRevisao_Id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "DocumentoRevisao_VersaoId" bigint NOT NULL REFERENCES "DocumentoVersao"("DocumentoVersao_Id"),
  "DocumentoRevisao_Revisor" text NOT NULL,
  "DocumentoRevisao_Decisao" text NOT NULL CHECK
    ("DocumentoRevisao_Decisao" IN ('APROVADO','REJEITADO')),
  "DocumentoRevisao_Justificativa" text NOT NULL CHECK
    (length(btrim("DocumentoRevisao_Justificativa")) >= 10),
  "DocumentoRevisao_Quando" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("DocumentoRevisao_VersaoId")
);

CREATE INDEX IF NOT EXISTS "DocumentoRevisao_VersaoId_idx"
  ON "DocumentoRevisao" ("DocumentoRevisao_VersaoId");

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "Documento", "DocumentoVersao", "DocumentoTrecho", "DocumentoRevisao" TO itmt_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO itmt_app;

