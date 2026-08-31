// ============================================================
// dimensoes.unit.mjs — Evolução E1 (db/54 · CATALOGO-DIMENSOES).
//
// O crítico de generalidade do gauntlet registrou (RELATORIO-FINAL.md,
// "Gaps que ficaram"): o vocabulário de dimensões de causa era FECHADO —
// CHECK em db/48/49 + union type/allowlist/rótulos em 4 pontos de código.
// A E1 move o vocabulário para o catálogo "DimensaoObservacao" (db/54) e
// este arquivo é a PROVA DE EXTENSIBILIDADE que dá sentido à evolução:
//
//   (a) as 3 dimensões seedadas existem com os rótulos/ordem exatos que o
//       A16 usava hardcoded; o comportamento do motor é idêntico (mesmas 3
//       dimensões no estado, determinismo byte a byte, delegação da taxa);
//       os CHECKs antigos sumiram e as FKs novas existem; itmt_app só lê;
//   (b) inserir POR SQL uma 4ª dimensão ('FUNCAO_GOVERNO') + linhas de
//       "ObservacaoCausa" ⇒ causas() a devolve, o A16 usa o rótulo do
//       BANCO ('função de governo') no texto, sem prática nenhuma o A16
//       fica em silêncio (fail-closed), e a persistência de pesquisas
//       grava "PesquisaCausa" com o código novo — TUDO sem uma linha de
//       código alterada;
//   (c) código inexistente ⇒ FK rejeita por SQL direto (23503) e os
//       services respondem 400 honesto (motor lista os códigos vigentes;
//       pesquisas nomeia o catálogo);
//   (d) regressão fica com causas.unit.mjs e sugestoes.unit.mjs, intactos.
//
// PADRÃO: banco-direto como causas.unit.mjs — node:test + pg no
// DATABASE_URL de um banco DESCARTÁVEL migrado (db/01..54), serviços
// COMPILADOS de dist/. NUNCA aponte para o banco dev. O fixture da 4ª
// dimensão é REMOVIDO no after(): o banco é compartilhado pelas suítes e
// causas.unit.mjs assume exatamente 3 dimensões no recorte estadual.
//
// NOTA DE CACHE (honestidade): os catálogos são cacheados 60s por
// INSTÂNCIA de serviço; depois de inserir a 4ª dimensão o teste instancia
// serviços NOVOS — em produção a curadoria por migração convive com até
// 60s de janela, igual ao catálogo de práticas (db/51).
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { IndicadoresService } from '../dist/indicadores/indicadores.service.js';
import { TerritorioService } from '../dist/territorio/territorio.service.js';
import { AuditoriaService } from '../dist/auditoria/auditoria.service.js';
import { SugestoesService, gerarSugestoes } from '../dist/xingu/sugestoes.service.js';
import { PesquisasService } from '../dist/pesquisas/pesquisas.service.js';

const REF = '2024-12-31';
const NOMES = ['Óbitos infantis', 'Nascidos vivos', 'Taxa de mortalidade infantil'];
const SEED = [
  { codigo: 'CAPITULO_CID10', nome: 'capítulo CID-10', ordem: 1 },
  { codigo: 'CAUSA_EVITAVEL', nome: 'causas evitáveis', ordem: 2 },
  { codigo: 'COMPONENTE', nome: 'componente etário', ordem: 3 },
];
const NOVA = { codigo: 'FUNCAO_GOVERNO', nome: 'função de governo', ordem: 4 };
// Contexto plataforma (db/25) — o mesmo de pesquisas.unit.mjs.
const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';

let pool;   // dono (DATABASE_URL da suíte)
let ids = {};
let fonteId; // fonte real das linhas de db/50, reusada pelo fixture

const fabricarDb = (p) => ({
  query: (sql, params = []) => p.query(sql, params),
  currentTransactionClient: () => undefined,
  withClient: async (fn) => {
    const client = await p.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  },
});

function fabricarMotor() {
  const db = fabricarDb(pool);
  return new IndicadoresService(
    db, new TerritorioService(db), new AuditoriaService(db),
    { garantirParaIndicador: async () => false }, // teste não vai à internet
  );
}

before(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  // Gate humano (RG-09) simulado SÓ no banco descartável (idempotente —
  // mesmo rito de causas.unit.mjs).
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
  fonteId = (await pool.query(
    `SELECT "ObservacaoCausa_FonteId" AS id FROM "ObservacaoCausa" LIMIT 1`,
  )).rows[0]?.id;
  assert.ok(fonteId, 'db/50 deveria ter linhas de ObservacaoCausa com fonte');
});

