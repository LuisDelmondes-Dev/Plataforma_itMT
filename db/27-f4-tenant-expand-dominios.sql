-- ============================================================
-- 27-f4-tenant-expand-dominios.sql — expand seguro dos domínios privados.
--
-- Esta migração NÃO ativa RLS ainda. Primeiro materializa tenant/organização,
-- faz backfill e cria FKs. Os serviços serão convertidos para dual-write e
-- transações contextualizadas antes do contract (NOT NULL + FORCE RLS).
-- ============================================================

DO $$
DECLARE
  item record;
  tenant_col text;
  org_col text;
  constraint_name text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('Documento','Documento'),
      ('DocumentoVersao','DocumentoVersao'),
      ('DocumentoTrecho','DocumentoTrecho'),
      ('DocumentoRevisao','DocumentoRevisao'),
      ('DocumentoTarefa','DocumentoTarefa'),
      ('DocumentoEmbedding','DocumentoEmbedding'),
      ('ApiCliente','ApiCliente'),
      ('ApiConsumoJanela','ApiConsumoJanela'),
      ('ContribuicaoDado','ContribuicaoDado'),
      ('AgentExecution','AgentExecution'),
      ('ConsumoLlm','ConsumoLlm'),
      ('ProjetoLevantamento','ProjetoLevantamento'),
      ('ProdutoGeografico','ProdutoGeografico'),
      ('CapturaImagemRua','CapturaImagemRua'),
      ('ProjetoEstruturante','ProjetoEstruturante'),
      ('TermoConsentimento','TermoConsentimento'),
      ('AtivoMidia','AtivoMidia'),
      ('MissaoCampo','MissaoCampo'),
      ('MissaoAutorizacao','MissaoAutorizacao'),
      ('CapturaCampo','CapturaCampo')
    ) AS x(table_name, prefix)
  LOOP
    tenant_col := item.prefix || '_TenantId';
    org_col := item.prefix || '_OrganizacaoId';
    constraint_name := item.table_name || '_Organizacao_fk';

    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I uuid', item.table_name, tenant_col);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I uuid', item.table_name, org_col);
    EXECUTE format(
      'UPDATE %I SET %I=$1, %I=$2 WHERE %I IS NULL OR %I IS NULL',
      item.table_name, tenant_col, org_col, tenant_col, org_col
    ) USING '00000000-0000-4000-8000-000000000001'::uuid,
            '00000000-0000-4000-8000-000000000002'::uuid;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=constraint_name) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I,%I) REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT NOT VALID',
        item.table_name, constraint_name, tenant_col, org_col
      );
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', item.table_name, constraint_name);
    END IF;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (%I,%I)',
      'idx_' || lower(item.table_name) || '_tenant_org', item.table_name, tenant_col, org_col
    );
    EXECUTE format(
      'COMMENT ON COLUMN %I.%I IS %L', item.table_name, tenant_col,
      'EXPAND: fronteira tenant; torna-se NOT NULL no contract após dual-write.'
    );
  END LOOP;
END $$;

-- O runtime pode ler/escrever as colunas no período de compatibilidade, mas
-- nenhuma permissão nova é concedida: continuam valendo os grants da tabela.

