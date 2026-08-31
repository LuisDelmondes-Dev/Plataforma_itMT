// ============================================================
// status-dado.unit.mjs — Evolução E3 (ADR-010 · status do dado como domínio
// curado, com a E11 "fase de homologação" fundida — db/60).
//
// PADRÃO: banco-direto, como ranking.unit.mjs/causas.unit.mjs — node:test +
// pg.Pool no DATABASE_URL de um banco DESCARTÁVEL migrado (db/01..60),
// instanciando o serviço COMPILADO de dist/. NUNCA aponte para o banco dev.
//
// Invariantes cobertas:
//   (a) o CHECK de "Observacao_StatusDado" rejeita valor fora do domínio
//       ('PRELIMINAR','CONSOLIDADO','REVISADO'; NULL permitido);
//   (b) curadoria do db/60 sobre o dado REAL do db/50: SIM/SINASC 2019–2024
//       respondem status_dado='CONSOLIDADO' (evidência: "dados FINAIS até
//       2024, atualizados em 02/12/2025 na fonte", cabeçalho do db/50) —
//       no valor municipal, na taxa RECALCULO estadual e no ranking;
//   (c) agregação com parcelas de status misto reporta o PIOR: PRELIMINAR
//       contamina o agregado e a citação colapsada (fonte|referência|hash);
//   (d) ausência honesta: observação com status NULL não exibe o campo —
//       nem no topo da resposta, nem na citação (nunca um default chutado);
//   (e) parcela de status DESCONHECIDO impede afirmar CONSOLIDADO no
//       agregado (campo omitido: não se afirma o que não se sabe);
//   (f) mapa propaga o status por município (e o pior do par no RECALCULO
//       fica coberto pela mesma piorStatus provada em (c)/(e)).
//
// O cenário misto usa um indicador SINTÉTICO próprio (fonte/carga/indicador
// criados aqui e removidos no after) para não depender de mutar o dado real
// do db/50, que outras suítes assertam em absoluto.
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { IndicadoresService } from '../dist/indicadores/indicadores.service.js';
import { TerritorioService } from '../dist/territorio/territorio.service.js';
import { AuditoriaService } from '../dist/auditoria/auditoria.service.js';

const REF_REAL = '2024-12-31';
const NOMES_REAIS = ['Óbitos infantis', 'Nascidos vivos', 'Taxa de mortalidade infantil'];
const FONTE_SINTETICA = 'E3 — fonte sintética (status do dado, teste)';
const INDICADOR_SINTETICO = 'E3 — indicador sintético (status do dado, teste)';
const HASH_SINTETICO = 'e3'.repeat(32); // 64 hex, como um SHA-256
const CUIABA = '5103403';
const SINOP = '5107909';
const CACERES = '5102504';

let pool;
let svc;
let fonteId;
let cargaId;
let indicadorId;
let idsReais = {}; // nome -> id

