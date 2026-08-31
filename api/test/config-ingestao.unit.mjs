// ============================================================
// config-ingestao.unit.mjs — Evolução E17 (ADR-010, db/62): configuração de
// ingestão versionada no catálogo vivo. Prova, contra o banco descartável da
// suíte e sem subir a API:
//   1. CATRACA ANTI-DRIFT: as 12 configs semeadas (v1 vigente) batem, pelo
//      hash canônico sha256((conteudo::jsonb)::text), com os arquivos de
//      api/ingest-configs/*.json — e os CONJUNTOS de slugs são idênticos.
//      Quem editar um .json sem registrar versão nova no banco (ou semear
//      um arquivo novo sem migração) QUEBRA aqui.
//   2. unicidade de vigente por slug: segunda vigente é rejeitada (23505,
//      índice parcial único) — e o histórico é imutável de fato (UPDATE do
//      conteúdo e DELETE são vetados por trigger, doutrina F3/F4).
//   3. carregarConfigIngestao pelo caminho do BANCO devolve exatamente o
//      mesmo objeto que o arquivo (o banco é fonte de verdade equivalente).
//   4. fallback RG-05-like: slug fora do catálogo ⇒ arquivo; tabela
//      inexistente (42P01, banco pré-db/62) ⇒ arquivo.
//   5. divergência banco×arquivo ⇒ warn com os dois hashes e o BANCO vence.
//   6. contrato de grants: itmt_app só lê (SELECT sem INSERT/UPDATE/DELETE —
//      padrão db/55, nada na catraca de menor privilégio).
//   7. curadoria do mapeamento config→conector registrada como asserção.
// Nenhum teste deixa resíduo: todo INSERT/UPDATE/DELETE tentado aqui FALHA
// por design (o banco é compartilhado pelas suítes serializadas).
// ============================================================
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { carregarConfigIngestao } from '../scripts/lib-ingest.mjs';

const DIR_CONFIGS = join(dirname(fileURLToPath(import.meta.url)), '..', 'ingest-configs');
const T = '"FonteConectorConfiguracao"';

let owner; // dono (DATABASE_URL da suíte)
let tmp;   // arquivos temporários dos testes de fallback/divergência

before(async () => {
  owner = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await owner.connect();
  tmp = mkdtempSync(join(tmpdir(), 'config-e17-'));
});

after(async () => {
  rmSync(tmp, { recursive: true, force: true });
  await owner?.end();
});

test('db/62 catraca anti-drift: as 12 configs vigentes batem por hash canônico com os arquivos', async () => {
  const arquivos = readdirSync(DIR_CONFIGS).filter((f) => f.endsWith('.json')).sort();
  const banco = await owner.query(`
    SELECT "FonteConectorConfiguracao_Slug"       AS slug,
           "FonteConectorConfiguracao_Versao"     AS versao,
           "FonteConectorConfiguracao_HashSha256" AS hash
      FROM ${T}
     WHERE "FonteConectorConfiguracao_Vigente"
     ORDER BY 1`);

  assert.deepEqual(
    banco.rows.map((r) => r.slug),
    arquivos.map((f) => f.replace(/\.json$/, '')),
    'o conjunto de slugs vigentes no banco deve ser exatamente o conjunto de arquivos em ingest-configs/',
  );
  assert.equal(banco.rows.length, 12, 'seed inaugural: 12 configs');
  assert.ok(banco.rows.every((r) => r.versao === 1), 'seed inaugural: tudo em versão 1');

  for (const f of arquivos) {
    const texto = readFileSync(join(DIR_CONFIGS, f), 'utf8');
    const { rows: [{ hash }] } = await owner.query(
      `SELECT encode(sha256(convert_to(($1::jsonb)::text,'UTF8')),'hex') AS hash`, [texto],
    );
    const linha = banco.rows.find((r) => r.slug === f.replace(/\.json$/, ''));
    assert.equal(
      hash, linha.hash,
      `drift entre ingest-configs/${f} e a versão vigente do banco — ` +
        'editar o arquivo exige registrar versão nova em "FonteConectorConfiguracao" (E17).',
    );
  }
});

