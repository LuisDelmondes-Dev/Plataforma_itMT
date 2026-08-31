// ============================================================
// sugestoes.unit.mjs — Gauntlet P7 (A16 · AGENTE-SUGESTOES).
//
// PADRÃO: banco-direto, como causas.unit.mjs — node:test + pg.Pool no
// DATABASE_URL de um banco DESCARTÁVEL migrado (db/01..52), instanciando os
// serviços COMPILADOS de dist/. NUNCA aponte para o banco dev.
//
// O dado é REAL (db/50: SIM/SINASC 2019–2024); os indicadores de mortalidade
// nascem EM_ANALISE e o hook `before` SIMULA o parecer humano (RG-09) no
// banco descartável — em produção esse ato é do curador, jamais deste teste.
//
// Invariantes cobertas (doutrina "dossiê, não decisão" + RG-03/RG-05):
//   (0) db/51 aplicou catálogo (>= 12 práticas; áreas Saúde/Educação/GERAL)
//       e polaridade (TMI = MENOR_MELHOR; nascidos vivos SEM polaridade);
//   (a) município ACIMA da média (pior, MENOR_MELHOR) gera sugestão com
//       prática de Saúde, texto julgado ("desfavorável"), origem
//       RANKING_MUNICIPIO com codigo_ibge — e NENHUM numeral intruso
//       (auditoria recomputada aqui com a MESMA extração pt-BR do A06);
//   (b) causa dominante presente quando o motor tem /causas para o
//       território — origem CAUSA, categoria dominante citada no texto;
//   (c) determinismo: 2 chamadas idênticas ⇒ JSON idêntico;
//   (d) indicador SEM polaridade ⇒ texto neutro (sem "desfavorável") e
//       prática apenas da área GERAL (o A16 não aplica prática finalística
//       de área a desvio não julgado);
//   (e) recorte ESTADO não fabrica origem municipal; máx. 5 sugestões;
//   (f) RODADA 2: o gatilho CAUSA_DOMINANTE avalia TODAS as dimensões —
//       COMPONENTE pós-neonatal dominante gera a sugestão de puericultura/
//       APS com norma VIGENTE (PNAB, Anexo XXII da Port. de Consolidação
//       nº 2/2017), ordenada ANTES do capítulo CID-10 menos concentrado
//       (o caso Barra do Garças do crítico de gestão pública);
//   (g) RODADA 2: nenhuma sugestão cita a Portaria 715/2022 (RAMI) sem a
//       nota "revogada" (db/52 — Rede Alyne 5.350/2024 é a vigente), e os
//       templates são invariantes em concordância ("a cobertura está
//       incompleta: 1 de N municípios sem dado…" — nunca "1 … estão").
// A persistência com FK/CHECK e o "modo pesquisa nunca tem sugestões" são
// provados fim a fim em test/modo.e2e.mjs (caso P7).
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { IndicadoresService } from '../dist/indicadores/indicadores.service.js';
import { TerritorioService } from '../dist/territorio/territorio.service.js';
import { AuditoriaService } from '../dist/auditoria/auditoria.service.js';
import { SugestoesService, gerarSugestoes } from '../dist/xingu/sugestoes.service.js';
import { extrairNumerais } from '../dist/xingu/narrador.js';

const REF = '2024-12-31';
const NOMES = ['Óbitos infantis', 'Nascidos vivos', 'Taxa de mortalidade infantil'];
const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const ROTULOS_DIMENSAO = ['capítulo CID-10', 'causas evitáveis', 'componente etário'];

