// ============================================================
// fontes-registry.test.mjs — Evolução E2 (db/55 · CATALOGO-CONECTORES).
//
// O ADR-010 registrou o defeito: o registro de conectores era um array
// hardcoded em scripts/fontes-registry.mjs — a própria pesquisa de fontes
// manda que "esse cadastro não deve ficar codificado no software" (seção
// 36). A E2 move o registro para o catálogo "FonteConector" (db/55) e este
// arquivo é a PROVA DE EXTENSIBILIDADE que dá sentido à evolução:
//
//   (a) o seed reproduz EXATAMENTE o registro aposentado (12 slugs, mesmas
//       situações, motivos, tipos, janelas e comandos) + os 3 conectores do
//       gauntlet (sim/sinasc/siconfi, honestamente BLOQUEADA_EXTERNA — sem
//       coletor automatizado, o motivo diz o passo humano); a superfície
//       consumida por sincronizar-fontes.mjs é a MESMA de antes;
//   (b) inserir POR SQL um conector fictício ('teste-conector-x', classe B,
//       EXECUTAVEL, sem config) ⇒ ele aparece na listagem SEM mudança de
//       código; desativar (_Ativa=false) o tira da listagem;
//   (c) o banco rejeita por CHECK: BLOQUEADA_EXTERNA sem motivo, EXECUTAVEL
//       sem comando, slug fora do kebab-case, classe fora de A–E;
//   (d) sem db/55 NÃO há fallback hardcoded: o leitor falha com erro claro
//       mandando migrar (senão o banco nunca vira fonte de verdade);
//   (e) itmt_app só lê — curadoria é migração (como db/51 e db/54).
//
// E2b (db/56 · PROGRAMA COMPLETO): o catálogo cresce do recorte executável
// (14 slugs) para as matrizes de integração da curadoria (25 fontes F1 +
// 44 fontes F2, 28/08/2026) como BACKLOG HONESTO — situação nova
// 'PLANEJADA' = coletor ainda não construído (trabalho futuro nosso, sem
// comando e sem motivo de bloqueio inventados). Este arquivo também prova:
//   (f) a contagem do programa completo (74, conta no teste), sem slug
//       duplicado, com todo PLANEJADA sem comando e todo EXECUTAVEL com
//       comando;
//   (g) REGRESSÃO: os 9 executáveis de db/55 continuam executáveis;
//   (h) planoDeSincronizacao (usado por sincronizar-fontes.mjs) nunca
//       manda executar PLANEJADA nem BLOQUEADA_EXTERNA.
//
// E5 (db/58 · FONTES PARCEIRAS F4): as 42 fontes/famílias da matriz de
// parceiras da Fase 4 externa (28/08/2026) entram no catálogo com a régua
// «"candidato" não significa que já exista convênio»: dado conveniado nasce
// BLOQUEADA_EXTERNA (30 linhas, motivo único de convênio não firmado);
// forma de integração com parte PÚBLICA declarada (publicações/portal/
// pesquisas/relatórios públicos) nasce PLANEJADA (12 linhas — crawler
// classe E ainda não construído; sebrae-mt é B, portal estruturado).
// Nenhuma F4 nasce EXECUTAVEL. Famílias de fontes não têm URL (12 NULLs).
//
// E15 (db/59 · FRESCOR POR CONECTOR): verificação ≠ ingestão ≠ latência ≠
// frescor — absorção conceitual do pacote "Core R2.1 — Periodicidade e
// Orquestração" (regra essencial: ausência de atualização não significa
// automaticamente falha). Este arquivo também prova:
//   (i) classificarFrescor (função pura) nas 5 classes, com bordas exatas
//       (exatamente na janela; janela+latência; 1,5×; falha; sem histórico);
//   (j) RETROCOMPATIBILIDADE: conector sem os campos novos (NULL) usa a
//       janela do tipo (35/400) igual antes — intervaloEfetivo;
//   (k) bloqueadas/planejadas = DESCONHECIDO, sempre (não estão em
//       operação — não é atraso);
//   (l) seeds de curadoria dos 9 executáveis presentes (cnes 7/60 etc.),
//       não-executáveis sem cadência curada, e CHECKs de db/59 rejeitando
//       valores inválidos.
//
// PADRÃO: banco-direto como dimensoes.unit.mjs — node:test + pg no
// DATABASE_URL de um banco DESCARTÁVEL migrado (db/01..58). NUNCA aponte
// para o banco dev. O fixture 'teste-conector-x' é removido no after():
// o banco é compartilhado pelas suítes.
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {
  carregarFontes, proximaVerificacao, planoDeSincronizacao, MOTIVO_PLANEJADA,
  classificarFrescor, frescorDaFonte, intervaloEfetivo, FRESCORES,
} from '../scripts/fontes-registry.mjs';

