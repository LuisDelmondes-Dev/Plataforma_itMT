import { Module } from '@nestjs/common';
import { AdminController, AdminGuard } from './admin.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
