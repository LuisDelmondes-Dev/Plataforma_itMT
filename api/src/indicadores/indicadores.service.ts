import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TerritorioService, Recorte } from '../territorio/territorio.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AgentesFonteService } from '../fontes/agentes-fonte.service';
import { Procedencia, StatusDado, ValorComProcedencia } from '../common/procedencia';

interface LinhaObs {
  codigo_ibge: string;
  valor: string;
  data_referencia: string;
  fonte: string;
  url: string | null;
  licenca: string;
  data_extracao: string;
  hash: string;
  /** E3 (db/60): fase de homologação na fonte; NULL = desconhecido (campo omitido na saída). */
  status_dado: StatusDado | null;
}

/**
 * E3 (ADR-010): status agregado de um conjunto de parcelas — o PIOR vence
 * (PRELIMINAR contamina REVISADO/CONSOLIDADO); qualquer parcela de status
 * DESCONHECIDO (NULL) impede afirmar CONSOLIDADO/REVISADO ⇒ undefined
 * (campo omitido — não se afirma o que não se sabe, irmã da RN-005).
 */
function piorStatus(statuses: (StatusDado | null | undefined)[]): StatusDado | undefined {
  if (statuses.some((s) => s === 'PRELIMINAR')) return 'PRELIMINAR';
  if (statuses.some((s) => s === null || s === undefined)) return undefined;
  if (statuses.some((s) => s === 'CONSOLIDADO')) return 'CONSOLIDADO';
  return statuses.length ? 'REVISADO' : undefined;
}

interface MetaIndicador {
  id: number;
  nome: string;
  unidade: string;
  tipo_agregacao: 'SOMA' | 'MEDIA_PONDERADA' | 'RECALCULO' | 'NAO_AGREGAVEL';
  numerador_id: number | null;
  denominador_id: number | null;
  /**
   * Escala do RECALCULO (Gauntlet P3): cobertura vacinal é % (×100), taxa de
   * mortalidade infantil é POR MIL (×1000). Metadado do catálogo
   * ("Indicador_FatorEscala", db/49) — o DEFAULT 100 preserva o comportamento
   * de todo indicador anterior.
   */
  fator_escala: number;
}

/** Uma linha do ranking municipal (Gauntlet P2). */
export interface RankingMunicipio {
  /** Competition ranking: empate compartilha a posição (1,2,2,4). */
  posicao: number;
  codigo_ibge: string;
  nome: string;
  valor: number;
  /** null quando não existe média estadual (NAO_AGREGAVEL, RN-003). */
  delta_media_estadual: number | null;
  top_n: boolean;
  bottom_n: boolean;
  procedencia: Procedencia[];
}

/** Uma categoria da decomposição por causa (Gauntlet P3). */
export interface CausaCategoria {
  categoria: string;
  /** Valor ABSOLUTO do motor (ex.: óbitos) — nunca derivado por LLM (RG-03). */
  valor: number;
  /** Participação % sobre o total da dimensão no território (1 casa). */
  participacao: number;
}

/**
 * Um eixo de decomposição — ex.: capítulo CID-10, causa evitável, componente
 * etário. Evolução E1: o vocabulário deixou de ser union type fechado e passou
 * a ser o catálogo "DimensaoObservacao" (db/54) — o tipo é `string` e a
 * validação é em RUNTIME contra o catálogo (dimensoesObservacao()), para que
 * uma 4ª dimensão entre por migração de curadoria sem edição de código.
 */
export interface CausaDimensao {
  dimensao: string;
  /** Referência vigente DESTA dimensão no território (≤ referência pedida). */
  referencia: string;
  total: number;
  categorias: CausaCategoria[];
  procedencia: Procedencia[];
}

/** Linha do catálogo de dimensões de observação (db/54 — Evolução E1). */
export interface DimensaoObservacaoCatalogo {
  codigo: string;
  /** Rótulo de exibição pt-BR (ex.: 'capítulo CID-10') — o que o A16 escreve. */
  nome: string;
  /** Ordem canônica de exibição/desempate. */
  ordem: number;
}

/** Decomposição por causa de um indicador num território (Gauntlet P3 · MOTOR-CAUSAS). */
export interface Causas {
  indicador: string;
  unidade: string;
  recorte: 'MUNICIPIO' | 'ESTADO';
  local: string;
  referencia: string;
  /**
   * Quando o indicador consultado é uma taxa (RECALCULO) sem decomposição
   * própria, a decomposição vem do NUMERADOR (ex.: causas da taxa de
   * mortalidade infantil = causas dos óbitos infantis) — declarado aqui.
   */
  decomposicao_de?: string;
  dimensoes: CausaDimensao[];
}

/** Ranking completo dos municípios do estado por um indicador (Gauntlet P2). */
export interface Ranking {
  indicador: string;
  unidade: string;
  referencia: string;
  agregacao: MetaIndicador['tipo_agregacao'];
  /**
   * Total estadual pelo rollup do motor — só existe para SOMA (contagens);
   * em RECALCULO/MEDIA_PONDERADA o agregado estadual É a média, e em
   * NAO_AGREGAVEL não há agregado válido (RN-003). Crítico P2/rodada 1:
   * quem lê um ranking de contagens quer "X de Y do estado".
   */
  total_estadual: number | null;
  media_estadual: number | null;
  media_estadual_motivo?: string;
  total_municipios: number;
  /** RN-005: município sem dado fica FORA do ranking — nunca vira zero. */
  ausentes: { total: number; codigos: string[] };
  municipios: RankingMunicipio[];
}

/**
 * MOTOR DETERMINÍSTICO (PRD §9.2 / §10).
 * Agentes A03 (Planejador) e A04 (Executor) em forma de serviço.
 * Nenhum número que sai daqui passou por LLM (RG-03) — a borda de
 * linguagem, quando existir, consome ESTE serviço e preenche slots.
 */
@Injectable()
export class IndicadoresService {
  constructor(
    private readonly db: DatabaseService,
    private readonly territorio: TerritorioService,
    private readonly auditoria: AuditoriaService,
    private readonly agentes: AgentesFonteService,
  ) {}

  private cacheDimensoes: { quando: number; linhas: DimensaoObservacaoCatalogo[] } | null = null;
  private static readonly DIMENSOES_TTL_MS = 60_000;

  /**
   * Catálogo de dimensões de observação (db/54 — Evolução E1), cacheado 60s
   * no padrão do catálogo de práticas (SugestoesService). A aplicação só lê:
   * curadoria de vocabulário é migração. É a ÚNICA fonte da allowlist do
   * parâmetro ?dimensao — o antigo union type/lista fixa no código morreu.
   */
  async dimensoesObservacao(): Promise<DimensaoObservacaoCatalogo[]> {
    if (this.cacheDimensoes && Date.now() - this.cacheDimensoes.quando < IndicadoresService.DIMENSOES_TTL_MS) {
      return this.cacheDimensoes.linhas;
    }
    const r = await this.db.query<DimensaoObservacaoCatalogo>(
      `SELECT "DimensaoObservacao_Codigo" AS codigo,
              "DimensaoObservacao_Nome"   AS nome,
              "DimensaoObservacao_Ordem"::int AS ordem
         FROM "DimensaoObservacao"
        WHERE "DimensaoObservacao_Ativa"
        ORDER BY "DimensaoObservacao_Ordem", "DimensaoObservacao_Codigo"`,
    );
    this.cacheDimensoes = { quando: Date.now(), linhas: r.rows };
    return r.rows;
  }

