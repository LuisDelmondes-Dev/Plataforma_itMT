import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * Agente de Validação Técnica (catálogo AGENTS.md). Roda checagens
 * automáticas e DETERMINÍSTICAS sobre um indicador antes do parecer
 * humano — NUNCA aprova nem publica (RG-09 permanece humano). Serve de
 * insumo ao dossiê de parecer.
 */
export interface Checagem { nome: string; ok: boolean; detalhe: string }
export interface RelatorioValidacao {
  indicador_id: number;
  indicador: string;
  checagens: Checagem[];
  aprovado_tecnicamente: boolean; // todas as checagens passaram — recomendação, não decisão
}

@Injectable()
export class ValidacaoTecnicaService {
  constructor(private readonly db: DatabaseService) {}

  async validar(indicadorId: number): Promise<RelatorioValidacao> {
    const meta = await this.db.query<{
      nome: string; unidade: string; tipo: string; status: string;
    }>(
      `SELECT "Indicador_Nome" AS nome, "Indicador_Unidade" AS unidade,
              "Indicador_TipoAgregacao" AS tipo, "Indicador_StatusValidacao" AS status
         FROM "Indicador" WHERE "Indicador_Id" = $1`, [indicadorId],
    );
    if (!meta.rows[0]) throw new NotFoundException(`Indicador ${indicadorId} não encontrado.`);
    const m = meta.rows[0];

    const stats = await this.db.query<{
      obs: number; municipios: number; com_fonte: number; com_ref: number;
      min: string | null; max: string | null; ref_recente: string | null;
    }>(
      `SELECT count(*)::int AS obs,
              count(DISTINCT "Observacao_CodigoIbge")::int AS municipios,
              count(*) FILTER (WHERE "Observacao_FonteId" IS NOT NULL)::int AS com_fonte,
              count(*) FILTER (WHERE "Observacao_DataReferencia" IS NOT NULL)::int AS com_ref,
              min("Observacao_Valor")::text AS min, max("Observacao_Valor")::text AS max,
              max("Observacao_DataReferencia")::text AS ref_recente
         FROM "Observacao" WHERE "Observacao_IndicadorId" = $1`, [indicadorId],
    );
    const s = stats.rows[0];
    const totalMun = (await this.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "Municipio"`)).rows[0].n;

    const checagens: Checagem[] = [
      {
        nome: 'Tem observações',
        ok: s.obs > 0,
        detalhe: `${s.obs} observação(ões) na base.`,
      },
      {
        nome: 'Fonte presente em todo valor (RG-06)',
        ok: s.obs > 0 && s.com_fonte === s.obs,
        detalhe: `${s.com_fonte}/${s.obs} com Fonte vinculada.`,
      },
      {
        nome: 'Data de referência presente (RN-005/07)',
        ok: s.obs > 0 && s.com_ref === s.obs,
        detalhe: `${s.com_ref}/${s.obs} com data de referência; mais recente ${s.ref_recente?.slice(0, 10) ?? '—'}.`,
      },
      {
        nome: 'Unidade declarada',
        ok: Boolean(m.unidade && m.unidade.trim()),
        detalhe: `unidade = "${m.unidade}".`,
      },
      {
        nome: 'Valores plausíveis (não-negativos para estoque SOMA)',
        ok: m.tipo !== 'SOMA' || s.min === null || Number(s.min) >= 0,
        detalhe: `faixa [${s.min ?? '—'} … ${s.max ?? '—'}] (tipo ${m.tipo}).`,
      },
      {
        nome: 'Cobertura territorial',
        ok: s.municipios > 0,
        detalhe: `${s.municipios}/${totalMun} municípios com dado.`,
      },
    ];

    return {
      indicador_id: indicadorId,
      indicador: m.nome,
      checagens,
      aprovado_tecnicamente: checagens.every((c) => c.ok),
    };
  }

  /** Dossiê para o revisor humano (RG-09): consolida procedência, amostra, cobertura, drift e validação. */
  async dossie(indicadorId: number) {
    const validacao = await this.validar(indicadorId);

    const fonte = await this.db.query(
      `SELECT DISTINCT f."Fonte_Nome" AS nome, f."Fonte_Origem" AS origem, f."Fonte_Url" AS url,
              f."Fonte_BaseLegal" AS base_legal, f."Fonte_Licenca" AS licenca, f."Fonte_Periodicidade" AS periodicidade
         FROM "Observacao" o JOIN "Fonte" f ON f."Fonte_Id" = o."Observacao_FonteId"
        WHERE o."Observacao_IndicadorId" = $1`, [indicadorId],
    );
    const amostra = await this.db.query(
      `SELECT o."Observacao_CodigoIbge" AS codigo_ibge, m."Municipio_Nome" AS municipio,
              o."Observacao_Valor"::text AS valor, o."Observacao_DataReferencia"::text AS referencia
         FROM "Observacao" o JOIN "Municipio" m ON m."Municipio_CodigoIbge" = o."Observacao_CodigoIbge"
        WHERE o."Observacao_IndicadorId" = $1
        ORDER BY o."Observacao_DataReferencia" DESC, m."Municipio_Nome" LIMIT 5`, [indicadorId],
    );
    // Status de drift das cargas que alimentaram este indicador (RF-INGEST-005)
    const drift = await this.db.query(
      `SELECT DISTINCT c."Carga_Status" AS status
         FROM "Observacao" o JOIN "Carga" c ON c."Carga_Id" = o."Observacao_CargaId"
        WHERE o."Observacao_IndicadorId" = $1`, [indicadorId],
    );

    return {
      ...validacao,
      fontes: fonte.rows,
      amostra: amostra.rows,
      cargas_status: drift.rows.map((r: { status: string }) => r.status),
      observacao: 'Dossiê é insumo — a publicação continua sendo ato humano (RG-09).',
    };
  }
}
