import { Injectable, Logger } from '@nestjs/common';
import { Causas, IndicadoresService, Ranking, RankingMunicipio } from '../indicadores/indicadores.service';
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
import { AgentExecutorService } from './agent-executor.service';
import { GanchoTesteNarrativa } from './gancho-teste';
import { CONTRATO_A01_INTERPRETE, CONTRATO_A04_EXECUTOR, CONTRATO_A05_NARRADOR, CONTRATO_A06_AUDITOR, CONTRATO_A16_SUGESTOES } from './contracts';
import { REGIAO } from '../config/regiao';
import { SaidaSugestoes, Sugestao, SugestoesService } from './sugestoes.service';
import {
  ModoPesquisa, PesquisasService, SnapshotDashboard, SnapshotExecucaoAgente,
  SnapshotFonte, SnapshotIndicador, SnapshotSugestao, TipoDashboard, VERSAO_MOTOR,
} from '../pesquisas/pesquisas.service';

type Estado =
  | 'RECEBIDA' | 'SANITIZADA' | 'INTERPRETADA' | 'PLANEJADA'
  | 'EXECUTADA' | 'NARRADA' | 'AUDITADA'
  | 'RESPONDIDA' | 'CLARIFICACAO' | 'SEM_DADO' | 'BLOQUEADA';

/**
 * RN-MODO (Gauntlet P4) — contrato do modo 'pesquisa': o ranking do motor
 * REDUZIDO ao essencial (agregados estaduais, total de ausentes e só as
 * linhas top-N). `tabela_completa: true` sinaliza que o ranking cheio está
 * a um GET de distância no endpoint público da P2 — rápido e completo,
 * sem excesso no payload da resposta.
 */
export interface RankingTop {
  indicador: string;
  unidade: string;
  referencia: string;
  agregacao: Ranking['agregacao'];
  media_estadual: number | null;
  total_estadual: number | null;
  total_municipios: number;
  ausentes: { total: number };
  /** Apenas as linhas top-N (procedência por linha preservada — §12.1). */
  municipios: RankingMunicipio[];
  /** O front pode pedir o ranking cheio em GET /v1/indicadores/:id/ranking (P2). */
  tabela_completa: true;
}

/**
 * Contrato do modo 'xingu': o dossiê explicativo. TODO conteúdo é JSON do
 * motor determinístico (RG-03: o dossiê não passa por LLM). Blocos ainda
 * sem dado declaram a lacuna com motivo (RN-005) — nunca são inventados.
 */
export interface DossieXingu {
  /** Ranking COMPLETO: todos os municípios com posição e delta vs média. */
  ranking: Ranking;
  serie: { indicador: string; unidade: string; local: string; pontos: { ano: number; valor: number }[] };
  /** Só para recorte MUNICIPIO (comparação município×RGI×RGInt×Estado). */
  comparacao: unknown | null;
  comparacao_motivo?: string;
  /**
   * Decomposição por causa do MOTOR (P3): presente quando existe fonte de
   * causas para o indicador/recorte; senão null + motivo (RN-005).
   */
  causas: Causas | null;
  causas_motivo?: string;
  /**
   * Dossiê de sugestões do A16 (P7) — RG-09: dossiê, não decisão. Cada
   * sugestão cita prática reconhecida do catálogo (db/51) e aponta por
   * `origem` (e por FK na persistência) o dado do motor que a motivou.
   * Vazio + motivo quando nenhum gatilho determinístico dispara.
   */
  sugestoes: Sugestao[];
  sugestoes_motivo?: string;
}

