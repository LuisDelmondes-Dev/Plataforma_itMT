import { Module } from '@nestjs/common';
import { XinguController } from './xingu.controller';
import { OrquestradorService } from './orquestrador.service';
import { InterpreteService } from './interprete.service';
import { CustoService } from './custo.service';
import { CatalogoService, InterpreteLexico } from './interprete-lexico';
import { IndicadoresModule } from '../indicadores/indicadores.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PesquisasModule } from '../pesquisas/pesquisas.module';
import { AgentExecutorService } from './agent-executor.service';
import { SugestoesService } from './sugestoes.service';
import { GanchoTesteNarrativa, GanchoInerte, GanchoSabotagemA06 } from './gancho-teste';

@Module({
  // PesquisasModule: a persistência da pesquisa é PARTE da execução (P4).
  imports: [IndicadoresModule, AuditoriaModule, PesquisasModule],
  controllers: [XinguController],
  providers: [
    OrquestradorService, InterpreteService, CustoService, CatalogoService,
    InterpreteLexico, AgentExecutorService,
    // A16 (P7): dossiê de sugestões determinístico — RG-09, dossiê não decisão.
    SugestoesService,
    // A sabotagem que prova o veto A06 só é fiada em NODE_ENV=test;
    // qualquer outro ambiente compõe o no-op (ver gancho-teste.ts).
    {
      provide: GanchoTesteNarrativa,
      useClass: process.env.NODE_ENV === 'test' ? GanchoSabotagemA06 : GanchoInerte,
    },
  ],
})
export class XinguModule {}