  private async meta(indicadorId: number): Promise<MetaIndicador> {
    // RG-09 vale também no acesso direto por id: indicador sem parecer
    // favorável não existe para o público — não só para a navegação.
    // (Numerador/denominador de RECALCULO passam por aqui também; eles
    // acompanham o status do indicador composto no fluxo de submissão.)
    const r = await this.db.query<MetaIndicador>(
      `SELECT "Indicador_Id" AS id, "Indicador_Nome" AS nome, "Indicador_Unidade" AS unidade,
              "Indicador_TipoAgregacao" AS tipo_agregacao,
              "Indicador_NumeradorId" AS numerador_id, "Indicador_DenominadorId" AS denominador_id,
              "Indicador_FatorEscala"::float8 AS fator_escala
         FROM "Indicador" WHERE "Indicador_Id" = $1 AND "Indicador_StatusValidacao" = 'APROVADO'`,
      [indicadorId],
    );
    if (!r.rows[0]) throw new NotFoundException(`Indicador ${indicadorId} não encontrado.`);
    return r.rows[0];
  }

  /** Resolve o id de um indicador APROVADO pelo nome (catálogo é dado, não código). */
  private async idIndicadorPorNome(nome: string): Promise<number | null> {
    const r = await this.db.query<{ id: number }>(
      `SELECT "Indicador_Id" AS id FROM "Indicador"
        WHERE "Indicador_Nome" = $1 AND "Indicador_StatusValidacao" = 'APROVADO'
        ORDER BY "Indicador_Id" LIMIT 1`,
      [nome],
    );
    return r.rows[0]?.id ?? null;
  }

  /** Observação mais recente ≤ data de referência, por município, com o quinteto de procedência. */
  private async observacoes(
    indicadorId: number,
    codigos: string[],
    dataReferencia: string,
  ): Promise<LinhaObs[]> {
    const r = await this.db.query<LinhaObs>(
      `SELECT DISTINCT ON (o."Observacao_CodigoIbge")
              o."Observacao_CodigoIbge"     AS codigo_ibge,
              o."Observacao_Valor"::text    AS valor,
              o."Observacao_DataReferencia"::text AS data_referencia,
              f."Fonte_Nome"                AS fonte,
              f."Fonte_Url"                 AS url,
              f."Fonte_Licenca"             AS licenca,
              c."Carga_DataExtracao"::text  AS data_extracao,
              c."Carga_HashSha256"          AS hash,
              o."Observacao_StatusDado"     AS status_dado
         FROM "Observacao" o
         JOIN "Fonte" f ON f."Fonte_Id" = o."Observacao_FonteId"
         JOIN "Carga" c ON c."Carga_Id" = o."Observacao_CargaId"
        WHERE o."Observacao_IndicadorId" = $1
          AND o."Observacao_CodigoIbge" = ANY($2)
          AND o."Observacao_DataReferencia" <= $3::date
        -- O desempate por carga NÃO é cosmético. A UNIQUE de "Observacao" é
        -- (Indicador, CodigoIbge, DataReferencia, FonteId): duas fontes na
        -- MESMA referência são legais por schema, e existem no banco real —
        -- "Área plantada" tem 141 municípios com duas fontes concorrentes e
        -- 114 deles com valores DIFERENTES. Sem desempate, o DISTINCT ON
        -- deixava a escolha para o plano de execução: o total estadual medido
        -- variou de 21.586.733 para 21.583.275 apenas ligando enable_sort=off,
        -- com o banco intacto. Um motor determinístico que muda de resposta
        -- conforme o planejador não é determinístico.
        --
        -- Enquanto não existir precedência de fonte declarada por indicador
        -- (registrado como pendência), a regra é a MAIS RECENTEMENTE CARREGADA:
        -- reprodutível, explicável ao cidadão e alinhada à linhagem — vence o
        -- que a última carga auditada afirmou. O id da observação encerra o
        -- empate residual de duas cargas no mesmo instante.
        ORDER BY o."Observacao_CodigoIbge",
                 o."Observacao_DataReferencia" DESC,
                 c."Carga_DataExtracao" DESC,
                 o."Observacao_Id" DESC`,
      [indicadorId, codigos, dataReferencia],
    );
    return r.rows;
  }

  /**
   * E21 (db/66): a malha municipal VIGENTE na data de referência — a única
   * forma de o motor perguntar "quais municípios existiam em X".
   *
   * Por que isto não é detalhe: até a E21 o motor tratava os 142 municípios
   * como universo fixo em qualquer ano, embora "Municipio_DataInstalacao"
   * existisse desde o db/57. Boa Esperança do Norte (5101837) foi instalado
   * em 2025-01-01: numa referência de 2022 ele não é dado FALTANTE, está
   * FORA DO UNIVERSO. Tratá-lo como ausente é o espelho da imputação que a
   * RN-005 proíbe — lá se inventa número, aqui se inventaria lacuna.
   * Confirmado na fonte oficial: a API SIDRA do IBGE (tabela 4709, v. 93,
   * 2022, municípios da UF 51) devolve 141 registros, sem o 5101837.
   *
   * A regra do NULL mora no SQL da função (NULL = vigente sempre, 141 dos
   * 142 municípios) — deliberadamente NÃO reimplementada aqui, para que
   * exista um ponto único de verdade quando a extinção/fusão entrar.
   */
  private async malhaVigente(dataReferencia: string) {
    const r = await this.db.query<{ codigo: string; nome: string }>(
      `SELECT codigo_ibge AS codigo, nome FROM "MunicipiosVigentesEm"($1::date)`,
      [dataReferencia],
    );
    return r.rows;
  }

  private procedenciaDe(linhas: LinhaObs[]): Procedencia[] {
    const vistos = new Map<string, Procedencia>();
    // E3: linhas que colapsam na mesma citação (fonte|referência|hash) podem
    // divergir de status — a citação reporta o pior (piorStatus).
    const statusPorChave = new Map<string, (StatusDado | null)[]>();
    for (const l of linhas) {
      const chave = `${l.fonte}|${l.data_referencia}|${l.hash}`;
      if (!vistos.has(chave)) {
        vistos.set(chave, {
          fonte: l.fonte,
          url: l.url,
          data_referencia: l.data_referencia,
          data_extracao: l.data_extracao,
          licenca: l.licenca,
          hash: l.hash,
        });
        statusPorChave.set(chave, []);
      }
      statusPorChave.get(chave)!.push(l.status_dado);
    }
    for (const [chave, p] of vistos) {
      const status = piorStatus(statusPorChave.get(chave)!);
      if (status !== undefined) p.status_dado = status;
    }
    return [...vistos.values()];
  }

