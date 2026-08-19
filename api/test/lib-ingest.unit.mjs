import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { salvarBronze } from '../scripts/lib-ingest.mjs';

test('Bronze restringe destino, tamanho e preserva imutabilidade sem check-then-write', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'itmt-bronze-test-'));
  const anteriorDir = process.env.BRONZE_DIR;
  const anteriorLimite = process.env.BRONZE_MAX_BYTES;
  process.env.BRONZE_DIR = raiz;
  process.env.BRONZE_MAX_BYTES = '32';
  try {
    assert.throws(() => salvarBronze('../fora.json', '{}'), /nome de arquivo Bronze inválido/i);
    assert.throws(() => salvarBronze('grande.json', 'x'.repeat(33)), /excede o limite/i);

    const primeira = salvarBronze('oficial-2026.json', '{"oficial":true}');
    const repetida = salvarBronze('oficial-2026.json', '{"oficial":true}');
    assert.equal(repetida.caminho, primeira.caminho);
    assert.equal(repetida.hash, primeira.hash);
    assert.throws(
      () => salvarBronze('oficial-2026.json', '{"oficial":false}'),
      /Bronze imutável/i,
    );
  } finally {
    if (anteriorDir === undefined) delete process.env.BRONZE_DIR;
    else process.env.BRONZE_DIR = anteriorDir;
    if (anteriorLimite === undefined) delete process.env.BRONZE_MAX_BYTES;
    else process.env.BRONZE_MAX_BYTES = anteriorLimite;
    await rm(raiz, { recursive: true, force: true });
  }
});
