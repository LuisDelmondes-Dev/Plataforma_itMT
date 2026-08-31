// ============================================================
// causas.unit.mjs — Gauntlet P3 (MOTOR-CAUSAS + dado real SIM/SINASC).
//
// PADRÃO: banco-direto, como ranking.unit.mjs — node:test + pg.Pool no
// DATABASE_URL de um banco DESCARTÁVEL migrado (db/01..50), instanciando o
// serviço COMPILADO de dist/. As expectativas são recomputadas por SELECT
// manual independente — nunca hardcoded. NUNCA aponte para o banco dev.
//
// O dado sob teste é REAL (db/50: TabNet/DATASUS, SIM inf10mt + SINASC nvmt,
// 2019–2024). Os três indicadores nascem EM_ANALISE (RG-09); o hook `before`
// SIMULA o parecer humano aprovando-os NO BANCO DESCARTÁVEL — em produção
// esse ato é do curador, jamais deste teste.
//
// Invariantes cobertas:
//   (a) taxa de mortalidade infantil estadual e de 3 municípios =
//       Σóbitos/Σnascidos × 1000 (FatorEscala do catálogo) recomputada por SQL;
//   (b) REGRESSÃO: cobertura vacinal (RECALCULO pré-existente) intacta ×100 —
//       o DEFAULT do "Indicador_FatorEscala" preserva o comportamento antigo;
//   (c) causas ≤ total do território; Σ participação ≈ 100; capítulo CID-10
//       esgota o total (todo óbito tem capítulo); no estado, as três
//       dimensões decompõem o MESMO total;
//   (d) sem causa → NotFound com contexto (RN-005), nos dois sabores:
//       indicador sem eixo de causas e território/referência sem vigência;
//   (e) determinismo: 2 chamadas idênticas ⇒ JSON idêntico;
//   (f) ranking (P2) funciona com a taxa real, na escala por mil;
//   (+) trilha: CONSULTA_CAUSAS gravada na cadeia imutável.
//
// RODADA 2 (guarda de mesma referência + zeros materializados do db/50 —
// veredito do crítico de dados: dado de EVENTO não pode herdar parcela de
// outro ano; ausência na tabulação estadual completa é ZERO real):
//   (g) ataque do crítico: sem a linha de óbitos 2024 de um município, a
//       taxa municipal responde NotFound "parcelas com referências
//       divergentes" (nunca um número) e o ranking o lista em `ausentes`;
//       o agregado estadual exclui o município ANTES de somar;
//   (h) óbitos 0 com nascidos > 0 ⇒ taxa 0.0 PRESENTE (melhor resultado);
//       nascidos 0 ⇒ denominador 0 ⇒ ausência com motivo, sem imputação;
//   (i) TMI estadual de CADA ano = Σóbitos/Σnascidos×1000 recomputada por
//       SQL sobre TODAS as linhas do ano (zeros incluídos), e Σóbitos do
//       motor = Σ SQL do ano (igualdade motor×SQL). E4 (db/57 — malha
//       completa dos 142 municípios): agora os TOTAIS OFICIAIS da fonte são
//       assertados em absoluto (Σóbitos 747/689/733/819/822/785; TMI
//       12,7/12,1/12,7/14,1/14,0/14,2), e os 211 zeros materializados do
//       db/50 são contados DIRETAMENTE — a prova que o crítico P3 apontou
//       como indireta em fixture.
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { IndicadoresService } from '../dist/indicadores/indicadores.service.js';
import { TerritorioService } from '../dist/territorio/territorio.service.js';
import { AuditoriaService } from '../dist/auditoria/auditoria.service.js';

const REF = '2024-12-31';
const NOMES = ['Óbitos infantis', 'Nascidos vivos', 'Taxa de mortalidade infantil'];
const TRES = ['5103403', '5107909', '5102504']; // Cuiabá, Sinop, Cáceres

