import { Module } from '@nestjs/common';
import { PapeisGuard } from '../auth/papeis.guard';
import {
  DocumentosAdminController,
  DocumentosController,
  DocumentosUploadController,
} from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { AntivirusService } from './antivirus.service';
import { EmbeddingsService } from './embeddings.service';
import { ExtracaoService } from './extracao.service';
import { DocumentosWorkerService } from './documentos-worker.service';

@Module({
  controllers: [DocumentosController, DocumentosUploadController, DocumentosAdminController],
  providers: [
    DocumentosService, DocumentosWorkerService, AntivirusService,
    EmbeddingsService, ExtracaoService, PapeisGuard,
  ],
})
export class DocumentosModule {}
