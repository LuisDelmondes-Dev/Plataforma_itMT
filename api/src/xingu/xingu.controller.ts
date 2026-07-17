import { BadRequestException, Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { OrquestradorService } from './orquestrador.service';
import { InterpreteService, ProvedorEmCascata, ProvedorLlm } from './interprete.service';

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
    const membros: ProvedorLlm[] =
      provedor instanceof ProvedorEmCascata ? provedor.membros : [provedor];

    const provedores = await Promise.all(
      membros.map(async (m) => {
        if (!m.disponivel()) return { provedor: m.nome(), llm: 'INATIVO', detalhe: 'Sem chave carregada.' };
        try {
          await m.completar('Responda apenas: ok', 'ok');
          return { provedor: m.nome(), llm: 'ATIVO', detalhe: 'Respondendo normalmente.' };
        } catch (e) {
          return { provedor: m.nome(), llm: 'DEGRADADO', detalhe: (e as Error).message };
        }
      }),
    );
    const algumAtivo = provedores.some((p) => p.llm === 'ATIVO');
    return {
      modo: provedor instanceof ProvedorEmCascata
        ? 'CASCATA (um provedor auxilia o outro; léxico como última linha — RG-05)'
        : provedor.disponivel() ? 'PROVEDOR ÚNICO' : 'LÉXICO (RG-05)',
      llm: algumAtivo ? 'ATIVO' : provedor.disponivel() ? 'DEGRADADO (todos os provedores falhando; léxico assume)' : 'INATIVO',
      chaves_carregadas: {
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
      },
      provedores,
    };
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
