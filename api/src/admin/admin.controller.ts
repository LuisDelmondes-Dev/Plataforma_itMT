import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

/**
 * Autenticação do módulo ADMIN por token Bearer (RNF-05, recorte MVP).
 * Em produção: SSO institucional com MFA obrigatório — este guard é o
 * ponto único de troca. Token: variável ADMIN_TOKEN.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const auth: string = req.headers['authorization'] ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const esperado = process.env.ADMIN_TOKEN ?? 'itmt-admin-dev';
    // comparação em tempo constante — não vaza o prefixo por timing
    const a = createHash('sha256').update(token).digest();
    const b = createHash('sha256').update(esperado).digest();
    return timingSafeEqual(a, b);
  }
}

interface ParecerDto {
  parecerista: string;
  decisao: 'APROVADO' | 'REJEITADO';
  justificativa: string;
}

interface AutorizacaoDto {
  tipo: string;
  numero: string;
  orgao: string;
  descricao?: string;
  vigencia_inicio: string;
  vigencia_fim: string;
}

interface IndicadorDto {
  subtema_id: number;
  nome: string;
  unidade: string;
  tipo_agregacao: 'SOMA' | 'MEDIA_PONDERADA' | 'RECALCULO' | 'NAO_AGREGAVEL';
  numerador_id?: number;
  denominador_id?: number;
  metodologia_url?: string;
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ---------- RF-ADMIN-003/004: validação técnica de indicador ----------

  /** Submissão: indicador nasce EM_ANALISE — não aparece no portal (RG-09). */
  @Post('indicadores')
  async submeterIndicador(@Body() dto: IndicadorDto) {
    if (!dto?.nome || !dto?.subtema_id || !dto?.unidade || !dto?.tipo_agregacao) {
      throw new BadRequestException('Campos obrigatórios: subtema_id, nome, unidade, tipo_agregacao.');
    }
    if (dto.tipo_agregacao === 'RECALCULO' && (!dto.numerador_id || !dto.denominador_id)) {
      throw new BadRequestException('RECALCULO exige numerador_id e denominador_id (RN-003).');
    }
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO "Indicador"
         ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao",
          "Indicador_NumeradorId","Indicador_DenominadorId","Indicador_MetodologiaUrl","Indicador_StatusValidacao")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'EM_ANALISE') RETURNING "Indicador_Id" AS id`,
      [dto.subtema_id, dto.nome, dto.unidade, dto.tipo_agregacao,
       dto.numerador_id ?? null, dto.denominador_id ?? null, dto.metodologia_url ?? null],
    );
    await this.auditoria.registrar('admin', 'SUBMISSAO_INDICADOR', 'Indicador', String(r.rows[0].id), {
      nome: dto.nome, tipo_agregacao: dto.tipo_agregacao,
    });
    return { id: r.rows[0].id, status: 'EM_ANALISE' };
  }

  /** Fila de validação. */
  @Get('indicadores/pendentes')
  async pendentes() {
    const r = await this.db.query(
      `SELECT i."Indicador_Id" AS id, i."Indicador_Nome" AS nome, i."Indicador_Unidade" AS unidade,
              i."Indicador_TipoAgregacao" AS tipo_agregacao, s."SubtemaConsulta_Nome" AS subtema
         FROM "Indicador" i JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_Id" = i."Indicador_SubtemaId"
        WHERE i."Indicador_StatusValidacao" = 'EM_ANALISE' ORDER BY i."Indicador_Id"`,
    );
    return r.rows;
  }

  /**
   * Parecer: aprova ou rejeita com justificativa registrada, assinada e
   * versionada (RF-ADMIN-004). Só o parecer favorável publica (RG-09).
   */
  @Post('indicadores/:id/parecer')
  async parecer(@Param('id', ParseIntPipe) id: number, @Body() dto: ParecerDto) {
    if (!dto?.parecerista || !dto?.justificativa || !['APROVADO', 'REJEITADO'].includes(dto?.decisao)) {
      throw new BadRequestException('Campos obrigatórios: parecerista, decisao (APROVADO|REJEITADO), justificativa.');
    }
    const ind = await this.db.query(
      `SELECT "Indicador_Nome" AS nome FROM "Indicador" WHERE "Indicador_Id" = $1`, [id],
    );
    if (!ind.rows[0]) throw new NotFoundException(`Indicador ${id} não encontrado.`);

    await this.db.query(
      `INSERT INTO "ParecerValidacao"
         ("ParecerValidacao_IndicadorId","ParecerValidacao_Parecerista","ParecerValidacao_Decisao","ParecerValidacao_Justificativa")
       VALUES ($1,$2,$3,$4)`,
      [id, dto.parecerista, dto.decisao, dto.justificativa],
    );
    await this.db.query(
      `UPDATE "Indicador" SET "Indicador_StatusValidacao" = $2 WHERE "Indicador_Id" = $1`,
      [id, dto.decisao === 'APROVADO' ? 'APROVADO' : 'REJEITADO'],
    );
    await this.auditoria.registrar('admin', 'PARECER_INDICADOR', 'Indicador', String(id), {
      parecerista: dto.parecerista, decisao: dto.decisao, justificativa: dto.justificativa,
    });
    return { id, indicador: ind.rows[0].nome, status: dto.decisao };
  }

  // ---------- RF-ADMIN-001: autorizações com alerta de vencimento ----------

  @Post('autorizacoes')
  async criarAutorizacao(@Body() dto: AutorizacaoDto) {
    const obrig = ['tipo', 'numero', 'orgao', 'vigencia_inicio', 'vigencia_fim'] as const;
    for (const c of obrig) if (!dto?.[c]) throw new BadRequestException(`Campo obrigatório: ${c}.`);
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO "Autorizacao"
         ("Autorizacao_Tipo","Autorizacao_Numero","Autorizacao_Orgao","Autorizacao_Descricao",
          "Autorizacao_VigenciaInicio","Autorizacao_VigenciaFim")
       VALUES ($1,$2,$3,$4,$5::date,$6::date) RETURNING "Autorizacao_Id" AS id`,
      [dto.tipo, dto.numero, dto.orgao, dto.descricao ?? null, dto.vigencia_inicio, dto.vigencia_fim],
    );
    await this.auditoria.registrar('admin', 'CADASTRO_AUTORIZACAO', 'Autorizacao', String(r.rows[0].id), {
      tipo: dto.tipo, numero: dto.numero, orgao: dto.orgao, vigencia_fim: dto.vigencia_fim,
    });
    return { id: r.rows[0].id };
  }

  @Get('autorizacoes')
  async listarAutorizacoes() {
    const r = await this.db.query(
      `SELECT "Autorizacao_Id" AS id, "Autorizacao_Tipo" AS tipo, "Autorizacao_Numero" AS numero,
              "Autorizacao_Orgao" AS orgao, "Autorizacao_VigenciaInicio"::text AS vigencia_inicio,
              "Autorizacao_VigenciaFim"::text AS vigencia_fim,
              ("Autorizacao_VigenciaFim" - CURRENT_DATE) AS dias_restantes
         FROM "Autorizacao" ORDER BY "Autorizacao_VigenciaFim"`,
    );
    return r.rows;
  }

  /** Alertas D-90 / D-30 / D-7 (RF-ADMIN-001). */
  @Get('autorizacoes/vencimentos')
  async vencimentos() {
    const r = await this.db.query<{ id: number; numero: string; orgao: string; fim: string; dias: number }>(
      `SELECT "Autorizacao_Id" AS id, "Autorizacao_Numero" AS numero, "Autorizacao_Orgao" AS orgao,
              "Autorizacao_VigenciaFim"::text AS fim,
              ("Autorizacao_VigenciaFim" - CURRENT_DATE)::int AS dias
         FROM "Autorizacao"
        WHERE "Autorizacao_VigenciaFim" - CURRENT_DATE <= 90
        ORDER BY dias`,
    );
    const faixa = (d: number) =>
      d < 0 ? 'VENCIDA' : d <= 7 ? 'D-7' : d <= 30 ? 'D-30' : 'D-90';
    return r.rows.map((a) => ({ ...a, alerta: faixa(a.dias) }));
  }

  // ---------- RF-INGEST-010: visibilidade da quarentena ----------
  @Get('quarentena')
  async quarentena() {
    const r = await this.db.query(
      `SELECT q."Quarentena_Id" AS id, q."Quarentena_CargaId" AS carga_id, q."Quarentena_Motivo" AS motivo,
              q."Quarentena_Timestamp"::text AS quando, f."Fonte_Nome" AS fonte
         FROM "Quarentena" q
         JOIN "Carga" c ON c."Carga_Id" = q."Quarentena_CargaId"
         JOIN "Fonte" f ON f."Fonte_Id" = c."Carga_FonteId"
        ORDER BY q."Quarentena_Id" DESC LIMIT 200`,
    );
    return r.rows;
  }
}
