import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { TenantContextGuard, TenantRequest } from './tenant-context.guard';
import { OrganizacoesService } from './organizacoes.service';

@Controller('organizacoes/:organizationId/configuracoes')
@UseGuards(TenantContextGuard)
export class OrganizacoesController {
  constructor(private readonly organizacoes: OrganizacoesService) {}

  @Get()
  listar(@Req() req: TenantRequest) {
    return this.organizacoes.listarConfiguracoes(req.tenantContext!);
  }

  @Put(':chave')
  salvar(@Req() req: TenantRequest, @Param('chave') chave: string, @Body() dto: { valor: unknown }) {
    return this.organizacoes.salvarConfiguracao(req.tenantContext!, chave, dto?.valor);
  }
}

@Controller('organizacoes/:organizationId/comercial')
@UseGuards(TenantContextGuard)
export class ComercialController {
  constructor(private readonly organizacoes: OrganizacoesService) {}

  @Get('planos')
  planos() { return this.organizacoes.listarPlanos(); }

  @Get('assinatura')
  assinatura(@Req() req: TenantRequest) { return this.organizacoes.obterAssinatura(req.tenantContext!); }

  @Put('assinatura')
  alterar(@Req() req: TenantRequest, @Body() dto: { plano_codigo?: string }) {
    return this.organizacoes.alterarAssinatura(req.tenantContext!, dto?.plano_codigo ?? '');
  }

  @Get('uso')
  uso(@Req() req: TenantRequest) { return this.organizacoes.obterUso(req.tenantContext!); }
}
