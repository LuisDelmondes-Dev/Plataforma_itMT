import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProvedorAnthropic,
  ProvedorOpenAI,
  ProvedorEmCascata,
} from '../dist/xingu/interprete.service.js';

function preservarAmbiente(chaves) {
  const anterior = Object.fromEntries(chaves.map((chave) => [chave, process.env[chave]]));
  return () => {
    for (const [chave, valor] of Object.entries(anterior)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  };
}

test('provedor Anthropic cumpre contrato HTTP e registra consumo por requisição', async () => {
  const restaurar = preservarAmbiente(['ANTHROPIC_API_KEY', 'XINGU_MODELO']);
  const fetchAnterior = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = 'segredo-teste';
  process.env.XINGU_MODELO = 'modelo-anthropic-teste';
  let chamada;
  globalThis.fetch = async (url, opcoes) => {
    chamada = { url, opcoes };
    return new Response(JSON.stringify({
      content: [{ type: 'text', text: '{"acao":"ok"}' }],
      usage: { input_tokens: 12, output_tokens: 7 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const ref = {};
    const saida = await new ProvedorAnthropic().completar('sistema', 'usuário', ref);
    const corpo = JSON.parse(chamada.opcoes.body);
    assert.equal(chamada.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(chamada.opcoes.headers['x-api-key'], 'segredo-teste');
    assert.equal(corpo.model, 'modelo-anthropic-teste');
    assert.deepEqual(corpo.messages, [{ role: 'user', content: 'usuário' }]);
    assert.equal(saida, '{"acao":"ok"}');
    assert.deepEqual(ref, { tokensEntrada: 12, tokensSaida: 7 });
  } finally {
    globalThis.fetch = fetchAnterior;
    restaurar();
  }
});

test('provedor OpenAI cumpre contrato HTTP e registra consumo por requisição', async () => {
  const restaurar = preservarAmbiente(['OPENAI_API_KEY', 'OPENAI_MODELO']);
  const fetchAnterior = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'segredo-openai-teste';
  process.env.OPENAI_MODELO = 'modelo-openai-teste';
  let chamada;
  globalThis.fetch = async (url, opcoes) => {
    chamada = { url, opcoes };
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"acao":"ok"}' } }],
      usage: { prompt_tokens: 9, completion_tokens: 4 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const ref = {};
    const saida = await new ProvedorOpenAI().completar('sistema', 'usuário', ref);
    const corpo = JSON.parse(chamada.opcoes.body);
    assert.equal(chamada.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(chamada.opcoes.headers.authorization, 'Bearer segredo-openai-teste');
    assert.equal(corpo.model, 'modelo-openai-teste');
    assert.deepEqual(corpo.messages, [
      { role: 'system', content: 'sistema' },
      { role: 'user', content: 'usuário' },
    ]);
    assert.equal(saida, '{"acao":"ok"}');
    assert.deepEqual(ref, { tokensEntrada: 9, tokensSaida: 4 });
  } finally {
    globalThis.fetch = fetchAnterior;
    restaurar();
  }
});

test('cascata tenta o próximo provedor e identifica quem respondeu sem perder telemetria', async () => {
  const chamadas = [];
  const primeiro = {
    nome: () => 'primeiro', disponivel: () => true,
    completar: async () => { chamadas.push('primeiro'); throw new Error('HTTP 503'); },
  };
  const segundo = {
    nome: () => 'segundo', disponivel: () => true,
    completar: async (_s, _u, ref) => {
      chamadas.push('segundo');
      ref.tokensEntrada = 3;
      ref.tokensSaida = 2;
      return 'resposta';
    },
  };
  const ref = {};
  const provedor = new ProvedorEmCascata([primeiro, segundo]);
  assert.equal(await provedor.completar('s', 'u', ref), 'resposta');
  assert.deepEqual(chamadas, ['primeiro', 'segundo']);
  assert.deepEqual(ref, { provedor: 'segundo', tokensEntrada: 3, tokensSaida: 2 });
});

test('cascata falha fechado quando nenhum provedor consegue responder', async () => {
  const falho = (nome) => ({
    nome: () => nome,
    disponivel: () => true,
    completar: async () => { throw new Error(`${nome}-fora`); },
  });
  const provedor = new ProvedorEmCascata([falho('a'), falho('b')]);
  await assert.rejects(() => provedor.completar('s', 'u', {}), /b-fora/);
});
