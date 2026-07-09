import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { TaxonomiaService } from './taxonomia.service';

@Controller()
export class TaxonomiaController {
  constructor(private readonly svc: TaxonomiaService) {}

  @Get('temas')
  temas() {
    return this.svc.temas();
  }

  @Get('temas/:id/subtemas')
  subtemas(@Param('id', ParseIntPipe) id: number) {
    return this.svc.subtemas(id);
  }

  @Get('subtemas/:id/indicadores')
  indicadores(@Param('id', ParseIntPipe) id: number) {
    return this.svc.indicadoresDoSubtema(id);
  }
}
