import { spawnSync } from 'node:child_process';
import pg from 'pg';

const SUITES_PADRAO = [
  'test/e2e.mjs',
  'test/xingu.e2e.mjs',
  'test/f3.e2e.mjs',
  'test/f4.e2e.mjs',
  'test/projecao.e2e.mjs',
  'test/parceiros.e2e.mjs',
  'test/integracoes.e2e.mjs',
  'test/documentos.e2e.mjs',
  'test/interoperabilidade.e2e.mjs',
  'test/f2-gates.unit.mjs',
  'test/refrescar-fontes.unit.mjs',
  'test/lib-ingest.unit.mjs',
  'test/xingu-provedores.unit.mjs',
  'test/agent-executor.unit.mjs',
  'test/multitenancy.e2e.mjs',
  'test/tenant-context.e2e.mjs',
  'test/tenant-boundaries.unit.mjs',
  'test/security.unit.mjs',
  'test/game-days.unit.mjs',
  'test/regional-config.unit.mjs',
  'test/s3-storage.unit.mjs',
  'test/conformidade.e2e.mjs',
  'test/participacao.e2e.mjs',
  // Suítes de segurança que existiam fora do runner (EV-20260822-044):
  // sem elas aqui, a catraca de menor privilégio e o contrato de expand
  // tenant não protegiam nada em npm test/CI.
  'test/least-privilege.unit.mjs',
  'test/tenant-expand.unit.mjs',
  'test/fontes-registry.test.mjs',
  'test/sentinela-redteam.unit.mjs',
  'test/bordas-decisao.unit.mjs',
  'test/migracoes.unit.mjs',
  // Evolução E4 (ADR-010 — malha completa dos 142 municípios, db/57).
  // ANTES de ranking.unit.mjs de propósito: os municípios sintéticos
  // 5199xxx daquela suíte ainda não existem e a contagem de 142 é pura.
  'test/malha.unit.mjs',
  // Gauntlet "Pesquisa vs IA Xingú" (docs/gauntlet/PLANO.md) — ratchet:
  'test/pesquisas.unit.mjs',
  'test/ranking.unit.mjs',
  'test/modo.e2e.mjs',
  'test/causas.unit.mjs',
  'test/sugestoes.unit.mjs',
  'test/siconfi.unit.mjs',
  // Evolução da base (ADR-010):
  'test/dimensoes.unit.mjs',
  // Evolução E6 (db/61 — golden set persistido: upsert idempotente,
  // aposentadoria sem DELETE, histórico de avaliações append-only).
  'test/golden.unit.mjs',
  // Evolução E17 (db/62 — configuração de ingestão versionada: catraca
  // anti-drift arquivo×banco, vigência única, imutabilidade por trigger,
  // fallback RG-05-like do carregarConfigIngestao).
  'test/config-ingestao.unit.mjs',
  // Evoluções E18/E19 (db/63 — checkpoint em duas fases na carga e
  // quarentena idempotente). Cria fontes/cargas sintéticas próprias; roda
  // antes de status-dado.unit.mjs, que mexe no catálogo de indicadores.
  'test/carga-candidata.unit.mjs',
  // Evolução E3 (db/60 — status do dado no quinteto de procedência). Por
  // último de propósito: cria/remove um indicador sintético aprovado.
  'test/status-dado.unit.mjs',
];
const ARQUIVOS_TESTE = process.env.TEST_FILES
  ? process.env.TEST_FILES.split(',').map((x) => x.trim()).filter(Boolean)
  : SUITES_PADRAO;

const origem = new URL(
  process.env.TEST_DATABASE_ADMIN_URL ??
    process.env.DATABASE_URL ??
    'postgres://itmt:itmt@localhost:5432/postgres',
);
const alvo = process.env.TEST_DATABASE_URL
  ? new URL(process.env.TEST_DATABASE_URL)
  : new URL(origem.toString());

if (!process.env.TEST_DATABASE_URL) alvo.pathname = '/itmt_test';

const banco = decodeURIComponent(alvo.pathname.replace(/^\//, ''));
if (!/^[a-z][a-z0-9_]*(?:_test|_teste)$/.test(banco)) {
  throw new Error(
    `Banco de teste inseguro: "${banco}". O nome deve terminar em _test ou _teste.`,
  );
}
if (alvo.hostname !== origem.hostname || alvo.port !== origem.port) {
  throw new Error('TEST_DATABASE_URL deve apontar para o mesmo servidor do banco administrativo.');
}

const adminUrl = new URL(origem.toString());
adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString() });
let adminConectado = false;
const manterBanco = process.argv.includes('--keep-db') || process.env.KEEP_TEST_DATABASE === '1';
const ambienteTeste = {
  ...process.env,
  NODE_ENV: 'test',
  XINGU_PROVEDOR: 'lexico',
  AGENTES_AUTO: '0',
  DATABASE_URL: alvo.toString(),
};

function executar(args, rotulo) {
  console.log(`\n[test-db] ${rotulo}`);
  const resultado = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: ambienteTeste,
    stdio: 'inherit',
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    const erro = new Error(`${rotulo} falhou com exit code ${resultado.status}.`);
    erro.exitCode = resultado.status ?? 1;
    throw erro;
  }
}

async function recriarBanco() {
  await admin.connect();
  adminConectado = true;
  const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [banco]);
  if (existe.rowCount) {
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [banco],
    );
    await admin.query(`DROP DATABASE "${banco}"`);
  }
  await admin.query(`CREATE DATABASE "${banco}"`);
  console.log(`[test-db] banco descartavel criado: ${banco}`);
}

async function removerBanco() {
  if (manterBanco) {
    console.log(`[test-db] banco mantido para depuracao: ${banco}`);
    return;
  }
  await admin.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
    [banco],
  );
  await admin.query(`DROP DATABASE IF EXISTS "${banco}"`);
  console.log(`[test-db] banco descartavel removido: ${banco}`);
}

let exitCode = 0;
try {
  await recriarBanco();
  executar(['scripts/migrar.mjs'], 'Aplicar migracoes e fixtures deterministicas');
  executar(
    ['--test', '--test-concurrency=1', ...ARQUIVOS_TESTE],
    'Executar suites e2e serializadas',
  );
  executar(['scripts/verificar-cadeia.mjs'], 'Verificar cadeia de auditoria apos toda a suite');
} catch (erro) {
  console.error(`[test-db] ${erro.message}`);
  exitCode = erro.exitCode ?? 1;
} finally {
  try {
    if (adminConectado) await removerBanco();
  } catch (erro) {
    console.error(`[test-db] falha ao remover banco: ${erro.message}`);
    exitCode ||= 1;
  }
  if (adminConectado) await admin.end();
}

process.exit(exitCode);
