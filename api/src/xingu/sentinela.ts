/**
 * A14 — Sentinela de Injeção (veto absoluto; RF-CHAT-011 / RG-04).
 * Conteúdo externo é DADO, jamais comando. A sentinela varre a entrada
 * por padrões de instrução dirigida ao modelo ou ao sistema.
 */
const PADROES: RegExp[] = [
  /ignor\w+\s+(as\s+)?(instru|regras|anterior)/i,
  /desconsider\w+\s+(as\s+)?(instru|regras)/i,
  /\b(system|sistema)\s*prompt\b/i,
  /\bseu\s+prompt\b/i,
  /\brevele?\s+(o\s+)?(prompt|instru)/i,
  /\bfinja\s+(ser|que)\b/i,
  /\baja\s+como\s+se\b/i,
  /\bdan\s+mode\b/i,
  /\bjailbreak\b/i,
  /<\s*(script|system|instructions?)\b/i,
  /\bexecute\s+(o\s+)?(sql|comando|código)\b/i,
  /\b(drop|delete|update|insert)\s+(table|into|from)\b/i,
];

export function detectarInjecao(texto: string): string | null {
  for (const p of PADROES) if (p.test(texto)) return p.source;
  return null;
}

/** Envelope explícito (RG-04): a pergunta viaja como dado rotulado. */
export function envelopar(pergunta: string): string {
  const limpa = pergunta.replace(/<\/?pergunta_do_usuario>/gi, '');
  return `<pergunta_do_usuario>\n${limpa}\n</pergunta_do_usuario>`;
}
