// ============================================================
// ingestar-ibge-agregado.mjs — CONECTOR GENÉRICO (API de agregados v3)
// Um conector, N indicadores: qualquer agregado municipal do IBGE.
//
// Presets inclusos:
//   populacao   → agregado 6579, variável 9324 (População estimada)
//   pib         → agregado 5938, variável 37   (PIB municipal, R$ mil)
//
// Uso:
//   node scripts/ingestar-ibge-agregado.mjs <preset|custom> [ano] [--from-bronze <arq>] [--aceitar-esquema]
//   node scripts/ingestar-ibge-agregado.mjs pib 2021
//   node scripts/ingestar-ibge-agregado.mjs custom 2022 --agregado 1612 --variavel 214 \
//        --indicador "Área plantada" --unidade "hectares" --tipo SOMA --subtema 17
//
// Pipeline: RG-06 → Bronze(SHA-256) → drift(RF-INGEST-005) →
// Prata com quarentena(RF-INGEST-010) → Ouro idempotente(RF-INGEST-006).
// ============================================================
import {
  pool, registrarFonte, salvarBronze, lerBronze, registrarCarga, auditar, baixar,
  verificarEsquema, quarentenar,
} from './lib-ingest.mjs';

const PRESETS = {
  populacao: {
    agregado: '6579', variavel: '9324',
    indicador: 'População estimada', unidade: 'habitantes', tipo: 'SOMA',
    subtemaNome: 'População estimada',
    fonte: 'IBGE — Estimativas de População (agregado 6579)',
    refDia: '-07-01',
  },
  pib: {
    agregado: '5938', variavel: '37',
    indicador: 'PIB municipal', unidade: 'R$ mil', tipo: 'SOMA',
    subtemaNome: 'PIB municipal',
    fonte: 'IBGE — Produto Interno Bruto dos Municípios (agregado 5938)',
    refDia: '-12-31',
  },
};

function arg(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? process.argv[i + 1] : padrao;
}

const preset = process.argv[2];
const ano = /^\d{4}$/.test(process.argv[3] ?? '') ? process.argv[3] : '2021';

let cfg;
if (PRESETS[preset]) cfg = { ...PRESETS[preset] };
else if (preset === 'custom') {
  cfg = {
    agregado: arg('agregado'), variavel: arg('variavel'),
    indicador: arg('indicador'), unidade: arg('unidade', 'unid.'),
    tipo: arg('tipo', 'SOMA'), subtemaNome: arg('indicador'),
    fonte: `IBGE — agregado ${arg('agregado')} / variável ${arg('variavel')}`,
    refDia: '-12-31',
  };
  if (!cfg.agregado || !cfg.variavel || !cfg.indicador) {
    console.error('custom exige --agregado, --variavel e --indicador.');
    process.exit(1);
  }
} else {
  console.error(`Uso: ingestar-ibge-agregado.mjs <${Object.keys(PRESETS).join('|')}|custom> [ano] …`);
  process.exit(1);
}

const URL = `https://servicodados.ibge.gov.br/api/v3/agregados/${cfg.agregado}/periodos/${ano}/variaveis/${cfg.variavel}?localidades=N6[N3[51]]`;
const db = pool();

