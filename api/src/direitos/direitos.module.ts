import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { DireitosService } from './direitos.service';
import { DireitosAdminController, DireitosController } from './direitos.controller';

/** F4 — Mapa de Serviços Públicos Gratuitos, Benefícios e Direitos do Cidadão. */
@Module({
  imports: [DatabaseModule, AuditoriaModule],
  controllers: [DireitosController, DireitosAdminController],
  providers: [DireitosService],
})
export class DireitosModule {}