// Fotografia do registro aposentado (ratchet do seed de db/55): slug →
// [tipo, periodicidade, dias, situacao]. A ordem do array é a ordem canônica
// e o seed E2b (db/56) preserva os 14 primeiros lugares (ordens 10–140).
const ESPERADAS = [
  ['ibge-territorio', 'API', 'ANUAL', 400, 'EXECUTAVEL'],
  ['ibge-populacao', 'API', 'ANUAL', 400, 'EXECUTAVEL'],
  ['ibge-pib', 'API', 'ANUAL', 400, 'EXECUTAVEL'],
  ['ibge-f1', 'API', 'ANUAL', 400, 'EXECUTAVEL'],
  ['ibge-f2', 'API', 'ANUAL', 400, 'EXECUTAVEL'],
  ['cnes', 'API', 'MENSAL', 35, 'EXECUTAVEL'],
  ['inep', 'DOWNLOAD', 'ANUAL', 400, 'EXECUTAVEL'],
  ['inpe', 'DOWNLOAD', 'ANUAL', 400, 'EXECUTAVEL'],
  ['mapbiomas', 'DOWNLOAD', 'ANUAL', 400, 'EXECUTAVEL'],
  ['sesp-mt', 'ARQUIVO_AUTORIZADO', 'MENSAL', 35, 'BLOQUEADA_EXTERNA'],
  ['sinfra-estradas', 'ARQUIVO_AUTORIZADO', 'ANUAL', 400, 'BLOQUEADA_EXTERNA'],
  // Gauntlet (db/50 e db/53 já carregaram o dado; configs em ingest-configs/):
  ['sim-obitos-infantis', 'DOWNLOAD', 'ANUAL', 400, 'BLOQUEADA_EXTERNA'],
  ['sinasc-nascidos-vivos', 'DOWNLOAD', 'ANUAL', 400, 'BLOQUEADA_EXTERNA'],
  ['siconfi-despesas', 'API', 'ANUAL', 400, 'BLOQUEADA_EXTERNA'],
];
const FICTICIO = 'teste-conector-x';

// CONTA DO PROGRAMA COMPLETO (db/56): 25 linhas F1 + 44 linhas F2 = 69
// linhas de matriz. Dedupe honesto: 9 linhas já tinham conector em produção
// e viraram UPDATE, sem slug novo (F1-1 SIDRA → ibge-populacao/pib/f1/f2;
// F1-2 → ibge-territorio; F1-13 → siconfi-despesas; F1-19 → cnes; F1-20 →
// inep; F1-24 → inpe; F1-25 → mapbiomas; F2 SESP_MT → sesp-mt; F2
// SINFRA_MT → sinfra-estradas) e a linha F1-18 (DATASUS) gera 1 slug novo
// ('datasus-tabnet', sistemas não cobertos por sim/sinasc). Novos:
// (25−7) F1 + (44−2) F2 = 18 + 42 = 60. Total: 14 existentes (registro
// aposentado + extras do gauntlet) + 60 = 74.
// E5 (db/58): + 42 fontes parceiras F4 (F4S01–F4S42, sem dedupe — a única
// colisão de slug, Energisa, vira faixa própria 'energisa-mt-relatorios',
// complementar à 'energisa-mt' de db/56). Total: 74 + 42 = 116.
const TOTAL_PROGRAMA = 116;
// Os 9 executáveis de db/55 — a régua de regressão da E2b.
const EXECUTAVEIS_DB55 = [
  'ibge-territorio', 'ibge-populacao', 'ibge-pib', 'ibge-f1', 'ibge-f2',
  'cnes', 'inep', 'inpe', 'mapbiomas',
];

let pool;

before(() => {
  assert.ok(
    process.env.DATABASE_URL,
    'esta suíte é banco-direto: rode via scripts/test-e2e.mjs (npm test) ou exporte DATABASE_URL de um banco descartável migrado',
  );
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
});

after(async () => {
  await pool.query(`DELETE FROM "FonteConector" WHERE "FonteConector_Slug" LIKE 'teste-conector-%'`);
  await pool.query(`DELETE FROM "FonteSincronizacao" WHERE "FonteSincronizacao_Slug" LIKE 'teste-frescor-%'`);
  await pool.end();
});

