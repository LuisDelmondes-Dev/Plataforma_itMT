import assert from 'node:assert/strict';
import test from 'node:test';
import { FONTES, proximaVerificacao } from '../scripts/fontes-registry.mjs';

test('registro não repete slugs e declara intervalos positivos', () => {
  assert.equal(new Set(FONTES.map((f) => f.slug)).size, FONTES.length);
  assert.ok(FONTES.every((f) => Number.isInteger(f.dias) && f.dias > 0));
});

test('falha é retentada em até sete dias; sucesso respeita periodicidade', () => {
  const agora = new Date('2026-08-19T00:00:00Z');
  assert.equal(proximaVerificacao(agora, 400, false).toISOString(), '2026-08-26T00:00:00.000Z');
  assert.equal(proximaVerificacao(agora, 35, true).toISOString(), '2026-09-23T00:00:00.000Z');
});
