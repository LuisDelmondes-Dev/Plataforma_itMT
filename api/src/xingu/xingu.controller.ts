import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';
import { OrquestradorService } from './orquestrador.service';

interface PerguntaDto {
  pergunta: string;
  contexto?: { indicador_id?: number; codigo_ibge?: string };
}

@Controller('xingu')
export class XinguController {
  constructor(private readonly orquestrador: OrquestradorService) {}

  /** RF-CHAT-001 (texto): POST /v1/xingu/pergunta */
  @Post('pergunta')
  perguntar(@Body() dto: PerguntaDto, @Headers('x-xingu-sabotar') sabotar?: string) {
    if (!dto?.pergunta || typeof dto.pergunta !== 'string' || dto.pergunta.length > 1000) {
      throw new BadRequestException('Envie { pergunta: string } com até 1000 caracteres.');
    }
    return this.orquestrador.perguntar(
      dto.pergunta,
      dto.contexto,
      sabotar === '1', // gancho de teste do veto A06 (inerte em produção)
    );
  }
}
