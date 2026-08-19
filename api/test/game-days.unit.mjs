import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaudeController } from '../dist/common/saude.controller.js';
import { TenantJobsService } from '../dist/auth/tenant-jobs.service.js';
import { CampoController } from '../dist/producao/producao.controller.js';
import { InterpreteService } from '../dist/xingu/interprete.service.js';
import { emitirToken, verificarToken } from '../dist/auth/token.js';
import { GeoPublicoController } from '../dist/producao/geo.controller.js';

const context = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  organizationId: '20000000-0000-4000-8000-000000000001',
  userId: '30000000-0000-4000-8000-000000000001',
};

test('F7-R024 game day: banco fora remove readiness sem derrubar liveness', async () => {
  const controller = new SaudeController({ query: async () => { throw new Error('ECONNREFUSED'); } });
  assert.deepEqual(controller.liveness(), { ok: true, processo: 'vivo' });
  await assert.rejects(() => controller.readiness(), (error) => {
    assert.equal(error.getStatus(), 503);
    assert.deepEqual(error.getResponse(), { ok: false, pronto: false, banco: 'indisponivel' });
    return true;
  });
});

test('F7-R026 game day: storage fora retorna 503 recuperável para preservar outbox', async () => {
  const storage = {
    criarChave: () => 'tenants/t/organizations/o/campo/x.jpg',
    gravar: async () => { throw Object.assign(new Error('volume offline'), { code: 'EIO' }); },
  };
  const controller = new CampoController({}, {}, storage);
  await assert.rejects(
    () => controller.upload({ tenantContext: context }, { idempotency_key: '40000000-0000-4000-8000-000000000003' }, {
      buffer: Buffer.from('imagem'), mimetype: 'image/jpeg', size: 6, originalname: 'campo.jpg',
    }),
    (error) => {
      assert.equal(error.getStatus(), 503);
      assert.equal(error.getResponse().codigo, 'STORAGE_INDISPONIVEL');
      return true;
    },
  );
});

test('F7-R027 game day: fila congestionada aplica backpressure antes de inserir', async () => {
  const previous = process.env.TENANT_JOB_MAX_PENDING;
  process.env.TENANT_JOB_MAX_PENDING = '2';
  let insertAttempted = false;
  const db = {
    withTenantTransaction: async (_context, fn) => fn({
      query: async (sql) => {
        if (sql.includes('count(*)')) return { rows: [{ total: 2, limite: 2 }] };
        insertAttempted = true;
        return { rows: [] };
      },
    }),
  };
  try {
    const jobs = new TenantJobsService(db);
    await assert.rejects(
      () => jobs.enfileirar(context, { tipo: 'EXPORTAR', recurso_id: 'r1', idempotency_key: 'idem-0001' }),
      (error) => error.getStatus() === 503 && error.getResponse().codigo === 'FILA_CONGESTIONADA',
    );
    assert.equal(insertAttempted, false);
  } finally {
    if (previous === undefined) delete process.env.TENANT_JOB_MAX_PENDING;
    else process.env.TENANT_JOB_MAX_PENDING = previous;
  }
});

test('F7-R025 game day: provedor de IA fora degrada para intérprete léxico', async () => {
  const lexico = { interpretar: async () => ({ tipo: 'CLARIFICACAO', clarificacao: { pergunta: 'Qual local?', opcoes: [] } }) };
  const service = new InterpreteService(
    { obter: async () => ({ municipios: [], rgints: [], rgis: [], consorcios: [], indicadores: [] }) },
    lexico,
    { dentroDoOrcamento: async () => true, registrar: async () => undefined },
  );
  service.provedor = {
    nome: () => 'provedor-fora', disponivel: () => true,
    completar: async () => { throw new Error('HTTP 503'); },
  };
  const result = await service.interpretar('população estadual');
  assert.equal(result.interprete, 'lexico');
  assert.equal(result.tipo, 'CLARIFICACAO');
});

test('F7-R029 game day: rotação de credencial invalida sessão comprometida', () => {
  const previous = process.env.SESSION_SECRET;
  try {
    process.env.SESSION_SECRET = 'segredo-antigo-com-mais-de-trinta-e-dois-caracteres';
    const compromised = emitirToken('atacante@teste.invalid', 'ADMIN');
    assert.ok(verificarToken(compromised));
    process.env.SESSION_SECRET = 'segredo-rotacionado-com-mais-de-trinta-e-dois-caracteres';
    assert.equal(verificarToken(compromised), null);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

test('F7-R028 game day: GIS externo fora mantém OGC/GeoJSON/download local', async () => {
  const previousUrl = process.env.GEOSERVER_HEALTH_URL;
  const previousFetch = globalThis.fetch;
  process.env.GEOSERVER_HEALTH_URL = 'https://gis.invalid/health';
  globalThis.fetch = async () => { throw new Error('GIS indisponível'); };
  try {
    const status = await new GeoPublicoController({}).statusServicoGis();
    assert.deepEqual(status, {
      ok: false, modo: 'degradado', servico_externo: true,
      fallbacks: ['ogc-api-local', 'geojson-local', 'downloads'],
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.GEOSERVER_HEALTH_URL;
    else process.env.GEOSERVER_HEALTH_URL = previousUrl;
  }
});
