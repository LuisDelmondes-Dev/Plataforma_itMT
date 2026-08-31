// Cliente da API do motor determinístico.
// No servidor (SSR) fala direto com a API; no browser, via rewrite /api.
//
// Erros são TIPADOS para que a interface possa distinguir "a fonte está
// fora do ar" de "este dado não existe" — a distinção que a doutrina
// RN-005 ("ausência é resposta") exige e que um catch genérico apaga.

const base = () =>
  typeof window === 'undefined'
    ? (process.env.API_URL ?? 'http://localhost:3001')
    : '/api';

export type TipoErroApi = 'rede' | 'servidor' | 'nao-encontrado' | 'cliente';

export class ErroApi extends Error {
  readonly tipo: TipoErroApi;
  readonly status?: number;
  constructor(tipo: TipoErroApi, mensagem: string, status?: number) {
    super(mensagem);
    this.name = 'ErroApi';
    this.tipo = tipo;
    this.status = status;
  }
  /** Frase para o cidadão — nunca o texto técnico cru. */
  get mensagemHumana(): string {
    switch (this.tipo) {
      case 'rede':
        return 'Não conseguimos falar com a fonte de dados. Verifique sua conexão e tente de novo.';
      case 'servidor':
        return 'A fonte de dados está indisponível neste momento. Tente novamente em instantes.';
      case 'nao-encontrado':
        return 'Não há registro para esta consulta — ausência aqui é resposta, não erro.';
      default:
        return this.message || 'A consulta não pôde ser feita.';
    }
  }
}

async function paraErro(r: Response): Promise<ErroApi> {
  const corpo = await r.json().catch(() => null);
  const msg = corpo?.message ?? `Falha na consulta (${r.status}).`;
  if (r.status === 404) return new ErroApi('nao-encontrado', msg, 404);
  if (r.status >= 500) return new ErroApi('servidor', msg, r.status);
  return new ErroApi('cliente', Array.isArray(msg) ? msg.join(' ') : String(msg), r.status);
}

interface OpcoesGet {
  /** Segundos de cache do Next para dados que mudam devagar (municípios,
      taxonomia). Ausente ⇒ `no-store` — valores de indicador NUNCA são
      cacheados. */
  revalidate?: number;
  timeoutMs?: number;
}

export async function apiGet<T>(path: string, opcoes: OpcoesGet = {}): Promise<T> {
  const { revalidate, timeoutMs = 10_000 } = opcoes;
  const init: RequestInit & { next?: { revalidate: number } } =
    revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' };

  const tentar = async (): Promise<Response> => {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), timeoutMs);
    try {
      return await fetch(`${base()}/v1${path}`, { ...init, signal: controle.signal });
    } catch (e) {
      throw new ErroApi('rede', e instanceof Error ? e.message : 'Falha de rede.');
    } finally {
      clearTimeout(timer);
    }
  };

  let r: Response;
  try {
    r = await tentar();
  } catch (e) {
    // 1 nova tentativa apenas para falha de REDE em GET (idempotente).
    if (e instanceof ErroApi && e.tipo === 'rede') r = await tentar();
    else throw e;
  }
  if (!r.ok) throw await paraErro(r);
  return r.json();
}

export async function apiPost<T>(
  path: string,
  corpo: unknown,
  opcoes: { token?: string; timeoutMs?: number } = {},
): Promise<T> {
  const { token, timeoutMs = 20_000 } = opcoes;
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), timeoutMs);
  let r: Response;
  try {
    r = await fetch(`${base()}/v1${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(corpo),
      signal: controle.signal,
    });
  } catch (e) {
    throw new ErroApi('rede', e instanceof Error ? e.message : 'Falha de rede.');
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) throw await paraErro(r);
  return r.json();
}

/** E3: fase de homologação do dado na fonte; ausente = desconhecido (nunca chutado). */
export type StatusDado = 'PRELIMINAR' | 'CONSOLIDADO' | 'REVISADO';

export interface Procedencia {
  fonte: string;
  url: string | null;
  data_referencia: string;
  data_extracao: string;
  licenca: string;
  hash: string;
  status_dado?: StatusDado;
}

export interface Resultado {
  valor: number;
  unidade: string;
  indicador: string;
  recorte: string;
  local: string;
  agregacao: string;
  municipios_agregados?: number;
  /** E3: o pior status das parcelas (PRELIMINAR contamina); ausente = não afirmável. */
  status_dado?: StatusDado;
  procedencia: Procedencia[];
}