after(async () => {
  // O banco é compartilhado pelas suítes: o fixture da 4ª dimensão sai por
  // completo (linhas de dado primeiro, por causa da FK).
  await pool.query(`DELETE FROM "ObservacaoCausa" WHERE "ObservacaoCausa_Dimensao"=$1`, [NOVA.codigo]);
  await pool.query(`DELETE FROM "DimensaoObservacao" WHERE "DimensaoObservacao_Codigo"=$1`, [NOVA.codigo]);
  await pool.end();
});

test('(a) seed: as 3 dimensões existem com os rótulos e a ordem EXATOS do A16 pré-E1', async () => {
  const r = await pool.query(
    `SELECT "DimensaoObservacao_Codigo" AS codigo, "DimensaoObservacao_Nome" AS nome,
            "DimensaoObservacao_Ordem"::int AS ordem, "DimensaoObservacao_Ativa" AS ativa,
            "DimensaoObservacao_Versao"::int AS versao
       FROM "DimensaoObservacao"
      WHERE "DimensaoObservacao_Codigo" = ANY($1)
      ORDER BY "DimensaoObservacao_Ordem"`,
    [SEED.map((s) => s.codigo)],
  );
  assert.deepEqual(
    r.rows.map(({ codigo, nome, ordem }) => ({ codigo, nome, ordem })),
    SEED,
    'seed de db/54 divergiu do vocabulário/rótulos que o código usava (ratchet de determinismo)',
  );
  for (const linha of r.rows) {
    assert.equal(linha.ativa, true);
    assert.equal(linha.versao, 1);
  }
});

test('(a) contrato de banco: CHECKs antigos substituídos por FK; itmt_app só lê o catálogo', async () => {
  // Nenhum CHECK sobre *_Dimensao sobrou nas duas tabelas...
  const checks = await pool.query(
    `SELECT conrelid::regclass::text AS tabela, conname
       FROM pg_constraint
      WHERE contype='c'
        AND conrelid IN ('"ObservacaoCausa"'::regclass,'"PesquisaCausa"'::regclass)
        AND pg_get_constraintdef(oid) LIKE '%\\_Dimensao"%' ESCAPE '\\'`,
  );
  assert.deepEqual(checks.rows, [], 'db/54 deveria ter derrubado os CHECKs de vocabulário fixo');
  // ...e as FKs nomeadas existem, apontando para o catálogo.
  const fks = await pool.query(
    `SELECT conname, confrelid::regclass::text AS alvo
       FROM pg_constraint WHERE conname IN ('observacaocausa_dimensao_fk','pesquisacausa_dimensao_fk')
      ORDER BY conname`,
  );
  assert.deepEqual(fks.rows, [
    { conname: 'observacaocausa_dimensao_fk', alvo: '"DimensaoObservacao"' },
    { conname: 'pesquisacausa_dimensao_fk', alvo: '"DimensaoObservacao"' },
  ]);
  // Catálogo global: aplicação só lê; curadoria é migração (como PraticaGestao).
  const grants = await pool.query(
    `SELECT has_table_privilege('itmt_app','"DimensaoObservacao"','SELECT') AS s,
            has_table_privilege('itmt_app','"DimensaoObservacao"','INSERT') AS i,
            has_table_privilege('itmt_app','"DimensaoObservacao"','UPDATE') AS u,
            has_table_privilege('itmt_app','"DimensaoObservacao"','DELETE') AS d`,
  );
  assert.deepEqual(grants.rows[0], { s: true, i: false, u: false, d: false });
});

test('(a) comportamento idêntico: estado com as MESMAS 3 dimensões, determinismo e delegação intactos', async () => {
  const motor = fabricarMotor();
  const estado = await motor.causas({ indicadorId: ids['Óbitos infantis'], referencia: REF });
  assert.deepEqual(
    estado.dimensoes.map((d) => d.dimensao).sort(),
    SEED.map((s) => s.codigo).sort(),
    'o recorte estadual deveria seguir com exatamente as 3 dimensões seedadas',
  );
  // Determinismo byte a byte (mesma âncora de causas.unit.mjs).
  const a = JSON.stringify(await motor.causas({ indicadorId: ids['Óbitos infantis'], referencia: REF }));
  const b = JSON.stringify(await motor.causas({ indicadorId: ids['Óbitos infantis'], referencia: REF }));
  assert.equal(a, b);
  // A taxa (RECALCULO) segue delegando ao numerador.
  const taxa = await motor.causas({ indicadorId: ids['Taxa de mortalidade infantil'], referencia: REF });
  assert.equal(taxa.decomposicao_de, 'Óbitos infantis');
  assert.deepEqual(taxa.dimensoes, estado.dimensoes);
});

