ALTER TABLE "ContribuicaoDado"
  ALTER COLUMN "ContribuicaoDado_TenantId" SET DEFAULT "ContextoTenant_Id"(),
  ALTER COLUMN "ContribuicaoDado_OrganizacaoId" SET DEFAULT "ContextoOrganizacao_Id"(),
  ALTER COLUMN "ContribuicaoDado_TenantId" SET NOT NULL,
  ALTER COLUMN "ContribuicaoDado_OrganizacaoId" SET NOT NULL;
ALTER TABLE "ContribuicaoDado" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContribuicaoDado" FORCE ROW LEVEL SECURITY;
CREATE POLICY contribuicao_context ON "ContribuicaoDado" FOR ALL
  USING ("ContribuicaoDado_TenantId"="ContextoTenant_Id"() AND "ContribuicaoDado_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("ContribuicaoDado_TenantId"="ContextoTenant_Id"() AND "ContribuicaoDado_OrganizacaoId"="ContextoOrganizacao_Id"());
REVOKE ALL PRIVILEGES ON "ContribuicaoDado" FROM itmt_app;
GRANT SELECT,INSERT,UPDATE ON "ContribuicaoDado" TO itmt_app;
GRANT USAGE,SELECT ON SEQUENCE "ContribuicaoDado_ContribuicaoDado_Id_seq" TO itmt_app;

