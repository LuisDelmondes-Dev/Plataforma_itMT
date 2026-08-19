import { Injectable } from '@nestjs/common';
import { AgentExecutionService } from '../auth/agent-execution.service';
import { ContratoAgente, validarContrato, validarPayload } from './agent-contract';

export interface TarefaAgente<TEntrada, TSaida> {
  input: TEntrada;
  ferramenta: string;
  permissao: string;
  idempotencyKey?: string;
  handler: (signal: AbortSignal, tentativa: number) => Promise<TSaida>;
  fallback?: () => Promise<TSaida>;
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(sanitizar);
  if (!valor || typeof valor !== 'object') return valor;
  return Object.fromEntries(Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [
    chave,
    /(token|senha|secret|chave|authorization)/i.test(chave) ? '[REDACTED]' : sanitizar(item),
  ]));
}

@Injectable()
export class AgentExecutorService {
  constructor(private readonly registry: AgentExecutionService) {}

  async executar<TEntrada, TSaida>(
    contrato: ContratoAgente,
    tarefa: TarefaAgente<TEntrada, TSaida>,
  ): Promise<TSaida> {
    validarContrato(contrato);
    validarPayload('input', tarefa.input, contrato.input);
    if (!contrato.ferramentas.includes(tarefa.ferramenta))
      throw new Error(`Ferramenta não permitida pelo contrato: ${tarefa.ferramenta}.`);
    if (!contrato.permissoes.includes(tarefa.permissao))
      throw new Error(`Permissão não permitida pelo contrato: ${tarefa.permissao}.`);

    const maxTentativas = tarefa.idempotencyKey ? contrato.retry.maxAttempts : 1;
    let ultimoErro: Error = new Error('Execução não iniciada.');
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      const inicio = Date.now();
      const controlador = new AbortController();
      const timer = setTimeout(
        () => controlador.abort(new Error(`Timeout do agente após ${contrato.timeoutMs}ms.`)),
        contrato.timeoutMs,
      );
      try {
        const saida = await Promise.race([
          tarefa.handler(controlador.signal, tentativa),
          new Promise<never>((_resolve, reject) => {
            controlador.signal.addEventListener('abort', () => reject(controlador.signal.reason), { once: true });
          }),
        ]);
        validarPayload('output', saida, contrato.output);
        await this.registry.registrar({
          agente: `${contrato.id}@${contrato.versao}`,
          entrada: sanitizar(tarefa.input),
          saida: sanitizar(saida),
          duracaoMs: Date.now() - inicio,
          ok: true,
        });
        return saida;
      } catch (erro) {
        ultimoErro = erro instanceof Error ? erro : new Error(String(erro));
        await this.registry.registrar({
          agente: `${contrato.id}@${contrato.versao}`,
          entrada: sanitizar(tarefa.input),
          saida: { erro: ultimoErro.message, tentativa },
          duracaoMs: Date.now() - inicio,
          ok: false,
        });
        if (tentativa < maxTentativas && contrato.retry.backoffMs > 0)
          await esperar(contrato.retry.backoffMs * tentativa);
      } finally {
        clearTimeout(timer);
      }
    }

    if (tarefa.fallback && contrato.fallback) {
      const inicio = Date.now();
      try {
        const saida = await tarefa.fallback();
        validarPayload('output', saida, contrato.output);
        await this.registry.registrar({
          agente: `${contrato.fallback}@${contrato.versao}`,
          entrada: sanitizar(tarefa.input), saida: sanitizar(saida),
          duracaoMs: Date.now() - inicio, ok: true,
        });
        return saida;
      } catch (erro) {
        const falha = erro instanceof Error ? erro : new Error(String(erro));
        await this.registry.registrar({
          agente: `${contrato.fallback}@${contrato.versao}`,
          entrada: sanitizar(tarefa.input), saida: { erro: falha.message },
          duracaoMs: Date.now() - inicio, ok: false,
        });
        throw falha;
      }
    }
    throw ultimoErro;
  }
}