let pool;
let svc;
let ids = {}; // nome -> id

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

  // Simulação do gate humano (RG-09) no banco descartável — ver cabeçalho.
  await pool.query(
    `UPDATE "Indicador" SET "Indicador_StatusValidacao"='APROVADO' WHERE "Indicador_Nome" = ANY($1)`,
    [NOMES],
  );
  const r = await pool.query(
    `SELECT "Indicador_Id" AS id, "Indicador_Nome" AS nome FROM "Indicador" WHERE "Indicador_Nome" = ANY($1)`,
    [NOMES],
  );
  for (const linha of r.rows) ids[linha.nome] = linha.id;
  assert.equal(Object.keys(ids).length, 3, 'db/50 deveria ter criado os 3 indicadores');
});

after(async () => {
  await pool.end();
});

/** Réplica manual da regra "observação vigente ≤ referência" por município. */
async function vigentes(indicadorId, ref = REF) {
  const r = await pool.query(
    `SELECT DISTINCT ON (o."Observacao_CodigoIbge")
            o."Observacao_CodigoIbge" AS codigo, o."Observacao_Valor"::float AS valor,
            o."Observacao_DataReferencia"::text AS referencia
       FROM "Observacao" o
      WHERE o."Observacao_IndicadorId" = $1 AND o."Observacao_DataReferencia" <= $2::date
      ORDER BY o."Observacao_CodigoIbge", o."Observacao_DataReferencia" DESC`,
    [indicadorId, ref],
  );
  return r.rows;
}

/**
 * Réplica manual do pareamento RECALCULO da rodada 2: município só entra com
 * AMBAS as parcelas vigentes NA MESMA referência (dado de EVENTO — óbitos de
 * um ano nunca dividem nascidos de outro).
 */
async function parcelasPareadas(ref = REF) {
  const num = await vigentes(ids['Óbitos infantis'], ref);
  const den = await vigentes(ids['Nascidos vivos'], ref);
  const denPor = new Map(den.map((d) => [d.codigo, d]));
  const pares = [];
  for (const nu of num) {
    const de = denPor.get(nu.codigo);
    if (!de || nu.referencia !== de.referencia) continue;
    pares.push({ codigo: nu.codigo, num: nu.valor, den: de.valor, referencia: nu.referencia });
  }
  return pares;
}

test('(a) taxa estadual = Σóbitos/Σnascidos × 1000 recomputada por SQL', async () => {
  const taxa = await svc.consultar({
    indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'ESTADO', codigo: null, dataReferencia: REF,
  });
  // Rodada 2: o agregado estadual só soma municípios com as DUAS parcelas
  // na MESMA referência (dado de evento) — a réplica manual pareia igual.
  const pares = await parcelasPareadas();
  const somaNum = pares.reduce((s, x) => s + x.num, 0);
  const somaDen = pares.reduce((s, x) => s + x.den, 0);
  assert.ok(somaNum > 0 && somaDen > 0, 'db/50 deveria ter carregado óbitos e nascidos');
  assert.equal(
    taxa.valor,
    Number(((somaNum / somaDen) * 1000).toFixed(1)),
    'taxa estadual não é Σnum/Σden × 1000 (FatorEscala do catálogo)',
  );
  assert.equal(taxa.unidade, 'por mil nascidos vivos');
  assert.equal(taxa.agregacao, 'RECALCULO');
  assert.ok(taxa.procedencia.length >= 1, 'taxa sem procedência');
});

test('(a) taxa de 3 municípios = óbitos/nascidos × 1000 do PRÓPRIO município', async () => {
  for (const codigo of TRES) {
    const taxa = await svc.consultar({
      indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'MUNICIPIO', codigo, dataReferencia: REF,
    });
    const nu = (await vigentes(ids['Óbitos infantis'])).find((x) => x.codigo === codigo);
    const de = (await vigentes(ids['Nascidos vivos'])).find((x) => x.codigo === codigo);
    assert.ok(nu && de, `município ${codigo} deveria ter as duas parcelas em db/50`);
    assert.equal(
      taxa.valor,
      Number(((nu.valor / de.valor) * 1000).toFixed(1)),
      `taxa de ${codigo} não bate com o recomputo manual`,
    );
  }
});

