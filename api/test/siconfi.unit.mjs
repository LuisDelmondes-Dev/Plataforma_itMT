// ============================================================
// siconfi.unit.mjs — Gauntlet P9 (CONTRATO-GENERICO · caso #3 — finanças).
//
// PADRÃO: banco-direto, como causas.unit.mjs — node:test + pg.Pool no
// DATABASE_URL de um banco DESCARTÁVEL migrado (db/01..53), instanciando o
// serviço COMPILADO de dist/. NUNCA aponte para o banco dev.
//
// O dado sob teste é REAL (db/53: API SICONFI/Tesouro Nacional, DCA Anexo
// I-D, "Total Geral da Despesa" × "Despesas Empenhadas", exercícios
// 2022–2024, coletado em 27/08/2026). O indicador nasce EM_ANALISE (RG-09);
// o primeiro teste PROVA a recusa do motor antes do parecer e então SIMULA
// a aprovação humana NO BANCO DESCARTÁVEL — em produção esse ato é do
// curador, jamais deste teste.
//
// PONTO DO P9: nenhuma linha do motor conhece "finanças". O mesmo
// consultar/serie/ranking que serve saúde e educação serve a DCA — a área
// vem do catálogo (tema "Economia — Setor Público" → subtema "Execução
// orçamentária"), nunca de `if` por domínio.
//
// SEMÂNTICA DE AUSÊNCIA — DIFERENTE do caso SIM (db/50): a DCA é dado
// DECLARATÓRIO. Município sem entrega não "gastou zero": o dado NÃO EXISTE.
// db/53 não materializa zero nenhum; ausência = sem linha ⇒ 404 com
// contexto, `ausentes` no ranking, fora do agregado estadual.
//
// VALORES DE ORIGEM (hardcoded de propósito — conferidos na API em
// 27/08/2026, GET .../tt/dca?an_exercicio=A&no_anexo=DCA-Anexo I-D&id_ente=C,
// item cod_conta='TotalDespesas' e coluna='Despesas Empenhadas'):
// ver a constante ORIGEM abaixo.
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { IndicadoresService } from '../dist/indicadores/indicadores.service.js';
import { TerritorioService } from '../dist/territorio/territorio.service.js';
import { AuditoriaService } from '../dist/auditoria/auditoria.service.js';

const NOME = 'Despesas orçamentárias empenhadas';
const REF = '2024-12-31';
const ANOS = [2022, 2023, 2024];

// Conferidos na origem em 27/08/2026 (ver cabeçalho): coleta + re-fetch
// independente no mesmo dia, valores idênticos nas duas leituras. R$ correntes.
const ORIGEM = {
  '5103403': { nome: 'Cuiabá', 2022: 3827503777.88, 2023: 4233324461.19, 2024: 4306949073.62 },
  '5107909': { nome: 'Sinop', 2022: 856149193.49, 2023: 1036373258.95, 2024: 1164569503.67 },
  '5102504': { nome: 'Cáceres', 2022: 377209510.68, 2023: 438136155.49, 2024: 458793994.71 },
};

let pool;
let svc;
let id; // Indicador_Id

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

  const r = await pool.query(
    `SELECT "Indicador_Id" AS id FROM "Indicador" WHERE "Indicador_Nome"=$1`,
    [NOME],
  );
  assert.equal(r.rows.length, 1, 'db/53 deveria ter criado o indicador');
  id = r.rows[0].id;
});

after(async () => {
  await pool.end();
});

/** Réplica manual da regra "observação vigente ≤ referência" por município. */
async function vigentes(ref = REF) {
  const r = await pool.query(
    `SELECT DISTINCT ON (o."Observacao_CodigoIbge")
            o."Observacao_CodigoIbge" AS codigo, o."Observacao_Valor"::float AS valor,
            o."Observacao_DataReferencia"::text AS referencia
       FROM "Observacao" o
      WHERE o."Observacao_IndicadorId" = $1 AND o."Observacao_DataReferencia" <= $2::date
      ORDER BY o."Observacao_CodigoIbge", o."Observacao_DataReferencia" DESC`,
    [id, ref],
  );
  return r.rows;
}

