// ============================================================
// e2e.mjs — suíte de regressão do F1 (DoD, PRD §18.1)
// Sobe a API real contra o banco e verifica os invariantes:
//   3. Teste de procedência: nenhum valor sem o quinteto → FALHA O BUILD
//   4. RN-003: NAO_AGREGAVEL bloqueado; RECALCULO correto
//   RN-002: composição temporal de consórcio
//   RF-PORTAL-005/006/007, RF-ADMIN-001/003/004, RF-ADMIN-008
// Uso: npm test   (exige DATABASE_URL apontando para o banco com seed)
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';

const PORT = 3901;
const BASE = `http://localhost:${PORT}/v1`;
const ADMIN = { Authorization: 'Bearer itmt-admin-dev', 'Content-Type': 'application/json' };
let api;

before(async () => {
  api = spawn('node', ['dist/main.js'], {
    env: { ...process.env, PORT: String(PORT) },
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

// ---------- 3. TESTE DE PROCEDÊNCIA (falha o build) ----------
test('todo valor publicado carrega o quinteto de procedência (§12.1)', async () => {
  const casos = [
    `/indicadores/1/consulta?recorte=MUNICIPIO&codigo=5103403&referencia=2025-12-31`,
    `/indicadores/1/consulta?recorte=ESTADO&referencia=2025-12-31`,
    `/indicadores/8/consulta?recorte=CONSORCIO&codigo=1&referencia=2025-12-31`,
  ];
  for (const url of casos) {
    const d = await (await fetch(BASE + url)).json();
    assert.ok(Array.isArray(d.procedencia) && d.procedencia.length > 0, `sem procedência: ${url}`);
    for (const p of d.procedencia) {
      for (const campo of ['fonte', 'data_referencia', 'data_extracao', 'licenca', 'hash']) {
        assert.ok(p[campo], `quinteto incompleto (${campo}) em ${url}`);
      }
      assert.match(p.hash, /^[0-9a-f]{64}$/, `hash inválido em ${url}`);
    }
  }
});

// ---------- 4. RN-003 ----------
test('RN-003: rollup de NAO_AGREGAVEL é bloqueado com 422 na camada de serviço', async () => {
  const r = await fetch(`${BASE}/indicadores/7/consulta?recorte=RGINT&codigo=5101`);
  assert.equal(r.status, 422);
});

test('RN-003: taxa (RECALCULO) é recomputada de Σnum/Σden, nunca somada', async () => {
  const d = await (
    await fetch(`${BASE}/indicadores/8/consulta?recorte=CONSORCIO&codigo=1&referencia=2025-12-31`)
  ).json();
  // Membros vigentes em 2025: Sinop, Sorriso, Lucas — (13980+8120+5710)/(15110+8890+6060)*100
  assert.equal(d.valor, 92.5);
  assert.equal(d.agregacao, 'RECALCULO');
  assert.equal(d.municipios_agregados, 3);
});

// ---------- RN-002 ----------
test('RN-002: consórcio resolve a composição na data de referência', async () => {
  // ref. 2025: Alta Floresta (DataFim 2024-12-31) está FORA
  const d = await (
    await fetch(`${BASE}/indicadores/1/consulta?recorte=CONSORCIO&codigo=1&referencia=2025-12-31`)
  ).json();
  assert.equal(d.municipios_agregados, 3);
});

// ---------- RN-005 ----------
test('RN-005: ausência de dado é resposta explícita, nunca estimativa', async () => {
  const r = await fetch(
    `${BASE}/indicadores/1/consulta?recorte=MUNICIPIO&codigo=5103403&referencia=2019-01-01`,
  );
  assert.equal(r.status, 404);
  const d = await r.json();
  assert.match(d.message, /referência mais recente/);
});

// ---------- RF-PORTAL-006 ----------
test('comparação inclui RGI/RGInt/Estado e até 4 municípios livres; 5º é recusado', async () => {
  const ok = await (
    await fetch(
      `${BASE}/indicadores/1/comparacao?codigo_ibge=5103403&referencia=2025-12-31&municipios=5107909,5107602`,
    )
  ).json();
  assert.ok(ok.municipio && ok.regiaoImediata && ok.estado);
  assert.equal(ok.municipiosLivres.length, 2);

  const demais = await fetch(
    `${BASE}/indicadores/1/comparacao?codigo_ibge=5103403&municipios=5107909,5107602,5108402,5102504,5101803`,
  );
  assert.equal(demais.status, 422); // §15.7: a API recusa e explica
});

// ---------- RF-PORTAL-005 ----------
test('exportação CSV/XLSX/PDF com procedência', async () => {
  const csv = await fetch(
    `${BASE}/indicadores/1/exportacao?formato=csv&recorte=ESTADO&referencia=2025-12-31`,
  );
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const corpo = await csv.text();
  assert.match(corpo, /municipio;codigo_ibge;valor/);
  assert.match(corpo, /hash_bronze/);

  const xlsx = await fetch(
    `${BASE}/indicadores/1/exportacao?formato=xlsx&recorte=MUNICIPIO&codigo=5103403`,
  );
  assert.equal(xlsx.status, 200);
  assert.match(xlsx.headers.get('content-type'), /spreadsheetml/);

  const pdf = await fetch(
    `${BASE}/indicadores/1/exportacao?formato=pdf&recorte=MUNICIPIO&codigo=5103403`,
  );
  assert.equal(pdf.status, 200);
  const bytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
});

// ---------- ADMIN ----------
test('ADMIN exige token (RNF-05)', async () => {
  const r = await fetch(`${BASE}/admin/indicadores/pendentes`);
  assert.equal(r.status, 403);
});

test('RF-ADMIN-003/004 + RG-09: indicador só publica com parecer favorável', async () => {
  const sub = await (
    await fetch(`${BASE}/admin/indicadores`, {
      method: 'POST', headers: ADMIN,
      body: JSON.stringify({
        subtema_id: 5, nome: `Indicador de teste ${Date.now()}`, unidade: 'unid.', tipo_agregacao: 'SOMA',
      }),
    })
  ).json();
  assert.equal(sub.status, 'EM_ANALISE');

  // EM_ANALISE não aparece na listagem pública (RG-09)
  const publicos = await (await fetch(`${BASE}/subtemas/5/indicadores`)).json();
  assert.ok(!publicos.some((i) => i.id === sub.id));

  const parecer = await (
    await fetch(`${BASE}/admin/indicadores/${sub.id}/parecer`, {
      method: 'POST', headers: ADMIN,
      body: JSON.stringify({
        parecerista: 'Curadoria de teste', decisao: 'APROVADO',
        justificativa: 'Metodologia verificada em teste automatizado.',
      }),
    })
  ).json();
  assert.equal(parecer.status, 'APROVADO');

  const depois = await (await fetch(`${BASE}/subtemas/5/indicadores`)).json();
  assert.ok(depois.some((i) => i.id === sub.id));
});

test('RF-ADMIN-001: vencimentos D-90/D-30/D-7', async () => {
  const hoje = new Date();
  const em20d = new Date(hoje.getTime() + 20 * 86400000).toISOString().slice(0, 10);
  await fetch(`${BASE}/admin/autorizacoes`, {
    method: 'POST', headers: ADMIN,
    body: JSON.stringify({
      tipo: 'LICENCA_DADOS', numero: `TESTE-${Date.now()}`, orgao: 'Órgão de teste',
      vigencia_inicio: '2026-01-01', vigencia_fim: em20d,
    }),
  });
  const v = await (await fetch(`${BASE}/admin/autorizacoes/vencimentos`, { headers: ADMIN })).json();
  assert.ok(v.some((a) => a.alerta === 'D-30'));
});

// ---------- 5. Cadeia de auditoria ----------
test('RF-ADMIN-008: cadeia de auditoria íntegra após toda a suíte', () => {
  execFileSync('node', ['scripts/verificar-cadeia.mjs'], { env: process.env, stdio: 'pipe' });
});
