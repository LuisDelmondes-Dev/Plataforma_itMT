CREATE TABLE IF NOT EXISTS "ParticipacaoCidada" (
  "ParticipacaoCidada_Id" bigserial PRIMARY KEY,
  "ParticipacaoCidada_TenantId" uuid NOT NULL,
  "ParticipacaoCidada_OrganizacaoId" uuid NOT NULL,
  "ParticipacaoCidada_Protocolo" uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  "ParticipacaoCidada_TokenHash" char(64) NOT NULL,
  "ParticipacaoCidada_Categoria" text NOT NULL CHECK ("ParticipacaoCidada_Categoria" IN ('DADO','SERVICO','SUGESTAO','CORRECAO','OUTRO')),
  "ParticipacaoCidada_CodigoIbge" char(7) REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "ParticipacaoCidada_Mensagem" text NOT NULL CHECK (char_length("ParticipacaoCidada_Mensagem") BETWEEN 20 AND 5000),
  "ParticipacaoCidada_ConsentimentoEm" timestamptz NOT NULL,
  "ParticipacaoCidada_Status" text NOT NULL DEFAULT 'RECEBIDA' CHECK ("ParticipacaoCidada_Status" IN ('RECEBIDA','EM_ANALISE','RESPONDIDA','ARQUIVADA')),
  "ParticipacaoCidada_Resposta" text,
  "ParticipacaoCidada_RespondidaPor" text,
  "ParticipacaoCidada_CriadaEm" timestamptz NOT NULL DEFAULT now(),
  "ParticipacaoCidada_AtualizadaEm" timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY ("ParticipacaoCidada_TenantId","ParticipacaoCidada_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_participacao_fila ON "ParticipacaoCidada"
  ("ParticipacaoCidada_TenantId","ParticipacaoCidada_OrganizacaoId","ParticipacaoCidada_Status","ParticipacaoCidada_CriadaEm");
ALTER TABLE "ParticipacaoCidada" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParticipacaoCidada" FORCE ROW LEVEL SECURITY;
CREATE POLICY participacao_contexto ON "ParticipacaoCidada" USING (
  "ParticipacaoCidada_TenantId"="ContextoTenant_Id"() AND "ParticipacaoCidada_OrganizacaoId"="ContextoOrganizacao_Id"())
WITH CHECK ("ParticipacaoCidada_TenantId"="ContextoTenant_Id"() AND "ParticipacaoCidada_OrganizacaoId"="ContextoOrganizacao_Id"());
REVOKE ALL ON "ParticipacaoCidada" FROM PUBLIC,itmt_app;
GRANT SELECT,INSERT,UPDATE ON "ParticipacaoCidada" TO itmt_app;
GRANT USAGE,SELECT ON SEQUENCE "ParticipacaoCidada_ParticipacaoCidada_Id_seq" TO itmt_app;
COMMENT ON TABLE "ParticipacaoCidada" IS 'F6: participação sem PII; token de acompanhamento armazenado somente como SHA-256.';