let pool;
let motor;      // IndicadoresService compilado
let sugSvc;     // SugestoesService compilado (catálogo real do db/51)
let praticas;   // linhas de "PraticaGestao"
let ids = {};
let alvo;       // município escolhido: pior que a média COM causas no motor
let entradaBase;

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
  const agentes = { garantirParaIndicador: async () => false }; // sem internet
  motor = new IndicadoresService(db, territorio, auditoria, agentes);
  sugSvc = new SugestoesService(db);

  // Gate humano (RG-09) simulado SÓ no banco descartável — ver cabeçalho.
  await pool.query(
    `UPDATE "Indicador" SET "Indicador_StatusValidacao"='APROVADO' WHERE "Indicador_Nome" = ANY($1)`,
    [NOMES],
  );
  const r = await pool.query(
    `SELECT "Indicador_Id" AS id, "Indicador_Nome" AS nome, "Indicador_Polaridade" AS polaridade
       FROM "Indicador" WHERE "Indicador_Nome" = ANY($1)`,
    [NOMES],
  );
  for (const linha of r.rows) ids[linha.nome] = linha;
  assert.equal(Object.keys(ids).length, 3);

  praticas = (await pool.query(
    `SELECT "PraticaGestao_Id" AS id, "PraticaGestao_Area" AS area,
            "PraticaGestao_Gatilho" AS gatilho, "PraticaGestao_Nome" AS nome,
            "PraticaGestao_Descricao" AS descricao, "PraticaGestao_FonteReferencia" AS fonte
       FROM "PraticaGestao" ORDER BY "PraticaGestao_Id"`,
  )).rows;

  // Município-alvo: o primeiro do ranking (pior TMI) acima da média E com
  // decomposição de causas no motor — escolha determinística sobre o dado.
  const tmi = ids['Taxa de mortalidade infantil'].id;
  const ranking = await motor.ranking({ indicadorId: tmi, referencia: REF });
  for (const m of ranking.municipios) {
    if (m.delta_media_estadual === null || m.delta_media_estadual <= 0) continue;
    try {
      const causas = await motor.causas({ indicadorId: tmi, codigo: m.codigo_ibge, referencia: REF });
      const serie = await motor.serie({ indicadorId: tmi, recorte: 'MUNICIPIO', codigo: m.codigo_ibge });
      alvo = { municipio: m, ranking, causas, serie };
      break;
    } catch {
      // sem causas para este município — tenta o próximo (RN-005 em ação)
    }
  }
  assert.ok(alvo, 'deveria existir município pior que a média com causas no motor (db/50)');

  entradaBase = {
    dossie: {
      ranking: alvo.ranking,
      serie: { pontos: alvo.serie.pontos },
      causas: alvo.causas,
    },
    indicador: {
      id: tmi,
      nome: 'Taxa de mortalidade infantil',
      unidade: 'por mil nascidos vivos',
      tema: 'Saúde',
      polaridade: ids['Taxa de mortalidade infantil'].polaridade,
    },
    recorte: 'MUNICIPIO',
    codigo: alvo.municipio.codigo_ibge,
    // No pipeline real o local vem de resultado.local (consultar); a série de
    // RECALCULO não tem observação própria (pontos vazios, local vazio) —
    // limitação do motor registrada como pendência da P7, não deste teste.
    local: alvo.municipio.nome,
  };
});

after(async () => {
  await pool.end();
});

/** Conjunto autorizado recomputado de forma independente (mesma doutrina do
 *  A06): numerais publicados pelo motor no dossiê + metadados deterministicos
 *  (práticas do catálogo, nome/unidade/local, rótulos de dimensão). */
function autorizadosDe(entrada) {
  const pool = new Set();
  const add = (s) => { if (s != null) for (const n of extrairNumerais(String(s))) pool.add(n); };
  const m = entrada.dossie.ranking.municipios.find((x) => x.codigo_ibge === entrada.codigo);
  if (m) {
    add(fmt.format(m.valor));
    add(fmt.format(Math.abs(m.delta_media_estadual)));
    add(m.procedencia[0]?.data_referencia.slice(0, 4));
  }
  if (entrada.dossie.ranking.media_estadual !== null) add(fmt.format(entrada.dossie.ranking.media_estadual));
  add(fmt.format(entrada.dossie.ranking.ausentes.total));
  add(fmt.format(entrada.dossie.ranking.total_municipios));
  for (const p of entrada.dossie.serie.pontos) { add(String(p.ano)); add(fmt.format(p.valor)); }
  if (entrada.dossie.causas) {
    add(entrada.dossie.causas.decomposicao_de);
    add(entrada.dossie.causas.indicador);
    add(entrada.dossie.causas.local);
    for (const d of entrada.dossie.causas.dimensoes) {
      add(d.referencia.slice(0, 4)); add(fmt.format(d.total));
      for (const c of d.categorias) { add(c.categoria); add(fmt.format(c.valor)); add(fmt.format(c.participacao)); }
    }
  }
  add(entrada.indicador.nome); add(entrada.indicador.unidade); add(entrada.local);
  for (const r of ROTULOS_DIMENSAO) add(r);
  for (const p of praticas) { add(p.nome); add(p.descricao); add(p.fonte); }
  return pool;
}

