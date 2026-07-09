import { Controller, Get, Param, Query } from '@nestjs/common';
import { TerritorioService } from './territorio.service';

@Controller()
export class TerritorioController {
  constructor(private readonly svc: TerritorioService) {}

  @Get('municipios')
  municipios(@Query('q') q?: string) {
    return this.svc.listarMunicipios(q);
  }

  @Get('municipios/:codigo')
  municipio(@Param('codigo') codigo: string) {
    return this.svc.obterMunicipio(codigo);
  }

  @Get('regioes')
  regioes() {
    return this.svc.listarRegioes();
  }

  @Get('consorcios')
  consorcios() {
    return this.svc.listarConsorcios();
  }
}