before(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = {
    query: (sql, params = []) => pool.query(sql, params),
    currentTransactionClient: () => undefined,
    withClient: async (fn) => {
      const client = await pool.connect();
      try {
        return await fn(client);
      } finally {
        client.release();
      }
    },
  };
  const territorio = new TerritorioService(db);
  const auditoria = new AuditoriaService(db);
  const agentes = { garantirParaIndicador: async () => false }; // teste não vai à internet
  svc = new IndicadoresService(db, territorio, auditoria, agentes);

  // Simulação do gate humano (RG-09) no banco descartável, como em
  // causas.unit.mjs — em produção esse ato é do curador, jamais deste teste.
  await pool.query(
    `UPDATE "Indicador" SET "Indicador_StatusValidacao"='APROVADO' WHERE "Indicador_Nome" = ANY($1)`,
    [NOMES_REAIS],
  );
  const reais = await pool.query(
    `SELECT "Indicador_Id" AS id, "Indicador_Nome" AS nome FROM "Indicador" WHERE "Indicador_Nome" = ANY($1)`,
    [NOMES_REAIS],
  );
  for (const l of reais.rows) idsReais[l.nome] = l.id;
  assert.equal(Object.keys(idsReais).length, 3, 'db/50 deveria ter criado os 3 indicadores');

  // Cenário sintético: fonte + carga + indicador SOMA aprovado + 3 observações
  // (PRELIMINAR, CONSOLIDADO e NULL) — removidos no after().
  const f = await pool.query(
    `INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade")
     VALUES ($1,'suíte status-dado.unit.mjs',NULL,'DADO_ABERTO','CC0','ANUAL')
     ON CONFLICT ("Fonte_Nome") DO UPDATE SET "Fonte_Origem"=EXCLUDED."Fonte_Origem"
     RETURNING "Fonte_Id" AS id`,
    [FONTE_SINTETICA],
  );
  fonteId = f.rows[0].id;
  const c = await pool.query(
    `INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas","Carga_LinhasQuarentena")
     SELECT $1, now(), $2, 'snapshot://teste/e3', 'PROMOVIDA', 3, 0
      WHERE NOT EXISTS (SELECT 1 FROM "Carga" WHERE "Carga_HashSha256"=$2)`,
    [fonteId, HASH_SINTETICO],
  );
  void c;
  cargaId = (
    await pool.query(`SELECT "Carga_Id" AS id FROM "Carga" WHERE "Carga_HashSha256"=$1`, [
      HASH_SINTETICO,
    ])
  ).rows[0].id;
  const subtema = await pool.query(`SELECT min("SubtemaConsulta_Id") AS id FROM "SubtemaConsulta"`);
  await pool.query(
    `INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_StatusValidacao")
     SELECT $1, $2, 'unidades', 'SOMA', 'APROVADO'
      WHERE NOT EXISTS (SELECT 1 FROM "Indicador" WHERE "Indicador_Nome"=$2)`,
    [subtema.rows[0].id, INDICADOR_SINTETICO],
  );
  indicadorId = (
    await pool.query(`SELECT "Indicador_Id" AS id FROM "Indicador" WHERE "Indicador_Nome"=$1`, [
      INDICADOR_SINTETICO,
    ])
  ).rows[0].id;
  const obs = [
    [CUIABA, '2023-12-31', 10, 'PRELIMINAR'],
    [SINOP, '2023-12-31', 20, 'CONSOLIDADO'],
    [CACERES, '2022-12-31', 5, null], // status desconhecido de propósito
  ];
  for (const [codigo, ref, valor, status] of obs) {
    await pool.query(
      `INSERT INTO "Observacao" ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_Valor","Observacao_FonteId","Observacao_CargaId","Observacao_StatusDado")
       VALUES ($1,$2,$3::date,$4,$5,$6,$7)
       ON CONFLICT ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_FonteId") DO UPDATE
         SET "Observacao_Valor"=EXCLUDED."Observacao_Valor",
             "Observacao_StatusDado"=EXCLUDED."Observacao_StatusDado"`,
      [indicadorId, codigo, ref, valor, fonteId, cargaId, status],
    );
  }
});

after(async () => {
  // Limpeza do cenário sintético: o banco compartilhado da rodada volta ao
  // estado anterior (a aprovação RG-09 dos reais é a mesma de causas.unit.mjs).
  if (indicadorId) {
    await pool.query(`DELETE FROM "Observacao" WHERE "Observacao_IndicadorId"=$1`, [indicadorId]);
    await pool.query(`DELETE FROM "Indicador" WHERE "Indicador_Id"=$1`, [indicadorId]);
  }
  if (cargaId) await pool.query(`DELETE FROM "Carga" WHERE "Carga_Id"=$1`, [cargaId]);
  if (fonteId) await pool.query(`DELETE FROM "Fonte" WHERE "Fonte_Id"=$1`, [fonteId]);
  await pool.end();
});

