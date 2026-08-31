// ============================================================
// golden.unit.mjs — Evolução E6 (ADR-010, db/61): golden set persistido.
// Prova, contra o banco descartável da suíte e SEM subir a API (as funções
// puras/persistentes vivem em scripts/lib-golden.mjs exatamente para isso):
//   1. contrato de grants: "GoldenPergunta" upsert-ável (SELECT/INSERT/UPDATE,
//      nunca DELETE); "GoldenAvaliacao" append-only (SELECT/INSERT, nunca
//      UPDATE/DELETE);
//   2. fallback RG-05-like: tabela vazia OU sem DATABASE_URL ⇒ carregarCasos
//      cai para o JSON derivado;
//   3. upsert idempotente por código: rodar 2× não duplica nem toca
//      AtualizadaEm de linha idêntica;
//   4. pergunta que sai do catálogo vira Ativa=false — nunca some; CURADA é
//      intocada pelo gerador;
//   5. avaliação é append-only DE FATO: UPDATE/DELETE por SQL direto como
//      itmt_app falham com 42501 (padrão least-privilege da casa);
//   6. registrar duas rodadas e detectar regressão via
//      compararComRodadaAnterior (o ganho real da persistência);
//   7. avaliarCaso e gerarCasos são puras e preservam o contrato histórico.
// Tudo que o arquivo cria é removido no after() (banco compartilhado pelas
// suítes serializadas).
// ============================================================
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import {
  avaliarCaso, carregarCasos, codigoDePergunta, compararComRodadaAnterior,
  gerarCasos, registrarAvaliacoes, upsertPerguntas,
} from '../scripts/lib-golden.mjs';

let owner; // dono (DATABASE_URL da suíte) — verificação de catálogo e limpeza
let app;   // itmt_app — o papel real de quem grava, sujeito só aos grants
let tmp;   // diretório do JSON de fallback

const caso = (pergunta, esperado, categoria, ordem) => ({
  codigo: codigoDePergunta(pergunta), pergunta, esperado, categoria, ordem,
});
const CASOS = [
  caso('E6 golden: quantos leitos de UTI existem em Cuiabá?', { recorte: 'MUNICIPIO', codigo: '5103403', indicador_id: 1 }, 'municipio', 0),
  caso('E6 golden: qual a população de Mato Grosso?', { recorte: 'ESTADO', codigo: null, indicador_id: 2 }, 'estado', 1),
  caso('E6 golden: me fale sobre Sinop.', { clarificacao: true }, 'ambiguidade', 2),
];
const CURADA = caso('E6 golden CURADA: pergunta mantida à mão?', { bloqueio: true }, 'curada', 99);

before(async () => {
  owner = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const appUrl = new URL(process.env.DATABASE_URL);
  appUrl.username = 'itmt_app';
  appUrl.password = 'itmt_app';
  app = new pg.Client({ connectionString: appUrl.toString() });
  await owner.connect();
  await app.connect();
  tmp = mkdtempSync(join(tmpdir(), 'golden-e6-'));
});

after(async () => {
  const codigos = [...CASOS.map((c) => c.codigo), CURADA.codigo];
  await owner?.query(`DELETE FROM "GoldenAvaliacao" WHERE "GoldenAvaliacao_PerguntaCodigo" = ANY($1)`, [codigos]);
  await owner?.query(`DELETE FROM "GoldenPergunta" WHERE "GoldenPergunta_Codigo" = ANY($1)`, [codigos]);
  rmSync(tmp, { recursive: true, force: true });
  await app?.end();
  await owner?.end();
});

