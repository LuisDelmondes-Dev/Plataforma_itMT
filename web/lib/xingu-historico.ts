// Histórico local de conversas da Xingú (Onda B). Vive SÓ no navegador do
// usuário (localStorage) — nada disso toca a API nem o service worker
// (EV-049 preservada). Toda leitura/escrita em try/catch: sem storage
// (modo privado), a página degrada para o comportamento antigo (memória).

export interface ConversaXingu<M = unknown, C = unknown> {
  id: string;
  titulo: string;
  criadaEm: string;
  atualizadaEm: string;
  mensagens: M[];
  contexto?: C;
}

interface Cofre<M, C> {
  versao: 1;
  ativa: string | null;
  conversas: ConversaXingu<M, C>[];
}

const CHAVE = 'itmt.xingu.historico:v1';
const LIMITE_CONVERSAS = 20;
const LIMITE_MENSAGENS = 200;

function ler<M, C>(): Cofre<M, C> {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return { versao: 1, ativa: null, conversas: [] };
    const d = JSON.parse(bruto);
    if (d?.versao !== 1 || !Array.isArray(d.conversas)) throw new Error('versão desconhecida');
    return d as Cofre<M, C>;
  } catch {
    return { versao: 1, ativa: null, conversas: [] };
  }
}

function gravar<M, C>(cofre: Cofre<M, C>): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(cofre));
  } catch {
    /* storage cheio/indisponível: segue sem persistir */
  }
}

export function listarConversas<M, C>(): ConversaXingu<M, C>[] {
  return ler<M, C>().conversas;
}

export function conversaAtiva<M, C>(): ConversaXingu<M, C> | null {
  const cofre = ler<M, C>();
  return cofre.conversas.find((c) => c.id === cofre.ativa) ?? null;
}

export function ativarConversa<M, C>(id: string): ConversaXingu<M, C> | null {
  const cofre = ler<M, C>();
  const alvo = cofre.conversas.find((c) => c.id === id) ?? null;
  if (alvo) {
    cofre.ativa = id;
    gravar(cofre);
  }
  return alvo;
}

export function salvarConversaAtiva<M, C>(mensagens: M[], contexto: C | undefined, titulo?: string): void {
  if (!mensagens.length) return;
  const cofre = ler<M, C>();
  const agora = new Date().toISOString();
  let c = cofre.conversas.find((x) => x.id === cofre.ativa);
  if (!c) {
    c = {
      id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      titulo: titulo ?? 'Conversa',
      criadaEm: agora,
      atualizadaEm: agora,
      mensagens: [],
    };
    cofre.conversas.unshift(c);
    cofre.ativa = c.id;
  }
  c.mensagens = mensagens.slice(-LIMITE_MENSAGENS);
  c.contexto = contexto;
  c.atualizadaEm = agora;
  if (titulo && (c.titulo === 'Conversa' || !c.titulo)) c.titulo = titulo;
  cofre.conversas = cofre.conversas.slice(0, LIMITE_CONVERSAS);
  gravar(cofre);
}

/** Começa uma conversa nova (a atual permanece no histórico). */
export function novaConversa(): void {
  const cofre = ler();
  cofre.ativa = null;
  gravar(cofre);
}

export function excluirConversa(id: string): void {
  const cofre = ler();
  cofre.conversas = cofre.conversas.filter((c) => c.id !== id);
  if (cofre.ativa === id) cofre.ativa = null;
  gravar(cofre);
}
