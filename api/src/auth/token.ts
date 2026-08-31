import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Token de sessão assinado (HMAC-SHA256), stateless: `payload_b64.assinatura_b64`.
 * Não é JWT completo de propósito — o guard só precisa de sub+papel+exp e de
 * verificar a assinatura sem ir ao banco. Segredo por env SESSION_SECRET
 * (fallback ADMIN_TOKEN em dev). A troca do segredo invalida todos os tokens.
 */
export type Papel = 'ADMIN' | 'CURADOR' | 'PUBLICO' | 'PARCEIRO' | 'UNIVERSIDADE';
export interface Sessao {
  sub: string;
  papel: Papel;
  exp: number;
  uid?: string;
  tid?: string;
  oid?: string;
  membershipVersion?: number;
}

export type ContextoSessao = Required<Pick<Sessao, 'uid' | 'tid' | 'oid' | 'membershipVersion'>>;

/**
 * Segredo do HMAC de sessão.
 *
 * O fallback literal ('itmt-sessao-dev') existia sem condição alguma, e o
 * fail-fast que deveria cobri-lo em main.ts só roda quando NODE_ENV é
 * EXATAMENTE 'production' — ou seja, o guarda era comandado pela mesma
 * variável que definia a exposição. Num ambiente publicado com NODE_ENV
 * ausente, herdado ou com typo ('prod'), a chave HMAC virava uma string
 * pública do repositório e qualquer um forjava `{"papel":"ADMIN"}`, furando
 * o RG-09 pelo /admin.
 *
 * A regra passa a ser ALLOWLIST, não denylist: o literal estável só vale em
 * 'development' e 'test' declarados. Qualquer outro caso — inclusive NODE_ENV
 * ausente — recebe um segredo ALEATÓRIO por processo. Nada quebra no uso local
 * (as sessões apenas não sobrevivem a um restart, o que em dev é aceitável) e
 * o token deixa de ser forjável em qualquer ambiente não declarado.
 */
let segredoEfemero: string | undefined;

function segredo(): string {
  const configurado = process.env.SESSION_SECRET ?? process.env.ADMIN_TOKEN;
  if (configurado) return configurado;

  const ambiente = process.env.NODE_ENV;
  if (ambiente === 'development' || ambiente === 'test') return 'itmt-sessao-dev';

  if (segredoEfemero === undefined) {
    segredoEfemero = randomBytes(32).toString('hex');
    console.warn(
      '[auth] SESSION_SECRET ausente e NODE_ENV não é development/test — ' +
        'usando segredo efêmero deste processo. As sessões não sobreviverão a um reinício. ' +
        'Defina SESSION_SECRET para operar de verdade.',
    );
  }
  return segredoEfemero;
}

const b64url = (b: Buffer) => b.toString('base64url');

export function emitirToken(
  sub: string,
  papel: Papel,
  ttlSegundos = 8 * 3600,
  contexto?: ContextoSessao,
): string {
  const payload: Sessao = {
    sub, papel, exp: Math.floor(Date.now() / 1000) + ttlSegundos,
    ...(contexto ?? {}),
  };
  const corpo = b64url(Buffer.from(JSON.stringify(payload)));
  const assinatura = b64url(createHmac('sha256', segredo()).update(corpo).digest());
  return `${corpo}.${assinatura}`;
}

/** Devolve a sessão se o token é bem-formado, assinado e não expirado; senão null. */
export function verificarToken(token: string): Sessao | null {
  const ponto = token.indexOf('.');
  if (ponto <= 0) return null;
  const corpo = token.slice(0, ponto);
  const assinatura = token.slice(ponto + 1);
  const esperada = b64url(createHmac('sha256', segredo()).update(corpo).digest());
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(corpo, 'base64url').toString()) as Sessao;
    if (!s || typeof s.exp !== 'number' || s.exp < Math.floor(Date.now() / 1000)) return null;
    if (!['ADMIN', 'CURADOR', 'PUBLICO', 'PARCEIRO', 'UNIVERSIDADE'].includes(s.papel)) return null;
    return s;
  } catch {
    return null;
  }
}
