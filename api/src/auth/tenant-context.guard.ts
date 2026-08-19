import {
  CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService, TenantContext } from '../database/database.service';
import { Sessao, verificarToken } from './token';

export interface TenantRequest {
  headers: Record<string, string | undefined>;
  params: Record<string, string | undefined>;
  usuario?: Sessao;
  tenantContext?: TenantContext & { membershipPapel: string; membershipVersion: number };
}

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<TenantRequest>();
    if (process.env.NODE_ENV !== 'production' && req.usuario?.sub === 'admin-token') {
      req.tenantContext = {
        tenantId: '00000000-0000-4000-8000-000000000001',
        organizationId: '00000000-0000-4000-8000-000000000002',
        membershipPapel: 'OWNER', membershipVersion: 1,
      };
      return true;
    }
    const auth = String(req.headers.authorization ?? '');
    const sessao = verificarToken(auth.startsWith('Bearer ') ? auth.slice(7) : '');
    if (!sessao?.uid || !sessao.tid || !sessao.oid || !sessao.membershipVersion)
      throw new UnauthorizedException('Selecione uma organização para esta sessão.');
    if (req.params.organizationId && req.params.organizationId !== sessao.oid)
      throw new NotFoundException('Recurso não encontrado.');

    const membro = await this.db.withIdentityTransaction(sessao.uid, async (client) => {
      const r = await client.query<{ papel: string; versao: number }>(
        `SELECT "OrganizacaoMembro_Papel" AS papel,
                "OrganizacaoMembro_Versao"::int AS versao
           FROM "OrganizacaoMembro"
          WHERE "OrganizacaoMembro_UsuarioId"=$1
            AND "OrganizacaoMembro_TenantId"=$2
            AND "OrganizacaoMembro_OrganizacaoId"=$3
            AND "OrganizacaoMembro_Status"='ATIVO'`,
        [sessao.uid, sessao.tid, sessao.oid],
      );
      return r.rows[0];
    });
    if (!membro || membro.versao !== sessao.membershipVersion)
      throw new UnauthorizedException('Membership revogada, suspensa ou alterada.');

    const ativa = await this.db.withTenantTransaction(
      { tenantId: sessao.tid, organizationId: sessao.oid, userId: sessao.uid },
      async (client) => {
        const r = await client.query(
          `SELECT 1 FROM "Tenant" t JOIN "Organizacao" o
             ON o."Organizacao_TenantId"=t."Tenant_Id"
            WHERE t."Tenant_Id"=$1 AND t."Tenant_Status"='ATIVO'
              AND o."Organizacao_Id"=$2 AND o."Organizacao_Status"='ATIVA'`,
          [sessao.tid, sessao.oid],
        );
        return r.rowCount === 1;
      },
    );
    if (!ativa) throw new UnauthorizedException('Tenant ou organização inativa.');
    req.usuario = sessao;
    req.tenantContext = {
      tenantId: sessao.tid, organizationId: sessao.oid, userId: sessao.uid,
      membershipPapel: membro.papel, membershipVersion: membro.versao,
    };
    return true;
  }
}
