// ============================================================
// status-valor.unit.mjs — Evolução E20 (ADR-010, db/64): status do VALOR
// como domínio curado. Este é o ratchet que impede a CONTRADIÇÃO voltar.
//
// O defeito que ele tranca (auditoria de 31/08/2026): o MESMO símbolo, da
// MESMA fonte, tratado de três formas por quatro conectores —
// ingestar-pacote-f1-ibge convertia '-' do SIDRA para 0 (certo);
// ingestar-ibge-agregado e ingestar-ibge-populacao mandavam o mesmo '-' para
// a quarentena como se fosse ausência (errado — some da base o município que
// a fonte declarou ter zero); e coletar_fontes.py destruía a distinção antes
// (dropna) ou inventava zero (fillna(0)) antes de qualquer conector ver.
//
// Prova, contra o banco descartável da suíte e sem subir a API:
//   (a) cada símbolo do SIDRA classifica no status certo — e o '-' vira 0,
//       não ausência;
//   (b) 'X', '..' e '...' NÃO viram zero e NÃO viram observação;
//   (c) os QUATRO conectores decidem pelo MESMO ponto: nenhum deles carrega
//       regra de símbolo própria (a catraca anti-contradição);
//   (d) a quarentena grava código de razão TIPADO e o símbolo original;
//   (e) fonte sem convenção curada cai num default seguro — jamais inventa
//       zero;
//   (f) catraca anti-drift: o fallback embutido em lib-ingest.mjs bate,
//       símbolo a símbolo, com o seed do db/64 (e o banco vence quando existe);
//   (g) vetos de banco: status não promovível não pode ter valor implícito,
//       e código de razão fora do domínio é rejeitado por SQL direto;
//   (h) grants: itmt_app só lê os três catálogos.
//
// Nenhum teste deixa resíduo: a fonte/carga sintéticas são desfeitas no
// after (o banco descartável é compartilhado pelas suítes serializadas).
// ============================================================
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  CONVENCOES_EMBUTIDAS, STATUS_VALOR_EMBUTIDO,
  carregarRegrasValor, classificarValor, quarentenar, registrarCarga,
} from '../scripts/lib-ingest.mjs';

const DIR_SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts');
const FONTE = 'TESTE E20 — status do valor';

/** Os quatro conectores que discordavam sobre o mesmo símbolo. */
const CONECTORES = [
  'ingestar-csv.mjs',
  'ingestar-ibge-agregado.mjs',
  'ingestar-ibge-populacao.mjs',
  'ingestar-pacote-f1-ibge.mjs',
];

let pool;
let fonteId;
let regrasBanco;

const hashDe = (semente) => createHash('sha256').update(`e20:${semente}`).digest('hex');

before(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const f = await pool.query(
    `INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade")
     VALUES ($1,'TESTE','https://exemplo.invalid','DADO_ABERTO','CC-BY','ANUAL')
     ON CONFLICT ("Fonte_Nome") DO UPDATE SET "Fonte_Origem" = EXCLUDED."Fonte_Origem"
     RETURNING "Fonte_Id" AS id`, [FONTE],
  );
  fonteId = f.rows[0].id;
  regrasBanco = await carregarRegrasValor(pool, { convencao: 'SIDRA' });
});

after(async () => {
  const alvo = `SELECT "Fonte_Id" FROM "Fonte" WHERE "Fonte_Nome" = $1`;
  await pool.query(
    `DELETE FROM "Quarentena" WHERE "Quarentena_CargaId" IN (
       SELECT "Carga_Id" FROM "Carga" WHERE "Carga_FonteId" IN (${alvo}))`, [FONTE]);
  await pool.query(`DELETE FROM "Carga" WHERE "Carga_FonteId" IN (${alvo})`, [FONTE]);
  await pool.query(`DELETE FROM "Fonte" WHERE "Fonte_Nome" = $1`, [FONTE]);
  await pool.end();
});

// ------------------------------------------------------------
// (a) e (b) — a simbologia oficial do SIDRA, símbolo a símbolo
// ------------------------------------------------------------
test('E20 (a): cada símbolo do SIDRA classifica no status oficial — e "-" é ZERO, não ausência', () => {
  const esperado = [
    // símbolo, status,           promovível, valor
    ['-',       'ZERO_ABSOLUTO',  true,  0],
    ['0',       'VALOR',          true,  0],
    ['X',       'SUPRIMIDO',      false, null],
    ['..',      'NAO_APLICAVEL',  false, null],
    ['...',     'NAO_DISPONIVEL', false, null],
    ['1234',    'VALOR',          true,  1234],
    ['12,5',    'VALOR',          true,  12.5],
  ];
  for (const [simbolo, status, promovivel, valor] of esperado) {
    const r = classificarValor(simbolo, regrasBanco);
    assert.equal(r.status, status, `símbolo ${JSON.stringify(simbolo)} deveria ser ${status}`);
    assert.equal(r.promovivel, promovivel, `promovibilidade de ${JSON.stringify(simbolo)}`);
    assert.equal(r.valor, valor, `valor de ${JSON.stringify(simbolo)}`);
    assert.equal(r.simbolo, simbolo, 'o símbolo original é sempre preservado');
  }

  // O coração da correção, dito de novo sem rodeio: '-' NÃO é ausência.
  const traco = classificarValor('-', regrasBanco);
  assert.equal(traco.valor, 0, "'-' do SIDRA é zero absoluto (Normas de Apresentação Tabular)");
  assert.equal(traco.codigoRazao, null, 'zero absoluto é promovível: não há descarte, logo não há razão');
});

