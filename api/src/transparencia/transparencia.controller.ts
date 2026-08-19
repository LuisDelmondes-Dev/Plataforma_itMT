import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * RF-ADMIN-007: área pública de transparência do próprio sistema —
 * inventário de bases (fontes), com base legal e licença.
 */
@Controller()
export class TransparenciaController {
  constructor(private readonly db: DatabaseService) {}

  @Get('fontes')
  async fontes() {
    const r = await this.db.query(
      `SELECT f."Fonte_Id" AS id, f."Fonte_Nome" AS nome, f."Fonte_Origem" AS origem,
              f."Fonte_Url" AS url, f."Fonte_BaseLegal" AS base_legal, f."Fonte_Licenca" AS licenca,
              f."Fonte_Periodicidade" AS periodicidade,
              max(c."Carga_DataExtracao")::text AS ultima_carga,
              count(c.*)::int AS cargas
         FROM "Fonte" f LEFT JOIN "Carga" c ON c."Carga_FonteId" = f."Fonte_Id"
        GROUP BY 1,2,3,4,5,6,7 ORDER BY f."Fonte_Id"`,
    );
    return r.rows;
  }

  /** Régua pública do primeiro lançamento: dado carregado não equivale a dado publicado. */
  @Get('transparencia/lancamento-f1')
  async lancamentoF1() {
    const r = await this.db.query(
      `SELECT ordem, tema, indicador_id, indicador, status_validacao,
              referencia::text, municipios_piloto, cobertura_pct::text,
              procedencia_ok, pronto_dados, pronto_publicacao,
              fonte_preferencial, observacao
         FROM "vw_ProntidaoLancamentoF1" ORDER BY ordem`,
    );
    const prontosDados = r.rows.filter((x: { pronto_dados: boolean }) => x.pronto_dados).length;
    const prontosPublicacao = r.rows.filter((x: { pronto_publicacao: boolean }) => x.pronto_publicacao).length;
    return {
      gate: 'F1 — 12 indicadores reais / 10 municípios piloto',
      total: r.rows.length,
      prontos_dados: prontosDados,
      prontos_publicacao: prontosPublicacao,
      aprovado: r.rows.length === 12 && prontosPublicacao === 12,
      indicadores: r.rows,
    };
  }
}
