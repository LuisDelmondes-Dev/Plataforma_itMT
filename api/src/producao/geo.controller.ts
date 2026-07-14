import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query,
  UnprocessableEntityException, UseGuards,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AdminGuard } from '../admin/admin.controller';

/** Converte veto de trigger (flag de banco) em 422 legível. */
export function traduzVeto(e: unknown): never {
  const msg = (e as { message?: string })?.message ?? 'Operação vetada.';
  if (/RF-GEO-007|A11|RC-0\d|RF-IMG|RNF-10|RF-CAMPO-002/.test(msg)) {
    throw new UnprocessableEntityException(msg);
  }
  throw e;
}

@Controller('admin/geo')
@UseGuards(AdminGuard)
export class GeoAdminController {
  constructor(private readonly db: DatabaseService, private readonly trilha: AuditoriaService) {}

  /** RF-GEO-004: o projeto nasce com autorizações, RT e acurácia — ou não nasce. */
  @Post('projetos')
  async criarProjeto(@Body() d: Record<string, string | number>) {
    const obrig = ['codigo_ibge','autorizacao_cadastro','autorizacao_voo','responsavel_tecnico',
      'registro_profissional','data_voo','sensor','gsd_cm','acuracia'];
    for (const c of obrig) if (d?.[c] == null || d[c] === '') throw new BadRequestException(`Campo obrigatório: ${c} (RF-GEO-004).`);
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO "ProjetoLevantamento"
        ("ProjetoLevantamento_CodigoIbge","ProjetoLevantamento_NumeroAutorizacaoCadastro",
         "ProjetoLevantamento_NumeroAutorizacaoVoo","ProjetoLevantamento_ResponsavelTecnico",
         "ProjetoLevantamento_RegistroProfissional","ProjetoLevantamento_DataVoo",
         "ProjetoLevantamento_Sensor","ProjetoLevantamento_AlturaVooM",
         "ProjetoLevantamento_GsdCm","ProjetoLevantamento_AcuraciaDeclarada")
       VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10) RETURNING "ProjetoLevantamento_Id" AS id`,
      [d.codigo_ibge, d.autorizacao_cadastro, d.autorizacao_voo, d.responsavel_tecnico,
       d.registro_profissional, d.data_voo, d.sensor, d.altura_voo_m ?? null, d.gsd_cm, d.acuracia],
    );
    await this.trilha.registrar('admin', 'CADASTRO_PROJETO_GEO', 'ProjetoLevantamento', String(r.rows[0].id), d);
    return { id: r.rows[0].id };
  }

  @Post('produtos')
  async criarProduto(@Body() d: Record<string, string | number>) {
    for (const c of ['projeto_id','tipo','caminho_objeto'] as const)
      if (!d?.[c]) throw new BadRequestException(`Campo obrigatório: ${c}.`);
    try {
      const r = await this.db.query<{ id: number }>(
        `INSERT INTO "ProdutoGeografico"
          ("ProdutoGeografico_ProjetoId","ProdutoGeografico_Tipo","ProdutoGeografico_CaminhoObjeto",
           "ProdutoGeografico_FormatoDownload","ProdutoGeografico_Classificacao")
         VALUES ($1,$2,$3,$4,$5) RETURNING "ProdutoGeografico_Id" AS id`,
        [d.projeto_id, d.tipo, d.caminho_objeto, d.formato ?? null, d.classificacao ?? 'PUBLICO'],
      );
      return { id: r.rows[0].id, status: 'RASCUNHO' };
    } catch (e) { traduzVeto(e); }
  }

  /** A publicação passa pelo trigger — o veto é do banco (RF-GEO-007). */
  @Post('produtos/:id/publicar')
  async publicarProduto(@Param('id', ParseIntPipe) id: number) {
    try {
      const r = await this.db.query(
        `UPDATE "ProdutoGeografico" SET "ProdutoGeografico_StatusPublicacao"='PUBLICADO'
          WHERE "ProdutoGeografico_Id"=$1 RETURNING "ProdutoGeografico_Tipo" AS tipo`, [id]);
      if (!r.rows[0]) throw new BadRequestException(`Produto ${id} não existe.`);
      await this.trilha.registrar('admin', 'PUBLICACAO_PRODUTO_GEO', 'ProdutoGeografico', String(id), r.rows[0]);
      return { id, status: 'PUBLICADO' };
    } catch (e) { traduzVeto(e); }
  }

  @Post('capturas-rua')
  async criarCapturaRua(@Body() d: Record<string, string | number>) {
    for (const c of ['codigo_ibge','caminho_acervo_proprio'] as const)
      if (!d?.[c]) throw new BadRequestException(`Campo obrigatório: ${c} (RF-GEO-009: cópia soberana).`);
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO "CapturaImagemRua"
        ("CapturaImagemRua_CodigoIbge","CapturaImagemRua_Origem","CapturaImagemRua_DataCaptura",
         "CapturaImagemRua_KmPercorridos","CapturaImagemRua_CaminhoAcervoProprio","CapturaImagemRua_IdColecaoExterna")
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING "CapturaImagemRua_Id" AS id`,
      [d.codigo_ibge, d.origem ?? 'ITMT', d.data_captura ?? null, d.km ?? null,
       d.caminho_acervo_proprio, d.id_colecao_externa ?? null],
    );
    return { id: r.rows[0].id };
  }

  @Post('capturas-rua/:id/publicar')
  async publicarCaptura(@Param('id', ParseIntPipe) id: number) {
    await this.db.query(
      `UPDATE "CapturaImagemRua" SET "CapturaImagemRua_StatusPublicacao"='PUBLICADO'
        WHERE "CapturaImagemRua_Id"=$1`, [id]);
    await this.trilha.registrar('admin', 'PUBLICACAO_IMAGEM_RUA', 'CapturaImagemRua', String(id), {});
    return { id, status: 'PUBLICADO' };
  }

  @Post('estruturantes')
  async criarEstruturante(@Body() d: Record<string, string | number>) {
    for (const c of ['codigo_ibge','tipo','nome'] as const)
      if (!d?.[c]) throw new BadRequestException(`Campo obrigatório: ${c}.`);
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO "ProjetoEstruturante"
        ("ProjetoEstruturante_CodigoIbge","ProjetoEstruturante_Tipo","ProjetoEstruturante_Nome",
         "ProjetoEstruturante_Latitude","ProjetoEstruturante_Longitude","ProjetoEstruturante_Descricao")
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING "ProjetoEstruturante_Id" AS id`,
      [d.codigo_ibge, d.tipo, d.nome, d.latitude ?? null, d.longitude ?? null, d.descricao ?? null],
    );
    return { id: r.rows[0].id };
  }
}

@Controller('geo')
export class GeoPublicoController {
  constructor(private readonly db: DatabaseService) {}

  /** Só PUBLICO + PUBLICADO chega aqui — o resto o banco nem deixa publicar. */
  @Get('produtos')
  async produtos(@Query('municipio') municipio?: string) {
    const r = await this.db.query(
      `SELECT pg."ProdutoGeografico_Id" AS id, pg."ProdutoGeografico_Tipo" AS tipo,
              pg."ProdutoGeografico_FormatoDownload" AS formato,
              pg."ProdutoGeografico_CaminhoObjeto" AS caminho,
              m."Municipio_Nome" AS municipio, m."Municipio_CodigoIbge" AS codigo_ibge,
              pl."ProjetoLevantamento_DataVoo"::text AS data_voo,
              pl."ProjetoLevantamento_Sensor" AS sensor, pl."ProjetoLevantamento_GsdCm" AS gsd_cm,
              pl."ProjetoLevantamento_AcuraciaDeclarada" AS acuracia,
              pl."ProjetoLevantamento_SistemaReferencia" AS sistema_referencia,
              pl."ProjetoLevantamento_ResponsavelTecnico" AS responsavel_tecnico,
              pl."ProjetoLevantamento_NumeroAutorizacaoVoo" AS autorizacao_voo
         FROM "ProdutoGeografico" pg
         JOIN "ProjetoLevantamento" pl ON pl."ProjetoLevantamento_Id" = pg."ProdutoGeografico_ProjetoId"
         JOIN "Municipio" m ON m."Municipio_CodigoIbge" = pl."ProjetoLevantamento_CodigoIbge"
        WHERE pg."ProdutoGeografico_StatusPublicacao" = 'PUBLICADO'
          AND pg."ProdutoGeografico_Classificacao" = 'PUBLICO'
          AND ($1::char(7) IS NULL OR m."Municipio_CodigoIbge" = $1)
        ORDER BY m."Municipio_Nome", pg."ProdutoGeografico_Tipo"`,
      [municipio ?? null],
    );
    return r.rows;
  }

  /** RF-GEO-008: estado da cobertura de imagem de rua, município a município. */
  @Get('cobertura-rua')
  async coberturaRua() {
    const r = await this.db.query(
      `SELECT m."Municipio_CodigoIbge" AS codigo_ibge, m."Municipio_Nome" AS municipio,
              CASE
                WHEN bool_or(c."CapturaImagemRua_Origem"='ITMT' AND c."CapturaImagemRua_StatusPublicacao"='PUBLICADO') THEN 'PUBLICADO_ITMT'
                WHEN bool_or(c."CapturaImagemRua_Origem"='PREEXISTENTE') THEN 'PREEXISTENTE'
                ELSE 'PENDENTE'
              END AS estado,
              coalesce(sum(c."CapturaImagemRua_KmPercorridos") FILTER (WHERE c."CapturaImagemRua_Origem"='ITMT'),0) AS km_itmt
         FROM "Municipio" m
         LEFT JOIN "CapturaImagemRua" c ON c."CapturaImagemRua_CodigoIbge" = m."Municipio_CodigoIbge"
        GROUP BY 1,2 ORDER BY m."Municipio_Nome"`,
    );
    return r.rows;
  }

  @Get('estruturantes')
  async estruturantes(@Query('municipio') municipio?: string) {
    const r = await this.db.query(
      `SELECT e."ProjetoEstruturante_Id" AS id, e."ProjetoEstruturante_Tipo" AS tipo,
              e."ProjetoEstruturante_Nome" AS nome, e."ProjetoEstruturante_Descricao" AS descricao,
              e."ProjetoEstruturante_Latitude" AS lat, e."ProjetoEstruturante_Longitude" AS lon,
              m."Municipio_Nome" AS municipio
         FROM "ProjetoEstruturante" e
         JOIN "Municipio" m ON m."Municipio_CodigoIbge" = e."ProjetoEstruturante_CodigoIbge"
        WHERE ($1::char(7) IS NULL OR e."ProjetoEstruturante_CodigoIbge" = $1)
        ORDER BY m."Municipio_Nome", e."ProjetoEstruturante_Nome"`,
      [municipio ?? null],
    );
    return r.rows;
  }
}