test('E20 (b): "X", ".." e "..." não viram zero nem observação — e trazem razão tipada', () => {
  for (const [simbolo, razao] of [
    ['X', 'VALOR_SUPRIMIDO'],
    ['..', 'VALOR_NAO_APLICAVEL'],
    ['...', 'VALOR_NAO_DISPONIVEL'],
  ]) {
    const r = classificarValor(simbolo, regrasBanco);
    assert.equal(r.promovivel, false, `${simbolo} nunca vira observação`);
    assert.equal(r.valor, null, `${simbolo} nunca vira número — e MUITO menos zero`);
    assert.notEqual(r.valor, 0, `${simbolo} não é zero`);
    assert.equal(r.codigoRazao, razao, `${simbolo} carrega o código de razão tipado`);
  }
});

// ------------------------------------------------------------
// (c) A CATRACA ANTI-CONTRADIÇÃO — um único ponto de decisão
// ------------------------------------------------------------
test('E20 (c): os quatro conectores classificam pelo MESMO ponto, sem regra de símbolo própria', () => {
  // Regra de símbolo escrita à mão dentro de um conector: foi exatamente
  // assim que os quatro passaram a discordar. Comparação literal com um
  // sinal convencional não pode voltar a existir fora de lib-ingest.mjs.
  const regraLocal = /[!=]==\s*'(\.\.\.|\.\.|-|X)'/;

  for (const arquivo of CONECTORES) {
    const fonte = readFileSync(join(DIR_SCRIPTS, arquivo), 'utf8');
    assert.match(fonte, /classificarValor/,
      `${arquivo} precisa classificar a célula pelo ponto único (E20)`);
    assert.match(fonte, /from '\.\/lib-ingest\.mjs'/,
      `${arquivo} precisa importar o classificador central`);
    assert.doesNotMatch(fonte, regraLocal,
      `${arquivo} voltou a decidir sozinho o que um sinal convencional significa — `
      + 'era a contradição da E20. A regra vive em "ConvencaoValorSimbolo" (db/64).');
  }
});

test('E20 (c): o mesmo símbolo produz o MESMO resultado por qualquer caminho de carga', async () => {
  // Todos os quatro conectores resolvem SIDRA pela mesma função — por
  // convenção explícita (os três do IBGE) ou pelo slug do conector (o CSV
  // genérico). Aqui provamos que os dois caminhos convergem.
  const porSlug = await carregarRegrasValor(pool, { conectorSlug: 'ibge-populacao' });
  assert.equal(porSlug?.convencao, 'SIDRA', 'ibge-populacao herda SIDRA do catálogo (db/64)');

  for (const simbolo of ['-', '0', 'X', '..', '...', '77']) {
    assert.deepEqual(
      classificarValor(simbolo, porSlug), classificarValor(simbolo, regrasBanco),
      `caminho por slug e por convenção divergiram em ${JSON.stringify(simbolo)}`,
    );
  }

  // E a TabNet dos conectores do db/50 também é a mesma decisão para o '-'.
  const tabnet = await carregarRegrasValor(pool, { conectorSlug: 'sim-obitos-infantis' });
  assert.equal(tabnet?.convencao, 'TABNET_TABULACAO_COMPLETA');
  assert.equal(classificarValor('-', tabnet).valor, 0,
    'db/50 documentou: em tabulação estadual COMPLETA, "-" é zero eventos');
});

