// ============================================================
// ranking.unit.mjs — Gauntlet P2 (MOTOR-RANKING).
//
// PADRÃO ESCOLHIDO (documentado): banco-direto, como
// least-privilege.unit.mjs — node:test + pg.Pool no DATABASE_URL do banco
// de teste, instanciando o serviço COMPILADO de dist/ com um adaptador
// fino de banco (mesma superfície que o serviço usa do DatabaseService).
// Sem HTTP: o alvo é o contrato determinístico do motor, e as expectativas
// são recomputadas por SELECT manual independente — nunca hardcoded.
//
// Pré-requisitos: `npm run build` (o runner oficial builda antes) e
// DATABASE_URL de um banco DESCARTÁVEL migrado. NUNCA o banco dev `itmt`.
//
// Invariantes cobertas:
//   (a) ordem desc + posições batem com SELECT manual;
//   (b) determinismo: 3 chamadas idênticas ⇒ JSON idêntico;
//   (c) RECALCULO: município sem uma das parcelas fica em `ausentes` (RN-005);
//   (d) delta_media_estadual = valor − média estadual do MESMO motor;
//   (e) empates: competition ranking (1,2,2,4) nas duas pontas;
//   (+) NAO_AGREGAVEL: ranking válido com media_estadual null e motivo;
//   (+) indicador sem observação: NotFound com contexto (RN-005);
//   (+) trilha: CONSULTA_RANKING gravada na cadeia imutável;
//   (+) exportação (P5 rodada 2): linha CSV de RECALCULO derivada do ranking
//       — função pura, sem banco.
//
// Referência fixa em 2025-12-31: isola o teste do seed demonstrativo
// (db/02) das cargas reais 2026 aplicadas por db/42+.
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { IndicadoresService } from '../dist/indicadores/indicadores.service.js';
import { TerritorioService } from '../dist/territorio/territorio.service.js';
import { AuditoriaService } from '../dist/auditoria/auditoria.service.js';
import { linhaDeRanking } from '../dist/indicadores/exportacao.controller.js';

const REF = '2025-12-31';
const QUINTETO = ['fonte', 'url', 'data_referencia', 'data_extracao', 'licenca', 'hash'];

let pool;
let svc;

before(() => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  // Adaptador com a mesma superfície que os serviços usam do DatabaseService.
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
  const agentes = { garantirParaIndicador: async () => false }; // ranking não vai à internet
  svc = new IndicadoresService(db, territorio, auditoria, agentes);
});

after(async () => {
  await pool.end();
});

/** Réplica manual e independente da regra "observação vigente ≤ referência". */
async function vigentes(indicadorId) {
  const r = await pool.query(
    `SELECT DISTINCT ON (o."Observacao_CodigoIbge")
            o."Observacao_CodigoIbge" AS codigo,
            o."Observacao_Valor"::float AS valor,
            m."Municipio_Nome" AS nome
       FROM "Observacao" o
       JOIN "Municipio" m ON m."Municipio_CodigoIbge" = o."Observacao_CodigoIbge"
      WHERE o."Observacao_IndicadorId" = $1
        AND o."Observacao_DataReferencia" <= $2::date
      ORDER BY o."Observacao_CodigoIbge", o."Observacao_DataReferencia" DESC`,
    [indicadorId, REF],
  );
  return r.rows;
}

async function todosMunicipios() {
  const r = await pool.query(`SELECT "Municipio_CodigoIbge" AS c FROM "Municipio"`);
  return r.rows.map((x) => x.c);
}

/** Recomputo genérico de competition ranking sobre a resposta do serviço. */
function conferirPosicoesENFlags(ranking, n) {
  for (const m of ranking.municipios) {
    const maiores = ranking.municipios.filter((x) => x.valor > m.valor).length;
    const menores = ranking.municipios.filter((x) => x.valor < m.valor).length;
    assert.equal(m.posicao, maiores + 1, `posição de ${m.nome} fora do competition ranking`);
    assert.equal(m.top_n, maiores + 1 <= n, `top_n de ${m.nome}`);
    assert.equal(m.bottom_n, menores + 1 <= n, `bottom_n de ${m.nome}`);
  }
}

