import { Module } from '@nestjs/common';
import { GeoAdminController, GeoPublicoController } from './geo.controller';
import { MidiaAdminController, MidiaPublicoController, CampoController } from './producao.controller';
import { AdminGuard } from '../admin/admin.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [
    GeoAdminController, GeoPublicoController,
    MidiaAdminController, MidiaPublicoController,
    CampoController,
  ],
  providers: [AdminGuard],
})
export class ProducaoModule {}
