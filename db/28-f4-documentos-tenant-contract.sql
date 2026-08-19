-- ============================================================
-- 28-f4-documentos-tenant-contract.sql — contract Documentos/RAG.
-- Contexto ausente nega dados privados; somente documentos PUBLICADOS têm
-- leitura pública. Escritas exigem SET LOCAL tenant+organização.
-- ============================================================

ALTER TABLE "Documento"
  ALTER COLUMN "Documento_TenantId" SET DEFAULT "ContextoTenant_Id"(),
  ALTER COLUMN "Documento_OrganizacaoId" SET DEFAULT "ContextoOrganizacao_Id"(),
  ALTER COLUMN "Documento_TenantId" SET NOT NULL,
  ALTER COLUMN "Documento_OrganizacaoId" SET NOT NULL,
  ADD CONSTRAINT "Documento_scope_id_uk" UNIQUE ("Documento_TenantId","Documento_OrganizacaoId","Documento_Id");

DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('DocumentoVersao','DocumentoVersao','DocumentoVersao_Id','DocumentoVersao_DocumentoId','Documento','Documento_Id'),
    ('DocumentoTrecho','DocumentoTrecho','DocumentoTrecho_Id','DocumentoTrecho_VersaoId','DocumentoVersao','DocumentoVersao_Id'),
    ('DocumentoRevisao','DocumentoRevisao','DocumentoRevisao_Id','DocumentoRevisao_VersaoId','DocumentoVersao','DocumentoVersao_Id'),
    ('DocumentoTarefa','DocumentoTarefa','DocumentoTarefa_Id','DocumentoTarefa_VersaoId','DocumentoVersao','DocumentoVersao_Id'),
    ('DocumentoEmbedding','DocumentoEmbedding','DocumentoEmbedding_Id','DocumentoEmbedding_TrechoId','DocumentoTrecho','DocumentoTrecho_Id')
  ) AS x(child_table,prefix,child_pk,parent_id,parent_table,parent_pk)
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT "ContextoTenant_Id"()', item.child_table,item.prefix||'_TenantId');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT "ContextoOrganizacao_Id"()', item.child_table,item.prefix||'_OrganizacaoId');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET NOT NULL', item.child_table,item.prefix||'_TenantId');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET NOT NULL', item.child_table,item.prefix||'_OrganizacaoId');
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (%I,%I,%I)',
      item.child_table,item.child_table||'_scope_id_uk',item.prefix||'_TenantId',item.prefix||'_OrganizacaoId',item.child_pk);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I,%I,%I) REFERENCES %I(%I,%I,%I) ON DELETE CASCADE NOT VALID',
      item.child_table,item.child_table||'_scope_parent_fk',item.prefix||'_TenantId',item.prefix||'_OrganizacaoId',item.parent_id,
      item.parent_table,item.parent_table||'_TenantId',item.parent_table||'_OrganizacaoId',item.parent_pk);
    EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', item.child_table,item.child_table||'_scope_parent_fk');
  END LOOP;
END $$;

-- A revisão não deve ser apagada em cascata por semântica, embora a FK composta
-- de isolamento precise existir. Preserva-se o RESTRICT da FK original.
ALTER TABLE "DocumentoRevisao" DROP CONSTRAINT "DocumentoRevisao_scope_parent_fk";
ALTER TABLE "DocumentoRevisao" ADD CONSTRAINT "DocumentoRevisao_scope_parent_fk"
  FOREIGN KEY ("DocumentoRevisao_TenantId","DocumentoRevisao_OrganizacaoId","DocumentoRevisao_VersaoId")
  REFERENCES "DocumentoVersao"("DocumentoVersao_TenantId","DocumentoVersao_OrganizacaoId","DocumentoVersao_Id")
  ON DELETE RESTRICT;

ALTER TABLE "Documento" ENABLE ROW LEVEL SECURITY; ALTER TABLE "Documento" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DocumentoVersao" ENABLE ROW LEVEL SECURITY; ALTER TABLE "DocumentoVersao" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DocumentoTrecho" ENABLE ROW LEVEL SECURITY; ALTER TABLE "DocumentoTrecho" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DocumentoRevisao" ENABLE ROW LEVEL SECURITY; ALTER TABLE "DocumentoRevisao" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DocumentoTarefa" ENABLE ROW LEVEL SECURITY; ALTER TABLE "DocumentoTarefa" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DocumentoEmbedding" ENABLE ROW LEVEL SECURITY; ALTER TABLE "DocumentoEmbedding" FORCE ROW LEVEL SECURITY;