test('(a) seed de db/55 = registro aposentado + gauntlet, nos 14 primeiros lugares e sem slug repetido', async () => {
  const fontes = await carregarFontes(pool);
  assert.deepEqual(
    fontes.slice(0, ESPERADAS.length).map((f) => [f.slug, f.tipo, f.periodicidade, f.dias, f.situacao]),
    ESPERADAS,
    'o catálogo divergiu da fotografia do registro (ratchet do seed de db/55)',
  );
  assert.equal(new Set(fontes.map((f) => f.slug)).size, fontes.length, 'slug duplicado no catálogo');
  assert.ok(fontes.every((f) => Number.isInteger(f.dias) && f.dias > 0));
});

test('(a) superfície de F2-R048 intacta: executável tem comando; bloqueada tem motivo; PLANEJADA não tem nenhum dos dois', async () => {
  const fontes = await carregarFontes(pool);
  for (const f of fontes) {
    if (f.situacao === 'EXECUTAVEL') {
      assert.ok(Array.isArray(f.comando) && f.comando.length > 0, `${f.slug}: executável sem comando`);
      assert.equal(f.bloqueio, undefined, `${f.slug}: executável não carrega bloqueio`);
    } else if (f.situacao === 'BLOQUEADA_EXTERNA') {
      assert.equal(typeof f.bloqueio, 'string', `${f.slug}: bloqueada sem motivo`);
      assert.equal(f.comando, undefined, `${f.slug}: bloqueada nunca carrega comando inventado`);
    } else {
      // E2b: backlog honesto — nada a executar, nenhum ato externo pendente.
      assert.equal(f.situacao, 'PLANEJADA', `${f.slug}: situação desconhecida ${f.situacao}`);
      assert.equal(f.comando, undefined, `${f.slug}: PLANEJADA nunca carrega comando`);
      assert.equal(f.bloqueio, undefined, `${f.slug}: PLANEJADA não é bloqueio externo`);
    }
    assert.equal(typeof f.origem, 'string');
    assert.match(f.classe, /^[A-E]$/);
  }
  // Motivos dos bloqueios originais preservados byte a byte.
  const porSlug = new Map(fontes.map((f) => [f.slug, f]));
  assert.equal(porSlug.get('sesp-mt').bloqueio, 'Exige autorização formal e arquivo oficial da SESP-MT.');
  assert.equal(
    porSlug.get('sinfra-estradas').bloqueio,
    'Não há API pública municipal completa; exige arquivo validado pelo órgão responsável.',
  );
  // Os conectores do gauntlet apontam suas configs de ingestão.
  assert.equal(porSlug.get('sim-obitos-infantis').configIngestao, 'sim-obitos-infantis.json');
  assert.equal(porSlug.get('sinasc-nascidos-vivos').configIngestao, 'sinasc-nascidos-vivos.json');
  assert.equal(porSlug.get('siconfi-despesas').configIngestao, 'siconfi-despesas.json');
});

test('falha é retentada em até sete dias; sucesso respeita periodicidade', () => {
  const agora = new Date('2026-08-19T00:00:00Z');
  assert.equal(proximaVerificacao(agora, 400, false).toISOString(), '2026-08-26T00:00:00.000Z');
  assert.equal(proximaVerificacao(agora, 35, true).toISOString(), '2026-09-23T00:00:00.000Z');
});

test('(b) EXTENSIBILIDADE: conector novo por SQL aparece na listagem SEM mudança de código; desativar o remove', async () => {
  await pool.query(
    `INSERT INTO "FonteConector"
       ("FonteConector_Slug","FonteConector_Nome","FonteConector_Origem",
        "FonteConector_ClasseIntegracao","FonteConector_Tipo",
        "FonteConector_Periodicidade","FonteConector_IntervaloDias",
        "FonteConector_Situacao","FonteConector_Comando","FonteConector_Ordem")
     VALUES ($1,'Conector fictício da prova de extensibilidade (E2)','Fixture',
             'B','DOWNLOAD','ANUAL',400,'EXECUTAVEL',ARRAY['node','--version'],9999)`,
    [FICTICIO],
  );
  const comNovo = await carregarFontes(pool);
  const novo = comNovo.find((f) => f.slug === FICTICIO);
  assert.ok(novo, 'conector curado por SQL deveria aparecer sem edição de código');
  assert.equal(novo.classe, 'B');
  assert.equal(novo.situacao, 'EXECUTAVEL');
  assert.equal(novo.configIngestao, null);
  assert.deepEqual(novo.comando, ['node', '--version']);
  // 9999 fica além da última ordem real do catálogo (1160, db/58).
  assert.equal(comNovo[comNovo.length - 1].slug, FICTICIO, '_Ordem=9999 o coloca no fim da listagem');

  await pool.query(
    `UPDATE "FonteConector" SET "FonteConector_Ativa"=false WHERE "FonteConector_Slug"=$1`,
    [FICTICIO],
  );
  const semNovo = await carregarFontes(pool);
  assert.ok(!semNovo.some((f) => f.slug === FICTICIO), '_Ativa=false aposenta sem apagar história');
  assert.deepEqual(
    semNovo.map((f) => f.slug),
    comNovo.filter((f) => f.slug !== FICTICIO).map((f) => f.slug),
    'desativar o fictício deveria devolver exatamente o catálogo anterior',
  );

  await pool.query(`DELETE FROM "FonteConector" WHERE "FonteConector_Slug"=$1`, [FICTICIO]);
});

