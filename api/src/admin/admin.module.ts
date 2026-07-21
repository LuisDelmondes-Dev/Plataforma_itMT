import { Module } from '@nestjs/common';
import { AdminController, AdminGuard } from './admin.controller';
import { ValidacaoTecnicaService } from './validacao-tecnica.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [AdminController],
  providers: [AdminGuard, ValidacaoTecnicaService],
})
export class AdminModule {}