// ------------------------------------------------------------
// (d) A quarentena passa a ser contável
// ------------------------------------------------------------
test('E20 (d): a quarentena grava código de razão TIPADO e o símbolo original', async () => {
  const cargaId = await registrarCarga(pool, {
    fonteId, hash: hashDe('quarentena'), caminhoBronze: 'bronze/e20-q.json', linhasLidas: 3,
  });

  for (const simbolo of ['X', '...', '..']) {
    const c = classificarValor(simbolo, regrasBanco);
    assert.equal(await quarentenar(pool, cargaId, { codigo: '5103403', valor: simbolo },
      `valor não promovível (${c.status}): "${c.simbolo}"`,
      { codigoRazao: c.codigoRazao, simbolo: c.simbolo }), true);
  }
  // Razão territorial: o valor podia estar perfeito, o município é que não é daqui.
  await quarentenar(pool, cargaId, { codigo: '3550308', valor: '10' },
    'codigo_ibge inválido ou fora de MT: "3550308"',
    { codigoRazao: 'TERRITORIO_FORA_DE_ESCOPO', simbolo: '3550308' });

  const r = await pool.query(
    `SELECT "Quarentena_CodigoRazao" AS razao, "Quarentena_SimboloOrigem" AS simbolo
       FROM "Quarentena" WHERE "Quarentena_CargaId" = $1
      ORDER BY "Quarentena_Id"`, [cargaId],
  );
  assert.deepEqual(r.rows, [
    { razao: 'VALOR_SUPRIMIDO', simbolo: 'X' },
    { razao: 'VALOR_NAO_DISPONIVEL', simbolo: '...' },
    { razao: 'VALOR_NAO_APLICAVEL', simbolo: '..' },
    { razao: 'TERRITORIO_FORA_DE_ESCOPO', simbolo: '3550308' },
  ], 'cada descarte diz POR QUE, com código, e preserva o símbolo da fonte');

  // O ganho concreto: a pergunta "quanto esta carga perdeu por supressão da
  // fonte?" deixa de exigir LIKE em string livre.
  const porRazao = await pool.query(
    `SELECT "Quarentena_CodigoRazao" AS razao, count(*)::int AS n
       FROM "Quarentena" WHERE "Quarentena_CargaId" = $1
        AND "Quarentena_CodigoRazao" LIKE 'VALOR_%'
      GROUP BY 1`, [cargaId],
  );
  assert.equal(porRazao.rows.reduce((s, l) => s + l.n, 0), 3);

  // E20 não reescreve história: linha anterior ao código fica NULL (db/60).
  assert.equal(await quarentenar(pool, cargaId, { codigo: '5103403', valor: 'legado' }, 'motivo antigo'), true);
  const legado = await pool.query(
    `SELECT count(*)::int AS n FROM "Quarentena"
      WHERE "Quarentena_CargaId" = $1 AND "Quarentena_CodigoRazao" IS NULL`, [cargaId],
  );
  assert.equal(legado.rows[0].n, 1, 'chamada sem código grava NULL — desconhecido é resposta');
});

// ------------------------------------------------------------
// (e) Default seguro
// ------------------------------------------------------------
test('E20 (e): fonte sem convenção curada cai no default seguro — nunca inventa zero', async () => {
  // 'cnes' e 'inep' ficaram deliberadamente sem convenção no db/64: provável
  // não é documentado, e a regra é não semear símbolo que não se possa citar.
  for (const slug of ['cnes', 'inep']) {
    assert.equal(await carregarRegrasValor(pool, { conectorSlug: slug }), null,
      `${slug} não tem convenção curada — e isso é proposital (db/64)`);
  }
  const semRegra = await carregarRegrasValor(pool, { conectorSlug: 'cnes' });

  // Número puro continua sendo valor: o default não quebra fonte alguma.
  assert.deepEqual(classificarValor('42', semRegra),
    { simbolo: '42', status: 'VALOR', promovivel: true, valor: 42, codigoRazao: null });

  // Tudo o mais é INVALIDO — e INVALIDO nunca é zero.
  for (const simbolo of ['-', '...', '..', 'X', '', '   ', 'n/d', 'A']) {
    const r = classificarValor(simbolo, semRegra);
    assert.equal(r.status, 'INVALIDO', `${JSON.stringify(simbolo)} sem convenção é ilegível`);
    assert.equal(r.valor, null, `${JSON.stringify(simbolo)} JAMAIS vira número sem convenção`);
    assert.equal(r.codigoRazao, 'VALOR_INVALIDO');
  }

  // Conector fora do catálogo e ausência total de contexto: mesmo default.
  assert.equal(await carregarRegrasValor(pool, { conectorSlug: 'nao-existe-este-conector' }), null);
  assert.equal(classificarValor('-', null).valor, null,
    'sem regras, nem o "-" vira zero — quem afirma zero é a convenção da fonte, não o parser');

  // FAIXA_VALOR ficou ADIADO no db/64 (sem consumidor). O adiamento é seguro
  // por construção: letra de faixa cai em INVALIDO, jamais em zero.
  for (const letra of ['A', 'B', 'Z']) {
    assert.equal(classificarValor(letra, regrasBanco).valor, null,
      `letra de faixa (${letra}) não tem status catalogado e não pode virar número`);
  }
});

