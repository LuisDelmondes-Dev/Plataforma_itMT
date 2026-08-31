import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PesquisasController } from './pesquisas.controller';
import { PesquisasService } from './pesquisas.service';

/**
 * Persistência de pesquisas (Gauntlet P1, db/48). Exporta o service para o
 * orquestrador (P4) gravar o snapshot como parte da execução; o controller
 * expõe apenas leitura (lista + reabertura idêntica do banco).
 */
@Module({
  imports: [AuditoriaModule],
  controllers: [PesquisasController],
  providers: [PesquisasService],
  exports: [PesquisasService],
})
export class PesquisasModule {}
