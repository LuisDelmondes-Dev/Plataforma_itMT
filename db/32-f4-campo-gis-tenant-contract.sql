-- Contract dos domínios GIS, mídia e campo.
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('ProjetoLevantamento','ProjetoLevantamento'),('ProdutoGeografico','ProdutoGeografico'),
    ('CapturaImagemRua','CapturaImagemRua'),('ProjetoEstruturante','ProjetoEstruturante'),
    ('TermoConsentimento','TermoConsentimento'),('AtivoMidia','AtivoMidia'),
    ('MissaoCampo','MissaoCampo'),('MissaoAutorizacao','MissaoAutorizacao'),('CapturaCampo','CapturaCampo')
  ) x(t,p) LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT "ContextoTenant_Id"()',item.t,item.p||'_TenantId');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT "ContextoOrganizacao_Id"()',item.t,item.p||'_OrganizacaoId');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET NOT NULL',item.t,item.p||'_TenantId');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET NOT NULL',item.t,item.p||'_OrganizacaoId');
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',item.t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',item.t);
  END LOOP;
END $$;

ALTER TABLE "ProjetoLevantamento" ADD CONSTRAINT "ProjetoLevantamento_scope_id_uk" UNIQUE
  ("ProjetoLevantamento_TenantId","ProjetoLevantamento_OrganizacaoId","ProjetoLevantamento_Id");
ALTER TABLE "ProdutoGeografico" ADD CONSTRAINT "ProdutoGeografico_scope_projeto_fk" FOREIGN KEY
  ("ProdutoGeografico_TenantId","ProdutoGeografico_OrganizacaoId","ProdutoGeografico_ProjetoId")
  REFERENCES "ProjetoLevantamento"("ProjetoLevantamento_TenantId","ProjetoLevantamento_OrganizacaoId","ProjetoLevantamento_Id");
ALTER TABLE "TermoConsentimento" ADD CONSTRAINT "TermoConsentimento_scope_id_uk" UNIQUE
  ("TermoConsentimento_TenantId","TermoConsentimento_OrganizacaoId","TermoConsentimento_Id");
ALTER TABLE "AtivoMidia" ADD CONSTRAINT "AtivoMidia_scope_termo_fk" FOREIGN KEY
  ("AtivoMidia_TenantId","AtivoMidia_OrganizacaoId","AtivoMidia_TermoConsentimentoId")
  REFERENCES "TermoConsentimento"("TermoConsentimento_TenantId","TermoConsentimento_OrganizacaoId","TermoConsentimento_Id");
ALTER TABLE "MissaoCampo" ADD CONSTRAINT "MissaoCampo_scope_id_uk" UNIQUE
  ("MissaoCampo_TenantId","MissaoCampo_OrganizacaoId","MissaoCampo_Id");
ALTER TABLE "MissaoAutorizacao" ADD CONSTRAINT "MissaoAutorizacao_scope_missao_fk" FOREIGN KEY
  ("MissaoAutorizacao_TenantId","MissaoAutorizacao_OrganizacaoId","MissaoAutorizacao_MissaoId")
  REFERENCES "MissaoCampo"("MissaoCampo_TenantId","MissaoCampo_OrganizacaoId","MissaoCampo_Id");
ALTER TABLE "CapturaCampo" ADD CONSTRAINT "CapturaCampo_scope_missao_fk" FOREIGN KEY
  ("CapturaCampo_TenantId","CapturaCampo_OrganizacaoId","CapturaCampo_MissaoId")
  REFERENCES "MissaoCampo"("MissaoCampo_TenantId","MissaoCampo_OrganizacaoId","MissaoCampo_Id");

CREATE POLICY projeto_levantamento_read ON "ProjetoLevantamento" FOR SELECT USING (
  ("ProjetoLevantamento_TenantId"="ContextoTenant_Id"() AND "ProjetoLevantamento_OrganizacaoId"="ContextoOrganizacao_Id"()) OR
  EXISTS (SELECT 1 FROM "ProdutoGeografico" p WHERE p."ProdutoGeografico_ProjetoId"="ProjetoLevantamento_Id"
    AND p."ProdutoGeografico_StatusPublicacao"='PUBLICADO' AND p."ProdutoGeografico_Classificacao"='PUBLICO'));
