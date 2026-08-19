import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Papeis, PapeisGuard } from '../auth/papeis.guard';
import { TenantContextGuard, TenantRequest } from '../auth/tenant-context.guard';
import { Sessao } from '../auth/token';
import { ApiKeysService } from './api-keys.service';

@Controller('parceiros/chaves')
@UseGuards(PapeisGuard, TenantContextGuard)
@Papeis('PARCEIRO', 'UNIVERSIDADE', 'ADMIN')
export class ApiKeysController {
  constructor(private readonly chaves: ApiKeysService) {}

  @Get()
  listar(@Req() req: TenantRequest & { usuario: Sessao }) { return this.chaves.listar(req.usuario.sub, req.tenantContext!); }

  @Post()
  criar(
    @Body() dto: { nome?: string; escopos?: string[]; quota_minuto?: number; quota_dia?: number; expira_em?: string },
    @Req() req: TenantRequest & { usuario: Sessao },
  ) { return this.chaves.criar(req.usuario.sub, dto, req.tenantContext!); }

  @Post(':id/revogar')
  revogar(@Param('id', ParseIntPipe) id: number, @Req() req: TenantRequest & { usuario: Sessao }) {
    return this.chaves.revogar(id, req.usuario.sub, req.tenantContext!);
  }
}
