import { Injectable } from '@nestjs/common';
import { TenantContext } from '../database/database.service';

interface EntradaCache<T> { valor: T; expiraEm: number }

@Injectable()
export class TenantCacheService {
  private readonly entradas = new Map<string, EntradaCache<unknown>>();

  private chave(contexto: TenantContext, namespace: string, chave: string) {
    if (!contexto.tenantId || !contexto.organizationId) throw new Error('Cache tenant exige contexto completo.');
    if (!/^[a-z0-9_.-]{1,80}$/i.test(namespace)) throw new Error('Namespace de cache inválido.');
    return `v1:${contexto.tenantId}:${contexto.organizationId}:${namespace}:${chave}`;
  }

  set<T>(contexto: TenantContext, namespace: string, chave: string, valor: T, ttlMs: number) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('TTL de cache inválido.');
    this.entradas.set(this.chave(contexto, namespace, chave), { valor, expiraEm: Date.now() + ttlMs });
  }

  get<T>(contexto: TenantContext, namespace: string, chave: string): T | undefined {
    const composta = this.chave(contexto, namespace, chave);
    const entrada = this.entradas.get(composta);
    if (!entrada) return undefined;
    if (entrada.expiraEm <= Date.now()) { this.entradas.delete(composta); return undefined; }
    return entrada.valor as T;
  }

  invalidarOrganizacao(contexto: TenantContext) {
    const prefixo = `v1:${contexto.tenantId}:${contexto.organizationId}:`;
    for (const chave of this.entradas.keys()) if (chave.startsWith(prefixo)) this.entradas.delete(chave);
  }
}
