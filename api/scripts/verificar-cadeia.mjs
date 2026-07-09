// Verificador independente da cadeia de auditoria (RF-ADMIN-008).
// Uso: DATABASE_URL=... node scripts/verificar-cadeia.mjs
import pg from 'pg';
import { createHash } from 'node:crypto';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://itmt:itmt@localhost:5432/itmt',
});

const { rows } = await pool.query(
  `SELECT "EventoAuditoria_Id" AS id, "EventoAuditoria_Payload"::text AS payload,
          "EventoAuditoria_HashAnterior" AS anterior, "EventoAuditoria_HashAtual" AS atual
     FROM "EventoAuditoria" ORDER BY "EventoAuditoria_Id"`,
);

let esperadoAnterior = '0'.repeat(64);
let quebras = 0;
for (const r of rows) {
  if (r.anterior !== esperadoAnterior) {
    console.error(`✗ Evento ${r.id}: HashAnterior não encadeia (esperado ${esperadoAnterior.slice(0, 12)}…).`);
    quebras++;
  }
  const recalc = createHash('sha256').update(r.anterior + r.payload).digest('hex');
  if (recalc !== r.atual) {
    console.error(`✗ Evento ${r.id}: HashAtual divergente — payload pode ter sido adulterado.`);
    quebras++;
  }
  esperadoAnterior = r.atual;
}

console.log(
  quebras === 0
    ? `✓ Cadeia íntegra: ${rows.length} evento(s) verificados.`
    : `✗ ${quebras} quebra(s) detectada(s) em ${rows.length} evento(s). ALERTAR (RF-ADMIN-008).`,
);
await pool.end();
process.exit(quebras === 0 ? 0 : 1);
