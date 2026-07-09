import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgres://itmt:itmt@localhost:5432/itmt',
    // RF-CHAT/Executor (A04): timeout e limite defensivos
    statement_timeout: 5000,
  });

  query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
    return this.pool.query<T>(sql, params);
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
