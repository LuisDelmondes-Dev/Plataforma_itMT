import { BadRequestException, Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { OrquestradorService } from './orquestrador.service';
import { InterpreteService } from './interprete.service';

interface PerguntaDto {
  pergunta: string;
  contexto?: { indicador_id?: number; codigo_ibge?: string };
}

@Controller('xingu')
export class XinguController {
  constructor(
    private readonly orquestrador: OrquestradorService,
    private readonly interprete: InterpreteService,
  ) {}

  /**
   * Autodiagnóstico do provedor LLM: mostra se a chave está carregada e,
   * com um ping mínimo, POR QUE o LLM está (ou não) ativo — ex.: conta
   * sem créditos. O léxico (RG-05) segue funcionando em qualquer caso.
   */
  @Get('situacao')
  async situacao() {
    const provedor = this.interprete.provedor;
    const base = {
      provedor: provedor.nome(),
      chave_carregada: Boolean(process.env.ANTHROPIC_API_KEY),
    };
    if (!provedor.disponivel()) {
      return { ...base, llm: 'INATIVO', detalhe: 'Sem chave: intérprete léxico determinístico (RG-05).' };
    }
    try {
      await provedor.completar('Responda apenas: ok', 'ok');
      return { ...base, llm: 'ATIVO', detalhe: 'Provedor respondendo normalmente.' };
    } catch (e) {
      return { ...base, llm: 'DEGRADADO', detalhe: (e as Error).message };
    }
  }

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