test('(c) o BANCO rejeita cadastro desonesto ou malformado (CHECK, SQLSTATE 23514)', async () => {
  const inserir = (colunas) => pool.query(
    `INSERT INTO "FonteConector"
       ("FonteConector_Slug","FonteConector_Nome","FonteConector_Origem",
        "FonteConector_ClasseIntegracao","FonteConector_Tipo",
        "FonteConector_Periodicidade","FonteConector_IntervaloDias",
        "FonteConector_Situacao","FonteConector_MotivoBloqueio",
        "FonteConector_Comando","FonteConector_Ordem")
     VALUES ($1,'x','x',$2,'DOWNLOAD','ANUAL',400,$3,$4,$5,998)`,
    colunas,
  );
  // BLOQUEADA_EXTERNA sem motivo — o coração da honestidade de situação.
  await assert.rejects(
    inserir(['teste-conector-a', 'B', 'BLOQUEADA_EXTERNA', null, null]),
    (e) => e.code === '23514',
  );
  // EXECUTAVEL sem comando — não existe "executável" que ninguém executa.
  await assert.rejects(
    inserir(['teste-conector-b', 'B', 'EXECUTAVEL', null, null]),
    (e) => e.code === '23514',
  );
  // Slug fora do kebab-case.
  await assert.rejects(
    inserir(['Teste_Conector', 'B', 'EXECUTAVEL', null, ['node', '--version']]),
    (e) => e.code === '23514',
  );
  // Classe fora de A–E (vocabulário da seção 41 da pesquisa).
  await assert.rejects(
    inserir(['teste-conector-c', 'X', 'EXECUTAVEL', null, ['node', '--version']]),
    (e) => e.code === '23514',
  );
  // E2b: PLANEJADA com comando — backlog não finge ter coletor.
  await assert.rejects(
    inserir(['teste-conector-d', 'B', 'PLANEJADA', null, ['node', '--version']]),
    (e) => e.code === '23514',
  );
  // E2b: PLANEJADA com motivo de bloqueio — backlog não é bloqueio externo.
  await assert.rejects(
    inserir(['teste-conector-e', 'B', 'PLANEJADA', 'motivo inventado', null]),
    (e) => e.code === '23514',
  );
  // Situação fora do vocabulário de db/56.
  await assert.rejects(
    inserir(['teste-conector-f', 'B', 'EM_OBRAS', null, null]),
    (e) => e.code === '23514',
  );
});