// ------------------------------------------------------------
// (f) Catraca anti-drift: embutido × catálogo
// ------------------------------------------------------------
test('E20 (f): o fallback embutido bate símbolo a símbolo com o seed do db/64', async () => {
  const banco = await pool.query(
    `SELECT s."ConvencaoValorSimbolo_Convencao"      AS convencao,
            s."ConvencaoValorSimbolo_Simbolo"        AS simbolo,
            s."ConvencaoValorSimbolo_StatusValor"    AS status
       FROM "ConvencaoValorSimbolo" s
      WHERE s."ConvencaoValorSimbolo_Ativa" ORDER BY 1, 2`,
  );
  const doBanco = {};
  for (const l of banco.rows) (doBanco[l.convencao] ??= {})[l.simbolo] = l.status;
  assert.deepEqual(doBanco, CONVENCOES_EMBUTIDAS,
    'seed do db/64 e CONVENCOES_EMBUTIDAS divergiram — editar um exige editar o outro');

  const status = await pool.query(
    `SELECT "StatusValor_Codigo" AS codigo, "StatusValor_Promovivel" AS promovivel,
            "StatusValor_ValorImplicito" AS implicito
       FROM "StatusValor" WHERE "StatusValor_Ativo" ORDER BY "StatusValor_Ordem"`,
  );
  assert.deepEqual(
    Object.fromEntries(status.rows.map((l) => [l.codigo, {
      promovivel: l.promovivel, implicito: l.implicito === null ? null : Number(l.implicito),
    }])),
    STATUS_VALOR_EMBUTIDO,
    'a semântica de "StatusValor" no banco e no fallback embutido precisa ser a mesma',
  );

  // Só VALOR e ZERO_ABSOLUTO promovem. É a regra inteira da E20 em uma linha.
  assert.deepEqual(
    status.rows.filter((l) => l.promovivel).map((l) => l.codigo).sort(),
    ['VALOR', 'ZERO_ABSOLUTO'],
    'promover mais que isto é permitir que ausência vire número',
  );

  // Banco é a fonte de verdade; o embutido só entra quando a tabela não existe.
  assert.equal(regrasBanco.origem, 'banco');
});

// ------------------------------------------------------------
// (g) Vetos de banco, provados por SQL direto
// ------------------------------------------------------------
test('E20 (g): o banco veta status não promovível com valor implícito e razão fora do domínio', async () => {
  await assert.rejects(
    () => pool.query(
      `INSERT INTO "StatusValor"
         ("StatusValor_Codigo","StatusValor_Nome","StatusValor_Descricao",
          "StatusValor_Promovivel","StatusValor_ValorImplicito","StatusValor_Ordem")
       VALUES ('AUSENCIA_VIRA_ZERO','x','x',false,0,99)`),
    (e) => e.code === '23514',
    'semear "ausência ⇒ 0" tem de ser impossível por construção — é o erro que a E20 corrige',
  );

  const cargaId = await registrarCarga(pool, {
    fonteId, hash: hashDe('veto'), caminhoBronze: 'bronze/e20-veto.json', linhasLidas: 1,
  });
  await assert.rejects(
    () => pool.query(
      `INSERT INTO "Quarentena"
         ("Quarentena_CargaId","Quarentena_Registro","Quarentena_Motivo","Quarentena_CodigoRazao")
       VALUES ($1,'{}'::jsonb,'motivo','RAZAO_INVENTADA')`, [cargaId]),
    (e) => e.code === '23514',
    'código de razão é domínio fechado (CHECK) — não volta a ser string livre',
  );

  // Convenção sem documentação citável também é impossível: regra sem
  // citação foi exatamente o defeito de origem.
  await assert.rejects(
    () => pool.query(
      `INSERT INTO "ConvencaoValorFonte"
         ("ConvencaoValorFonte_Codigo","ConvencaoValorFonte_Nome","ConvencaoValorFonte_Descricao")
       VALUES ('PALPITE','x','x')`),
    (e) => e.code === '23502',
    'documentação é NOT NULL: convenção sem fonte citada é palpite',
  );
});

// ------------------------------------------------------------
// (h) Grants — catálogo de vocabulário é só leitura para a aplicação
// ------------------------------------------------------------
test('E20 (h): itmt_app só lê os catálogos da E20 (curadoria é migração)', async () => {
  const r = await pool.query(
    `SELECT table_name AS t, privilege_type AS p
       FROM information_schema.role_table_grants
      WHERE grantee = 'itmt_app' AND table_schema = 'public'
        AND table_name IN ('StatusValor','ConvencaoValorFonte','ConvencaoValorSimbolo')
      ORDER BY 1, 2`,
  );
  assert.deepEqual(r.rows.map((l) => `${l.t}:${l.p}`), [
    'ConvencaoValorFonte:SELECT', 'ConvencaoValorSimbolo:SELECT', 'StatusValor:SELECT',
  ], 'nada além de SELECT — padrão db/51/54/55/62, nada na catraca de menor privilégio');
});
