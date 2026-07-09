// ============================================================
// ingestar-csv.mjs — CONECTOR GENÉRICO DE CSV (tipo "CSV massivo", PRD §14)
// Ingesta qualquer CSV municipal a partir de uma configuração
// declarativa em JSON — sem escrever código novo por fonte.
//
// Uso:
//   node scripts/ingestar-csv.mjs <config.json> <arquivo.csv> [--aceitar-esquema]
//
// Configs de exemplo em ingest-configs/ (CNES leitos, INEP matrículas,
// SESP ocorrências, PAM área plantada). Baixe o CSV oficial da fonte,
// aponte o config e rode — o CSV vira o próprio Bronze.
//
// Config:
// {
//   "fonte": { "nome", "origem", "url", "baseLegal", "licenca", "periodicidade" },
//   "indicador": { "nome", "unidade", "tipoAgregacao", "subtemaNome" },
//   "colunas": { "codigoIbge": "CO_MUNICIPIO", "valor": "QT_LEITOS" },
//   "dataReferencia": "2025-12-31",
//   "separador": ";",
//   "agregarPorMunicipio": true      // soma linhas repetidas do mesmo município
// }
// ============================================================
import { readFileSync } from 'node:fs';
import {
  pool, registrarFonte, lerBronze, registrarCarga, auditar,
  verificarEsquema, quarentenar,
} from './lib-ingest.mjs';

const [, , configPath, csvPath] = process.argv;
if (!configPath || !csvPath) {
  console.error('Uso: node scripts/ingestar-csv.mjs <config.json> <arquivo.csv> [--aceitar-esquema]');
  process.exit(1);
}

/** Parser CSV mínimo com suporte a aspas (RFC 4180). */
function parseCsv(texto, sep) {
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.length > 1 || linha[0] !== '') linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
const db = pool();

try {
  // RG-06: a base legal vem do config e é validada — sem ela, aborta
  const fonteId = await registrarFonte(db, cfg.fonte);

  // O CSV oficial É o Bronze: hash sobre o arquivo tal como baixado
  const { conteudo, hash } = lerBronze(csvPath);
  console.log(`✓ Bronze: ${csvPath}\n  SHA-256: ${hash}`);

  const sep = cfg.separador ?? ';';
  const tabela = parseCsv(conteudo, sep);
  if (tabela.length < 2) throw new Error('Validação Prata: CSV sem linhas de dados.');
  const cab = tabela[0].map((c) => c.trim());
  const idxIbge = cab.indexOf(cfg.colunas.codigoIbge);
  const idxValor = cab.indexOf(cfg.colunas.valor);
  if (idxIbge < 0 || idxValor < 0) {
    throw new Error(
      `Colunas não encontradas no cabeçalho: ${cfg.colunas.codigoIbge} / ${cfg.colunas.valor}. ` +
        `Cabeçalho lido: ${cab.slice(0, 10).join(', ')}…`,
    );
  }

  const cargaId = await registrarCarga(db, {
    fonteId, hash, caminhoBronze: csvPath, linhasLidas: tabela.length - 1,
  });

  // RF-INGEST-005: o "esquema" de um CSV é seu cabeçalho
  await verificarEsquema(db, {
    fonteId, cargaId,
    amostra: Object.fromEntries(cab.map((c) => [c, null])),
    aceitarNovo: process.argv.includes('--aceitar-esquema'),
  });
  await auditar(db, 'ingest', 'INGESTAO_BRONZE', 'Carga', String(cargaId), {
    fonte: cfg.fonte.nome, hash, linhas: tabela.length - 1,
  });

  // Prata: normalizar, quarentenar inválidos, opcionalmente agregar por município
  const porMunicipio = new Map();
  let quarentenadas = 0;
  for (const l of tabela.slice(1)) {
    const brutoIbge = String(l[idxIbge] ?? '').trim();
    // CNES e outras bases usam código de 6 dígitos (sem DV) — normalizamos
    const codigo6 = brutoIbge.slice(0, 6);
    const valor = Number(String(l[idxValor] ?? '').replace(',', '.'));
    if (!/^\d{6,7}$/.test(brutoIbge) || !codigo6.startsWith('51') || !Number.isFinite(valor)) {
      await quarentenar(db, cargaId, Object.fromEntries(cab.map((c, i) => [c, l[i]])),
        `codigo_ibge ou valor inválido: "${brutoIbge}" / "${l[idxValor]}"`);
      quarentenadas++;
      continue;
    }
    const atual = porMunicipio.get(codigo6) ?? 0;
    porMunicipio.set(codigo6, cfg.agregarPorMunicipio ? atual + valor : valor);
  }
  if (!porMunicipio.size) throw new Error('Prata: nenhum registro válido — tudo em quarentena.');
  console.log(`✓ Prata: ${porMunicipio.size} municípios, ${quarentenadas} linha(s) em quarentena.`);

  // Indicador: existente ou criado EM_ANALISE (RG-09 — publica só com parecer)
  let indicadorId;
  const ind = await db.query(
    `SELECT "Indicador_Id" AS id FROM "Indicador" WHERE "Indicador_Nome" = $1`,
    [cfg.indicador.nome],
  );
  if (ind.rows[0]) indicadorId = ind.rows[0].id;
  else {
    const sub = await db.query(
      `SELECT "SubtemaConsulta_Id" AS id FROM "SubtemaConsulta" WHERE "SubtemaConsulta_Nome" = $1`,
      [cfg.indicador.subtemaNome],
    );
    if (!sub.rows[0]) throw new Error(`Subtema "${cfg.indicador.subtemaNome}" não existe na taxonomia.`);
    const novo = await db.query(
      `INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_StatusValidacao")
       VALUES ($1,$2,$3,$4,'EM_ANALISE') RETURNING "Indicador_Id" AS id`,
      [sub.rows[0].id, cfg.indicador.nome, cfg.indicador.unidade, cfg.indicador.tipoAgregacao ?? 'SOMA'],
    );
    indicadorId = novo.rows[0].id;
    console.log(`ℹ Indicador criado EM_ANALISE (id ${indicadorId}) — publique via parecer no ADMIN.`);
  }

  // Ouro idempotente — resolve o código de 6 dígitos contra a malha (7 dígitos)
  const cli = await db.connect();
  let gravadas = 0, semMalha = 0;
  try {
    await cli.query('BEGIN');
    for (const [codigo6, valor] of porMunicipio) {
      const r = await cli.query(
        `INSERT INTO "Observacao"
           ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia",
            "Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
         SELECT $1, m."Municipio_CodigoIbge", $3::date, $4, $5, $6
           FROM "Municipio" m
          WHERE left(m."Municipio_CodigoIbge", 6) = $2
         ON CONFLICT ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_FonteId")
         DO UPDATE SET "Observacao_Valor" = EXCLUDED."Observacao_Valor",
                       "Observacao_CargaId" = EXCLUDED."Observacao_CargaId"`,
        [indicadorId, codigo6, cfg.dataReferencia, valor, fonteId, cargaId],
      );
      r.rowCount ? gravadas++ : semMalha++;
    }
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK');
    throw e;
  } finally {
    cli.release();
  }

  await auditar(db, 'ingest', 'PROMOCAO_OURO', 'Observacao', cfg.indicador.nome, {
    carga_id: cargaId, gravadas, sem_malha: semMalha,
  });
  console.log(
    `✓ Ouro: ${gravadas} observações (ref. ${cfg.dataReferencia})` +
      (semMalha ? `; ${semMalha} sem correspondência na malha — rode o conector de território.` : '.'),
  );
} catch (e) {
  console.error(`✗ Pipeline abortado: ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
