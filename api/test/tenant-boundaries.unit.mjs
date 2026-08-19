import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TenantCacheService } from '../dist/auth/tenant-cache.service.js';
import { TenantObjectStorageService } from '../dist/auth/tenant-object-storage.service.js';

const A = { tenantId: '50000000-0000-4000-8000-000000000001', organizationId: '60000000-0000-4000-8000-000000000001' };
const B = { tenantId: '50000000-0000-4000-8000-000000000002', organizationId: '60000000-0000-4000-8000-000000000002' };
const OBJETO = '70000000-0000-4000-8000-000000000001';

test('cache inclui tenant+organização e resiste a leitura/invalidacão cruzada', () => {
  const cache = new TenantCacheService();
  cache.set(A, 'consulta', 'mesma-chave', { origem: 'A' }, 10_000);
  cache.set(B, 'consulta', 'mesma-chave', { origem: 'B' }, 10_000);
  assert.deepEqual(cache.get(A, 'consulta', 'mesma-chave'), { origem: 'A' });
  assert.deepEqual(cache.get(B, 'consulta', 'mesma-chave'), { origem: 'B' });
  cache.invalidarOrganizacao(A);
  assert.equal(cache.get(A, 'consulta', 'mesma-chave'), undefined);
  assert.deepEqual(cache.get(B, 'consulta', 'mesma-chave'), { origem: 'B' });
});

test('storage usa prefixo canônico, preserva hash e nega Tenant A→B/traversal', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'itmt-tenant-storage-'));
  try {
    const storage = new TenantObjectStorageService(raiz);
    const chave = storage.criarChave(A, 'documentos', OBJETO, 'txt');
    assert.match(chave, new RegExp(`^tenants/${A.tenantId}/organizations/${A.organizationId}/`));
    const salvo = await storage.gravar(A, chave, Buffer.from('conteúdo A'));
    assert.equal(salvo.sha256.length, 64);
    assert.equal((await storage.ler(A, chave)).toString(), 'conteúdo A');
    await assert.rejects(() => storage.ler(B, chave), /fora do namespace tenant/i);
    await assert.rejects(() => storage.ler(A, `${chave}/../../segredo`), /namespace|caminho/i);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});
