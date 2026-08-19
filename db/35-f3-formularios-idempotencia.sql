CREATE TABLE IF NOT EXISTS "FormularioCampo" (
  "FormularioCampo_Versao" text PRIMARY KEY CHECK ("FormularioCampo_Versao" ~ '^campo-v[0-9]+$'),
  "FormularioCampo_Titulo" text NOT NULL,
  "FormularioCampo_Schema" jsonb NOT NULL,
  "FormularioCampo_Status" text NOT NULL CHECK ("FormularioCampo_Status" IN ('ATIVO','ARQUIVADO')),
  "FormularioCampo_CriadoEm" timestamptz NOT NULL DEFAULT now()
);
INSERT INTO "FormularioCampo" ("FormularioCampo_Versao","FormularioCampo_Titulo","FormularioCampo_Schema","FormularioCampo_Status")
VALUES ('campo-v1','Checklist de captura de campo',jsonb_build_object('checklist',jsonb_build_array(
  'Autorizações da missão conferidas e vigentes','Cartões de memória formatados e identificados',
  'GNSS com precisão aceitável para o produto','Plano de voo/roteiro validado com a equipe'
)),'ATIVO') ON CONFLICT ("FormularioCampo_Versao") DO NOTHING;

ALTER TABLE "CapturaCampo"
  ADD COLUMN IF NOT EXISTS "CapturaCampo_IdempotencyKey" uuid,
  ADD COLUMN IF NOT EXISTS "CapturaCampo_FormularioVersao" text,
  ADD COLUMN IF NOT EXISTS "CapturaCampo_PayloadHash" char(64);
UPDATE "CapturaCampo" SET
  "CapturaCampo_IdempotencyKey"=coalesce("CapturaCampo_IdempotencyKey",gen_random_uuid()),
  "CapturaCampo_FormularioVersao"=coalesce("CapturaCampo_FormularioVersao",'campo-v1'),
  "CapturaCampo_PayloadHash"=coalesce("CapturaCampo_PayloadHash",encode(sha256(('legacy:'||"CapturaCampo_Id")::bytea),'hex'));
ALTER TABLE "CapturaCampo"
  ALTER COLUMN "CapturaCampo_IdempotencyKey" SET NOT NULL,
  ALTER COLUMN "CapturaCampo_FormularioVersao" SET NOT NULL,
  ALTER COLUMN "CapturaCampo_PayloadHash" SET NOT NULL,
  ADD CONSTRAINT "CapturaCampo_formulario_fk" FOREIGN KEY ("CapturaCampo_FormularioVersao") REFERENCES "FormularioCampo"("FormularioCampo_Versao") ON DELETE RESTRICT,
  ADD CONSTRAINT "CapturaCampo_scope_idempotency_uk" UNIQUE ("CapturaCampo_TenantId","CapturaCampo_OrganizacaoId","CapturaCampo_IdempotencyKey");
GRANT SELECT ON "FormularioCampo" TO itmt_app;