test('(b) REGRESSÃO: RECALCULO pré-existente (cobertura vacinal) intacto ×100', async () => {
  // Referência 2025-12-31: o seed demonstrativo (db/02) publica as parcelas
  // da cobertura vacinal em 2025 — mesma âncora do ranking.unit.mjs.
  const REF_SEED = '2025-12-31';
  const fator = await pool.query(
    `SELECT "Indicador_FatorEscala"::float AS f, "Indicador_NumeradorId" AS num, "Indicador_DenominadorId" AS den
       FROM "Indicador" WHERE "Indicador_Nome"='Cobertura vacinal — poliomielite'`,
  );
  assert.equal(fator.rows[0].f, 100, 'DEFAULT do FatorEscala deveria preservar 100');
  const id = (await pool.query(
    `SELECT "Indicador_Id" AS id FROM "Indicador" WHERE "Indicador_Nome"='Cobertura vacinal — poliomielite'`,
  )).rows[0].id;
  const cob = await svc.consultar({ indicadorId: id, recorte: 'ESTADO', codigo: null, dataReferencia: REF_SEED });
  const num = await vigentes(fator.rows[0].num, REF_SEED);
  const den = await vigentes(fator.rows[0].den, REF_SEED);
  const comDen = new Set(den.map((d) => d.codigo));
  const numOk = num.filter((n) => comDen.has(n.codigo));
  const denOk = den.filter((d) => numOk.some((n) => n.codigo === d.codigo));
  const esperado = Number(
    ((numOk.reduce((s, x) => s + x.valor, 0) / denOk.reduce((s, x) => s + x.valor, 0)) * 100).toFixed(1),
  );
  assert.equal(cob.valor, esperado, 'cobertura vacinal deixou de ser ×100 — regressão de escala');
});

test('(c) causas municipais: total por dimensão ≤ óbitos do município, Σ participação ≈ 100, capítulo esgota', async () => {
  for (const codigo of TRES) {
    const causas = await svc.causas({ indicadorId: ids['Óbitos infantis'], codigo, referencia: REF });
    assert.equal(causas.recorte, 'MUNICIPIO');
    assert.ok(causas.dimensoes.length >= 1, `${codigo}: sem dimensões`);
    const obitos = await svc.consultar({
      indicadorId: ids['Óbitos infantis'], recorte: 'MUNICIPIO', codigo, dataReferencia: REF,
    });
    for (const dim of causas.dimensoes) {
      const soma = dim.categorias.reduce((s, c) => s + c.valor, 0);
      assert.equal(dim.total, soma, `${codigo}/${dim.dimensao}: total ≠ Σ categorias`);
      assert.ok(dim.total <= obitos.valor, `${codigo}/${dim.dimensao}: causas (${dim.total}) > óbitos (${obitos.valor})`);
      const participacao = dim.categorias.reduce((s, c) => s + c.participacao, 0);
      assert.ok(Math.abs(participacao - 100) <= 0.5, `${codigo}/${dim.dimensao}: Σ participação = ${participacao}`);
      for (const c of dim.categorias)
        assert.equal(c.participacao, Number(((c.valor / dim.total) * 100).toFixed(1)));
      assert.ok(dim.procedencia.length >= 1, `${codigo}/${dim.dimensao}: sem procedência`);
      for (const p of dim.procedencia)
        for (const chave of ['fonte', 'url', 'data_referencia', 'data_extracao', 'licenca', 'hash'])
          assert.ok(chave in p, `${codigo}/${dim.dimensao}: procedência sem "${chave}"`);
    }
    // todo óbito tem capítulo CID-10: a dimensão esgota o total do território
    const capitulo = causas.dimensoes.find((d) => d.dimensao === 'CAPITULO_CID10');
    assert.ok(capitulo, `${codigo}: sem CAPITULO_CID10`);
    assert.equal(capitulo.total, obitos.valor, `${codigo}: capítulo não esgota os óbitos`);
  }
});

