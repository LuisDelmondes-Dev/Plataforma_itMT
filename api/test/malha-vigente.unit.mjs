// ============================================================
// malha-vigente.unit.mjs — Evolução E21 (ADR-010): a malha territorial
// VIGENTE na data de referência, e o motor consumindo-a.
//
// POR QUE ARQUIVO NOVO E NÃO EXTENSÃO DE malha.unit.mjs (decisão declarada):
// malha.unit.mjs trava o SNAPSHOT do db/57 — que a malha EXISTE, é coerente
// e tem a hierarquia oficial. É invariante de DADO. Esta suíte trava outra
// coisa: que o MOTOR lê aquele dado no tempo certo (db/66 +
// IndicadoresService). São catracas de camadas diferentes, com causas de
// quebra diferentes — misturá-las faria uma falha de motor parecer falha de
// malha no relatório do gate. Registrada em scripts/test-e2e.mjs logo após
// malha.unit.mjs e ANTES de ranking.unit.mjs, pelo mesmo motivo daquela: os
// municípios sintéticos 5199xxx da suíte de ranking ainda não existem aqui,
// então as contagens são as da malha canônica pura.
//
// POR QUE FIXTURE SINTÉTICA NO TESTE DO MOTOR (medido, não suposto):
// o caso real é "População residente — Censo 2022" (db/19), que cobre a
// malha de 2022 inteira. Num banco migrado DO ZERO ele está EM_ANALISE, não
// APROVADO — e isso está CERTO: publicar é ato humano (RG-09), e o banco dev
// só o tem aprovado porque a curadoria foi feita lá. Medido no descartável:
// dos indicadores APROVADOS, NENHUM tem observação ≤ 2022 (os 6 do seed
// começam em 2025-12-31). Então a suíte constrói o MESMO FORMATO do caso
// real — indicador SOMA aprovado com observação 2022 em todo município que
// existia em 2022 — no padrão "cria/remove" de status-dado.unit.mjs, e
// desfaz tudo no after(). O fixture NÃO usa o predicado sob teste: ele
// insere para todo município EXCETO o instalado em 2025, que é o fato do
// mundo (o Censo 2022 recenseou quem existia), não a regra sendo verificada.
//
// PADRÃO: banco-direto (node:test + pg.Pool no DATABASE_URL de um banco
// DESCARTÁVEL migrado), como malha.unit.mjs e ranking.unit.mjs.
// NUNCA o banco dev `itmt`.
//
// Invariantes cobertas:
//   (a) "MunicipiosVigentesEm" devolve 141 numa data de 2022 e 142 em
//       2025-01-01, com Boa Esperança do Norte (5101837) SÓ na segunda —
//       o mesmo 141 que a API SIDRA do IBGE devolve para 2022 (t/4709,
//       v/93, n6, UF 51), medido ao vivo em 31/08/2026;
//   (b) DataInstalacao NULL conta como vigente em QUALQUER data — e o
//       predicado sem esse ramo colapsaria a malha (0 em 2022, 1 em 2025);
//   (c) o motor, para referência 2022, NÃO trata o município não instalado
//       como dado ausente (RN-005: fora do universo ≠ sem dado);
//   (d) total_municipios/ausentes usam o universo DA DATA, não 142 fixo —
//       e em 2025 o MESMO município volta a ser ausência legítima;
//   (e) menor privilégio: PUBLIC não executa a função; itmt_app executa.
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { IndicadoresService } from '../dist/indicadores/indicadores.service.js';
import { TerritorioService } from '../dist/territorio/territorio.service.js';
import { AuditoriaService } from '../dist/auditoria/auditoria.service.js';

/** Município criado por desmembramento e instalado em 2025-01-01 (db/57). */
const NOVO = '5101837';
/** Referência anterior à instalação: aqui o município não existia. */
const REF_2022 = '2022-12-31';
/** Primeiro dia de vigência do município novo. */
const REF_2025 = '2025-01-01';

const FONTE_SINTETICA = 'Suíte malha-vigente.unit.mjs (E21)';
const HASH_SINTETICO = 'e21'.padEnd(64, '0');
const INDICADOR_SINTETICO = 'Recenseados na malha de 2022 (fixture E21)';

