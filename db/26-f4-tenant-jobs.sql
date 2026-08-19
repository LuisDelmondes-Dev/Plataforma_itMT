-- Jobs duráveis carregam o envelope tenant/org fora do payload opaco.
CREATE TABLE IF NOT EXISTS "TenantJob" (
  "TenantJob_Id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantJob_TenantId"       uuid NOT NULL,
  "TenantJob_OrganizacaoId"  uuid NOT NULL,
  "TenantJob_Tipo"           text NOT NULL CHECK ("TenantJob_Tipo" IN ('EXPORTAR','PROCESSAR_DOCUMENTO','SINCRONIZAR_CAMPO')),
  "TenantJob_RecursoId"      text NOT NULL,
  "TenantJob_Payload"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "TenantJob_IdempotencyKey" text NOT NULL CHECK (char_length("TenantJob_IdempotencyKey") BETWEEN 8 AND 160),
  "TenantJob_Status"         text NOT NULL DEFAULT 'PENDENTE' CHECK ("TenantJob_Status" IN ('PENDENTE','PROCESSANDO','CONCLUIDO','FALHOU','DESCARTADO')),
  "TenantJob_Tentativas"     integer NOT NULL DEFAULT 0 CHECK ("TenantJob_Tentativas" BETWEEN 0 AND 20),
  "TenantJob_ProximaEm"      timestamptz NOT NULL DEFAULT now(),
  "TenantJob_Erro"           text,
  "TenantJob_CriadoEm"       timestamptz NOT NULL DEFAULT now(),
  "TenantJob_AtualizadoEm"   timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY ("TenantJob_TenantId", "TenantJob_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId", "Organizacao_Id") ON DELETE CASCADE,
  UNIQUE ("TenantJob_TenantId", "TenantJob_OrganizacaoId", "TenantJob_IdempotencyKey")
);
CREATE INDEX IF NOT EXISTS idx_tenant_job_fila
  ON "TenantJob" ("TenantJob_TenantId","TenantJob_OrganizacaoId","TenantJob_Status","TenantJob_ProximaEm");

ALTER TABLE "TenantJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantJob" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_job_contexto ON "TenantJob"
  USING ("TenantJob_TenantId"="ContextoTenant_Id"() AND "TenantJob_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("TenantJob_TenantId"="ContextoTenant_Id"() AND "TenantJob_OrganizacaoId"="ContextoOrganizacao_Id"());

REVOKE ALL PRIVILEGES ON TABLE "TenantJob" FROM itmt_app;
GRANT SELECT, INSERT, UPDATE ON "TenantJob" TO itmt_app;
COMMENT ON TABLE "TenantJob" IS 'TENANT_OWNED: envelope tenant/org obrigatório; payload não decide autorização.';
