// F2 — credenciais de integração, escopos, quotas e revogação.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 3909;
const BASE = `http://127.0.0.1:${PORT}/v1`;
const ADMIN = { Authorization: 'Bearer itmt-admin-dev', 'Content-Type': 'application/json' };
let api;
let tokenParceiro;
let chaveQuota;
let chaveRestrita;
let chaveRestritaId;

before(async () => {
  api = spawn('node', ['dist/main.js'], {
    env: { ...process.env, PORT: String(PORT), AGENTES_AUTO: '0', DOCUMENTOS_WORKER: '0' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/temas`);
      await r.arrayBuffer();
      if (r.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('API não subiu para os testes de integração.');
});

after(() => api?.kill());

test('parceiro autenticado é preparado para gerir credenciais', async () => {
  const cria = await fetch(`${BASE}/auth/usuarios`, {
    method: 'POST', headers: ADMIN,
    body: JSON.stringify({ email: 'integracao@teste.local', senha: 'senha-forte-8', papel: 'UNIVERSIDADE' }),
  });
  assert.equal(cria.status, 201);
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'integracao@teste.local', senha: 'senha-forte-8' }),
  });
  assert.equal(login.status, 201);
  const sessao = await login.json();
  assert.equal(sessao.papel, 'UNIVERSIDADE');
  const organizacoes = await (await fetch(`${BASE}/auth/organizacoes`, {
    headers: { Authorization: `Bearer ${sessao.token}` },
  })).json();
  const contexto = await fetch(`${BASE}/auth/contexto`, {
    method: 'POST', headers: { Authorization: `Bearer ${sessao.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ organization_id: organizacoes[0].organization_id }),
  });
  assert.equal(contexto.status, 201);
  tokenParceiro = (await contexto.json()).token;
});

test('anônimo não cria chave de API', async () => {
  const r = await fetch(`${BASE}/parceiros/chaves`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'sem acesso' }),
  });
  assert.equal(r.status, 403);
});

test('segredo é entregue uma única vez e nunca aparece na listagem', async () => {
  const r = await fetch(`${BASE}/parceiros/chaves`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenParceiro}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Catálogo com quota mínima', escopos: ['catalogo:ler'], quota_minuto: 2, quota_dia: 10 }),
  });
  assert.equal(r.status, 201);
  const criada = await r.json();
  assert.match(criada.chave, /^itmt_live_[0-9a-f]{12}_[A-Za-z0-9_-]{40,}$/);
  chaveQuota = criada.chave;

  const lista = await fetch(`${BASE}/parceiros/chaves`, {
    headers: { Authorization: `Bearer ${tokenParceiro}` },
  });
  assert.equal(lista.status, 200);
  const corpo = await lista.text();
  assert.ok(!corpo.includes(chaveQuota));
  assert.ok(!corpo.toLowerCase().includes('hashchave'));
  assert.equal(JSON.parse(corpo)[0].prefixo, criada.prefixo);
});

test('quota é consumida atomicamente e devolvida nos cabeçalhos', async () => {
  const [primeira, segunda] = await Promise.all([
    fetch(`${BASE}/integracoes/temas`, { headers: { 'X-API-Key': chaveQuota } }),
    fetch(`${BASE}/integracoes/temas`, { headers: { Authorization: `ApiKey ${chaveQuota}` } }),
  ]);
  assert.equal(primeira.status, 200);
  assert.equal(segunda.status, 200);
  assert.deepEqual(
    [primeira, segunda].map((r) => r.headers.get('x-ratelimit-remaining-minute')).sort(),
    ['0', '1'],
  );
  assert.ok(Array.isArray(await primeira.json()));
  await segunda.arrayBuffer();

  const excedida = await fetch(`${BASE}/integracoes/temas`, { headers: { 'X-API-Key': chaveQuota } });
  assert.equal(excedida.status, 429);
});

test('escopo insuficiente é bloqueado antes da consulta de dados', async () => {
  const r = await fetch(`${BASE}/parceiros/chaves`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenParceiro}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Somente catálogo', escopos: ['catalogo:ler'] }),
  });
  const criada = await r.json();
  assert.equal(r.status, 201);
  chaveRestrita = criada.chave;
  chaveRestritaId = criada.id;

  const negada = await fetch(
    `${BASE}/integracoes/indicadores/1/consulta?recorte=MUNICIPIO&codigo=5103403`,
    { headers: { 'X-API-Key': chaveRestrita } },
  );
  assert.equal(negada.status, 403);
});

test('revogação é imediata e vinculada ao proprietário', async () => {
  const revoga = await fetch(`${BASE}/parceiros/chaves/${chaveRestritaId}/revogar`, {
    method: 'POST', headers: { Authorization: `Bearer ${tokenParceiro}` },
  });
  assert.equal(revoga.status, 201);
  assert.equal((await revoga.json()).status, 'REVOGADA');

  const uso = await fetch(`${BASE}/integracoes/temas`, { headers: { 'X-API-Key': chaveRestrita } });
  assert.equal(uso.status, 401);
});