test('(c) causas estaduais: as três dimensões decompõem o MESMO total oficial', async () => {
  // No recorte estadual as linhas vêm da tabulação oficial completa da fonte
  // (codigo NULL em db/50) — que cobre os 141 municípios de MT, não apenas a
  // malha parcial do seed. Por isso a âncora aqui é interna: capítulo,
  // componente e causas evitáveis decompõem o MESMO conjunto de óbitos.
  const causas = await svc.causas({ indicadorId: ids['Óbitos infantis'], referencia: REF });
  assert.equal(causas.recorte, 'ESTADO');
  const totais = new Map(causas.dimensoes.map((d) => [d.dimensao, d.total]));
  assert.equal(totais.size, 3, 'estado deveria ter as 3 dimensões');
  assert.equal(totais.get('CAPITULO_CID10'), totais.get('COMPONENTE'));
  assert.equal(totais.get('CAPITULO_CID10'), totais.get('CAUSA_EVITAVEL'));
  // e cada dimensão bate com o recomputo SQL manual da vigência
  for (const dim of causas.dimensoes) {
    const manual = await pool.query(
      `SELECT sum("ObservacaoCausa_Valor")::float AS total
         FROM "ObservacaoCausa"
        WHERE "ObservacaoCausa_IndicadorId"=$1 AND "ObservacaoCausa_CodigoIbge" IS NULL
          AND "ObservacaoCausa_Dimensao"=$2 AND "ObservacaoCausa_DataReferencia"=$3::date`,
      [ids['Óbitos infantis'], dim.dimensao, dim.referencia],
    );
    assert.equal(dim.total, manual.rows[0].total, `${dim.dimensao}: total ≠ SELECT manual`);
  }
});

test('taxa (RECALCULO) delega a decomposição ao numerador, declarando-a', async () => {
  const causas = await svc.causas({ indicadorId: ids['Taxa de mortalidade infantil'], codigo: TRES[0], referencia: REF });
  assert.equal(causas.decomposicao_de, 'Óbitos infantis');
  const direto = await svc.causas({ indicadorId: ids['Óbitos infantis'], codigo: TRES[0], referencia: REF });
  assert.deepEqual(causas.dimensoes, direto.dimensoes, 'decomposição da taxa ≠ decomposição do numerador');
});

test('(d) RN-005: indicador sem eixo de causas → NotFound com contexto', async () => {
  const ind = await pool.query(
    `INSERT INTO "Indicador"
       ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_StatusValidacao")
     VALUES (5,'Zz Sem Causas (teste P3)','x','SOMA','APROVADO')
     RETURNING "Indicador_Id" AS id`,
  );
  await assert.rejects(
    svc.causas({ indicadorId: ind.rows[0].id, referencia: REF }),
    (e) => (typeof e?.getStatus === 'function' ? e.getStatus() : e?.status) === 404
      && /Não há decomposição por causa publicada/.test(e?.message),
  );
});

test('(d) RN-005: referência anterior à cobertura → NotFound listando o que EXISTE', async () => {
  await assert.rejects(
    svc.causas({ indicadorId: ids['Óbitos infantis'], codigo: TRES[0], referencia: '2015-12-31' }),
    (e) => (typeof e?.getStatus === 'function' ? e.getStatus() : e?.status) === 404
      && /Para este território existem/.test(e?.message)
      && /CAPITULO_CID10/.test(e?.message),
    'a ausência deve responder com as dimensões disponíveis do território',
  );
});

test('(e) determinismo: 2 chamadas idênticas ⇒ JSON idêntico', async () => {
  const a = JSON.stringify(await svc.causas({ indicadorId: ids['Óbitos infantis'], codigo: TRES[0], referencia: REF }));
  const b = JSON.stringify(await svc.causas({ indicadorId: ids['Óbitos infantis'], codigo: TRES[0], referencia: REF }));
  assert.equal(a, b, 'causas divergiu entre chamadas idênticas');
  const t1 = JSON.stringify(await svc.consultar({
    indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'ESTADO', codigo: null, dataReferencia: REF,
  }));
  const t2 = JSON.stringify(await svc.consultar({
    indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'ESTADO', codigo: null, dataReferencia: REF,
  }));
  assert.equal(t1, t2, 'taxa divergiu entre chamadas idênticas');
});

