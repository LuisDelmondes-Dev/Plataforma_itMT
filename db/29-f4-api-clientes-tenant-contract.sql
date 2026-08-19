-- API clients são credenciais da organização, nunca de um e-mail textual.
ALTER TABLE "ApiCliente"
  ALTER COLUMN "ApiCliente_TenantId" SET DEFAULT "ContextoTenant_Id"(),
  ALTER COLUMN "ApiCliente_OrganizacaoId" SET DEFAULT "ContextoOrganizacao_Id"(),
  ALTER COLUMN "ApiCliente_TenantId" SET NOT NULL,
  ALTER COLUMN "ApiCliente_OrganizacaoId" SET NOT NULL,
  ADD CONSTRAINT "ApiCliente_scope_id_uk" UNIQUE ("ApiCliente_TenantId","ApiCliente_OrganizacaoId","ApiCliente_Id");
ALTER TABLE "ApiConsumoJanela"
  ALTER COLUMN "ApiConsumoJanela_TenantId" SET DEFAULT "ContextoTenant_Id"(),
  ALTER COLUMN "ApiConsumoJanela_OrganizacaoId" SET DEFAULT "ContextoOrganizacao_Id"(),
  ALTER COLUMN "ApiConsumoJanela_TenantId" SET NOT NULL,
  ALTER COLUMN "ApiConsumoJanela_OrganizacaoId" SET NOT NULL,
  ADD CONSTRAINT "ApiConsumoJanela_scope_parent_fk" FOREIGN KEY
    ("ApiConsumoJanela_TenantId","ApiConsumoJanela_OrganizacaoId","ApiConsumoJanela_ClienteId")
    REFERENCES "ApiCliente"("ApiCliente_TenantId","ApiCliente_OrganizacaoId","ApiCliente_Id") ON DELETE CASCADE;

ALTER TABLE "ApiCliente" ENABLE ROW LEVEL SECURITY; ALTER TABLE "ApiCliente" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ApiConsumoJanela" ENABLE ROW LEVEL SECURITY; ALTER TABLE "ApiConsumoJanela" FORCE ROW LEVEL SECURITY;
CREATE POLICY api_cliente_context ON "ApiCliente" FOR ALL
  USING ("ApiCliente_TenantId"="ContextoTenant_Id"() AND "ApiCliente_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("ApiCliente_TenantId"="ContextoTenant_Id"() AND "ApiCliente_OrganizacaoId"="ContextoOrganizacao_Id"());
CREATE POLICY api_consumo_context ON "ApiConsumoJanela" FOR ALL
  USING ("ApiConsumoJanela_TenantId"="ContextoTenant_Id"() AND "ApiConsumoJanela_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("ApiConsumoJanela_TenantId"="ContextoTenant_Id"() AND "ApiConsumoJanela_OrganizacaoId"="ContextoOrganizacao_Id"());

CREATE OR REPLACE FUNCTION "ResolverApiClientePorHash"(p_hash text)
RETURNS TABLE (cliente_id bigint, tenant_id uuid, organizacao_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT c."ApiCliente_Id",c."ApiCliente_TenantId",c."ApiCliente_OrganizacaoId"
    FROM public."ApiCliente" c
   WHERE length(p_hash)=64 AND c."ApiCliente_HashChave"=p_hash
     AND c."ApiCliente_Status"='ATIVA'
     AND (c."ApiCliente_ExpiraEm" IS NULL OR c."ApiCliente_ExpiraEm">now())
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION "ResolverApiClientePorHash"(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "ResolverApiClientePorHash"(text) TO itmt_app;

REVOKE ALL PRIVILEGES ON "ApiCliente","ApiConsumoJanela" FROM itmt_app;
GRANT SELECT,INSERT,UPDATE ON "ApiCliente","ApiConsumoJanela" TO itmt_app;
GRANT USAGE,SELECT ON SEQUENCE "ApiCliente_ApiCliente_Id_seq" TO itmt_app;

