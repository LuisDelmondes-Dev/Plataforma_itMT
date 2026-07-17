import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AdminGuard } from '../admin/admin.controller';
import { traduzVeto } from './geo.controller';

// ============================================================
// MTIMAGENS / VIDEOS
// ============================================================
@Controller('admin/midia')
@UseGuards(AdminGuard)
export class MidiaAdminController {
  constructor(private readonly db: DatabaseService, private readonly trilha: AuditoriaService) {}

  /** RF-IMG-006: termo arquivado com hash, vinculável ao ativo. */
  @Post('termos')
  async criarTermo(@Body() d: Record<string, string>) {
    for (const c of ['titular_nome','tipo','data_assinatura','caminho_documento','hash_sha256'] as const)
      if (!d?.[c]) throw new BadRequestException(`Campo obrigatório: ${c}.`);
    if (!/^[0-9a-f]{64}$/.test(d.hash_sha256)) throw new BadRequestException('hash_sha256 inválido.');
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO "TermoConsentimento"
        ("TermoConsentimento_TitularNome","TermoConsentimento_TipoTermo","TermoConsentimento_DataAssinatura",
         "TermoConsentimento_CaminhoDocumento","TermoConsentimento_HashSha256")
       VALUES ($1,$2,$3::date,$4,$5) RETURNING "TermoConsentimento_Id" AS id`,
      [d.titular_nome, d.tipo, d.data_assinatura, d.caminho_documento, d.hash_sha256],
    );
    await this.trilha.registrar('admin', 'ARQUIVO_TERMO', 'TermoConsentimento', String(r.rows[0].id), {
      titular: d.titular_nome, hash: d.hash_sha256,
    });
    return { id: r.rows[0].id };
  }

  @Post('ativos')
  async criarAtivo(@Body() d: Record<string, unknown>) {
    for (const c of ['codigo_ibge','tipo','titulo','autor','caminho_objeto'] as const)
      if (!d?.[c]) throw new BadRequestException(`Campo obrigatório: ${c} (RF-IMG-003: cadeia de direitos).`);
    try {
      const r = await this.db.query<{ id: number }>(
        `INSERT INTO "AtivoMidia"
          ("AtivoMidia_CodigoIbge","AtivoMidia_Tipo","AtivoMidia_Titulo","AtivoMidia_Autor",
           "AtivoMidia_Licenca","AtivoMidia_CaminhoObjeto","AtivoMidia_ViaPublica",
           "AtivoMidia_TemPessoaIdentificavel","AtivoMidia_TermoConsentimentoId",
           "AtivoMidia_Contribuicao","AtivoMidia_DuracaoMin","AtivoMidia_CaminhoLegenda",
           "AtivoMidia_CaminhoTranscricao","AtivoMidia_Tags")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING "AtivoMidia_Id" AS id`,
        [d.codigo_ibge, d.tipo, d.titulo, d.autor, d.licenca ?? null, d.caminho_objeto,
         Boolean(d.via_publica), Boolean(d.tem_pessoa_identificavel), d.termo_id ?? null,
         Boolean(d.contribuicao), d.duracao_min ?? null, d.caminho_legenda ?? null,
         d.caminho_transcricao ?? null, d.tags ?? null],
      );
      return { id: r.rows[0].id, status: 'RASCUNHO' };
    } catch (e) { traduzVeto(e); }
  }

  /** A11 — Anonimizador: registra a verificação de borrão (rostos/placas). */
  @Post('ativos/:id/anonimizar')
  async anonimizar(@Param('id', ParseIntPipe) id: number, @Body() d: { verificado_por?: string }) {
    if (!d?.verificado_por) throw new BadRequestException('Informe verificado_por (A11 é verificação, não checkbox).');
    await this.db.query(
      `UPDATE "AtivoMidia" SET "AtivoMidia_AnonimizacaoAplicada"=true WHERE "AtivoMidia_Id"=$1`, [id]);
    await this.trilha.registrar('a11', 'ANONIMIZACAO_VERIFICADA', 'AtivoMidia', String(id), {
      verificado_por: d.verificado_por,
    });
    return { id, anonimizacao_aplicada: true };
  }

  /** RF-IMG-002: moderação prévia obrigatória para contribuição externa. */
  @Post('ativos/:id/moderar')
  async moderar(@Param('id', ParseIntPipe) id: number, @Body() d: { decisao?: string; moderador?: string }) {
    if (!['APROVADO','REJEITADO'].includes(d?.decisao ?? '') || !d?.moderador)
      throw new BadRequestException('Informe decisao (APROVADO|REJEITADO) e moderador.');
    await this.db.query(
      `UPDATE "AtivoMidia" SET "AtivoMidia_StatusModeracao"=$2 WHERE "AtivoMidia_Id"=$1`, [id, d.decisao]);
    await this.trilha.registrar('admin', 'MODERACAO_MIDIA', 'AtivoMidia', String(id), { ...d });
    return { id, moderacao: d.decisao };
  }

  /** A publicação enfrenta TODOS os vetos do trigger (A11, A12, RC-04, RNF-10). */
  @Post('ativos/:id/publicar')
  async publicar(@Param('id', ParseIntPipe) id: number) {
    try {
      const r = await this.db.query(
        `UPDATE "AtivoMidia" SET "AtivoMidia_StatusPublicacao"='PUBLICADO'
          WHERE "AtivoMidia_Id"=$1 RETURNING "AtivoMidia_Titulo" AS titulo`, [id]);
      if (!r.rows[0]) throw new BadRequestException(`Ativo ${id} não existe.`);
      await this.trilha.registrar('admin', 'PUBLICACAO_MIDIA', 'AtivoMidia', String(id), r.rows[0]);
      return { id, status: 'PUBLICADO' };
    } catch (e) { traduzVeto(e); }
  }
}

@Controller('midia')
export class MidiaPublicoController {
  constructor(private readonly db: DatabaseService) {}

  /** RF-IMG-001: acervo pesquisável — só o que sobreviveu aos vetos. */
  @Get('acervo')
  async acervo(
    @Query('municipio') municipio?: string,
    @Query('tipo') tipo?: string,
    @Query('q') q?: string,
  ) {
    const r = await this.db.query(
      `SELECT a."AtivoMidia_Id" AS id, a."AtivoMidia_Tipo" AS tipo, a."AtivoMidia_Titulo" AS titulo,
              a."AtivoMidia_Autor" AS autor, a."AtivoMidia_Licenca" AS licenca,
              a."AtivoMidia_CaminhoObjeto" AS caminho, a."AtivoMidia_DuracaoMin" AS duracao_min,
              a."AtivoMidia_CaminhoLegenda" AS legenda, a."AtivoMidia_CaminhoTranscricao" AS transcricao,
              a."AtivoMidia_Tags" AS tags, m."Municipio_Nome" AS municipio
         FROM "AtivoMidia" a
         JOIN "Municipio" m ON m."Municipio_CodigoIbge" = a."AtivoMidia_CodigoIbge"
        WHERE a."AtivoMidia_StatusPublicacao" = 'PUBLICADO'
          AND ($1::char(7) IS NULL OR a."AtivoMidia_CodigoIbge" = $1)
          AND ($2::text IS NULL OR a."AtivoMidia_Tipo" = $2)
          AND ($3::text IS NULL OR a."AtivoMidia_Titulo" ILIKE '%'||$3||'%' OR a."AtivoMidia_Tags" ILIKE '%'||$3||'%')
        ORDER BY a."AtivoMidia_Id" DESC LIMIT 200`,
      [municipio ?? null, tipo ?? null, q ?? null],
    );
    return r.rows;
  }
}

// ============================================================
// CAMPO
// ============================================================
@Controller('admin/campo')
@UseGuards(AdminGuard)
export class CampoController {
  constructor(private readonly db: DatabaseService, private readonly trilha: AuditoriaService) {}

  /** RF-CAMPO-001: missão com polígono, produto esperado, equipe, janela e autorizações. */
  @Post('missoes')
  async criarMissao(@Body() d: Record<string, unknown>) {
    for (const c of ['codigo_ibge','frente','produto_esperado','equipe','janela_inicio','janela_fim'] as const)
      if (!d?.[c]) throw new BadRequestException(`Campo obrigatório: ${c}.`);
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO "MissaoCampo"
        ("MissaoCampo_CodigoIbge","MissaoCampo_Frente","MissaoCampo_ProdutoEsperado",
         "MissaoCampo_Equipe","MissaoCampo_PoligonoGeoJson","MissaoCampo_JanelaInicio","MissaoCampo_JanelaFim")
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::date,$7::date) RETURNING "MissaoCampo_Id" AS id`,
      [d.codigo_ibge, d.frente, d.produto_esperado, d.equipe,
       d.poligono ? JSON.stringify(d.poligono) : null, d.janela_inicio, d.janela_fim],
    );
    const id = r.rows[0].id;
    for (const a of (d.autorizacao_ids as number[] | undefined) ?? []) {
      await this.db.query(
        `INSERT INTO "MissaoAutorizacao" VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, a]);
    }
    await this.trilha.registrar('admin', 'PLANEJAMENTO_MISSAO', 'MissaoCampo', String(id), {
      frente: d.frente, municipio: d.codigo_ibge,
    });
    return { id, status: 'PLANEJADA' };
  }

  @Post('missoes/:id/autorizacoes/:autorizacaoId')
  async vincular(@Param('id', ParseIntPipe) id: number, @Param('autorizacaoId', ParseIntPipe) aid: number) {
    await this.db.query(`INSERT INTO "MissaoAutorizacao" VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, aid]);
    return { missao: id, autorizacao: aid };
  }

  /** RF-CAMPO-002: o veto de autorização vigente é do TRIGGER do banco. */
  @Post('missoes/:id/status')
  async mudarStatus(@Param('id', ParseIntPipe) id: number, @Body() d: { status?: string }) {
    if (!['PLANEJADA','EM_CAMPO','EXECUTADA','CANCELADA'].includes(d?.status ?? ''))
      throw new BadRequestException('status ∈ {PLANEJADA, EM_CAMPO, EXECUTADA, CANCELADA}.');
    try {
      const r = await this.db.query(
        `UPDATE "MissaoCampo" SET "MissaoCampo_StatusExecucao"=$2
          WHERE "MissaoCampo_Id"=$1 RETURNING "MissaoCampo_Frente" AS frente`, [id, d.status]);
      if (!r.rows[0]) throw new BadRequestException(`Missão ${id} não existe.`);
      await this.trilha.registrar('campo', 'STATUS_MISSAO', 'MissaoCampo', String(id), { ...d });
      return { id, status: d.status };
    } catch (e) { traduzVeto(e); }
  }

  /** RF-CAMPO-003: upload (pós-sincronização) com metadados EXIF/GNSS/sensor/operador. */
  @Post('missoes/:id/capturas')
  async registrarCaptura(@Param('id', ParseIntPipe) id: number, @Body() d: Record<string, unknown>) {
    for (const c of ['operador','caminho_objeto','capturado_em'] as const)
      if (!d?.[c]) throw new BadRequestException(`Campo obrigatório: ${c}.`);
    const r = await this.db.query<{ id: string }>(
      `INSERT INTO "CapturaCampo"
        ("CapturaCampo_MissaoId","CapturaCampo_Operador","CapturaCampo_Sensor","CapturaCampo_Gnss",
         "CapturaCampo_Exif","CapturaCampo_ChecklistOk","CapturaCampo_CaminhoObjeto","CapturaCampo_CapturadoEm")
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8::timestamptz) RETURNING "CapturaCampo_Id" AS id`,
      [id, d.operador, d.sensor ?? null, JSON.stringify(d.gnss ?? null),
       JSON.stringify(d.exif ?? null), Boolean(d.checklist_ok), d.caminho_objeto, d.capturado_em],
    );
    return { id: Number(r.rows[0].id), missao: id };
  }

  @Get('missoes')
  async listarMissoes() {
    const r = await this.db.query(
      `SELECT mi."MissaoCampo_Id" AS id, mi."MissaoCampo_Frente" AS frente,
              mi."MissaoCampo_ProdutoEsperado" AS produto, mi."MissaoCampo_Equipe" AS equipe,
              mi."MissaoCampo_JanelaInicio"::text AS inicio, mi."MissaoCampo_JanelaFim"::text AS fim,
              mi."MissaoCampo_StatusExecucao" AS status, m."Municipio_Nome" AS municipio,
              count(a.*) FILTER (WHERE a."Autorizacao_VigenciaFim" >= CURRENT_DATE)::int AS autorizacoes_vigentes,
              count(cc.*)::int AS capturas
         FROM "MissaoCampo" mi
         JOIN "Municipio" m ON m."Municipio_CodigoIbge" = mi."MissaoCampo_CodigoIbge"
         LEFT JOIN "MissaoAutorizacao" ma ON ma."MissaoAutorizacao_MissaoId" = mi."MissaoCampo_Id"
         LEFT JOIN "Autorizacao" a ON a."Autorizacao_Id" = ma."MissaoAutorizacao_AutorizacaoId"
         LEFT JOIN "CapturaCampo" cc ON cc."CapturaCampo_MissaoId" = mi."MissaoCampo_Id"
        GROUP BY 1,2,3,4,5,6,7,8 ORDER BY mi."MissaoCampo_JanelaInicio" DESC`,
    );
    return r.rows;
  }

  /** RF-CAMPO-004: painel de progresso — 4 frentes × municípios. */
  @Get('painel')
  async painel() {
    const r = await this.db.query(
      `SELECT m."Municipio_CodigoIbge" AS codigo_ibge, m."Municipio_Nome" AS municipio,
              f.frente,
              coalesce(max(CASE mi."MissaoCampo_StatusExecucao"
                WHEN 'EXECUTADA' THEN 3 WHEN 'EM_CAMPO' THEN 2 WHEN 'PLANEJADA' THEN 1 ELSE 0 END), 0) AS nivel
         FROM "Municipio" m
        CROSS JOIN (VALUES ('GEO'),('ESTRUTURANTE'),('AUDIOVISUAL'),('ESTATISTICO')) AS f(frente)
         LEFT JOIN "MissaoCampo" mi ON mi."MissaoCampo_CodigoIbge" = m."Municipio_CodigoIbge"
                                   AND mi."MissaoCampo_Frente" = f.frente
        GROUP BY 1,2,3 ORDER BY m."Municipio_Nome", f.frente`,
    );
    const rotulo = ['SEM_MISSAO','PLANEJADA','EM_CAMPO','EXECUTADA'];
    return r.rows.map((x: any) => ({ ...x, estado: rotulo[x.nivel] }));
  }
}