  /**
   * Consulta canônica: (recorte, código, indicador, período) → valor + procedência.
   * Rollup determinístico conforme Indicador_TipoAgregacao (RN-003).
   */
  /**
   * TODA busca do usuário passa aqui (consulta, comparação, exportação e
   * Xingú). Fluxo: banco primeiro; se der ausência, o agente da fonte
   * decide se busca na internet (só quando falta/venceu — F5), atualiza o
   * banco e a consulta é refeita UMA vez. Se ainda faltar, a ausência é
   * resposta honesta (RN-005) — nunca estimativa.
   */
  async consultar(params: {
    indicadorId: number;
    recorte: Recorte;
    codigo: string | null;
    dataReferencia: string;
  }): Promise<ValorComProcedencia> {
    try {
      return await this.consultarNucleo(params);
    } catch (e) {
      if (!(e instanceof NotFoundException)) throw e;
      const nome = await this.db.query<{ nome: string }>(
        `SELECT "Indicador_Nome" AS nome FROM "Indicador" WHERE "Indicador_Id"=$1`,
        [params.indicadorId],
      );
      const buscou = nome.rows[0]
        ? await this.agentes.garantirParaIndicador(nome.rows[0].nome)
        : false;
      if (!buscou) throw e;
      return this.consultarNucleo(params); // segunda e última tentativa
    }
  }

  private async consultarNucleo(params: {
    indicadorId: number;
    recorte: Recorte;
    codigo: string | null;
    dataReferencia: string;
  }): Promise<ValorComProcedencia> {
    const { indicadorId, recorte, codigo, dataReferencia } = params;
    const meta = await this.meta(indicadorId);
    const { codigos, rotulo } = await this.territorio.resolverRecorte(
      recorte,
      codigo,
      dataReferencia,
    );

    const ehAgregado = recorte !== 'MUNICIPIO';

    // RN-003: rollup de NAO_AGREGAVEL é bloqueado NA CAMADA DE SERVIÇO, não na UI
    if (ehAgregado && meta.tipo_agregacao === 'NAO_AGREGAVEL') {
      throw new UnprocessableEntityException(
        `O indicador "${meta.nome}" é NAO_AGREGAVEL: não existe rollup válido para o recorte ${recorte}. ` +
          `Consulte-o por município.`,
      );
    }

    let valor: number;
    let linhas: LinhaObs[];

    if (!ehAgregado || meta.tipo_agregacao === 'SOMA') {
      linhas = await this.observacoes(indicadorId, codigos, dataReferencia);
      if (linhas.length) {
        valor = linhas.reduce((s, l) => s + Number(l.valor), 0);
      } else if (
        !ehAgregado &&
        meta.tipo_agregacao === 'RECALCULO' &&
        meta.numerador_id &&
        meta.denominador_id
      ) {
        // Gauntlet P3: uma taxa (RECALCULO) normalmente NÃO é materializada
        // por município — sem observação própria, recomputa num/den do
        // PRÓPRIO município (mesma matemática do ranking, RN-003). Só entra
        // com AMBAS as parcelas e denominador ≠ 0 — sem imputação (RN-005).
        const [num, den] = await Promise.all([
          this.observacoes(meta.numerador_id, codigos, dataReferencia),
          this.observacoes(meta.denominador_id, codigos, dataReferencia),
        ]);
        if (!num.length || !den.length)
          return this.ausencia(meta, rotulo, recorte, indicadorId, dataReferencia);
        // Guarda de MESMA REFERÊNCIA (rodada 2 do gauntlet P3): numerador e
        // denominador de taxa são dados de EVENTO (contagens anuais), não de
        // estoque — a vigência "≤ referência" de cada parcela pode apontar
        // para ANOS diferentes, e dividir óbitos de um ano por nascidos de
        // outro fabrica uma taxa que nunca existiu (imputação silenciosa do
        // passado, RN-005). Divergiu ⇒ sem cálculo, com contexto honesto.
        if (num[0].data_referencia !== den[0].data_referencia)
          throw new NotFoundException(
            await this.mensagemParcelasDivergentes(meta, rotulo, dataReferencia, num[0], den[0]),
          );
        if (Number(den[0].valor) === 0)
          throw new NotFoundException(
            `Não há taxa calculável de "${meta.nome}" para ${rotulo} em ${num[0].data_referencia}: ` +
              `o denominador vale 0 nessa referência — divisão impossível, sem imputação (RN-005).`,
          );
        valor = (Number(num[0].valor) / Number(den[0].valor)) * meta.fator_escala;
        linhas = [...num, ...den];
      } else {
        return this.ausencia(meta, rotulo, recorte, indicadorId, dataReferencia);
      }
    } else if (meta.tipo_agregacao === 'RECALCULO') {
      // Taxas NÃO somam: recomputar a partir de numerador e denominador (RN-003)
      if (!meta.numerador_id || !meta.denominador_id) {
        throw new UnprocessableEntityException(
          `Indicador RECALCULO sem numerador/denominador declarados — dado de catálogo inconsistente.`,
        );
      }
      const [num, den] = await Promise.all([
        this.observacoes(meta.numerador_id, codigos, dataReferencia),
        this.observacoes(meta.denominador_id, codigos, dataReferencia),
      ]);
      // Só entram municípios com AMBAS as parcelas — sem imputação (RF-CHAT-006: nunca estimar).
      // E com AMBAS na MESMA referência (rodada 2 do gauntlet P3): parcelas de
      // taxa são dados de EVENTO (contagens anuais), não de estoque — a
      // vigência "≤ referência" pode trazer o numerador de um ano e o
      // denominador de outro, e somar essas parcelas descasadas no agregado
      // contamina a taxa estadual com o passado (imputação silenciosa,
      // RN-005). Município com referências divergentes fica FORA da soma.
      const denPor = new Map(den.map((d) => [d.codigo_ibge, d]));
      const numOk: LinhaObs[] = [];
      const denOk: LinhaObs[] = [];
      for (const nu of num) {
        const de = denPor.get(nu.codigo_ibge);
        if (!de || nu.data_referencia !== de.data_referencia) continue;
        numOk.push(nu);
        denOk.push(de);
      }
      if (!numOk.length) return this.ausencia(meta, rotulo, recorte, indicadorId, dataReferencia);
      const somaNum = numOk.reduce((s, l) => s + Number(l.valor), 0);
      const somaDen = denOk.reduce((s, l) => s + Number(l.valor), 0);
      if (somaDen === 0)
        throw new UnprocessableEntityException(`Denominador zero no recálculo de "${meta.nome}".`);
      valor = (somaNum / somaDen) * meta.fator_escala;
      linhas = [...numOk, ...denOk];
    } else {
      // MEDIA_PONDERADA — peso é a população estimada, resolvida pelo NOME
      // do indicador no catálogo (não por id fixo): robusto a remapeamento
      // de ids entre seed demo e carga real.
      const pesoId = await this.idIndicadorPorNome('População estimada');
      if (!pesoId)
        throw new UnprocessableEntityException(
          `Média ponderada de "${meta.nome}" exige o indicador-peso "População estimada" no catálogo.`,
        );
      const [vals, pesos] = await Promise.all([
        this.observacoes(indicadorId, codigos, dataReferencia),
        this.observacoes(pesoId, codigos, dataReferencia),
      ]);
      if (!vals.length) return this.ausencia(meta, rotulo, recorte, indicadorId, dataReferencia);
      const pesoPor = new Map(pesos.map((p) => [p.codigo_ibge, Number(p.valor)]));
      let somaVP = 0;
      let somaP = 0;
      for (const v of vals) {
        const p = pesoPor.get(v.codigo_ibge);
        if (p === undefined) continue;
        somaVP += Number(v.valor) * p;
        somaP += p;
      }
      if (somaP === 0)
        throw new UnprocessableEntityException(`Sem pesos para a média ponderada de "${meta.nome}".`);
      valor = somaVP / somaP;
      linhas = vals;
    }

    // E3: status agregado das parcelas — o pior vence (PRELIMINAR contamina);
    // parcela desconhecida ⇒ campo omitido (não se afirma o que não se sabe).
    const statusDado = piorStatus(linhas.map((l) => l.status_dado));

    const resposta: ValorComProcedencia = {
      valor: Number(valor.toFixed(meta.tipo_agregacao === 'RECALCULO' ? 1 : 2)),
      unidade: meta.unidade,
      indicador: meta.nome,
      recorte,
      local: rotulo,
      agregacao: ehAgregado ? meta.tipo_agregacao : 'VALOR_MUNICIPAL',
      municipios_agregados: ehAgregado ? new Set(linhas.map((l) => l.codigo_ibge)).size : undefined,
      ...(statusDado !== undefined ? { status_dado: statusDado } : {}),
      procedencia: this.procedenciaDe(linhas), // §12.1: indissociável do número
    };

    // RF-CHAT-009 / RF-ADMIN-006: trilha imutável da consulta executada
    await this.auditoria.registrar('api', 'CONSULTA_INDICADOR', 'Indicador', String(indicadorId), {
      recorte,
      codigo,
      data_referencia: dataReferencia,
      valor: resposta.valor,
    });

    return resposta;
  }