CREATE POLICY projeto_levantamento_write ON "ProjetoLevantamento" FOR ALL
  USING ("ProjetoLevantamento_TenantId"="ContextoTenant_Id"() AND "ProjetoLevantamento_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("ProjetoLevantamento_TenantId"="ContextoTenant_Id"() AND "ProjetoLevantamento_OrganizacaoId"="ContextoOrganizacao_Id"());
CREATE POLICY produto_geografico_read ON "ProdutoGeografico" FOR SELECT USING (
  ("ProdutoGeografico_StatusPublicacao"='PUBLICADO' AND "ProdutoGeografico_Classificacao"='PUBLICO') OR
  ("ProdutoGeografico_TenantId"="ContextoTenant_Id"() AND "ProdutoGeografico_OrganizacaoId"="ContextoOrganizacao_Id"()));
CREATE POLICY produto_geografico_write ON "ProdutoGeografico" FOR ALL
  USING ("ProdutoGeografico_TenantId"="ContextoTenant_Id"() AND "ProdutoGeografico_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("ProdutoGeografico_TenantId"="ContextoTenant_Id"() AND "ProdutoGeografico_OrganizacaoId"="ContextoOrganizacao_Id"());
CREATE POLICY captura_rua_read ON "CapturaImagemRua" FOR SELECT USING (
  "CapturaImagemRua_Origem"='PREEXISTENTE' OR "CapturaImagemRua_StatusPublicacao"='PUBLICADO' OR
  ("CapturaImagemRua_TenantId"="ContextoTenant_Id"() AND "CapturaImagemRua_OrganizacaoId"="ContextoOrganizacao_Id"()));
CREATE POLICY captura_rua_write ON "CapturaImagemRua" FOR ALL
  USING ("CapturaImagemRua_TenantId"="ContextoTenant_Id"() AND "CapturaImagemRua_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("CapturaImagemRua_TenantId"="ContextoTenant_Id"() AND "CapturaImagemRua_OrganizacaoId"="ContextoOrganizacao_Id"());
CREATE POLICY estruturante_read ON "ProjetoEstruturante" FOR SELECT USING (true);
CREATE POLICY estruturante_write ON "ProjetoEstruturante" FOR ALL
  USING ("ProjetoEstruturante_TenantId"="ContextoTenant_Id"() AND "ProjetoEstruturante_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("ProjetoEstruturante_TenantId"="ContextoTenant_Id"() AND "ProjetoEstruturante_OrganizacaoId"="ContextoOrganizacao_Id"());
CREATE POLICY termo_context ON "TermoConsentimento" FOR ALL
  USING ("TermoConsentimento_TenantId"="ContextoTenant_Id"() AND "TermoConsentimento_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("TermoConsentimento_TenantId"="ContextoTenant_Id"() AND "TermoConsentimento_OrganizacaoId"="ContextoOrganizacao_Id"());
CREATE POLICY ativo_midia_read ON "AtivoMidia" FOR SELECT USING (
  "AtivoMidia_StatusPublicacao"='PUBLICADO' OR
  ("AtivoMidia_TenantId"="ContextoTenant_Id"() AND "AtivoMidia_OrganizacaoId"="ContextoOrganizacao_Id"()));
CREATE POLICY ativo_midia_write ON "AtivoMidia" FOR ALL
  USING ("AtivoMidia_TenantId"="ContextoTenant_Id"() AND "AtivoMidia_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("AtivoMidia_TenantId"="ContextoTenant_Id"() AND "AtivoMidia_OrganizacaoId"="ContextoOrganizacao_Id"());
CREATE POLICY missao_context ON "MissaoCampo" FOR ALL
  USING ("MissaoCampo_TenantId"="ContextoTenant_Id"() AND "MissaoCampo_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("MissaoCampo_TenantId"="ContextoTenant_Id"() AND "MissaoCampo_OrganizacaoId"="ContextoOrganizacao_Id"());
CREATE POLICY missao_autorizacao_context ON "MissaoAutorizacao" FOR ALL
  USING ("MissaoAutorizacao_TenantId"="ContextoTenant_Id"() AND "MissaoAutorizacao_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("MissaoAutorizacao_TenantId"="ContextoTenant_Id"() AND "MissaoAutorizacao_OrganizacaoId"="ContextoOrganizacao_Id"());
CREATE POLICY captura_campo_context ON "CapturaCampo" FOR ALL
  USING ("CapturaCampo_TenantId"="ContextoTenant_Id"() AND "CapturaCampo_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("CapturaCampo_TenantId"="ContextoTenant_Id"() AND "CapturaCampo_OrganizacaoId"="ContextoOrganizacao_Id"());

REVOKE ALL PRIVILEGES ON "ProjetoLevantamento","ProdutoGeografico","CapturaImagemRua","ProjetoEstruturante",
  "TermoConsentimento","AtivoMidia","MissaoCampo","MissaoAutorizacao","CapturaCampo" FROM itmt_app;
GRANT SELECT,INSERT,UPDATE ON "ProjetoLevantamento","ProdutoGeografico","CapturaImagemRua","ProjetoEstruturante",
  "TermoConsentimento","AtivoMidia","MissaoCampo","MissaoAutorizacao","CapturaCampo" TO itmt_app;
GRANT USAGE,SELECT ON SEQUENCE "ProjetoLevantamento_ProjetoLevantamento_Id_seq","ProdutoGeografico_ProdutoGeografico_Id_seq",
  "CapturaImagemRua_CapturaImagemRua_Id_seq","ProjetoEstruturante_ProjetoEstruturante_Id_seq",
  "TermoConsentimento_TermoConsentimento_Id_seq","AtivoMidia_AtivoMidia_Id_seq",
  "MissaoCampo_MissaoCampo_Id_seq","CapturaCampo_CapturaCampo_Id_seq" TO itmt_app;

