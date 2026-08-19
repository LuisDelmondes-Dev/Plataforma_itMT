import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const TABELAS = [
  'Documento','DocumentoVersao','DocumentoTrecho','DocumentoRevisao','DocumentoTarefa','DocumentoEmbedding',
  'ApiCliente','ApiConsumoJanela','ContribuicaoDado','AgentExecution','ConsumoLlm',
  'ProjetoLevantamento','ProdutoGeografico','CapturaImagemRua','ProjetoEstruturante','TermoConsentimento',
  'AtivoMidia','MissaoCampo','MissaoAutorizacao','CapturaCampo',
];

test('expand tenant cobre todos os domínios privados, com FK validada e backfill completo', async () => {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const tabela of TABELAS) {
      const prefixo = tabela;
      const colunas = await db.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1
            AND column_name = ANY($2::text[])`,
        [tabela, [`${prefixo}_TenantId`, `${prefixo}_OrganizacaoId`]],
      );
      assert.equal(colunas.rowCount, 2, `${tabela} sem as duas colunas de escopo`);
      const fk = await db.query(
        `SELECT convalidated FROM pg_constraint
          WHERE conrelid=$1::regclass AND conname=$2`,
        [`"${tabela}"`, `${tabela}_Organizacao_fk`],
      );
      assert.equal(fk.rows[0]?.convalidated, true, `${tabela} sem FK tenant/org validada`);
      const nulos = await db.query(
        `SELECT count(*)::int AS total FROM "${tabela}"
          WHERE "${prefixo}_TenantId" IS NULL OR "${prefixo}_OrganizacaoId" IS NULL`,
      );
      assert.equal(nulos.rows[0].total, 0, `${tabela} contém linha legada sem escopo`);
    }
  } finally {
    await db.end();
  }
});