  /**
   * Mensagem da guarda de mesma referência (rodada 2 do gauntlet P3): as duas
   * parcelas vigentes existem, mas em ANOS diferentes — para dado de EVENTO
   * isso não forma taxa. A resposta é honesta e SEM número calculado.
   */
  private async mensagemParcelasDivergentes(
    meta: MetaIndicador,
    rotulo: string,
    dataReferencia: string,
    num: LinhaObs,
    den: LinhaObs,
  ): Promise<string> {
    // Nomes das parcelas só para a mensagem (sem filtro de status: o público
    // não calcula nada aqui — só entende o porquê da ausência).
    const nomes = await this.db.query<{ id: number; nome: string }>(
      `SELECT "Indicador_Id" AS id, "Indicador_Nome" AS nome
         FROM "Indicador" WHERE "Indicador_Id" = ANY($1)`,
      [[meta.numerador_id, meta.denominador_id]],
    );
    const nomePor = new Map(nomes.rows.map((n) => [Number(n.id), n.nome]));
    const nomeNum = nomePor.get(meta.numerador_id!) ?? 'numerador';
    const nomeDen = nomePor.get(meta.denominador_id!) ?? 'denominador';
    return (
      `Não há taxa calculável de "${meta.nome}" para ${rotulo} até ${dataReferencia}: ` +
      `parcelas com referências divergentes — ${nomeNum} ${num.data_referencia.slice(0, 4)} ` +
      `vs ${nomeDen} ${den.data_referencia.slice(0, 4)} — sem cálculo, sem imputação (RN-005).`
    );
  }

  /** RN-005: a ausência de dado é uma resposta legítima — nunca estimar. */
  private async ausencia(
    meta: MetaIndicador,
    rotulo: string,
    recorte: Recorte,
    indicadorId: number,
    dataReferencia: string,
  ): Promise<never> {
    const r = await this.db.query<{ ultima: string | null; cobertos: string }>(
      `SELECT max("Observacao_DataReferencia")::text AS ultima,
              count(DISTINCT "Observacao_CodigoIbge")::text AS cobertos
         FROM "Observacao" WHERE "Observacao_IndicadorId" = $1`,
      [indicadorId],
    );
    const { ultima, cobertos } = r.rows[0];
    throw new NotFoundException(
      ultima
        ? `Não há dado de "${meta.nome}" para ${rotulo} até ${dataReferencia}. ` +
          `A referência mais recente na base é ${ultima}, cobrindo ${cobertos} município(s).`
        : `Não há dado publicado de "${meta.nome}". O subtema pode estar em construção ou sem fonte mapeada.`,
    );
  }

  /** RF-PORTAL-006: comparação município × RGI × RGInt × Estado × até 4 municípios livres. */
  async comparar(
    indicadorId: number,
    codigoIbge: string,
    dataReferencia: string,
    municipiosLivres: string[] = [],
  ) {
    // §15.7: máximo de 5 séries (o local + 4). Além disso, a API recusa e explica.
    if (municipiosLivres.length > 4) {
      throw new UnprocessableEntityException(
        `A comparação aceita no máximo 4 municípios além do local (5 séries no total). ` +
          `Recebidos: ${municipiosLivres.length}.`,
      );
    }
    const m = await this.territorio.obterMunicipio(codigoIbge);
    const municipioRow = await this.db.query<{ rgi: string; rgint: string }>(
      `SELECT "Municipio_CodigoRgi" AS rgi, "Municipio_CodigoRgint" AS rgint
         FROM "Municipio" WHERE "Municipio_CodigoIbge" = $1`,
      [codigoIbge],
    );
    const { rgi, rgint } = municipioRow.rows[0];

    const tentar = (recorte: Recorte, codigo: string | null) =>
      this.consultar({ indicadorId, recorte, codigo, dataReferencia }).catch((e) => ({
        erro: e?.message ?? 'indisponível',
      }));

    const [municipio, regiaoImediata, regiaoIntermediaria, estado, ...livres] = await Promise.all([
      tentar('MUNICIPIO', codigoIbge),
      tentar('RGI', rgi),
      tentar('RGINT', rgint),
      tentar('ESTADO', null),
      ...municipiosLivres.map((c) => tentar('MUNICIPIO', c)),
    ]);

    return {
      municipio: { ...municipio, nome: m.nome },
      regiaoImediata,
      regiaoIntermediaria,
      estado,
      municipiosLivres: livres,
    };
  }

  /**
   * RF-ADMIN-002 (recorte simplificado): matriz de cobertura município × tema.
   *
   * E21 — NÃO recebeu a malha vigente, de propósito: esta matriz não tem UMA
   * data de referência (ela agrega `max(DataReferencia)` sobre TODO o
   * histórico de cada par município × tema). Sem data, "vigente em quando?"
   * não tem resposta — e escolher uma (hoje? o max global?) seria arbitrar em
   * silêncio, exatamente o que a RN-005 proíbe. É superfície ADMIN, não
   * pública, e a linha de um município recém-instalado já se lê pelo que ela
   * é: sem observação anterior à instalação.
   * GATILHO para revisitar: quando/se a matriz ganhar parâmetro de ano —
   * aí a pergunta passa a ter data e `malhaVigente()` se aplica sem ambiguidade.
   */
  async cobertura() {
    const r = await this.db.query(
      `SELECT m."Municipio_CodigoIbge" AS codigo_ibge, m."Municipio_Nome" AS municipio,
              t."TemaConsulta_Id" AS tema_id, t."TemaConsulta_Nome" AS tema,
              max(o."Observacao_DataReferencia")::text AS ultima_referencia,
              count(o.*)::int AS observacoes
         FROM "Municipio" m
        CROSS JOIN "TemaConsulta" t
         LEFT JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_TemaId" = t."TemaConsulta_Id"
         LEFT JOIN "Indicador" i ON i."Indicador_SubtemaId" = s."SubtemaConsulta_Id"
         LEFT JOIN "Observacao" o ON o."Observacao_IndicadorId" = i."Indicador_Id"
                                 AND o."Observacao_CodigoIbge" = m."Municipio_CodigoIbge"
        GROUP BY 1,2,3,4
        ORDER BY m."Municipio_Nome", t."TemaConsulta_Ordem"`,
    );
    return r.rows;
  }

