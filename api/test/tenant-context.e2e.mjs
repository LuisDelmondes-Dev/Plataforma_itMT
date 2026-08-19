import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { gerarHashSenha } from '../dist/auth/senha.js';

const PORT = 4200 + (process.pid % 300);
const BASE = `http://localhost:${PORT}/v1`;
const TENANT_A = '30000000-0000-4000-8000-000000000001';
const TENANT_B = '30000000-0000-4000-8000-000000000002';
const ORG_A = '40000000-0000-4000-8000-000000000001';
const ORG_B = '40000000-0000-4000-8000-000000000002';
const EMAIL = 'tenant-e2e@itmt.test';
const SENHA = 'Senha-F4-Segura-2026';
let owner;
let api;
let tokenIdentidade;
let tokenA;

async function http(path, { token, method = 'GET', body } = {}) {
  const resposta = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: resposta.status, body: await resposta.json().catch(() => null) };
}

before(async () => {
  owner = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await owner.connect();
  const usuario = await owner.query(
    `INSERT INTO "Usuario" ("Usuario_Email","Usuario_SenhaHash","Usuario_Papel")
     VALUES ($1,$2,'PARCEIRO') RETURNING "Usuario_Id" AS id`,
    [EMAIL, gerarHashSenha(SENHA)],
  );
  await owner.query(
    `INSERT INTO "Tenant" ("Tenant_Id","Tenant_Slug","Tenant_Nome") VALUES
       ($1,'api-tenant-a','API Tenant A'),($2,'api-tenant-b','API Tenant B')`,
    [TENANT_A, TENANT_B],
  );
  await owner.query(
    `INSERT INTO "Organizacao" ("Organizacao_Id","Organizacao_TenantId","Organizacao_Slug","Organizacao_Nome") VALUES
       ($1,$2,'api-org-a','API Organização A'),($3,$4,'api-org-b','API Organização B')`,
    [ORG_A, TENANT_A, ORG_B, TENANT_B],
  );
  await owner.query(
    `INSERT INTO "OrganizacaoMembro"
       ("OrganizacaoMembro_TenantId","OrganizacaoMembro_OrganizacaoId","OrganizacaoMembro_UsuarioId","OrganizacaoMembro_Papel")
     VALUES ($1,$2,$3,'OWNER')`,
    [TENANT_A, ORG_A, usuario.rows[0].id],
  );
  await owner.query(
    `INSERT INTO "OrganizacaoConfiguracao" VALUES
       ($1,$2,'visivel','{"tenant":"A"}'::jsonb,now()),
       ($3,$4,'secreto','{"tenant":"B"}'::jsonb,now())`,
    [TENANT_A, ORG_A, TENANT_B, ORG_B],
  );

  api = spawn('node', ['dist/main.js'], {
    env: { ...process.env, PORT: String(PORT), AGENTES_AUTO: '0', XINGU_PROVEDOR: 'lexico' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    if (api.exitCode !== null) throw new Error(`API encerrou durante bootstrap (${api.exitCode}).`);
    try { if ((await fetch(`${BASE}/saude/live`)).ok) break; } catch {}
    if (i === 49) throw new Error('API não subiu.');
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const login = await http('/auth/login', { method: 'POST', body: { email: EMAIL, senha: SENHA } });
  assert.equal(login.status, 201);
  tokenIdentidade = login.body.token;
});

after(async () => {
  api?.kill();
  await owner?.end();
});

test('identidade lista apenas memberships próprias e não seleciona organização B', async () => {
  const lista = await http('/auth/organizacoes', { token: tokenIdentidade });
  assert.equal(lista.status, 200);
  assert.deepEqual(lista.body.map((item) => item.organization_id), [ORG_A]);
  const cruzado = await http('/auth/contexto', {
    token: tokenIdentidade, method: 'POST', body: { organization_id: ORG_B },
  });
  assert.equal(cruzado.status, 401);
});

test('token sem contexto não acessa recurso tenant-owned e seleção A emite claims', async () => {
  assert.equal((await http(`/organizacoes/${ORG_A}/configuracoes`, { token: tokenIdentidade })).status, 401);
  const contexto = await http('/auth/contexto', {
    token: tokenIdentidade, method: 'POST', body: { organization_id: ORG_A },
  });
  assert.equal(contexto.status, 201);
  assert.equal(contexto.body.organization_id, ORG_A);
  assert.equal(contexto.body.tenant_id, TENANT_A);
  tokenA = contexto.body.token;
});

test('API nega Tenant A→B sem enumerar e não vaza configuração', async () => {
  const proprio = await http(`/organizacoes/${ORG_A}/configuracoes`, { token: tokenA });
  assert.equal(proprio.status, 200);
  assert.deepEqual(proprio.body.map((item) => item.chave), ['visivel']);
  const cruzado = await http(`/organizacoes/${ORG_B}/configuracoes`, { token: tokenA });
  assert.equal(cruzado.status, 404);
  assert.doesNotMatch(JSON.stringify(cruzado.body), /secreto|tenant.*B/i);
});

test('OWNER altera somente a própria configuração; banco B permanece intacto', async () => {
  const alterada = await http(`/organizacoes/${ORG_A}/configuracoes/tema`, {
    token: tokenA, method: 'PUT', body: { valor: { cor: 'azul' } },
  });
  assert.equal(alterada.status, 200);
  assert.deepEqual(alterada.body, { chave: 'tema', valor: { cor: 'azul' } });
  const b = await owner.query(
    `SELECT "OrganizacaoConfiguracao_Valor" AS valor FROM "OrganizacaoConfiguracao"
      WHERE "OrganizacaoConfiguracao_OrganizacaoId"=$1 AND "OrganizacaoConfiguracao_Chave"='secreto'`,
    [ORG_B],
  );
  assert.deepEqual(b.rows[0].valor, { tenant: 'B' });
});

test('F4-R003/R006: organização lista planos e inicia ciclo de assinatura isolado', async () => {
  const planos = await http(`/organizacoes/${ORG_A}/comercial/planos`, { token: tokenA });
  assert.equal(planos.status, 200);
  assert.ok(planos.body.some((plano) => plano.codigo === 'ESSENCIAL'));
  const alterada = await http(`/organizacoes/${ORG_A}/comercial/assinatura`, {
    token: tokenA, method: 'PUT', body: { plano_codigo: 'ESSENCIAL' },
  });
  assert.equal(alterada.status, 200);
  assert.equal(alterada.body.plano_codigo, 'ESSENCIAL');
  assert.equal(alterada.body.status, 'TRIAL');
  assert.ok(alterada.body.trial_fim_em);
  const propria = await http(`/organizacoes/${ORG_A}/comercial/assinatura`, { token: tokenA });
  assert.equal(propria.body.plano_codigo, 'ESSENCIAL');
  assert.equal((await http(`/organizacoes/${ORG_B}/comercial/assinatura`, { token: tokenA })).status, 404);
});

test('job preserva envelope tenant/org, é idempotente e não pode ser lido pelo path B', async () => {
  const dto = {
    tipo: 'EXPORTAR', recurso_id: 'relatorio-1', payload: { formato: 'csv' },
    idempotency_key: 'tenant-a-export-relatorio-1',
  };
  const primeiro = await http(`/organizacoes/${ORG_A}/jobs`, { token: tokenA, method: 'POST', body: dto });
  const repetido = await http(`/organizacoes/${ORG_A}/jobs`, { token: tokenA, method: 'POST', body: dto });
  assert.equal(primeiro.status, 201);
  assert.equal(repetido.status, 201);
  assert.equal(repetido.body.id, primeiro.body.id);
  const proprio = await http(`/organizacoes/${ORG_A}/jobs/${primeiro.body.id}`, { token: tokenA });
  assert.equal(proprio.status, 200);
  assert.equal(proprio.body.recurso_id, 'relatorio-1');
  assert.equal((await http(`/organizacoes/${ORG_B}/jobs/${primeiro.body.id}`, { token: tokenA })).status, 404);
  const envelope = await owner.query(
    `SELECT "TenantJob_TenantId"::text AS tid,"TenantJob_OrganizacaoId"::text AS oid
       FROM "TenantJob" WHERE "TenantJob_Id"=$1`, [primeiro.body.id],
  );
  assert.deepEqual(envelope.rows[0], { tid: TENANT_A, oid: ORG_A });
});

test('membership alterada revoga imediatamente o token de contexto', async () => {
  await owner.query(
    `UPDATE "OrganizacaoMembro" SET "OrganizacaoMembro_Status"='SUSPENSO',
       "OrganizacaoMembro_Versao"="OrganizacaoMembro_Versao"+1
      WHERE "OrganizacaoMembro_OrganizacaoId"=$1 AND "OrganizacaoMembro_UsuarioId"=(SELECT "Usuario_Id" FROM "Usuario" WHERE "Usuario_Email"=$2)`,
    [ORG_A, EMAIL],
  );
  assert.equal((await http(`/organizacoes/${ORG_A}/configuracoes`, { token: tokenA })).status, 401);
});
