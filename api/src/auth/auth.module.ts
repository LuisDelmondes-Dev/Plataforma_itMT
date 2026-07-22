import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AgentExecutionService } from './agent-execution.service';
import { PapeisGuard } from './papeis.guard';

// Global: o AgentExecutionService (registry) é injetado por agentes em
// vários módulos (Xingú, F5) sem reimportar.
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AgentExecutionService, PapeisGuard],
  exports: [AuthService, AgentExecutionService, PapeisGuard],
})
export class AuthModule {}