let pool;
let svc;
let fonteId;
let cargaId;
let indicadorId;

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
  const agentes = { garantirParaIndicador: async () => false }; // malha não vai à internet
  svc = new IndicadoresService(db, territorio, auditoria, agentes);

  // --- fixture: fonte + carga + indicador SOMA aprovado (removidos no after)
  fonteId = (
    await pool.query(
      `INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade")
       VALUES ($1,'suíte malha-vigente.unit.mjs',NULL,'DADO_ABERTO','CC0','DECENAL')
       ON CONFLICT ("Fonte_Nome") DO UPDATE SET "Fonte_Origem"=EXCLUDED."Fonte_Origem"
       RETURNING "Fonte_Id" AS id`,
      [FONTE_SINTETICA],
    )
  ).rows[0].id;

  await pool.query(
    `INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas","Carga_LinhasQuarentena")
     SELECT $1, now(), $2, 'snapshot://teste/e21', 'PROMOVIDA', 141, 0
      WHERE NOT EXISTS (SELECT 1 FROM "Carga" WHERE "Carga_HashSha256"=$2)`,
    [fonteId, HASH_SINTETICO],
  );
  cargaId = (
    await pool.query(`SELECT "Carga_Id" AS id FROM "Carga" WHERE "Carga_HashSha256"=$1`, [
      HASH_SINTETICO,
    ])
  ).rows[0].id;

  const subtema = await pool.query(`SELECT min("SubtemaConsulta_Id") AS id FROM "SubtemaConsulta"`);
  await pool.query(
    `INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_StatusValidacao")
     SELECT $1, $2, 'pessoas', 'SOMA', 'APROVADO'
      WHERE NOT EXISTS (SELECT 1 FROM "Indicador" WHERE "Indicador_Nome"=$2)`,
    [subtema.rows[0].id, INDICADOR_SINTETICO],
  );
  indicadorId = (
    await pool.query(`SELECT "Indicador_Id" AS id FROM "Indicador" WHERE "Indicador_Nome"=$1`, [
      INDICADOR_SINTETICO,
    ])
  ).rows[0].id;

  // Uma observação 2022 para TODO município exceto o instalado em 2025 —
  // o fato do mundo (o Censo 2022 recenseou quem existia), não o predicado.
  const ins = await pool.query(
    `INSERT INTO "Observacao" ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
     SELECT $1, m."Municipio_CodigoIbge", $2::date, 1000, $3, $4
       FROM "Municipio" m
      WHERE m."Municipio_CodigoIbge" <> $5
     ON CONFLICT ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_FonteId")
        DO UPDATE SET "Observacao_Valor"=EXCLUDED."Observacao_Valor"`,
    [indicadorId, REF_2022, fonteId, cargaId, NOVO],
  );
  assert.equal(ins.rowCount, 141, 'o fixture deve cobrir os 141 municípios que existiam em 2022');
});

after(async () => {
  // O banco da rodada é compartilhado entre suítes: volta ao estado anterior.
  if (indicadorId) {
    await pool.query(`DELETE FROM "Observacao" WHERE "Observacao_IndicadorId"=$1`, [indicadorId]);
    await pool.query(`DELETE FROM "Indicador" WHERE "Indicador_Id"=$1`, [indicadorId]);
  }
  if (cargaId) await pool.query(`DELETE FROM "Carga" WHERE "Carga_Id"=$1`, [cargaId]);
  if (fonteId) await pool.query(`DELETE FROM "Fonte" WHERE "Fonte_Id"=$1`, [fonteId]);
  await pool.end();
});

test('(a) malha vigente: 141 em 2022, 142 em 2025-01-01, o novo só na segunda', async () => {
  const em = async (data) =>
    (await pool.query(`SELECT codigo_ibge, nome FROM "MunicipiosVigentesEm"($1::date)`, [data]))
      .rows;

  const v2022 = await em(REF_2022);
  const v2025 = await em(REF_2025);

  // O 141 não é número escolhido: é o que a API SIDRA do IBGE devolve para
  // 2022 (tabela 4709, variável 93, nível município, UF 51) — conferido como
  // conjunto exato contra este snapshot, zero diferença nos dois sentidos.
  assert.equal(v2022.length, 141, 'malha de MT vigente em 2022: 141 municípios (SIDRA t/4709)');
  assert.equal(v2025.length, 142, 'malha de MT vigente em 2025-01-01: 142 municípios');

  const cod2022 = v2022.map((m) => m.codigo_ibge.trim());
  const cod2025 = v2025.map((m) => m.codigo_ibge.trim());
  assert.ok(!cod2022.includes(NOVO), `${NOVO} não existia em ${REF_2022} — não pode constar`);
  assert.ok(cod2025.includes(NOVO), `${NOVO} foi instalado em ${REF_2025} — deve constar`);

  // A diferença entre as duas malhas é EXATAMENTE o município novo.
  assert.deepEqual(
    cod2025.filter((c) => !cod2022.includes(c)),
    [NOVO],
    'a única diferença entre as malhas é o município instalado em 2025',
  );
  assert.equal(
    cod2022.filter((c) => !cod2025.includes(c)).length,
    0,
    'nenhum município da malha de 2022 pode sumir em 2025 (extinção não é modelada — ver db/66)',
  );

  // A vigência é da INSTALAÇÃO: na véspera ele ainda não existe.
  const vespera = await em('2024-12-31');
  assert.equal(vespera.length, 141, 'em 2024-12-31 a malha ainda é de 141');
});

