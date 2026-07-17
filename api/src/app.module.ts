import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { TerritorioModule } from './territorio/territorio.module';
import { TaxonomiaModule } from './taxonomia/taxonomia.module';
import { IndicadoresModule } from './indicadores/indicadores.module';
import { AdminModule } from './admin/admin.module';
import { TransparenciaModule } from './transparencia/transparencia.module';
import { XinguModule } from './xingu/xingu.module';
import { ProducaoModule } from './producao/producao.module';
import { DireitosModule } from './direitos/direitos.module';
import { AgentesFonteModule } from './fontes/agentes-fonte.module';
import { SaudeController } from './common/saude.controller';

// Rate limit global: ativo em produção (ou forçado por RATE_LIMIT=1);
// desligado no dev/testes para não interferir na suíte e2e.
const rateLimitAtivo =
  process.env.NODE_ENV === 'production' || process.env.RATE_LIMIT === '1';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'curto', ttl: 1_000, limit: Number(process.env.RATE_LIMIT_SEG ?? 20) },
      { name: 'medio', ttl: 60_000, limit: Number(process.env.RATE_LIMIT_MIN ?? 300) },
    ]),
    DatabaseModule,
    AuditoriaModule,
    TerritorioModule,
    TaxonomiaModule,
    IndicadoresModule,
    AdminModule,
    TransparenciaModule,
    XinguModule,
    ProducaoModule,
    DireitosModule,
    AgentesFonteModule,
  ],
  controllers: [SaudeController],
  providers: rateLimitAtivo ? [{ provide: APP_GUARD, useClass: ThrottlerGuard }] : [],
})
export class AppModule {}
