// ============================================================
// parceiros.e2e.mjs — Onda 6: co-produção multi-ator (RBAC).
// Invariantes:
//   - ADMIN cria conta PARCEIRO; parceiro loga e recebe token com papel;
//   - PARCEIRO submete contribuição → nasce EM_ANALISE (nunca publica);
//   - PARCEIRO NÃO decide (403); CURADOR/ADMIN decide com justificativa;
//   - cada passo entra na cadeia de auditoria imutável (RG-10);
//   - anônimo não entra (403).
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 3906;
const BASE = `http://localhost:${PORT}/v1`;
const ADMIN = { Authorization: 'Bearer itmt-admin-dev', 'Content-Type': 'application/json' };
let api;
let tokenParceiro;
let contribuicaoId;

before(async () => {
  api = spawn('node', ['dist/main.js'], {
    env: { ...process.env, PORT: String(PORT), AGENTES_AUTO: '0' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/temas`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API não subiu para os testes.');
});

after(() => api?.kill());

test('ADMIN cria conta PARCEIRO e o parceiro loga com papel no token', async () => {
  const cria = await fetch(`${BASE}/auth/usuarios`, {
    method: 'POST', headers: ADMIN,
    body: JSON.stringify({ email: 'parceiro@teste.local', senha: 'senha-forte-8', papel: 'PARCEIRO' }),
  });
  assert.equal(cria.status, 201);
  const login = await (
    await fetch(`${BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'parceiro@teste.local', senha: 'senha-forte-8' }),
    })
  ).json();
  assert.equal(login.papel, 'PARCEIRO');
  assert.ok(login.token);
  tokenParceiro = login.token;
});

test('anônimo não submete contribuição (403)', async () => {
  const r = await fetch(`${BASE}/parceiros/contribuicoes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: 'x' }),
  });
  assert.equal(r.status, 403);
});

test('PARCEIRO submete e a contribuição nasce EM_ANALISE', async () => {
  const r = await fetch(`${BASE}/parceiros/contribuicoes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenParceiro}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'ESTUDO',
      titulo: 'Estudo de uso do solo — campus MT',
      descricao: 'Levantamento municipal (teste e2e).',
      payload: { municipios: ['5103403'], ano: 2025 },
    }),
  });
  assert.equal(r.status, 201);
  const d = await r.json();
  assert.equal(d.status, 'EM_ANALISE');
  contribuicaoId = d.id;
  // aparece na fila de curadoria
  const fila = await (await fetch(`${BASE}/parceiros/contribuicoes/pendentes`, { headers: ADMIN })).json();
  assert.ok(fila.some((c) => c.id === contribuicaoId), 'não entrou na fila de curadoria');
});

test('PARCEIRO não decide o próprio parecer (403) — RG-09 multi-ator', async () => {
  const r = await fetch(`${BASE}/parceiros/contribuicoes/${contribuicaoId}/parecer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenParceiro}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisao: 'APROVADA', justificativa: 'auto-aprovação' }),
  });
  assert.equal(r.status, 403);
});

test('CURADOR/ADMIN decide com justificativa e a decisão é final', async () => {
  const r = await fetch(`${BASE}/parceiros/contribuicoes/${contribuicaoId}/parecer`, {
    method: 'POST', headers: ADMIN,
    body: JSON.stringify({ decisao: 'APROVADA', justificativa: 'Metodologia adequada (teste e2e).' }),
  });
  assert.equal(r.status, 201);
  const d = await r.json();
  assert.equal(d.status, 'APROVADA');
  // segunda decisão sobre a mesma contribuição não existe
  const de_novo = await fetch(`${BASE}/parceiros/contribuicoes/${contribuicaoId}/parecer`, {
    method: 'POST', headers: ADMIN,
    body: JSON.stringify({ decisao: 'REJEITADA', justificativa: 'tentativa de reescrita' }),
  });
  assert.equal(de_novo.status, 404);
  // e o autor vê o desfecho
  const minhas = await (
    await fetch(`${BASE}/parceiros/contribuicoes/minhas`, {
      headers: { Authorization: `Bearer ${tokenParceiro}` },
    })
  ).json();
  const minha = minhas.find((c) => c.id === contribuicaoId);
  assert.equal(minha?.status, 'APROVADA');
});
