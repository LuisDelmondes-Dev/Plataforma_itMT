export interface SchemaContratoAgente {
  required: string[];
  maxBytes: number;
}

export interface ContratoAgente {
  id: string;
  versao: string;
  proposito: string;
  input: SchemaContratoAgente;
  output: SchemaContratoAgente;
  ferramentas: string[];
  permissoes: string[];
  timeoutMs: number;
  retry: { maxAttempts: number; backoffMs: number };
  fallback?: string;
  avaliacao: string[];
}

export function validarContrato(contrato: ContratoAgente): void {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(contrato.id)) throw new Error('Contrato de agente: id inválido.');
  if (!/^\d+\.\d+\.\d+$/.test(contrato.versao)) throw new Error('Contrato de agente: versão semver inválida.');
  if (!contrato.proposito.trim()) throw new Error('Contrato de agente: propósito obrigatório.');
  if (!Number.isInteger(contrato.timeoutMs) || contrato.timeoutMs < 10 || contrato.timeoutMs > 300_000)
    throw new Error('Contrato de agente: timeout fora do intervalo permitido.');
  if (!Number.isInteger(contrato.retry.maxAttempts) || contrato.retry.maxAttempts < 1 || contrato.retry.maxAttempts > 5)
    throw new Error('Contrato de agente: maxAttempts deve estar entre 1 e 5.');
}

export function validarPayload(
  tipo: 'input' | 'output',
  payload: unknown,
  schema: SchemaContratoAgente,
): void {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    throw new Error(`${tipo}: objeto estruturado obrigatório.`);
  const objeto = payload as Record<string, unknown>;
  const ausente = schema.required.find((campo) => !(campo in objeto));
  if (ausente) throw new Error(`${tipo}: campo obrigatório ausente: ${ausente}.`);
  const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  if (bytes > schema.maxBytes) throw new Error(`${tipo}: excede limite de ${schema.maxBytes} bytes.`);
}
