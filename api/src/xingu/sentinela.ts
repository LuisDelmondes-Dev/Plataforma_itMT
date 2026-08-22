/**
 * A14 — Sentinela de Injeção (veto absoluto; RF-CHAT-011 / RG-04).
 * Conteúdo externo é DADO, jamais comando. A sentinela varre a entrada
 * por padrões de instrução dirigida ao modelo ou ao sistema.
 *
 * ── O QUE ESTA CAMADA É E O QUE NÃO É (EV-20260822-048) ──
 * Denylist por padrão é **incompleta por natureza**: um red-team de 23 ataques
 * em pt-BR passou 22 pela versão anterior. Esta versão fecha essas famílias,
 * mas quem escrever uma formulação nova continuará passando.
 *
 * A garantia real da Xingú é **arquitetural**, não este filtro:
 *   • a pergunta viaja envelopada como dado (`envelopar`);
 *   • a saída do A01 é um plano JSON validado contra schema **e** contra o
 *     catálogo real — o LLM não emite SQL nem inventa território/indicador;
 *   • o motor determinístico executa só esse plano, e só lê dado público;
 *   • o A05 é proibido de escrever numerais e o A06 veta qualquer numeral
 *     não autorizado (RG-03).
 * Logo, uma injeção que passe daqui não consegue executar SQL nem forjar
 * número. O risco residual que ela ainda tem é de **texto** (extração de
 * prompt ou narrativa imprópria), que o A06 não cobre por só olhar numerais.
 * Esta camada é defesa em profundidade; não é a única, nem a última.
 */

/** Minúsculas + sem acento: derrota "Ignore" e "instrucoes" sem acentuação. */
function normalizar(texto: string): string {
  return texto.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Só letras e dígitos: derrota ofuscação por espaços/pontuação ("i g n o r e"). */
function compactar(texto: string): string {
  return normalizar(texto).replace(/[^a-z0-9]/g, '');
}

/** Padrões avaliados sobre o texto normalizado (com espaços preservados). */
const PADROES: RegExp[] = [
  // Sobrescrever instruções — verbo e alvo podem estar separados por até ~25 chars
  /\b(ignor|desconsider|desprez|esquec|esquer|apagu|anul|revogu)\w*\b[\s\S]{0,25}\b(instruc|regra|diretriz|orientac|comando|prompt|anterior)/i,
  /\bdeixe\s+de\s+lado\b[\s\S]{0,25}\b(instruc|regra|diretriz|orientac)/i,
  // "desconsidere tudo o que foi dito acima" — anula o contexto sem nomeá-lo
  /\b(ignor|desconsider|desprez|esquec|apagu|anul)\w*\b[\s\S]{0,30}\b(acima|anteriormente|dito\s+antes|ja\s+dito)\b/i,
  /\bignore\s+previous\b|\bdisregard\s+(the\s+)?(above|previous)\b/i,
  // Redefinição de papel / desligar salvaguardas
  /\b(a\s+partir\s+de\s+)?agora\s+voce\s+(e|sera|vai\s+ser)\b/i,
  /\bassuma\s+(o\s+)?papel\b/i,
  /\bfinja\s+(ser|que)\b/i,
  /\baja\s+como\s+se\b/i,
  /\bmodo\s+(desenvolvedor|dev|debug|irrestrito|livre)\b/i,
  /\b(desabilit|desativ|remov|suspend)\w*\b[\s\S]{0,25}\b(validac|restric|filtro|regra|salvaguard|limite)/i,
  /\bsem\s+(nenhuma\s+)?(restric|filtro|limite|censura|regra)/i,
  /\bnao\s+(ha|houvesse|existem?)\s+(nenhuma\s+)?(regra|restric|limite)/i,
  /\bdan\s+mode\b/i,
  /\bjailbreak\b/i,
  // Extração de prompt/configuração
  /\b(system|sistema)\s*prompt\b/i,
  /\bseu\s+prompt\b/i,
  /\b(revele?|mostre|exiba|imprima|repita|liste|traduza|divulgue)\b[\s\S]{0,30}\b(prompt|instruc|configurac|orientac|diretriz|regras\s+internas)/i,
  /\b(qual|quais)\b[\s\S]{0,30}\bsuas?\b[\s\S]{0,20}\b(regras?\s+internas?|instruc|diretriz|configurac)/i,
  /\brepita\b[\s\S]{0,30}\b(texto|mensagem|conteudo)\b[\s\S]{0,20}\bacima\b/i,
  // Injeção estrutural
  /<\s*(script|system|instructions?)\b/i,
  // Comando ao sistema / SQL — verbo DDL/DML com alvo
  /\bexecute\s+(o\s+)?(sql|comando|codigo)\b/i,
  /\b(drop|truncate|alter|grant|revoke|create)\s+(table|database|schema|column|role|user|all|on|index)\b/i,
  /\b(delete|insert|update)\s+(from|into|table)\b/i,
];

/**
 * Padrões avaliados sobre a forma COMPACTA (sem espaços/pontuação). Cobrem
 * ofuscação por separação de caracteres. Precisam ser específicos o bastante
 * para não colidir com texto legítimo colado.
 */
const PADROES_COMPACTOS: RegExp[] = [
  /(ignor|desconsider|esquec|apagu|anul|desprez)[a-z]{0,20}(instruc|regra|diretriz|orientac|prompt|anterior)/,
  /(systemprompt|seuprompt|jailbreak|danmode)/,
  /(modo)(desenvolvedor|debug|irrestrito|livre)/,
  /(drop|truncate|alter)(table|database|schema)/,
];

export function detectarInjecao(texto: string): string | null {
  const normalizado = normalizar(texto);
  for (const p of PADROES) if (p.test(normalizado)) return p.source;
  const compacto = compactar(texto);
  for (const p of PADROES_COMPACTOS) if (p.test(compacto)) return p.source;
  return null;
}

/** Envelope explícito (RG-04): a pergunta viaja como dado rotulado. */
export function envelopar(pergunta: string): string {
  const limpa = pergunta.replace(/<\/?pergunta_do_usuario>/gi, '');
  return `<pergunta_do_usuario>\n${limpa}\n</pergunta_do_usuario>`;
}
