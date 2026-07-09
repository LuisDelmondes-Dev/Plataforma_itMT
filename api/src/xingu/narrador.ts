import { ValorComProcedencia } from '../common/procedencia';
import { ProvedorLlm } from './interprete.service';

/**
 * A05 — Narrador (borda de saída, RG-02/RG-03).
 * A narrativa recebe os números como SLOTS preenchidos pelo motor
 * determinístico. O LLM, quando usado, escreve o texto com
 * placeholders {{V1}}, {{ANO}}, {{N}} — e é PROIBIDO de escrever
 * numerais. A substituição é determinística; a auditoria (A06) é
 * feita depois, sempre.
 */
const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export interface Slots {
  V1: string;   // valor formatado pt-BR
  ANO: string;  // ano da referência
  N?: string;   // municípios agregados
}

export function slotsDe(r: ValorComProcedencia): Slots {
  return {
    V1: fmt.format(r.valor),
    ANO: r.procedencia[0]?.data_referencia.slice(0, 4) ?? '',
    N: r.municipios_agregados ? String(r.municipios_agregados) : undefined,
  };
}

/** Template determinístico — o caminho sem LLM e o fallback pós-veto. */
export function narrativaDeterministica(r: ValorComProcedencia): string {
  const s = slotsDe(r);
  const base =
    r.recorte === 'MUNICIPIO'
      ? `Em ${r.local}, ${r.indicador} registrava {{V1}} ${r.unidade} (ref. {{ANO}}).`
      : `${r.local}: ${r.indicador} totaliza {{V1}} ${r.unidade} — agregação ${r.agregacao} ` +
        `sobre {{N}} município(s) (ref. {{ANO}}).`;
  return preencherSlots(base, s);
}

export function preencherSlots(texto: string, s: Slots): string {
  return texto
    .replace(/\{\{V1\}\}/g, s.V1)
    .replace(/\{\{ANO\}\}/g, s.ANO)
    .replace(/\{\{N\}\}/g, s.N ?? '');
}

/** Narrativa via LLM: o modelo escreve APENAS os placeholders, nunca números. */
export async function narrarComLlm(
  provedor: ProvedorLlm,
  r: ValorComProcedencia,
  pergunta: string,
): Promise<string> {
  const sistema = [
    'Você redige UMA frase curta em português brasileiro respondendo à pergunta do usuário,',
    'usando os placeholders {{V1}} (valor), {{ANO}} (ano de referência) e, se houver agregação, {{N}} (nº de municípios).',
    'PROIBIDO escrever qualquer numeral: use exclusivamente os placeholders.',
    'Não invente dados. Não use markdown. Uma frase, no máximo duas.',
    `Contexto do resultado: indicador "${r.indicador}" (${r.unidade}), local "${r.local}", agregação ${r.agregacao}.`,
  ].join('\n');
  const texto = await provedor.completar(sistema, pergunta);
  return preencherSlots(texto.trim(), slotsDe(r));
}

// ============================================================
// A06 — Auditor de Números (VETO ABSOLUTO; RG-03 / KR3.2)
// Todo numeral do texto final é comparado contra o conjunto de
// valores autorizados pelo motor. Divergência ⇒ bloqueio.
// ============================================================

/** Constrói o conjunto de números autorizados a aparecer no texto. */
export function numerosAutorizados(r: ValorComProcedencia): Set<number> {
  const s = new Set<number>();
  s.add(Number(r.valor));
  s.add(Number(r.valor.toFixed(0)));
  s.add(Number(r.valor.toFixed(1)));
  s.add(Number(r.valor.toFixed(2)));
  if (r.municipios_agregados) s.add(r.municipios_agregados);
  for (const p of r.procedencia) {
    const ano = Number(p.data_referencia.slice(0, 4));
    if (ano) s.add(ano);
    const dia = Number(p.data_referencia.slice(8, 10));
    const mes = Number(p.data_referencia.slice(5, 7));
    if (dia) s.add(dia);
    if (mes) s.add(mes);
  }
  return s;
}

/** Extrai numerais do texto pt-BR e normaliza (1.234,56 → 1234.56). */
export function extrairNumerais(texto: string): number[] {
  const brutos = texto.match(/\d[\d.,]*/g) ?? [];
  return brutos.map((b) => {
    const semSufixo = b.replace(/[.,]+$/, '');
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(semSufixo)) {
      return Number(semSufixo.replace(/\./g, '').replace(',', '.'));
    }
    if (/^\d+,\d+$/.test(semSufixo)) return Number(semSufixo.replace(',', '.'));
    return Number(semSufixo.replace(',', ''));
  });
}

export interface Auditoria {
  aprovado: boolean;
  numerais: number[];
  intrusos: number[];
}

export function auditarNumeros(texto: string, r: ValorComProcedencia): Auditoria {
  const autorizados = numerosAutorizados(r);
  const numerais = extrairNumerais(texto);
  const intrusos = numerais.filter(
    (n) => ![...autorizados].some((a) => Math.abs(a - n) < 1e-9),
  );
  return { aprovado: intrusos.length === 0, numerais, intrusos };
}