test('(a) SOMA: ordena desc, posições batem com SELECT manual, procedência completa', async () => {
  const r = await svc.ranking({ indicadorId: 1, referencia: REF });
  assert.equal(r.agregacao, 'SOMA');
  assert.equal(r.referencia, REF);

  // ordem esperada recomputada de forma independente
  const esperado = (await vigentes(1)).sort(
    (x, y) => y.valor - x.valor || (x.nome < y.nome ? -1 : 1),
  );
  assert.ok(esperado.length >= 12, 'seed deveria ter ≥ 12 municípios com leitos');
  assert.deepEqual(
    r.municipios.map((m) => m.codigo_ibge),
    esperado.map((e) => e.codigo),
    'ordem do ranking diverge do SELECT manual',
  );
  for (let i = 1; i < r.municipios.length; i++)
    assert.ok(r.municipios[i].valor <= r.municipios[i - 1].valor, 'ordem não é decrescente');
  conferirPosicoesENFlags(r, 5); // n default = 5

  // RN-005: ausentes = municípios do recorte sem dado, nunca zero no ranking
  const comDado = new Set(esperado.map((e) => e.codigo));
  const ausentesEsperados = (await todosMunicipios()).filter((c) => !comDado.has(c)).sort();
  assert.deepEqual(r.ausentes.codigos, ausentesEsperados);
  assert.equal(r.ausentes.total, ausentesEsperados.length);
  assert.equal(r.total_municipios, r.municipios.length + r.ausentes.total);

  // quinteto de procedência (§12.1) por linha
  for (const m of r.municipios) {
    assert.ok(Array.isArray(m.procedencia) && m.procedencia.length >= 1, `sem procedência: ${m.nome}`);
    for (const p of m.procedencia)
      for (const chave of QUINTETO) assert.ok(chave in p, `procedência de ${m.nome} sem "${chave}"`);
  }
});

test('(b) determinismo: 3 chamadas idênticas ⇒ JSON idêntico', async () => {
  const chamadas = [];
  for (let i = 0; i < 3; i++)
    chamadas.push(JSON.stringify(await svc.ranking({ indicadorId: 1, referencia: REF, n: 3 })));
  assert.equal(chamadas[0], chamadas[1], 'chamada 2 divergiu da 1');
  assert.equal(chamadas[1], chamadas[2], 'chamada 3 divergiu da 2');
});

test('(d) delta_media_estadual = valor − média estadual calculada pelo MESMO motor', async () => {
  // SOMA: rollup estadual do motor é um total ⇒ média = total ÷ agregados
  const r1 = await svc.ranking({ indicadorId: 1, referencia: REF });
  const est1 = await svc.consultar({
    indicadorId: 1, recorte: 'ESTADO', codigo: null, dataReferencia: REF,
  });
  assert.equal(
    r1.media_estadual,
    Number((est1.valor / est1.municipios_agregados).toFixed(2)),
    'média (SOMA) não deriva do rollup estadual do motor',
  );
  // Crítico P2/rodada 1: contagem (SOMA) expõe o total do estado ("X de Y").
  assert.equal(r1.total_estadual, est1.valor, 'total_estadual (SOMA) ≠ rollup do motor');
  // conferência manual independente da média aritmética
  const manual = await vigentes(1);
  assert.equal(
    r1.media_estadual,
    Number((manual.reduce((s, x) => s + x.valor, 0) / manual.length).toFixed(2)),
  );
  for (const m of r1.municipios)
    assert.equal(m.delta_media_estadual, Number((m.valor - r1.media_estadual).toFixed(2)));

  // RECALCULO: o valor estadual do motor (Σnum/Σden×100) JÁ é a média
  const r8 = await svc.ranking({ indicadorId: 8, referencia: REF });
  const est8 = await svc.consultar({
    indicadorId: 8, recorte: 'ESTADO', codigo: null, dataReferencia: REF,
  });
  assert.equal(r8.agregacao, 'RECALCULO');
  assert.equal(r8.media_estadual, est8.valor, 'média (RECALCULO) ≠ rollup estadual do motor');
  assert.equal(r8.total_estadual, null, 'RECALCULO não tem total estadual (o rollup é a média)');
  for (const m of r8.municipios)
    assert.equal(m.delta_media_estadual, Number((m.valor - r8.media_estadual).toFixed(2)));
});