test('db/61: contrato de grants — pergunta upsert-ável sem DELETE; avaliação append-only', async () => {
  const r = await owner.query(`
    SELECT has_table_privilege('itmt_app','"GoldenPergunta"','SELECT')  AS p_sel,
           has_table_privilege('itmt_app','"GoldenPergunta"','INSERT')  AS p_ins,
           has_table_privilege('itmt_app','"GoldenPergunta"','UPDATE')  AS p_upd,
           has_table_privilege('itmt_app','"GoldenPergunta"','DELETE')  AS p_del,
           has_table_privilege('itmt_app','"GoldenAvaliacao"','SELECT') AS a_sel,
           has_table_privilege('itmt_app','"GoldenAvaliacao"','INSERT') AS a_ins,
           has_table_privilege('itmt_app','"GoldenAvaliacao"','UPDATE') AS a_upd,
           has_table_privilege('itmt_app','"GoldenAvaliacao"','DELETE') AS a_del`);
  assert.deepEqual(r.rows[0], {
    p_sel: true, p_ins: true, p_upd: true, p_del: false,
    a_sel: true, a_ins: true, a_upd: false, a_del: false,
  });
});

test('E6: fallback para o JSON quando a tabela está vazia ou sem DATABASE_URL (RG-05-like)', async () => {
  const caminhoJson = join(tmp, 'golden-set.json');
  writeFileSync(caminhoJson, JSON.stringify({
    total: 2,
    casos: [
      { pergunta: 'Fallback A?', esperado: { clarificacao: true }, categoria: 'ambiguidade' },
      { pergunta: 'Fallback B?', esperado: { bloqueio: true }, categoria: 'injecao' },
    ],
  }));
  // sem DATABASE_URL
  const semDb = await carregarCasos({ databaseUrl: null, caminhoJson });
  assert.equal(semDb.origem, 'json');
  assert.equal(semDb.casos.length, 2);
  assert.equal(semDb.casos[0].codigo, codigoDePergunta('Fallback A?'), 'código deve ser derivado do texto no fallback');
  // com DATABASE_URL mas tabela vazia (nenhuma suíte semeia GoldenPergunta)
  const vazio = await carregarCasos({ databaseUrl: process.env.DATABASE_URL, caminhoJson });
  assert.equal(vazio.origem, 'json', 'tabela vazia deve degradar para o JSON');
});

test('E6: upsert idempotente por código — rodar 2× não duplica nem toca linha idêntica', async () => {
  const r1 = await upsertPerguntas(app, CASOS);
  assert.deepEqual(
    { inseridas: r1.inseridas, atualizadas: r1.atualizadas, desativadas: r1.desativadas },
    { inseridas: 3, atualizadas: 0, desativadas: 0 },
  );
  const antes = await owner.query(
    `SELECT "GoldenPergunta_Codigo" AS codigo, "GoldenPergunta_AtualizadaEm" AS em
       FROM "GoldenPergunta" WHERE "GoldenPergunta_Codigo" = ANY($1) ORDER BY 1`,
    [CASOS.map((c) => c.codigo)],
  );
  assert.equal(antes.rows.length, 3);

  const r2 = await upsertPerguntas(app, CASOS);
  assert.deepEqual(
    { inseridas: r2.inseridas, atualizadas: r2.atualizadas, desativadas: r2.desativadas },
    { inseridas: 0, atualizadas: 0, desativadas: 0 },
    'segunda rodada idêntica não deve inserir, atualizar nem desativar nada',
  );
  const depois = await owner.query(
    `SELECT "GoldenPergunta_Codigo" AS codigo, "GoldenPergunta_AtualizadaEm" AS em
       FROM "GoldenPergunta" WHERE "GoldenPergunta_Codigo" = ANY($1) ORDER BY 1`,
    [CASOS.map((c) => c.codigo)],
  );
  assert.deepEqual(depois.rows, antes.rows, 'AtualizadaEm não pode mudar em rodada idêntica');
  // e o banco agora é fonte de verdade para carregarCasos
  const doBanco = await carregarCasos({ databaseUrl: process.env.DATABASE_URL, caminhoJson: join(tmp, 'golden-set.json') });
  assert.equal(doBanco.origem, 'banco');
  assert.deepEqual(doBanco.casos.map((c) => c.codigo), CASOS.map((c) => c.codigo));
});

