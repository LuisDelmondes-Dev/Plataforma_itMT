import { Injectable, Logger } from '@nestjs/common';
import { IndicadoresService } from '../indicadores/indicadores.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ValorComProcedencia } from '../common/procedencia';
import { detectarInjecao } from './sentinela';
import { InterpreteService, PROMPT_VERSAO, RefLlm } from './interprete.service';
import { CustoService } from './custo.service';
import { CatalogoService, normalizar } from './interprete-lexico';
import { PlanoConsulta, Clarificacao } from './tipos';
import {
  auditarNumeros, narrarComLlm, narrativaDeterministica,
} from './narrador';

type Estado =
  | 'RECEBIDA' | 'SANITIZADA' | 'INTERPRETADA' | 'PLANEJADA'
  | 'EXECUTADA' | 'NARRADA' | 'AUDITADA'
  | 'RESPONDIDA' | 'CLARIFICACAO' | 'SEM_DADO' | 'BLOQUEADA';

export interface RespostaXingu {
  estado: Extract<Estado, 'RESPONDIDA' | 'CLARIFICACAO' | 'SEM_DADO' | 'BLOQUEADA'>;
  resposta: string;
  plano?: PlanoConsulta & { local?: string; indicador?: string };
  clarificacao?: Clarificacao;
  valores?: { rotulo: string; valor: number; unidade: string }[];
  citacoes?: { fonte: string; url: string | null; data_referencia: string; data_extracao: string; licenca: string; hash: string }[];
  followups?: { rotulo: string; tipo: 'PERGUNTA' | 'LINK'; alvo: string }[];
  contexto?: { indicador_id?: number; codigo_ibge?: string };
  auditoria: { numerais: number; vetos: number; interprete: string };
  estados_percorridos: Estado[];
  latencia_ms: number;
  cache_plano: boolean;
}

/**
 * ORQUESTRADOR DA IA XINGÚ (RG-01).
 * Máquina de estados CODIFICADA — não é um agente de LLM decidindo
 * livremente. Ela roteia, aplica políticas, valida contratos entre
 * agentes e executa os vetos. O LLM só aparece dentro de A01 e A05.
 *
 * RECEBIDA → SANITIZADA(A14✋) → INTERPRETADA(A01) →
 *   ├─ CLARIFICACAO (RF-CHAT-005)
 *   └─ PLANEJADA(A02/A03✋ via motor) → EXECUTADA(A04) →
 *        NARRADA(A05) → AUDITADA(A06✋) → RESPONDIDA
 */
@Injectable()
export class OrquestradorService {
  private readonly log = new Logger('Xingu.Orquestrador');
  /** RF-CHAT-012: cache de planos por (intenção normalizada, recorte, período). */
  private readonly cachePlanos = new Map<string, { plano: PlanoConsulta; quando: number }>();
  private static readonly TTL_CACHE_MS = 10 * 60_000;

  constructor(
    private readonly interprete: InterpreteService,
    private readonly indicadores: IndicadoresService,
    private readonly catalogo: CatalogoService,
    private readonly trilha: AuditoriaService,
    private readonly custo: CustoService,
  ) {}