test('(f) E2b: programa completo das matrizes — contagens exatas por situação, fase e prioridade', async () => {
  const fontes = await carregarFontes(pool);
  // 116 = 14 (db/55) + 60 (db/56: 18 F1 + 42 F2) + 42 parceiras F4 (db/58)
  // — conta detalhada no topo.
  assert.equal(fontes.length, TOTAL_PROGRAMA, 'contagem do programa completo divergiu (ratchet de db/56+db/58)');
  assert.equal(new Set(fontes.map((f) => f.slug)).size, TOTAL_PROGRAMA, 'slug duplicado');

  const por = (chave) => fontes.reduce((m, f) => m.set(f[chave], (m.get(f[chave]) ?? 0) + 1), new Map());
  // EXECUTAVEL: 9 (db/55 — nenhuma F4 nasce executável: candidato ≠ convênio).
  // BLOQUEADA_EXTERNA: 38 = 8 (5 de db/55 + tce-mt, indea-mt, energisa-mt
  //   de db/56) + 30 conveniadas F4 (db/58: forma "Convênio..." sem parte
  //   pública declarada, famílias, agregação e sigilo).
  // PLANEJADA: 69 = 57 (backlog db/56) + 12 F4 com parte PÚBLICA coletável
  //   (imea, fiemt-observatorio, fecomercio-mt, sebrae-mt, ocb-mt,
  //   aprosoja-mt, acrimat, sinduscon-mt, energisa-mt-relatorios,
  //   nova-rota-oeste, rumo-logistica, abrasel-mt).
  assert.deepEqual(Object.fromEntries(por('situacao')),
    { EXECUTAVEL: 9, BLOQUEADA_EXTERNA: 38, PLANEJADA: 69 });
  // Fase 1: 18 novos + 12 existentes mapeados (5 ibge-*, cnes, inep, inpe,
  // mapbiomas, siconfi-despesas, sim, sinasc) = 30. Fase 2: 42 novos + 2
  // existentes (sesp-mt, sinfra-estradas) = 44. Fase 4: as 42 parceiras de
  // db/58 (F4S01–F4S42). Nenhum sem fase.
  assert.deepEqual(Object.fromEntries(por('fase')), { 1: 30, 2: 44, 4: 42 });
  // P0: 56 (db/55+56) + 13 "Candidato prioritário" F4 = 69.
  // P1: 18 (db/55+56) + 29 F4 ("Candidato" e famílias) = 47.
  assert.deepEqual(Object.fromEntries(por('prioridade')), { P0: 69, P1: 47 });
  // Metadados do programa: prioridade e dificuldade sempre; URL sempre,
  // EXCETO famílias de fontes F4 (12 linhas da matriz sem URL — não se
  // inventa portal); área analítica existe nas matrizes F2 e F4 (F1 não a
  // define).
  for (const f of fontes) {
    if (f.urlOficial === null) {
      assert.equal(f.fase, 4, `${f.slug}: só família de fontes F4 pode não ter URL`);
    } else {
      assert.match(f.urlOficial, /^https?:\/\//, `${f.slug}: URL oficial malformada`);
    }
    assert.match(f.dificuldade ?? '', /^(Baixa|Media|Alta)$/, `${f.slug}: dificuldade fora do vocabulário`);
    if (f.fase === 1) assert.equal(f.area, null, `${f.slug}: área analítica é conceito das matrizes F2/F4`);
    else assert.equal(typeof f.area, 'string', `${f.slug}: fonte F2/F4 sem área analítica`);
  }
  assert.equal(fontes.filter((f) => f.urlOficial === null).length, 12,
    'as famílias de fontes F4 sem URL são exatamente 12');
  // Amostras do dedupe (mapeamento do cabeçalho de db/56):
  const porSlug = new Map(fontes.map((f) => [f.slug, f]));
  assert.equal(porSlug.get('cnes').fase, 1);                       // linha 19 OpenDataSUS/CNES
  assert.equal(porSlug.get('sesp-mt').area, 'Seguranca publica');  // F2 SESP_MT
  assert.equal(porSlug.get('sinfra-estradas').fase, 2);            // F2 SINFRA_MT
  assert.equal(porSlug.get('datasus-tabnet').situacao, 'PLANEJADA'); // F1-18, sistemas não cobertos
  // Amostras E5 (db/58 — candidato ≠ convênio):
  const f4 = fontes.filter((f) => f.fase === 4);
  assert.ok(f4.every((f) => f.situacao !== 'EXECUTAVEL'), 'fonte parceira F4 nunca nasce EXECUTAVEL');
  assert.equal(porSlug.get('bancos-parceiros').situacao, 'BLOQUEADA_EXTERNA'); // família, sigilo
  assert.equal(porSlug.get('bancos-parceiros').urlOficial, null);
  assert.equal(porSlug.get('imea').situacao, 'PLANEJADA');         // publicações públicas
  assert.equal(porSlug.get('sebrae-mt').classe, 'B');              // portal de dados estruturado
  assert.equal(porSlug.get('energisa-mt').situacao, 'BLOQUEADA_EXTERNA');      // faixa F2 (convênio)
  assert.equal(porSlug.get('energisa-mt-relatorios').situacao, 'PLANEJADA');   // faixa F4 (pública)
});

test('(g) REGRESSÃO E2b: os 9 executáveis de db/55 continuam executáveis, com comando', async () => {
  const fontes = await carregarFontes(pool);
  const porSlug = new Map(fontes.map((f) => [f.slug, f]));
  for (const slug of EXECUTAVEIS_DB55) {
    const f = porSlug.get(slug);
    assert.ok(f, `${slug}: sumiu do catálogo`);
    assert.equal(f.situacao, 'EXECUTAVEL', `${slug}: regrediu de EXECUTAVEL para ${f?.situacao}`);
    assert.ok(Array.isArray(f.comando) && f.comando.length > 0, `${slug}: perdeu o comando`);
  }
});

test('(h) sincronizar não processa PLANEJADA: planoDeSincronizacao nunca manda executar backlog', async () => {
  // Unidade pura (é a função que sincronizar-fontes.mjs usa no upsert e no laço).
  assert.deepEqual(planoDeSincronizacao({ situacao: 'PLANEJADA' }),
    { status: 'PLANEJADA', executa: false, detalhes: { motivo: MOTIVO_PLANEJADA } });
  assert.deepEqual(planoDeSincronizacao({ situacao: 'BLOQUEADA_EXTERNA', bloqueio: 'ato externo' }),
    { status: 'BLOQUEADA_EXTERNA', executa: false, detalhes: { motivo: 'ato externo' } });
  assert.deepEqual(planoDeSincronizacao({ situacao: 'EXECUTAVEL' }),
    { status: 'PENDENTE', executa: true, detalhes: {} });
  // E contra o catálogo real: nenhuma fonte sem comando recebe executa=true.
  const fontes = await carregarFontes(pool);
  for (const f of fontes) {
    const plano = planoDeSincronizacao(f);
    assert.equal(plano.executa, f.situacao === 'EXECUTAVEL', `${f.slug}: plano incoerente com a situação`);
    if (plano.executa) assert.ok(Array.isArray(f.comando), `${f.slug}: executa sem comando`);
  }
  // O status PLANEJADA existe no vocabulário da agenda (db/56 recriou o CHECK de db/41).
  const check = await pool.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = '"FonteSincronizacao"'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%Status%'`,
  );
  assert.ok(check.rows.some((r) => r.def.includes('PLANEJADA')),
    'CHECK de "FonteSincronizacao_Status" não aceita PLANEJADA — db/56 não foi aplicada?');
});