test('(f) ranking (P2) funciona com a taxa real, na escala por mil', async () => {
  const r = await svc.ranking({ indicadorId: ids['Taxa de mortalidade infantil'], referencia: REF });
  assert.equal(r.agregacao, 'RECALCULO');
  assert.ok(r.municipios.length >= 3, 'ranking da taxa deveria ter municípios');

  // valor municipal = (óbitos/nascidos)×1000 do próprio município, 1 casa —
  // e só entra quem tem AMBAS as parcelas NA MESMA referência (rodada 2)
  const completos = (await parcelasPareadas()).filter((p) => p.den !== 0);
  assert.equal(
    r.municipios.length,
    completos.length,
    'ranking deve ter exatamente quem tem AMBAS as parcelas na MESMA referência',
  );
  for (const m of r.municipios) {
    const p = completos.find((x) => x.codigo === m.codigo_ibge);
    assert.ok(p, `${m.nome} ranqueado sem ambas as parcelas pareadas (RN-005)`);
    assert.equal(m.valor, Number(((p.num / p.den) * 1000).toFixed(1)));
  }

  // média estadual = rollup RECALCULO do MESMO motor (já é a taxa do estado)
  const estado = await svc.consultar({
    indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'ESTADO', codigo: null, dataReferencia: REF,
  });
  assert.equal(r.media_estadual, estado.valor);
  assert.equal(r.total_estadual, null, 'RECALCULO não tem total estadual');
  for (const m of r.municipios)
    assert.equal(m.delta_media_estadual, Number((m.valor - r.media_estadual).toFixed(2)));

  // município sem parcela fica em ausentes, nunca zero
  const comDado = new Set(r.municipios.map((m) => m.codigo_ibge));
  for (const c of r.ausentes.codigos) assert.ok(!comDado.has(c));
  assert.equal(r.total_municipios, r.municipios.length + r.ausentes.total);
});

test('(i) TMI estadual por ano = Σóbitos/Σnascidos×1000 sobre TODAS as linhas do ano (zeros incluídos)', async () => {
  // E4 (db/57): com a malha completa dos 142 municípios em migração, os
  // totais da tabulação OFICIAL do TabNet viram âncoras absolutas do
  // ratchet — antes só a igualdade motor×SQL era possível (malha parcial).
  const OFICIAIS = {
    2019: { obitos: 747, tmi: 12.7 },
    2020: { obitos: 689, tmi: 12.1 },
    2021: { obitos: 733, tmi: 12.7 },
    2022: { obitos: 819, tmi: 14.1 },
    2023: { obitos: 822, tmi: 14.0 },
    2024: { obitos: 785, tmi: 14.2 },
  };
  for (const ano of [2019, 2020, 2021, 2022, 2023, 2024]) {
    const ref = `${ano}-12-31`;
    // Recomputo SQL independente: TODAS as observações com referência
    // EXATAMENTE no ano — os zeros materializados pelo db/50 entram na soma
    // (numerador) e mantêm os nascidos no denominador.
    const sql = await pool.query(
      `SELECT (SELECT sum("Observacao_Valor")::float FROM "Observacao"
                WHERE "Observacao_IndicadorId"=$1 AND "Observacao_DataReferencia"=$3::date) AS obitos,
              (SELECT sum("Observacao_Valor")::float FROM "Observacao"
                WHERE "Observacao_IndicadorId"=$2 AND "Observacao_DataReferencia"=$3::date) AS nascidos`,
      [ids['Óbitos infantis'], ids['Nascidos vivos'], ref],
    );
    const { obitos, nascidos } = sql.rows[0];
    assert.ok(nascidos > 0, `${ano}: db/50 deveria cobrir nascidos`);

    // Âncora ABSOLUTA (E4): Σ municípios do banco = Total oficial da fonte
    assert.equal(obitos, OFICIAIS[ano].obitos, `${ano}: Σóbitos do banco ≠ total OFICIAL da tabulação`);

    const taxa = await svc.consultar({
      indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'ESTADO', codigo: null, dataReferencia: ref,
    });
    assert.equal(
      taxa.valor,
      Number(((obitos / nascidos) * 1000).toFixed(1)),
      `${ano}: TMI estadual do motor ≠ Σóbitos/Σnascidos×1000 do SQL (zeros incluídos)`,
    );
    // Âncora ABSOLUTA (E4): a TMI estadual oficial, no arredondamento do motor
    assert.equal(taxa.valor, OFICIAIS[ano].tmi, `${ano}: TMI estadual do motor ≠ valor OFICIAL`);

    // Σóbitos do motor (SOMA estadual) = Σ SQL do ano — igualdade motor×SQL
    const soma = await svc.consultar({
      indicadorId: ids['Óbitos infantis'], recorte: 'ESTADO', codigo: null, dataReferencia: ref,
    });
    assert.equal(soma.valor, obitos, `${ano}: Σóbitos do motor ≠ Σ SQL do ano`);
  }
});

