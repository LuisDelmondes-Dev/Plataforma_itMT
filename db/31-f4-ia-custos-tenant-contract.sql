DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT * FROM (VALUES ('AgentExecution','AgentExecution'),('ConsumoLlm','ConsumoLlm')) x(t,p)
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT "ContextoTenant_Id"()',item.t,item.p||'_TenantId');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT "ContextoOrganizacao_Id"()',item.t,item.p||'_OrganizacaoId');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET NOT NULL',item.t,item.p||'_TenantId');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET NOT NULL',item.t,item.p||'_OrganizacaoId');
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',item.t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',item.t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (%I="ContextoTenant_Id"() AND %I="ContextoOrganizacao_Id"()) WITH CHECK (%I="ContextoTenant_Id"() AND %I="ContextoOrganizacao_Id"())',
      lower(item.t)||'_context',item.t,item.p||'_TenantId',item.p||'_OrganizacaoId',item.p||'_TenantId',item.p||'_OrganizacaoId');
  END LOOP;
END $$;
REVOKE ALL PRIVILEGES ON "AgentExecution","ConsumoLlm" FROM itmt_app;
GRANT SELECT,INSERT ON "AgentExecution","ConsumoLlm" TO itmt_app;
GRANT USAGE,SELECT ON SEQUENCE "AgentExecution_AgentExecution_Id_seq","ConsumoLlm_ConsumoLlm_Id_seq" TO itmt_app;

