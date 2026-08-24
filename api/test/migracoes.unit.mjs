// ============================================================
// migracoes.unit.mjs — descoberta de migrações (D-01 da fotografia
// de dívida, docs/programa/DIVIDA_TECNICA.md). O ATTACK provou DOIS
// defeitos no migrador antigo, não um: o regex /^\d{2}-/ nunca
// descobriria a migração "100-" (ela seria pulada em silêncio), e a
// correção sugerida no CLAUDE.md — só alargar o regex — era
// insuficiente, porque o sort() lexicográfico aplicaria "100-"
// ANTES de "99-". A descoberta agora vive em scripts/lib-migracoes.mjs
// com ordem numérica pelo prefixo.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { descobrirMigracoes } from '../scripts/lib-migracoes.mjs';

const dirDb = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db');

function comArquivos(nomes, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'itmt-migracoes-'));
  try {
    for (const f of nomes) writeFileSync(join(dir, f), '-- fixture de descoberta');
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('migração de três dígitos é descoberta e vem DEPOIS da 99, não antes', () => {
  comArquivos(['100-futura.sql', '09-antiga.sql', '99-limite.sql'], (dir) => {
    assert.deepEqual(descobrirMigracoes(dir), ['09-antiga.sql', '99-limite.sql', '100-futura.sql']);
  });
});

test('só NN-*.sql com dois dígitos ou mais entra: 9-, README e .txt ficam fora', () => {
  comArquivos(['9-um-digito.sql', 'README.md', '100-nao-sql.txt', '10-valida.sql'], (dir) => {
    assert.deepEqual(descobrirMigracoes(dir), ['10-valida.sql']);
  });
});

test('para os arquivos reais de db/, a ordem numérica preserva a histórica (dois dígitos)', () => {
  // Paridade com o comportamento do migrador antigo para tudo que já foi
  // aplicado em bancos existentes — o filtro <100 mantém o teste válido
  // quando a primeira migração de três dígitos chegar.
  const historica = readdirSync(dirDb).filter((f) => /^\d{2}-.*\.sql$/.test(f)).sort();
  const novas = descobrirMigracoes(dirDb).filter((f) => parseInt(f, 10) < 100);
  assert.ok(historica.length >= 47, 'db/ deveria ter ao menos as 47 migrações atuais');
  assert.deepEqual(novas, historica);
});