test('(e) empates: competition ranking 1,2,2,4 nas duas pontas, exibição por nome', async () => {
  // dois municípios sintéticos empatados com Barra do Garças (44 leitos no seed).
  // E4 (db/57): os fixtures apontam para a RGI OFICIAL 510001 — as RGIs
  // ilustrativas do seed (5101xx) foram removidas pela malha canônica.
  await pool.query(
    `INSERT INTO "Municipio"
       ("Municipio_CodigoIbge","Municipio_Nome","Municipio_CodigoRgi","Municipio_CodigoRgint")
     VALUES ('5199001','Zz Empate A','510001','5101'),
            ('5199002','Zz Empate B','510001','5101')
     ON CONFLICT DO NOTHING`,
  );
  await pool.query(
    `INSERT INTO "Observacao"
       ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia",
        "Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
     VALUES (1,'5199001',$1::date,44,1,1),(1,'5199002',$1::date,44,1,1)
     ON CONFLICT DO NOTHING`,
    [REF],
  );

  const r = await svc.ranking({ indicadorId: 1, referencia: REF });
  const empatados = r.municipios.filter((m) => m.valor === 44);
  assert.equal(empatados.length, 3, 'esperava empate triplo em 44');

  // mesma posição para todos, exibidos em ordem de nome
  const posicoes = new Set(empatados.map((m) => m.posicao));
  assert.equal(posicoes.size, 1, 'empate deve compartilhar a MESMA posição');
  assert.deepEqual(
    empatados.map((m) => m.nome),
    ['Barra do Garças', 'Zz Empate A', 'Zz Empate B'],
    'desempate de exibição deve ser por nome',
  );

  // competition ranking: o valor seguinte pula as posições consumidas
  const posEmpate = [...posicoes][0];
  const primeiroApos = r.municipios.find((m) => m.valor < 44);
  assert.equal(primeiroApos.posicao, posEmpate + 3, 'posição após empate triplo deve saltar 3');

  // recomputo genérico (vale também para bottom_n com empate)
  conferirPosicoesENFlags(r, 5);
});

test('(c) RECALCULO: município sem uma das parcelas fica em ausentes, nunca no ranking', async () => {
  // município sintético com SÓ o numerador (doses, ind. 5); sem população-alvo (ind. 6)
  await pool.query(
    `INSERT INTO "Municipio"
       ("Municipio_CodigoIbge","Municipio_Nome","Municipio_CodigoRgi","Municipio_CodigoRgint")
     VALUES ('5199003','Zz Sem Denominador','510001','5101')
     ON CONFLICT DO NOTHING`,
  );
  await pool.query(
    `INSERT INTO "Observacao"
       ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia",
        "Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
     VALUES (5,'5199003',$1::date,1000,1,1)
     ON CONFLICT DO NOTHING`,
    [REF],
  );

  const r = await svc.ranking({ indicadorId: 8, referencia: REF });
  assert.ok(
    !r.municipios.some((m) => m.codigo_ibge === '5199003'),
    'município sem denominador NÃO pode entrar no ranking (RN-005)',
  );
  assert.ok(r.ausentes.codigos.includes('5199003'), 'município sem parcela deve constar em ausentes');

  // quem tem AMBAS as parcelas (e só quem tem) está ranqueado, com o valor recalculado
  const num = await vigentes(5);
  const den = await vigentes(6);
  const denPor = new Map(den.map((d) => [d.codigo, d.valor]));
  const completos = num.filter((x) => denPor.has(x.codigo) && denPor.get(x.codigo) !== 0);
  assert.equal(r.municipios.length, completos.length);
  for (const m of r.municipios) {
    const nu = completos.find((x) => x.codigo === m.codigo_ibge);
    assert.ok(nu, `${m.nome} ranqueado sem ter ambas as parcelas`);
    assert.equal(
      m.valor,
      Number(((nu.valor / denPor.get(nu.codigo)) * 100).toFixed(1)),
      `taxa de ${m.nome} não bate com (num/den)*100 do próprio município`,
    );
  }
  assert.equal(r.total_municipios, r.municipios.length + r.ausentes.total);
});

