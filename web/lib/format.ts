// Formatação pt-BR única do portal. Regra da casa (RN-005): valor
// null/undefined NUNCA vira "0" — vira "—". Zero verdadeiro é um dado;
// ausência é outra coisa, e a interface preserva a diferença.

const numeroInteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const numeroDecimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const numeroPreciso = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 });
const percentual = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const dataCurta = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });
const dataLonga = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' });

export const SEM_VALOR = '—';

export function formatarNumero(valor: number | null | undefined, casas: 0 | 1 | 6 = 1): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return SEM_VALOR;
  const f = casas === 0 ? numeroInteiro : casas === 6 ? numeroPreciso : numeroDecimal;
  return f.format(valor);
}

export function formatarValorComUnidade(valor: number | null | undefined, unidade?: string): string {
  const n = formatarNumero(valor);
  return n === SEM_VALOR || !unidade ? n : `${n} ${unidade}`;
}

export function formatarPercentual(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return SEM_VALOR;
  return `${percentual.format(valor)}%`;
}

/** Aceita 'AAAA-MM-DD' ou ISO completo; inválida vira "—", nunca "Invalid Date". */
export function formatarData(iso: string | null | undefined, estilo: 'curta' | 'longa' = 'curta'): string {
  if (!iso) return SEM_VALOR;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return SEM_VALOR;
  return (estilo === 'curta' ? dataCurta : dataLonga).format(d);
}
