import {
  BadRequestException, Controller, Get, Param, ParseIntPipe, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { TaxonomiaService } from '../taxonomia/taxonomia.service';
import { IndicadoresService } from '../indicadores/indicadores.service';
import { Recorte } from '../territorio/territorio.service';
import { ApiKeyGuard, EscoposApi } from './api-key.guard';
import { ApiClienteAutenticado } from './api-keys.service';

type RequisicaoApi = { apiCliente: ApiClienteAutenticado };
const RECORTES: Recorte[] = ['ESTADO', 'MUNICIPIO', 'RGINT', 'RGI', 'CONSORCIO'];

@Controller('integracoes')
@UseGuards(ApiKeyGuard)
export class IntegracoesController {
  constructor(private readonly taxonomia: TaxonomiaService, private readonly indicadores: IndicadoresService) {}

  private limites(req: RequisicaoApi, res: Response) {
    res.setHeader('X-RateLimit-Limit-Minute', req.apiCliente.quota_minuto);
    res.setHeader('X-RateLimit-Remaining-Minute', req.apiCliente.restante_minuto);
    res.setHeader('X-RateLimit-Limit-Day', req.apiCliente.quota_dia);
    res.setHeader('X-RateLimit-Remaining-Day', req.apiCliente.restante_dia);
  }

  @Get('temas')
  @EscoposApi('catalogo:ler')
  temas(@Req() req: RequisicaoApi, @Res({ passthrough: true }) res: Response) {
    this.limites(req, res); return this.taxonomia.temas();
  }

  @Get('temas/:id/subtemas')
  @EscoposApi('catalogo:ler')
  subtemas(@Param('id', ParseIntPipe) id: number, @Req() req: RequisicaoApi,
    @Res({ passthrough: true }) res: Response) {
    this.limites(req, res); return this.taxonomia.subtemas(id);
  }

  @Get('subtemas/:id/indicadores')
  @EscoposApi('catalogo:ler')
  catalogoIndicadores(@Param('id', ParseIntPipe) id: number, @Req() req: RequisicaoApi,
    @Res({ passthrough: true }) res: Response) {
    this.limites(req, res); return this.taxonomia.indicadoresDoSubtema(id);
  }

  @Get('indicadores/:id/consulta')
  @EscoposApi('indicadores:ler')
  consultar(
    @Param('id', ParseIntPipe) id: number, @Query('recorte') recorte: string,
    @Query('codigo') codigo: string | undefined, @Query('referencia') referencia: string | undefined,
    @Req() req: RequisicaoApi, @Res({ passthrough: true }) res: Response,
  ) {
    const rec = (recorte ?? '').toUpperCase() as Recorte;
    if (!RECORTES.includes(rec))
      throw new BadRequestException(`recorte deve ser um de: ${RECORTES.join(', ')}`);
    if (rec !== 'ESTADO' && !codigo) throw new BadRequestException(`recorte ${rec} exige o parâmetro codigo`);
    const ref = referencia ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ref)) throw new BadRequestException('referencia deve estar em AAAA-MM-DD');
    this.limites(req, res);
    return this.indicadores.consultar({ indicadorId: id, recorte: rec, codigo: codigo ?? null, dataReferencia: ref });
  }
}

