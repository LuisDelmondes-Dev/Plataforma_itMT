// ============================================================
// modo.e2e.mjs — Gauntlet P4 (RN-MODO) + P8 (correlação)
// O parâmetro modo: 'pesquisa'|'xingu' de ponta a ponta:
//   - dois contratos de resposta (ranking_top reduzido vs dossiê completo);
//   - motor como ÚNICA fonte de número (ranking do envelope == endpoint P2);
//   - persistência obrigatória via PesquisasService, com hash verificável
//     na reabertura (hash_confere) e correlação por pesquisa_id;
//   - RN-005 intacto nos dois modos (SEM_DADO sem ranking/dossiê);
//   - retrocompatibilidade (sem modo => 'pesquisa') e 400 no modo inválido;
//   - determinismo do dossiê (2 execuções => JSON idêntico).
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import pg from 'pg';
// Mesma extração pt-BR do A06 — recomputo independente dos numerais (P7).
import { extrairNumerais } from '../dist/xingu/narrador.js';

const PORT = 4900 + (process.pid % 100);
const BASE = `http://localhost:${PORT}/v1`;
let api;

const PERGUNTA = 'Quantos leitos de UTI existem em Cuiabá?';
const PERGUNTA_SEM_DADO = 'População de Cuiabá em 2010?';

const perguntar = async (pergunta, corpo = {}) => {
  const r = await fetch(`${BASE}/xingu/pergunta`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pergunta, ...corpo }),
  });
  return { status: r.status, corpo: await r.json() };
};

const obter = async (rota) => {
  const r = await fetch(`${BASE}${rota}`);
  return { status: r.status, corpo: await r.json() };
};

