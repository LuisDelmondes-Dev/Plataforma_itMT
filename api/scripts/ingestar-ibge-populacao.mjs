// ============================================================
// ingestar-ibge-populacao.mjs — CONECTOR 2
// População estimada por município (agregado 6579, variável 9324
// da API de agregados do IBGE — SIDRA).
//
// Uso:
//   node scripts/ingestar-ibge-populacao.mjs [ano]              # ao vivo (padrão: 2024)
//   node scripts/ingestar-ibge-populacao.mjs [ano] --from-bronze <arquivo.json>
//
// Alimenta o indicador "População estimada" (SOMA) com a
// procedência completa: fonte, data de referência, extração,
// licença e hash do bruto (§12.1).
// ============================================================
import {
  pool, registrarFonte, salvarBronze, lerBronze, registrarCarga, auditar, baixar,
} from './lib-ingest.mjs';

const ano = /^\d{4}$/.test(process.argv[2] ?? '') ? process.argv[2] : '2024';
const URL = `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/${ano}/variaveis/9324?localidades=N6[N3[51]]`;

const db = pool();

try {
  const fonteId = await registrarFonte(db, {
    nome: 'IBGE — Estimativas de População (agregado 6579)',
    origem: 'Instituto Brasileiro de Geografia e Estatística',
    url: 'https://servicodados.ibge.gov.br/api/docs/agregados',
    baseLegal: 'DADO_ABERTO',
    licenca: 'Dados abertos IBGE (Lei 12.527/2011)',
    periodicidade: 'ANUAL',
  });

  // Bronze
  const argBronze = process.argv.indexOf('--from-bronze');
  let bruto, caminho, hash;
  if (argBronze > -1) {
    const arq = process.argv[argBronze + 1];
    if (!arq) throw new Error('Informe o arquivo: --from-bronze <caminho.json>');
    ({ conteudo: bruto, hash } = lerBronze(arq));
    caminho = arq;
    console.log(`↻ Reprocessando Bronze existente: ${arq}`);
  } else {
    console.log(`↓ Baixando população estimada ${ano} …`);
    bruto = await baixar(URL);
    ({ caminho, hash } = salvarBronze(`ibge-populacao-mt-${ano}.json`, bruto));
    console.log(`✓ Bronze gravado: ${caminho}`);
  }
  console.log(`  SHA-256: ${hash}`);

  // Prata: extrair série { codigo_ibge → valor }
  const corpo = JSON.parse(bruto);
  const series = corpo?.[0]?.resultados?.[0]?.series;
  if (!Array.isArray(series) || !series.length) {
    throw new Error('Validação Prata falhou: estrutura inesperada do agregado 6579.');
  }
  const linhas = [];
  for (const s of series) {
    const codigo = String(s?.localidade?.id ?? '');
    const valorTxt = s?.serie?.[ano];
    if (!/^\d{7}$/.test(codigo)) continue; // só nível N6 (município)
    const valor = Number(valorTxt);
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error(`Validação Prata falhou: valor inválido para ${codigo}: "${valorTxt}"`);
    }
    linhas.push({ codigo, valor });
  }
  if (!linhas.length) throw new Error('Validação Prata falhou: nenhuma série municipal encontrada.');
  console.log(`✓ Prata: ${linhas.length} municípios com população de ${ano}.`);

  const cargaId = await registrarCarga(db, {
    fonteId, hash, caminhoBronze: caminho, linhasLidas: linhas.length,
  });
  await auditar(db, 'ingest', 'INGESTAO_BRONZE', 'Carga', String(cargaId), {
    fonte: 'IBGE agregado 6579', ano, hash, linhas: linhas.length,
  });

  // Localizar o indicador de destino pelo nome canônico
  const ind = await db.query(
    `SELECT "Indicador_Id" AS id FROM "Indicador" WHERE "Indicador_Nome" = 'População estimada'`,
  );
  if (!ind.rows[0]) throw new Error('Indicador "População estimada" não existe no catálogo.');
  const indicadorId = ind.rows[0].id;
  const dataRef = `${ano}-07-01`; // data de referência das estimativas do IBGE

  // Ouro: upsert idempotente; só municípios já presentes na malha (FK garante)
  const cli = await db.connect();
  let gravadas = 0, ignoradas = 0;
  try {
    await cli.query('BEGIN');
    for (const l of linhas) {
      const r = await cli.query(
        `INSERT INTO "Observacao"
           ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia",
            "Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
         SELECT $1,$2,$3::date,$4,$5,$6
          WHERE EXISTS (SELECT 1 FROM "Municipio" WHERE "Municipio_CodigoIbge" = $2)
         ON CONFLICT ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_FonteId")
         DO UPDATE SET "Observacao_Valor" = EXCLUDED."Observacao_Valor",
                       "Observacao_CargaId" = EXCLUDED."Observacao_CargaId"`,
        [indicadorId, l.codigo, dataRef, l.valor, fonteId, cargaId],
      );
      r.rowCount ? gravadas++ : ignoradas++;
    }
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK');
    throw e;
  } finally {
    cli.release();
  }

  await auditar(db, 'ingest', 'PROMOCAO_OURO', 'Observacao', `populacao-${ano}`, {
    carga_id: cargaId, gravadas, ignoradas,
  });
  console.log(
    `✓ Ouro: ${gravadas} observações promovidas (ref. ${dataRef})` +
      (ignoradas ? `; ${ignoradas} ignoradas por município ausente na malha — rode antes o conector de território.` : '.'),
  );
} catch (e) {
  console.error(`✗ Pipeline abortado: ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