export interface RespostaXingu {
  estado: Extract<Estado, 'RESPONDIDA' | 'CLARIFICACAO' | 'SEM_DADO' | 'BLOQUEADA'>;
  /** RN-MODO (P4): o modo que moldou ESTA resposta. */
  modo: ModoPesquisa;
  /** Toda execução é persistida (P1/P4); este é o uuid para reabertura em GET /v1/pesquisas/:id. */
  pesquisa_id: string;
  resposta: string;
  plano?: PlanoConsulta & { local?: string; indicador?: string };
  clarificacao?: Clarificacao;
  valores?: { rotulo: string; valor: number; unidade: string }[];
  // E3: status_dado viaja na citação quando conhecido — o dossiê exibe o selo
  // "dado preliminar" SEM gerar texto/numeral novo (RG-03 intacto: nada disso
  // passa pelo narrador A05 nem escapa ao auditor A06).
  citacoes?: { fonte: string; url: string | null; data_referencia: string; data_extracao: string; licenca: string; hash: string; status_dado?: 'PRELIMINAR' | 'CONSOLIDADO' | 'REVISADO' }[];
  followups?: { rotulo: string; tipo: 'PERGUNTA' | 'LINK'; alvo: string }[];
  contexto?: { indicador_id?: number; codigo_ibge?: string };
  /** Presente só no modo 'pesquisa' com estado RESPONDIDA. */
  ranking_top?: RankingTop;
  /** Presente só no modo 'xingu' com estado RESPONDIDA. */
  dossie?: DossieXingu;
  auditoria: { numerais: number; vetos: number; interprete: string };
  estados_percorridos: Estado[];
  latencia_ms: number;
  cache_plano: boolean;
}

/**
 * RN-005 aplicada ao bloco de causas do dossiê: quando o motor não tem
 * decomposição para este indicador/recorte, o motivo carrega o CONTEXTO que
 * o próprio motor devolveu (quais fontes/dimensões existem) — nunca um bloco
 * inventado. Fontes de decomposição alimentam o bloco quando carregadas e
 * aprovadas (RG-09). O texto é genérico por área (crítico P9: o exemplo
 * "SIM/CID-10" vazava para dossiês de educação/finanças).
 */
function causasMotivo(detalhe: string): string {
  return (
    'Decomposição por causa ainda não disponível para este indicador/recorte — ' +
    `${detalhe} Fontes de decomposição alimentam este bloco quando ` +
    'carregadas e aprovadas (RG-09); até lá a ausência é declarada, nunca preenchida (RN-005).'
  );
}

const SUGESTOES_SEM_GATILHO =
  'Nenhum gatilho de gestão disparou para este recorte/dado: sem desvio desfavorável frente à ' +
  'média, sem tendência na série, sem causa dominante e sem lacuna de cobertura — não há ' +
  'subsídio a fabricar (RG-09: dossiê, não decisão).';

