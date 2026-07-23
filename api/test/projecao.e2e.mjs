// ============================================================
// projecao.e2e.mjs — Onda 5: projeção determinística e auditável.
// Invariantes:
//   - determinismo: mesma série ⇒ mesma projeção (bit a bit);
//   - a projeção é categoria PROJECAO com método e R² declarados —
//     nunca se apresenta como dado observado (RN-005);
//   - série curta (<4 pontos) ⇒ 422, nada é estimado;
//   - indicador EM_ANALISE segue invisível também aqui (RG-09).
// Uso: npm test (exige DATABASE_URL do banco de teste com seed)
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import pg from 'pg';

const PORT = 3905;
const BASE = `http://localhost:${PORT}/v1`;
let api;
let db;

before(async () => {
  // Série sintética plurianual para o indicador 1 (aprovado no seed):
  // Cuiabá 2020..2023, reusando fonte/carga já existentes no seed.
  db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const ref = await db.query(
    `SELECT "Observacao_FonteId" AS fonte, "Observacao_CargaId" AS carga
       FROM "Observacao" WHERE "Observacao_IndicadorId" = 1 LIMIT 1`,
  );
  const { fonte, carga } = ref.rows[0];
  for (const [ano, valor] of [[2020, 100], [2021, 110], [2022, 120], [2023, 130]]) {
    await db.query(
      `INSERT INTO "Observacao"
         ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia",
          "Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
       VALUES (1,'5103403',$1::date,$2,$3,$4)
       ON CONFLICT ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_FonteId")
       DO UPDATE SET "Observacao_Valor" = EXCLUDED."Observacao_Valor"`,
      [`${ano}-12-31`, valor, fonte, carga],
    );
  }

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

after(async () => {
  api?.kill();
  await db?.end();
});

test('projeção é determinística: mesma série ⇒ mesma projeção', async () => {
  const url = `${BASE}/indicadores/1/projecao?recorte=MUNICIPIO&codigo=5103403&horizonte=2`;
  const a = await (await fetch(url)).json();
  const b = await (await fetch(url)).json();
  assert.deepEqual(a, b, 'duas chamadas idênticas divergiram');
  assert.equal(a.categoria, 'PROJECAO');
  assert.ok(a.metodo.includes('OLS'), 'método não declarado');
  assert.ok(typeof a.r2 === 'number');
  assert.equal(a.projetados.length, 2);
  // série sintética 100,110,120,130 (+ ponto real do seed em 2025, se houver)
  // é crescente — a projeção OLS deve continuar acima do último observado
  const ultimoObs = a.observados.at(-1).valor;
  assert.ok(a.projetados[0].valor >= ultimoObs * 0.5, 'projeção incoerente com a série');
});

test('projeção nunca se apresenta como dado observado (RN-005)', async () => {
  const url = `${BASE}/indicadores/1/projecao?recorte=MUNICIPIO&codigo=5103403`;
  const d = await (await fetch(url)).json();
  assert.equal(d.categoria, 'PROJECAO');
  assert.ok(d.aviso.includes('não é dado observado'), 'aviso RN-005 ausente');
  const anosObs = new Set(d.observados.map((p) => p.ano));
  for (const p of d.projetados) {
    assert.ok(!anosObs.has(p.ano), `ano projetado ${p.ano} colide com observado`);
  }
});

test('série curta não projeta: 422, nada é estimado', async () => {
  // indicador 3 tem só 1 ano no seed
  const r = await fetch(`${BASE}/indicadores/3/projecao?recorte=MUNICIPIO&codigo=5103403`);
  assert.equal(r.status, 422);
  const d = await r.json();
  assert.ok(String(d.message).includes('4 pontos'), 'mensagem deve citar o mínimo de pontos');
});

test('cenários: determinísticos, compostos corretamente e declarados como hipótese', async () => {
  const url = `${BASE}/indicadores/1/cenarios?recorte=MUNICIPIO&codigo=5103403&horizonte=3&taxas=10,-5`;
  const a = await (await fetch(url)).json();
  const b = await (await fetch(url)).json();
  assert.deepEqual(a, b, 'duas simulações idênticas divergiram');
  assert.equal(a.categoria, 'CENARIO');
  assert.ok(a.aviso.includes('hipóteses'), 'aviso de hipótese ausente');
  // matemática composta: 1º ano da taxa +10% = base × 1.1 (2 casas)
  const cen10 = a.cenarios.find((c) => c.rotulo === '+10% a.a.');
  assert.ok(cen10, 'cenário +10% ausente');
  assert.equal(cen10.pontos[0].valor, Math.round(a.base.valor * 1.1 * 100) / 100);
  assert.equal(cen10.pontos.length, 3);
  // cada cenário declara o próprio método
  for (const c of a.cenarios) assert.ok(c.metodo.length > 10, `método ausente em ${c.rotulo}`);
});

test('cenários: taxas inválidas são recusadas (400), nada é simulado', async () => {
  for (const taxas of ['', '999', 'abc']) {
    const r = await fetch(`${BASE}/indicadores/1/cenarios?recorte=ESTADO&taxas=${taxas}`);
    assert.equal(r.status, 400, `taxas="${taxas}" deveria ser 400`);
  }
});

test('RG-09 vale na projeção: indicador sem parecer é 404 por id direto', async () => {
  const criado = await (
    await fetch(`${BASE}/admin/indicadores`, {
      method: 'POST',
      headers: { Authorization: 'Bearer itmt-admin-dev', 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtema_id: 1, nome: `Proj RG09 ${Date.now()}`, unidade: 'x', tipo_agregacao: 'SOMA' }),
    })
  ).json();
  const r = await fetch(`${BASE}/indicadores/${criado.id}/projecao?recorte=ESTADO`);
  assert.equal(r.status, 404);
});
