import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, PoolClient, QueryResultRow } from 'pg';

export interface TenantContext {
  tenantId: string;
  organizationId: string;
  userId?: string;
}
export const PLATFORM_PUBLIC_CONTEXT: TenantContext = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  organizationId: '00000000-0000-4000-8000-000000000002',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly transacaoContextual = new AsyncLocalStorage<PoolClient>();
  // A API conecta como itmt_app (papel de aplicação), NUNCA como dono do
  // banco — assim a imutabilidade da trilha (REVOKE UPDATE/DELETE em
  // EventoAuditoria, db/08-seguranca.sql) vale também em dev/teste, não só
  // em produção. O dono (itmt) fica reservado às migrações. Em produção o
  // fail-fast do main.ts exige itmt_app explicitamente.
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgres://itmt_app:itmt_app@localhost:5432/itmt',
    // RF-CHAT/Executor (A04): timeout e limite defensivos
    statement_timeout: 5000,
  });

  query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
    return (this.transacaoContextual.getStore() ?? this.pool).query<T>(sql, params);
  }

  currentTransactionClient() { return this.transacaoContextual.getStore(); }

  /**
   * Executa `fn` com um cliente dedicado do pool (para transações /
   * advisory locks), liberando-o ao fim. Substitui o acesso direto ao
   * pool privado — nenhum consumidor precisa mais de `(db as any).pool`.
   */
  async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  /**
   * Única borda permitida para recursos TENANT_OWNED. SET LOCAL vive dentro
   * da transação e desaparece no COMMIT/ROLLBACK, impedindo vazamento no pool.
   * Tenant/organização vindos de header livre nunca devem chegar aqui: o guard
   * precisa entregar apenas contexto já autenticado por membership/API key.
   */
  async withTenantTransaction<T>(contexto: TenantContext, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!UUID.test(contexto.tenantId) || !UUID.test(contexto.organizationId))
      throw new Error('Contexto tenant inválido.');
    const client = await this.pool.connect();
    await client.query('BEGIN');
    try {
      await client.query(
        `SELECT set_config('app.tenant_id',$1,true),
                set_config('app.organization_id',$2,true),
                set_config('app.user_id',$3,true)`,
        [contexto.tenantId, contexto.organizationId, contexto.userId ?? ''],
      );
      const resultado = await this.transacaoContextual.run(client, () => fn(client));
      await client.query('COMMIT');
      return resultado;
    } catch (erro) {
      await client.query('ROLLBACK');
      throw erro;
    } finally {
      client.release();
    }
  }

  /** Seleção de membership: define somente o usuário autenticado, nunca tenant/org. */
  async withIdentityTransaction<T>(userId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!/^\d+$/.test(userId)) throw new Error('Contexto de identidade inválido.');
    const client = await this.pool.connect();
    await client.query('BEGIN');
    try {
      await client.query(`SELECT set_config('app.user_id',$1,true)`, [userId]);
      const resultado = await fn(client);
      await client.query('COMMIT');
      return resultado;
    } catch (erro) {
      await client.query('ROLLBACK');
      throw erro;
    } finally {
      client.release();
    }
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
