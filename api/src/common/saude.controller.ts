import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DatabaseService } from '../database/database.service';

/** Healthcheck para orquestrador/proxy: processo vivo E banco acessível. */
@Controller('saude')
@SkipThrottle()
export class SaudeController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async saude() {
    return this.readiness();
  }

  /** Liveness não depende de serviços externos: processo e event loop respondem. */
  @Get('live')
  liveness() {
    return { ok: true, processo: 'vivo' };
  }

  /** Readiness só passa quando o banco necessário ao tráfego está acessível. */
  @Get('ready')
  async readiness() {
    try {
      await this.db.query('SELECT 1');
      return { ok: true, pronto: true, banco: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ ok: false, pronto: false, banco: 'indisponivel' });
    }
  }
}
