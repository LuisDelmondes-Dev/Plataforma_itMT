import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService, EscopoApi } from './api-keys.service';

const ESCOPOS_CHAVE = 'api_escopos_exigidos';
export const EscoposApi = (...escopos: EscopoApi[]) => SetMetadata(ESCOPOS_CHAVE, escopos);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly chaves: ApiKeysService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const direta = String(req.headers['x-api-key'] ?? '');
    const auth = String(req.headers.authorization ?? '');
    const chave = direta || (auth.startsWith('ApiKey ') ? auth.slice(7) : '');
    const escopos = this.reflector.getAllAndOverride<EscopoApi[]>(ESCOPOS_CHAVE, [
      ctx.getHandler(), ctx.getClass(),
    ]) ?? [];
    req.apiCliente = await this.chaves.consumir(chave, escopos);
    return true;
  }
}

