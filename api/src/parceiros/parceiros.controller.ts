import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseIntPipe,
  Post, Req, UseGuards,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Papeis, PapeisGuard } from '../auth/papeis.guard';
import { Sessao } from '../auth/token';

interface ContribuicaoDto {
  tipo?: 'OBSERVACAO' | 'ESTUDO' | 'FONTE';
  titulo: string;
  descricao?: string;
  payload?: unknown;
}
interface ParecerDto {
  decisao: 'APROVADA' | 'REJEITADA';
  justificativa: string;
}

/**
 * Onda 6 — co-produção multi-ator (universidade, empresa, sociedade civil).
 * PARCEIRO/UNIVERSIDADE submetem; a contribuição nasce EM_ANALISE e só um
 * CURADOR/ADMIN decide, com justificativa (RG-09 estendido). Cada passo
 * emite EventoAuditoria imutável (RG-10) — quem contribuiu, quem decidiu.
 */
@Controller('parceiros')
@UseGuards(PapeisGuard)
export class ParceirosController {
  constructor(private readonly db: DatabaseService, private readonly trilha: AuditoriaService) {}

  /** Submissão por parceiro — nasce EM_ANALISE, nunca publica sozinha. */
  @Post('contribuicoes')
  @Papeis('PARCEIRO', 'UNIVERSIDADE', 'CURADOR', 'ADMIN')
  async submeter(@Body() dto: ContribuicaoDto, @Req() req: { usuario: Sessao }) {
    if (!dto?.titulo) throw new BadRequestException('Campo obrigatório: titulo.');
    const tipo = dto.tipo ?? 'OBSERVACAO';
    if (!['OBSERVACAO', 'ESTUDO', 'FONTE'].includes(tipo))
      throw new BadRequestException('tipo ∈ {OBSERVACAO, ESTUDO, FONTE}.');
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO "ContribuicaoDado"
         ("ContribuicaoDado_AutorEmail","ContribuicaoDado_AutorPapel","ContribuicaoDado_Tipo",
          "ContribuicaoDado_Titulo","ContribuicaoDado_Descricao","ContribuicaoDado_Payload")
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING "ContribuicaoDado_Id" AS id`,
      [req.usuario.sub, req.usuario.papel, tipo, dto.titulo, dto.descricao ?? null,
       dto.payload != null ? JSON.stringify(dto.payload) : null],
    );
    await this.trilha.registrar(req.usuario.sub, 'SUBMISSAO_CONTRIBUICAO', 'ContribuicaoDado',
      String(r.rows[0].id), { papel: req.usuario.papel, tipo, titulo: dto.titulo });
    return { id: r.rows[0].id, status: 'EM_ANALISE' };
  }

  /** Fila de curadoria. */
  @Get('contribuicoes/pendentes')
  @Papeis('CURADOR', 'ADMIN')
  async pendentes() {
    const r = await this.db.query(
      `SELECT "ContribuicaoDado_Id" AS id, "ContribuicaoDado_Quando"::text AS quando,
              "ContribuicaoDado_AutorEmail" AS autor, "ContribuicaoDado_AutorPapel" AS papel,
              "ContribuicaoDado_Tipo" AS tipo, "ContribuicaoDado_Titulo" AS titulo,
              "ContribuicaoDado_Descricao" AS descricao
         FROM "ContribuicaoDado" WHERE "ContribuicaoDado_Status" = 'EM_ANALISE'
        ORDER BY "ContribuicaoDado_Id"`,
    );
    return r.rows;
  }

  /** Parecer humano: só CURADOR/ADMIN decidem, sempre com justificativa. */
  @Post('contribuicoes/:id/parecer')
  @Papeis('CURADOR', 'ADMIN')
  async parecer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ParecerDto,
    @Req() req: { usuario: Sessao },
  ) {
    if (!dto?.justificativa || !['APROVADA', 'REJEITADA'].includes(dto?.decisao))
      throw new BadRequestException('Campos: decisao (APROVADA|REJEITADA), justificativa.');
    const r = await this.db.query<{ titulo: string }>(
      `UPDATE "ContribuicaoDado"
          SET "ContribuicaoDado_Status" = $2, "ContribuicaoDado_Parecerista" = $3,
              "ContribuicaoDado_Justificativa" = $4, "ContribuicaoDado_DecididaEm" = now()
        WHERE "ContribuicaoDado_Id" = $1 AND "ContribuicaoDado_Status" = 'EM_ANALISE'
        RETURNING "ContribuicaoDado_Titulo" AS titulo`,
      [id, dto.decisao, req.usuario.sub, dto.justificativa],
    );
    if (!r.rows[0]) throw new NotFoundException(`Contribuição ${id} não existe ou já foi decidida.`);
    await this.trilha.registrar(req.usuario.sub, 'PARECER_CONTRIBUICAO', 'ContribuicaoDado',
      String(id), { decisao: dto.decisao, justificativa: dto.justificativa });
    return { id, titulo: r.rows[0].titulo, status: dto.decisao };
  }

  /** O autor acompanha as próprias contribuições. */
  @Get('contribuicoes/minhas')
  @Papeis('PARCEIRO', 'UNIVERSIDADE', 'CURADOR', 'ADMIN')
  async minhas(@Req() req: { usuario: Sessao }) {
    const r = await this.db.query(
      `SELECT "ContribuicaoDado_Id" AS id, "ContribuicaoDado_Quando"::text AS quando,
              "ContribuicaoDado_Tipo" AS tipo, "ContribuicaoDado_Titulo" AS titulo,
              "ContribuicaoDado_Status" AS status, "ContribuicaoDado_Justificativa" AS justificativa
         FROM "ContribuicaoDado" WHERE "ContribuicaoDado_AutorEmail" = $1
        ORDER BY "ContribuicaoDado_Id" DESC`,
      [req.usuario.sub],
    );
    return r.rows;
  }
}
