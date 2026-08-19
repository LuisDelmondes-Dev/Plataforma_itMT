INSERT INTO "PlanoComercial" ("PlanoComercial_Codigo","PlanoComercial_Nome","PlanoComercial_Limites","PlanoComercial_PrecoCentavo") VALUES
  ('ESSENCIAL','Plano Essencial','{"usuarios":10,"jobs_pendentes":100,"armazenamento_gb":25,"api_requisicoes_mes":10000}'::jsonb,19900),
  ('PROFISSIONAL','Plano Profissional','{"usuarios":50,"jobs_pendentes":500,"armazenamento_gb":250,"api_requisicoes_mes":100000}'::jsonb,79900)
ON CONFLICT ("PlanoComercial_Codigo") DO UPDATE SET
  "PlanoComercial_Nome"=EXCLUDED."PlanoComercial_Nome",
  "PlanoComercial_Limites"=EXCLUDED."PlanoComercial_Limites",
  "PlanoComercial_PrecoCentavo"=EXCLUDED."PlanoComercial_PrecoCentavo";

ALTER TABLE "Assinatura"
  ADD COLUMN IF NOT EXISTS "Assinatura_TrialFimEm" timestamptz,
  ADD COLUMN IF NOT EXISTS "Assinatura_ReferenciaExterna" text,
  ADD COLUMN IF NOT EXISTS "Assinatura_AtualizadaEm" timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS "UsoPlano" (
  "UsoPlano_TenantId" uuid NOT NULL,
  "UsoPlano_OrganizacaoId" uuid NOT NULL,
  "UsoPlano_Metrica" text NOT NULL CHECK ("UsoPlano_Metrica" ~ '^[a-z][a-z0-9_]{1,63}$'),
  "UsoPlano_Periodo" date NOT NULL,
  "UsoPlano_Quantidade" bigint NOT NULL DEFAULT 0 CHECK ("UsoPlano_Quantidade">=0),
  "UsoPlano_AtualizadoEm" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("UsoPlano_TenantId","UsoPlano_OrganizacaoId","UsoPlano_Metrica","UsoPlano_Periodo"),
  FOREIGN KEY ("UsoPlano_TenantId","UsoPlano_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE CASCADE
);
ALTER TABLE "UsoPlano" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsoPlano" FORCE ROW LEVEL SECURITY;
CREATE POLICY uso_plano_contexto ON "UsoPlano" USING (
  "UsoPlano_TenantId"="ContextoTenant_Id"() AND "UsoPlano_OrganizacaoId"="ContextoOrganizacao_Id"())
WITH CHECK ("UsoPlano_TenantId"="ContextoTenant_Id"() AND "UsoPlano_OrganizacaoId"="ContextoOrganizacao_Id"());

REVOKE ALL ON "UsoPlano" FROM PUBLIC, itmt_app;
GRANT SELECT,INSERT,UPDATE ON "UsoPlano" TO itmt_app;
GRANT SELECT,INSERT,UPDATE ON "Assinatura" TO itmt_app;
COMMENT ON TABLE "UsoPlano" IS 'TENANT_OWNED: medição por organização/período para enforcement dos limites do plano.';
