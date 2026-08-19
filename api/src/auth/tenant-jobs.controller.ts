import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TenantContextGuard, TenantRequest } from './tenant-context.guard';
import { TenantJobsService } from './tenant-jobs.service';

@Controller('organizacoes/:organizationId/jobs')
@UseGuards(TenantContextGuard)
export class TenantJobsController {
  constructor(private readonly jobs: TenantJobsService) {}

  @Post()
  criar(@Req() req: TenantRequest, @Body() dto: { tipo: string; recurso_id: string; payload?: unknown; idempotency_key: string }) {
    return this.jobs.enfileirar(req.tenantContext!, dto);
  }

  @Get(':jobId')
  obter(@Req() req: TenantRequest, @Param('jobId') jobId: string) {
    return this.jobs.obter(req.tenantContext!, jobId);
  }
}