const SUGESTOES_FALHA_A16 =
  'O agente de sugestões (A16) falhou nesta execução; o dossiê numérico permanece válido e ' +
  'nenhuma sugestão parcial é exibida (fail-closed).';

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
 *
 * P4 (RN-MODO): o modo ('pesquisa'|'xingu') NÃO muda o pipeline acima —
 * muda apenas a MONTAGEM da resposta (ranking_top vs dossie). P1/P4: toda
 * resposta é persistida via PesquisasService ANTES de ser devolvida; falha
 * na gravação propaga (pesquisa não concluída).
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
    private readonly executor: AgentExecutorService,
    private readonly ganchoTeste: GanchoTesteNarrativa,
    private readonly pesquisas: PesquisasService,
    private readonly sugestoes: SugestoesService,
  ) {}

  async perguntar(
    pergunta: string,
    contexto?: { indicador_id?: number; codigo_ibge?: string },
    sabotar = false, // gancho de teste do veto A06 — só tem efeito com o provider de NODE_ENV=test (gancho-teste.ts)
    modo: ModoPesquisa = 'pesquisa', // ausente = 'pesquisa' (retrocompatibilidade dos consumidores existentes)
  ): Promise<RespostaXingu> {
    const t0 = Date.now();
    const estados: Estado[] = ['RECEBIDA'];
    // Etapas realmente executadas NESTA pesquisa (duração medida aqui, não
    // inventada) — vão para "PesquisaExecucaoAgente" na persistência (P8).
    const execucoes: SnapshotExecucaoAgente[] = [];

    /**
     * Fecho único de TODA resposta: persiste a pesquisa (parte da execução —
     * falha propaga), registra CONSULTA_CHAT com o pesquisa_id (correlação
     * P8) e devolve o envelope carimbado com modo + pesquisa_id.
     */
    const fim = async (
      r: Omit<RespostaXingu, 'modo' | 'pesquisa_id' | 'latencia_ms' | 'estados_percorridos'>,
      persistencia: {
        plano?: PlanoConsulta | null;
        indicadores?: SnapshotIndicador[];
        dashboards?: SnapshotDashboard[];
        sugestoes?: SnapshotSugestao[];
        fontes?: SnapshotFonte[];
      } = {},
    ): Promise<RespostaXingu> => {
      const latencia_ms = Date.now() - t0;
      const plano = persistencia.plano ?? null;
      const cat = plano ? await this.catalogo.obter() : null;
      const area = plano
        ? cat?.indicadores.find((i) => i.id === plano.indicador_id)?.tema ?? null
        : null;

      // P1/P4: a gravação FAZ PARTE da execução — sem snapshot, sem resposta.
      const { id: pesquisaId } = await this.pesquisas.gravar({
        modo,
        pergunta: pergunta.slice(0, 1000),
        area,
        // Sem plano (BLOQUEADA/CLARIFICACAO) não há recorte resolvido; o
        // schema exige um — ESTADO/null é o neutro honesto do portal.
        recorte: plano?.recorte ?? 'ESTADO',
        codigo: plano?.codigo ?? null,
        estado: r.estado,
        versaoMotor: VERSAO_MOTOR,
        indicadores: persistencia.indicadores ?? [],
        dashboards: persistencia.dashboards ?? [],
        sugestoes: persistencia.sugestoes ?? [], // P7: só o modo xingu produz (A16); pesquisa NUNCA
        fontes: persistencia.fontes ?? [],
        execucoes,
      });

      // RF-CHAT-009: trilha imutável — pergunta, plano, resultado, modelo,
      // versão do prompt, latência. P8: pesquisa_id correlaciona este
      // evento com "Pesquisa" (ver cabeçalho de pesquisas.service.ts).
      await this.trilha.registrar('xingu', 'CONSULTA_CHAT', 'Xingu', r.estado, {
        pergunta: pergunta.slice(0, 500),
        estado: r.estado,
        modo,
        pesquisa_id: pesquisaId,
        plano: r.plano ?? null,
        valores: r.valores ?? null,
        interprete: r.auditoria.interprete,
        prompt_versao: PROMPT_VERSAO,
        vetos_a06: r.auditoria.vetos,
        latencia_ms,
      });
      return { ...r, modo, pesquisa_id: pesquisaId, latencia_ms, estados_percorridos: estados };
    };

    // ---- A14: Sentinela de Injeção (veto absoluto) ----
    const injecao = detectarInjecao(pergunta);
    if (injecao) {
      estados.push('BLOQUEADA');
      return fim({
        estado: 'BLOQUEADA',
        resposta:
          'Essa mensagem contém um padrão de instrução que a Xingú não processa (RG-04: ' +
          `conteúdo recebido é dado, nunca comando). Reformule como uma pergunta sobre os dados de ${REGIAO.nome}.`,
        auditoria: { numerais: 0, vetos: 1, interprete: 'sentinela' },
        cache_plano: false,
      });
    }
    estados.push('SANITIZADA');

    // ---- A01: Intérprete (com cache de planos — RF-CHAT-012) ----
    // A chave NÃO inclui o modo, de propósito: o PLANO é idêntico nos dois
    // modos (mesma pergunta → mesmo recorte/indicador/período); o que varia
    // entre modos é só a MONTAGEM da resposta, feita depois, fora do cache.
    // Incluir o modo aqui só duplicaria entradas idênticas.
    const chaveCache = `${normalizar(pergunta)}|${contexto?.codigo_ibge ?? ''}|${contexto?.indicador_id ?? ''}`;
    const emCache = this.cachePlanos.get(chaveCache);
    let plano: PlanoConsulta | null = null;
    let interpreteUsado = 'cache';
    let cacheHit = false;

    if (emCache && Date.now() - emCache.quando < OrquestradorService.TTL_CACHE_MS) {
      plano = emCache.plano;
      cacheHit = true;
    } else {
      const tA01 = Date.now();
      const saida = await this.executor.executar(CONTRATO_A01_INTERPRETE, {
        input: { pergunta: pergunta.slice(0, 500), contexto: contexto ?? null },
        ferramenta: 'catalogo:ler',
        permissao: 'dados-publicos:ler',
        handler: () => this.interprete.interpretar(pergunta, contexto),
      });
      interpreteUsado = saida.interprete;
      execucoes.push({
        agente: 'A01', entrada: { pergunta: pergunta.slice(0, 200) },
        saida: { tipo: saida.tipo, interprete: saida.interprete },
        duracaoMs: Date.now() - tA01, ok: true,
      });
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
    const tA04 = Date.now();
    try {
      resultado = await this.executor.executar(CONTRATO_A04_EXECUTOR, {
        input: { plano }, ferramenta: 'motor-indicadores:consultar', permissao: 'dados-publicos:ler',
        idempotencyKey: chaveCache,
        handler: () => this.indicadores.consultar({
          indicadorId: plano.indicador_id,
          recorte: plano.recorte,
          codigo: plano.codigo,
          dataReferencia: plano.periodo.referencia,
        }),
      });
      execucoes.push({
        agente: 'A04', entrada: { plano },
        saida: { valor: resultado.valor, unidade: resultado.unidade },
        duracaoMs: Date.now() - tA04, ok: true,
      });
    } catch (e: unknown) {
      // RN-005 / RF-CHAT-006: ausência é resposta explícita, NUNCA estimativa.
      // A mensagem vem inteira do motor determinístico — nenhum número do LLM.
      // Nos DOIS modos: SEM_DADO segue SEM_DADO — sem ranking, sem dossiê.
      estados.push('EXECUTADA', 'SEM_DADO');
      const msg = e instanceof Error ? (e as any)?.response?.message ?? e.message : 'Dado indisponível.';
      execucoes.push({
        agente: 'A04', entrada: { plano }, saida: { erro: String(msg).slice(0, 300) },
        duracaoMs: Date.now() - tA04, ok: false,
      });
      return fim({
        estado: 'SEM_DADO',
        resposta: String(msg),
        plano: await this.enriquecerPlano(plano),
        auditoria: { numerais: 0, vetos: 0, interprete: interpreteUsado },
        cache_plano: cacheHit,
      }, { plano });
    }
    estados.push('EXECUTADA');

    // ---- A05: Narrador (slots) ---- A15: só usa LLM se dentro do orçamento.
    let narrativa: string;
    let vetos = 0;
    const tA05 = Date.now();
    const saidaNarrador = await this.executor.executar(CONTRATO_A05_NARRADOR, {
      input: { pergunta: pergunta.slice(0, 500), resultado },
      ferramenta: 'llm:narrar', permissao: 'dados-publicos:ler',
      handler: async () => {
        if (!this.interprete.provedor.disponivel() || !(await this.custo.dentroDoOrcamento()))
          return { narrativa: narrativaDeterministica(resultado) };
        const ref: RefLlm = {};
        const texto = await narrarComLlm(this.interprete.provedor, resultado, pergunta, ref);
        await this.custo.registrar('A05', ref.provedor ?? this.interprete.provedor.nome(), ref.tokensEntrada, ref.tokensSaida);
        return { narrativa: texto };
      },
      fallback: async () => ({ narrativa: narrativaDeterministica(resultado) }),
    });
    narrativa = this.ganchoTeste.aplicar(saidaNarrador.narrativa, sabotar);
    execucoes.push({
      agente: 'A05', entrada: { pergunta: pergunta.slice(0, 200) },
      saida: { narrativa: narrativa.slice(0, 300) },
      duracaoMs: Date.now() - tA05, ok: true,
    });
    estados.push('NARRADA');

    // ---- A06: Auditor de Números — VETO ABSOLUTO (KR3.2 = 0) ----
    const tA06 = Date.now();
    let aud = await this.executor.executar(CONTRATO_A06_AUDITOR, {
      input: { narrativa, resultado }, ferramenta: 'numerais:auditar', permissao: 'resposta:vetar',
      handler: async () => auditarNumeros(narrativa, resultado),
    });
    if (!aud.aprovado) {
      vetos++;
      this.log.error(
        `A06 VETO: numerais não autorizados ${JSON.stringify(aud.intrusos)} — resposta bloqueada e substituída.`,
      );
      await this.trilha.registrar('xingu', 'VETO_A06', 'Xingu', 'narrativa', {
        intrusos: aud.intrusos, pergunta: pergunta.slice(0, 200),
      });
      narrativa = narrativaDeterministica(resultado);
      aud = await this.executor.executar(CONTRATO_A06_AUDITOR, {
        input: { narrativa, resultado }, ferramenta: 'numerais:auditar', permissao: 'resposta:vetar',
        handler: async () => auditarNumeros(narrativa, resultado),
      });
      if (!aud.aprovado) {
        // inalcançável por construção; ainda assim, jamais publicar
        estados.push('AUDITADA', 'BLOQUEADA');
        execucoes.push({
          agente: 'A06', entrada: { narrativa: narrativa.slice(0, 200) },
          saida: { aprovado: false, vetos }, duracaoMs: Date.now() - tA06, ok: false,
        });
        return fim({
          estado: 'BLOQUEADA',
          resposta: 'A resposta foi bloqueada pela auditoria de números. Consulte o valor pelo portal.',
          plano: await this.enriquecerPlano(plano),
          auditoria: { numerais: aud.numerais.length, vetos, interprete: interpreteUsado },
          cache_plano: cacheHit,
        }, { plano });
      }
    }
    execucoes.push({
      agente: 'A06', entrada: { narrativa: narrativa.slice(0, 200) },
      saida: { aprovado: true, numerais: aud.numerais.length, vetos },
      duracaoMs: Date.now() - tA06, ok: true,
    });
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

    // ---- RN-MODO (P4): a MONTAGEM da resposta é onde os modos divergem.
    //      Todo número abaixo é JSON do motor (ranking/serie/comparar) —
    //      nenhum LLM participa; RG-03 intacto por construção. ----
    const referencia = plano.periodo.referencia;
    const ranking = await this.indicadores.ranking({
      indicadorId: plano.indicador_id, referencia, n: 5,
    });

    let ranking_top: RankingTop | undefined;
    let dossie: DossieXingu | undefined;
    let seriePersistida: SnapshotIndicador['serie'] = [];
    let causasPersistidas: SnapshotIndicador['causas'] = [];
    let sugestoesPersistidas: SnapshotSugestao[] = [];

    if (modo === 'pesquisa') {
      ranking_top = {
        indicador: ranking.indicador,
        unidade: ranking.unidade,
        referencia: ranking.referencia,
        agregacao: ranking.agregacao,
        media_estadual: ranking.media_estadual,
        total_estadual: ranking.total_estadual,
        total_municipios: ranking.total_municipios,
        ausentes: { total: ranking.ausentes.total },
        municipios: ranking.municipios.filter((m) => m.top_n),
        tabela_completa: true,
      };
    } else {
      const serie = await this.indicadores.serie({
        indicadorId: plano.indicador_id, recorte: plano.recorte, codigo: plano.codigo,
      });
      const comparacao = plano.recorte === 'MUNICIPIO' && plano.codigo
        ? await this.indicadores.comparar(plano.indicador_id, plano.codigo, referencia)
        : null;

      // ---- Causas (P3→dossiê): o MOTOR decompõe; ausência vira motivo com
      //      o contexto que o próprio motor devolveu (RN-005). O endpoint de
      //      causas cobre município e estado — outros recortes declaram isso.
      let causas: Causas | null = null;
      let motivoCausas: string | undefined;
      if (plano.recorte === 'MUNICIPIO' || plano.recorte === 'ESTADO') {
        try {
          causas = await this.indicadores.causas({
            indicadorId: plano.indicador_id,
            codigo: plano.recorte === 'MUNICIPIO' ? plano.codigo : null,
            referencia,
          });
        } catch (e: unknown) {
          const msg = e instanceof Error
            ? String((e as any)?.response?.message ?? e.message)
            : 'sem decomposição publicada.';
          motivoCausas = causasMotivo(msg.endsWith('.') ? msg : `${msg}.`);
        }
      } else {
        motivoCausas = causasMotivo(
          `a decomposição cobre os recortes municipal e estadual, não ${plano.recorte}.`,
        );
      }

      // ---- A16 (P7): dossiê de sugestões determinístico sobre o JSON do
      //      motor. Falha do agente NUNCA derruba a resposta (fail-closed:
      //      sem sugestão parcial) — o dossiê numérico permanece válido.
      const itemCatalogo = cat.indicadores.find((i) => i.id === plano!.indicador_id);
      const entradaA16 = {
        dossie: { ranking, serie: { pontos: serie.pontos }, causas },
        indicador: {
          id: plano.indicador_id,
          nome: resultado.indicador,
          unidade: resultado.unidade,
          tema: itemCatalogo?.tema ?? null,
          polaridade: itemCatalogo?.polaridade ?? null,
        },
        recorte: plano.recorte,
        codigo: plano.codigo ?? null,
        local: resultado.local,
      };
      const tA16 = Date.now();
      let saidaA16: SaidaSugestoes;
      let falhaA16 = false;
      try {
        saidaA16 = await this.executor.executar(CONTRATO_A16_SUGESTOES, {
          input: entradaA16,
          ferramenta: 'catalogo-praticas:ler', permissao: 'dados-publicos:ler',
          handler: () => this.sugestoes.gerar(entradaA16),
        });
      } catch (e: unknown) {
        falhaA16 = true;
        saidaA16 = { sugestoes: [], descartadas: 0 };
        this.log.error(`A16 falhou (dossiê segue sem sugestões): ${e instanceof Error ? e.message : e}`);
      }
      execucoes.push({
        agente: 'A16',
        entrada: { indicador_id: plano.indicador_id, recorte: plano.recorte, codigo: plano.codigo ?? null },
        saida: { sugestoes: saidaA16.sugestoes.length, descartadas: saidaA16.descartadas },
        duracaoMs: Date.now() - tA16, ok: !falhaA16,
      });

      dossie = {
        ranking,
        serie,
        comparacao,
        ...(comparacao === null
          ? { comparacao_motivo: 'Comparação território×região×Estado só se aplica ao recorte MUNICIPIO.' }
          : {}),
        causas,
        ...(causas === null ? { causas_motivo: motivoCausas } : {}),
        sugestoes: saidaA16.sugestoes,
        // Com sugestões, sem motivo; sem sugestões, motivo honesto.
        ...(saidaA16.sugestoes.length === 0
          ? { sugestoes_motivo: falhaA16 ? SUGESTOES_FALHA_A16 : SUGESTOES_SEM_GATILHO }
          : {}),
      };
      seriePersistida = serie.pontos.map((p) => ({
        codigoIbge: null, // null = o recorte principal da pesquisa
        ano: p.ano,
        valor: p.valor,
        categoria: 'OBSERVADO' as const,
      }));
      // Snapshot das causas exibidas (PesquisaCausa, db/48): periodo = a
      // referência vigente da dimensão no motor, codigoIbge = o território.
      causasPersistidas = causas
        ? causas.dimensoes.flatMap((d) => d.categorias.map((c) => ({
            codigoIbge: plano!.recorte === 'MUNICIPIO' ? plano!.codigo ?? null : null,
            dimensao: d.dimensao,
            categoria: c.categoria,
            periodo: d.referencia,
            valor: c.valor,
          })))
        : [];
      // Snapshot das sugestões (PesquisaSugestao): a origem vira FK real na
      // gravação — codigoIbge só quando a origem é a linha do município.
      sugestoesPersistidas = saidaA16.sugestoes.map((s) => ({
        texto: s.texto,
        praticaCitada: s.pratica_citada,
        agente: CONTRATO_A16_SUGESTOES.id,
        indicadorIndice: 0,
        codigoIbge: s.origem.tipo === 'RANKING_MUNICIPIO' ? s.origem.codigo_ibge ?? null : null,
      }));
    }

    // ---- Persistência (P1/P4): snapshot completo do que foi respondido ----
    const snapshotIndicador: SnapshotIndicador = {
      indicadorId: plano.indicador_id,
      nome: resultado.indicador,
      valor: resultado.valor,
      unidade: resultado.unidade,
      dataReferencia: referencia,
      agregacao: resultado.agregacao,
      municipiosAgregados: resultado.municipios_agregados ?? null,
      municipios: ranking.municipios.map((m) => ({
        codigoIbge: m.codigo_ibge,
        valor: m.valor,
        posicao: m.posicao,
        topN: m.top_n,
        deltaMediaEstadual: m.delta_media_estadual,
      })),
      serie: seriePersistida,
      causas: causasPersistidas,
    };
    // As visualizações que cada modo IMPLICA (P5/P6 renderizam a partir daqui).
    const conf = { indicadorId: plano.indicador_id, referencia, n: 5 };
    const tipos: TipoDashboard[] = modo === 'pesquisa'
      ? ['CARD', 'BARRAS', 'TABELA']
      : [
          'CARD', 'MAPA', 'SERIE',
          // DECOMPOSICAO só quando o dossiê tem causas do motor (P3/P7) —
          // nunca um painel vazio prometido sem dado (RN-005).
          ...(dossie?.causas ? (['DECOMPOSICAO'] as TipoDashboard[]) : []),
          'TABELA',
          // sem COMPARACAO fora de MUNICIPIO (mesma regra do dossiê)
          ...(plano.recorte === 'MUNICIPIO' ? (['COMPARACAO'] as TipoDashboard[]) : []),
        ];
    const dashboards: SnapshotDashboard[] = tipos.map((tipo, ordem) => ({
      tipo, configuracao: conf, ordem, modo,
    }));
    // Procedência congelada: FonteId resolvido por nome dentro da transação.
    const fontes: SnapshotFonte[] = resultado.procedencia.map((p) => ({
      nome: p.fonte,
      hashSha256: p.hash,
      url: p.url,
      dataExtracao: p.data_extracao,
    }));

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
      ranking_top,
      dossie,
      auditoria: { numerais: aud.numerais.length, vetos, interprete: interpreteUsado },
      cache_plano: cacheHit,
    }, { plano, indicadores: [snapshotIndicador], dashboards, sugestoes: sugestoesPersistidas, fontes });
  }

  /** Plano legível para exibição (RF-CHAT-003: o usuário vê o raciocínio antes da frase). */
  private async enriquecerPlano(plano: PlanoConsulta, r?: ValorComProcedencia) {
    const cat = await this.catalogo.obter();
    const ind = cat.indicadores.find((i) => i.id === plano.indicador_id);
    return { ...plano, indicador: ind?.nome, local: r?.local };
  }
}
