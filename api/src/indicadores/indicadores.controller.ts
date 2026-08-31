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

  /**
   * GET /v1/indicadores/:id/ranking?referencia=AAAA-MM-DD&n=5
   * Ranking completo dos municípios (Gauntlet P2): posição (competition
   * ranking), top-N/bottom-N, delta vs média estadual do motor e
   * procedência por linha. RN-005: município sem dado vai para `ausentes`,
   * nunca aparece como zero.
   */
  @Get('indicadores/:id/ranking')
  ranking(
    @Param('id', ParseIntPipe) id: number,
    @Query('referencia') referencia?: string,
    @Query('n') n?: string,
  ) {
    if (referencia && !/^\d{4}-\d{2}-\d{2}$/.test(referencia))
      throw new BadRequestException('referencia deve ser AAAA-MM-DD');
    let topN: number | undefined;
    if (n !== undefined && n !== '') {
      const valor = Number(n);
      if (!Number.isInteger(valor) || valor < 1 || valor > 142)
        throw new BadRequestException('n deve ser um inteiro entre 1 e 142');
      topN = valor;
    }
    return this.svc.ranking({ indicadorId: id, referencia: referencia ?? null, n: topN });
  }

  /**
   * GET /v1/indicadores/:id/causas?codigo=5103403&referencia=AAAA-MM-DD&dimensao=CAPITULO_CID10
   * Decomposição por causa/categoria (Gauntlet P3): valores absolutos +
   * participação % por dimensão (capítulo CID-10, causa evitável 0–4 anos,
   * componente etário), no município (codigo) ou no estado (sem codigo).
   * RN-005: sem dado, 404 com as dimensões que existem — nunca zero.
   */
  @Get('indicadores/:id/causas')
  causas(
    @Param('id', ParseIntPipe) id: number,
    @Query('codigo') codigo?: string,
    @Query('referencia') referencia?: string,
    @Query('dimensao') dimensao?: string,
  ) {
    if (codigo !== undefined && codigo !== '' && !/^\d{7}$/.test(codigo))
      throw new BadRequestException('codigo deve ser o código IBGE de 7 dígitos do município');
    if (referencia && !/^\d{4}-\d{2}-\d{2}$/.test(referencia))
      throw new BadRequestException('referencia deve ser AAAA-MM-DD');
    // Evolução E1 (db/54): o controller NÃO conhece mais o vocabulário de
    // dimensões — só normaliza a caixa e delega; o service valida em runtime
    // contra o catálogo "DimensaoObservacao" e responde 400 honesto listando
    // os códigos vigentes. Decisão documentada: validar no service (e não
    // consultar o catálogo daqui) mantém UM ponto de verdade também para
    // quem chama o motor sem HTTP (orquestrador, exportação, testes).
    const dim = dimensao ? dimensao.toUpperCase() : null;
    return this.svc.causas({
      indicadorId: id,
      codigo: codigo || null,
      referencia: referencia ?? null,
      dimensao: dim,
    });
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
