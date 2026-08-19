import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Papeis, PapeisGuard } from '../auth/papeis.guard';
import { TenantContextGuard, TenantRequest } from '../auth/tenant-context.guard';
import { Sessao } from '../auth/token';
import { AuditoriaService } from '../auditoria/auditoria.service';

const TRANSICOES: Record<string, string[]> = {
  ABERTA: ['TRIAGEM'], TRIAGEM: ['EM_TRATAMENTO','ACEITA'],
  EM_TRATAMENTO: ['RESOLVIDA','ACEITA'], RESOLVIDA: [], ACEITA: [],
};

@Controller('admin/nao-conformidades')
@UseGuards(PapeisGuard, TenantContextGuard)
@Papeis('ADMIN','CURADOR')
export class ConformidadeController {
  constructor(private readonly db: DatabaseService, private readonly auditoria: AuditoriaService) {}

  @Get()
  async listar(@Req() req: TenantRequest) {
    return this.db.withTenantTransaction(req.tenantContext!, async (client) => (await client.query(
      `SELECT "NaoConformidade_Id"::text AS id,"NaoConformidade_Titulo" AS titulo,
        "NaoConformidade_Severidade" AS severidade,"NaoConformidade_Status" AS status,
        "NaoConformidade_Owner" AS owner,"NaoConformidade_Prazo"::text AS prazo,
        "NaoConformidade_Evidencia" AS evidencia FROM "NaoConformidade"
       ORDER BY CASE "NaoConformidade_Severidade" WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
        "NaoConformidade_CriadaEm"`)).rows);
  }

  @Post()
  async criar(@Req() req: TenantRequest & { usuario: Sessao }, @Body() dto: Record<string,string>) {
    if (!dto.titulo || !dto.descricao || !['P0','P1','P2','P3'].includes(dto.severidade) || !dto.owner)
      throw new BadRequestException('titulo, descricao, severidade P0-P3 e owner são obrigatórios.');
    const criado = await this.db.withTenantTransaction(req.tenantContext!, async (client) => {
      const r = await client.query<{ id: string }>(
        `INSERT INTO "NaoConformidade" ("NaoConformidade_TenantId","NaoConformidade_OrganizacaoId",
          "NaoConformidade_Titulo","NaoConformidade_Descricao","NaoConformidade_Severidade",
          "NaoConformidade_Owner","NaoConformidade_Prazo","NaoConformidade_CriadaPor")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING "NaoConformidade_Id"::text AS id`,
        [req.tenantContext!.tenantId,req.tenantContext!.organizationId,dto.titulo,dto.descricao,dto.severidade,dto.owner,dto.prazo||null,req.usuario.sub],
      );
      await client.query(`INSERT INTO "NaoConformidadeHistorico" VALUES (DEFAULT,$1,$2,$3,NULL,'ABERTA',$4,'Registro inicial',DEFAULT)`,
        [req.tenantContext!.tenantId,req.tenantContext!.organizationId,r.rows[0].id,req.usuario.sub]);
      return r.rows[0];
    });
    await this.auditoria.registrar(req.usuario.sub,'ABERTURA_NAO_CONFORMIDADE','NaoConformidade',criado.id,{ severidade:dto.severidade },req.tenantContext!);
    return { id: criado.id, status: 'ABERTA' };
  }

  @Post(':id/transicoes')
  async transicionar(@Req() req: TenantRequest & { usuario: Sessao }, @Param('id') id: string,
    @Body() dto: { status?: string; justificativa?: string; evidencia?: string }) {
    if (!dto.status || (dto.justificativa?.trim().length ?? 0) < 10)
      throw new BadRequestException('status e justificativa com ao menos 10 caracteres são obrigatórios.');
    const resultado = await this.db.withTenantTransaction(req.tenantContext!, async (client) => {
      const atual = await client.query<{ status:string; severidade:string }>(
        `SELECT "NaoConformidade_Status" AS status,"NaoConformidade_Severidade" AS severidade
         FROM "NaoConformidade" WHERE "NaoConformidade_Id"=$1 FOR UPDATE`, [id]);
      if (!atual.rows[0]) throw new NotFoundException('Não conformidade não encontrada.');
      if (!TRANSICOES[atual.rows[0].status]?.includes(dto.status!)) throw new BadRequestException('Transição de status inválida.');
      if (dto.status === 'RESOLVIDA' && !dto.evidencia?.trim()) throw new BadRequestException('Resolução exige evidência verificável.');
      if (atual.rows[0].severidade === 'P0' && dto.status === 'ACEITA') throw new BadRequestException('Risco P0 não pode ser aceito; deve ser tratado.');
      await client.query(`UPDATE "NaoConformidade" SET "NaoConformidade_Status"=$2,
        "NaoConformidade_Evidencia"=coalesce($3,"NaoConformidade_Evidencia"),"NaoConformidade_AtualizadaEm"=now()
        WHERE "NaoConformidade_Id"=$1`, [id,dto.status,dto.evidencia||null]);
      await client.query(`INSERT INTO "NaoConformidadeHistorico" VALUES (DEFAULT,$1,$2,$3,$4,$5,$6,$7,DEFAULT)`,
        [req.tenantContext!.tenantId,req.tenantContext!.organizationId,id,atual.rows[0].status,dto.status,req.usuario.sub,dto.justificativa]);
      return { id, status: dto.status };
    });
    await this.auditoria.registrar(req.usuario.sub,'TRANSICAO_NAO_CONFORMIDADE','NaoConformidade',id,resultado,req.tenantContext!);
    return resultado;
  }
}
