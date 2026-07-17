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
    try {
      await this.db.query('SELECT 1');
      return { ok: true, banco: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ ok: false, banco: 'indisponivel' });
    }
  }
}
