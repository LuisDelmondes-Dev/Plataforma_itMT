import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AgentExecutionService } from './agent-execution.service';
import { PapeisGuard } from './papeis.guard';
import { TenantContextGuard } from './tenant-context.guard';
import { ComercialController, OrganizacoesController } from './organizacoes.controller';
import { OrganizacoesService } from './organizacoes.service';
import { TenantCacheService } from './tenant-cache.service';
import { TenantObjectStorageService } from './tenant-object-storage.service';
import { TenantJobsService } from './tenant-jobs.service';
import { TenantJobsController } from './tenant-jobs.controller';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor';

// Global: o AgentExecutionService (registry) é injetado por agentes em
// vários módulos (Xingú, F5) sem reimportar.
@Global()
@Module({
  controllers: [AuthController, OrganizacoesController, ComercialController, TenantJobsController],
  providers: [
    AuthService, AgentExecutionService, PapeisGuard, TenantContextGuard, OrganizacoesService,
    TenantCacheService, TenantObjectStorageService, TenantJobsService,
    TenantTransactionInterceptor,
  ],
  exports: [AuthService, AgentExecutionService, PapeisGuard, TenantContextGuard, TenantTransactionInterceptor, TenantObjectStorageService],
})
export class AuthModule {}
