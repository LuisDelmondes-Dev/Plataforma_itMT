import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { IndicadoresService } from './indicadores.service';
import { ProjecaoService } from './projecao.service';
import { Recorte } from '../territorio/territorio.service';

const RECORTES: Recorte[] = ['ESTADO', 'MUNICIPIO', 'RGINT', 'RGI', 'CONSORCIO'];

@Controller()
export class IndicadoresController {
  constructor(
    private readonly svc: IndicadoresService,
    private readonly projecao: ProjecaoService,
  ) {}

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

  /**
   * GET /v1/indicadores/:id/projecao?recorte=&codigo=&horizonte=2
   * Projeção OLS determinística sobre a série (categoria PROJECAO — nunca
   * "dado"); exige >= 4 pontos observados, senão 422 (RN-005).
   */
  @Get('indicadores/:id/projecao')
  projetar(
    @Param('id', ParseIntPipe) id: number,
    @Query('recorte') recorte: string,
    @Query('codigo') codigo?: string,
    @Query('horizonte') horizonte?: string,
  ) {
    const rec = (recorte ?? 'MUNICIPIO').toUpperCase() as Recorte;
    if (!RECORTES.includes(rec))
      throw new BadRequestException(`recorte deve ser um de: ${RECORTES.join(', ')}`);
    if (rec !== 'ESTADO' && !codigo)
      throw new BadRequestException(`recorte ${rec} exige o parâmetro codigo`);
    const h = Number(horizonte);
    return this.projecao.projetar({
      indicadorId: id,
      recorte: rec,
      codigo: codigo ?? null,
      horizonte: Number.isFinite(h) && h > 0 ? h : 2,
    });
  }

  /**
   * GET /v1/indicadores/:id/cenarios?recorte=&codigo=&horizonte=5&taxas=2.5,5,-1
   * Simulador determinístico: crescimento composto por taxa + tendência OLS
   * como referência. Categoria CENARIO — hipótese declarada, nunca "dado".
   */
  @Get('indicadores/:id/cenarios')
  cenarios(
    @Param('id', ParseIntPipe) id: number,
    @Query('recorte') recorte: string,
    @Query('codigo') codigo?: string,
    @Query('horizonte') horizonte?: string,
    @Query('taxas') taxas?: string,
  ) {
    const rec = (recorte ?? 'ESTADO').toUpperCase() as Recorte;
    if (!RECORTES.includes(rec))
      throw new BadRequestException(`recorte deve ser um de: ${RECORTES.join(', ')}`);
    if (rec !== 'ESTADO' && !codigo)
      throw new BadRequestException(`recorte ${rec} exige o parâmetro codigo`);
    const lista = (taxas ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map(Number);
    if (!lista.length) throw new BadRequestException('Informe taxas=t1,t2,… (% ao ano).');
    if (lista.length > 4) throw new BadRequestException('No máximo 4 taxas por simulação.');
    for (const t of lista)
      if (!Number.isFinite(t) || t < -50 || t > 50)
        throw new BadRequestException('Cada taxa deve ser um número entre -50 e 50 (% ao ano).');
    const h = Number(horizonte);
    return this.projecao.cenarios({
      indicadorId: id,
      recorte: rec,
      codigo: codigo ?? null,
      horizonte: Number.isFinite(h) && h > 0 ? h : 5,
      taxas: lista,
    });
  }

  /** GET /v1/indicadores/:id/mapa?referencia=AAAA-MM-DD — valor por município p/ coroplético */
  @Get('indicadores/:id/mapa')
  mapa(@Param('id', ParseIntPipe) id: number, @Query('referencia') referencia?: string) {
    if (referencia && !/^\d{4}-\d{2}-\d{2}$/.test(referencia))
      throw new BadRequestException('referencia deve ser AAAA-MM-DD');
    return this.svc.mapa({ indicadorId: id, referencia: referencia ?? null });
  }

  /** GET /v1/indicadores/destaque?limite=4 — indicadores com dado para a ficha (RF-PORTAL-011) */
  @Get('indicadores/destaque')
  destaque(@Query('limite') limite?: string, @Query('detalhe') detalhe?: string) {
    const n = Number(limite);
    return this.svc.destaque(Number.isFinite(n) && n > 0 ? n : 4, detalhe === '1');
  }

  /** GET /v1/cobertura — matriz simplificada município × tema (RF-ADMIN-002) */
  @Get('cobertura')
  cobertura() {
    return this.svc.cobertura();
  }
}
