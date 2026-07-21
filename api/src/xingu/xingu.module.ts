import { Module } from '@nestjs/common';
import { XinguController } from './xingu.controller';
import { OrquestradorService } from './orquestrador.service';
import { InterpreteService } from './interprete.service';
import { CustoService } from './custo.service';
import { CatalogoService, InterpreteLexico } from './interprete-lexico';
import { IndicadoresModule } from '../indicadores/indicadores.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [IndicadoresModule, AuditoriaModule],
  controllers: [XinguController],
  providers: [OrquestradorService, InterpreteService, CustoService, CatalogoService, InterpreteLexico],
})
export class XinguModule {}
