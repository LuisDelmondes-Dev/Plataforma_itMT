// Preparação pós-migração para produção.
// - remove somente fixtures identificáveis do pacote de desenvolvimento;
// - comprova que o inventário DEMO ficou vazio;
// - rotaciona a senha do papel itmt_app sem registrá-la em log.
// Nunca é executado pela API e recusa ambientes que não sejam produção.
import pg from 'pg';

if (process.env.NODE_ENV !== 'production') {
  throw new Error('preparar-producao só pode executar com NODE_ENV=production.');
}

const databaseUrl = process.env.DATABASE_URL ?? '';
const senhaApp = process.env.ITMT_APP_SENHA ?? '';
const dryRun = process.env.PREPARAR_PRODUCAO_DRY_RUN === '1';
if (!databaseUrl) throw new Error('DATABASE_URL do proprietário é obrigatória.');
const url = new URL(databaseUrl);
if (url.username === 'itmt_app') {
  throw new Error('A preparação exige o papel proprietário, nunca itmt_app.');
}
if (!dryRun && senhaApp.length < 24) {
  throw new Error('ITMT_APP_SENHA deve possuir ao menos 24 caracteres.');
}

const db = new pg.Client({ connectionString: databaseUrl });

async function inventarioDemo() {
  const r = await db.query(`
    SELECT categoria, total::int FROM (
      SELECT 'fontes demonstrativas' AS categoria, count(*) AS total
        FROM "Fonte"
       WHERE lower("Fonte_Nome") ~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
          OR lower("Fonte_Origem") ~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
      UNION ALL
      SELECT 'cargas demonstrativas', count(*) FROM "Carga"
       WHERE "Carga_CaminhoBronze" ILIKE '%/demo/%' OR "Carga_CaminhoBronze" LIKE 's3://t/%'
      UNION ALL
      SELECT 'consorcios demonstrativos', count(*) FROM "Consorcio"
       WHERE "Consorcio_Status" = 'DEMONSTRACAO'
      UNION ALL
      SELECT 'midias demonstrativas publicadas', count(*) FROM "AtivoMidia"
       WHERE "AtivoMidia_StatusPublicacao" = 'PUBLICADO'
         AND ("AtivoMidia_CaminhoObjeto" ILIKE '%/demo/%' OR "AtivoMidia_CaminhoObjeto" LIKE 's3://t/%')
      UNION ALL
      SELECT 'produtos GIS demonstrativos publicados', count(*) FROM "ProdutoGeografico"
       WHERE "ProdutoGeografico_StatusPublicacao" = 'PUBLICADO'
         AND ("ProdutoGeografico_CaminhoObjeto" ILIKE '%/demo/%' OR "ProdutoGeografico_CaminhoObjeto" LIKE 's3://t/%')
    ) i WHERE total > 0 ORDER BY categoria
  `);
  return r.rows;
}

async function main() {
  await db.connect();
  await db.query('BEGIN');
  try {
    const antes = await inventarioDemo();

    await db.query(`DELETE FROM "AtivoMidia"
      WHERE "AtivoMidia_CaminhoObjeto" ILIKE '%/demo/%'
         OR "AtivoMidia_CaminhoObjeto" LIKE 's3://t/%'`);
    await db.query(`DELETE FROM "ProdutoGeografico"
      WHERE "ProdutoGeografico_CaminhoObjeto" ILIKE '%/demo/%'
         OR "ProdutoGeografico_CaminhoObjeto" LIKE 's3://t/%'`);
    await db.query(`DELETE FROM "ConsorcioMunicipio" WHERE "ConsorcioMunicipio_ConsorcioId" IN
      (SELECT "Consorcio_Id" FROM "Consorcio" WHERE "Consorcio_Status" = 'DEMONSTRACAO')`);
    await db.query(`DELETE FROM "Consorcio" WHERE "Consorcio_Status" = 'DEMONSTRACAO'`);

    await db.query(`DELETE FROM "ResultadoQualidadeIndicador" WHERE "ResultadoQualidadeIndicador_CargaId" IN
      (SELECT "Carga_Id" FROM "Carga" WHERE "Carga_CaminhoBronze" ILIKE '%/demo/%' OR "Carga_CaminhoBronze" LIKE 's3://t/%')`);
    await db.query(`DELETE FROM "Quarentena" WHERE "Quarentena_CargaId" IN
      (SELECT "Carga_Id" FROM "Carga" WHERE "Carga_CaminhoBronze" ILIKE '%/demo/%' OR "Carga_CaminhoBronze" LIKE 's3://t/%')`);
    await db.query(`DELETE FROM "Observacao" WHERE "Observacao_CargaId" IN
      (SELECT "Carga_Id" FROM "Carga" WHERE "Carga_CaminhoBronze" ILIKE '%/demo/%' OR "Carga_CaminhoBronze" LIKE 's3://t/%')`);
    await db.query(`DELETE FROM "Carga" WHERE "Carga_CaminhoBronze" ILIKE '%/demo/%' OR "Carga_CaminhoBronze" LIKE 's3://t/%'`);
    await db.query(`DELETE FROM "EsquemaFonte" WHERE "EsquemaFonte_FonteId" IN
      (SELECT "Fonte_Id" FROM "Fonte" WHERE lower("Fonte_Nome") ~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
        OR lower("Fonte_Origem") ~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)')`);
    await db.query(`DELETE FROM "Fonte" WHERE lower("Fonte_Nome") ~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
      OR lower("Fonte_Origem") ~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'`);

    const depois = await inventarioDemo();
    if (depois.length) {
      throw new Error(`fixtures demonstrativas remanescentes: ${JSON.stringify(depois)}`);
    }

    if (dryRun) {
      await db.query('ROLLBACK');
      console.log(`[producao] dry-run aprovado; inventário inicial: ${JSON.stringify(antes)}`);
      return;
    }

    const comando = await db.query(
      `SELECT format('ALTER ROLE itmt_app PASSWORD %L', $1::text) AS sql`,
      [senhaApp],
    );
    await db.query(comando.rows[0].sql);
    await db.query('COMMIT');
    console.log(`[producao] preparação concluída; ${antes.length} categoria(s) de fixture tratada(s).`);
  } catch (erro) {
    await db.query('ROLLBACK');
    throw erro;
  } finally {
    await db.end();
  }
}

main().catch((erro) => {
  console.error(`[producao] preparação falhou: ${erro.message}`);
  process.exit(1);
});