  /**
   * Indicadores em destaque para a ficha municipal (RF-PORTAL-011) e para a
   * lista do mapa: os publicados que efetivamente têm dado consultável, do
   * catálogo — não uma lista fixa de ids. Um RECALCULO (taxa) não tem
   * observação própria: ele TEM dado quando numerador E denominador têm
   * (P6 rodada 2 — a taxa aprovada não aparecia na lista de /mapa).
   * Ordena por tema/ordem para uma síntese coerente.
   */
  async destaque(limite = 4, detalhe = false) {
    const r = await this.db.query<{ id: number; nome: string; unidade: string; tema: string }>(
      `SELECT DISTINCT i."Indicador_Id" AS id, i."Indicador_Nome" AS nome,
              i."Indicador_Unidade" AS unidade, t."TemaConsulta_Nome" AS tema,
              t."TemaConsulta_Ordem" AS ordem
         FROM "Indicador" i
         JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_Id" = i."Indicador_SubtemaId"
         JOIN "TemaConsulta" t ON t."TemaConsulta_Id" = s."SubtemaConsulta_TemaId"
        WHERE i."Indicador_StatusValidacao" = 'APROVADO'
          AND (
            EXISTS (SELECT 1 FROM "Observacao" o WHERE o."Observacao_IndicadorId" = i."Indicador_Id")
            OR (i."Indicador_TipoAgregacao" = 'RECALCULO'
                AND i."Indicador_NumeradorId" IS NOT NULL
                AND i."Indicador_DenominadorId" IS NOT NULL
                AND EXISTS (SELECT 1 FROM "Observacao" o WHERE o."Observacao_IndicadorId" = i."Indicador_NumeradorId")
                AND EXISTS (SELECT 1 FROM "Observacao" o WHERE o."Observacao_IndicadorId" = i."Indicador_DenominadorId"))
          )
        ORDER BY ordem, id
        LIMIT $1`,
      [Math.min(Math.max(limite, 1), 12)],
    );
    // Compat: sem detalhe devolve só os ids (contrato da ficha municipal).
    return detalhe
      ? r.rows.map(({ id, nome, unidade, tema }) => ({ id, nome, unidade, tema }))
      : r.rows.map((x) => x.id);
  }

  /**
   * A2 — Série histórica: valor por ano de referência para um recorte.
   * Reusa o motor determinístico (consultar) ano a ano, então cada ponto
   * carrega a mesma procedência e as mesmas regras de agregação (RN-003).
   * Anos sem dado são omitidos (RN-005: ausência não é zero).
   */
  async serie(params: {
    indicadorId: number;
    recorte: Recorte;
    codigo: string | null;
  }): Promise<{ indicador: string; unidade: string; local: string; pontos: { ano: number; valor: number }[] }> {
    const meta = await this.meta(params.indicadorId);
    // Anos com observação, do mais antigo ao mais novo. Um indicador
    // RECALCULO não tem observação própria (a taxa é derivada): os anos vêm
    // da INTERSEÇÃO das parcelas — só há ponto quando numerador E
    // denominador existem no mesmo ano (coerente com a guarda de mesma
    // referência; achado do builder P7: a série da TMI voltava vazia).
    const anos =
      meta.tipo_agregacao === 'RECALCULO' && meta.numerador_id && meta.denominador_id
        ? await this.db.query<{ ano: number }>(
            `SELECT DISTINCT extract(year FROM "Observacao_DataReferencia")::int AS ano
               FROM "Observacao" WHERE "Observacao_IndicadorId" = $1
             INTERSECT
             SELECT DISTINCT extract(year FROM "Observacao_DataReferencia")::int AS ano
               FROM "Observacao" WHERE "Observacao_IndicadorId" = $2
             ORDER BY ano`,
            [meta.numerador_id, meta.denominador_id],
          )
        : await this.db.query<{ ano: number }>(
            `SELECT DISTINCT extract(year FROM "Observacao_DataReferencia")::int AS ano
               FROM "Observacao" WHERE "Observacao_IndicadorId" = $1 ORDER BY ano`,
            [params.indicadorId],
          );
    const pontos: { ano: number; valor: number }[] = [];
    let local = '';
    for (const { ano } of anos.rows) {
      try {
        const r = await this.consultarNucleo({
          indicadorId: params.indicadorId,
          recorte: params.recorte,
          codigo: params.codigo,
          dataReferencia: `${ano}-12-31`,
        });

        // `observacoes()` devolve a parcela VIGENTE ≤ a data pedida, o que é
        // correto para uma consulta pontual ("o que se sabe em 2023") e ERRADO
        // para uma série: sem esta guarda, um município com uma única
        // observação em 2019 devolvia cinco pontos de 2019 a 2023, todos com o
        // mesmo valor, carimbados com o ano pedido. Não é zerar a ausência —
        // é carregar o passado para a frente como se fosse observação, e o
        // ponto seguia para a projeção (que declarava R² = 1 sobre um único
        // dado real), para o dossiê da Xingú e para `PesquisaSerieHistorica`,
        // onde era selado pelo hash canônico com categoria OBSERVADO.
        //
        // Regra: o ano só vira ponto se a referência MAIS RECENTE entre as
        // parcelas for daquele ano. Se a mais nova é anterior, nada foi
        // observado naquele ano e o ponto é repetição — omitir é a resposta
        // honesta (RN-005).
        const referenciaMaisNova = r.procedencia
          .map((p) => p.data_referencia)
          .reduce((a, b) => (a > b ? a : b), '');
        if (referenciaMaisNova.slice(0, 4) !== String(ano)) continue;

        pontos.push({ ano, valor: r.valor });
        local = r.local;
      } catch {
        // ano sem dado para este recorte: omitido (ausência é resposta)
      }
    }
    return { indicador: meta.nome, unidade: meta.unidade, local, pontos };
  }

  /**
   * Pareamento municipal de um indicador RECALCULO — a ÚNICA implementação,
   * compartilhada por ranking() e mapa() (Gauntlet P6 rodada 2: o mapa lia só
   * observações diretas e voltava vazio para taxas, contradizendo o ranking
   * do mesmo dossiê). Regras (idênticas às do ranking desde a P2/P3):
   *
   * - parcela vigente ≤ referência por município (observacoes);
   * - só entra quem tem AMBAS as parcelas NA MESMA data_referencia (guarda
   *   de dado de EVENTO da P3 — parcelas de anos distintos não formam taxa);
   * - denominador ≠ 0 (divisão impossível ⇒ fora, sem imputação);
   * - valor = (num/den) × FatorEscala, arredondado a 1 casa (o mesmo que
   *   consultar() publica para RECALCULO);
   * - município sem par fica FORA (RN-005: o mapa pinta "sem dado" e o
   *   ranking o lista em `ausentes` — as duas superfícies agora coincidem).
   */
  private async paresRecalculo(
    meta: MetaIndicador,
    codigos: string[],
    ref: string,
  ): Promise<{ num: LinhaObs; den: LinhaObs; valor: number }[]> {
    if (!meta.numerador_id || !meta.denominador_id) {
      throw new UnprocessableEntityException(
        `Indicador RECALCULO sem numerador/denominador declarados — dado de catálogo inconsistente.`,
      );
    }
    const [num, den] = await Promise.all([
      this.observacoes(meta.numerador_id, codigos, ref),
      this.observacoes(meta.denominador_id, codigos, ref),
    ]);
    const denPor = new Map(den.map((d) => [d.codigo_ibge, d]));
    const pares: { num: LinhaObs; den: LinhaObs; valor: number }[] = [];
    for (const nu of num) {
      const de = denPor.get(nu.codigo_ibge);
      if (!de || Number(de.valor) === 0 || nu.data_referencia !== de.data_referencia) continue;
      pares.push({
        num: nu,
        den: de,
        valor: Number(((Number(nu.valor) / Number(de.valor)) * meta.fator_escala).toFixed(1)),
      });
    }
    return pares;
  }

