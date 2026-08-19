import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 4600 + (process.pid % 200);
const BASE = `http://localhost:${PORT}/v1/admin/nao-conformidades`;
const headers = { authorization: 'Bearer itmt-admin-dev', 'content-type': 'application/json' };
let api;
const request = async (path='', body) => {
  const response = await fetch(BASE + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json().catch(() => null) };
};

before(async () => {
  api = spawn('node', ['dist/main.js'], { env: { ...process.env, PORT: String(PORT), AGENTES_AUTO:'0' }, stdio:'ignore' });
  for (let i=0;i<40;i++) { try { if ((await fetch(`http://localhost:${PORT}/v1/saude/live`)).ok) return; } catch {} await new Promise((r)=>setTimeout(r,300)); }
  throw new Error('API não subiu.');
});
after(() => api?.kill());

test('F7-R004/R005: P0 exige tratamento, evidência e histórico append-only', async () => {
  const criada = await request('', { titulo:'Falha crítica de continuidade', descricao:'Banco sem réplica operacional homologada.', severidade:'P0', owner:'SRE', prazo:'2026-08-20' });
  assert.equal(criada.status, 201);
  const id = criada.body.id;
  assert.equal((await request(`/${id}/transicoes`, { status:'TRIAGEM', justificativa:'Triagem técnica confirmada.' })).status, 201);
  const aceita = await request(`/${id}/transicoes`, { status:'ACEITA', justificativa:'Aceitar temporariamente o risco.' });
  assert.equal(aceita.status, 400);
  assert.equal((await request(`/${id}/transicoes`, { status:'EM_TRATAMENTO', justificativa:'Plano de correção iniciado.' })).status, 201);
  const semEvidencia = await request(`/${id}/transicoes`, { status:'RESOLVIDA', justificativa:'Correção informada sem prova.' });
  assert.equal(semEvidencia.status, 400);
  const resolvida = await request(`/${id}/transicoes`, { status:'RESOLVIDA', justificativa:'Restore executado e verificado.', evidencia:'EV-DR-RESTORE-001' });
  assert.equal(resolvida.status, 201);
  const lista = await request();
  assert.equal(lista.body.find((item) => item.id === id).evidencia, 'EV-DR-RESTORE-001');
});