test('(i) E4: os 211 zeros materializados de óbitos existem DIRETAMENTE no banco', async () => {
  // A prova que o crítico P3 registrou como "indireta em fixture": a
  // tabulação estadual completa de óbitos tem 635 pares (município×ano);
  // malha de 141 municípios instalados até 2024 × 6 anos = 846 pares
  // ⇒ 211 zeros. Boa Esperança do Norte (instalado 2025-01-01) NÃO recebe
  // zero 2019–2024 — zero para município inexistente seria fabricação
  // (guarda de instalação do db/57); nascidos vivos não têm zero algum.
  const z = await pool.query(
    `SELECT count(*) FILTER (WHERE "Observacao_IndicadorId"=$1 AND "Observacao_Valor"=0)::int AS zeros_obitos,
            count(*) FILTER (WHERE "Observacao_IndicadorId"=$2 AND "Observacao_Valor"=0)::int AS zeros_nascidos,
            count(*) FILTER (WHERE "Observacao_CodigoIbge"='5101837')::int AS linhas_ben
       FROM "Observacao"
      WHERE "Observacao_IndicadorId" = ANY($3) AND "Observacao_DataReferencia" <= '2024-12-31'`,
    [ids['Óbitos infantis'], ids['Nascidos vivos'], [ids['Óbitos infantis'], ids['Nascidos vivos']]],
  );
  assert.equal(z.rows[0].zeros_obitos, 211, 'os 211 zeros do gauntlet devem existir na fixture');
  assert.equal(z.rows[0].zeros_nascidos, 0, 'tabulação de nascidos cobre todos os anos: zero materializado seria erro');
  assert.equal(z.rows[0].linhas_ben, 0, 'Boa Esperança do Norte (2025) não pode ter dado 2019–2024 — RN-005');
});

test('(j) serie() de RECALCULO deriva os anos das parcelas (achado P7: voltava vazia)', async () => {
  // A taxa não tem observação própria; os anos vêm da INTERSEÇÃO
  // numerador ∩ denominador, e cada ponto reusa o rollup do motor.
  const s = await svc.serie({
    indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'ESTADO', codigo: null,
  });
  assert.equal(s.pontos.length, 6, 'db/50 cobre 2019–2024: a série da TMI deve ter 6 pontos');
  assert.deepEqual(s.pontos.map((p) => p.ano), [2019, 2020, 2021, 2022, 2023, 2024]);
  for (const p of s.pontos) {
    const taxa = await svc.consultar({
      indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'ESTADO', codigo: null,
      dataReferencia: `${p.ano}-12-31`,
    });
    assert.equal(p.valor, taxa.valor, `${p.ano}: ponto da série ≠ consulta pontual do motor`);
  }
});