CREATE POLICY documento_read ON "Documento" FOR SELECT USING (
  "Documento_Status"='PUBLICADO' OR
  ("Documento_TenantId"="ContextoTenant_Id"() AND "Documento_OrganizacaoId"="ContextoOrganizacao_Id"())
);
CREATE POLICY documento_write ON "Documento" FOR ALL
  USING ("Documento_TenantId"="ContextoTenant_Id"() AND "Documento_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("Documento_TenantId"="ContextoTenant_Id"() AND "Documento_OrganizacaoId"="ContextoOrganizacao_Id"());

CREATE POLICY documento_versao_read ON "DocumentoVersao" FOR SELECT USING (
  ("DocumentoVersao_TenantId"="ContextoTenant_Id"() AND "DocumentoVersao_OrganizacaoId"="ContextoOrganizacao_Id"()) OR
  EXISTS (SELECT 1 FROM "Documento" d WHERE d."Documento_Id"="DocumentoVersao_DocumentoId" AND d."Documento_Status"='PUBLICADO')
);
CREATE POLICY documento_versao_write ON "DocumentoVersao" FOR ALL
  USING ("DocumentoVersao_TenantId"="ContextoTenant_Id"() AND "DocumentoVersao_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("DocumentoVersao_TenantId"="ContextoTenant_Id"() AND "DocumentoVersao_OrganizacaoId"="ContextoOrganizacao_Id"());

CREATE POLICY documento_trecho_read ON "DocumentoTrecho" FOR SELECT USING (
  ("DocumentoTrecho_TenantId"="ContextoTenant_Id"() AND "DocumentoTrecho_OrganizacaoId"="ContextoOrganizacao_Id"()) OR
  EXISTS (SELECT 1 FROM "DocumentoVersao" v JOIN "Documento" d ON d."Documento_Id"=v."DocumentoVersao_DocumentoId"
    WHERE v."DocumentoVersao_Id"="DocumentoTrecho_VersaoId" AND d."Documento_Status"='PUBLICADO')
);
CREATE POLICY documento_trecho_write ON "DocumentoTrecho" FOR ALL
  USING ("DocumentoTrecho_TenantId"="ContextoTenant_Id"() AND "DocumentoTrecho_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("DocumentoTrecho_TenantId"="ContextoTenant_Id"() AND "DocumentoTrecho_OrganizacaoId"="ContextoOrganizacao_Id"());

CREATE POLICY documento_revisao_read ON "DocumentoRevisao" FOR SELECT USING (
  ("DocumentoRevisao_TenantId"="ContextoTenant_Id"() AND "DocumentoRevisao_OrganizacaoId"="ContextoOrganizacao_Id"()) OR
  EXISTS (SELECT 1 FROM "DocumentoVersao" v JOIN "Documento" d ON d."Documento_Id"=v."DocumentoVersao_DocumentoId"
    WHERE v."DocumentoVersao_Id"="DocumentoRevisao_VersaoId" AND d."Documento_Status"='PUBLICADO')
);
CREATE POLICY documento_revisao_write ON "DocumentoRevisao" FOR ALL
  USING ("DocumentoRevisao_TenantId"="ContextoTenant_Id"() AND "DocumentoRevisao_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("DocumentoRevisao_TenantId"="ContextoTenant_Id"() AND "DocumentoRevisao_OrganizacaoId"="ContextoOrganizacao_Id"());

CREATE POLICY documento_tarefa_context ON "DocumentoTarefa" FOR ALL
  USING ("DocumentoTarefa_TenantId"="ContextoTenant_Id"() AND "DocumentoTarefa_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("DocumentoTarefa_TenantId"="ContextoTenant_Id"() AND "DocumentoTarefa_OrganizacaoId"="ContextoOrganizacao_Id"());

CREATE POLICY documento_embedding_read ON "DocumentoEmbedding" FOR SELECT USING (
  ("DocumentoEmbedding_TenantId"="ContextoTenant_Id"() AND "DocumentoEmbedding_OrganizacaoId"="ContextoOrganizacao_Id"()) OR
  EXISTS (SELECT 1 FROM "DocumentoTrecho" t JOIN "DocumentoVersao" v ON v."DocumentoVersao_Id"=t."DocumentoTrecho_VersaoId"
    JOIN "Documento" d ON d."Documento_Id"=v."DocumentoVersao_DocumentoId"
    WHERE t."DocumentoTrecho_Id"="DocumentoEmbedding_TrechoId" AND d."Documento_Status"='PUBLICADO')
);
CREATE POLICY documento_embedding_write ON "DocumentoEmbedding" FOR ALL
  USING ("DocumentoEmbedding_TenantId"="ContextoTenant_Id"() AND "DocumentoEmbedding_OrganizacaoId"="ContextoOrganizacao_Id"())
  WITH CHECK ("DocumentoEmbedding_TenantId"="ContextoTenant_Id"() AND "DocumentoEmbedding_OrganizacaoId"="ContextoOrganizacao_Id"());

REVOKE ALL PRIVILEGES ON "Documento","DocumentoVersao","DocumentoTrecho","DocumentoRevisao","DocumentoTarefa","DocumentoEmbedding" FROM itmt_app;
GRANT SELECT,INSERT,UPDATE ON "Documento","DocumentoVersao" TO itmt_app;
GRANT SELECT,INSERT,DELETE ON "DocumentoTrecho" TO itmt_app;
GRANT SELECT,INSERT ON "DocumentoRevisao" TO itmt_app;
GRANT SELECT,INSERT,UPDATE ON "DocumentoTarefa","DocumentoEmbedding" TO itmt_app;
GRANT USAGE,SELECT ON SEQUENCE
  "Documento_Documento_Id_seq","DocumentoVersao_DocumentoVersao_Id_seq","DocumentoTrecho_DocumentoTrecho_Id_seq",
  "DocumentoRevisao_DocumentoRevisao_Id_seq","DocumentoTarefa_DocumentoTarefa_Id_seq",
  "DocumentoEmbedding_DocumentoEmbedding_Id_seq" TO itmt_app;
