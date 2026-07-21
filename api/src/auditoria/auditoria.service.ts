import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * Trilha de auditoria INSERT-ONLY com encadeamento SHA-256 (RG-10 / RF-ADMIN-005).
 * HashAtual = SHA-256(HashAnterior ‖ payload canônico).
 * UPDATE/DELETE são revogados por grant de banco (ver 01-ddl.sql).
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly db: DatabaseService) {}

  async registrar(
    ator: string,
    acao: string,
    entidade: string,
    entidadeId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const payloadCanonico = JSON.stringify(payload, Object.keys(payload).sort());
    // Serialização por advisory lock: garante encadeamento sem corrida.
    // Cliente dedicado via withClient (sem acessar o pool privado).
    try {
      await this.db.withClient(async (client) => {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(842001)');
        const ult = await client.query(
          `SELECT "EventoAuditoria_HashAtual" AS h FROM "EventoAuditoria"
            ORDER BY "EventoAuditoria_Id" DESC LIMIT 1`,
        );
        const hashAnterior: string = ult.rows[0]?.h ?? '0'.repeat(64);
        // O hash é calculado sobre a forma CANÔNICA do jsonb no Postgres
        // (($5::jsonb)::text), para que o verificador independente recompute
        // exatamente o mesmo texto ao ler a coluna (RF-ADMIN-008).
        try {
          await client.query(
            `INSERT INTO "EventoAuditoria"
               ("EventoAuditoria_Ator","EventoAuditoria_Acao","EventoAuditoria_Entidade",
                "EventoAuditoria_EntidadeId","EventoAuditoria_Payload",
                "EventoAuditoria_HashAnterior","EventoAuditoria_HashAtual")
             VALUES ($1,$2,$3,$4,$5::jsonb,$6::text,
                     encode(sha256(($6::text || ($5::jsonb)::text)::bytea),'hex'))`,
            [ator, acao, entidade, entidadeId, payloadCanonico, hashAnterior],
          );
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
      });
    } catch (e) {
      // Auditoria não pode derrubar a consulta pública; falha é logada e alertada
      // (em produção: métrica + alerta, RNF-11)
      console.error('[auditoria] falha ao registrar evento:', e);
    }
  }
}