test('RG-09: nasce EM_ANALISE, o motor recusa antes do parecer — e só então simulamos a aprovação', async () => {
  const st = await pool.query(
    `SELECT "Indicador_StatusValidacao" AS s FROM "Indicador" WHERE "Indicador_Id"=$1`,
    [id],
  );
  assert.equal(st.rows[0].s, 'EM_ANALISE', 'db/53 deve criar o indicador EM_ANALISE, nunca APROVADO');
  await assert.rejects(
    svc.consultar({ indicadorId: id, recorte: 'ESTADO', codigo: null, dataReferencia: REF }),
    (e) => (typeof e?.getStatus === 'function' ? e.getStatus() : e?.status) === 404,
    'motor deveria filtrar indicador não-APROVADO até por id direto',
  );
  // Simulação do gate humano (RG-09) no banco descartável — ver cabeçalho.
  await pool.query(
    `UPDATE "Indicador" SET "Indicador_StatusValidacao"='APROVADO' WHERE "Indicador_Id"=$1`,
    [id],
  );
});

test('catálogo: subtema "Execução orçamentária" no tema "Economia — Setor Público", unidade R$, SOMA', async () => {
  const r = await pool.query(
    `SELECT t."TemaConsulta_Nome" AS tema, s."SubtemaConsulta_Nome" AS subtema,
            i."Indicador_Unidade" AS unidade, i."Indicador_TipoAgregacao" AS agregacao
       FROM "Indicador" i
       JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_Id"=i."Indicador_SubtemaId"
       JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
      WHERE i."Indicador_Id"=$1`,
    [id],
  );
  assert.deepEqual(r.rows[0], {
    tema: 'Economia — Setor Público',
    subtema: 'Execução orçamentária',
    unidade: 'R$',
    agregacao: 'SOMA',
  });
});

test('cobertura sobre a malha INTEIRA: 419 observações, nenhum valor 0 materializado', async () => {
  // Este assert já foi `39`, e o 39 era um DEFEITO cristalizado pela catraca.
  // O db/53 é malha-relativo e roda ANTES do db/57, que instala os 142
  // municípios: numa instalação limpa o JOIN encontrava 13 municípios e
  // descartava 380 das 419 linhas, em silêncio. O db/50 escapava porque o
  // db/57 o re-semeia; o SICONFI não tinha seção equivalente — agora tem, no
  // db/67, com checagem de contagem que falha alto.
  //
  // 419 = 140 (2022) + 140 (2023) + 139 (2024): nem todo município entregou a
  // DCA em todo exercício, e a ausência de entrega NUNCA vira zero (dado
  // declaratório, RN-005) — por isso `zeros` continua tendo que ser 0.
  const n = await pool.query(
    `SELECT count(*)::int AS n,
            count(*) FILTER (WHERE "Observacao_Valor"=0)::int AS zeros,
            count(DISTINCT "Observacao_CodigoIbge")::int AS municipios
       FROM "Observacao" WHERE "Observacao_IndicadorId"=$1`,
    [id],
  );
  assert.equal(n.rows[0].n, 419, 'malha inteira × 3 exercícios, descontadas as não-entregas');
  assert.equal(n.rows[0].zeros, 0, 'db/53 não pode materializar zero (≠ caso SIM/db/50)');
  assert.equal(n.rows[0].municipios, 141, 'os 141 municípios instalados — 5101837 só existe a partir de 2025');
});

test('3 municípios batem com o valor bruto conferido na origem (API SICONFI, 27/08/2026)', async () => {
  for (const [codigo, esperado] of Object.entries(ORIGEM)) {
    for (const ano of ANOS) {
      const r = await svc.consultar({
        indicadorId: id, recorte: 'MUNICIPIO', codigo, dataReferencia: `${ano}-12-31`,
      });
      assert.equal(
        r.valor,
        Number(esperado[ano].toFixed(2)),
        `${esperado.nome}/${ano}: motor ≠ valor bruto da DCA na origem`,
      );
      assert.equal(r.unidade, 'R$');
      assert.ok(r.procedencia.length >= 1, `${esperado.nome}/${ano}: sem procedência`);
      for (const p of r.procedencia)
        for (const chave of ['fonte', 'url', 'data_referencia', 'data_extracao', 'licenca', 'hash'])
          assert.ok(chave in p, `${esperado.nome}/${ano}: procedência sem "${chave}"`);
    }
  }
});

