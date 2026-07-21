import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
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
    return this.pool.query<T>(sql, params);
  }

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

  onModuleDestroy() {
    return this.pool.end();
  }
}
