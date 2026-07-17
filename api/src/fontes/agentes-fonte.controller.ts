import { Controller, Get, Param, Post } from '@nestjs/common';
import { AgentesFonteService } from './agentes-fonte.service';

/**
 * F5 — Agentes de fonte. GET lista a situação de cada fonte (banco
 * primeiro); POST pede ao agente que pesquise — ele mesmo decide se
 * responde do banco ou vai à fonte oficial (só quando falta/venceu).
 * Público: o rate limit global e o mutex por agente contêm abuso, e
 * o pior caso é uma carga idempotente da fonte oficial.
 */
@Controller('agentes/fontes')
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
