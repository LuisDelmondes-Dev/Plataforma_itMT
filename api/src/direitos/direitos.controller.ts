import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query,
  UnprocessableEntityException, UseGuards,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AdminGuard } from '../admin/admin.controller';
import { DireitosService, PerfilCidadao } from './direitos.service';

/** Vetos F4-RG-01..06 são de banco; aqui só se traduz a exceção em 422. */
function traduzVetoF4(e: unknown): never {
  const msg = (e as { message?: string })?.message ?? 'Operação vetada.';
  if (/F4-RG-0\d/.test(msg)) throw new UnprocessableEntityException(msg);
  throw e;
}

@Controller('direitos')
export class DireitosController {
  constructor(private readonly svc: DireitosService, private readonly trilha: AuditoriaService) {}

  @Get()
  listar(
    @Query('area') area?: string,
    @Query('publico') publico?: string,
    @Query('confianca') confianca?: string,
    @Query('q') q?: string,
    @Query('pouco_conhecidos') pouco?: string,
  ) {
    return this.svc.listar({ area, publico, confianca, q, pouco_conhecidos: pouco === '1' });
  }

  @Get('areas')
  areas() { return this.svc.areas(); }

  @Get('publicos')
  publicos() { return this.svc.publicos(); }

  @Get('condicoes')
  condicoes() { return this.svc.condicoes(); }

  /**
   * §8 — "Descubra todos os seus direitos". O perfil não carrega dado
   * identificável (sem nome, CPF, NIS, diagnóstico); a trilha registra
   * apenas QUAIS fatores foram informados e as contagens.
   */
  @Post('descubra')
  async descubra(@Body() perfil: PerfilCidadao) {
    if (!perfil || typeof perfil !== 'object')
      throw new BadRequestException('Informe o perfil (objeto JSON).');
    if (perfil.idade !== undefined && (typeof perfil.idade !== 'number' || perfil.idade < 0 || perfil.idade > 130))
      throw new BadRequestException('idade inválida.');
    if (perfil.recebe !== undefined && (!Array.isArray(perfil.recebe) || perfil.recebe.some((x) => !Number.isInteger(x))))
      throw new BadRequestException('recebe deve ser uma lista de ids inteiros.');
    const r = await this.svc.descubra(perfil);
    await this.trilha.registrar('portal', 'CONSULTA_DIREITOS_PERFIL', 'Direito', 'descubra', {
      fatores_informados: r.fatores_informados,
      provaveis: (r.provaveis as unknown[]).length,
      precisam_avaliacao: (r.precisam_avaliacao as unknown[]).length,
      nao_elegiveis: (r.nao_elegiveis as unknown[]).length,
    });
    return r;
  }

  @Get(':id')
  ficha(@Param('id', ParseIntPipe) id: number) { return this.svc.ficha(id); }
}

@Controller('admin/direitos')
@UseGuards(AdminGuard)
export class DireitosAdminController {
  constructor(private readonly db: DatabaseService, private readonly trilha: AuditoriaService) {}

  /** Ficha nova nasce RASCUNHO; os vetos agem na publicação. */
  @Post()
  async criar(@Body() d: Record<string, unknown>) {
    for (const c of ['nome', 'area', 'resumo', 'quem_pode_usar', 'abrangencia', 'orgao_gestor', 'natureza_norma'] as const)
      if (!d?.[c]) throw new BadRequestException(`Campo obrigatório: ${c}.`);
    try {
      const r = await this.db.query<{ id: number }>(
        `INSERT INTO "Direito"
          ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar","Direito_Abrangencia",
           "Direito_OrgaoGestor","Direito_NaturezaNorma","Direito_BaseLegal","Direito_LinkOficial",
           "Direito_Confianca","Direito_DataVerificacao")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10,'NECESSITA_CONFIRMACAO'),$11::date)
         RETURNING "Direito_Id" AS id`,
        [d.nome, d.area, d.resumo, d.quem_pode_usar, d.abrangencia, d.orgao_gestor, d.natureza_norma,
         d.base_legal ?? null, d.link_oficial ?? null, d.confianca ?? null, d.data_verificacao ?? null],
      );
      await this.trilha.registrar('admin', 'CRIACAO_DIREITO', 'Direito', String(r.rows[0].id), { nome: d.nome });
      return { id: r.rows[0].id, status: 'RASCUNHO' };
    } catch (e) { traduzVetoF4(e); }
  }

  /** Publicação passa pelos vetos F4-RG-01..05 (trigger de banco). */
  @Post(':id/publicar')
  async publicar(@Param('id', ParseIntPipe) id: number) {
    try {
      const r = await this.db.query(
        `UPDATE "Direito" SET "Direito_Status"='PUBLICADO' WHERE "Direito_Id"=$1
         RETURNING "Direito_Id"`, [id]);
      if (!r.rows[0]) throw new BadRequestException('Direito inexistente.');
      await this.trilha.registrar('admin', 'PUBLICACAO_DIREITO', 'Direito', String(id), {});
      return { id, status: 'PUBLICADO' };
    } catch (e) { traduzVetoF4(e); }
  }
}
