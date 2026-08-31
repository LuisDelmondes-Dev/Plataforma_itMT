// ============================================================
// avaliar-golden-set.mjs — avaliação de regressão da IA Xingú.
// KR3.1: ≥85% dos casos com plano de consulta correto.
// KR3.2: 0 respostas com numeral não lastreado (o A06 garante; o
//        avaliador confere que nenhum veto vazou).
// KR3.3: p95 ≤ 5s.
//
// E6 (ADR-010, db/61): as perguntas vêm de "GoldenPergunta" quando
// DATABASE_URL está disponível e a tabela tem casos ativos; FALLBACK para o
// JSON derivado (api/golden/golden-set.json) quando não há banco, a migração
// db/61 não foi aplicada ou a tabela está vazia — degradação segura no
// espírito da RG-05: a avaliação nunca DEPENDE do banco para rodar. Quando a
// origem é o banco, cada resultado é gravado em "GoldenAvaliacao"
// (append-only) e o placar é comparado com a rodada anterior — regrediu/
// melhorou deixa de se perder no stdout.
//
// Uso: API_URL=http://localhost:3001 [DATABASE_URL=...] node scripts/avaliar-golden-set.mjs [limite]
// ============================================================
import pg from 'pg';
import {
  avaliarCaso, carregarCasos, compararComRodadaAnterior, registrarAvaliacoes,
} from './lib-golden.mjs';

const BASE = (process.env.API_URL ?? 'http://localhost:3001') + '/v1';
const { origem, casos } = await carregarCasos({
  databaseUrl: process.env.DATABASE_URL,
  caminhoJson: new URL('../golden/golden-set.json', import.meta.url),
});
console.log(`Origem dos casos: ${origem === 'banco' ? '"GoldenPergunta" (banco)' : 'golden-set.json (fallback)'}.`);
const LIMITE = Number(process.argv[2] ?? casos.length);
const amostra = casos.slice(0, LIMITE);
const rodada = new Date().toISOString();

let corretos = 0;
const latencias = [];
const falhas = [];
const itens = []; // linhas da rodada para "GoldenAvaliacao"

for (const c of amostra) {
  const t0 = Date.now();
  let d;
  try {
    const r = await fetch(`${BASE}/xingu/pergunta`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pergunta: c.pergunta }),
    });
    d = await r.json();
  } catch (erro) {
    latencias.push(Date.now() - t0);
    itens.push({
      codigo: c.codigo, resultado: 'ERRO', detalhe: { erro: erro.message },
      provedor: process.env.XINGU_PROVEDOR ?? 'desconhecido', latenciaMs: Date.now() - t0,
    });
    if (falhas.length < 10) falhas.push({ pergunta: c.pergunta, categoria: c.categoria, estado: 'ERRO', plano: null });
    continue;
  }
  const latenciaMs = Date.now() - t0;
  latencias.push(latenciaMs);

  const ok = avaliarCaso(c.esperado, d);
  if (ok) corretos++;
  else if (falhas.length < 10) falhas.push({ pergunta: c.pergunta, categoria: c.categoria, estado: d.estado, plano: d.plano });

  itens.push({
    codigo: c.codigo,
    resultado: ok ? 'CORRETO' : 'INCORRETO',
    // o acerto não precisa de dossiê; o erro guarda plano obtido × esperado
    detalhe: ok ? null : { estado: d.estado, plano_obtido: d.plano ?? null, esperado: c.esperado },
    provedor: d.auditoria?.interprete ?? process.env.XINGU_PROVEDOR ?? 'desconhecido',
    latenciaMs,
  });
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

// Persistência do histórico + comparação com a rodada anterior — SÓ quando a
// origem foi o banco (casos do JSON podem não existir em "GoldenPergunta";
// gravar avaliação órfã violaria a FK e mentiria sobre a fonte).
if (origem === 'banco') {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await db.connect();
    await registrarAvaliacoes(db, rodada, itens);
    console.log(`\n✓ Rodada ${rodada} gravada em "GoldenAvaliacao" (${itens.length} linhas, append-only).`);
    const cmp = await compararComRodadaAnterior(db, rodada);
    if (!cmp) console.log('Primeira rodada persistida — sem base de comparação ainda.');
    else {
      const taxaAnt = (100 * cmp.anterior.corretos / cmp.anterior.total).toFixed(1);
      const delta = (Number(taxa) - Number(taxaAnt)).toFixed(1);
      const veredito = Number(delta) > 0 ? '▲ MELHOROU' : Number(delta) < 0 ? '▼ REGRESSÃO' : '= ESTÁVEL';
      console.log(`Rodada anterior (${cmp.anterior.rodada}): ${cmp.anterior.corretos}/${cmp.anterior.total} (${taxaAnt}%) → agora ${taxa}% ${veredito} (${delta > 0 ? '+' : ''}${delta} p.p.)`);
      if (cmp.regressoes.length) {
        console.log(`Perguntas que REGREDIRAM (corretas antes, não agora): ${cmp.regressoes.length}`);
        for (const r of cmp.regressoes.slice(0, 10)) console.log(` ▼ [${r.codigo}] "${r.pergunta}"`);
      }
    }
  } catch (erro) {
    console.warn(`⚠ Não foi possível gravar/comparar a rodada (${erro.message}); o placar acima permanece válido.`);
  } finally {
    await db.end().catch(() => {});
  }
}

process.exit(taxa >= 85 && p95 <= 5000 ? 0 : 1);
