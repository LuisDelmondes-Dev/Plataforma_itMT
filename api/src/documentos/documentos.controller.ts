import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, Res, UploadedFile,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Papeis, PapeisGuard } from '../auth/papeis.guard';
import { TenantContextGuard, TenantRequest } from '../auth/tenant-context.guard';
import { Sessao } from '../auth/token';
import { ArquivoRecebido, DocumentosService } from './documentos.service';
import { DocumentosWorkerService } from './documentos-worker.service';

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @Get()
  listar(@Query('q') q?: string, @Query('tipo') tipo?: string, @Query('codigo_ibge') codigo?: string) {
    return this.documentos.listar(q, tipo, codigo);
  }

  @Get('busca')
  buscar(@Query('q') q?: string) { return this.documentos.buscar(q); }

  @Get('versoes/:id/arquivo')
  async arquivo(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response) {
    const d = await this.documentos.arquivoPublicado(id);
    res.setHeader('Content-Type', d.mime);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(d.nome)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return d.arquivo;
  }
}

@Controller('documentos')
@UseGuards(PapeisGuard, TenantContextGuard)
export class DocumentosUploadController {
  constructor(private readonly documentos: DocumentosService) {}

  @Post('upload')
  @Papeis('PARCEIRO', 'UNIVERSIDADE', 'CURADOR', 'ADMIN')
  @UseInterceptors(FileInterceptor('arquivo', {
    storage: memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  }))
  upload(
    @Body() dto: Record<string, string>,
    @UploadedFile() arquivo: ArquivoRecebido,
    @Req() req: TenantRequest & { usuario: Sessao },
  ) {
    return this.documentos.criar(dto, arquivo, req.usuario.sub, req.tenantContext!);
  }
}

@Controller('admin/documentos')
@UseGuards(PapeisGuard, TenantContextGuard)
@Papeis('CURADOR', 'ADMIN')
export class DocumentosAdminController {
  constructor(
    private readonly documentos: DocumentosService,
    private readonly worker: DocumentosWorkerService,
  ) {}

  @Get('pendentes')
  pendentes(@Req() req: TenantRequest) { return this.documentos.pendentes(req.tenantContext!); }

  @Get('operacao')
  operacao(@Req() req: TenantRequest) { return this.documentos.operacao(req.tenantContext!); }

  @Post('processar-fila')
  processarFila(@Req() req: TenantRequest, @Body() dto: { limite?: number }) {
    return this.worker.processar(req.tenantContext!, Number(dto?.limite) || 1);
  }

  @Post('versoes/:id/revisao')
  revisar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Record<string, string>,
    @Req() req: TenantRequest & { usuario: Sessao },
  ) {
    return this.documentos.revisar(id, {
      decisao: dto.decisao as 'APROVADO' | 'REJEITADO',
      justificativa: dto.justificativa,
      texto_revisado: dto.texto_revisado,
    }, req.usuario.sub, req.tenantContext!);
  }
}