  /**
   * Valor por município para o mapa coroplético (Onda 2): a observação
   * mais recente ≤ referência, município a município, com a procedência
   * resumida. Municípios sem dado NÃO entram na lista (RN-005: ausência
   * é resposta — o mapa os pinta como "sem dado", nunca como zero).
   *
   * RECALCULO (Gauntlet P6 rodada 2): taxa não materializa observação
   * própria — os valores municipais vêm do MESMO pareamento do ranking
   * (paresRecalculo). Procedência reduzida: `fonte` declara as fontes das
   * DUAS parcelas juntas ("SIM/... + SINASC/...", mesma convenção da
   * exportação P5) e `data_referencia` é a referência comum do par — nunca
   * uma parcela escolhida em silêncio.
   */
  async mapa(params: { indicadorId: number; referencia?: string | null }) {
    const meta = await this.meta(params.indicadorId); // impõe APROVADO (RG-09)
    const ref = params.referencia ?? new Date().toISOString().slice(0, 10);
    // E21 (db/66): mesma malha vigente que o ranking usa. Aqui a mudança é
    // numericamente INERTE hoje (município não instalado não tem observação
    // ≤ ref, então já não entrava na lista) — o motivo de fazê-la mesmo
    // assim é a coerência declarada em paresRecalculo(): ranking e
    // coroplético do mesmo dossiê partem do MESMO universo, por construção
    // e não por coincidência aritmética.
    const codigos = await this.malhaVigente(ref);
    let municipios: {
      codigo_ibge: string;
      valor: number;
      data_referencia: string;
      fonte: string;
      status_dado?: StatusDado;
    }[];
    if (meta.tipo_agregacao === 'RECALCULO') {
      const pares = await this.paresRecalculo(meta, codigos.map((c) => c.codigo), ref);
      municipios = pares.map((p) => {
        // E3: a taxa herda o PIOR status das duas parcelas (PRELIMINAR contamina).
        const status = piorStatus([p.num.status_dado, p.den.status_dado]);
        return {
          codigo_ibge: p.num.codigo_ibge,
          valor: p.valor,
          data_referencia: p.num.data_referencia, // = p.den.data_referencia (guarda de mesma referência)
          fonte: [...new Set([p.num.fonte, p.den.fonte])].join(' + '),
          ...(status !== undefined ? { status_dado: status } : {}),
        };
      });
    } else {
      const linhas = await this.observacoes(
        params.indicadorId,
        codigos.map((c) => c.codigo),
        ref,
      );
      municipios = linhas.map((l) => ({
        codigo_ibge: l.codigo_ibge,
        valor: Number(l.valor),
        data_referencia: l.data_referencia,
        fonte: l.fonte,
        ...(l.status_dado !== null ? { status_dado: l.status_dado } : {}),
      }));
    }
    return {
      indicador: meta.nome,
      unidade: meta.unidade,
      referencia: ref,
      municipios,
    };
  }

