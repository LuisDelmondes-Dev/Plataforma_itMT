import { Global, Injectable, MiddlewareConsumer, Module, NestMiddleware, NestModule } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ObservabilityService {
  private requests = 0;
  private errors = 0;
  private durationMs = 0;
  private inflight = 0;
  private readonly startedAt = Date.now();

  start() { this.inflight++; return Date.now(); }
  finish(started: number, status: number) {
    this.inflight = Math.max(0, this.inflight - 1);
    this.requests++;
    if (status >= 500) this.errors++;
    this.durationMs += Date.now() - started;
  }
  prometheus() {
    return [
      '# TYPE itmt_http_requests_total counter', `itmt_http_requests_total ${this.requests}`,
      '# TYPE itmt_http_errors_total counter', `itmt_http_errors_total ${this.errors}`,
      '# TYPE itmt_http_request_duration_ms_total counter', `itmt_http_request_duration_ms_total ${this.durationMs}`,
      '# TYPE itmt_http_requests_inflight gauge', `itmt_http_requests_inflight ${this.inflight}`,
      '# TYPE itmt_process_uptime_seconds gauge', `itmt_process_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1000)}`,
    ].join('\n');
  }
}

@Injectable()
export class ObservabilityMiddleware implements NestMiddleware {
  constructor(private readonly metrics: ObservabilityService) {}
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = String(req.headers['x-request-id'] ?? randomUUID()).slice(0, 128);
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    const started = this.metrics.start();
    res.once('finish', () => this.metrics.finish(started, res.statusCode));
    next();
  }
}

@Global()
@Module({ providers: [ObservabilityService, ObservabilityMiddleware], exports: [ObservabilityService] })
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) { consumer.apply(ObservabilityMiddleware).forRoutes('*'); }
}