test('(b) DataInstalacao NULL é vigente sempre — sem esse ramo a malha colapsa', async () => {
  // NULL = "existe desde sempre no horizonte da base", não "data desconhecida".
  const n = await pool.query(
    `SELECT count(*) FILTER (WHERE "Municipio_DataInstalacao" IS NULL)::int AS nulos,
            count(*)::int AS total FROM "Municipio"`,
  );
  assert.equal(n.rows[0].nulos, 141, '141 municípios sem DataInstalacao (existem desde sempre)');
  assert.equal(n.rows[0].total, 142);

  // Data absurdamente antiga: os 141 de DataInstalacao NULL seguem vigentes.
  const antiga = await pool.query(
    `SELECT count(*)::int AS n FROM "MunicipiosVigentesEm"($1::date)`,
    ['1900-01-01'],
  );
  assert.equal(antiga.rows[0].n, 141, 'DataInstalacao NULL deve ser vigente em QUALQUER data');

  // CATRACA: sem o ramo do NULL o predicado devolve 0 em 2022 e 1 em 2025,
  // em vez de 141 e 142 — erro catastrófico e SILENCIOSO. Este assert existe
  // para que a diferença apareça se alguém "simplificar" a função do db/66.
  for (const [ref, esperado] of [
    [REF_2022, 0],
    [REF_2025, 1],
  ]) {
    const ingenuo = await pool.query(
      `SELECT count(*)::int AS n FROM "Municipio" WHERE "Municipio_DataInstalacao" <= $1::date`,
      [ref],
    );
    assert.equal(
      ingenuo.rows[0].n,
      esperado,
      `predicado sem o ramo NULL colapsaria a malha para ${esperado} em ${ref}`,
    );
  }
});

test('(c) motor: município não instalado na referência NÃO é dado ausente (RN-005)', async () => {
  const r = await svc.ranking({ indicadorId, referencia: REF_2022 });

  assert.ok(
    !r.ausentes.codigos.includes(NOVO),
    `${NOVO} não existia em ${REF_2022}: fora do universo NÃO é ausência de dado (RN-005)`,
  );
  assert.ok(
    !r.municipios.some((m) => m.codigo_ibge.trim() === NOVO),
    'município fora do universo também não pode aparecer COM valor',
  );
  assert.equal(
    r.ausentes.total,
    0,
    'cobertura completa da malha de 2022 ⇒ nenhum ausente (antes da E21 o motor acusava 1)',
  );
  assert.equal(r.municipios.length, 141, 'os 141 municípios de 2022, todos com dado');
});

test('(d) total_municipios usa o universo DA DATA, não 142 fixo', async () => {
  const r = await svc.ranking({ indicadorId, referencia: REF_2022 });

  // Expectativa recomputada por SELECT independente (padrão ranking.unit.mjs),
  // nunca herdada da própria função sob teste.
  const esperado = await pool.query(
    `SELECT count(*)::int AS n FROM "Municipio"
      WHERE "Municipio_DataInstalacao" IS NULL
         OR "Municipio_DataInstalacao" <= $1::date`,
    [REF_2022],
  );
  assert.equal(r.total_municipios, esperado.rows[0].n, 'universo do ranking = malha vigente na referência');
  assert.equal(r.total_municipios, 141, 'em 2022 o universo é 141, não 142');

  // A malha inteira (142) NÃO é mais o universo — catraca que impede a
  // regressão silenciosa de volta a `SELECT ... FROM "Municipio"`.
  const todos = await pool.query(`SELECT count(*)::int AS n FROM "Municipio"`);
  assert.equal(todos.rows[0].n, 142);
  assert.notEqual(
    r.total_municipios,
    todos.rows[0].n,
    'ranking com referência 2022 não pode usar a malha inteira',
  );

  // O coroplético parte do MESMO universo (coerência declarada em paresRecalculo).
  const mapa = await svc.mapa({ indicadorId, referencia: REF_2022 });
  assert.ok(
    !mapa.municipios.some((m) => m.codigo_ibge.trim() === NOVO),
    'o coroplético não pode listar município fora do universo da referência',
  );

  // O OUTRO LADO DA MESMA REGRA: em 2025 o município EXISTE e não tem dado —
  // aí ele é ausência legítima. A E21 não o esconde, o coloca no tempo certo.
  const r2025 = await svc.ranking({ indicadorId, referencia: REF_2025 });
  assert.equal(r2025.total_municipios, 142, 'em 2025 o universo passa a ser 142');
  assert.ok(
    r2025.ausentes.codigos.includes(NOVO),
    `${NOVO} existe em ${REF_2025} e não tem dado: aí sim é ausência (RN-005)`,
  );
  assert.equal(r2025.ausentes.total, 1, 'exatamente um ausente em 2025: o município novo');
});

test('(e) menor privilégio: PUBLIC não executa a função; itmt_app executa', async () => {
  const r = await pool.query(
    `SELECT has_function_privilege('itmt_app', p.oid, 'EXECUTE') AS app,
            has_function_privilege('public',   p.oid, 'EXECUTE') AS pub
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'MunicipiosVigentesEm' AND n.nspname = 'public'`,
  );
  assert.equal(r.rows.length, 1, 'a função do db/66 deve existir em public');
  assert.equal(r.rows[0].app, true, 'itmt_app precisa executar (a API roda como itmt_app)');
  assert.equal(r.rows[0].pub, false, 'PUBLIC não pode executar (REVOKE do db/66)');
});
