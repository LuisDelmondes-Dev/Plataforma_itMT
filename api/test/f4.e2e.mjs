// ============================================================
// f4.e2e.mjs — regressão do F4 (Mapa de Direitos).
// Prova que os vetos de publicação são DE BANCO (F4-RG-01..05)
// e que o motor "Descubra seus direitos" é determinístico e
// nunca decide renda/perícia (F4-RG-06).
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 3904;
const BASE = `http://localhost:${PORT}/v1`;
const ADMIN = { Authorization: 'Bearer itmt-admin-dev', 'content-type': 'application/json' };
let api;

const post = async (path, body, headers = ADMIN) => {
  const r = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const get = async (path) => {
  const r = await fetch(BASE + path);
  return { status: r.status, body: await r.json().catch(() => null) };
};

before(async () => {
  api = spawn('node', ['dist/main.js'], { env: { ...process.env, PORT: String(PORT), AGENTES_AUTO: '0' }, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${BASE}/temas`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API não subiu.');
});
after(() => api?.kill());

const fichaBase = {
  nome: 'Teste F4', area: 'SAUDE', resumo: 'Ficha de teste.', quem_pode_usar: 'Ninguém — é teste.',
  abrangencia: 'FEDERAL', orgao_gestor: 'Órgão Teste', natureza_norma: 'LEI',
  base_legal: 'Lei nº 0/0000', link_oficial: 'https://www.gov.br/teste',
  confianca: 'CONFIRMADA', data_verificacao: '2026-07-17',
};

test('F4-RG-01: projeto de lei jamais publica como direito vigente', async () => {
  const d = await post('/admin/direitos', { ...fichaBase, nome: 'PL teste', natureza_norma: 'PROJETO_DE_LEI' });
  assert.equal(d.status, 201);
  const pub = await post(`/admin/direitos/${d.body.id}/publicar`);
  assert.equal(pub.status, 422);
  assert.match(pub.body.message, /F4-RG-01/);
});

test('F4-RG-02: sem base legal não publica — veto de banco', async () => {
  const d = await post('/admin/direitos', { ...fichaBase, nome: 'Sem base', base_legal: undefined });
  const pub = await post(`/admin/direitos/${d.body.id}/publicar`);
  assert.equal(pub.status, 422);
  assert.match(pub.body.message, /F4-RG-02/);
});

test('F4-RG-03: informação REVOGADA não publica como direito atual', async () => {
  const d = await post('/admin/direitos', { ...fichaBase, nome: 'Revogado', confianca: 'REVOGADA' });
  const pub = await post(`/admin/direitos/${d.body.id}/publicar`);
  assert.equal(pub.status, 422);
  assert.match(pub.body.message, /F4-RG-03/);
});

test('F4-RG-04: link fora de domínio oficial não publica', async () => {
  const d = await post('/admin/direitos', { ...fichaBase, nome: 'Blog', link_oficial: 'https://meublog.example.com/direito' });
  const pub = await post(`/admin/direitos/${d.body.id}/publicar`);
  assert.equal(pub.status, 422);
  assert.match(pub.body.message, /F4-RG-04/);
});

test('F4-RG-05: sem data de verificação não publica', async () => {
  const d = await post('/admin/direitos', { ...fichaBase, nome: 'Sem data', data_verificacao: undefined });
  const pub = await post(`/admin/direitos/${d.body.id}/publicar`);
  assert.equal(pub.status, 422);
  assert.match(pub.body.message, /F4-RG-05/);
});

test('ficha íntegra publica e aparece no mapa com a régua completa', async () => {
  const d = await post('/admin/direitos', { ...fichaBase, nome: 'Direito íntegro F4' });
  const pub = await post(`/admin/direitos/${d.body.id}/publicar`);
  assert.equal(pub.status, 201);
  const ficha = await get(`/direitos/${d.body.id}`);
  assert.equal(ficha.status, 200);
  assert.equal(ficha.body.baselegal, 'Lei nº 0/0000');
  assert.equal(ficha.body.data_verificacao, '2026-07-17');
  assert.ok(ficha.body.aviso_legal.length > 0, 'aviso legal indissociável da ficha');
});

test('seed curado publicado: lista, áreas, públicos e condições respondem', async () => {
  const lista = await get('/direitos');
  assert.equal(lista.status, 200);
  assert.ok(lista.body.length >= 20, 'seed com as fichas curadas');
  assert.ok((await get('/direitos/areas')).body.length >= 8);
  assert.ok((await get('/direitos/publicos')).body.length >= 15);
  assert.ok((await get('/direitos/condicoes')).body.length >= 20);
  const bpc = lista.body.find((x) => /Prestação Continuada/.test(x.nome));
  assert.ok(bpc, 'BPC no seed');
  assert.equal(bpc.exige_inss, false, 'BPC não exige contribuição ao INSS');
});

test('§8 descubra: REQUISITO não atendido exclui com motivo; renda/perícia nunca decidem (F4-RG-06)', async () => {
  const r = await post('/direitos/descubra', { idade: 68, cadunico: true, deficiencia: false }, { 'content-type': 'application/json' });
  assert.equal(r.status, 201);
  const nomes = (l) => l.map((x) => x.nome).join(' | ');

  // Registro civil (sem regra alguma) é provável para qualquer perfil
  assert.match(nomes(r.body.provaveis), /Certidão de nascimento/);
  // BPC: cadunico ok, mas renda e perícia são SEMPRE avaliação
  const bpc = r.body.precisam_avaliacao.find((x) => /Prestação Continuada/.test(x.nome));
  assert.ok(bpc, 'BPC vai para avaliação, nunca para provável');
  assert.ok(bpc.criterios_a_verificar.some((c) => /renda/i.test(c)));
  // Pé-de-Meia: idade 68 > máximo 24 → excluído com o motivo da regra
  const pdm = r.body.nao_elegiveis.find((x) => /Pé-de-Meia/.test(x.nome));
  assert.ok(pdm && pdm.motivos.some((m) => /24 anos/.test(m)));
  // Passe Livre PcD: deficiencia=false → não elegível
  assert.match(nomes(r.body.nao_elegiveis), /Passe Livre/);
});

test('§8 descubra: determinístico — mesmo perfil, mesma resposta', async () => {
  const perfil = { idade: 30, cadunico: true, gestante: true, contribuinte_inss: true };
  const a = await post('/direitos/descubra', perfil, { 'content-type': 'application/json' });
  const b = await post('/direitos/descubra', perfil, { 'content-type': 'application/json' });
  assert.deepEqual(a.body, b.body);
  // Salário-maternidade: gestante + INSS atendidos, carência é avaliação
  const sm = a.body.precisam_avaliacao.find((x) => /maternidade/.test(x.nome));
  assert.ok(sm && sm.criterios_a_verificar.some((c) => /[Cc]arência/.test(c)));
});

test('incompatibilidades: quem recebe BPC é alertado sobre não acumulação', async () => {
  const lista = await get('/direitos');
  const bpc = lista.body.find((x) => /Prestação Continuada/.test(x.nome));
  const r = await post('/direitos/descubra', { recebe: [bpc.id] }, { 'content-type': 'application/json' });
  assert.ok(r.body.incompatibilidades.length >= 2, 'BPC × auxílio-inclusão e × salário-maternidade');
});

test('dado ausente vira avaliação, nunca chute: perfil vazio não gera não-elegíveis por REQUISITO booleano', async () => {
  const r = await post('/direitos/descubra', {}, { 'content-type': 'application/json' });
  // sem nenhuma informação, nada pode ser excluído por requisito não atendido
  assert.equal(r.body.nao_elegiveis.length, 0);
});
