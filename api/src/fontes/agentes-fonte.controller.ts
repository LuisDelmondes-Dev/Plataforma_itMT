import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AgentesFonteService } from './agentes-fonte.service';
import { AdminGuard } from '../admin/admin.controller';

/**
 * F5 — Agentes de fonte (ferramenta de OPERAÇÃO, não de usuário final).
 * Para o público, o agente é imperceptível: toda consulta que dá
 * ausência dispara a auto-busca (garantirParaIndicador) nos bastidores —
 * banco primeiro, fonte oficial só quando falta/venceu, e a consulta é
 * refeita. Estes endpoints existem para o curador inspecionar a situação
 * das fontes e forçar uma pesquisa; por isso exigem papel de gestão
 * (ADMIN_TOKEN ou sessão ADMIN/CURADOR).
 */
@Controller('agentes/fontes')
@UseGuards(AdminGuard)
export class AgentesFonteController {
  constructor(private readonly svc: AgentesFonteService) {}

  @Get()
  listar() {
    return this.svc.listar();
  }

  @Post(':slug/pesquisar')
  pesquisar(@Param('slug') slug: string) {
    return this.svc.pesquisar(slug);
  }
}
