import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarConfiguracaoRegional } from '../dist/config/regiao.js';
import { carregarConfiguracaoRegional as carregarScript } from '../scripts/regiao-config.mjs';

test('F7-R030-R032: core aceita outra UF sem alteração de código', () => {
  const env = {
    REGIAO_NOME: 'Goiás', REGIAO_SIGLA: 'GO', REGIAO_CODIGO_UF_IBGE: '52',
    REGIAO_MUNICIPIOS_ESPERADOS: '246', REGIAO_ALIASES: 'estado de goiás,go',
  };
  assert.deepEqual(carregarConfiguracaoRegional(env), {
    nome: 'Goiás', sigla: 'GO', codigoUfIbge: '52', municipiosEsperados: 246,
    aliases: ['Goiás', 'GO', 'estado de goiás', 'go'],
  });
  assert.deepEqual(carregarScript(env), {
    nome: 'Goiás', sigla: 'GO', codigoUfIbge: '52', municipiosEsperados: 246,
  });
});

test('configuração regional falha cedo para código UF inválido', () => {
  assert.throws(() => carregarConfiguracaoRegional({ REGIAO_CODIGO_UF_IBGE: '510' }), /dois dígitos/);
});
