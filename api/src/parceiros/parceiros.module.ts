import { Module } from '@nestjs/common';
import { ParceirosController } from './parceiros.controller';
import { PapeisGuard } from '../auth/papeis.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ApiKeysController } from './api-keys.controller';
import { IntegracoesController } from './integracoes.controller';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService } from './api-keys.service';
import { TaxonomiaModule } from '../taxonomia/taxonomia.module';
import { IndicadoresModule } from '../indicadores/indicadores.module';

@Module({
  imports: [AuditoriaModule, TaxonomiaModule, IndicadoresModule],
  controllers: [ParceirosController, ApiKeysController, IntegracoesController],
  providers: [PapeisGuard, ApiKeyGuard, ApiKeysService],
})
export class ParceirosModule {}
