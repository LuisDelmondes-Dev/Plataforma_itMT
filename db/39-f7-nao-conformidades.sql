CREATE TABLE IF NOT EXISTS "NaoConformidade" (
  "NaoConformidade_Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "NaoConformidade_TenantId" uuid NOT NULL,
  "NaoConformidade_OrganizacaoId" uuid NOT NULL,
  "NaoConformidade_Titulo" text NOT NULL CHECK (char_length("NaoConformidade_Titulo") BETWEEN 5 AND 200),
  "NaoConformidade_Descricao" text NOT NULL CHECK (char_length("NaoConformidade_Descricao") BETWEEN 10 AND 5000),
  "NaoConformidade_Severidade" text NOT NULL CHECK ("NaoConformidade_Severidade" IN ('P0','P1','P2','P3')),
  "NaoConformidade_Status" text NOT NULL DEFAULT 'ABERTA' CHECK ("NaoConformidade_Status" IN ('ABERTA','TRIAGEM','EM_TRATAMENTO','RESOLVIDA','ACEITA')),
  "NaoConformidade_Owner" text NOT NULL,
  "NaoConformidade_Prazo" date,
  "NaoConformidade_Evidencia" text,
  "NaoConformidade_CriadaPor" text NOT NULL,
  "NaoConformidade_CriadaEm" timestamptz NOT NULL DEFAULT now(),
  "NaoConformidade_AtualizadaEm" timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY ("NaoConformidade_TenantId","NaoConformidade_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_nc_fila ON "NaoConformidade"
  ("NaoConformidade_TenantId","NaoConformidade_OrganizacaoId","NaoConformidade_Status","NaoConformidade_Severidade");
CREATE TABLE IF NOT EXISTS "NaoConformidadeHistorico" (
  "NaoConformidadeHistorico_Id" bigserial PRIMARY KEY,
  "NaoConformidadeHistorico_TenantId" uuid NOT NULL,
  "NaoConformidadeHistorico_OrganizacaoId" uuid NOT NULL,
  "NaoConformidadeHistorico_NaoConformidadeId" uuid NOT NULL REFERENCES "NaoConformidade"("NaoConformidade_Id") ON DELETE RESTRICT,
  "NaoConformidadeHistorico_De" text,
  "NaoConformidadeHistorico_Para" text NOT NULL,
  "NaoConformidadeHistorico_Ator" text NOT NULL,
  "NaoConformidadeHistorico_Justificativa" text NOT NULL,
  "NaoConformidadeHistorico_Quando" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "NaoConformidade" ENABLE ROW LEVEL SECURITY; ALTER TABLE "NaoConformidade" FORCE ROW LEVEL SECURITY;
ALTER TABLE "NaoConformidadeHistorico" ENABLE ROW LEVEL SECURITY; ALTER TABLE "NaoConformidadeHistorico" FORCE ROW LEVEL SECURITY;
CREATE POLICY nc_contexto ON "NaoConformidade" USING ("NaoConformidade_TenantId"="ContextoTenant_Id"() AND "NaoConformidade_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("NaoConformidade_TenantId"="ContextoTenant_Id"() AND "NaoConformidade_OrganizacaoId"="ContextoOrganizacao_Id"());
CREATE POLICY nc_historico_contexto ON "NaoConformidadeHistorico" USING ("NaoConformidadeHistorico_TenantId"="ContextoTenant_Id"() AND "NaoConformidadeHistorico_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("NaoConformidadeHistorico_TenantId"="ContextoTenant_Id"() AND "NaoConformidadeHistorico_OrganizacaoId"="ContextoOrganizacao_Id"());
REVOKE ALL ON "NaoConformidade","NaoConformidadeHistorico" FROM PUBLIC,itmt_app;
GRANT SELECT,INSERT,UPDATE ON "NaoConformidade" TO itmt_app;
GRANT SELECT,INSERT ON "NaoConformidadeHistorico" TO itmt_app;
GRANT USAGE,SELECT ON SEQUENCE "NaoConformidadeHistorico_NaoConformidadeHistorico_Id_seq" TO itmt_app;
COMMENT ON TABLE "NaoConformidadeHistorico" IS 'INSERT_ONLY: histórico de transições; UPDATE/DELETE não concedidos ao runtime.';
