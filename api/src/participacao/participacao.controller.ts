import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService, PLATFORM_PUBLIC_CONTEXT } from '../database/database.service';
import { Papeis, PapeisGuard } from '../auth/papeis.guard';
import { TenantContextGuard, TenantRequest } from '../auth/tenant-context.guard';
import { Sessao } from '../auth/token';
import { AuditoriaService } from '../auditoria/auditoria.service';

const sha = (value:string) => createHash('sha256').update(value).digest('hex');

@Controller('participacao')
export class ParticipacaoPublicaController {
  constructor(private readonly db: DatabaseService) {}

  @Post()
  async enviar(@Body() dto: { categoria?:string; codigo_ibge?:string; mensagem?:string; consentimento?:boolean }) {
    if (!dto.consentimento) throw new BadRequestException('Consentimento para tratamento da manifestação é obrigatório.');
    if (!['DADO','SERVICO','SUGESTAO','CORRECAO','OUTRO'].includes(dto.categoria ?? '')) throw new BadRequestException('Categoria inválida.');
    if ((dto.mensagem?.trim().length ?? 0) < 20) throw new BadRequestException('Mensagem deve ter ao menos 20 caracteres.');
    if (dto.codigo_ibge && !/^\d{7}$/.test(dto.codigo_ibge)) throw new BadRequestException('codigo_ibge inválido.');
    const token = randomBytes(24).toString('base64url');
    const r = await this.db.withTenantTransaction(PLATFORM_PUBLIC_CONTEXT, async (client) => client.query<{ protocolo:string }>(
      `INSERT INTO "ParticipacaoCidada" ("ParticipacaoCidada_TenantId","ParticipacaoCidada_OrganizacaoId",
        "ParticipacaoCidada_TokenHash","ParticipacaoCidada_Categoria","ParticipacaoCidada_CodigoIbge",
        "ParticipacaoCidada_Mensagem","ParticipacaoCidada_ConsentimentoEm")
       VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING "ParticipacaoCidada_Protocolo"::text AS protocolo`,
      [PLATFORM_PUBLIC_CONTEXT.tenantId,PLATFORM_PUBLIC_CONTEXT.organizationId,sha(token),dto.categoria,dto.codigo_ibge||null,dto.mensagem!.trim()],
    ));
    return { protocolo:r.rows[0].protocolo, token_acompanhamento:token, status:'RECEBIDA', aviso:'Guarde o token; ele não será exibido novamente.' };
  }

  @Get(':protocolo')
  async acompanhar(@Param('protocolo') protocolo:string, @Query('token') token?:string) {
    if (!token) throw new NotFoundException('Manifestação não encontrada.');
    const r = await this.db.withTenantTransaction(PLATFORM_PUBLIC_CONTEXT, async (client) => client.query(
      `SELECT "ParticipacaoCidada_Protocolo"::text AS protocolo,"ParticipacaoCidada_Status" AS status,
        "ParticipacaoCidada_Resposta" AS resposta,"ParticipacaoCidada_AtualizadaEm"::text AS atualizada_em
       FROM "ParticipacaoCidada" WHERE "ParticipacaoCidada_Protocolo"=$1 AND "ParticipacaoCidada_TokenHash"=$2`, [protocolo,sha(token)]));
    if (!r.rows[0]) throw new NotFoundException('Manifestação não encontrada.');
    return r.rows[0];
  }

  @Get()
  async impacto() {
    return this.db.withTenantTransaction(PLATFORM_PUBLIC_CONTEXT, async (client) => (await client.query(
      `SELECT count(*)::int AS total,
        count(*) FILTER (WHERE "ParticipacaoCidada_Status"='RESPONDIDA')::int AS respondidas,
        count(*) FILTER (WHERE "ParticipacaoCidada_Status" IN ('RECEBIDA','EM_ANALISE'))::int AS em_andamento
       FROM "ParticipacaoCidada"`)).rows[0]);
  }
}

@Controller('admin/participacao')
@UseGuards(PapeisGuard,TenantContextGuard)
@Papeis('ADMIN','CURADOR')
export class ParticipacaoAdminController {
  constructor(private readonly db: DatabaseService, private readonly auditoria: AuditoriaService) {}
  @Get()
  async fila(@Req() req:TenantRequest) { return this.db.withTenantTransaction(req.tenantContext!, async (client)=>(await client.query(
    `SELECT "ParticipacaoCidada_Protocolo"::text AS protocolo,"ParticipacaoCidada_Categoria" AS categoria,
      "ParticipacaoCidada_CodigoIbge" AS codigo_ibge,"ParticipacaoCidada_Mensagem" AS mensagem,
      "ParticipacaoCidada_Status" AS status,"ParticipacaoCidada_CriadaEm"::text AS criada_em
     FROM "ParticipacaoCidada" ORDER BY "ParticipacaoCidada_CriadaEm"`)).rows); }

  @Post(':protocolo/resposta')
  async responder(@Req() req:TenantRequest & {usuario:Sessao}, @Param('protocolo') protocolo:string,
    @Body() dto:{ resposta?:string }) {
    if ((dto.resposta?.trim().length ?? 0)<10) throw new BadRequestException('Resposta deve ter ao menos 10 caracteres.');
    const r=await this.db.withTenantTransaction(req.tenantContext!,async(client)=>client.query(
      `UPDATE "ParticipacaoCidada" SET "ParticipacaoCidada_Status"='RESPONDIDA',
        "ParticipacaoCidada_Resposta"=$2,"ParticipacaoCidada_RespondidaPor"=$3,"ParticipacaoCidada_AtualizadaEm"=now()
       WHERE "ParticipacaoCidada_Protocolo"=$1 AND "ParticipacaoCidada_Status" IN ('RECEBIDA','EM_ANALISE')
       RETURNING "ParticipacaoCidada_Protocolo"::text AS protocolo`,[protocolo,dto.resposta!.trim(),req.usuario.sub]));
    if(!r.rows[0]) throw new NotFoundException('Manifestação não encontrada ou já concluída.');
    await this.auditoria.registrar(req.usuario.sub,'RESPOSTA_PARTICIPACAO','ParticipacaoCidada',protocolo,{},req.tenantContext!);
    return { protocolo,status:'RESPONDIDA' };
  }
}
