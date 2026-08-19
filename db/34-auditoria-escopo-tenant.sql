ALTER TABLE "EventoAuditoria"
  ADD COLUMN IF NOT EXISTS "EventoAuditoria_TenantId" uuid,
  ADD COLUMN IF NOT EXISTS "EventoAuditoria_OrganizacaoId" uuid;
ALTER TABLE "EventoAuditoria" ADD CONSTRAINT "EventoAuditoria_scope_pair_check"
  CHECK (("EventoAuditoria_TenantId" IS NULL)=("EventoAuditoria_OrganizacaoId" IS NULL));
ALTER TABLE "EventoAuditoria" ADD CONSTRAINT "EventoAuditoria_scope_org_fk" FOREIGN KEY
  ("EventoAuditoria_TenantId","EventoAuditoria_OrganizacaoId")
  REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_evento_auditoria_scope_quando ON "EventoAuditoria"
  ("EventoAuditoria_TenantId","EventoAuditoria_OrganizacaoId","EventoAuditoria_Timestamp" DESC);
REVOKE UPDATE,DELETE,TRUNCATE ON "EventoAuditoria" FROM itmt_app;

