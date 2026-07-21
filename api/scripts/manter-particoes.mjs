// ============================================================
// manter-particoes.mjs — manutenção de partições de Observacao (B5).
// As partições fixas do DDL cobrem até 2029-01-01 (…_2026 = 2026–2029).
// Um INSERT com DataReferencia fora de toda faixa FALHA (não há DEFAULT),
// abortando a promoção Ouro. Este passo cria, de forma idempotente, as
// partições ANUAIS a partir de 2029 até (ano atual + horizonte), para
// que cargas futuras nunca esbarrem no limite.
//
// Uso: node scripts/manter-particoes.mjs
// No serviço 'rotinas' (produção): roda 1×/dia (barato e idempotente).
// Conecta como dono do banco (DDL) — DATABASE_URL padrão itmt:itmt.
// ============================================================
import { pool } from './lib-ingest.mjs';

const HORIZONTE_ANOS = 2;     // quantos anos à frente garantir
const PRIMEIRO_ANO_ANUAL = 2029; // primeiro ano após as partições fixas do DDL

const db = pool();

async function main() {
  const anoFim = new Date().getFullYear() + HORIZONTE_ANOS;
  let criadas = 0;
  for (let ano = PRIMEIRO_ANO_ANUAL; ano <= anoFim; ano++) {
    const nome = `Observacao_${ano}`;
    const existe = await db.query(`SELECT to_regclass($1) IS NOT NULL AS e`, [`public."${nome}"`]);
    if (existe.rows[0].e) continue;
    // Nome de partição derivado do ano (inteiro validado pelo laço) — sem injeção.
    await db.query(
      `CREATE TABLE "${nome}" PARTITION OF "Observacao"
        FOR VALUES FROM ('${ano}-01-01') TO ('${ano + 1}-01-01')`,
    );
    criadas++;
    console.log(`✓ partição ${nome} criada (${ano}-01-01 … ${ano + 1}-01-01)`);
  }
  console.log(
    criadas
      ? `[particoes] ${criadas} partição(ões) criada(s); horizonte até ${anoFim}.`
      : `[particoes] partições já cobrem até ${anoFim} — nada a fazer.`,
  );
}

main()
  .catch((e) => { console.error('[particoes] falhou:', e.message); process.exitCode = 1; })
  .finally(() => db.end());