  /**
   * Ranking completo dos municípios do estado pelo valor do indicador
   * (Gauntlet P2 · MOTOR-RANKING). Determinístico de ponta a ponta:
   *
   * - valor municipal = observação vigente ≤ referência (mesma regra do
   *   motor); em RECALCULO o valor é (num/den)×FatorEscala do PRÓPRIO município e
   *   só entra quem tem AMBAS as parcelas NA MESMA referência e com
   *   denominador ≠ 0 (RN-005 — sem imputação; taxa 0 com parcelas válidas
   *   é resultado legítimo e ENTRA);
   * - ordem: valor decrescente; empate = MESMA posição (competition
   *   ranking 1,2,2,4) com desempate de exibição por nome (comparação por
   *   code unit — estável entre ambientes/locales) e código IBGE;
   * - média estadual = rollup do PRÓPRIO motor (consultarNucleo/ESTADO,
   *   RN-003), nunca reimplementado: para RECALCULO e MEDIA_PONDERADA o
   *   valor estadual JÁ é a média de referência; para SOMA o rollup é um
   *   total, então a média é total ÷ municípios agregados pelo motor;
   *   NAO_AGREGAVEL não tem média estadual, mas o ranking permanece
   *   válido (cada valor é municipal) — media_estadual: null com motivo;
   * - município sem dado fica FORA, listado em `ausentes` (RN-005);
   * - indicador sem NENHUMA observação propaga a NotFoundException com
   *   contexto de `ausencia()` (referência mais recente, cobertura);
   * - procedência completa (quinteto, §12.1) por linha.
   */
  async ranking(params: {
    indicadorId: number;
    referencia?: string | null;
    n?: number;
  }): Promise<Ranking> {
    const meta = await this.meta(params.indicadorId); // RG-09: só APROVADO
    const ref = params.referencia ?? new Date().toISOString().slice(0, 10);
    const n = Math.min(Math.max(Math.trunc(params.n ?? 5), 1), 142);
    const { rotulo } = await this.territorio.resolverRecorte('ESTADO', null, ref);

    // E21 (db/66): o universo é a malha VIGENTE em `ref`, não os 142 fixos.
    // É aqui que a correção é visível: `total_municipios` e `ausentes` são
    // publicados ao usuário ("N municípios sem dado" no dossiê). Município
    // não instalado na referência sai dos DOIS — não é ausência (RN-005).
    const todos = await this.malhaVigente(ref);
    const nomePor = new Map(todos.map((m) => [m.codigo, m.nome]));
    const codigos = todos.map((m) => m.codigo);

    // Mesmo arredondamento que consultar() publica (RECALCULO: 1 casa).
    const casas = meta.tipo_agregacao === 'RECALCULO' ? 1 : 2;
    const valores: { codigo_ibge: string; valor: number; procedencia: Procedencia[] }[] = [];

    if (meta.tipo_agregacao === 'RECALCULO') {
      // RN-005: sem AMBAS as parcelas (ou com denominador zero, taxa
      // incalculável) o município fica FORA — nunca imputado, nunca zero
      // imputado. (Numerador 0 com denominador > 0 é taxa 0 LEGÍTIMA —
      // o melhor resultado possível — e ENTRA no ranking.)
      // Guarda de MESMA REFERÊNCIA (rodada 2 do gauntlet P3): parcelas de
      // taxa são dados de EVENTO (contagens anuais) — vigências "≤ ref"
      // descasadas (óbitos de um ano ÷ nascidos de outro) fabricariam uma
      // taxa herdada do passado; município divergente vai para `ausentes`.
      // Pareamento e cálculo em paresRecalculo — o MESMO usado por mapa()
      // (P6 rodada 2: ranking e coroplético do dossiê nunca mais divergem).
      const pares = await this.paresRecalculo(meta, codigos, ref);
      for (const p of pares) {
        valores.push({
          codigo_ibge: p.num.codigo_ibge,
          valor: p.valor,
          procedencia: this.procedenciaDe([p.num, p.den]),
        });
      }
    } else {
      // SOMA / MEDIA_PONDERADA / NAO_AGREGAVEL: o valor municipal é a
      // própria observação vigente (peso e rollup só existem no agregado).
      const linhas = await this.observacoes(params.indicadorId, codigos, ref);
      for (const l of linhas) {
        valores.push({
          codigo_ibge: l.codigo_ibge,
          valor: Number(Number(l.valor).toFixed(casas)),
          procedencia: this.procedenciaDe([l]),
        });
      }
    }

    if (!valores.length) return this.ausencia(meta, rotulo, 'ESTADO', params.indicadorId, ref);

    // Média (e total, quando fizer sentido) estaduais pelo MESMO rollup do
    // motor — nunca reimplementados aqui.
    let mediaEstadual: number | null = null;
    let totalEstadual: number | null = null;
    let mediaMotivo: string | undefined;
    if (meta.tipo_agregacao === 'NAO_AGREGAVEL') {
      mediaMotivo =
        `O indicador "${meta.nome}" é NAO_AGREGAVEL (RN-003): não existe média estadual válida. ` +
        `O ranking entre municípios permanece válido porque cada valor é municipal.`;
    } else {
      const estado = await this.consultarNucleo({
        indicadorId: params.indicadorId,
        recorte: 'ESTADO',
        codigo: null,
        dataReferencia: ref,
      });
      if (meta.tipo_agregacao === 'SOMA') {
        totalEstadual = estado.valor; // contagem: o rollup É o total do estado
        mediaEstadual = Number(
          (estado.valor / (estado.municipios_agregados ?? valores.length)).toFixed(2),
        );
      } else {
        mediaEstadual = estado.valor; // RECALCULO/MEDIA_PONDERADA: o rollup JÁ é a média
      }
    }

    // Ordenação determinística: valor desc; empate exibido por nome
    // (code unit, estável entre locales) e, por fim, código IBGE.
    valores.sort((a, b) => {
      if (b.valor !== a.valor) return b.valor - a.valor;
      const na = nomePor.get(a.codigo_ibge) ?? a.codigo_ibge;
      const nb = nomePor.get(b.codigo_ibge) ?? b.codigo_ibge;
      if (na !== nb) return na < nb ? -1 : 1;
      return a.codigo_ibge < b.codigo_ibge ? -1 : 1;
    });

    // Competition ranking (1,2,2,4) nas duas pontas: topo e base.
    const total = valores.length;
    const posicoes = new Array<number>(total);
    for (let i = 0, p = 1; i < total; i++) {
      if (i > 0 && valores[i].valor !== valores[i - 1].valor) p = i + 1;
      posicoes[i] = p;
    }
    const posicoesInversas = new Array<number>(total);
    for (let i = total - 1, p = 1; i >= 0; i--) {
      if (i < total - 1 && valores[i].valor !== valores[i + 1].valor) p = total - i;
      posicoesInversas[i] = p;
    }

    const municipios: RankingMunicipio[] = valores.map((v, i) => ({
      posicao: posicoes[i],
      codigo_ibge: v.codigo_ibge,
      nome: nomePor.get(v.codigo_ibge) ?? v.codigo_ibge,
      valor: v.valor,
      delta_media_estadual:
        mediaEstadual === null ? null : Number((v.valor - mediaEstadual).toFixed(2)),
      top_n: posicoes[i] <= n,
      bottom_n: posicoesInversas[i] <= n,
      procedencia: v.procedencia,
    }));

    const comDado = new Set(valores.map((v) => v.codigo_ibge));
    const ausentes = codigos.filter((c) => !comDado.has(c)).sort();

    const resposta: Ranking = {
      indicador: meta.nome,
      unidade: meta.unidade,
      referencia: ref,
      agregacao: meta.tipo_agregacao,
      total_estadual: totalEstadual,
      media_estadual: mediaEstadual,
      ...(mediaMotivo !== undefined ? { media_estadual_motivo: mediaMotivo } : {}),
      total_municipios: codigos.length,
      ausentes: { total: ausentes.length, codigos: ausentes },
      municipios,
    };

    // Trilha imutável, análoga a CONSULTA_INDICADOR (RF-CHAT-009).
    await this.auditoria.registrar('api', 'CONSULTA_RANKING', 'Indicador', String(params.indicadorId), {
      referencia: ref,
      n,
      total_municipios: resposta.total_municipios,
      ausentes: resposta.ausentes.total,
      media_estadual: mediaEstadual,
    });

    return resposta;
  }