before(async () => {
  api = spawn('node', ['dist/main.js'], {
    // XINGU_PROVEDOR=lexico: caminho determinístico primário (RG-05).
    env: { ...process.env, PORT: String(PORT), AGENTES_AUTO: '0', XINGU_PROVEDOR: 'lexico' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${BASE}/temas`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API não subiu.');
});
after(() => api?.kill());

// Respostas guardadas entre testes (mesma pergunta, modos distintos).
let respostaPesquisa;
let respostaXingu;

test('P4(a): mesma pergunta, dois contratos — ranking_top reduzido vs dossiê completo', async () => {
  const p = await perguntar(PERGUNTA, { modo: 'pesquisa' });
  const x = await perguntar(PERGUNTA, { modo: 'xingu' });
  respostaPesquisa = p.corpo;
  respostaXingu = x.corpo;

  // --- modo pesquisa: envelope atual + ranking_top, SEM dossiê ---
  assert.equal(p.status, 201);
  assert.equal(p.corpo.estado, 'RESPONDIDA');
  assert.equal(p.corpo.modo, 'pesquisa');
  assert.equal(p.corpo.dossie, undefined, 'modo pesquisa não carrega dossiê');
  const rt = p.corpo.ranking_top;
  assert.ok(rt, 'modo pesquisa carrega ranking_top');
  assert.equal(rt.tabela_completa, true);
  assert.ok(rt.municipios.length >= 1 && rt.municipios.length <= 5, `top-N deve ter 1..5 linhas (veio ${rt.municipios.length})`);
  assert.ok(rt.municipios.every((m) => m.top_n === true), 'ranking_top só contém linhas top_n');
  assert.equal(typeof rt.media_estadual, 'number');
  assert.equal(typeof rt.total_estadual, 'number', 'leitos de UTI é SOMA: total estadual existe');
  assert.equal(typeof rt.ausentes.total, 'number');
  assert.ok(!('codigos' in rt.ausentes), 'ausentes vem reduzido (só o total)');

  // --- modo xingu: envelope atual + dossiê, SEM ranking_top ---
  assert.equal(x.status, 201);
  assert.equal(x.corpo.estado, 'RESPONDIDA');
  assert.equal(x.corpo.modo, 'xingu');
  assert.equal(x.corpo.ranking_top, undefined, 'modo xingu não carrega ranking_top');
  const d = x.corpo.dossie;
  assert.ok(d, 'modo xingu carrega dossiê');
  assert.ok(Array.isArray(d.ranking.municipios) && d.ranking.municipios.length >= 1);
  assert.equal(
    d.ranking.municipios.length,
    d.ranking.total_municipios - d.ranking.ausentes.total,
    'ranking do dossiê é COMPLETO (todos os municípios com dado)',
  );
  assert.ok(d.ranking.municipios.every((m) => Number.isInteger(m.posicao) && typeof m.delta_media_estadual === 'number'));
  assert.ok(Array.isArray(d.serie.pontos) && d.serie.pontos.length >= 1, 'dossiê tem série histórica do recorte');
  assert.ok(d.comparacao && d.comparacao.municipio, 'recorte MUNICIPIO tem comparação');
  // Leitos de UTI não tem eixo de causas no motor: null + motivo com o
  // contexto devolvido pelo próprio motor (RN-005) — nunca bloco inventado.
  assert.equal(d.causas, null, 'sem eixo de causas para este indicador — nunca inventado');
  assert.match(d.causas_motivo, /Decomposição por causa ainda não disponível/);
  // Crítico P9: o motivo é genérico por área — nada de exemplo de saúde
  // (SIM/CID-10) vazando em dossiê de educação/finanças.
  assert.doesNotMatch(d.causas_motivo, /SIM\/CID-10/);
  // P7: o bloco de sugestões agora é produzido pelo A16 (asserts dedicados
  // no teste P7 abaixo — o placeholder "vazio até a P7" foi superado).
  assert.ok(Array.isArray(d.sugestoes), 'dossiê carrega array de sugestões (A16/P7)');

  // O plano é o MESMO nos dois modos: só a montagem varia (desenho da P4).
  assert.deepEqual(
    { recorte: p.corpo.plano.recorte, codigo: p.corpo.plano.codigo, indicador_id: p.corpo.plano.indicador_id },
    { recorte: x.corpo.plano.recorte, codigo: x.corpo.plano.codigo, indicador_id: x.corpo.plano.indicador_id },
  );
});

test('P4(b): os números do ranking batem com o endpoint do motor (fonte única)', async () => {
  const plano = respostaXingu.plano;
  const direto = await obter(
    `/indicadores/${plano.indicador_id}/ranking?referencia=${plano.periodo.referencia}&n=5`,
  );
  assert.equal(direto.status, 200);
  // Dossiê: ranking COMPLETO idêntico ao do motor, byte a byte.
  assert.deepEqual(respostaXingu.dossie.ranking, direto.corpo);
  // ranking_top: exatamente as linhas top_n do motor, sem recomputação.
  assert.deepEqual(
    respostaPesquisa.ranking_top.municipios,
    direto.corpo.municipios.filter((m) => m.top_n),
  );
  assert.equal(respostaPesquisa.ranking_top.media_estadual, direto.corpo.media_estadual);
  assert.equal(respostaPesquisa.ranking_top.total_estadual, direto.corpo.total_estadual);
  assert.equal(respostaPesquisa.ranking_top.ausentes.total, direto.corpo.ausentes.total);
});

test('P4(c): ambas gravaram "Pesquisa"; reabertura confere hash e campos', async () => {
  assert.ok(respostaPesquisa.pesquisa_id, 'resposta carrega pesquisa_id');
  assert.ok(respostaXingu.pesquisa_id, 'resposta carrega pesquisa_id');
  assert.notEqual(respostaPesquisa.pesquisa_id, respostaXingu.pesquisa_id);

  const lista = await obter('/pesquisas?limite=100');
  assert.equal(lista.status, 200);
  const daPergunta = lista.corpo.pesquisas.filter((p) => p.pergunta === PERGUNTA);
  assert.deepEqual(
    new Set(daPergunta.map((p) => p.modo)),
    new Set(['pesquisa', 'xingu']),
    'a lista tem as duas pesquisas, com modos distintos',
  );

  for (const resposta of [respostaPesquisa, respostaXingu]) {
    const { status, corpo: reaberta } = await obter(`/pesquisas/${resposta.pesquisa_id}`);
    assert.equal(status, 200);
    assert.equal(reaberta.hash_confere, true, 'sha256 recomputado do banco confere com o selo');
    assert.equal(reaberta.modo, resposta.modo);
    assert.equal(reaberta.pergunta, PERGUNTA);
    assert.equal(reaberta.estado, 'RESPONDIDA');
    assert.equal(reaberta.recorte, resposta.plano.recorte);
    assert.equal(reaberta.codigo, resposta.plano.codigo);
    // O indicador persistido é o mesmo valor exibido na resposta original.
    assert.equal(reaberta.indicadores.length, 1);
    assert.equal(reaberta.indicadores[0].indicadorId, resposta.plano.indicador_id);
    assert.equal(reaberta.indicadores[0].valor, resposta.valores[0].valor);
    // Execuções das etapas do pipeline correlacionadas à pesquisa (P8).
    const agentes = reaberta.execucoes.map((e) => e.agente);
    for (const a of ['A04', 'A05', 'A06']) assert.ok(agentes.includes(a), `execução ${a} registrada`);
    assert.ok(reaberta.execucoes.every((e) => Number.isInteger(e.duracaoMs) && e.duracaoMs >= 0));
  }

  // Municípios persistidos = ranking completo do motor (nos DOIS modos).
  const reabertaX = (await obter(`/pesquisas/${respostaXingu.pesquisa_id}`)).corpo;
  assert.equal(
    reabertaX.indicadores[0].municipios.length,
    respostaXingu.dossie.ranking.municipios.length,
  );
  // Série persistida (codigoIbge null = recorte principal) = série do dossiê.
  assert.deepEqual(
    reabertaX.indicadores[0].serie.map((s) => ({ ano: s.ano, valor: s.valor })),
    respostaXingu.dossie.serie.pontos,
  );
  // Dashboards implicados por modo.
  const reabertaP = (await obter(`/pesquisas/${respostaPesquisa.pesquisa_id}`)).corpo;
  assert.deepEqual(reabertaP.dashboards.map((d) => d.tipo), ['CARD', 'BARRAS', 'TABELA']);
  assert.deepEqual(reabertaX.dashboards.map((d) => d.tipo), ['CARD', 'MAPA', 'SERIE', 'TABELA', 'COMPARACAO']);
  // Procedência congelada com FonteId resolvido.
  assert.ok(reabertaP.fontes.length >= 1 && reabertaP.fontes.every((f) => Number.isInteger(f.fonteId)));
});

test('P8: CONSULTA_CHAT carrega pesquisa_id na trilha imutável', async () => {
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();
  try {
    const r = await cliente.query(
      `SELECT "EventoAuditoria_Payload" AS payload
         FROM "EventoAuditoria"
        WHERE "EventoAuditoria_Acao" = 'CONSULTA_CHAT'
        ORDER BY "EventoAuditoria_Id" DESC LIMIT 10`,
    );
    assert.ok(r.rows.length >= 2);
    const ids = r.rows.map((x) => x.payload?.pesquisa_id).filter(Boolean);
    assert.ok(ids.includes(respostaPesquisa.pesquisa_id), 'evento correlaciona a pesquisa do modo pesquisa');
    assert.ok(ids.includes(respostaXingu.pesquisa_id), 'evento correlaciona a pesquisa do modo xingu');
    // A ponta da cadeia: o pesquisa_id do evento existe em "Pesquisa".
    const p = await cliente.query(
      `SELECT count(*)::int AS n FROM "Pesquisa" WHERE "Pesquisa_Id" = ANY($1::uuid[])`,
      [[respostaPesquisa.pesquisa_id, respostaXingu.pesquisa_id]],
    );
    assert.equal(p.rows[0].n, 2);
  } finally {
    await cliente.end();
  }
});

test('P4(d): RN-005 nos dois modos — SEM_DADO sem ranking, sem dossiê, e persistida', async () => {
  for (const modo of ['pesquisa', 'xingu']) {
    const { status, corpo } = await perguntar(PERGUNTA_SEM_DADO, { modo });
    assert.equal(status, 201);
    assert.equal(corpo.estado, 'SEM_DADO');
    assert.equal(corpo.modo, modo);
    assert.equal(corpo.ranking_top, undefined, 'SEM_DADO nunca monta ranking');
    assert.equal(corpo.dossie, undefined, 'SEM_DADO nunca monta dossiê');
    assert.match(corpo.resposta, /referência mais recente/);
    // Persistida mesmo assim (toda execução vira snapshot).
    const reaberta = await obter(`/pesquisas/${corpo.pesquisa_id}`);
    assert.equal(reaberta.status, 200);
    assert.equal(reaberta.corpo.estado, 'SEM_DADO');
    assert.equal(reaberta.corpo.hash_confere, true);
    assert.deepEqual(reaberta.corpo.indicadores, [], 'SEM_DADO não persiste indicador calculado');
  }
});

test('P4(e): modo inválido é 400; sem modo comporta-se como pesquisa', async () => {
  const invalido = await perguntar(PERGUNTA, { modo: 'turbo' });
  assert.equal(invalido.status, 400);

  const semModo = await perguntar(PERGUNTA);
  assert.equal(semModo.corpo.estado, 'RESPONDIDA');
  assert.equal(semModo.corpo.modo, 'pesquisa', 'ausente => pesquisa (retrocompatibilidade)');
  assert.ok(semModo.corpo.ranking_top);
  assert.equal(semModo.corpo.dossie, undefined);
});

test('P7: sugestões do A16 — factuais sem polaridade, persistidas com FK; modo pesquisa nunca tem', async () => {
  const d = respostaXingu.dossie;
  const plano = respostaXingu.plano;

  // Leitos de UTI: Cuiabá acima da média (fato) + município sem dado ⇒ os
  // gatilhos factual e de cobertura disparam com práticas da área GERAL.
  assert.ok(d.sugestoes.length >= 1, 'gatilhos factuais deveriam produzir sugestões');
  assert.equal(d.sugestoes_motivo, undefined, 'com sugestões, o motivo sai do dossiê');

  const linha = d.ranking.municipios.find((m) => m.codigo_ibge === plano.codigo);
  assert.ok(linha, 'Cuiabá está no ranking do dossiê');

  // Conjunto autorizado recomputado de forma independente: numerais que o
  // motor publicou (valor, média, delta, ano do dado, cobertura) + numerais
  // de metadados determinísticos visíveis no envelope (prática, fonte,
  // indicador, unidade, local). Qualquer outro numeral é intruso (RG-03).
  const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const autorizados = new Set();
  const add = (s) => { if (s != null) for (const n of extrairNumerais(String(s))) autorizados.add(n); };
  add(fmt.format(linha.valor));
  add(fmt.format(d.ranking.media_estadual));
  add(fmt.format(Math.abs(linha.delta_media_estadual)));
  add(linha.procedencia[0]?.data_referencia.slice(0, 4));
  add(fmt.format(d.ranking.ausentes.total));
  add(fmt.format(d.ranking.total_municipios));
  add(d.ranking.indicador); add(d.ranking.unidade); add(d.serie.local);

  const tipos = new Set();
  for (const s of d.sugestoes) {
    assert.ok(s.texto && s.pratica_citada && s.fonte_referencia && s.gatilho, 'sugestão completa');
    assert.ok(['RANKING_MUNICIPIO', 'INDICADOR', 'CAUSA', 'SERIE'].includes(s.origem.tipo));
    assert.equal(s.origem.indicadorId, plano.indicador_id, 'origem aponta o indicador do plano');
    tipos.add(s.origem.tipo);
    // Sem polaridade no catálogo, o A16 NÃO julga: nada de "desfavorável".
    assert.ok(!/desfavor/i.test(s.texto), `sem polaridade o texto é neutro: ${s.texto}`);
    add(s.pratica_citada); add(s.fonte_referencia);
    const intrusos = extrairNumerais(s.texto).filter(
      (n) => ![...autorizados].some((a) => Math.abs(a - n) < 1e-9),
    );
    assert.deepEqual(intrusos, [], `numeral intruso na sugestão: ${s.texto}`);
  }
  assert.ok(tipos.has('RANKING_MUNICIPIO'), 'o desvio de Cuiabá vira sugestão com origem municipal');

  // Persistência (db/48): reabertura devolve as sugestões com a ORIGEM
  // resolvida (FK ⇒ indicador do catálogo + município) e o selo confere.
  const reaberta = (await obter(`/pesquisas/${respostaXingu.pesquisa_id}`)).corpo;
  assert.equal(reaberta.hash_confere, true, 'sugestões entram no hash e o selo confere');
  assert.equal(reaberta.sugestoes.length, d.sugestoes.length);
  const municipal = reaberta.sugestoes.find((s) => s.origem.codigoIbge === plano.codigo);
  assert.ok(municipal, 'sugestão municipal reaberta com codigoIbge da FK');
  assert.equal(municipal.origem.indicadorId, plano.indicador_id);
  for (const s of reaberta.sugestoes) {
    assert.equal(s.agente, 'a16-sugestoes');
    assert.ok(s.praticaCitada, 'prática citada persistida');
  }

  // Banco: o CHECK de origem obrigatória está satisfeito linha a linha —
  // toda sugestão tem FK para o dado do motor (municipal OU indicador).
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();
  try {
    const r = await cliente.query(
      `SELECT "PesquisaSugestao_PesquisaIndicadorMunicipioId" AS fk_mun,
              "PesquisaSugestao_PesquisaIndicadorId" AS fk_ind
         FROM "PesquisaSugestao" WHERE "PesquisaSugestao_PesquisaId" = $1`,
      [respostaXingu.pesquisa_id],
    );
    assert.equal(r.rows.length, d.sugestoes.length);
    for (const row of r.rows) assert.ok(row.fk_mun !== null || row.fk_ind !== null, 'sugestão órfã é impossível');
    assert.ok(r.rows.some((row) => row.fk_mun !== null), 'a origem municipal usa a FK da linha do município');
  } finally {
    await cliente.end();
  }

  // Modo pesquisa NUNCA tem sugestões — nem no envelope, nem persistidas.
  assert.equal(respostaPesquisa.dossie, undefined);
  const reabertaP = (await obter(`/pesquisas/${respostaPesquisa.pesquisa_id}`)).corpo;
  assert.deepEqual(reabertaP.sugestoes, [], 'modo pesquisa não persiste sugestão');
});

test('P4(f): determinismo — duas execuções no modo xingu geram dossiês idênticos', async () => {
  const a = await perguntar(PERGUNTA, { modo: 'xingu' });
  const b = await perguntar(PERGUNTA, { modo: 'xingu' });
  assert.equal(a.corpo.estado, 'RESPONDIDA');
  assert.equal(
    JSON.stringify(a.corpo.dossie),
    JSON.stringify(b.corpo.dossie),
    'o dossiê é 100% motor: nenhuma variação entre execuções',
  );
  // E cada execução é uma pesquisa própria (snapshot por execução).
  assert.notEqual(a.corpo.pesquisa_id, b.corpo.pesquisa_id);
});