test('db/62: uma vigente por slug — segunda vigente é rejeitada (23505)', async () => {
  await assert.rejects(
    owner.query(`
      INSERT INTO ${T}
        ("FonteConectorConfiguracao_Slug","FonteConectorConfiguracao_ConectorSlug",
         "FonteConectorConfiguracao_Versao","FonteConectorConfiguracao_Conteudo")
      VALUES ('sim-obitos-infantis','sim-obitos-infantis',2,'{"duplicata":true}'::jsonb)`),
    (e) => e.code === '23505',
    'índice parcial único deve vetar duas vigentes do mesmo slug',
  );
});

test('db/62: histórico imutável de fato — UPDATE do conteúdo e DELETE são vetados por trigger', async () => {
  await assert.rejects(
    owner.query(`
      UPDATE ${T} SET "FonteConectorConfiguracao_Conteudo" = '{"adulterada":true}'::jsonb
       WHERE "FonteConectorConfiguracao_Slug" = 'sim-obitos-infantis'`),
    /imutável/,
    'reescrever conteúdo deveria ser vetado no banco (veto de banco, não de aplicação)',
  );
  await assert.rejects(
    owner.query(`DELETE FROM ${T} WHERE "FonteConectorConfiguracao_Slug" = 'sim-obitos-infantis'`),
    /imutável/,
    'remoção física deveria ser vetada no banco',
  );
});

test('E17: carregar pelo caminho do banco devolve o mesmo objeto que o arquivo', async () => {
  const caminho = join(DIR_CONFIGS, 'sim-obitos-infantis.json');
  const r = await carregarConfigIngestao(owner, caminho);
  assert.equal(r.origem, 'banco');
  assert.equal(r.versao, 1);
  assert.deepEqual(r.config, JSON.parse(readFileSync(caminho, 'utf8')),
    'a config vigente do banco deve ser semanticamente idêntica ao arquivo');
});

test('E17 fallback (RG-05-like): slug fora do catálogo ⇒ arquivo; tabela ausente ⇒ arquivo', async () => {
  const conteudo = { fonte: { nome: 'Fantasma' }, dataReferencia: '2026-01-01' };
  const caminho = join(tmp, 'config-fantasma.json');
  writeFileSync(caminho, JSON.stringify(conteudo, null, 2));

  const semSlug = await carregarConfigIngestao(owner, caminho);
  assert.equal(semSlug.origem, 'arquivo');
  assert.deepEqual(semSlug.config, conteudo);

  // banco pré-db/62 simulado: a consulta falha com 42P01 e o arquivo vale
  const dbSemTabela = {
    query: async () => { const e = new Error('relation does not exist'); e.code = '42P01'; throw e; },
  };
  const semTabela = await carregarConfigIngestao(dbSemTabela, caminho);
  assert.equal(semTabela.origem, 'arquivo');
  assert.deepEqual(semTabela.config, conteudo);

  // nem banco nem arquivo: erro com contexto, nunca invenção (RN-005-like)
  await assert.rejects(
    carregarConfigIngestao(owner, join(tmp, 'inexistente.json')),
    /não encontrada/,
  );
});

test('E17: banco e arquivo divergentes ⇒ warn com os dois hashes e o BANCO vence', async () => {
  // arquivo local adulterado com o MESMO slug de uma config vigente
  const caminho = join(tmp, 'sim-obitos-infantis.json');
  writeFileSync(caminho, JSON.stringify({ fonte: { nome: 'Editado sem versão nova' } }));

  const avisos = [];
  const warnOriginal = console.warn;
  console.warn = (...args) => avisos.push(args.join(' '));
  let r;
  try {
    r = await carregarConfigIngestao(owner, caminho);
  } finally {
    console.warn = warnOriginal;
  }
  assert.equal(r.origem, 'banco', 'na divergência, o banco é a fonte de verdade');
  assert.deepEqual(
    r.config,
    JSON.parse(readFileSync(join(DIR_CONFIGS, 'sim-obitos-infantis.json'), 'utf8')),
    'o conteúdo devolvido é o do banco, não o do arquivo adulterado',
  );
  assert.equal(avisos.length, 1, 'exatamente um aviso de divergência');
  const hashes = avisos[0].match(/[0-9a-f]{64}/g) ?? [];
  assert.equal(hashes.length, 2, 'o aviso carrega os DOIS hashes (arquivo e banco)');
  assert.notEqual(hashes[0], hashes[1]);
});