test('total estadual por exercício = Σ municípios recomputada por SQL (motor × SQL)', async () => {
  for (const ano of ANOS) {
    const ref = `${ano}-12-31`;
    const linhas = await vigentes(ref);
    // CONTAGEM relativa de propósito: um literal aqui foi o que cristalizou o
    // SICONFI truncado em 39 observações por quase uma semana.
    assert.ok(linhas.length > 100, `${ano}: cobertura suspeita — ${linhas.length} municípios vigentes`);

    // Sobre a malha inteira, herança entre exercícios PASSA a existir e é
    // legítima numa consulta pontual: quem não entregou a DCA de 2023 tem,
    // como dado mais recente conhecido em 31/12/2023, o exercício de 2022.
    // (Com a malha de 13 do teste antigo isso nunca acontecia, porque todos
    // os 13 declaravam todo ano.) O que NÃO pode acontecer é vigência do
    // FUTURO — isso seria o motor lendo à frente da referência pedida.
    for (const l of linhas) {
      assert.ok(l.referencia <= ref,
        `${l.codigo}: vigência ${l.referencia} é POSTERIOR à referência ${ref}`);
    }
    const soma = linhas.reduce((s, x) => s + x.valor, 0);
    const estado = await svc.consultar({ indicadorId: id, recorte: 'ESTADO', codigo: null, dataReferencia: ref });
    assert.equal(estado.valor, Number(soma.toFixed(2)), `${ano}: Σ do motor ≠ Σ SQL`);
    assert.equal(estado.agregacao, 'SOMA');
    assert.equal(estado.municipios_agregados, linhas.length,
      `${ano}: o agregado tem que contar exatamente os municípios vigentes`);
  }
});

test('serie() estadual deriva os 3 exercícios e cada ponto = consulta pontual', async () => {
  const s = await svc.serie({ indicadorId: id, recorte: 'ESTADO', codigo: null });
  assert.deepEqual(s.pontos.map((p) => p.ano), ANOS, 'db/53 cobre 2022–2024');
  for (const p of s.pontos) {
    const v = await svc.consultar({
      indicadorId: id, recorte: 'ESTADO', codigo: null, dataReferencia: `${p.ano}-12-31`,
    });
    assert.equal(p.valor, v.valor, `${p.ano}: ponto da série ≠ consulta pontual`);
  }
});

test('ranking (P2) funciona no indicador de finanças sem código especial por área', async () => {
  const r = await svc.ranking({ indicadorId: id, referencia: REF });
  assert.equal(r.agregacao, 'SOMA');
  assert.equal(r.total_municipios, r.municipios.length + r.ausentes.total);
  // Contagem relativa: o ranking usa vigência ≤ referência, então entra
  // também quem declarou num exercício anterior. O invariante que importa é o
  // da linha acima (ranqueados + ausentes = total); aqui basta exigir
  // cobertura real, sem literal que a próxima carga invalide.
  assert.ok(r.municipios.length > 100,
    `cobertura suspeita no ranking: ${r.municipios.length} municípios`);

  // ordem decrescente + competition ranking
  for (let i = 1; i < r.municipios.length; i++) {
    assert.ok(r.municipios[i - 1].valor >= r.municipios[i].valor, 'ranking fora de ordem');
    assert.ok(r.municipios[i].posicao >= r.municipios[i - 1].posicao);
  }

  // valor de cada linha = observação vigente do PRÓPRIO município (SQL)
  const porCodigo = new Map((await vigentes()).map((v) => [v.codigo, v]));
  for (const m of r.municipios) {
    const v = porCodigo.get(m.codigo_ibge);
    assert.ok(v, `${m.nome} ranqueado sem observação vigente`);
    assert.equal(m.valor, Number(v.valor.toFixed(2)));
    assert.ok(m.procedencia.length >= 1, `${m.nome}: sem procedência`);
  }

  // SOMA: total estadual = rollup do motor; média = total ÷ agregados
  const estado = await svc.consultar({ indicadorId: id, recorte: 'ESTADO', codigo: null, dataReferencia: REF });
  assert.equal(r.total_estadual, estado.valor);
  assert.equal(r.media_estadual, Number((estado.valor / estado.municipios_agregados).toFixed(2)));
  for (const m of r.municipios)
    assert.equal(m.delta_media_estadual, Number((m.valor - r.media_estadual).toFixed(2)));
});

