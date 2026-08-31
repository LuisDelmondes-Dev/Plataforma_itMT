// ============================================================
// determinismo-motor.unit.mjs — catraca dos dois defeitos CRÍTICOS achados na
// revisão de 31/08/2026. Ambos foram provados no banco dev com dado real, e
// ambos escapavam da suíte porque o seed demonstrativo não os reproduz.
//
// (1) DISTINCT ON sem desempate. A UNIQUE de "Observacao" é
//     (Indicador, CodigoIbge, DataReferencia, FonteId) — duas fontes na MESMA
//     referência são legais e EXISTEM no banco real ("Área plantada": 141
//     municípios com duas fontes, 114 com valores diferentes). Sem desempate,
//     a linha vencedora ficava a cargo do plano de execução: o total estadual
//     medido saltou de 21.586.733 para 21.583.275 só ligando enable_sort=off,
//     com o banco intacto. Motor que muda de resposta conforme o planejador
//     não é determinístico — e RG-03 promete o contrário.
//
// (2) serie() imputando o passado. Os anos vinham de TODAS as observações do
//     indicador e cada ano consultava "vigente ≤ 31/12", então um município
//     com uma única observação em 2019 recebia cinco pontos idênticos
//     carimbados 2019..2023. Pior que zerar ausência: carrega o passado como
//     se fosse observado, e o ponto seguia para a projeção (R² = 1 sobre um
//     único dado real), para o dossiê e para PesquisaSerieHistorica, onde era
//     SELADO pelo hash canônico com categoria OBSERVADO.
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { IndicadoresService } from '../dist/indicadores/indicadores.service.js';
import { TerritorioService } from '../dist/territorio/territorio.service.js';
import { AuditoriaService } from '../dist/auditoria/auditoria.service.js';

let pool, svc, fonteA, fonteB, cargaA, cargaB, indicadorId;
const MUN = '5103403'; // Cuiabá
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

before(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = {
    query: (sql, params = []) => pool.query(sql, params),
    currentTransactionClient: () => undefined,
    withClient: async (fn) => {
      const c = await pool.connect();
      try { return await fn(c); } finally { c.release(); }
    },
  };
  svc = new IndicadoresService(db, new TerritorioService(db), new AuditoriaService(db),
    { garantirParaIndicador: async () => false });

  // Duas fontes concorrentes — o cenário que o seed demonstrativo não tem.
  const f = async (nome) => (await pool.query(
    `INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca")
     VALUES ($1,'revisao-31-08','https://exemplo.gov.br','DADO_ABERTO','CC-BY')
     RETURNING "Fonte_Id" AS id`, [nome])).rows[0].id;
  fonteA = await f('REV — fonte A (carga antiga)');
  fonteB = await f('REV — fonte B (carga recente)');

  const c = async (fonteId, hash, quando) => (await pool.query(
    `INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_LinhasLidas","Carga_Status")
     VALUES ($1,$2::timestamptz,$3,'bronze/rev.json',1,'PROMOVIDA') RETURNING "Carga_Id" AS id`,
    [fonteId, quando, hash])).rows[0].id;
  cargaA = await c(fonteA, HASH_A, '2026-01-01T00:00:00Z');
  cargaB = await c(fonteB, HASH_B, '2026-06-01T00:00:00Z'); // extraída depois

  const sub = (await pool.query(`SELECT "SubtemaConsulta_Id" AS id FROM "SubtemaConsulta" LIMIT 1`)).rows[0].id;
  indicadorId = (await pool.query(
    `INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_StatusValidacao")
     VALUES ($1,'REV — determinismo','ha','SOMA','APROVADO') RETURNING "Indicador_Id" AS id`, [sub])).rows[0].id;
});

after(async () => {
  if (indicadorId) {
    await pool.query(`DELETE FROM "Observacao" WHERE "Observacao_IndicadorId"=$1`, [indicadorId]);
    await pool.query(`DELETE FROM "Indicador" WHERE "Indicador_Id"=$1`, [indicadorId]);
  }
  for (const c of [cargaA, cargaB]) if (c) await pool.query(`DELETE FROM "Carga" WHERE "Carga_Id"=$1`, [c]);
  for (const f of [fonteA, fonteB]) if (f) await pool.query(`DELETE FROM "Fonte" WHERE "Fonte_Id"=$1`, [f]);
  await pool.end();
});

async function obs(fonteId, cargaId, valor, ref) {
  await pool.query(
    `INSERT INTO "Observacao" ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
     VALUES ($1,$2,$3::date,$4,$5,$6)`, [indicadorId, MUN, ref, valor, fonteId, cargaId]);
}

test('duas fontes na MESMA referência: o valor não depende do plano de execução', async () => {
  await obs(fonteA, cargaA, 100, '2024-12-31');
  await obs(fonteB, cargaB, 200, '2024-12-31'); // carga mais recente vence

  const ler = async () => (await svc.consultar({
    indicadorId, recorte: 'MUNICIPIO', codigo: MUN, dataReferencia: '2024-12-31',
  })).valor;

  const padrao = await ler();

  // Força outro plano — foi assim que o não-determinismo foi PROVADO.
  await pool.query('SET enable_sort = off');
  const semSort = await ler();
  await pool.query('SET enable_sort = on');
  const voltando = await ler();

  assert.equal(padrao, semSort,
    'o mesmo indicador, mesma referência e mesmo banco NÃO podem devolver valores diferentes por troca de plano');
  assert.equal(padrao, voltando);
  assert.equal(padrao, 200,
    'a regra declarada é a carga mais recente — a fonte B foi extraída depois');
});

test('serie() não repete o valor do ano anterior como se fosse observação', async () => {
  // Uma única observação, em 2020. Os anos do indicador vão de 2020 a 2024
  // porque a outra observação (acima) é de 2024 — exatamente a forma do bug.
  const outro = '5107602'; // Rondonópolis
  await pool.query(
    `INSERT INTO "Observacao" ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
     VALUES ($1,$2,'2020-12-31',868,$3,$4)`, [indicadorId, outro, fonteA, cargaA]);

  const s = await svc.serie({ indicadorId, recorte: 'MUNICIPIO', codigo: outro });
  const anos = s.pontos.map((p) => p.ano);

  assert.deepEqual(anos, [2020],
    `município com UMA observação (2020) só pode ter UM ponto; veio ${JSON.stringify(anos)}`);
  assert.equal(s.pontos[0].valor, 868);
});

test('serie() mantém os anos em que HÁ observação', async () => {
  await obs(fonteB, cargaB, 300, '2022-12-31');
  const s = await svc.serie({ indicadorId, recorte: 'MUNICIPIO', codigo: MUN });
  const anos = s.pontos.map((p) => p.ano).sort();
  assert.deepEqual(anos, [2022, 2024],
    'os dois anos realmente observados têm que aparecer — a guarda não pode virar censura');
});
