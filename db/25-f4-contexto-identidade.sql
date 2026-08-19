-- Contexto de identidade para selecionar memberships sem confiar em tenant/org
-- enviados livremente pelo cliente. O papel itmt_app continua sem bypass RLS.

CREATE OR REPLACE FUNCTION "ContextoUsuario_Id"() RETURNS bigint
LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
DECLARE valor text;
BEGIN
  valor := current_setting('app.user_id', true);
  IF valor IS NULL OR valor = '' THEN RETURN NULL; END IF;
  BEGIN RETURN valor::bigint; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END;
END $$;

REVOKE ALL ON FUNCTION "ContextoUsuario_Id"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "ContextoUsuario_Id"() TO itmt_app;

DROP POLICY IF EXISTS organizacao_membro_contexto ON "OrganizacaoMembro";
CREATE POLICY organizacao_membro_contexto ON "OrganizacaoMembro"
  USING (
    "OrganizacaoMembro_UsuarioId" = "ContextoUsuario_Id"()
    OR (
      "OrganizacaoMembro_TenantId" = "ContextoTenant_Id"()
      AND "OrganizacaoMembro_OrganizacaoId" = "ContextoOrganizacao_Id"()
    )
  )
  WITH CHECK (
    "OrganizacaoMembro_TenantId" = "ContextoTenant_Id"()
    AND "OrganizacaoMembro_OrganizacaoId" = "ContextoOrganizacao_Id"()
  );

DROP POLICY IF EXISTS organizacao_contexto ON "Organizacao";
CREATE POLICY organizacao_contexto ON "Organizacao"
  USING (
    (
      "Organizacao_TenantId" = "ContextoTenant_Id"()
      AND "Organizacao_Id" = "ContextoOrganizacao_Id"()
    )
    OR EXISTS (
      SELECT 1 FROM "OrganizacaoMembro" m
       WHERE m."OrganizacaoMembro_TenantId" = "Organizacao"."Organizacao_TenantId"
         AND m."OrganizacaoMembro_OrganizacaoId" = "Organizacao"."Organizacao_Id"
         AND m."OrganizacaoMembro_UsuarioId" = "ContextoUsuario_Id"()
         AND m."OrganizacaoMembro_Status" = 'ATIVO'
    )
  )
  WITH CHECK (
    "Organizacao_TenantId" = "ContextoTenant_Id"()
    AND "Organizacao_Id" = "ContextoOrganizacao_Id"()
  );

-- Organização institucional inicial. É bootstrap de control plane, não fixture
-- operacional e não cria indicadores/documentos/missões publicados.
INSERT INTO "Tenant" ("Tenant_Id","Tenant_Slug","Tenant_Nome")
VALUES ('00000000-0000-4000-8000-000000000001','itmt','Plataforma itMT')
ON CONFLICT ("Tenant_Id") DO NOTHING;

INSERT INTO "Organizacao" ("Organizacao_Id","Organizacao_TenantId","Organizacao_Slug","Organizacao_Nome")
VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','plataforma','Plataforma itMT')
ON CONFLICT ("Organizacao_Id") DO NOTHING;

INSERT INTO "OrganizacaoMembro"
  ("OrganizacaoMembro_TenantId","OrganizacaoMembro_OrganizacaoId","OrganizacaoMembro_UsuarioId","OrganizacaoMembro_Papel")
SELECT '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
       u."Usuario_Id", CASE WHEN u."Usuario_Papel"='ADMIN' THEN 'OWNER' ELSE 'MEMBRO' END
  FROM "Usuario" u
ON CONFLICT ("OrganizacaoMembro_OrganizacaoId","OrganizacaoMembro_UsuarioId") DO NOTHING;

INSERT INTO "PlanoComercial" ("PlanoComercial_Codigo","PlanoComercial_Nome","PlanoComercial_Limites","PlanoComercial_PrecoCentavo")
VALUES ('INSTITUCIONAL','Plano institucional','{"indicadores":300,"usuarios":1000,"armazenamento_gb":1000}'::jsonb,0)
ON CONFLICT ("PlanoComercial_Codigo") DO NOTHING;

INSERT INTO "Assinatura" ("Assinatura_TenantId","Assinatura_OrganizacaoId","Assinatura_PlanoId","Assinatura_Status")
SELECT '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',
       "PlanoComercial_Id",'ATIVA'
  FROM "PlanoComercial" WHERE "PlanoComercial_Codigo"='INSTITUCIONAL'
ON CONFLICT ("Assinatura_TenantId","Assinatura_OrganizacaoId") DO NOTHING;

CREATE OR REPLACE FUNCTION "GarantirMembroPlataforma"(p_usuario_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public."OrganizacaoMembro"
    ("OrganizacaoMembro_TenantId","OrganizacaoMembro_OrganizacaoId","OrganizacaoMembro_UsuarioId","OrganizacaoMembro_Papel")
  SELECT '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
         u."Usuario_Id", CASE WHEN u."Usuario_Papel"='ADMIN' THEN 'OWNER' ELSE 'MEMBRO' END
    FROM public."Usuario" u WHERE u."Usuario_Id"=p_usuario_id AND u."Usuario_Ativo"
  ON CONFLICT ("OrganizacaoMembro_OrganizacaoId","OrganizacaoMembro_UsuarioId") DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION "GarantirMembroPlataforma"(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "GarantirMembroPlataforma"(bigint) TO itmt_app;