test('db/62 contrato de grants: itmt_app só lê (padrão db/55 — nada na catraca)', async () => {
  const r = await owner.query(`
    SELECT has_table_privilege('itmt_app','"FonteConectorConfiguracao"','SELECT') AS sel,
           has_table_privilege('itmt_app','"FonteConectorConfiguracao"','INSERT') AS ins,
           has_table_privilege('itmt_app','"FonteConectorConfiguracao"','UPDATE') AS upd,
           has_table_privilege('itmt_app','"FonteConectorConfiguracao"','DELETE') AS del`);
  assert.deepEqual(r.rows[0], { sel: true, ins: false, upd: false, del: false });
});

test('db/62 curadoria: mapeamento config→conector é o documentado (grão fino → catálogo db/55)', async () => {
  const esperado = {
    'cnes-estabelecimentos': 'cnes',
    'cnes-internacao': 'cnes',
    'cnes-leitos': 'cnes',
    'inep-escolas': 'inep',
    'inep-matriculas': 'inep',
    'inpe-queimadas': 'inpe',
    'mapbiomas-cobertura': 'mapbiomas',
    'pam-area-plantada': 'ibge-f1',
    'sesp-ocorrencias': 'sesp-mt',
    'siconfi-despesas': 'siconfi-despesas',
    'sim-obitos-infantis': 'sim-obitos-infantis',
    'sinasc-nascidos-vivos': 'sinasc-nascidos-vivos',
  };
  const r = await owner.query(`
    SELECT "FonteConectorConfiguracao_Slug"         AS slug,
           "FonteConectorConfiguracao_ConectorSlug" AS conector
      FROM ${T} WHERE "FonteConectorConfiguracao_Vigente" ORDER BY 1`);
  assert.deepEqual(Object.fromEntries(r.rows.map((x) => [x.slug, x.conector])), esperado);
});

/**
 * db/65 — regressão do hash canônico.
 *
 * O trigger do db/62 calculava o hash com `(...)::text::bytea`. Esse cast não
 * converte texto em bytes UTF-8: ele lê o texto no formato de ENTRADA de
 * bytea, onde a barra invertida escapa. Resultado: qualquer configuração cujo
 * jsonb contivesse uma aspa escapada dentro de uma string fazia o INSERT
 * levantar erro e a versão nem entrava no catálogo. É o mesmo defeito que o
 * AuditoriaService já documentava e que o db/63 curou no lib-ingest.
 */
test('db/65: configuração com barra invertida entra no catálogo e o hash bate', async () => {
  const conteudo = {
    fonte: { nome: 'Fonte "X" — TabNet', origem: 'teste\db65' },
    observacao: 'linha1\nlinha2',
  };
  const texto = JSON.stringify(conteudo);

  await owner.query(
    `INSERT INTO ${T}("FonteConectorConfiguracao_Slug","FonteConectorConfiguracao_Versao",
                      "FonteConectorConfiguracao_Conteudo","FonteConectorConfiguracao_Vigente")
     VALUES ('db65-barra-invertida', 1, $1::jsonb, false)`,
    [texto],
  );

  const r = await owner.query(
    `SELECT "FonteConectorConfiguracao_HashSha256" AS gravado,
            encode(sha256(convert_to(("FonteConectorConfiguracao_Conteudo")::text,'UTF8')),'hex') AS canonico
       FROM ${T} WHERE "FonteConectorConfiguracao_Slug" = 'db65-barra-invertida'`);

  assert.equal(r.rows.length, 1, 'a configuração com barra invertida tem que ser aceita');
  assert.equal(r.rows[0].gravado, r.rows[0].canonico,
    'o hash gravado pelo trigger tem que ser o sha256 dos bytes UTF-8 do conteúdo');

  // Contrafactual: o cast antigo continua falhando — sem isto o teste não prova nada.
  await assert.rejects(
    owner.query(`SELECT sha256(($1::jsonb)::text::bytea)`, [texto]),
    /bytea/i,
    'o cast antigo precisa continuar rejeitando barra invertida');

  // Sem limpeza: o histórico é imutável por trigger (db/62) e DELETE é vetado.
  // A linha fica como versão NÃO vigente, invisível às demais asserções — e a
  // tentativa de removê-la foi, ela própria, uma prova do veto funcionando.
});