test('NAO_AGREGAVEL: ranking municipal válido, media_estadual null com motivo (RN-003)', async () => {
  const ind = await pool.query(
    `INSERT INTO "Indicador"
       ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade",
        "Indicador_TipoAgregacao","Indicador_StatusValidacao")
     VALUES (5,'Zz Índice NA (teste P2)','pts','NAO_AGREGAVEL','APROVADO')
     RETURNING "Indicador_Id" AS id`,
  );
  const id = ind.rows[0].id;
  await pool.query(
    `INSERT INTO "Observacao"
       ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia",
        "Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
     VALUES ($2,'5103403',$1::date,30,1,1),($2,'5107909',$1::date,50,1,1),($2,'5107602',$1::date,50,1,1)`,
    [REF, id],
  );

  const r = await svc.ranking({ indicadorId: id, referencia: REF });
  assert.equal(r.agregacao, 'NAO_AGREGAVEL');
  assert.equal(r.media_estadual, null);
  assert.ok(r.media_estadual_motivo?.includes('NAO_AGREGAVEL'), 'motivo da média ausente');
  assert.equal(r.municipios.length, 3);
  // empate no topo: 1,1,3 — e delta null em todas as linhas
  assert.deepEqual(r.municipios.map((m) => m.posicao), [1, 1, 3]);
  assert.ok(r.municipios.every((m) => m.delta_media_estadual === null));
});

test('indicador aprovado sem NENHUMA observação: NotFound com contexto (RN-005)', async () => {
  const ind = await pool.query(
    `INSERT INTO "Indicador"
       ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade",
        "Indicador_TipoAgregacao","Indicador_StatusValidacao")
     VALUES (5,'Zz Vazio (teste P2)','x','SOMA','APROVADO')
     RETURNING "Indicador_Id" AS id`,
  );
  await assert.rejects(
    svc.ranking({ indicadorId: ind.rows[0].id, referencia: REF }),
    (e) => (typeof e?.getStatus === 'function' ? e.getStatus() : e?.status) === 404
      && /Não há dado publicado/.test(e?.message),
    'ausência total deve propagar a NotFoundException de ausencia()',
  );
});

test('RG-09: indicador EM_ANALISE é 404 também no ranking', async () => {
  const ind = await pool.query(
    `INSERT INTO "Indicador"
       ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao")
     VALUES (5,'Zz Em Análise (teste P2)','x','SOMA')
     RETURNING "Indicador_Id" AS id`,
  );
  await assert.rejects(
    svc.ranking({ indicadorId: ind.rows[0].id, referencia: REF }),
    (e) => (typeof e?.getStatus === 'function' ? e.getStatus() : e?.status) === 404,
    'indicador sem parecer não existe para o público, nem por id direto',
  );
});

test('exportação (P5 rodada 2): linha CSV de RECALCULO deriva do ranking, pura', () => {
  // Taxa com DUAS parcelas (num/den) na procedência, vigências distintas:
  // data_referencia da linha = a mais recente; fontes/hashes declarados
  // juntos ("A + B"), nunca escolhidos em silêncio; posicao e delta ao final.
  const quinteto = (fonte, dataRef, hash) => ({
    fonte, url: null, data_referencia: dataRef,
    data_extracao: '2026-01-10', licenca: 'ODbL', hash,
  });
  const linha = linhaDeRanking(
    {
      posicao: 2, codigo_ibge: '5103403', nome: 'Cuiabá', valor: 11.6,
      delta_media_estadual: -0.9, top_n: true, bottom_n: false,
      procedencia: [
        quinteto('SIM/DataSUS', '2024-12-31', 'aaa'),
        quinteto('SINASC/DataSUS', '2023-12-31', 'bbb'),
      ],
    },
    'óbitos por mil nascidos vivos',
  );
  assert.deepEqual(linha, [
    'Cuiabá', '5103403', '11.6', 'óbitos por mil nascidos vivos', '2024-12-31',
    'SIM/DataSUS + SINASC/DataSUS', 'ODbL', '2026-01-10', 'aaa + bbb', '2', '-0.9',
  ]);

  // delta null (sem média estadual, RN-003) vira campo vazio — nunca zero.
  const semMedia = linhaDeRanking(
    {
      posicao: 1, codigo_ibge: '5100102', nome: 'Acorizal', valor: 3,
      delta_media_estadual: null, top_n: true, bottom_n: true,
      procedencia: [quinteto('F', '2023-12-31', 'h')],
    },
    'pts',
  );
  assert.equal(semMedia[10], '');
  assert.equal(semMedia[4], '2023-12-31');
});