  /**
   * Decomposição por causa/categoria no território (Gauntlet P3 · MOTOR-CAUSAS).
   * Lê a tabela irmã "ObservacaoCausa" (db/49): valores ABSOLUTOS por
   * (dimensão, categoria) na referência VIGENTE de cada dimensão — a mais
   * recente ≤ referência pedida — mais a participação % sobre o total da
   * dimensão (1 casa). Determinístico de ponta a ponta:
   *
   * - território: município (codigo) ou estado (codigo null → linhas com
   *   "ObservacaoCausa_CodigoIbge" IS NULL, o recorte estadual da carga);
   * - taxa (RECALCULO) sem decomposição própria delega ao NUMERADOR — a
   *   decomposição de uma taxa é a decomposição do que ela conta
   *   (`decomposicao_de` declara a delegação na resposta);
   * - RN-005: sem linhas para o pedido, NotFoundException com contexto —
   *   quais dimensões EXISTEM para o território, ou qual a cobertura da
   *   dimensão pedida (referência mais recente, territórios cobertos);
   *   nunca zero, nunca estimativa;
   * - procedência (quinteto, §12.1) por dimensão, via JOIN Fonte/Carga.
   */
  async causas(params: {
    indicadorId: number;
    codigo?: string | null;
    referencia?: string | null;
    dimensao?: string | null;
  }): Promise<Causas> {
    const meta = await this.meta(params.indicadorId); // RG-09: só APROVADO
    const ref = params.referencia ?? new Date().toISOString().slice(0, 10);
    const codigo = params.codigo ?? null;
    const dimensao = params.dimensao ?? null;

    // Evolução E1: a allowlist vem do catálogo "DimensaoObservacao" (db/54),
    // não de lista fixa em código — 400 honesto com o vocabulário vigente.
    if (dimensao) {
      const catalogo = await this.dimensoesObservacao();
      if (!catalogo.some((d) => d.codigo === dimensao)) {
        throw new BadRequestException(
          `dimensao deve ser uma de: ${catalogo.map((d) => d.codigo).join(', ')}`,
        );
      }
    }

    const recorte: 'MUNICIPIO' | 'ESTADO' = codigo ? 'MUNICIPIO' : 'ESTADO';
    const { rotulo } = await this.territorio.resolverRecorte(recorte, codigo, ref);

    // A taxa não tem causa própria: decompõe-se o numerador (documentado).
    let alvoId = meta.id;
    let decomposicaoDe: string | undefined;
    if (meta.tipo_agregacao === 'RECALCULO' && meta.numerador_id) {
      const proprias = await this.db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM "ObservacaoCausa" WHERE "ObservacaoCausa_IndicadorId" = $1`,
        [meta.id],
      );
      if (proprias.rows[0].n === '0') {
        const num = await this.meta(meta.numerador_id);
        alvoId = num.id;
        decomposicaoDe = num.nome;
      }
    }

    const r = await this.db.query<{
      dimensao: Causas['dimensoes'][number]['dimensao'];
      categoria: string;
      valor: string;
      data_referencia: string;
      fonte: string;
      url: string | null;
      licenca: string;
      data_extracao: string | null;
      hash: string | null;
    }>(
      `SELECT oc."ObservacaoCausa_Dimensao"            AS dimensao,
              oc."ObservacaoCausa_Categoria"           AS categoria,
              oc."ObservacaoCausa_Valor"::text         AS valor,
              oc."ObservacaoCausa_DataReferencia"::text AS data_referencia,
              f."Fonte_Nome"                           AS fonte,
              f."Fonte_Url"                            AS url,
              f."Fonte_Licenca"                        AS licenca,
              c."Carga_DataExtracao"::text             AS data_extracao,
              c."Carga_HashSha256"                     AS hash
         FROM "ObservacaoCausa" oc
         JOIN "Fonte" f ON f."Fonte_Id" = oc."ObservacaoCausa_FonteId"
         LEFT JOIN "Carga" c ON c."Carga_Id" = oc."ObservacaoCausa_CargaId"
        WHERE oc."ObservacaoCausa_IndicadorId" = $1
          AND oc."ObservacaoCausa_CodigoIbge" IS NOT DISTINCT FROM $2
          AND ($3::text IS NULL OR oc."ObservacaoCausa_Dimensao" = $3)
          -- referência vigente POR dimensão: a mais recente ≤ pedida
          AND oc."ObservacaoCausa_DataReferencia" = (
                SELECT max(x."ObservacaoCausa_DataReferencia")
                  FROM "ObservacaoCausa" x
                 WHERE x."ObservacaoCausa_IndicadorId" = oc."ObservacaoCausa_IndicadorId"
                   AND x."ObservacaoCausa_CodigoIbge" IS NOT DISTINCT FROM $2
                   AND x."ObservacaoCausa_Dimensao" = oc."ObservacaoCausa_Dimensao"
                   AND x."ObservacaoCausa_DataReferencia" <= $4::date)
        ORDER BY dimensao, oc."ObservacaoCausa_Valor" DESC, categoria`,
      [alvoId, codigo, dimensao, ref],
    );

    if (!r.rows.length) return this.ausenciaCausas(meta, alvoId, rotulo, codigo, dimensao, ref);

    const porDimensao = new Map<string, typeof r.rows>();
    for (const linha of r.rows) {
      if (!porDimensao.has(linha.dimensao)) porDimensao.set(linha.dimensao, []);
      porDimensao.get(linha.dimensao)!.push(linha);
    }

    const dimensoes: CausaDimensao[] = [...porDimensao.entries()].map(([dim, linhas]) => {
      const total = linhas.reduce((s, l) => s + Number(l.valor), 0);
      const procedencia = new Map<string, Procedencia>();
      for (const l of linhas) {
        const chave = `${l.fonte}|${l.data_referencia}|${l.hash ?? ''}`;
        if (!procedencia.has(chave))
          procedencia.set(chave, {
            fonte: l.fonte,
            url: l.url,
            data_referencia: l.data_referencia,
            data_extracao: l.data_extracao ?? '',
            licenca: l.licenca,
            hash: l.hash ?? '',
          });
      }
      return {
        dimensao: dim as CausaDimensao['dimensao'],
        referencia: linhas[0].data_referencia,
        total,
        categorias: linhas.map((l) => ({
          categoria: l.categoria,
          valor: Number(l.valor),
          participacao: total === 0 ? 0 : Number(((Number(l.valor) / total) * 100).toFixed(1)),
        })),
        procedencia: [...procedencia.values()],
      };
    });

    const resposta: Causas = {
      indicador: meta.nome,
      unidade: meta.unidade,
      recorte,
      local: rotulo,
      referencia: ref,
      ...(decomposicaoDe !== undefined ? { decomposicao_de: decomposicaoDe } : {}),
      dimensoes,
    };

    // Trilha imutável, análoga a CONSULTA_INDICADOR/CONSULTA_RANKING.
    await this.auditoria.registrar('api', 'CONSULTA_CAUSAS', 'Indicador', String(params.indicadorId), {
      codigo,
      referencia: ref,
      dimensao,
      dimensoes: dimensoes.map((d) => ({ dimensao: d.dimensao, referencia: d.referencia, categorias: d.categorias.length })),
    });

    return resposta;
  }

  /** RN-005 aplicada à decomposição: a ausência responde com o que EXISTE. */
  private async ausenciaCausas(
    meta: MetaIndicador,
    alvoId: number,
    rotulo: string,
    codigo: string | null,
    dimensao: string | null,
    ref: string,
  ): Promise<never> {
    const disp = await this.db.query<{ dimensao: string; ultima: string; territorios: string }>(
      `SELECT "ObservacaoCausa_Dimensao" AS dimensao,
              max("ObservacaoCausa_DataReferencia")::text AS ultima,
              count(DISTINCT coalesce("ObservacaoCausa_CodigoIbge",'ESTADO'))::text AS territorios
         FROM "ObservacaoCausa"
        WHERE "ObservacaoCausa_IndicadorId" = $1
        GROUP BY 1 ORDER BY 1`,
      [alvoId],
    );
    if (!disp.rows.length) {
      throw new NotFoundException(
        `Não há decomposição por causa publicada para "${meta.nome}". ` +
          `O eixo de causas pode estar em construção ou sem fonte mapeada.`,
      );
    }
    const doTerritorio = await this.db.query<{ dimensao: string; ultima: string }>(
      `SELECT "ObservacaoCausa_Dimensao" AS dimensao,
              max("ObservacaoCausa_DataReferencia")::text AS ultima
         FROM "ObservacaoCausa"
        WHERE "ObservacaoCausa_IndicadorId" = $1
          AND "ObservacaoCausa_CodigoIbge" IS NOT DISTINCT FROM $2
        GROUP BY 1 ORDER BY 1`,
      [alvoId, codigo],
    );
    const catalogo = disp.rows
      .map((d) => `${d.dimensao} (até ${d.ultima}, ${d.territorios} território(s))`)
      .join('; ');
    if (doTerritorio.rows.length) {
      throw new NotFoundException(
        `Não há decomposição ${dimensao ?? 'por causa'} de "${meta.nome}" para ${rotulo} até ${ref}. ` +
          `Para este território existem: ${doTerritorio.rows.map((d) => `${d.dimensao} (até ${d.ultima})`).join('; ')}.`,
      );
    }
    throw new NotFoundException(
      `Não há decomposição por causa de "${meta.nome}" para ${rotulo}. ` +
        `Dimensões disponíveis na base: ${catalogo}.`,
    );
  }
}
