import { Injectable } from '@nestjs/common';
import { DatabaseService, TenantContext } from '../database/database.service';
import { PoolClient } from 'pg';

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
    contexto?: TenantContext,
  ): Promise<void> {
    // Serialização por advisory lock: garante encadeamento sem corrida.
    // Cliente dedicado via withClient (sem acessar o pool privado).
    try {
      const gravar = async (client: PoolClient, gerenciaTransacao: boolean) => {
        if (gerenciaTransacao) await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(842001)');
        const escopo = await client.query<{ tid: string | null; oid: string | null }>(
          `SELECT "ContextoTenant_Id"()::text AS tid,"ContextoOrganizacao_Id"()::text AS oid`,
        );
        const tid = escopo.rows[0]?.tid ?? null;
        const oid = escopo.rows[0]?.oid ?? null;
        const payloadEscopado = tid && oid ? { ...payload, _tenant_id: tid, _organization_id: oid } : payload;
        const payloadCanonico = JSON.stringify(payloadEscopado, Object.keys(payloadEscopado).sort());
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
                "EventoAuditoria_HashAnterior","EventoAuditoria_HashAtual",
                "EventoAuditoria_TenantId","EventoAuditoria_OrganizacaoId")
             VALUES ($1,$2,$3,$4,$5::jsonb,$6::text,
                     encode(sha256(($6::text || ($5::jsonb)::text)::bytea),'hex'),$7,$8)`,
            [ator, acao, entidade, entidadeId, payloadCanonico, hashAnterior, tid, oid],
          );
          if (gerenciaTransacao) await client.query('COMMIT');
        } catch (e) {
          if (gerenciaTransacao) await client.query('ROLLBACK');
          throw e;
        }
      };
      const executar = async () => {
        const atual = this.db.currentTransactionClient();
        if (atual) return gravar(atual, false);
        return this.db.withClient((client) => gravar(client, true));
      };
      if (contexto && !this.db.currentTransactionClient()) await this.db.withTenantTransaction(contexto, executar);
      else await executar();
    } catch (e) {
      // Auditoria não pode derrubar a consulta pública; falha é logada e alertada
      // (em produção: métrica + alerta, RNF-11)
      console.error('[auditoria] falha ao registrar evento:', e);
    }
  }
}
