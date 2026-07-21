import { BadRequestException, Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { OrquestradorService } from './orquestrador.service';
import { InterpreteService, ProvedorEmCascata, ProvedorLlm, RefLlm } from './interprete.service';
import { CustoService } from './custo.service';

interface PerguntaDto {
  pergunta: string;
  contexto?: { indicador_id?: number; codigo_ibge?: string };
}

@Controller('xingu')
export class XinguController {
  constructor(
    private readonly orquestrador: OrquestradorService,
    private readonly interprete: InterpreteService,
    private readonly custo: CustoService,
  ) {}

  /** A15: consumo do LLM (dia/mês) vs teto. */
  @Get('custo')
  custoDoLlm() {
    return this.custo.resumo();
  }

  // Cache do autodiagnóstico: o ping consome tokens em cada provedor, então
  // GETs repetidos (ex.: banner da UI) reusam o resultado por 60s.
  private situacaoCache: { quando: number; valor: unknown } | null = null;
  private static readonly SITUACAO_TTL_MS = 60_000;

  /**
   * Autodiagnóstico do provedor LLM: mostra se a chave está carregada e,
   * com um ping mínimo, POR QUE o LLM está (ou não) ativo — ex.: conta
   * sem créditos. O léxico (RG-05) segue funcionando em qualquer caso.
   * Memoizado por 60s (o ping é billável).
   */
  @Get('situacao')
  async situacao() {
    const agora = Date.now();
    if (this.situacaoCache && agora - this.situacaoCache.quando < XinguController.SITUACAO_TTL_MS) {
      return this.situacaoCache.valor;
    }
    const valor = await this.calcularSituacao();
    this.situacaoCache = { quando: agora, valor };
    return valor;
  }

  private async calcularSituacao() {
    const provedor = this.interprete.provedor;
    const membros: ProvedorLlm[] =
      provedor instanceof ProvedorEmCascata ? provedor.membros : [provedor];

    const provedores = await Promise.all(
      membros.map(async (m) => {
        if (!m.disponivel()) return { provedor: m.nome(), llm: 'INATIVO', detalhe: 'Sem chave carregada.' };
        try {
          const ref: RefLlm = {};
          await m.completar('Responda apenas: ok', 'ok', ref);
          await this.custo.registrar('SITUACAO', m.nome(), ref.tokensEntrada, ref.tokensSaida);
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
      custo: await this.custo.resumo(),
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