test('(d) banco sem db/55 ⇒ erro claro mandando migrar, NUNCA fallback hardcoded', async () => {
  const semTabela = {
    query: async () => {
      const e = new Error('relation "FonteConector" does not exist');
      e.code = '42P01';
      throw e;
    },
  };
  await assert.rejects(
    carregarFontes(semTabela),
    (e) => /db\/55/.test(e.message) && /npm run migrar/.test(e.message) && /fallback/.test(e.message),
  );
  // Erro que NÃO é tabela ausente passa intacto (nada é engolido).
  const outroErro = { query: async () => { const e = new Error('boom'); e.code = '57P01'; throw e; } };
  await assert.rejects(carregarFontes(outroErro), /boom/);
});

test('(e) catálogo global: itmt_app só lê; curadoria é migração (como db/51 e db/54)', async () => {
  const grants = await pool.query(
    `SELECT has_table_privilege('itmt_app','"FonteConector"','SELECT') AS s,
            has_table_privilege('itmt_app','"FonteConector"','INSERT') AS i,
            has_table_privilege('itmt_app','"FonteConector"','UPDATE') AS u,
            has_table_privilege('itmt_app','"FonteConector"','DELETE') AS d`,
  );
  assert.deepEqual(grants.rows[0], { s: true, i: false, u: false, d: false });
});

// ============================================================
// E15 (db/59): verificação ≠ ingestão ≠ latência ≠ frescor.
// ============================================================

