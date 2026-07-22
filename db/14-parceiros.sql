-- ============================================================
-- 14-parceiros.sql — Onda 6: co-produção multi-ator.
--
-- (a) Papéis PARCEIRO (empresa/sociedade civil) e UNIVERSIDADE no RBAC:
--     produzem contribuições, mas NUNCA publicam — o parecer segue com
--     CURADOR/ADMIN (RG-09 estendido à co-produção).
-- (b) ContribuicaoDado: submissão curada de dados/estudos/fontes por
--     parceiros. Nasce EM_ANALISE; parecer humano decide. Cada passo
--     emite EventoAuditoria imutável (RG-10) — a tabela guarda o estado,
--     a cadeia guarda a história.
-- ============================================================

-- Amplia o CHECK de papel (o nome do constraint é o gerado pelo Postgres).
DO $$
DECLARE nome_constraint text;
BEGIN
  SELECT conname INTO nome_constraint
    FROM pg_constraint
   WHERE conrelid = '"Usuario"'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%Usuario_Papel%';
  IF nome_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "Usuario" DROP CONSTRAINT %I', nome_constraint);
  END IF;
  ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_Papel_check"
    CHECK ("Usuario_Papel" IN ('ADMIN','CURADOR','PUBLICO','PARCEIRO','UNIVERSIDADE'));
END $$;

CREATE TABLE IF NOT EXISTS "ContribuicaoDado" (
  "ContribuicaoDado_Id"            bigserial PRIMARY KEY,
  "ContribuicaoDado_Quando"        timestamptz NOT NULL DEFAULT now(),
  "ContribuicaoDado_AutorEmail"    text NOT NULL,
  "ContribuicaoDado_AutorPapel"    text NOT NULL,
  "ContribuicaoDado_Tipo"          text NOT NULL DEFAULT 'OBSERVACAO'
    CHECK ("ContribuicaoDado_Tipo" IN ('OBSERVACAO','ESTUDO','FONTE')),
  "ContribuicaoDado_Titulo"        text NOT NULL,
  "ContribuicaoDado_Descricao"     text,
  "ContribuicaoDado_Payload"       jsonb,
  "ContribuicaoDado_Status"        text NOT NULL DEFAULT 'EM_ANALISE'
    CHECK ("ContribuicaoDado_Status" IN ('EM_ANALISE','APROVADA','REJEITADA')),
  "ContribuicaoDado_Parecerista"   text,
  "ContribuicaoDado_Justificativa" text,
  "ContribuicaoDado_DecididaEm"    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_contrib_status ON "ContribuicaoDado" ("ContribuicaoDado_Status");

GRANT SELECT, INSERT, UPDATE ON "ContribuicaoDado" TO itmt_app;
GRANT USAGE, SELECT ON SEQUENCE "ContribuicaoDado_ContribuicaoDado_Id_seq" TO itmt_app;