test('(g) ataque do crítico: óbitos 2024 apagado ⇒ NotFound divergente, ranking em ausentes, estado exclui', async () => {
  const SINOP = '5107909';
  const linha = await pool.query(
    `SELECT "Observacao_Valor"::float AS valor, "Observacao_FonteId" AS fonte, "Observacao_CargaId" AS carga,
            "Observacao_StatusDado" AS status
       FROM "Observacao"
      WHERE "Observacao_IndicadorId"=$1 AND "Observacao_CodigoIbge"=$2 AND "Observacao_DataReferencia"='2024-12-31'`,
    [ids['Óbitos infantis'], SINOP],
  );
  assert.equal(linha.rows.length, 1, 'fixture: Sinop deveria ter óbitos 2024 em db/50');
  const original = linha.rows[0];
  await pool.query(
    `DELETE FROM "Observacao"
      WHERE "Observacao_IndicadorId"=$1 AND "Observacao_CodigoIbge"=$2 AND "Observacao_DataReferencia"='2024-12-31'`,
    [ids['Óbitos infantis'], SINOP],
  );
  try {
    // (1) municipal: NUNCA um número — 404 com o contexto da divergência
    // (a vigência traria óbitos 2023 ÷ nascidos 2024 = o "8,7" falso do ataque)
    await assert.rejects(
      svc.consultar({
        indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'MUNICIPIO', codigo: SINOP, dataReferencia: REF,
      }),
      (e) => (typeof e?.getStatus === 'function' ? e.getStatus() : e?.status) === 404
        && /parcelas com referências divergentes/.test(e?.message)
        && /2023/.test(e?.message) && /2024/.test(e?.message)
        && /sem cálculo, sem imputação/.test(e?.message),
      'parcelas de anos diferentes deveriam dar NotFound com contexto, nunca taxa herdada',
    );

    // (2) ranking: Sinop em `ausentes`, jamais com taxa herdada de 2023
    const r = await svc.ranking({ indicadorId: ids['Taxa de mortalidade infantil'], referencia: REF });
    assert.ok(!r.municipios.some((m) => m.codigo_ibge === SINOP), 'Sinop não pode ser ranqueado com parcela de 2023');
    assert.ok(r.ausentes.codigos.includes(SINOP), 'Sinop deveria constar em ausentes');

    // (3) estado: o município divergente sai da soma ANTES do rollup —
    // inclusive os nascidos 2024 dele saem do denominador estadual
    const taxa = await svc.consultar({
      indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'ESTADO', codigo: null, dataReferencia: REF,
    });
    const pares = await parcelasPareadas();
    assert.ok(!pares.some((p) => p.codigo === SINOP), 'réplica manual: Sinop não deveria parear');
    const somaNum = pares.reduce((s, x) => s + x.num, 0);
    const somaDen = pares.reduce((s, x) => s + x.den, 0);
    assert.equal(taxa.valor, Number(((somaNum / somaDen) * 1000).toFixed(1)),
      'agregado estadual deveria excluir o município de parcelas divergentes');
  } finally {
    // Restauração FIEL, incluindo o status do dado (E3/db/60): recriar a
    // linha sem ele deixaria Sinop "desconhecido" e contaminaria as
    // asserções de status das suítes seguintes.
    await pool.query(
      `INSERT INTO "Observacao"
         ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_Valor","Observacao_FonteId","Observacao_CargaId","Observacao_StatusDado")
       VALUES ($1,$2,'2024-12-31',$3,$4,$5,$6)`,
      [ids['Óbitos infantis'], SINOP, original.valor, original.fonte, original.carga, original.status],
    );
  }
});

test('(h) zero materializado: óbitos 0 com nascidos > 0 ⇒ taxa 0.0 PRESENTE no ranking', async () => {
  // E4 (db/57): a malha completa já traz dezenas de zeros naturais (211 no
  // total) — o fixture força o zero num município GRANDE (Pontes e Lacerda)
  // para provar que o mesmo tratamento vale fora dos municípios minúsculos:
  // Valor 0 da tabulação estadual completa é zero real, não ausência.
  // (bottom_n: os empatados em 0 compartilham a posição inversa 1 —
  // competition ranking — então a flag continua verdadeira com a malha cheia.)
  const PONTES = '5106752';
  const antes = await pool.query(
    `SELECT "Observacao_Valor"::float AS valor FROM "Observacao"
      WHERE "Observacao_IndicadorId"=$1 AND "Observacao_CodigoIbge"=$2 AND "Observacao_DataReferencia"='2024-12-31'`,
    [ids['Óbitos infantis'], PONTES],
  );
  assert.equal(antes.rows.length, 1);
  await pool.query(
    `UPDATE "Observacao" SET "Observacao_Valor"=0
      WHERE "Observacao_IndicadorId"=$1 AND "Observacao_CodigoIbge"=$2 AND "Observacao_DataReferencia"='2024-12-31'`,
    [ids['Óbitos infantis'], PONTES],
  );
  try {
    // municipal: taxa 0.0 é RESULTADO (o melhor possível), não ausência
    const taxa = await svc.consultar({
      indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'MUNICIPIO', codigo: PONTES, dataReferencia: REF,
    });
    assert.equal(taxa.valor, 0);

    // ranking: PRESENTE com valor 0 na última posição (melhor TMI), não ausente
    const r = await svc.ranking({ indicadorId: ids['Taxa de mortalidade infantil'], referencia: REF });
    const m = r.municipios.find((x) => x.codigo_ibge === PONTES);
    assert.ok(m, 'município com taxa 0 deveria estar NO ranking, não em ausentes');
    assert.equal(m.valor, 0);
    assert.ok(!r.ausentes.codigos.includes(PONTES));
    assert.ok(m.bottom_n, 'taxa 0 é a menor do ranking decrescente');
  } finally {
    await pool.query(
      `UPDATE "Observacao" SET "Observacao_Valor"=$3
        WHERE "Observacao_IndicadorId"=$1 AND "Observacao_CodigoIbge"=$2 AND "Observacao_DataReferencia"='2024-12-31'`,
      [ids['Óbitos infantis'], PONTES, antes.rows[0].valor],
    );
  }
});

