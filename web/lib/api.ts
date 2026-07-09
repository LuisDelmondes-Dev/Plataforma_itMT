// Cliente da API do motor determinístico.
// No servidor (SSR) fala direto com a API; no browser, via rewrite /api.
const base = () =>
  typeof window === 'undefined'
    ? (process.env.API_URL ?? 'http://localhost:3001')
    : '/api';

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${base()}/v1${path}`, { cache: 'no-store' });
  if (!r.ok) {
    const corpo = await r.json().catch(() => null);
    throw new Error(corpo?.message ?? `Falha na consulta (${r.status}).`);
  }
  return r.json();
}

export interface Procedencia {
  fonte: string;
  url: string | null;
  data_referencia: string;
  data_extracao: string;
  licenca: string;
  hash: string;
}

export interface Resultado {
  valor: number;
  unidade: string;
  indicador: string;
  recorte: string;
  local: string;
  agregacao: string;
  municipios_agregados?: number;
  procedencia: Procedencia[];
}
