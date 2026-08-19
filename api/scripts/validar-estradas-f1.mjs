// Gate independente do golden path de estradas vicinais.
// Catálogo/metodologia não substituem observações oficiais e cobertura.
import { pool } from './lib-ingest.mjs';

const db = pool();
try {
  const r = await db.query(`
    SELECT i."Indicador_Id" AS id,
           i."Indicador_StatusValidacao" AS status,
           count(o.*)::int AS observacoes,
           count(DISTINCT o."Observacao_CodigoIbge")::int AS municipios,
           count(DISTINCT o."Observacao_FonteId")::int AS fontes,
           bool_and(length(c."Carga_HashSha256") = 64) AS hashes_ok
      FROM "Indicador" i
      LEFT JOIN "Observacao" o ON o."Observacao_IndicadorId" = i."Indicador_Id"
      LEFT JOIN "Carga" c ON c."Carga_Id" = o."Observacao_CargaId"
     WHERE i."Indicador_Nome" = 'Extensão de estradas vicinais'
       AND (o."Observacao_Id" IS NULL OR
            (c."Carga_CaminhoBronze" NOT ILIKE '%/demo/%' AND c."Carga_CaminhoBronze" NOT LIKE 's3://t/%'))
     GROUP BY i."Indicador_Id", i."Indicador_StatusValidacao"
  `);
  const x = r.rows[0];
  const pass = Boolean(
    x && x.status === 'APROVADO' && x.observacoes > 0 && x.municipios >= 10 && x.fontes > 0 && x.hashes_ok,
  );
  console.log(JSON.stringify({ gate: 'F1_ESTRADAS_GOLDEN_PATH', pass, ...x }, null, 2));
  if (!pass) process.exitCode = 1;
} catch (erro) {
  console.error(`Gate de estradas indisponível: ${erro.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
