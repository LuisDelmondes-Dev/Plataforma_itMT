import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService, TenantContext } from '../database/database.service';

const TIPOS = ['EXPORTAR', 'PROCESSAR_DOCUMENTO', 'SINCRONIZAR_CAMPO'] as const;

@Injectable()
export class TenantJobsService {
  constructor(private readonly db: DatabaseService) {}

  enfileirar(contexto: TenantContext, dto: { tipo: string; recurso_id: string; payload?: unknown; idempotency_key: string }) {
    if (!TIPOS.includes(dto.tipo as typeof TIPOS[number])) throw new BadRequestException('Tipo de job inválido.');
    if (!dto.recurso_id?.trim() || !dto.idempotency_key || dto.idempotency_key.length < 8)
      throw new BadRequestException('recurso_id e idempotency_key são obrigatórios.');
    const payload = JSON.stringify(dto.payload ?? {});
    if (Buffer.byteLength(payload) > 65_536) throw new BadRequestException('Payload maior que 64 KiB.');
    return this.db.withTenantTransaction(contexto, async (client) => {
      const limiteAmbiente = Math.max(1, Number(process.env.TENANT_JOB_MAX_PENDING ?? 500));
      const pendentes = await client.query<{ total: number; limite: number }>(
        `SELECT
           (SELECT count(*)::int FROM "TenantJob" j
             WHERE j."TenantJob_TenantId"=$1 AND j."TenantJob_OrganizacaoId"=$2
               AND j."TenantJob_Status" IN ('PENDENTE','PROCESSANDO')) AS total,
           coalesce((SELECT coalesce((p."PlanoComercial_Limites"->>'jobs_pendentes')::int,$3)
             FROM "Assinatura" a JOIN "PlanoComercial" p ON p."PlanoComercial_Id"=a."Assinatura_PlanoId"
            WHERE a."Assinatura_TenantId"=$1 AND a."Assinatura_OrganizacaoId"=$2
              AND a."Assinatura_Status" IN ('TRIAL','ATIVA') LIMIT 1),0)::int AS limite`,
        [contexto.tenantId, contexto.organizationId, limiteAmbiente],
      );
      const limite = pendentes.rows[0]?.limite ?? 0;
      if ((pendentes.rows[0]?.total ?? 0) >= limite) {
        throw new ServiceUnavailableException({
          codigo: 'FILA_CONGESTIONADA',
          mensagem: 'Fila temporariamente congestionada; tente novamente mais tarde.',
          retry_after_seconds: 30,
        });
      }
      const r = await client.query(
        `INSERT INTO "TenantJob"
          ("TenantJob_TenantId","TenantJob_OrganizacaoId","TenantJob_Tipo","TenantJob_RecursoId","TenantJob_Payload","TenantJob_IdempotencyKey")
         VALUES ($1,$2,$3,$4,$5::jsonb,$6)
         ON CONFLICT ("TenantJob_TenantId","TenantJob_OrganizacaoId","TenantJob_IdempotencyKey")
         DO UPDATE SET "TenantJob_IdempotencyKey"=EXCLUDED."TenantJob_IdempotencyKey"
         RETURNING "TenantJob_Id"::text AS id,"TenantJob_Status" AS status,"TenantJob_Tipo" AS tipo`,
        [contexto.tenantId, contexto.organizationId, dto.tipo, dto.recurso_id, payload, dto.idempotency_key],
      );
      return r.rows[0];
    });
  }

  obter(contexto: TenantContext, id: string) {
    return this.db.withTenantTransaction(contexto, async (client) => {
      const r = await client.query(
        `SELECT "TenantJob_Id"::text AS id,"TenantJob_Tipo" AS tipo,"TenantJob_Status" AS status,
                "TenantJob_RecursoId" AS recurso_id,"TenantJob_Tentativas" AS tentativas
           FROM "TenantJob" WHERE "TenantJob_Id"=$1
             AND "TenantJob_TenantId"=$2 AND "TenantJob_OrganizacaoId"=$3`,
        [id, contexto.tenantId, contexto.organizationId],
      );
      if (!r.rows[0]) throw new NotFoundException('Job não encontrado.');
      return r.rows[0];
    });
  }
}
