-- ============================================================
-- 24-f4-multitenancy-control-plane.sql — fundação SaaS fail-closed.
-- Tenant é a fronteira de segurança/billing; Organização é a unidade
-- colaborativa. Nesta etapa não se declara migração integral dos domínios.
-- ============================================================

CREATE TABLE IF NOT EXISTS "Tenant" (
  "Tenant_Id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "Tenant_Slug"      text NOT NULL UNIQUE CHECK ("Tenant_Slug" ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  "Tenant_Nome"      text NOT NULL CHECK (char_length("Tenant_Nome") BETWEEN 3 AND 160),
  "Tenant_Status"    text NOT NULL DEFAULT 'ATIVO' CHECK ("Tenant_Status" IN ('ATIVO','SUSPENSO','ENCERRADO')),
  "Tenant_CriadoEm"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Organizacao" (
  "Organizacao_Id"       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "Organizacao_TenantId" uuid NOT NULL REFERENCES "Tenant"("Tenant_Id") ON DELETE RESTRICT,
  "Organizacao_Slug"     text NOT NULL CHECK ("Organizacao_Slug" ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  "Organizacao_Nome"     text NOT NULL CHECK (char_length("Organizacao_Nome") BETWEEN 3 AND 160),
  "Organizacao_Status"   text NOT NULL DEFAULT 'ATIVA' CHECK ("Organizacao_Status" IN ('ATIVA','SUSPENSA','ENCERRADA')),
  "Organizacao_CriadaEm" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("Organizacao_TenantId", "Organizacao_Id"),
  UNIQUE ("Organizacao_TenantId", "Organizacao_Slug")
);

CREATE TABLE IF NOT EXISTS "OrganizacaoMembro" (
  "OrganizacaoMembro_TenantId"      uuid NOT NULL,
  "OrganizacaoMembro_OrganizacaoId" uuid NOT NULL,
  "OrganizacaoMembro_UsuarioId"     bigint NOT NULL REFERENCES "Usuario"("Usuario_Id") ON DELETE CASCADE,
  "OrganizacaoMembro_Papel"         text NOT NULL CHECK ("OrganizacaoMembro_Papel" IN ('OWNER','ADMIN','CURADOR','MEMBRO','LEITOR')),
  "OrganizacaoMembro_Status"        text NOT NULL DEFAULT 'ATIVO' CHECK ("OrganizacaoMembro_Status" IN ('ATIVO','CONVIDADO','SUSPENSO')),
  "OrganizacaoMembro_Versao"        bigint NOT NULL DEFAULT 1 CHECK ("OrganizacaoMembro_Versao" > 0),
  "OrganizacaoMembro_CriadoEm"      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("OrganizacaoMembro_OrganizacaoId", "OrganizacaoMembro_UsuarioId"),
  FOREIGN KEY ("OrganizacaoMembro_TenantId", "OrganizacaoMembro_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId", "Organizacao_Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlanoComercial" (
  "PlanoComercial_Id"          bigserial PRIMARY KEY,
  "PlanoComercial_Codigo"      text NOT NULL UNIQUE,
  "PlanoComercial_Nome"        text NOT NULL,
  "PlanoComercial_Limites"     jsonb NOT NULL DEFAULT '{}'::jsonb,
  "PlanoComercial_PrecoCentavo" bigint NOT NULL DEFAULT 0 CHECK ("PlanoComercial_PrecoCentavo" >= 0),
  "PlanoComercial_Ativo"       boolean NOT NULL DEFAULT true,
  "PlanoComercial_CriadoEm"    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Assinatura" (
  "Assinatura_Id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "Assinatura_TenantId"      uuid NOT NULL,
  "Assinatura_OrganizacaoId" uuid NOT NULL,
  "Assinatura_PlanoId"       bigint NOT NULL REFERENCES "PlanoComercial"("PlanoComercial_Id") ON DELETE RESTRICT,
  "Assinatura_Status"        text NOT NULL DEFAULT 'TRIAL' CHECK ("Assinatura_Status" IN ('TRIAL','ATIVA','ATRASADA','SUSPENSA','CANCELADA')),
  "Assinatura_InicioEm"      timestamptz NOT NULL DEFAULT now(),
  "Assinatura_FimEm"         timestamptz,
  "Assinatura_Versao"       bigint NOT NULL DEFAULT 1,
  FOREIGN KEY ("Assinatura_TenantId", "Assinatura_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId", "Organizacao_Id") ON DELETE RESTRICT,
  UNIQUE ("Assinatura_TenantId", "Assinatura_OrganizacaoId")
);

-- Primeiro recurso privado canônico. Também serve como registro de configuração
-- versionável da organização; filhos carregam tenant+organização e FK composta.
CREATE TABLE IF NOT EXISTS "OrganizacaoConfiguracao" (
  "OrganizacaoConfiguracao_TenantId"      uuid NOT NULL,
  "OrganizacaoConfiguracao_OrganizacaoId" uuid NOT NULL,
  "OrganizacaoConfiguracao_Chave"         text NOT NULL CHECK (char_length("OrganizacaoConfiguracao_Chave") BETWEEN 1 AND 100),
  "OrganizacaoConfiguracao_Valor"         jsonb NOT NULL,
  "OrganizacaoConfiguracao_AtualizadaEm"  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("OrganizacaoConfiguracao_TenantId", "OrganizacaoConfiguracao_OrganizacaoId", "OrganizacaoConfiguracao_Chave"),
  FOREIGN KEY ("OrganizacaoConfiguracao_TenantId", "OrganizacaoConfiguracao_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId", "Organizacao_Id") ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION "ContextoTenant_Id"() RETURNS uuid
LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
DECLARE valor text;
BEGIN
  valor := current_setting('app.tenant_id', true);
  IF valor IS NULL OR valor = '' THEN RETURN NULL; END IF;
  BEGIN RETURN valor::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END;
END $$;

CREATE OR REPLACE FUNCTION "ContextoOrganizacao_Id"() RETURNS uuid
LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
DECLARE valor text;
BEGIN
  valor := current_setting('app.organization_id', true);
  IF valor IS NULL OR valor = '' THEN RETURN NULL; END IF;
  BEGIN RETURN valor::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END;
END $$;

REVOKE ALL ON FUNCTION "ContextoTenant_Id"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "ContextoOrganizacao_Id"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "ContextoTenant_Id"(), "ContextoOrganizacao_Id"() TO itmt_app;

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_contexto ON "Tenant"
  USING ("Tenant_Id" = "ContextoTenant_Id"())
  WITH CHECK ("Tenant_Id" = "ContextoTenant_Id"());

ALTER TABLE "Organizacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organizacao" FORCE ROW LEVEL SECURITY;
CREATE POLICY organizacao_contexto ON "Organizacao"
  USING ("Organizacao_TenantId" = "ContextoTenant_Id"() AND "Organizacao_Id" = "ContextoOrganizacao_Id"())
  WITH CHECK ("Organizacao_TenantId" = "ContextoTenant_Id"() AND "Organizacao_Id" = "ContextoOrganizacao_Id"());

ALTER TABLE "OrganizacaoMembro" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizacaoMembro" FORCE ROW LEVEL SECURITY;
CREATE POLICY organizacao_membro_contexto ON "OrganizacaoMembro"
  USING ("OrganizacaoMembro_TenantId" = "ContextoTenant_Id"() AND "OrganizacaoMembro_OrganizacaoId" = "ContextoOrganizacao_Id"())
  WITH CHECK ("OrganizacaoMembro_TenantId" = "ContextoTenant_Id"() AND "OrganizacaoMembro_OrganizacaoId" = "ContextoOrganizacao_Id"());

ALTER TABLE "Assinatura" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assinatura" FORCE ROW LEVEL SECURITY;
CREATE POLICY assinatura_contexto ON "Assinatura"
  USING ("Assinatura_TenantId" = "ContextoTenant_Id"() AND "Assinatura_OrganizacaoId" = "ContextoOrganizacao_Id"())
  WITH CHECK ("Assinatura_TenantId" = "ContextoTenant_Id"() AND "Assinatura_OrganizacaoId" = "ContextoOrganizacao_Id"());

ALTER TABLE "OrganizacaoConfiguracao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizacaoConfiguracao" FORCE ROW LEVEL SECURITY;
CREATE POLICY organizacao_configuracao_contexto ON "OrganizacaoConfiguracao"
  USING ("OrganizacaoConfiguracao_TenantId" = "ContextoTenant_Id"() AND "OrganizacaoConfiguracao_OrganizacaoId" = "ContextoOrganizacao_Id"())
  WITH CHECK ("OrganizacaoConfiguracao_TenantId" = "ContextoTenant_Id"() AND "OrganizacaoConfiguracao_OrganizacaoId" = "ContextoOrganizacao_Id"());

-- db/08 concede defaults amplos. A migração do domínio revoga e reabre somente
-- o necessário; o owner de migração continua separado do runtime.
REVOKE ALL PRIVILEGES ON TABLE "Tenant", "Organizacao", "OrganizacaoMembro",
  "PlanoComercial", "Assinatura", "OrganizacaoConfiguracao" FROM itmt_app;
REVOKE ALL PRIVILEGES ON SEQUENCE "PlanoComercial_PlanoComercial_Id_seq" FROM itmt_app;
GRANT SELECT ON "Tenant", "Organizacao", "OrganizacaoMembro", "PlanoComercial", "Assinatura" TO itmt_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "OrganizacaoConfiguracao" TO itmt_app;

COMMENT ON TABLE "OrganizacaoConfiguracao" IS
  'TENANT_OWNED: acesso somente em transação com app.tenant_id e app.organization_id; RLS FORCE.';
