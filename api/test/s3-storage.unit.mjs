import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { TenantObjectStorageService } from '../dist/auth/tenant-object-storage.service.js';

const a = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  organizationId: '20000000-0000-4000-8000-000000000001',
};
const b = { ...a, organizationId: '20000000-0000-4000-8000-000000000002' };

test('S3 grava com criptografia/checksum e mantém namespace tenant', async () => {
  const previous = { driver: process.env.OBJECT_STORAGE_DRIVER, bucket: process.env.OBJECT_STORAGE_BUCKET };
  process.env.OBJECT_STORAGE_DRIVER = 's3'; process.env.OBJECT_STORAGE_BUCKET = 'itmt-test';
  const commands = [];
  const client = { send: async (command) => { commands.push(command); return {}; } };
  try {
    const storage = new TenantObjectStorageService(undefined, client);
    const key = storage.criarChave(a, 'campo', '40000000-0000-4000-8000-000000000003', 'jpg');
    const result = await storage.gravar(a, key, Buffer.from('conteudo'));
    assert.equal(result.sha256.length, 64);
    assert.equal(commands[0].input.Bucket, 'itmt-test');
    assert.equal(commands[0].input.ServerSideEncryption, 'AES256');
    assert.equal(commands[0].input.IfNoneMatch, '*');
    await assert.rejects(() => storage.gravar(b, key, Buffer.from('ataque')), /namespace tenant/);
  } finally {
    if (previous.driver === undefined) delete process.env.OBJECT_STORAGE_DRIVER; else process.env.OBJECT_STORAGE_DRIVER = previous.driver;
    if (previous.bucket === undefined) delete process.env.OBJECT_STORAGE_BUCKET; else process.env.OBJECT_STORAGE_BUCKET = previous.bucket;
  }
});

test('S3 lê corpo binário somente após validar o prefixo', async () => {
  const previous = { driver: process.env.OBJECT_STORAGE_DRIVER, bucket: process.env.OBJECT_STORAGE_BUCKET };
  process.env.OBJECT_STORAGE_DRIVER = 's3'; process.env.OBJECT_STORAGE_BUCKET = 'itmt-test';
  const body = Readable.from([Buffer.from('objeto')]);
  body.transformToByteArray = async () => new Uint8Array(Buffer.from('objeto'));
  const client = { send: async () => ({ Body: body }) };
  try {
    const storage = new TenantObjectStorageService(undefined, client);
    const key = storage.criarChave(a, 'campo', '40000000-0000-4000-8000-000000000003', 'jpg');
    assert.equal((await storage.ler(a, key)).toString(), 'objeto');
    await assert.rejects(() => storage.ler(b, key), /namespace tenant/);
  } finally {
    if (previous.driver === undefined) delete process.env.OBJECT_STORAGE_DRIVER; else process.env.OBJECT_STORAGE_DRIVER = previous.driver;
    if (previous.bucket === undefined) delete process.env.OBJECT_STORAGE_BUCKET; else process.env.OBJECT_STORAGE_BUCKET = previous.bucket;
  }
});
