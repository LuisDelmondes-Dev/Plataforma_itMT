import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { DatabaseService, PLATFORM_PUBLIC_CONTEXT } from '../database/database.service';
import { PesquisasService } from './pesquisas.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Superfície pública de LEITURA das pesquisas persistidas (Gauntlet P1).
 * Não existe POST: quem grava é o orquestrador/motor chamando
 * PesquisasService.gravar() dentro da própria execução (integração na P4).
 * Rotas públicas operam no contexto plataforma (mesmo padrão do XinguController);
 * o RLS fail-closed garante que nada fora desse contexto seja lido.
 */
@Controller('pesquisas')
export class PesquisasController {
  constructor(
    private readonly pesquisas: PesquisasService,
    private readonly db: DatabaseService,
  ) {}

  /** Lista resumida recente: GET /v1/pesquisas?limite=20 */
  @Get()
  listar(@Query('limite') limite?: string) {
    const n = limite === undefined ? 20 : Number(limite);
    if (!Number.isFinite(n) || n < 1 || n > 100)
      throw new BadRequestException('limite deve ser um inteiro entre 1 e 100.');
    return this.db.withTenantTransaction(PLATFORM_PUBLIC_CONTEXT, () => this.pesquisas.listar(n));
  }

  /**
   * Reabre a pesquisa idêntica, reconstruída SÓ do banco (sem motor/LLM):
   * GET /v1/pesquisas/:id
   */
  @Get(':id')
  reabrir(@Param('id') id: string) {
    if (!UUID.test(id))
      throw new BadRequestException('Identificador de pesquisa inválido (uuid esperado).');
    return this.db.withTenantTransaction(PLATFORM_PUBLIC_CONTEXT, () => this.pesquisas.reabrir(id));
  }
}