test('(i) E15: classificarFrescor cobre as 5 classes com bordas exatas', () => {
  const agora = new Date('2026-08-28T00:00:00Z');
  const ha = (n) => new Date(agora.getTime() - n * 86400000); // carga há N dias
  const base = { intervaloDias: 30, latenciaDias: 60, agora }; // janela+latência = 90; 1,5× = 135

  // Sem histórico ⇒ DESCONHECIDO; falha na última tentativa ⇒ INDISPONIVEL
  // (mesmo com histórico bom — a falha é problema NOSSO, não da origem).
  assert.equal(classificarFrescor({ ...base, ultimaCargaEm: null }), 'DESCONHECIDO');
  assert.equal(classificarFrescor({ ...base, ultimaCargaEm: ha(1), falhouAgora: true }), 'INDISPONIVEL');
  assert.equal(classificarFrescor({ ...base, ultimaCargaEm: null, falhouAgora: true }), 'INDISPONIVEL');

  // Borda: exatamente na janela de verificação — folgado, EM_DIA.
  assert.equal(classificarFrescor({ ...base, ultimaCargaEm: ha(30) }), 'EM_DIA');
  // Borda: exatamente em janela+latência (90) — silêncio ainda é NORMAL.
  // "Ausência de atualização não significa automaticamente falha."
  assert.equal(classificarFrescor({ ...base, ultimaCargaEm: ha(90) }), 'EM_DIA');
  // Um dia além de janela+latência ⇒ ATENCAO (vale olhar, não é incidente).
  assert.equal(classificarFrescor({ ...base, ultimaCargaEm: ha(91) }), 'ATENCAO');
  // Borda: logo abaixo de 1,5× (135) ainda é ATENCAO; em 1,5× vira ATRASADO.
  assert.equal(classificarFrescor({ ...base, ultimaCargaEm: ha(134) }), 'ATENCAO');
  assert.equal(classificarFrescor({ ...base, ultimaCargaEm: ha(135) }), 'ATRASADO');
  assert.equal(classificarFrescor({ ...base, ultimaCargaEm: ha(500) }), 'ATRASADO');

  // Sem latência declarada (null) ⇒ só a janela manda (latência conta 0).
  assert.equal(classificarFrescor({ ultimaCargaEm: ha(35), intervaloDias: 35, latenciaDias: null, agora }), 'EM_DIA');
  assert.equal(classificarFrescor({ ultimaCargaEm: ha(36), intervaloDias: 35, latenciaDias: null, agora }), 'ATENCAO');
  assert.equal(classificarFrescor({ ultimaCargaEm: ha(53), intervaloDias: 35, latenciaDias: null, agora }), 'ATRASADO'); // 52,5 = 1,5×35

  // Vocabulário fechado (corte YAGNI do Core R2.1 documentado em db/59).
  assert.deepEqual([...FRESCORES], ['DESCONHECIDO', 'EM_DIA', 'ATENCAO', 'ATRASADO', 'INDISPONIVEL']);
});

test('(j) E15: RETROCOMPATIBILIDADE — conector sem os campos novos usa a janela do tipo (35/400) igual antes', async () => {
  // Unidade: NULL herda `dias`; curadoria presente vence.
  assert.equal(intervaloEfetivo({ dias: 35, intervaloVerificacaoDias: null }), 35);
  assert.equal(intervaloEfetivo({ dias: 400, intervaloVerificacaoDias: null }), 400);
  assert.equal(intervaloEfetivo({ dias: 35, intervaloVerificacaoDias: 7 }), 7);
  // Contra o catálogo real: toda fonte SEM cadência curada mantém a janela
  // do tipo — o comportamento pré-E15, byte a byte.
  const fontes = await carregarFontes(pool);
  for (const f of fontes) {
    if (f.intervaloVerificacaoDias === null) {
      assert.equal(intervaloEfetivo(f), f.dias, `${f.slug}: sem curadoria E15, a janela do tipo manda`);
    } else {
      assert.equal(intervaloEfetivo(f), f.intervaloVerificacaoDias, `${f.slug}: cadência curada deveria vencer`);
    }
  }
});

test('(k) E15: bloqueadas e planejadas são DESCONHECIDO sempre — quem não opera não está atrasado', async () => {
  const antiga = new Date('2020-01-01T00:00:00Z');
  // Unidade: mesmo com "histórico" ou falha, fonte fora de operação não tem frescor.
  assert.equal(frescorDaFonte({ situacao: 'BLOQUEADA_EXTERNA', dias: 35 }, { ultimoSucesso: antiga }), 'DESCONHECIDO');
  assert.equal(frescorDaFonte({ situacao: 'PLANEJADA', dias: 400 }, { ultimaFalhou: true }), 'DESCONHECIDO');
  // Executável sem histórico também é DESCONHECIDO; com falha, INDISPONIVEL;
  // com carga recente, EM_DIA.
  assert.equal(frescorDaFonte({ situacao: 'EXECUTAVEL', dias: 35 }), 'DESCONHECIDO');
  assert.equal(frescorDaFonte({ situacao: 'EXECUTAVEL', dias: 35 }, { ultimaFalhou: true }), 'INDISPONIVEL');
  assert.equal(frescorDaFonte({ situacao: 'EXECUTAVEL', dias: 35 }, { ultimoSucesso: new Date() }), 'EM_DIA');
  // Contra o catálogo real: nenhuma fonte fora de operação sai de DESCONHECIDO.
  const fontes = await carregarFontes(pool);
  for (const f of fontes.filter((x) => x.situacao !== 'EXECUTAVEL')) {
    assert.equal(frescorDaFonte(f, { ultimoSucesso: antiga }), 'DESCONHECIDO', `${f.slug}: fora de operação não é atraso`);
  }
});

