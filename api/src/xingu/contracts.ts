import { ContratoAgente } from './agent-contract';

export const CONTRATO_A01_INTERPRETE: ContratoAgente = Object.freeze({
  id: 'xingu-a01-interprete',
  versao: '1.0.0',
  proposito: 'Converter pergunta territorial em plano ou clarificação, sem produzir números.',
  input: { required: ['pergunta'], maxBytes: 4_096 },
  output: { required: ['tipo', 'interprete'], maxBytes: 16_384 },
  ferramentas: ['catalogo:ler'],
  permissoes: ['dados-publicos:ler'],
  timeoutMs: 35_000,
  retry: { maxAttempts: 1, backoffMs: 0 },
  fallback: 'xingu-interprete-lexico',
  avaliacao: ['schema', 'territorio-existente', 'indicador-existente', 'sem-numeros-inventados'],
});


export const CONTRATO_A04_EXECUTOR: ContratoAgente = Object.freeze({
  id: 'xingu-a04-executor', versao: '1.0.0',
  proposito: 'Executar um plano validado exclusivamente no motor determinístico.',
  input: { required: ['plano'], maxBytes: 16_384 },
  output: { required: ['valor', 'unidade', 'procedencia'], maxBytes: 131_072 },
  ferramentas: ['motor-indicadores:consultar'], permissoes: ['dados-publicos:ler'],
  timeoutMs: 10_000, retry: { maxAttempts: 2, backoffMs: 50 },
  avaliacao: ['schema', 'procedencia', 'ausencia-explicita', 'sem-estimativa'],
});

export const CONTRATO_A05_NARRADOR: ContratoAgente = Object.freeze({
  id: 'xingu-a05-narrador', versao: '1.0.0',
  proposito: 'Narrar somente valores fornecidos pelo motor, com fallback determinístico.',
  input: { required: ['pergunta', 'resultado'], maxBytes: 131_072 },
  output: { required: ['narrativa'], maxBytes: 32_768 },
  ferramentas: ['llm:narrar'], permissoes: ['dados-publicos:ler'],
  timeoutMs: 20_000, retry: { maxAttempts: 1, backoffMs: 0 }, fallback: 'xingu-narrador-deterministico',
  avaliacao: ['schema', 'numerais-lastreados', 'fallback-deterministico'],
});

export const CONTRATO_A06_AUDITOR: ContratoAgente = Object.freeze({
  id: 'xingu-a06-auditor', versao: '1.0.0',
  proposito: 'Vet ar qualquer numeral não lastreado no resultado determinístico.',
  input: { required: ['narrativa', 'resultado'], maxBytes: 131_072 },
  output: { required: ['aprovado', 'numerais', 'intrusos'], maxBytes: 32_768 },
  ferramentas: ['numerais:auditar'], permissoes: ['resposta:vetar'],
  timeoutMs: 2_000, retry: { maxAttempts: 1, backoffMs: 0 },
  avaliacao: ['zero-numeral-intruso', 'fail-closed'],
});

/**
 * A16 — Agente de Sugestões (Gauntlet P7). Dossiê, não decisão (RG-09):
 * entrada = SOMENTE o JSON do motor + catálogo curado "PraticaGestao"
 * (db/51); saída = sugestões por template determinístico, cada uma com
 * prática reconhecida citada e origem por FK no dado que a motivou. SEM LLM
 * nesta versão (RG-05: a conta está sem créditos e o caminho determinístico
 * é o primário) — re-redação por LLM é enriquecimento futuro que, quando
 * existir, será auditado pelo A06 e exigirá 'A16' no CHECK de
 * "ConsumoLlm_Borda". Sem retry (função pura: reexecutar não muda nada) e
 * timeout curto (não há I/O além do catálogo em cache).
 */
export const CONTRATO_A16_SUGESTOES: ContratoAgente = Object.freeze({
  id: 'a16-sugestoes', versao: '1.0.0',
  proposito: 'Montar dossiê de sugestões determinístico: prática reconhecida + FK do dado do motor; subsídio, nunca decisão.',
  input: { required: ['dossie', 'indicador', 'recorte'], maxBytes: 524_288 },
  output: { required: ['sugestoes', 'descartadas'], maxBytes: 65_536 },
  ferramentas: ['catalogo-praticas:ler'], permissoes: ['dados-publicos:ler'],
  timeoutMs: 3_000, retry: { maxAttempts: 1, backoffMs: 0 },
  avaliacao: ['schema', 'numerais-lastreados', 'origem-por-fk', 'deterministico', 'sem-llm'],
});