test('RN-005: município sem NENHUMA entrega ⇒ 404 com contexto, `ausentes` no ranking, fora do agregado — nunca zero', async () => {
  // Fixture: no banco de teste a malha só tem municípios grandes (todos
  // entregaram); reproduzimos a ausência REAL de entrega apagando as 3
  // linhas de um município — exatamente o estado em que db/53 deixa um
  // município que nunca declarou a DCA (sem linha alguma; ver ausências
  // reais no cabeçalho de db/53).
  const CACERES = '5102504';
  const originais = await pool.query(
    `SELECT "Observacao_DataReferencia"::text AS ref, "Observacao_Valor" AS valor,
            "Observacao_FonteId" AS fonte, "Observacao_CargaId" AS carga
       FROM "Observacao" WHERE "Observacao_IndicadorId"=$1 AND "Observacao_CodigoIbge"=$2`,
    [id, CACERES],
  );
  assert.equal(originais.rows.length, 3);
  await pool.query(
    `DELETE FROM "Observacao" WHERE "Observacao_IndicadorId"=$1 AND "Observacao_CodigoIbge"=$2`,
    [id, CACERES],
  );
  try {
    // municipal: 404 com contexto — nunca um número, nunca zero
    await assert.rejects(
      svc.consultar({ indicadorId: id, recorte: 'MUNICIPIO', codigo: CACERES, dataReferencia: REF }),
      (e) => (typeof e?.getStatus === 'function' ? e.getStatus() : e?.status) === 404,
      'ausência de entrega deveria ser 404, nunca zero',
    );
    // ranking: listado em ausentes
    const r = await svc.ranking({ indicadorId: id, referencia: REF });
    assert.ok(!r.municipios.some((m) => m.codigo_ibge === CACERES), 'ausente não pode ser ranqueado');
    assert.ok(r.ausentes.codigos.includes(CACERES), 'ausente deveria constar em `ausentes`');
    assert.equal(r.total_municipios, r.municipios.length + r.ausentes.total);
    // estadual: soma só quem declarou
    const linhas = await vigentes();
    const soma = linhas.reduce((s, x) => s + x.valor, 0);
    const estado = await svc.consultar({ indicadorId: id, recorte: 'ESTADO', codigo: null, dataReferencia: REF });
    assert.equal(estado.valor, Number(soma.toFixed(2)));
    // Relativo, não absoluto: o número exato depende da malha, e um literal
    // aqui foi justamente o que cristalizou o defeito do SICONFI truncado.
    // O que o teste precisa afirmar é a REGRA — o agregado conta exatamente
    // quem declarou, nem um a mais.
    assert.equal(estado.municipios_agregados, linhas.length,
      'agregado deveria contar exatamente os municípios que declararam, excluindo o ausente');
  } finally {
    for (const o of originais.rows)
      await pool.query(
        `INSERT INTO "Observacao"
           ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
         VALUES ($1,$2,$3::date,$4,$5,$6)`,
        [id, CACERES, o.ref, o.valor, o.fonte, o.carga],
      );
  }
});

test('determinismo: 2 chamadas idênticas ⇒ JSON idêntico (consultar, serie e ranking)', async () => {
  const c1 = JSON.stringify(await svc.consultar({ indicadorId: id, recorte: 'ESTADO', codigo: null, dataReferencia: REF }));
  const c2 = JSON.stringify(await svc.consultar({ indicadorId: id, recorte: 'ESTADO', codigo: null, dataReferencia: REF }));
  assert.equal(c1, c2, 'consultar divergiu entre chamadas idênticas');
  const s1 = JSON.stringify(await svc.serie({ indicadorId: id, recorte: 'ESTADO', codigo: null }));
  const s2 = JSON.stringify(await svc.serie({ indicadorId: id, recorte: 'ESTADO', codigo: null }));
  assert.equal(s1, s2, 'serie divergiu entre chamadas idênticas');
  const r1 = JSON.stringify(await svc.ranking({ indicadorId: id, referencia: REF }));
  const r2 = JSON.stringify(await svc.ranking({ indicadorId: id, referencia: REF }));
  assert.equal(r1, r2, 'ranking divergiu entre chamadas idênticas');
});

test('linhagem: toda observação aponta para uma Carga PROMOVIDA da fonte SICONFI com hash real', async () => {
  const r = await pool.query(
    `SELECT count(*)::int AS sem_linhagem
       FROM "Observacao" o
       LEFT JOIN "Carga" c ON c."Carga_Id"=o."Observacao_CargaId"
        AND c."Carga_Status"='PROMOVIDA' AND length(c."Carga_HashSha256")=64
       LEFT JOIN "Fonte" f ON f."Fonte_Id"=o."Observacao_FonteId"
        AND f."Fonte_Nome" LIKE 'SICONFI/Tesouro Nacional%'
      WHERE o."Observacao_IndicadorId"=$1 AND (c."Carga_Id" IS NULL OR f."Fonte_Id" IS NULL)`,
    [id],
  );
  assert.equal(r.rows[0].sem_linhagem, 0, 'observação sem linhagem Bronze auditável');
});
