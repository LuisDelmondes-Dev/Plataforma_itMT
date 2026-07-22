import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash, timingSafeEqual } from 'node:crypto';
import { verificarToken, Papel } from './token';

/**
 * RBAC por rota: @Papeis('PARCEIRO','CURADOR') + PapeisGuard.
 * O ADMIN_TOKEN estático (dev/CI) equivale a ADMIN — mantém a
 * retrocompatibilidade do AdminGuard. Token de sessão vale pelo papel
 * embutido (assinado); papel fora da lista da rota ⇒ 403.
 */
export const PAPEIS_CHAVE = 'papeis_permitidos';
export const Papeis = (...papeis: Papel[]) => SetMetadata(PAPEIS_CHAVE, papeis);

@Injectable()
export class PapeisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const permitidos =
      this.reflector.getAllAndOverride<Papel[]>(PAPEIS_CHAVE, [ctx.getHandler(), ctx.getClass()]) ?? [];
    const req = ctx.switchToHttp().getRequest();
    const auth: string = req.headers['authorization'] ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    // ADMIN_TOKEN estático conta como ADMIN (tempo constante).
    const esperado = process.env.ADMIN_TOKEN ?? 'itmt-admin-dev';
    const a = createHash('sha256').update(token).digest();
    const b = createHash('sha256').update(esperado).digest();
    if (timingSafeEqual(a, b)) {
      req.usuario = { sub: 'admin-token', papel: 'ADMIN' as Papel };
      return permitidos.length === 0 || permitidos.includes('ADMIN');
    }

    const sessao = verificarToken(token);
    if (!sessao) return false;
    req.usuario = sessao;
    return permitidos.length === 0 || permitidos.includes(sessao.papel);
  }
}
