import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

test('itmt_app não recebe DML amplo nem default privileges perigosos', async () => {
  const owner = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const amplos = await owner.query(
      `SELECT table_name,privilege_type FROM information_schema.role_table_grants
        WHERE grantee='itmt_app' AND privilege_type IN ('INSERT','UPDATE','DELETE')
          AND table_schema='public' ORDER BY 1,2`,
    );
    const permitidos = new Set([
      'Usuario:INSERT','Usuario:UPDATE','EventoAuditoria:INSERT','Indicador:INSERT','Indicador:UPDATE',
      'ParecerValidacao:INSERT','Autorizacao:INSERT','Direito:INSERT','Direito:UPDATE',
      'OrganizacaoConfiguracao:INSERT','OrganizacaoConfiguracao:UPDATE','TenantJob:INSERT','TenantJob:UPDATE',
      'Documento:INSERT','Documento:UPDATE','DocumentoVersao:INSERT','DocumentoVersao:UPDATE',
      'DocumentoTarefa:INSERT','DocumentoTarefa:UPDATE','DocumentoEmbedding:INSERT','DocumentoEmbedding:UPDATE',
      'DocumentoTrecho:INSERT','DocumentoTrecho:DELETE','DocumentoRevisao:INSERT',
      'ApiCliente:INSERT','ApiCliente:UPDATE','ApiConsumoJanela:INSERT','ApiConsumoJanela:UPDATE',
      'ContribuicaoDado:INSERT','ContribuicaoDado:UPDATE','AgentExecution:INSERT','ConsumoLlm:INSERT',
      'ProjetoLevantamento:INSERT','ProjetoLevantamento:UPDATE','ProdutoGeografico:INSERT','ProdutoGeografico:UPDATE',
      'CapturaImagemRua:INSERT','CapturaImagemRua:UPDATE','ProjetoEstruturante:INSERT','ProjetoEstruturante:UPDATE',
      'TermoConsentimento:INSERT','TermoConsentimento:UPDATE','AtivoMidia:INSERT','AtivoMidia:UPDATE',
      'MissaoCampo:INSERT','MissaoCampo:UPDATE','MissaoAutorizacao:INSERT','MissaoAutorizacao:UPDATE',
      'CapturaCampo:INSERT','CapturaCampo:UPDATE',
    ]);
    for (const row of amplos.rows) assert.ok(permitidos.has(`${row.table_name}:${row.privilege_type}`), `grant excedente: ${row.table_name}:${row.privilege_type}`);
    const defaults = await owner.query(
      `SELECT defaclacl::text AS acl FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
        WHERE n.nspname='public' AND defaclacl::text LIKE '%itmt_app%'`,
    );
    assert.ok(defaults.rows.every((x) => !/[awd]/.test(x.acl.match(/itmt_app=([^/]*)/)?.[1] ?? '')), 'default privilege ainda concede DML');
    assert.equal(await owner.query(`SELECT has_table_privilege('itmt_app','"EventoAuditoria"','UPDATE') AS p`).then((r) => r.rows[0].p), false);
    assert.equal(await owner.query(`SELECT has_table_privilege('itmt_app','"Fonte"','DELETE') AS p`).then((r) => r.rows[0].p), false);
  } finally { await owner.end(); }
});
