import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AgentExecutionService } from './agent-execution.service';

// Global: o AgentExecutionService (registry) é injetado por agentes em
// vários módulos (Xingú, F5) sem reimportar.
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AgentExecutionService],
  exports: [AuthService, AgentExecutionService],
})
export class AuthModule {}
