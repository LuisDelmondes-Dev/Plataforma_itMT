import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token de sessão assinado (HMAC-SHA256), stateless: `payload_b64.assinatura_b64`.
 * Não é JWT completo de propósito — o guard só precisa de sub+papel+exp e de
 * verificar a assinatura sem ir ao banco. Segredo por env SESSION_SECRET
 * (fallback ADMIN_TOKEN em dev). A troca do segredo invalida todos os tokens.
 */
export type Papel = 'ADMIN' | 'CURADOR' | 'PUBLICO' | 'PARCEIRO' | 'UNIVERSIDADE';
export interface Sessao { sub: string; papel: Papel; exp: number }

function segredo(): string {
  return process.env.SESSION_SECRET ?? process.env.ADMIN_TOKEN ?? 'itmt-sessao-dev';
}

const b64url = (b: Buffer) => b.toString('base64url');

export function emitirToken(sub: string, papel: Papel, ttlSegundos = 8 * 3600): string {
  const payload: Sessao = { sub, papel, exp: Math.floor(Date.now() / 1000) + ttlSegundos };
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
