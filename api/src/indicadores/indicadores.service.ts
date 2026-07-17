import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TerritorioService, Recorte } from '../territorio/territorio.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AgentesFonteService } from '../fontes/agentes-fonte.service';
import { Procedencia, ValorComProcedencia } from '../common/procedencia';

interface LinhaObs {
  codigo_ibge: string;
  valor: string;
  data_referencia: string;
  fonte: string;
  url: string | null;
  licenca: string;
  data_extracao: string;
  hash: string;
}

interface MetaIndicador {
  id: number;
  nome: string;
  unidade: string;
  tipo_agregacao: 'SOMA' | 'MEDIA_PONDERADA' | 'RECALCULO' | 'NAO_AGREGAVEL';
  numerador_id: number | null;
  denominador_id: number | null;
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

  private async meta(indicadorId: number): Promise<MetaIndicador> {
    const r = await this.db.query<MetaIndicador>(
      `SELECT "Indicador_Id" AS id, "Indicador_Nome" AS nome, "Indicador_Unidade" AS unidade,
              "Indicador_TipoAgregacao" AS tipo_agregacao,
              "Indicador_NumeradorId" AS numerador_id, "Indicador_DenominadorId" AS denominador_id
         FROM "Indicador" WHERE "Indicador_Id" = $1`,
      [indicadorId],
    );
    if (!r.rows[0]) throw new NotFoundException(`Indicador ${indicadorId} não encontrado.`);
    return r.rows[0];
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
              c."Carga_HashSha256"          AS hash
         FROM "Observacao" o
         JOIN "Fonte" f ON f."Fonte_Id" = o."Observacao_FonteId"
         JOIN "Carga" c ON c."Carga_Id" = o."Observacao_CargaId"
        WHERE o."Observacao_IndicadorId" = $1
          AND o."Observacao_CodigoIbge" = ANY($2)
          AND o."Observacao_DataReferencia" <= $3::date
        ORDER BY o."Observacao_CodigoIbge", o."Observacao_DataReferencia" DESC`,
      [indicadorId, codigos, dataReferencia],
    );
    return r.rows;
  }

  private procedenciaDe(linhas: LinhaObs[]): Procedencia[] {
    const vistos = new Map<string, Procedencia>();
    for (const l of linhas) {
      const chave = `${l.fonte}|${l.data_referencia}|${l.hash}`;
      if (!vistos.has(chave))
        vistos.set(chave, {
          fonte: l.fonte,
          url: l.url,
          data_referencia: l.data_referencia,
          data_extracao: l.data_extracao,
          licenca: l.licenca,
          hash: l.hash,
        });
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
      if (!linhas.length) return this.ausencia(meta, rotulo, recorte, indicadorId, dataReferencia);
      valor = linhas.reduce((s, l) => s + Number(l.valor), 0);
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
      // Só entram municípios com AMBAS as parcelas — sem imputação (RF-CHAT-006: nunca estimar)
      const comDen = new Set(den.map((d) => d.codigo_ibge));
      const numOk = num.filter((n) => comDen.has(n.codigo_ibge));
      const denOk = den.filter((d) => numOk.some((n) => n.codigo_ibge === d.codigo_ibge));
      if (!numOk.length) return this.ausencia(meta, rotulo, recorte, indicadorId, dataReferencia);
      const somaNum = numOk.reduce((s, l) => s + Number(l.valor), 0);
      const somaDen = denOk.reduce((s, l) => s + Number(l.valor), 0);
      if (somaDen === 0)
        throw new UnprocessableEntityException(`Denominador zero no recálculo de "${meta.nome}".`);
      valor = (somaNum / somaDen) * 100;
      linhas = [...numOk, ...denOk];
    } else {
      // MEDIA_PONDERADA — peso: população estimada (indicador 2 do catálogo demo).
      // Em produção o indicador-peso é declarado no catálogo, nunca fixo em código.
      const PESO_POPULACAO_ID = 2;
      const [vals, pesos] = await Promise.all([
        this.observacoes(indicadorId, codigos, dataReferencia),
        this.observacoes(PESO_POPULACAO_ID, codigos, dataReferencia),
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

    const resposta: ValorComProcedencia = {
      valor: Number(valor.toFixed(meta.tipo_agregacao === 'RECALCULO' ? 1 : 2)),
      unidade: meta.unidade,
      indicador: meta.nome,
      recorte,
      local: rotulo,
      agregacao: ehAgregado ? meta.tipo_agregacao : 'VALOR_MUNICIPAL',
      municipios_agregados: ehAgregado ? new Set(linhas.map((l) => l.codigo_ibge)).size : undefined,
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

  /** RF-ADMIN-002 (recorte simplificado): matriz de cobertura município × tema. */
  async cobertura() {
    const r = await this.db.query(
      `SELECT m."Municipio_CodigoIbge" AS codigo_ibge, m."Municipio_Nome" AS municipio,
              t."TemaConsulta_Id" AS tema_id, t."TemaConsulta_Nome" AS tema,
              max(o."Observacao_DataReferencia")::text AS ultima_referencia,
              count(o.*) AS observacoes
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
}