try {
  const fonteId = await registrarFonte(db, {
    nome: cfg.fonte,
    origem: 'Instituto Brasileiro de Geografia e Estatística',
    url: 'https://servicodados.ibge.gov.br/api/docs/agregados',
    baseLegal: 'DADO_ABERTO',
    licenca: 'Dados abertos IBGE (Lei 12.527/2011)',
    periodicidade: 'ANUAL',
  });

  const argBronze = process.argv.indexOf('--from-bronze');
  let bruto, caminho, hash;
  if (argBronze > -1) {
    ({ conteudo: bruto, hash } = lerBronze(process.argv[argBronze + 1]));
    caminho = process.argv[argBronze + 1];
    console.log(`↻ Reprocessando Bronze: ${caminho}`);
  } else {
    console.log(`↓ Baixando agregado ${cfg.agregado}/${cfg.variavel} (${ano}) …`);
    bruto = await baixar(URL);
    ({ caminho, hash } = salvarBronze(`ibge-ag${cfg.agregado}-v${cfg.variavel}-mt-${ano}.json`, bruto));
    console.log(`✓ Bronze gravado: ${caminho}`);
  }
  console.log(`  SHA-256: ${hash}`);

  const corpo = JSON.parse(bruto);
  const series = corpo?.[0]?.resultados?.[0]?.series;
  if (!Array.isArray(series) || !series.length) {
    throw new Error('Validação Prata falhou: estrutura inesperada da API de agregados.');
  }

  const cargaId = await registrarCarga(db, {
    fonteId, hash, caminhoBronze: caminho, linhasLidas: series.length,
  });
  await verificarEsquema(db, {
    fonteId, cargaId, amostra: series[0],
    aceitarNovo: process.argv.includes('--aceitar-esquema'),
  });
  await auditar(db, 'ingest', 'INGESTAO_BRONZE', 'Carga', String(cargaId), {
    fonte: cfg.fonte, ano, hash, linhas: series.length,
  });

  // Prata com quarentena
  const linhas = [];
  for (const s of series) {
    const codigo = String(s?.localidade?.id ?? '');
    if (!/^\d{7}$/.test(codigo)) continue; // ignora níveis não-municipais
    const valor = Number(s?.serie?.[ano]);
    if (!Number.isFinite(valor) || valor < 0 || s?.serie?.[ano] === '...' || s?.serie?.[ano] === '-') {
      await quarentenar(db, cargaId, s, `Valor inválido/indisponível para ${ano}: "${s?.serie?.[ano]}"`);
      continue;
    }
    linhas.push({ codigo, valor });
  }
  if (!linhas.length) throw new Error('Prata: nenhum registro válido — tudo em quarentena.');
  console.log(`✓ Prata: ${linhas.length} válidos, ${series.length - linhas.length} descartados/quarentenados.`);

  // Garante indicador no catálogo. Indicador NOVO nasce EM_ANALISE (RG-09):
  // só aparece no portal após parecer favorável via ADMIN (RF-ADMIN-003/004).
  let indicadorId;
  const ind = await db.query(
    `SELECT "Indicador_Id" AS id FROM "Indicador" WHERE "Indicador_Nome" = $1`, [cfg.indicador],
  );
  if (ind.rows[0]) indicadorId = ind.rows[0].id;
  else {
    const sub = await db.query(
      `SELECT "SubtemaConsulta_Id" AS id FROM "SubtemaConsulta" WHERE "SubtemaConsulta_Nome" = $1`,
      [cfg.subtemaNome],
    );
    const subtemaId = sub.rows[0]?.id ?? Number(arg('subtema', ''));
    if (!subtemaId) throw new Error(`Subtema "${cfg.subtemaNome}" inexistente — informe --subtema <id>.`);
    const novo = await db.query(
      `INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_StatusValidacao")
       VALUES ($1,$2,$3,$4,'EM_ANALISE') RETURNING "Indicador_Id" AS id`,
      [subtemaId, cfg.indicador, cfg.unidade, cfg.tipo],
    );
    indicadorId = novo.rows[0].id;
    console.log(`ℹ Indicador criado EM_ANALISE (id ${indicadorId}) — publique via parecer no ADMIN (RG-09).`);
  }

  const dataRef = `${ano}${cfg.refDia}`;
  const cli = await db.connect();
  let gravadas = 0;
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
      if (r.rowCount) gravadas++;
    }
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK');
    throw e;
  } finally {
    cli.release();
  }

  await auditar(db, 'ingest', 'PROMOCAO_OURO', 'Observacao', `${cfg.indicador}-${ano}`, {
    carga_id: cargaId, gravadas,
  });
  console.log(`✓ Ouro: ${gravadas} observações (ref. ${dataRef}).`);
} catch (e) {
  console.error(`✗ Pipeline abortado: ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
