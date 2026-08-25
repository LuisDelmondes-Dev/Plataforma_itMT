// Sessões por token das áreas de operação. Onda A: preserva as 5 chaves
// históricas de sessionStorage (não invalida sessões existentes); a
// consolidação em chave única, com migração, é a Onda D (navegação).

export type AreaOperacao = 'campo' | 'fontes' | 'documentos' | 'integracoes' | 'organizacoes';

const CHAVES: Record<AreaOperacao, string> = {
  campo: 'itmt.campo.token',
  fontes: 'itmt.fontes.token',
  documentos: 'itmt.documentos.token:v1',
  integracoes: 'itmt.integracoes.token:v1',
  organizacoes: 'itmt.auth.identity',
};

export function obterToken(area: AreaOperacao): string {
  try {
    return sessionStorage.getItem(CHAVES[area]) ?? '';
  } catch {
    /* storage indisponível (ex.: modo privado): sessão só em memória */
    return '';
  }
}

export function salvarToken(area: AreaOperacao, token: string): void {
  try {
    if (token) sessionStorage.setItem(CHAVES[area], token);
    else sessionStorage.removeItem(CHAVES[area]);
  } catch {
    /* storage indisponível: opera sem persistir */
  }
}
