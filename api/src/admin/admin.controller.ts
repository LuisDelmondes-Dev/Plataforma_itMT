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
import { DatabaseService, PLATFORM_PUBLIC_CONTEXT } from '../database/database.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ValidacaoTecnicaService } from './validacao-tecnica.service';
import { AgentExecutionService } from '../auth/agent-execution.service';
import { verificarToken } from '../auth/token';

/**
 * Autenticação do módulo ADMIN por Bearer. Aceita DOIS formatos, para
 * compatibilidade retroativa (RNF-05):
 *  1) o ADMIN_TOKEN estático (dev/CI, e integrações internas); e
 *  2) um token de sessão assinado (RF012) com papel ADMIN ou CURADOR.
 * Em produção o caminho (1) some em favor de SSO/MFA — este guard é o
 * ponto único de troca.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const auth: string = req.headers['authorization'] ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    // (1) ADMIN_TOKEN estático — comparação em tempo constante (não vaza por timing).
    const esperado = process.env.ADMIN_TOKEN ?? 'itmt-admin-dev';
    const a = createHash('sha256').update(token).digest();
    const b = createHash('sha256').update(esperado).digest();
    if (process.env.NODE_ENV !== 'production' && timingSafeEqual(a, b)) return true;
    // (2) token de sessão assinado com papel de gestão.
    const sessao = verificarToken(token);
    if (sessao && (sessao.papel === 'ADMIN' || sessao.papel === 'CURADOR')) {
      req.usuario = sessao;
      return true;
    }
    return false;
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
    private readonly validacao: ValidacaoTecnicaService,
    private readonly registry: AgentExecutionService,
  ) {}

  /** Registry (RF004): últimas execuções de agentes para inspeção operacional. */
  @Get('agentes/execucoes')
  execucoes() {
    return this.db.withTenantTransaction(PLATFORM_PUBLIC_CONTEXT, () => this.registry.recentes(100));
  }

  /** Agente de Validação Técnica: checagens automáticas (não decide — RG-09). */
  @Get('indicadores/:id/validacao')
  validar(@Param('id', ParseIntPipe) id: number) {
    return this.validacao.validar(id);
  }

  /** Dossiê para o revisor: procedência, amostra, cobertura, drift + validação técnica. */
  @Get('indicadores/:id/dossie')
  dossie(@Param('id', ParseIntPipe) id: number) {
    return this.validacao.dossie(id);
  }

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
    // RN-004: taxonomia é dado. A ingestão promove SEM_FONTE→EM_CONSTRUCAO
    // quando a carga chega; o parecer favorável fecha o ciclo promovendo o
    // subtema a DISPONIVEL — mas só se o indicador aprovado TEM observação
    // (aprovado sem dado continua EM_CONSTRUCAO; ausência é resposta, não
    // disponibilidade). Sem isto, a curadoria não fica navegável na UI.
    if (dto.decisao === 'APROVADO') {
      await this.db.query(
        `UPDATE "SubtemaConsulta" s SET "SubtemaConsulta_Status" = 'DISPONIVEL'
          WHERE s."SubtemaConsulta_Id" = (SELECT "Indicador_SubtemaId" FROM "Indicador" WHERE "Indicador_Id" = $1)
            AND s."SubtemaConsulta_Status" <> 'DISPONIVEL'
            AND EXISTS (SELECT 1 FROM "Observacao" o WHERE o."Observacao_IndicadorId" = $1)`,
        [id],
      );
    }
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
         FROM "Autorizacao" WHERE "Autorizacao_Status" = 'ATIVA'
        ORDER BY "Autorizacao_VigenciaFim"`,
    );
    return r.rows;
  }

  /**
   * Arquivamento (EV-20260822-055). Autorização não tinha ciclo de vida —
   * cadastrada uma vez, poluía os alertas D-90/30/7 para sempre (13 fixtures
   * de suíte faziam exatamente isso no dev). Mesmo desenho da despublicação
   * de direito (EV-047): exige responsável e motivo, audita, e NÃO apaga — a
   * autorização é registro de conformidade; some dos painéis, fica na base.
   */
  @Post('autorizacoes/:id/arquivar')
  async arquivarAutorizacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: { responsavel?: string; motivo?: string },
  ) {
    if (!d?.responsavel || !d?.motivo)
      throw new BadRequestException('Campos obrigatórios: responsavel, motivo.');
    const r = await this.db.query<{ id: number }>(
      `UPDATE "Autorizacao" SET "Autorizacao_Status"='ARQUIVADA'
        WHERE "Autorizacao_Id"=$1 AND "Autorizacao_Status"='ATIVA'
        RETURNING "Autorizacao_Id" AS id`, [id],
    );
    if (!r.rows[0]) throw new BadRequestException('Autorização inexistente ou já arquivada.');
    await this.auditoria.registrar('admin', 'ARQUIVAMENTO_AUTORIZACAO', 'Autorizacao', String(id), {
      responsavel: d.responsavel, motivo: d.motivo,
    });
    return { id, status: 'ARQUIVADA' };
  }

  /** Alertas D-90 / D-30 / D-7 (RF-ADMIN-001) — só autorizações ativas. */
  @Get('autorizacoes/vencimentos')
  async vencimentos() {
    const r = await this.db.query<{ id: number; numero: string; orgao: string; fim: string; dias: number }>(
      `SELECT "Autorizacao_Id" AS id, "Autorizacao_Numero" AS numero, "Autorizacao_Orgao" AS orgao,
              "Autorizacao_VigenciaFim"::text AS fim,
              ("Autorizacao_VigenciaFim" - CURRENT_DATE)::int AS dias
         FROM "Autorizacao"
        WHERE "Autorizacao_Status" = 'ATIVA'
          AND "Autorizacao_VigenciaFim" - CURRENT_DATE <= 90
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
