import { Module } from '@nestjs/common';
import { IndicadoresController } from './indicadores.controller';
import { ExportacaoController } from './exportacao.controller';
import { IndicadoresService } from './indicadores.service';
import { TerritorioModule } from '../territorio/territorio.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [TerritorioModule, AuditoriaModule],
  controllers: [IndicadoresController, ExportacaoController],
  providers: [IndicadoresService],
})
export class IndicadoresModule {}
