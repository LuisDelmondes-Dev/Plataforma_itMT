import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { TerritorioModule } from './territorio/territorio.module';
import { TaxonomiaModule } from './taxonomia/taxonomia.module';
import { IndicadoresModule } from './indicadores/indicadores.module';
import { AdminModule } from './admin/admin.module';
import { TransparenciaModule } from './transparencia/transparencia.module';
import { XinguModule } from './xingu/xingu.module';
import { ProducaoModule } from './producao/producao.module';

@Module({
  imports: [
    DatabaseModule,
    AuditoriaModule,
    TerritorioModule,
    TaxonomiaModule,
    IndicadoresModule,
    AdminModule,
    TransparenciaModule,
    XinguModule,
    ProducaoModule,
  ],
})
export class AppModule {}
