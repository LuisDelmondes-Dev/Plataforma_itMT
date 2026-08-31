// ============================================================
// gerar-golden-set.mjs — gera o golden set (KR3.1) a partir do
// catálogo REAL do banco: perguntas × plano de consulta esperado.
//
// E6 (ADR-010, db/61): as perguntas geradas viram dado governado em
// "GoldenPergunta" (upsert idempotente por código; pergunta que sai do
// catálogo vira Ativa=false, NUNCA DELETE; perguntas CURADAS são intocadas).
// O JSON api/golden/golden-set.json CONTINUA sendo escrito — agora como
// DERIVADO, para retrocompatibilidade e uso offline; o banco é a fonte de
// verdade quando disponível. Banco sem db/61 recebe aviso e segue só com o
// JSON (degradação segura, espírito da RG-05).
//
// Uso: DATABASE_URL=... node scripts/gerar-golden-set.mjs [alvo=500]
// ============================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import pg from 'pg';
import { lerCatalogo, gerarCasos, upsertPerguntas, tabelaExiste } from './lib-golden.mjs';

const ALVO = Number(process.argv[2] ?? 500);
const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://itmt:itmt@localhost:5432/itmt',
});

const catalogo = await lerCatalogo(db);
const casos = gerarCasos(catalogo, ALVO);

// 1) JSON derivado (retrocompatibilidade/offline) — cada caso leva o código
// estável, o mesmo usado como chave em "GoldenPergunta"/"GoldenAvaliacao".
mkdirSync(new URL('../golden/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../golden/golden-set.json', import.meta.url),
  JSON.stringify({ gerado_em: new Date().toISOString(), total: casos.length, casos }, null, 1),
);
console.log(`✓ Golden set gerado: ${casos.length} casos (municipio/estado/rgint/consorcio/periodo/ambiguidade/injecao/variacao).`);

// 2) Banco (fonte de verdade quando disponível): upsert por código.
if (await tabelaExiste(db, 'GoldenPergunta')) {
  const r = await upsertPerguntas(db, casos);
  console.log(
    `✓ "GoldenPergunta" sincronizada: ${r.inseridas} inseridas, ${r.atualizadas} atualizadas, ` +
    `${r.desativadas} desativadas (perguntas fora do catálogo atual; nunca DELETE).`,
  );
} else {
  console.warn('⚠ Tabela "GoldenPergunta" ausente (aplique db/61 com npm run migrar); só o JSON foi escrito.');
}
await db.end();