test('E6: pergunta que sai do catálogo vira Ativa=false (nunca some); CURADA é intocada', async () => {
  await owner.query(
    `INSERT INTO "GoldenPergunta"
       ("GoldenPergunta_Codigo","GoldenPergunta_Pergunta","GoldenPergunta_Esperado",
        "GoldenPergunta_Categoria","GoldenPergunta_Origem","GoldenPergunta_Ordem")
     VALUES ($1,$2,$3::jsonb,$4,'CURADA',$5)
     ON CONFLICT ("GoldenPergunta_Codigo") DO NOTHING`,
    [CURADA.codigo, CURADA.pergunta, JSON.stringify(CURADA.esperado), CURADA.categoria, CURADA.ordem],
  );

  const subconjunto = CASOS.slice(0, 2); // o 3º caso "saiu do catálogo"
  const r = await upsertPerguntas(app, subconjunto);
  assert.equal(r.desativadas, 1, 'exatamente a pergunta ausente deve ser desativada');

  const estado = await owner.query(
    `SELECT "GoldenPergunta_Codigo" AS codigo, "GoldenPergunta_Ativa" AS ativa,
            "GoldenPergunta_Origem" AS origem
       FROM "GoldenPergunta" WHERE "GoldenPergunta_Codigo" = ANY($1) ORDER BY "GoldenPergunta_Ordem"`,
    [[...CASOS.map((c) => c.codigo), CURADA.codigo]],
  );
  assert.equal(estado.rows.length, 4, 'nenhuma linha pode sumir');
  assert.deepEqual(
    estado.rows.map((x) => x.ativa),
    [true, true, false, true],
    'ausente inativa; CURADA segue ativa mesmo fora do conjunto gerado',
  );
  assert.equal(estado.rows[3].origem, 'CURADA');

  // reentrada no catálogo reativa (UPDATE, não INSERT novo)
  const volta = await upsertPerguntas(app, CASOS);
  assert.deepEqual({ inseridas: volta.inseridas, atualizadas: volta.atualizadas }, { inseridas: 0, atualizadas: 1 });
});

test('E6: "GoldenAvaliacao" é append-only de fato — UPDATE/DELETE como itmt_app falham (42501)', async () => {
  await registrarAvaliacoes(app, '2026-08-28T00:00:00.000Z', [
    { codigo: CASOS[0].codigo, resultado: 'CORRETO', detalhe: null, provedor: 'lexico', latenciaMs: 12 },
  ]);
  await assert.rejects(
    app.query(`UPDATE "GoldenAvaliacao" SET "GoldenAvaliacao_Resultado" = 'INCORRETO'
                WHERE "GoldenAvaliacao_PerguntaCodigo" = $1`, [CASOS[0].codigo]),
    (e) => e.code === '42501',
    'reescrever o histórico deveria ser vetado por grant',
  );
  await assert.rejects(
    app.query(`DELETE FROM "GoldenAvaliacao" WHERE "GoldenAvaliacao_PerguntaCodigo" = $1`, [CASOS[0].codigo]),
    (e) => e.code === '42501',
    'apagar o histórico deveria ser vetado por grant',
  );
});