test('(c) 400 honesto do motor: ?dimensao fora do catálogo lista os códigos VIGENTES (do banco)', async () => {
  const motor = fabricarMotor();
  await assert.rejects(
    motor.causas({ indicadorId: ids['Óbitos infantis'], referencia: REF, dimensao: 'NAO_EXISTE' }),
    (e) => (typeof e?.getStatus === 'function' ? e.getStatus() : e?.status) === 400
      && /dimensao deve ser uma de: CAPITULO_CID10, CAUSA_EVITAVEL, COMPONENTE/.test(e?.message),
    'a allowlist do erro deveria vir do catálogo db/54, não de lista fixa',
  );
});

test('(c) FK: código inexistente é rejeitado no BANCO (23503), por SQL direto inclusive', async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO "ObservacaoCausa"
         ("ObservacaoCausa_IndicadorId","ObservacaoCausa_DataReferencia","ObservacaoCausa_Dimensao",
          "ObservacaoCausa_Categoria","ObservacaoCausa_Valor","ObservacaoCausa_FonteId")
       VALUES ($1,$2,'NAO_EXISTE','x',1,$3)`,
      [ids['Óbitos infantis'], REF, fonteId],
    ),
    // Mensagem do Postgres é localizada; código SQLSTATE + nome do
    // constraint são o contrato estável (mesmo racional de pesquisas.unit).
    (e) => e.code === '23503' && e.constraint === 'observacaocausa_dimensao_fk',
  );
});

test('(b) EXTENSIBILIDADE: 4ª dimensão por SQL ⇒ motor, A16 e pesquisas a aceitam SEM mudança de código', async () => {
  // Curadoria simulada: uma linha de catálogo + duas de dado (recorte
  // estadual, CodigoIbge NULL), como uma migração db/NN faria.
  await pool.query(
    `INSERT INTO "DimensaoObservacao"
       ("DimensaoObservacao_Codigo","DimensaoObservacao_Nome","DimensaoObservacao_Descricao","DimensaoObservacao_Ordem")
     VALUES ($1,$2,'Dimensão fictícia da prova de extensibilidade (E1).',$3)`,
    [NOVA.codigo, NOVA.nome, NOVA.ordem],
  );
  await pool.query(
    `INSERT INTO "ObservacaoCausa"
       ("ObservacaoCausa_IndicadorId","ObservacaoCausa_DataReferencia","ObservacaoCausa_Dimensao",
        "ObservacaoCausa_Categoria","ObservacaoCausa_Valor","ObservacaoCausa_FonteId")
     VALUES ($1,$2,$3,'Saúde',7,$4),($1,$2,$3,'Educação',3,$4)`,
    [ids['Óbitos infantis'], REF, NOVA.codigo, fonteId],
  );

  // Serviços NOVOS: o cache de 60s da instância anterior não conhece a
  // dimensão recém-curada (ver NOTA DE CACHE no cabeçalho).
  const motor = fabricarMotor();

  // (b1) o motor devolve o eixo novo, com participação recomputável.
  const estado = await motor.causas({ indicadorId: ids['Óbitos infantis'], referencia: REF });
  const novo = estado.dimensoes.find((d) => d.dimensao === NOVA.codigo);
  assert.ok(novo, 'causas() deveria devolver a 4ª dimensão sem edição de código');
  assert.equal(novo.total, 10);
  assert.deepEqual(
    novo.categorias.map((c) => [c.categoria, c.valor, c.participacao]),
    [['Saúde', 7, 70], ['Educação', 3, 30]],
  );

  // (b2) o filtro ?dimensao= aceita o código novo (allowlist é o catálogo).
  const filtrado = await motor.causas({
    indicadorId: ids['Óbitos infantis'], referencia: REF, dimensao: NOVA.codigo,
  });
  assert.deepEqual(filtrado.dimensoes.map((d) => d.dimensao), [NOVA.codigo]);

  // (b3) A16: o rótulo vem do BANCO — o texto da sugestão do eixo novo diz
  // 'função de governo', nunca o código cru.
  const sugSvc = new SugestoesService(fabricarDb(pool));
  const entrada = {
    dossie: {
      ranking: {
        indicador: 'Óbitos infantis', unidade: 'óbitos', referencia: REF, agregacao: 'SOMA',
        total_estadual: null, media_estadual: null, total_municipios: 1,
        ausentes: { total: 0, codigos: [] }, municipios: [],
      },
      serie: { pontos: [] },
      causas: estado,
    },
    indicador: { id: ids['Óbitos infantis'], nome: 'Óbitos infantis', unidade: 'óbitos', tema: 'Saúde', polaridade: 'MENOR_MELHOR' },
    recorte: 'ESTADO',
    codigo: null,
    local: estado.local,
  };
  const saida = await sugSvc.gerar(entrada);
  assert.equal(saida.descartadas, 0, 'nenhum numeral intruso — a auditoria RG-03 segue passando');
  const doNovoEixo = saida.sugestoes.filter((s) => s.texto.includes(`eixo ${NOVA.nome}`));
  assert.ok(doNovoEixo.length >= 1, 'com prática CAUSA_DOMINANTE curada, o eixo novo vira sugestão com o rótulo do banco');
  for (const s of saida.sugestoes) assert.ok(!s.texto.includes(NOVA.codigo), 'o código cru nunca vaza para o texto');

  // (b4) fail-closed: SEM nenhuma prática curada não há sugestão — silêncio,
  // nunca invenção (o vocabulário novo não força texto).
  const dims = [...SEED, NOVA];
  const vazio = gerarSugestoes(entrada, [], dims);
  assert.deepEqual(vazio.sugestoes, []);
  assert.deepEqual(vazio.descartes, []);

  // (b5) pesquisas persistem "PesquisaCausa" com o código novo — via o
  // PRÓPRIO PesquisasService (validação + INSERT), como itmt_app dentro de
  // contexto tenant real (RLS FORCE); rollback ao final: nada sobra.
  const appUrl = new URL(process.env.DATABASE_URL);
  appUrl.username = 'itmt_app';
  appUrl.password = 'itmt_app';
  const app = new pg.Client({ connectionString: appUrl.toString() });
  await app.connect();
  try {
    await app.query('BEGIN');
    await app.query(
      `SELECT set_config('app.tenant_id',$1,true), set_config('app.organization_id',$2,true)`,
      [TENANT, ORG],
    );
    const dbApp = {
      query: (sql, params = []) => app.query(sql, params),
      currentTransactionClient: () => app, // gravar() reusa a transação corrente
      withClient: async (fn) => fn(app),
    };
    const pesquisas = new PesquisasService(dbApp, { registrar: async () => {} });
    const { id } = await pesquisas.gravar({
      modo: 'pesquisa',
      pergunta: 'Prova de extensibilidade E1: eixo novo persiste?',
      recorte: 'ESTADO',
      estado: 'RESPONDIDA',
      indicadores: [{
        indicadorId: ids['Óbitos infantis'], nome: 'Óbitos infantis', valor: 10,
        unidade: 'óbitos', dataReferencia: REF, agregacao: 'SOMA',
        causas: [{ dimensao: NOVA.codigo, categoria: 'Saúde', periodo: '2024', valor: 7 }],
      }],
    });
    const gravada = await app.query(
      `SELECT c."PesquisaCausa_Dimensao" AS dimensao, c."PesquisaCausa_Categoria" AS categoria
         FROM "PesquisaCausa" c
         JOIN "PesquisaIndicador" i ON i."PesquisaIndicador_Id" = c."PesquisaCausa_PesquisaIndicadorId"
        WHERE i."PesquisaIndicador_PesquisaId" = $1`,
      [id],
    );
    assert.deepEqual(gravada.rows, [{ dimensao: NOVA.codigo, categoria: 'Saúde' }]);

    // (c, lado das pesquisas) código inexistente ⇒ 400 honesto ANTES do INSERT.
    await assert.rejects(
      pesquisas.gravar({
        modo: 'pesquisa', pergunta: 'inválida?', recorte: 'ESTADO', estado: 'RESPONDIDA',
        indicadores: [{
          indicadorId: ids['Óbitos infantis'], nome: 'Óbitos infantis', valor: 1,
          unidade: 'óbitos', dataReferencia: REF, agregacao: 'SOMA',
          causas: [{ dimensao: 'NAO_EXISTE', categoria: 'x', periodo: '2024', valor: 1 }],
        }],
      }),
      (e) => (typeof e?.getStatus === 'function' ? e.getStatus() : e?.status) === 400
        && /NAO_EXISTE/.test(e?.message) && /DimensaoObservacao/.test(e?.message),
    );
  } finally {
    await app.query('ROLLBACK').catch(() => {});
    await app.end();
  }
});