  async perguntar(
    pergunta: string,
    contexto?: { indicador_id?: number; codigo_ibge?: string },
    sabotar = false, // gancho de teste do veto A06 — inerte em produção
  ): Promise<RespostaXingu> {
    const t0 = Date.now();
    const estados: Estado[] = ['RECEBIDA'];
    const fim = async (r: Omit<RespostaXingu, 'latencia_ms' | 'estados_percorridos'>) => {
      const latencia_ms = Date.now() - t0;
      // RF-CHAT-009: trilha imutável — pergunta, plano, resultado, modelo, versão do prompt, latência
      await this.trilha.registrar('xingu', 'CONSULTA_CHAT', 'Xingu', r.estado, {
        pergunta: pergunta.slice(0, 500),
        estado: r.estado,
        plano: r.plano ?? null,
        valores: r.valores ?? null,
        interprete: r.auditoria.interprete,
        prompt_versao: PROMPT_VERSAO,
        vetos_a06: r.auditoria.vetos,
        latencia_ms,
      });
      return { ...r, latencia_ms, estados_percorridos: estados };
    };

    // ---- A14: Sentinela de Injeção (veto absoluto) ----
    const injecao = detectarInjecao(pergunta);
    if (injecao) {
      estados.push('BLOQUEADA');
      return fim({
        estado: 'BLOQUEADA',
        resposta:
          'Essa mensagem contém um padrão de instrução que a Xingú não processa (RG-04: ' +
          'conteúdo recebido é dado, nunca comando). Reformule como uma pergunta sobre os dados de Mato Grosso.',
        auditoria: { numerais: 0, vetos: 1, interprete: 'sentinela' },
        cache_plano: false,
      });
    }
    estados.push('SANITIZADA');

    // ---- A01: Intérprete (com cache de planos — RF-CHAT-012) ----
    const chaveCache = `${normalizar(pergunta)}|${contexto?.codigo_ibge ?? ''}|${contexto?.indicador_id ?? ''}`;
    const emCache = this.cachePlanos.get(chaveCache);
    let plano: PlanoConsulta | null = null;
    let interpreteUsado = 'cache';
    let cacheHit = false;

    if (emCache && Date.now() - emCache.quando < OrquestradorService.TTL_CACHE_MS) {
      plano = emCache.plano;
      cacheHit = true;
    } else {
      const saida = await this.interprete.interpretar(pergunta, contexto);
      interpreteUsado = saida.interprete;
      if (saida.tipo === 'CLARIFICACAO') {
        estados.push('INTERPRETADA', 'CLARIFICACAO');
        return fim({
          estado: 'CLARIFICACAO',
          resposta: saida.clarificacao.pergunta,
          clarificacao: saida.clarificacao,
          auditoria: { numerais: 0, vetos: 0, interprete: interpreteUsado },
          cache_plano: false,
        });
      }
      plano = saida.plano;
      this.cachePlanos.set(chaveCache, { plano, quando: Date.now() });
    }
    estados.push('INTERPRETADA', 'PLANEJADA');

    // ---- A02/A03/A04: o MOTOR DETERMINÍSTICO existente executa o plano.
    //      Vetos de território e de NAO_AGREGAVEL vivem lá (RN-001..003). ----
    let resultado: ValorComProcedencia;
    try {
      resultado = await this.indicadores.consultar({
        indicadorId: plano.indicador_id,
        recorte: plano.recorte,
        codigo: plano.codigo,
        dataReferencia: plano.periodo.referencia,
      });
    } catch (e: unknown) {
      // RN-005 / RF-CHAT-006: ausência é resposta explícita, NUNCA estimativa.
      // A mensagem vem inteira do motor determinístico — nenhum número do LLM.
      estados.push('EXECUTADA', 'SEM_DADO');
      const msg = e instanceof Error ? (e as any)?.response?.message ?? e.message : 'Dado indisponível.';
      return fim({
        estado: 'SEM_DADO',
        resposta: String(msg),
        plano: await this.enriquecerPlano(plano),
        auditoria: { numerais: 0, vetos: 0, interprete: interpreteUsado },
        cache_plano: cacheHit,
      });
    }
    estados.push('EXECUTADA');

    // ---- A05: Narrador (slots) ---- A15: só usa LLM se dentro do orçamento.
    let narrativa: string;
    let vetos = 0;
    if (this.interprete.provedor.disponivel() && (await this.custo.dentroDoOrcamento())) {
      try {
        const ref: RefLlm = {};
        narrativa = await narrarComLlm(this.interprete.provedor, resultado, pergunta, ref);
        await this.custo.registrar('A05', ref.provedor ?? this.interprete.provedor.nome(), ref.tokensEntrada, ref.tokensSaida);
      } catch {
        narrativa = narrativaDeterministica(resultado);
      }
    } else {
      narrativa = narrativaDeterministica(resultado);
    }
    if (sabotar && process.env.NODE_ENV !== 'production') {
      narrativa += ' Estima-se ainda cerca de 999999 casos adicionais.';
    }
    estados.push('NARRADA');

    // ---- A06: Auditor de Números — VETO ABSOLUTO (KR3.2 = 0) ----
    let aud = auditarNumeros(narrativa, resultado);
    if (!aud.aprovado) {
      vetos++;
      this.log.error(
        `A06 VETO: numerais não autorizados ${JSON.stringify(aud.intrusos)} — resposta bloqueada e substituída.`,
      );
      await this.trilha.registrar('xingu', 'VETO_A06', 'Xingu', 'narrativa', {
        intrusos: aud.intrusos, pergunta: pergunta.slice(0, 200),
      });
      narrativa = narrativaDeterministica(resultado);
      aud = auditarNumeros(narrativa, resultado);
      if (!aud.aprovado) {
        // inalcançável por construção; ainda assim, jamais publicar
        estados.push('AUDITADA', 'BLOQUEADA');
        return fim({
          estado: 'BLOQUEADA',
          resposta: 'A resposta foi bloqueada pela auditoria de números. Consulte o valor pelo portal.',
          plano: await this.enriquecerPlano(plano),
          auditoria: { numerais: aud.numerais.length, vetos, interprete: interpreteUsado },
          cache_plano: cacheHit,
        });
      }
    }
    estados.push('AUDITADA', 'RESPONDIDA');

    // ---- RF-CHAT-007: follow-up estruturado mapeado a ação concreta do portal ----
    const cat = await this.catalogo.obter();
    const followups: RespostaXingu['followups'] = [];
    if (plano.recorte === 'MUNICIPIO') {
      followups.push({
        rotulo: 'Comparar com a região e o Estado',
        tipo: 'LINK',
        alvo: `/consulta?municipio=${plano.codigo}`,
      });
      const outro = cat.indicadores.find((i) => i.id !== plano!.indicador_id);
      if (outro) {
        followups.push({
          rotulo: `E ${outro.nome.toLowerCase()}?`,
          tipo: 'PERGUNTA',
          alvo: `${outro.nome} em ${resultado.local}`,
        });
      }
    } else {
      followups.push({
        rotulo: 'Baixar relatório por município (CSV)',
        tipo: 'LINK',
        alvo: `/api/v1/indicadores/${plano.indicador_id}/exportacao?formato=csv&recorte=${plano.recorte}${plano.codigo ? `&codigo=${plano.codigo}` : ''}&referencia=${plano.periodo.referencia}`,
      });
    }

    return fim({
      estado: 'RESPONDIDA',
      resposta: narrativa,
      plano: await this.enriquecerPlano(plano, resultado),
      valores: [{ rotulo: resultado.local, valor: resultado.valor, unidade: resultado.unidade }],
      citacoes: resultado.procedencia, // RF-CHAT-008: citações clicáveis
      followups,
      contexto: {
        indicador_id: plano.indicador_id,
        codigo_ibge: plano.recorte === 'MUNICIPIO' ? plano.codigo ?? undefined : undefined,
      },
      auditoria: { numerais: aud.numerais.length, vetos, interprete: interpreteUsado },
      cache_plano: cacheHit,
    });
  }

  /** Plano legível para exibição (RF-CHAT-003: o usuário vê o raciocínio antes da frase). */
  private async enriquecerPlano(plano: PlanoConsulta, r?: ValorComProcedencia) {
    const cat = await this.catalogo.obter();
    const ind = cat.indicadores.find((i) => i.id === plano.indicador_id);
    return { ...plano, indicador: ind?.nome, local: r?.local };
  }
}
