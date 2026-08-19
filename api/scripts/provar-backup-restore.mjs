import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const origemAdmin = new URL(
  process.env.TEST_DATABASE_ADMIN_URL ?? process.env.DATABASE_URL ??
  'postgres://itmt:itmt@localhost:5432/postgres',
);
origemAdmin.pathname = '/postgres';
const sourceName = 'itmt_dr_source_test';
const restoreName = 'itmt_dr_restore_test';
const sourceUrl = new URL(origemAdmin); sourceUrl.pathname = `/${sourceName}`;
const restoreUrl = new URL(origemAdmin); restoreUrl.pathname = `/${restoreName}`;
const work = join(tmpdir(), `itmt-dr-${process.pid}`);
const dumpFile = join(work, 'itmt.backup');
const admin = new pg.Client({ connectionString: origemAdmin.toString() });

function postgresTool(name) {
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const candidates = [
    process.env.PG_BIN ? join(process.env.PG_BIN, `${name}${suffix}`) : '',
    process.platform === 'win32' ? join('C:\\Program Files\\PostgreSQL\\18\\bin', `${name}.exe`) : '',
    `${name}${suffix}`,
  ].filter(Boolean);
  return candidates.find((path) => path === `${name}${suffix}` || existsSync(path)) ?? candidates.at(-1);
}

function pgEnvironment(url) {
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  };
}

function run(command, args, env, label) {
  const result = spawnSync(command, args, { env, cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${label} falhou (${result.status}): ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

async function dropDatabase(name) {
  await admin.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',
    [name],
  );
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
}

async function snapshot(url) {
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT
        (SELECT count(*)::int FROM "Municipio") AS municipios,
        (SELECT count(*)::int FROM "Indicador") AS indicadores,
        (SELECT count(*)::int FROM "Observacao") AS observacoes,
        (SELECT count(*)::int FROM "EventoAuditoria") AS auditoria,
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public') AS tabelas
    `);
    return result.rows[0];
  } finally {
    await client.end();
  }
}

let exitCode = 0;
const started = Date.now();
try {
  await mkdir(work, { recursive: true });
  await admin.connect();
  await dropDatabase(sourceName);
  await dropDatabase(restoreName);
  await admin.query(`CREATE DATABASE "${sourceName}"`);
  run(process.execPath, ['scripts/migrar.mjs'], { ...process.env, DATABASE_URL: sourceUrl.toString(), NODE_ENV: 'test' }, 'migração da origem');
  const before = await snapshot(sourceUrl);

  const backupStarted = Date.now();
  run(postgresTool('pg_dump'), ['--format=custom', '--no-owner', '--file', dumpFile], pgEnvironment(sourceUrl), 'backup');
  const backupSeconds = (Date.now() - backupStarted) / 1000;

  await admin.query(`CREATE DATABASE "${restoreName}"`);
  const restoreStarted = Date.now();
  run(postgresTool('pg_restore'), ['--no-owner', '--exit-on-error', '--dbname', restoreName, dumpFile], pgEnvironment(restoreUrl), 'restore');
  const restoreSeconds = (Date.now() - restoreStarted) / 1000;
  const after = await snapshot(restoreUrl);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`contagens divergentes: origem=${JSON.stringify(before)} restore=${JSON.stringify(after)}`);
  }
  run(process.execPath, ['scripts/verificar-cadeia.mjs'], { ...process.env, DATABASE_URL: restoreUrl.toString(), NODE_ENV: 'test' }, 'cadeia restaurada');
  console.log(JSON.stringify({
    result: 'PASS', source: sourceName, restored: restoreName,
    backup_seconds: backupSeconds, rto_restore_seconds: restoreSeconds,
    total_seconds: (Date.now() - started) / 1000, counts: after,
  }, null, 2));
} catch (error) {
  exitCode = 1;
  console.error(`[dr-restore] FAIL: ${error.message}`);
} finally {
  if (admin._connected) {
    try { await dropDatabase(restoreName); await dropDatabase(sourceName); } catch (error) {
      console.error(`[dr-restore] limpeza falhou: ${error.message}`); exitCode = 1;
    }
    await admin.end();
  }
  await rm(work, { recursive: true, force: true });
}
process.exit(exitCode);