/** RODADA 2: nenhum texto/fonte gerado cita a Portaria 715/2022 (RAMI) como
 *  se estivesse viva — só como histórico, com a nota expressa de revogação. */
function semNormaMorta(sugestoes) {
  for (const s of sugestoes) {
    for (const trecho of [s.texto, s.fonte_referencia]) {
      if (/715/.test(trecho)) {
        assert.match(trecho, /revogad/i, `norma revogada citada como viva: ${trecho}`);
      }
    }
  }
}

function conferirNumerais(sugestoes, entrada) {
  const autorizados = autorizadosDe(entrada);
  for (const s of sugestoes) {
    const intrusos = extrairNumerais(s.texto).filter(
      (n) => ![...autorizados].some((a) => Math.abs(a - n) < 1e-9),
    );
    assert.deepEqual(intrusos, [], `numeral intruso em "${s.texto}"`);
  }
}

test('(0) db/51+52 aplicados: catálogo curado, normas vigentes e polaridade no lugar', async () => {
  assert.ok(praticas.length >= 14 && praticas.length <= 24, `catálogo com ${praticas.length} práticas`);
  const areas = new Set(praticas.map((p) => p.area));
  for (const a of ['Saúde', 'Educação', 'GERAL']) assert.ok(areas.has(a), `área ${a} seedada`);
  for (const p of praticas) assert.ok(p.nome && p.descricao && p.fonte, 'prática sem nome/descrição/fonte');

  // RODADA 2 (db/52): nenhuma fonte do catálogo cita norma morta como viva.
  for (const p of praticas) {
    if (/715/.test(p.fonte)) {
      assert.match(p.fonte, /revogad/i, `RAMI 715/2022 sem nota de revogação: ${p.fonte}`);
    }
    if (/1\.459/.test(p.fonte)) {
      assert.match(p.fonte, /suced/i, `Rede Cegonha 1.459/2011 sem nota de sucessão: ${p.fonte}`);
    }
  }
  // A norma vigente (Rede Alyne, Portaria GM/MS 5.350/2024) ancora as
  // práticas materno-infantis, e as duas práticas do eixo COMPONENTE
  // (mapeadas pelo A16) existem com as fontes conferidas na rodada 2.
  assert.ok(
    praticas.some((p) => /Rede Alyne/.test(p.fonte) && /5\.350/.test(p.fonte)),
    'Rede Alyne (5.350/2024) presente no catálogo',
  );
  const puericultura = praticas.find(
    (p) => p.area === 'Saúde' && p.gatilho === 'CAUSA_DOMINANTE' && /puericultura/i.test(p.nome),
  );
  assert.ok(puericultura, 'prática de puericultura/APS (componente pós-neonatal) seedada');
  assert.match(puericultura.fonte, /Atenção Básica/, 'puericultura cita a PNAB vigente');
  assert.match(puericultura.fonte, /Consolidação GM\/MS nº 2/, 'PNAB = Anexo XXII da Port. de Consolidação nº 2/2017');
  const neonatal = praticas.find(
    (p) => p.area === 'Saúde' && p.gatilho === 'CAUSA_DOMINANTE' && /componente neonatal/i.test(p.nome),
  );
  assert.ok(neonatal, 'prática de parto/RN (componente neonatal) seedada');
  assert.match(neonatal.fonte, /Rede Alyne/, 'componente neonatal ancora na rede vigente');
  assert.equal(ids['Taxa de mortalidade infantil'].polaridade, 'MENOR_MELHOR');
  assert.equal(ids['Óbitos infantis'].polaridade, 'MENOR_MELHOR');
  assert.equal(ids['Nascidos vivos'].polaridade, null, 'denominador demográfico não tem polaridade');
  const cob = await pool.query(
    `SELECT "Indicador_Polaridade" AS p FROM "Indicador" WHERE "Indicador_Nome"='Cobertura vacinal — poliomielite'`,
  );
  assert.equal(cob.rows[0].p, 'MAIOR_MELHOR');
});