test('E6: duas rodadas persistidas e a regressão é detectada na comparação', async () => {
  const r1 = '2026-08-28T01:00:00.000Z';
  const r2 = '2026-08-28T02:00:00.000Z';
  await registrarAvaliacoes(app, r1, [
    { codigo: CASOS[0].codigo, resultado: 'CORRETO', detalhe: null, provedor: 'lexico', latenciaMs: 10 },
    { codigo: CASOS[1].codigo, resultado: 'CORRETO', detalhe: null, provedor: 'lexico', latenciaMs: 11 },
    { codigo: CASOS[2].codigo, resultado: 'INCORRETO', detalhe: { estado: 'RESPONDIDA' }, provedor: 'lexico', latenciaMs: 9 },
  ]);
  await registrarAvaliacoes(app, r2, [
    { codigo: CASOS[0].codigo, resultado: 'CORRETO', detalhe: null, provedor: 'lexico', latenciaMs: 10 },
    { codigo: CASOS[1].codigo, resultado: 'INCORRETO', detalhe: { estado: 'SEM_DADO', plano_obtido: null }, provedor: 'lexico', latenciaMs: 14 },
    { codigo: CASOS[2].codigo, resultado: 'CORRETO', detalhe: null, provedor: 'lexico', latenciaMs: 8 },
  ]);
  const cmp = await compararComRodadaAnterior(app, r2);
  assert.ok(cmp, 'deve haver rodada anterior');
  assert.equal(cmp.anterior.rodada, r1);
  assert.deepEqual({ total: cmp.atual.total, corretos: cmp.atual.corretos }, { total: 3, corretos: 2 });
  assert.deepEqual(cmp.regressoes.map((x) => x.codigo), [CASOS[1].codigo], 'só a pergunta que era correta e deixou de ser é regressão');
});

test('E6: avaliarCaso pura preserva o contrato histórico (bloqueio/clarificação/plano/veto KR3.2)', () => {
  assert.equal(avaliarCaso({ bloqueio: true }, { estado: 'BLOQUEADA' }), true);
  assert.equal(avaliarCaso({ bloqueio: true }, { estado: 'RESPONDIDA' }), false);
  assert.equal(avaliarCaso({ clarificacao: true }, { estado: 'CLARIFICACAO' }), true);
  const esperado = { recorte: 'MUNICIPIO', codigo: '5103403', indicador_id: 1 };
  const plano = { recorte: 'MUNICIPIO', codigo: '5103403', indicador_id: 1 };
  assert.equal(avaliarCaso(esperado, { estado: 'RESPONDIDA', plano, resposta: 'ok', auditoria: { vetos: 0 } }), true);
  assert.equal(avaliarCaso(esperado, { estado: 'SEM_DADO', plano }), true, 'SEM_DADO com plano certo é acerto (RN-005)');
  assert.equal(avaliarCaso(esperado, { estado: 'RESPONDIDA', plano: { ...plano, codigo: '5108402' }, resposta: 'x' }), false);
  assert.equal(
    avaliarCaso(esperado, { estado: 'RESPONDIDA', plano, resposta: null, auditoria: { vetos: 2 } }),
    false,
    'KR3.2: resposta vetada pelo A06 sem texto não pode contar como acerto',
  );
});

test('E6: gerarCasos pura — códigos únicos, ordem canônica e categorias terminais presentes', () => {
  const casos = gerarCasos({
    municipios: [{ codigo: '5103403', nome: 'Cuiabá' }, { codigo: '5108402', nome: 'Várzea Grande' }],
    rgints: [{ codigo: '5101', nome: 'Cuiabá' }],
    consorcios: [{ codigo: '1', nome: 'Vale do Rio Cuiabá' }],
    indicadores: [
      { id: 1, nome: 'Leitos de UTI', tipo: 'SOMA' },
      { id: 2, nome: 'População estimada', tipo: 'SOMA' },
    ],
  }, 40);
  assert.equal(new Set(casos.map((c) => c.codigo)).size, casos.length, 'códigos devem ser únicos após deduplicação');
  assert.deepEqual(casos.map((c) => c.ordem), casos.map((_, i) => i), 'ordem é a posição canônica de geração');
  for (const cat of ['municipio', 'estado', 'rgint', 'consorcio', 'periodo', 'ambiguidade', 'injecao']) {
    assert.ok(casos.some((c) => c.categoria === cat), `categoria ${cat} ausente`);
  }
  assert.ok(casos.every((c) => c.codigo === codigoDePergunta(c.pergunta)));
});