test('(h) nascidos 0 (com óbitos 0) ⇒ denominador 0 ⇒ ausência com motivo, sem imputação', async () => {
  // Caso raro-mas-possível que a materialização pode criar numa malha
  // completa: município sem nascido E sem óbito no ano ⇒ 0/0, taxa incalculável.
  const PONTES = '5106752';
  const originais = await pool.query(
    `SELECT "Observacao_IndicadorId" AS ind, "Observacao_Valor"::float AS valor FROM "Observacao"
      WHERE "Observacao_IndicadorId" = ANY($1) AND "Observacao_CodigoIbge"=$2 AND "Observacao_DataReferencia"='2024-12-31'`,
    [[ids['Óbitos infantis'], ids['Nascidos vivos']], PONTES],
  );
  assert.equal(originais.rows.length, 2);
  await pool.query(
    `UPDATE "Observacao" SET "Observacao_Valor"=0
      WHERE "Observacao_IndicadorId" = ANY($1) AND "Observacao_CodigoIbge"=$2 AND "Observacao_DataReferencia"='2024-12-31'`,
    [[ids['Óbitos infantis'], ids['Nascidos vivos']], PONTES],
  );
  try {
    await assert.rejects(
      svc.consultar({
        indicadorId: ids['Taxa de mortalidade infantil'], recorte: 'MUNICIPIO', codigo: PONTES, dataReferencia: REF,
      }),
      (e) => (typeof e?.getStatus === 'function' ? e.getStatus() : e?.status) === 404
        && /denominador vale 0/.test(e?.message) && /sem imputação/.test(e?.message),
      'denominador 0 deveria dar ausência com motivo',
    );
    const r = await svc.ranking({ indicadorId: ids['Taxa de mortalidade infantil'], referencia: REF });
    assert.ok(!r.municipios.some((m) => m.codigo_ibge === PONTES));
    assert.ok(r.ausentes.codigos.includes(PONTES), 'denominador 0 ⇒ ausente no ranking');
  } finally {
    for (const o of originais.rows)
      await pool.query(
        `UPDATE "Observacao" SET "Observacao_Valor"=$3
          WHERE "Observacao_IndicadorId"=$1 AND "Observacao_CodigoIbge"=$2 AND "Observacao_DataReferencia"='2024-12-31'`,
        [o.ind, PONTES, o.valor],
      );
  }
});

test('trilha: CONSULTA_CAUSAS gravada na cadeia imutável', async () => {
  const contar = () =>
    pool
      .query(`SELECT count(*)::int AS n FROM "EventoAuditoria" WHERE "EventoAuditoria_Acao"='CONSULTA_CAUSAS'`)
      .then((r) => r.rows[0].n);
  const antes = await contar();
  await svc.causas({ indicadorId: ids['Óbitos infantis'], referencia: REF });
  const depois = await contar();
  assert.ok(depois > antes, 'causas executado sem evento CONSULTA_CAUSAS na trilha');
});