test('(a) pior que a média (MENOR_MELHOR): sugestão julgada com prática de Saúde e zero numeral intruso', async () => {
  const saida = await sugSvc.gerar(entradaBase);
  assert.ok(saida.sugestoes.length >= 1 && saida.sugestoes.length <= 5);
  assert.equal(saida.descartadas, 0, 'nenhuma sugestão deveria cair na auditoria de numerais');

  const municipal = saida.sugestoes.find((s) => s.origem.tipo === 'RANKING_MUNICIPIO');
  assert.ok(municipal, 'desvio desfavorável vira sugestão com origem municipal');
  assert.equal(municipal.gatilho, 'ACIMA_DA_MEDIA', 'pior TMI = acima da média');
  assert.equal(municipal.origem.codigo_ibge, alvo.municipio.codigo_ibge);
  assert.equal(municipal.origem.indicadorId, entradaBase.indicador.id);
  assert.match(municipal.texto, /desfavorável/, 'com polaridade o desvio É julgado');
  assert.match(municipal.texto, /menor é melhor/);
  const nomesSaude = new Set(
    praticas.filter((p) => p.area === 'Saúde' && p.gatilho === 'ACIMA_DA_MEDIA').map((p) => p.nome),
  );
  assert.ok(nomesSaude.has(municipal.pratica_citada), 'prática citada vem do catálogo de Saúde');
  assert.ok(municipal.fonte_referencia.length > 0, 'toda sugestão cita a fonte que reconhece a prática');
  assert.ok(municipal.texto.includes(municipal.fonte_referencia), 'a fonte aparece no texto (ref.:)');

  conferirNumerais(saida.sugestoes, entradaBase);
  semNormaMorta(saida.sugestoes);
});

test('(b) causa dominante: todas as dimensões do dossiê viram no máx. 1 sugestão cada, sem prática repetida', async () => {
  const saida = await sugSvc.gerar(entradaBase);
  const deCausa = saida.sugestoes.filter((s) => s.gatilho === 'CAUSA_DOMINANTE');
  assert.ok(deCausa.length >= 1, 'com causas no dossiê, o gatilho de causa dominante dispara');
  for (const c of deCausa) assert.equal(c.origem.tipo, 'CAUSA');

  // RODADA 2: no máximo UMA sugestão por dimensão disponível, e uma mesma
  // prática nunca é citada duas vezes dentro do bloco de causa.
  const dimsComDado = alvo.causas.dimensoes.filter((d) => d.total > 0 && d.categorias.length > 0);
  assert.ok(deCausa.length <= dimsComDado.length, 'não há mais sugestões de causa do que dimensões');
  const citadas = deCausa.map((s) => s.pratica_citada);
  assert.equal(new Set(citadas).size, citadas.length, 'prática repetida no bloco de causa');

  // Recomputo independente da dominante do capítulo CID-10 (db/50 publica
  // para o alvo): a categoria de maior valor tem de ser citada numa sugestão.
  const dim = alvo.causas.dimensoes.find((d) => d.dimensao === 'CAPITULO_CID10');
  assert.ok(dim, 'db/50 publica capítulo CID-10 para o alvo');
  const dominante = dim.categorias.reduce((a, b) => (b.valor > a.valor ? b : a), dim.categorias[0]);
  const daCid = deCausa.find((s) => s.texto.includes('capítulo CID-10'));
  assert.ok(daCid, 'o eixo CID-10 emite a sua sugestão');
  assert.ok(daCid.texto.includes(dominante.categoria), 'o texto cita a categoria dominante do motor');

  const nomesCausa = new Set(
    praticas.filter((p) => p.area === 'Saúde' && p.gatilho === 'CAUSA_DOMINANTE').map((p) => p.nome),
  );
  for (const c of deCausa) assert.ok(nomesCausa.has(c.pratica_citada));

  // Ordem determinística entre eixos: participação da dominante DESC.
  const partDe = (s) => {
    const m = s.texto.match(/participação de ([\d.,]+)%/);
    assert.ok(m, `sugestão de causa sem participação no texto: ${s.texto}`);
    return Number(m[1].replace(/\./g, '').replace(',', '.'));
  };
  for (let i = 1; i < deCausa.length; i++) {
    assert.ok(partDe(deCausa[i - 1]) >= partDe(deCausa[i]), 'eixo mais concentrado vem primeiro');
  }
});

