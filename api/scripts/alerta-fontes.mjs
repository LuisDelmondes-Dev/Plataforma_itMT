// alerta-fontes.mjs — RF-INGEST-011: alerta de "fonte parada".
// Compara a última Carga de cada fonte com a periodicidade declarada.
// Agende via cron (ex.: diário). Exit 1 se houver fonte parada.
import { pool, auditar } from './lib-ingest.mjs';

const LIMITES_DIAS = { DIARIA: 3, SEMANAL: 10, MENSAL: 40, ANUAL: 400, EVENTUAL: null };
const db = pool();
const { rows } = await db.query(`
  SELECT f."Fonte_Id" AS id, f."Fonte_Nome" AS nome, f."Fonte_Periodicidade" AS per,
         max(c."Carga_DataExtracao") AS ultima,
         now() - max(c."Carga_DataExtracao") AS atraso
    FROM "Fonte" f LEFT JOIN "Carga" c ON c."Carga_FonteId" = f."Fonte_Id"
   GROUP BY 1,2,3 ORDER BY f."Fonte_Id"`);

let paradas = 0;
for (const f of rows) {
  const limite = LIMITES_DIAS[f.per ?? 'EVENTUAL'];
  if (limite == null) continue;
  const dias = f.ultima ? (Date.now() - new Date(f.ultima).getTime()) / 86400000 : Infinity;
  if (dias > limite) {
    paradas++;
    console.error(`✗ FONTE PARADA: "${f.nome}" (${f.per}) — última carga há ${isFinite(dias) ? Math.floor(dias) + ' dias' : 'nunca'}.`);
    await auditar(db, 'ingest', 'ALERTA_FONTE_PARADA', 'Fonte', String(f.id), {
      periodicidade: f.per, ultima_carga: f.ultima,
    });
  } else {
    console.log(`✓ "${f.nome}" em dia (${f.ultima ? Math.floor(dias) + 'd' : '—'}/${limite}d).`);
  }
}
await db.end();
process.exit(paradas ? 1 : 0);
