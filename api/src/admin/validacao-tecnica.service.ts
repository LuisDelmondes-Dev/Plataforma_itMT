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
      obs: number; municipios: number; min: string | null; max: string | null;
      ref_recente: string | null; ref_futuras: number;
      fontes: number; fontes_sem_licenca: number;
      cargas: number; cargas_bloqueadas: number;
    }>(
      `SELECT count(o.*)::int AS obs,
              count(DISTINCT o."Observacao_CodigoIbge")::int AS municipios,
              min(o."Observacao_Valor")::text AS min, max(o."Observacao_Valor")::text AS max,
              max(o."Observacao_DataReferencia")::text AS ref_recente,
              count(*) FILTER (WHERE o."Observacao_DataReferencia" > CURRENT_DATE)::int AS ref_futuras,
              count(DISTINCT f."Fonte_Id")::int AS fontes,
              count(DISTINCT f."Fonte_Id") FILTER (WHERE btrim(f."Fonte_Licenca") = '')::int AS fontes_sem_licenca,
              count(DISTINCT c."Carga_Id")::int AS cargas,
              count(DISTINCT c."Carga_Id") FILTER (WHERE c."Carga_Status" <> 'PROMOVIDA')::int AS cargas_bloqueadas
         FROM "Observacao" o
         JOIN "Fonte" f ON f."Fonte_Id" = o."Observacao_FonteId"
         JOIN "Carga" c ON c."Carga_Id" = o."Observacao_CargaId"
        WHERE o."Observacao_IndicadorId" = $1`, [indicadorId],
    );
    const s = stats.rows[0];
    const totalMun = (await this.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "Municipio"`)).rows[0].n;

    const checagens: Checagem[] = [
      {
        nome: 'Tem observações',
        ok: s.obs > 0,
        detalhe: `${s.obs} observação(ões) na base.`,
      },
      // EV-20260822-053: aqui havia duas checagens que NUNCA podiam falhar —
      // "Fonte presente" e "Data de referência presente" contam colunas
      // declaradas NOT NULL no DDL. O dossiê mostrava "6/6 ✓" ao parecerista
      // quando só 4 coisas eram de fato verificadas: confiança inflada numa
      // decisão humana (RG-09). Foram substituídas por checagens que podem
      // reprovar de verdade.
      {
        nome: 'Fonte com licença declarada (RG-06)',
        ok: s.obs > 0 && s.fontes_sem_licenca === 0,
        detalhe: s.fontes_sem_licenca > 0
          ? `${s.fontes_sem_licenca} fonte(s) sem licença preenchida.`
          : `Todas as ${s.fontes} fonte(s) declaram licença.`,
      },
      {
        nome: 'Datas de referência plausíveis (RN-007)',
        ok: s.obs > 0 && s.ref_futuras === 0,
        detalhe: s.ref_futuras > 0
          ? `${s.ref_futuras} observação(ões) com data no futuro — origem suspeita.`
          : `Nenhuma data futura; mais recente ${s.ref_recente?.slice(0, 10) ?? '—'}.`,
      },
      {
        nome: 'Cargas promovidas, sem drift bloqueado (RF-INGEST-005)',
        ok: s.obs > 0 && s.cargas_bloqueadas === 0,
        detalhe: s.cargas_bloqueadas > 0
          ? `${s.cargas_bloqueadas} carga(s) não promovida(s) alimentam este indicador — revise antes de publicar.`
          : `As ${s.cargas} carga(s) de origem estão promovidas.`,
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
