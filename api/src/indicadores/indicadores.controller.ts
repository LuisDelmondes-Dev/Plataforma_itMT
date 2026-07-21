import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { IndicadoresService } from './indicadores.service';
import { Recorte } from '../territorio/territorio.service';

const RECORTES: Recorte[] = ['ESTADO', 'MUNICIPIO', 'RGINT', 'RGI', 'CONSORCIO'];

@Controller()
export class IndicadoresController {
  constructor(private readonly svc: IndicadoresService) {}

  /**
   * GET /v1/indicadores/:id/consulta?recorte=MUNICIPIO&codigo=5103403&referencia=2025-12-31
   * Plano de consulta validado ANTES de tocar o banco (RF-CHAT-003 aplicado à API).
   */
  @Get('indicadores/:id/consulta')
  consultar(
    @Param('id', ParseIntPipe) id: number,
    @Query('recorte') recorte: string,
    @Query('codigo') codigo?: string,
    @Query('referencia') referencia?: string,
  ) {
    const rec = (recorte ?? '').toUpperCase() as Recorte;
    if (!RECORTES.includes(rec))
      throw new BadRequestException(`recorte deve ser um de: ${RECORTES.join(', ')}`);
    if (rec !== 'ESTADO' && !codigo)
      throw new BadRequestException(`recorte ${rec} exige o parâmetro codigo`);
    const ref = referencia ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ref))
      throw new BadRequestException('referencia deve estar em AAAA-MM-DD');
    return this.svc.consultar({
      indicadorId: id,
      recorte: rec,
      codigo: codigo ?? null,
      dataReferencia: ref,
    });
  }

  /** GET /v1/indicadores/:id/comparacao?codigo_ibge=5103403&municipios=5107909,5107602 (RF-PORTAL-006) */
  @Get('indicadores/:id/comparacao')
  comparar(
    @Param('id', ParseIntPipe) id: number,
    @Query('codigo_ibge') codigoIbge: string,
    @Query('referencia') referencia?: string,
    @Query('municipios') municipios?: string,
  ) {
    if (!codigoIbge) throw new BadRequestException('codigo_ibge é obrigatório');
    const ref = referencia ?? new Date().toISOString().slice(0, 10);
    const livres = (municipios ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d{7}$/.test(s) && s !== codigoIbge);
    return this.svc.comparar(id, codigoIbge, ref, livres);
  }

  /** GET /v1/indicadores/:id/serie?recorte=MUNICIPIO&codigo=5103403 (A2 série histórica) */
  @Get('indicadores/:id/serie')
  serie(
    @Param('id', ParseIntPipe) id: number,
    @Query('recorte') recorte: string,
    @Query('codigo') codigo?: string,
  ) {
    const rec = (recorte ?? 'MUNICIPIO').toUpperCase() as Recorte;
    if (!RECORTES.includes(rec))
      throw new BadRequestException(`recorte deve ser um de: ${RECORTES.join(', ')}`);
    if (rec !== 'ESTADO' && !codigo)
      throw new BadRequestException(`recorte ${rec} exige o parâmetro codigo`);
    return this.svc.serie({ indicadorId: id, recorte: rec, codigo: codigo ?? null });
  }

  /** GET /v1/indicadores/destaque?limite=4 — indicadores com dado para a ficha (RF-PORTAL-011) */
  @Get('indicadores/destaque')
  destaque(@Query('limite') limite?: string) {
    const n = Number(limite);
    return this.svc.destaque(Number.isFinite(n) && n > 0 ? n : 4);
  }

  /** GET /v1/cobertura — matriz simplificada município × tema (RF-ADMIN-002) */
  @Get('cobertura')
  cobertura() {
    return this.svc.cobertura();
  }
}
