import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AgentesFonteService } from './agentes-fonte.service';
import { AgentesFonteController } from './agentes-fonte.controller';

/** F5 — um agente por fonte de dados: banco primeiro, internet só se preciso. */
@Module({
  imports: [DatabaseModule, AuditoriaModule],
  controllers: [AgentesFonteController],
  providers: [AgentesFonteService],
})
export class AgentesFonteModule {}
