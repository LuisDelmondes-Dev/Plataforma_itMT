// ============================================================
// avaliar-golden-set.mjs — avaliação de regressão da IA Xingú.
// KR3.1: ≥85% dos casos com plano de consulta correto.
// KR3.2: 0 respostas com numeral não lastreado (o A06 garante; o
//        avaliador confere que nenhum veto vazou).
// KR3.3: p95 ≤ 5s.
// Uso: API_URL=http://localhost:3001 node scripts/avaliar-golden-set.mjs [limite]
// ============================================================
import { readFileSync } from 'node:fs';

const BASE = (process.env.API_URL ?? 'http://localhost:3001') + '/v1';
const { casos } = JSON.parse(readFileSync(new URL('../golden/golden-set.json', import.meta.url), 'utf8'));
const LIMITE = Number(process.argv[2] ?? casos.length);
const amostra = casos.slice(0, LIMITE);

let corretos = 0;
const latencias = [];
const falhas = [];

for (const c of amostra) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/xingu/pergunta`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pergunta: c.pergunta }),
  });
  const d = await r.json();
  latencias.push(Date.now() - t0);

  let ok = false;
  if (c.esperado.bloqueio) ok = d.estado === 'BLOQUEADA';
  else if (c.esperado.clarificacao) ok = d.estado === 'CLARIFICACAO';
  else {
    const p = d.plano;
    ok =
      (d.estado === 'RESPONDIDA' || d.estado === 'SEM_DADO') &&
      p &&
      p.recorte === c.esperado.recorte &&
      String(p.codigo ?? null) === String(c.esperado.codigo ?? null) &&
      (c.esperado.indicador_id == null || p.indicador_id === c.esperado.indicador_id) &&
      (c.esperado.referencia == null || p.periodo?.referencia === c.esperado.referencia);
  }
  // KR3.2: nenhuma resposta pode ter escapado do auditor
  if (d.estado === 'RESPONDIDA' && d.auditoria?.vetos > 0 && !d.resposta) ok = false;

  if (ok) corretos++;
  else if (falhas.length < 10) falhas.push({ pergunta: c.pergunta, categoria: c.categoria, estado: d.estado, plano: d.plano });
}

latencias.sort((a, b) => a - b);
const p95 = latencias[Math.floor(latencias.length * 0.95)] ?? 0;
const taxa = (100 * corretos / amostra.length).toFixed(1);

console.log(`\n===== AVALIAÇÃO DO GOLDEN SET =====`);
console.log(`Casos avaliados : ${amostra.length}`);
console.log(`Planos corretos : ${corretos} (${taxa}%)  — KR3.1 exige ≥ 85%: ${taxa >= 85 ? '✓ PASSOU' : '✗ FALHOU'}`);
console.log(`Latência p95    : ${p95} ms — KR3.3 exige ≤ 5000 ms: ${p95 <= 5000 ? '✓ PASSOU' : '✗ FALHOU'}`);
if (falhas.length) {
  console.log(`\nPrimeiras falhas:`);
  for (const f of falhas) console.log(` ✗ [${f.categoria}] "${f.pergunta}" → estado=${f.estado} plano=${JSON.stringify(f.plano)}`);
}
process.exit(taxa >= 85 && p95 <= 5000 ? 0 : 1);
