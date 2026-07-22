import { Module } from '@nestjs/common';
import { IndicadoresController } from './indicadores.controller';
import { ExportacaoController } from './exportacao.controller';
import { IndicadoresService } from './indicadores.service';
import { ProjecaoService } from './projecao.service';
import { TerritorioModule } from '../territorio/territorio.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AgentesFonteModule } from '../fontes/agentes-fonte.module';

@Module({
  imports: [TerritorioModule, AuditoriaModule, AgentesFonteModule],
  controllers: [IndicadoresController, ExportacaoController],
  providers: [IndicadoresService, ProjecaoService],
  exports: [IndicadoresService],
})
export class IndicadoresModule {}