test('(l) E15: seeds de curadoria dos 9 executáveis presentes; não-executáveis sem cadência inventada', async () => {
  const fontes = await carregarFontes(pool);
  const porSlug = new Map(fontes.map((f) => [f.slug, f]));
  // Os 9 executáveis de db/55 têm cadência e latência curadas (db/59).
  for (const slug of EXECUTAVEIS_DB55) {
    const f = porSlug.get(slug);
    assert.ok(Number.isInteger(f.intervaloVerificacaoDias) && f.intervaloVerificacaoDias > 0,
      `${slug}: executável sem cadência de verificação curada (db/59)`);
    assert.ok(Number.isInteger(f.latenciaDias) && f.latenciaDias >= 0,
      `${slug}: executável sem latência esperada curada (db/59)`);
  }
  // Fotografia dos valores curados (ratchet do seed de db/59) — estimativas
  // honestas, ajustáveis por UPDATE de curadoria (e então este ratchet).
  const curadoria = (slug) => {
    const f = porSlug.get(slug);
    return [f.intervaloVerificacaoDias, f.latenciaDias];
  };
  assert.deepEqual(curadoria('cnes'), [7, 60], 'CNES: checagem semanal, competência sai ~2 meses depois');
  assert.deepEqual(curadoria('inep'), [30, 240]);
  assert.deepEqual(curadoria('mapbiomas'), [30, 240]);
  assert.deepEqual(curadoria('inpe'), [30, 30]);
  assert.deepEqual(curadoria('ibge-territorio'), [30, 270]);
  assert.deepEqual(curadoria('ibge-populacao'), [30, 90]);
  assert.deepEqual(curadoria('ibge-pib'), [30, 730], 'PIB municipal tem ~2 anos de defasagem estrutural — não é atraso');
  assert.deepEqual(curadoria('ibge-f1'), [30, 365]);
  assert.deepEqual(curadoria('ibge-f2'), [30, 365]);
  // Não-executáveis: NULL — sem operação não há cadência a curar.
  for (const f of fontes.filter((x) => x.situacao !== 'EXECUTAVEL')) {
    assert.equal(f.intervaloVerificacaoDias, null, `${f.slug}: fora de operação não tem cadência curada`);
    assert.equal(f.latenciaDias, null, `${f.slug}: fora de operação não tem latência curada`);
  }
  // _UltimaCompetencia: NULL em TODO o catálogo — nenhum conector reporta
  // competência ainda (contrato de saída futuro); valor aqui seria invenção.
  for (const f of fontes) assert.equal(f.ultimaCompetencia, null, `${f.slug}: competência não reportada não se inventa`);
});

test('(l) E15: o BANCO rejeita cadência/latência/frescor inválidos (CHECK, SQLSTATE 23514)', async () => {
  // Cadência de verificação precisa ser > 0.
  await assert.rejects(
    pool.query(`UPDATE "FonteConector" SET "FonteConector_IntervaloVerificacaoDias"=0 WHERE "FonteConector_Slug"='cnes'`),
    (e) => e.code === '23514',
  );
  // Latência negativa não existe.
  await assert.rejects(
    pool.query(`UPDATE "FonteConector" SET "FonteConector_LatenciaEsperadaDias"=-1 WHERE "FonteConector_Slug"='cnes'`),
    (e) => e.code === '23514',
  );
  // Frescor fora do vocabulário reduzido (db/59) é rejeitado na agenda.
  const inserirAgenda = (frescor) => pool.query(
    `INSERT INTO "FonteSincronizacao"
       ("FonteSincronizacao_Slug","FonteSincronizacao_Nome","FonteSincronizacao_Tipo",
        "FonteSincronizacao_Periodicidade","FonteSincronizacao_IntervaloDias",
        "FonteSincronizacao_Frescor")
     VALUES ('teste-frescor-x','fixture E15','API','MENSAL',35,$1)`,
    [frescor],
  );
  await assert.rejects(inserirAgenda('CRITICO'), (e) => e.code === '23514'); // cortado por YAGNI
  await assert.rejects(inserirAgenda('ADIANTADO'), (e) => e.code === '23514');
  await inserirAgenda('EM_DIA'); // vocabulário válido entra
  await pool.query(`DELETE FROM "FonteSincronizacao" WHERE "FonteSincronizacao_Slug"='teste-frescor-x'`);
});
