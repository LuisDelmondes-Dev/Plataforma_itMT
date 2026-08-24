// ============================================================
// avaliar-adversarial.mjs — ciclo B2: mede a robustez do A01 a
// formulações FORA do vocabulário do catálogo (golden/adversarial-a01.json).
// Complementa o golden set, que usa o nome do indicador verbatim e por
// isso mede só cobertura de vocabulário (ressalva de EV-045).
//
// Classificação por caso:
//   ACERTO       — plano aponta o indicador esperado (RESPONDIDA ou SEM_DADO:
//                  interpretar certo um recorte sem dado ainda é acerto do A01)
//   CLARIFICACAO — o motor pediu ajuda; falha SEGURA por desenho (RN-005:
//                  não estimar inclui não adivinhar intenção)
//   ERRADO       — respondeu com convicção o indicador ERRADO; é o único
//                  desfecho perigoso deste eval
//   OUTRO        — BLOQUEADA/erro de transporte
//
// Diagnóstico, não gate: o léxico é o plano B (RG-05) e vai falhar em boa
// parte — o valor é o número honesto e o corpus versionado para comparar
// provedores LLM quando houver crédito. Uso:
//   API_URL=http://localhost:3021 node scripts/avaliar-adversarial.mjs
// ============================================================
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API_URL ?? 'http://localhost:3001';
const corpus = JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'golden', 'adversarial-a01.json'), 'utf8'));

const porFamilia = new Map();
const errados = [];

for (const caso of corpus.casos) {
  let classe = 'OUTRO';
  let obtido = null;
  try {
    const r = await fetch(`${API}/v1/xingu/pergunta`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pergunta: caso.pergunta }),
    });
    const d = await r.json();
    obtido = d?.plano?.indicador_id ?? null;
    if (d.estado === 'CLARIFICACAO') classe = 'CLARIFICACAO';
    else if ((d.estado === 'RESPONDIDA' || d.estado === 'SEM_DADO') && obtido === caso.esperado_indicador_id) classe = 'ACERTO';
    else if (d.estado === 'RESPONDIDA' || d.estado === 'SEM_DADO') classe = 'ERRADO';
  } catch (e) {
    classe = 'OUTRO';
  }
  if (classe === 'ERRADO') errados.push({ ...caso, obtido });
  const f = porFamilia.get(caso.familia) ?? { ACERTO: 0, CLARIFICACAO: 0, ERRADO: 0, OUTRO: 0, total: 0 };
  f[classe]++; f.total++;
  porFamilia.set(caso.familia, f);
}

const total = { ACERTO: 0, CLARIFICACAO: 0, ERRADO: 0, OUTRO: 0, total: 0 };
console.log('\nfamília        acerto  clarif.  ERRADO  outro  total');
for (const [fam, f] of porFamilia) {
  console.log(`${fam.padEnd(14)} ${String(f.ACERTO).padStart(5)} ${String(f.CLARIFICACAO).padStart(8)} ${String(f.ERRADO).padStart(7)} ${String(f.OUTRO).padStart(6)} ${String(f.total).padStart(6)}`);
  for (const k of Object.keys(total)) total[k] += f[k];
}
console.log(`${'TOTAL'.padEnd(14)} ${String(total.ACERTO).padStart(5)} ${String(total.CLARIFICACAO).padStart(8)} ${String(total.ERRADO).padStart(7)} ${String(total.OUTRO).padStart(6)} ${String(total.total).padStart(6)}`);
console.log(`\nacerto ${(100 * total.ACERTO / total.total).toFixed(1)}% | falha segura (clarificação) ${(100 * total.CLARIFICACAO / total.total).toFixed(1)}% | ERRADO ${(100 * total.ERRADO / total.total).toFixed(1)}%`);

if (errados.length) {
  console.log('\nCasos ERRADOS (indicador esperado → obtido):');
  for (const e of errados) console.log(`  [${e.familia}] "${e.pergunta}" — ${e.esperado_indicador_id} → ${e.obtido}`);
}
