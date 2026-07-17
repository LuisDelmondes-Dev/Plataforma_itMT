// ============================================================
// migrar.mjs — aplica os arquivos de ../db em ordem numérica,
// registrando cada um em "_Migracao". Idempotente: arquivo já
// registrado não roda de novo (os seeds têm INSERTs simples —
// é o registro que garante a execução única, não o SQL).
//
// Uso:
//   node scripts/migrar.mjs               # aplica as pendentes
//   node scripts/migrar.mjs --baseline    # banco já existente:
//       registra as atuais como aplicadas SEM executar
//
// Requer DATABASE_URL com um role que possa DDL (dono do banco);
// a API em produção continua conectando como itmt_app.
// ============================================================
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dirDb = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db');
const baseline = process.argv.includes('--baseline');

const cliente = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? 'postgres://itmt:itmt@localhost:5432/itmt',
});

async function main() {
  await cliente.connect();
  await cliente.query(`CREATE TABLE IF NOT EXISTS "_Migracao" (
    "_Migracao_Arquivo" text PRIMARY KEY,
    "_Migracao_AplicadoEm" timestamptz NOT NULL DEFAULT now()
  )`);

  const aplicadas = new Set(
    (await cliente.query(`SELECT "_Migracao_Arquivo" AS a FROM "_Migracao"`)).rows.map((r) => r.a),
  );
  const arquivos = readdirSync(dirDb).filter((f) => /^\d{2}-.*\.sql$/.test(f)).sort();
  let executadas = 0;

  for (const arq of arquivos) {
    if (aplicadas.has(arq)) { console.log(`✓ ${arq} (já aplicada)`); continue; }
    if (baseline) {
      await cliente.query(`INSERT INTO "_Migracao" ("_Migracao_Arquivo") VALUES ($1)`, [arq]);
      console.log(`≡ ${arq} registrada como baseline (não executada)`);
      continue;
    }
    const sql = readFileSync(join(dirDb, arq), 'utf8');
    console.log(`→ aplicando ${arq}…`);
    try {
      await cliente.query('BEGIN');
      await cliente.query(sql);
      await cliente.query(`INSERT INTO "_Migracao" ("_Migracao_Arquivo") VALUES ($1)`, [arq]);
      await cliente.query('COMMIT');
      executadas++;
    } catch (e) {
      await cliente.query('ROLLBACK');
      console.error(`✗ ${arq} falhou: ${e.message}`);
      process.exitCode = 1;
      break;
    }
  }
  console.log(baseline ? 'Baseline concluída.' : `Concluído: ${executadas} migração(ões) aplicada(s).`);
  await cliente.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