test('P6 rodada 2: mapa() de RECALCULO = MESMO pareamento do ranking(), ausentes fora', async () => {
  // O bloco Território do dossiê contradizia o próprio ranking: mapa() lia
  // só observações diretas e voltava vazio para taxas. Agora ambos saem do
  // MESMO pareamento (paresRecalculo) — municípios e valores idênticos.
  const [mapa, ranking] = await Promise.all([
    svc.mapa({ indicadorId: 8, referencia: REF }),
    svc.ranking({ indicadorId: 8, referencia: REF }),
  ]);
  assert.equal(ranking.agregacao, 'RECALCULO');
  assert.ok(mapa.municipios.length > 0, 'mapa de taxa não pode mais voltar vazio');
  assert.equal(mapa.municipios.length, ranking.municipios.length,
    'mapa e ranking devem cobrir os MESMOS municípios');
  const rankingPor = new Map(ranking.municipios.map((m) => [m.codigo_ibge, m]));
  for (const m of mapa.municipios) {
    const r = rankingPor.get(m.codigo_ibge);
    assert.ok(r, `${m.codigo_ibge} no mapa sem estar no ranking`);
    assert.equal(m.valor, r.valor, `valor de ${m.codigo_ibge} diverge entre mapa e ranking`);
    // procedência reduzida honesta: a referência do par e a(s) fonte(s) declaradas
    assert.ok(/^\d{4}-\d{2}-\d{2}/.test(m.data_referencia), 'data_referencia da linha do mapa');
    assert.ok(m.fonte.length > 0, 'fonte da linha do mapa');
  }
  // RN-005 dos dois lados: ausente do ranking NÃO aparece no mapa (fica
  // "sem dado" na pintura) — inclui o município só-numerador do teste (c).
  const noMapa = new Set(mapa.municipios.map((m) => m.codigo_ibge));
  assert.ok(ranking.ausentes.codigos.includes('5199003'));
  for (const c of ranking.ausentes.codigos)
    assert.ok(!noMapa.has(c), `${c} está em ausentes do ranking mas apareceu no mapa`);
});

test('regressão P6: mapa() de SOMA segue lendo observações diretas vigentes', async () => {
  const mapa = await svc.mapa({ indicadorId: 1, referencia: REF });
  const esperado = await vigentes(1); // réplica manual independente
  assert.equal(mapa.municipios.length, esperado.length);
  const por = new Map(esperado.map((e) => [e.codigo, e.valor]));
  for (const m of mapa.municipios) {
    assert.equal(m.valor, por.get(m.codigo_ibge), `valor de ${m.codigo_ibge} no mapa SOMA`);
    assert.ok(m.data_referencia && m.fonte, 'linha do mapa SOMA sem procedência reduzida');
  }
});

test('trilha: CONSULTA_RANKING gravada na cadeia imutável', async () => {
  const contar = () =>
    pool
      .query(`SELECT count(*)::int AS n FROM "EventoAuditoria" WHERE "EventoAuditoria_Acao"='CONSULTA_RANKING'`)
      .then((r) => r.rows[0].n);
  const antes = await contar();
  await svc.ranking({ indicadorId: 1, referencia: REF });
  const depois = await contar();
  assert.ok(depois > antes, 'ranking executado sem evento CONSULTA_RANKING na trilha');
});