test('(c) determinismo: 2 chamadas idênticas ⇒ JSON idêntico', async () => {
  const a = JSON.stringify(await sugSvc.gerar(entradaBase));
  const b = JSON.stringify(await sugSvc.gerar(entradaBase));
  assert.equal(a, b, 'o A16 é função pura do JSON do motor + catálogo');
  const p1 = JSON.stringify(gerarSugestoes(entradaBase, praticas));
  const p2 = JSON.stringify(gerarSugestoes(entradaBase, praticas));
  assert.equal(p1, p2);
});

test('(d) sem polaridade: texto neutro (sem "desfavorável") e prática apenas da área GERAL', async () => {
  const entradaNeutra = {
    ...entradaBase,
    indicador: { ...entradaBase.indicador, polaridade: null },
  };
  const saida = await sugSvc.gerar(entradaNeutra);
  const municipal = saida.sugestoes.find((s) => s.origem.tipo === 'RANKING_MUNICIPIO');
  assert.ok(municipal, 'o desvio factual continua registrado (constatação, não juízo)');
  assert.ok(!/desfavor/i.test(municipal.texto), 'sem polaridade o A16 não julga');
  assert.match(municipal.texto, /sem juízo de valor/);
  const geral = new Set(praticas.filter((p) => p.area === 'GERAL').map((p) => p.nome));
  assert.ok(
    geral.has(municipal.pratica_citada),
    'desvio não julgado só recebe prática multiárea (GERAL), nunca prática finalística de Saúde',
  );
  // Sem polaridade NENHUM texto julga — nem os de causa/cobertura.
  for (const s of saida.sugestoes) assert.ok(!/desfavor/i.test(s.texto), `julgamento indevido: ${s.texto}`);
  conferirNumerais(saida.sugestoes, entradaNeutra);
});

test('(e) recorte ESTADO: nada de origem municipal; teto de 5 sugestões respeitado', async () => {
  const tmi = entradaBase.indicador.id;
  const causasEstado = await motor.causas({ indicadorId: tmi, referencia: REF });
  const serieEstado = await motor.serie({ indicadorId: tmi, recorte: 'ESTADO', codigo: null });
  const entradaEstado = {
    dossie: { ranking: alvo.ranking, serie: { pontos: serieEstado.pontos }, causas: causasEstado },
    indicador: entradaBase.indicador,
    recorte: 'ESTADO',
    codigo: null,
    local: causasEstado.local, // rótulo do território resolvido pelo motor
  };
  const saida = await sugSvc.gerar(entradaEstado);
  assert.ok(saida.sugestoes.length <= 5, 'máximo de 5 sugestões por pesquisa');
  assert.ok(
    saida.sugestoes.every((s) => s.origem.tipo !== 'RANKING_MUNICIPIO'),
    'sem recorte municipal não existe sugestão de delta municipal',
  );
  assert.ok(saida.sugestoes.some((s) => s.gatilho === 'CAUSA_DOMINANTE'), 'estado tem causas (db/50)');
  conferirNumerais(saida.sugestoes, entradaEstado);
  semNormaMorta(saida.sugestoes);
});

