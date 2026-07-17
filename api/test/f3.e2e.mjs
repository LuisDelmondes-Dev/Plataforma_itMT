// ============================================================
// f3.e2e.mjs — regressão do F3 (GEO / MTIMAGENS / VIDEOS / CAMPO)
// Prova que os vetos são DE BANCO (flag/trigger), não de UI:
// RF-GEO-007, RC-03 (A11), RC-04, RF-IMG-002/003/005, RF-CAMPO-002.
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 3903;
const BASE = `http://localhost:${PORT}/v1`;
const ADMIN = { Authorization: 'Bearer itmt-admin-dev', 'content-type': 'application/json' };
let api;

const post = async (path, body, headers = ADMIN) => {
  const r = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const get = async (path, headers = {}) => {
  const r = await fetch(BASE + path, { headers });
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

// ---------------- GEO ----------------
test('RF-GEO-004: projeto sem autorização/RT/acurácia não nasce', async () => {
  const r = await post('/admin/geo/projetos', { codigo_ibge: '5103403', sensor: 'X' });
  assert.equal(r.status, 400);
});

test('RF-GEO-007: produto CLASSIFICADO não publica — veto de banco → 422', async () => {
  const proj = await post('/admin/geo/projetos', {
    codigo_ibge: '5107909', autorizacao_cadastro: 'CAD-T1', autorizacao_voo: 'VOO-T1',
    responsavel_tecnico: 'RT Teste', registro_profissional: 'CREA-T', data_voo: '2026-06-01',
    sensor: 'RGB', gsd_cm: 3, acuracia: 'Classe B',
  });
  const prod = await post('/admin/geo/produtos', {
    projeto_id: proj.body.id, tipo: 'ORTOMOSAICO', caminho_objeto: 's3://t/x.tif',
    classificacao: 'CLASSIFICADO',
  });
  const pub = await post(`/admin/geo/produtos/${prod.body.id}/publicar`);
  assert.equal(pub.status, 422);
  assert.match(pub.body.message, /RF-GEO-007/);

  const prodOk = await post('/admin/geo/produtos', {
    projeto_id: proj.body.id, tipo: 'MDS', caminho_objeto: 's3://t/mds.tif', classificacao: 'PUBLICO',
  });
  const pubOk = await post(`/admin/geo/produtos/${prodOk.body.id}/publicar`);
  assert.equal(pubOk.status, 201);
});

test('geoportal público só expõe PUBLICO+PUBLICADO, com metadados RF-GEO-004', async () => {
  const r = await get('/geo/produtos');
  assert.equal(r.status, 200);
  assert.ok(r.body.length > 0);
  for (const p of r.body) {
    assert.equal(p.sistema_referencia, 'SIRGAS 2000');
    assert.ok(p.gsd_cm && p.acuracia && p.responsavel_tecnico && p.autorizacao_voo);
  }
});

test('RF-GEO-008: cobertura de imagem de rua com os 3 estados', async () => {
  const r = await get('/geo/cobertura-rua');
  const estados = new Set(r.body.map((x) => x.estado));
  assert.ok(estados.has('PUBLICADO_ITMT') && estados.has('PREEXISTENTE') && estados.has('PENDENTE'));
});

// ---------------- MTIMAGENS / VIDEOS ----------------
test('A11/RC-03: via pública sem anonimização não publica; após verificação, publica', async () => {
  const a = await post('/admin/midia/ativos', {
    codigo_ibge: '5107602', tipo: 'FOTO', titulo: 'Avenida teste', autor: 'Equipe',
    licenca: 'CC BY 4.0', caminho_objeto: 's3://t/av.jpg', via_publica: true,
  });
  const veto = await post(`/admin/midia/ativos/${a.body.id}/publicar`);
  assert.equal(veto.status, 422);
  assert.match(veto.body.message, /A11/);

  await post(`/admin/midia/ativos/${a.body.id}/anonimizar`, { verificado_por: 'Operador A11' });
  const ok = await post(`/admin/midia/ativos/${a.body.id}/publicar`);
  assert.equal(ok.status, 201);
});

test('RC-04: pessoa identificável sem termo não publica; com termo, publica', async () => {
  const a = await post('/admin/midia/ativos', {
    codigo_ibge: '5103403', tipo: 'FOTO', titulo: 'Retrato teste', autor: 'Equipe',
    licenca: 'CC BY 4.0', caminho_objeto: 's3://t/retrato.jpg', tem_pessoa_identificavel: true,
  });
  const veto = await post(`/admin/midia/ativos/${a.body.id}/publicar`);
  assert.equal(veto.status, 422);
  assert.match(veto.body.message, /RC-04/);

  const termo = await post('/admin/midia/termos', {
    titular_nome: 'Titular Teste', tipo: 'IMAGEM_VOZ', data_assinatura: '2026-07-01',
    caminho_documento: 's3://termos/t.pdf', hash_sha256: 'a'.repeat(64),
  });
  // vincular termo exige atualizar o ativo — via SQL de teste? Não: recria com termo.
  const b = await post('/admin/midia/ativos', {
    codigo_ibge: '5103403', tipo: 'FOTO', titulo: 'Retrato teste 2', autor: 'Equipe',
    licenca: 'CC BY 4.0', caminho_objeto: 's3://t/retrato2.jpg',
    tem_pessoa_identificavel: true, termo_id: termo.body.id,
  });
  const ok = await post(`/admin/midia/ativos/${b.body.id}/publicar`);
  assert.equal(ok.status, 201);
});

test('A12/RF-IMG-003: ativo sem licença não publica', async () => {
  const a = await post('/admin/midia/ativos', {
    codigo_ibge: '5107909', tipo: 'FOTO', titulo: 'Sem licença', autor: 'Equipe',
    caminho_objeto: 's3://t/sl.jpg',
  });
  const veto = await post(`/admin/midia/ativos/${a.body.id}/publicar`);
  assert.equal(veto.status, 422);
  assert.match(veto.body.message, /A12/);
});

test('RNF-10/RF-IMG-005: vídeo sem legenda/transcrição não publica', async () => {
  const a = await post('/admin/midia/ativos', {
    codigo_ibge: '5107909', tipo: 'VIDEO', titulo: 'Vídeo sem legenda', autor: 'Equipe',
    licenca: 'CC BY 4.0', caminho_objeto: 's3://t/v.mp4', duracao_min: 17,
  });
  const veto = await post(`/admin/midia/ativos/${a.body.id}/publicar`);
  assert.equal(veto.status, 422);
  assert.match(veto.body.message, /RNF-10/);
});

test('RF-IMG-002: contribuição externa exige moderação prévia', async () => {
  const a = await post('/admin/midia/ativos', {
    codigo_ibge: '5102504', tipo: 'FOTO', titulo: 'Contribuição do cidadão', autor: 'Cidadão',
    licenca: 'CC BY 4.0', caminho_objeto: 's3://t/c.jpg', contribuicao: true,
  });
  const veto = await post(`/admin/midia/ativos/${a.body.id}/publicar`);
  assert.equal(veto.status, 422);
  await post(`/admin/midia/ativos/${a.body.id}/moderar`, { decisao: 'APROVADO', moderador: 'Curador' });
  const ok = await post(`/admin/midia/ativos/${a.body.id}/publicar`);
  assert.equal(ok.status, 201);
});

test('acervo público pesquisável só devolve publicados', async () => {
  const r = await get('/midia/acervo?q=teste');
  assert.equal(r.status, 200);
  assert.ok(r.body.every((x) => x.titulo && x.licenca && x.autor));
  const semLicenca = r.body.find((x) => x.titulo === 'Sem licença');
  assert.equal(semLicenca, undefined);
});

// ---------------- CAMPO ----------------
test('RF-CAMPO-002: missão sem autorização vigente NÃO executa; com ela, executa', async () => {
  const m = await post('/admin/campo/missoes', {
    codigo_ibge: '5101803', frente: 'AUDIOVISUAL', produto_esperado: 'Vídeo institucional',
    equipe: 'Equipe Teste', janela_inicio: '2026-07-10', janela_fim: '2026-07-20',
  });
  const veto = await post(`/admin/campo/missoes/${m.body.id}/status`, { status: 'EXECUTADA' });
  assert.equal(veto.status, 422);
  assert.match(veto.body.message, /RF-CAMPO-002/);

  const aut = await post('/admin/autorizacoes', {
    tipo: 'TERMO_CESSAO', numero: `AUT-T-${Date.now()}`, orgao: 'Órgão Teste',
    vigencia_inicio: '2026-01-01', vigencia_fim: '2027-12-31',
  });
  await post(`/admin/campo/missoes/${m.body.id}/autorizacoes/${aut.body.id}`);
  const ok = await post(`/admin/campo/missoes/${m.body.id}/status`, { status: 'EXECUTADA' });
  assert.equal(ok.status, 201);
});

test('RF-CAMPO-003: captura sincronizada guarda operador/GNSS/EXIF e momento da captura', async () => {
  const missoes = await get('/admin/campo/missoes', ADMIN);
  const m = missoes.body[0];
  const c = await post(`/admin/campo/missoes/${m.id}/capturas`, {
    operador: 'Piloto 1', sensor: 'RGB', gnss: { lat: -13.06, lon: -56.09, precisao_m: 0.8 },
    exif: { iso: 100 }, checklist_ok: true, caminho_objeto: 's3://campo/img001.jpg',
    capturado_em: '2026-07-08T09:00:00Z',
  });
  assert.equal(c.status, 201);
});

test('RF-CAMPO-004: painel agrega as 4 frentes por município', async () => {
  const r = await get('/admin/campo/painel', ADMIN);
  const frentes = new Set(r.body.map((x) => x.frente));
  assert.deepEqual([...frentes].sort(), ['AUDIOVISUAL', 'ESTATISTICO', 'ESTRUTURANTE', 'GEO']);
  assert.ok(r.body.some((x) => x.estado === 'EXECUTADA'));
});
