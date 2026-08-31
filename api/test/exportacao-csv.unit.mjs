// ============================================================
// exportacao-csv.unit.mjs — catraca da neutralização de injeção de fórmula
// na exportação CSV (revisão de segurança de 31/08/2026).
//
// O CSV do portal é servido com BOM para o Excel pt-BR abrir com dois cliques.
// Isso é conveniente para o cidadão e perigoso para ele: um campo iniciado por
// = + - @ TAB ou CR vira FÓRMULA na máquina de quem baixa. O nome da fonte vem
// do catálogo de ingestão e é texto livre, então basta uma fonte cadastrada
// como =cmd|'/c calc'!A1 para o portal PÚBLICO distribuir o payload.
//
// A catraca precisa provar as duas metades: neutraliza o perigoso E preserva
// o número legítimo — delta_media_estadual é negativo com frequência, e um
// apóstrofo nele corromperia a planilha do usuário.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escaparCampoCsv } from '../dist/indicadores/exportacao.controller.js';

test('injeção de fórmula é neutralizada com apóstrofo', () => {
  for (const ataque of [
    "=cmd|'/c calc'!A1",
    '+cmd|calc',
    '@SUM(1+1)*cmd',
    '=1+1',
    '\tcomeca-com-tab',
  ]) {
    const saida = escaparCampoCsv(ataque);
    assert.ok(
      saida.startsWith("'") || saida.startsWith('"\''),
      `"${ataque}" tinha que sair neutralizado, saiu: ${saida}`,
    );
  }
});

test('número legítimo NÃO é neutralizado — inclusive negativo', () => {
  // delta_media_estadual negativo é o caso real que um prefixo cego quebraria.
  for (const numero of ['-12', '-3.5', '-0,75', '0', '1234', '8.7']) {
    assert.equal(escaparCampoCsv(numero), numero,
      `"${numero}" é número e tem que sair intacto`);
  }
});

test('CR sozinho é escapado — antes quebrava a estrutura de linhas', () => {
  const saida = escaparCampoCsv('linha1\rlinha2');
  assert.ok(saida.startsWith('"') && saida.endsWith('"'),
    'campo com CR precisa sair entre aspas para não quebrar o arquivo');
});

test('escape clássico de CSV segue valendo', () => {
  assert.equal(escaparCampoCsv('Fonte "X"'), '"Fonte ""X"""');
  assert.equal(escaparCampoCsv('a;b'), '"a;b"');
  assert.equal(escaparCampoCsv('linha1\nlinha2'), '"linha1\nlinha2"');
  assert.equal(escaparCampoCsv('Cuiabá'), 'Cuiabá');
});

test('valor ausente não vira "undefined" no arquivo', () => {
  assert.equal(escaparCampoCsv(undefined), '');
  assert.equal(escaparCampoCsv(null), '');
});
