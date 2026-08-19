import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });

for (const arquivo of [
  'AGENTS.md',
  'docs/requirements/TRACEABILITY.md',
  'docs/evidence/ledger.md',
  'docs/gates/F0.md',
  'docs/adr/ADR-001-gateway-ia.md',
  'docs/adr/ADR-002-pgvector.md',
  'docs/adr/ADR-003-monolito-modular.md',
  'api/scripts/test-e2e.mjs',
]) {
  check(`artefato ${arquivo}`, existsSync(arquivo), existsSync(arquivo) ? 'presente' : 'ausente');
}

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
for (const regra of ['npm test', 'npm audit', 'npm sbom', 'gitleaks', 'codeql-action']) {
  check(`CI contém ${regra}`, ci.toLowerCase().includes(regra.toLowerCase()), 'fitness function CI');
}

const env = {
  ...process.env,
  POSTGRES_SENHA: 'gate-owner-password-123456789',
  ITMT_APP_SENHA: 'gate-app-password-123456789012',
  ADMIN_TOKEN: 'gate-admin-token-123456789012',
  SESSION_SECRET: 'gate-session-secret-123456789012345678901234',
  ADMIN_SENHA_INICIAL: 'gate-initial-admin-password',
  CORS_ORIGEM: 'https://itmt.example.gov.br',
  METRICS_TOKEN: 'gate-metrics-token-12345678901234567890',
  OBJECT_STORAGE_BUCKET: 'itmt-gate-bucket',
  CADDY_DOMINIO: 'itmt.example.gov.br',
};
const compose = spawnSync(
  'docker',
  ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.prod.yml', 'config', '--format', 'json'],
  { encoding: 'utf8', env },
);
check('docker compose config', compose.status === 0, compose.stderr?.trim() || `exit ${compose.status}`);

if (compose.status === 0) {
  const cfg = JSON.parse(compose.stdout);
  const publicados = Object.entries(cfg.services)
    .filter(([, service]) => Array.isArray(service.ports) && service.ports.length)
    .map(([name, service]) => [name, service.ports.map((p) => Number(p.published)).sort()]);
  check(
    'somente proxy publica portas',
    publicados.length === 1 && publicados[0][0] === 'proxy',
    JSON.stringify(publicados),
  );
  check('banco sem porta pública', !cfg.services.db.ports, JSON.stringify(cfg.services.db.ports ?? []));
  check('API sem porta pública', !cfg.services.api.ports, JSON.stringify(cfg.services.api.ports ?? []));
  check('web sem porta pública', !cfg.services.web.ports, JSON.stringify(cfg.services.web.ports ?? []));
  check(
    'API aguarda migrator',
    cfg.services.api.depends_on?.migrator?.condition === 'service_completed_successfully',
    JSON.stringify(cfg.services.api.depends_on?.migrator ?? null),
  );
  const dbMounts = cfg.services.db.volumes ?? [];
  check(
    'produção não monta seed SQL no initdb',
    dbMounts.every((v) => !String(v.source ?? '').includes('.sql') && !String(v.target ?? '').includes('docker-entrypoint-initdb.d')),
    JSON.stringify(dbMounts),
  );
}

const falhas = checks.filter((x) => !x.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} | ${c.name} | ${c.detail}`);
console.log(falhas.length ? `F0_GATE=FAIL (${falhas.length})` : 'F0_GATE=PASS');
process.exit(falhas.length ? 1 : 0);
