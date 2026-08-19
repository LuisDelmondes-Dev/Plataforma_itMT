import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refrescarFontes } from '../scripts/refrescar-fontes.mjs';

const resposta = (corpo, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
});

test('refresh de fontes falha de forma observável quando a API está indisponível', async () => {
  const resultado = await refrescarFontes({
    base: 'http://api-indisponivel',
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
    log: { log() {}, error() {} },
  });

  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, 'API_INDISPONIVEL');
  assert.equal(resultado.falhas, 1);
});

test('refresh de fontes sinaliza falha parcial e preserva resumo estruturado', async () => {
  const chamadas = [];
  const resultado = await refrescarFontes({
    base: 'http://api',
    fetchImpl: async (url, opcoes = {}) => {
      chamadas.push({ url, method: opcoes.method ?? 'GET' });
      if (url.endsWith('/v1/agentes/fontes')) return resposta([
        { slug: 'em-dia', tipo: 'API', situacao: { atualizado: true, motivo: 'válido' } },
        { slug: 'falha', tipo: 'API', situacao: { atualizado: false } },
        { slug: 'manual', tipo: 'ARQUIVO', situacao: { atualizado: false } },
      ]);
      return resposta({ origem: 'CACHE', sucesso: false, situacao: { motivo: 'fonte fora do ar' } });
    },
    log: { log() {}, error() {} },
  });

  assert.deepEqual(chamadas.map((x) => x.method), ['GET', 'POST']);
  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, 'FALHAS_DE_ATUALIZACAO');
  assert.equal(resultado.ja_em_dia, 1);
  assert.equal(resultado.falhas, 1);
  assert.deepEqual(resultado.fontes_com_falha, ['falha']);
});

test('refresh de fontes retorna sucesso somente quando todas as APIs estão válidas', async () => {
  const resultado = await refrescarFontes({
    fetchImpl: async () => resposta([
      { slug: 'ibge', tipo: 'API', situacao: { atualizado: true, motivo: 'válido' } },
    ]),
    log: { log() {}, error() {} },
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.falhas, 0);
  assert.equal(resultado.ja_em_dia, 1);
});
