import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentExecutorService } from '../dist/xingu/agent-executor.service.js';

const contrato = {
  id: 'teste', versao: '1.0.0', proposito: 'validar execução contratual',
  input: { required: ['pergunta'], maxBytes: 1024 },
  output: { required: ['resposta'], maxBytes: 1024 },
  ferramentas: ['catalogo:ler'], permissoes: ['dados-publicos:ler'],
  timeoutMs: 50, retry: { maxAttempts: 2, backoffMs: 0 },
  fallback: 'fallback-teste', avaliacao: ['schema', 'fontes'],
};

function executorComRegistros() {
  const registros = [];
  return {
    registros,
    executor: new AgentExecutorService({ registrar: async (registro) => registros.push(registro) }),
  };
}

test('executor aceita somente input/output válidos e registra a execução', async () => {
  const { executor, registros } = executorComRegistros();
  const resultado = await executor.executar(contrato, {
    input: { pergunta: 'qual indicador?' },
    ferramenta: 'catalogo:ler', permissao: 'dados-publicos:ler',
    handler: async () => ({ resposta: 'população', fontes: ['IBGE'] }),
  });
  assert.equal(resultado.resposta, 'população');
  assert.equal(registros.length, 1);
  assert.equal(registros[0].agente, 'teste@1.0.0');
  assert.equal(registros[0].ok, true);
});

test('executor nega ferramenta, permissão e schema de entrada fora do contrato', async () => {
  const { executor, registros } = executorComRegistros();
  await assert.rejects(() => executor.executar(contrato, {
    input: {}, ferramenta: 'sql:executar', permissao: 'admin', handler: async () => ({}),
  }), /input.*pergunta/i);
  await assert.rejects(() => executor.executar(contrato, {
    input: { pergunta: 'x' }, ferramenta: 'sql:executar',
    permissao: 'dados-publicos:ler', handler: async () => ({}),
  }), /ferramenta.*não permitida/i);
  assert.equal(registros.length, 0);
});

test('executor aplica timeout, retry idempotente, fallback e registra cada falha', async () => {
  const { executor, registros } = executorComRegistros();
  let tentativas = 0;
  const resultado = await executor.executar(contrato, {
    input: { pergunta: 'x' }, ferramenta: 'catalogo:ler', permissao: 'dados-publicos:ler',
    idempotencyKey: 'req-1',
    handler: async (sinal) => {
      tentativas++;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 200);
        sinal.addEventListener('abort', () => { clearTimeout(timer); reject(sinal.reason); }, { once: true });
      });
      return { resposta: 'tardia' };
    },
    fallback: async () => ({ resposta: 'determinística' }),
  });
  assert.equal(resultado.resposta, 'determinística');
  assert.equal(tentativas, 2);
  assert.equal(registros.filter((r) => !r.ok).length, 2);
  assert.equal(registros.at(-1).agente, 'fallback-teste@1.0.0');
  assert.equal(registros.at(-1).ok, true);
});

test('executor rejeita output inválido e não publica resposta parcial', async () => {
  const { executor, registros } = executorComRegistros();
  await assert.rejects(() => executor.executar(contrato, {
    input: { pergunta: 'x' }, ferramenta: 'catalogo:ler', permissao: 'dados-publicos:ler',
    handler: async () => ({ valor_sem_contrato: 42 }),
  }), /output.*resposta/i);
  assert.equal(registros.every((r) => r.ok === false), true);
});
