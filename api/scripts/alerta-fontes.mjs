// alerta-fontes.mjs — RF-INGEST-011: alerta de "fonte parada".
// Compara a última Carga de cada fonte com a periodicidade declarada.
// Agende via cron (ex.: diário). Exit 1 se houver fonte parada.
//
// E18 (ADR-010 / db/63): "última carga" passa a significar última carga
// CONFIRMADA (PROMOVIDA). Antes o filtro não existia e, como a carga nascia
// PROMOVIDA já no download, este alerta media o momento em que se BAIXOU o
// arquivo — não o momento em que a fonte de fato entrou na base. Caso real
// do banco dev: a carga 96 (IBGE agregado 1612/v214, 14/08/2026) teve 141
// de 141 linhas quarentenadas, gravou zero observações, e mesmo assim fazia
// a fonte 77 aparecer aqui como "em dia". Carga CANDIDATA ou
// BLOQUEADA_DRIFT agora não conta — é justamente o caso em que a fonte
// PRECISA aparecer como parada.
import { pool, auditar } from './lib-ingest.mjs';

const LIMITES_DIAS = { DIARIA: 3, SEMANAL: 10, MENSAL: 40, ANUAL: 400, EVENTUAL: null };
const db = pool();
const { rows } = await db.query(`
  SELECT f."Fonte_Id" AS id, f."Fonte_Nome" AS nome, f."Fonte_Periodicidade" AS per,
         max(c."Carga_DataExtracao") FILTER (WHERE c."Carga_Status" = 'PROMOVIDA') AS ultima,
         count(*) FILTER (WHERE c."Carga_Status" <> 'PROMOVIDA') AS nao_confirmadas
    FROM "Fonte" f LEFT JOIN "Carga" c ON c."Carga_FonteId" = f."Fonte_Id"
   GROUP BY 1,2,3 ORDER BY f."Fonte_Id"`);

let paradas = 0;
for (const f of rows) {
  const limite = LIMITES_DIAS[f.per ?? 'EVENTUAL'];
  if (limite == null) continue;
  const dias = f.ultima ? (Date.now() - new Date(f.ultima).getTime()) / 86400000 : Infinity;
  if (dias > limite) {
    paradas++;
    const pendentes = Number(f.nao_confirmadas ?? 0);
    console.error(
      `✗ FONTE PARADA: "${f.nome}" (${f.per}) — última carga confirmada há ` +
        `${isFinite(dias) ? Math.floor(dias) + ' dias' : 'nunca'}` +
        (pendentes ? `; ${pendentes} carga(s) não confirmada(s) (CANDIDATA/BLOQUEADA_DRIFT).` : '.'),
    );
    await auditar(db, 'ingest', 'ALERTA_FONTE_PARADA', 'Fonte', String(f.id), {
      periodicidade: f.per, ultima_carga_confirmada: f.ultima, cargas_nao_confirmadas: pendentes,
    });
  } else {
    console.log(
      `✓ "${f.nome}" em dia (${f.ultima ? Math.floor(dias) + 'd' : '—'}/${limite}d, carga confirmada).`,
    );
  }
}
await db.end();
process.exit(paradas ? 1 : 0);
