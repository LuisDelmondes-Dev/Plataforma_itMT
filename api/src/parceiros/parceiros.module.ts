import { Module } from '@nestjs/common';
import { ParceirosController } from './parceiros.controller';
import { PapeisGuard } from '../auth/papeis.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [ParceirosController],
  providers: [PapeisGuard],
})
export class ParceirosModule {}