test('(a) CHECK rejeita status fora do domínio; NULL e os três valores passam', async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO "Observacao" ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_Valor","Observacao_FonteId","Observacao_CargaId","Observacao_StatusDado")
       VALUES ($1,$2,'2021-12-31',1,$3,$4,'FINAL')`,
      [indicadorId, CUIABA, fonteId, cargaId],
    ),
    /check/i,
    `'FINAL' não pertence ao domínio e o banco deveria vetar`,
  );
  await assert.rejects(
    pool.query(
      `UPDATE "Observacao" SET "Observacao_StatusDado"='consolidado' WHERE "Observacao_IndicadorId"=$1`,
      [indicadorId],
    ),
    /check/i,
    'minúsculas fora do domínio deveriam ser vetadas (curadoria é maiúscula)',
  );
});

test('(b) curadoria db/60: SIM/SINASC 2019–2024 respondem CONSOLIDADO (evidência do db/50)', async () => {
  // Valor municipal direto (SOMA): todas as parcelas são da carga consolidada.
  const obitos = await svc.consultar({
    indicadorId: idsReais['Óbitos infantis'],
    recorte: 'MUNICIPIO',
    codigo: CUIABA,
    dataReferencia: REF_REAL,
  });
  assert.equal(obitos.status_dado, 'CONSOLIDADO');
  assert.ok(obitos.procedencia.length >= 1);
  for (const p of obitos.procedencia) assert.equal(p.status_dado, 'CONSOLIDADO');

  // Taxa RECALCULO estadual: numerador E denominador consolidados ⇒ agregado consolidado.
  const tmi = await svc.consultar({
    indicadorId: idsReais['Taxa de mortalidade infantil'],
    recorte: 'ESTADO',
    codigo: null,
    dataReferencia: REF_REAL,
  });
  assert.equal(tmi.status_dado, 'CONSOLIDADO');
  for (const p of tmi.procedencia) assert.equal(p.status_dado, 'CONSOLIDADO');

  // Ranking: cada linha carrega o status na citação.
  const ranking = await svc.ranking({
    indicadorId: idsReais['Taxa de mortalidade infantil'],
    referencia: REF_REAL,
    n: 3,
  });
  for (const m of ranking.municipios)
    for (const p of m.procedencia) assert.equal(p.status_dado, 'CONSOLIDADO');
});

test('(c) parcelas mistas: o agregado reporta o PIOR — PRELIMINAR contamina', async () => {
  const estado = await svc.consultar({
    indicadorId,
    recorte: 'ESTADO',
    codigo: null,
    dataReferencia: '2023-12-31',
  });
  // Vigência ≤ referência: Cuiabá 10 (2023, PRELIMINAR) + Sinop 20 (2023,
  // CONSOLIDADO) + Cáceres 5 (2022, desconhecido) = 35.
  assert.equal(estado.valor, 35);
  assert.equal(estado.status_dado, 'PRELIMINAR', 'PRELIMINAR deveria contaminar o agregado');
  // Citação colapsada (mesma fonte|referência|hash, 2023): pior status vence.
  const de2023 = estado.procedencia.find((p) => p.data_referencia === '2023-12-31');
  assert.ok(de2023, 'deveria haver citação de 2023');
  assert.equal(de2023.status_dado, 'PRELIMINAR');
  // Citação de 2022 (status desconhecido): campo OMITIDO, nunca default.
  const de2022 = estado.procedencia.find((p) => p.data_referencia === '2022-12-31');
  assert.ok(de2022, 'deveria haver citação de 2022');
  assert.ok(!('status_dado' in de2022), 'status desconhecido não pode virar campo');
});

test('(d) ausência honesta: status NULL não exibe o campo em lugar nenhum', async () => {
  const caceres = await svc.consultar({
    indicadorId,
    recorte: 'MUNICIPIO',
    codigo: CACERES,
    dataReferencia: '2022-12-31',
  });
  assert.equal(caceres.valor, 5);
  assert.ok(!('status_dado' in caceres), 'topo da resposta não pode chutar status');
  for (const p of caceres.procedencia)
    assert.ok(!('status_dado' in p), 'citação não pode chutar status');

  // Regressão: o seed demonstrativo (db/02) nunca declarou status — o motor
  // antigo continua respondendo sem o campo (contrato preservado). Município
  // escolhido dinamicamente entre os que o seed cobre.
  const umDoSeed = await pool.query(
    `SELECT "Observacao_CodigoIbge" AS codigo FROM "Observacao"
      WHERE "Observacao_IndicadorId"=1 AND "Observacao_StatusDado" IS NULL LIMIT 1`,
  );
  assert.ok(umDoSeed.rows[0], 'o seed deveria ter observação sem status para o indicador 1');
  const seed = await svc.consultar({
    indicadorId: 1,
    recorte: 'MUNICIPIO',
    codigo: umDoSeed.rows[0].codigo,
    dataReferencia: '2025-12-31',
  });
  assert.ok(!('status_dado' in seed), 'dado sem curadoria de status segue sem o campo');
});

test('(e) parcela desconhecida impede afirmar CONSOLIDADO no agregado', async () => {
  // Sem o PRELIMINAR no conjunto: {CONSOLIDADO, CONSOLIDADO, desconhecido}.
  await pool.query(
    `UPDATE "Observacao" SET "Observacao_StatusDado"='CONSOLIDADO'
      WHERE "Observacao_IndicadorId"=$1 AND "Observacao_CodigoIbge"=$2`,
    [indicadorId, CUIABA],
  );
  try {
    const estado = await svc.consultar({
      indicadorId,
      recorte: 'ESTADO',
      codigo: null,
      dataReferencia: '2023-12-31',
    });
    assert.ok(
      !('status_dado' in estado),
      'com parcela de status desconhecido, CONSOLIDADO não é afirmável',
    );
    const de2023 = estado.procedencia.find((p) => p.data_referencia === '2023-12-31');
    assert.equal(de2023.status_dado, 'CONSOLIDADO', 'a citação 2023 (toda conhecida) afirma');
  } finally {
    await pool.query(
      `UPDATE "Observacao" SET "Observacao_StatusDado"='PRELIMINAR'
        WHERE "Observacao_IndicadorId"=$1 AND "Observacao_CodigoIbge"=$2`,
      [indicadorId, CUIABA],
    );
  }
});

test('(f) mapa propaga o status por município; sem status, sem campo', async () => {
  const mapa = await svc.mapa({ indicadorId, referencia: '2023-12-31' });
  const por = new Map(mapa.municipios.map((m) => [m.codigo_ibge, m]));
  assert.equal(por.get(CUIABA)?.status_dado, 'PRELIMINAR');
  assert.equal(por.get(SINOP)?.status_dado, 'CONSOLIDADO');
  assert.ok(por.get(CACERES), 'Cáceres tem dado vigente (2022) e entra no mapa');
  assert.ok(!('status_dado' in por.get(CACERES)), 'desconhecido segue sem campo no mapa');
});