test('(f) rodada 2 — componente pós-neonatal dominante: puericultura/APS com a PNAB vigente, antes do CID-10 menos concentrado', () => {
  // Cenário do crítico (Barra do Garças): o eixo COMPONENTE concentra 60,9%
  // dos óbitos no período PÓS-neonatal (28–364 dias) — atenção primária
  // pós-alta — enquanto o capítulo CID-10 dominante tem só 30,4%. A rodada 1
  // ignorava o eixo COMPONENTE e recomendava sala de parto.
  const entradaComp = {
    ...entradaBase,
    dossie: {
      ...entradaBase.dossie,
      causas: {
        indicador: 'Óbitos infantis',
        unidade: 'óbitos',
        recorte: 'MUNICIPIO',
        local: entradaBase.local,
        referencia: REF,
        decomposicao_de: 'Óbitos infantis',
        dimensoes: [
          {
            dimensao: 'CAPITULO_CID10', referencia: REF, total: 23, procedencia: [],
            categorias: [
              { categoria: 'XVI. Algumas afecções originadas no período perinatal', valor: 7, participacao: 30.4 },
              { categoria: 'XVII. Malformações congênitas', valor: 6, participacao: 26.1 },
            ],
          },
          {
            dimensao: 'COMPONENTE', referencia: REF, total: 23, procedencia: [],
            categorias: [
              { categoria: 'Pós-neonatal (28 a 364 dias)', valor: 14, participacao: 60.9 },
              { categoria: 'Neonatal precoce (0 a 6 dias)', valor: 9, participacao: 39.1 },
            ],
          },
        ],
      },
    },
  };
  const { sugestoes, descartes } = gerarSugestoes(entradaComp, praticas);
  assert.deepEqual(descartes, [], 'nenhuma sugestão cai na auditoria de numerais');
  const deCausa = sugestoes.filter((s) => s.gatilho === 'CAUSA_DOMINANTE');
  assert.ok(deCausa.length >= 2, 'os dois eixos com dado emitem sugestão');

  // O eixo mais concentrado (COMPONENTE, 60,9%) vem PRIMEIRO…
  const primeira = deCausa[0];
  assert.ok(primeira.texto.includes('componente etário'), 'o eixo COMPONENTE lidera a priorização');
  assert.ok(primeira.texto.includes('Pós-neonatal (28 a 364 dias)'), 'a categoria dominante do motor é citada');
  assert.ok(primeira.texto.includes('participação de 60,9%'));
  // …com a prática MAPEADA de puericultura/APS e a norma VIGENTE conferida.
  assert.match(primeira.pratica_citada, /puericultura/i, 'pós-neonatal ⇒ puericultura/APS, não sala de parto');
  assert.match(primeira.fonte_referencia, /Atenção Básica/);
  assert.match(primeira.fonte_referencia, /Consolidação GM\/MS nº 2/);
  assert.ok(!/parto/i.test(primeira.pratica_citada), 'a rodada 1 recomendava sala de parto aqui');

  // O CID-10 continua coberto, na segunda posição (30,4% < 60,9%).
  const daCid = deCausa.find((s) => s.texto.includes('capítulo CID-10'));
  assert.ok(daCid, 'o eixo CID-10 também emite');
  assert.ok(deCausa.indexOf(daCid) > deCausa.indexOf(primeira));

  semNormaMorta(sugestoes);
  conferirNumerais(sugestoes, entradaComp);

  // Determinismo do novo caminho: mesma entrada ⇒ mesmo JSON.
  assert.equal(
    JSON.stringify(gerarSugestoes(entradaComp, praticas)),
    JSON.stringify(gerarSugestoes(entradaComp, praticas)),
  );
});

test('(g) rodada 2 — concordância invariante: 1 município ausente nunca produz "estão sem dado"', () => {
  // Entrada mínima: só o gatilho de cobertura dispara, com exatamente 1
  // município ausente — o caso que quebrava a concordância na rodada 1.
  const entradaCobertura = {
    dossie: {
      ranking: {
        ...alvo.ranking,
        ausentes: { ...alvo.ranking.ausentes, total: 1 },
      },
      serie: { pontos: [] },
      causas: null,
    },
    indicador: entradaBase.indicador,
    recorte: 'ESTADO',
    codigo: null,
    local: 'Mato Grosso',
  };
  const { sugestoes } = gerarSugestoes(entradaCobertura, praticas);
  const cobertura = sugestoes.filter((s) => s.gatilho === 'COBERTURA_INCOMPLETA');
  assert.ok(cobertura.length >= 1, 'cobertura incompleta dispara');
  for (const s of cobertura) {
    assert.match(s.texto, /a cobertura está incompleta: 1 de /, 'forma invariante com N=1');
    assert.ok(!/estão sem dado/.test(s.texto), `concordância quebrada: ${s.texto}`);
  }

  // Nenhum template do A16 flexiona verbo com o nome do indicador nem com a
  // contagem: varre TODOS os textos das saídas dos cenários deste arquivo.
  const todas = [
    ...gerarSugestoes(entradaBase, praticas).sugestoes,
    ...gerarSugestoes({ ...entradaBase, indicador: { ...entradaBase.indicador, polaridade: null } }, praticas).sugestoes,
    ...sugestoes,
  ];
  for (const s of todas) {
    assert.ok(!/estão sem dado/.test(s.texto), `concordância quebrada: ${s.texto}`);
    // Delta/tendência falam do "o indicador \"…\"" (sujeito invariante).
    if (s.gatilho.includes('MEDIA') || s.gatilho.startsWith('TENDENCIA')) {
      assert.match(s.texto, /o indicador "/, `template não invariante: ${s.texto}`);
    }
  }
});
