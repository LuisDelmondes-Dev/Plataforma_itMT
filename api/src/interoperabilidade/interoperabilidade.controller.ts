import { Controller, Get, Header, NotFoundException, Param, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { REGIAO } from '../config/regiao';
import { ObservabilityService } from '../common/observability.service';

const BASE = '/v1/ogc';

@Controller()
export class InteroperabilidadeController {
  constructor(private readonly db: DatabaseService, private readonly observability: ObservabilityService) {}

  /** Contrato público mínimo, versionado e legível por ferramentas OpenAPI 3.1. */
  @Get('openapi.json')
  openapi() {
    return {
      openapi: '3.1.0',
      info: {
        title: 'Plataforma itMT — API pública',
        version: '1.0.0',
        description: 'Consulta territorial, catálogo documental, integrações e OGC API Features.',
      },
      servers: [{ url: '/v1' }],
      paths: {
        '/temas': { get: { summary: 'Lista a taxonomia pública', responses: { 200: { description: 'OK' } } } },
        '/indicadores': { get: { summary: 'Lista indicadores publicados', responses: { 200: { description: 'OK' } } } },
        '/municipios': { get: { summary: 'Lista municípios', responses: { 200: { description: 'OK' } } } },
        '/documentos': { get: { summary: 'Lista documentos publicados', responses: { 200: { description: 'OK' } } } },
        '/documentos/busca': { get: { summary: 'Busca híbrida citável', responses: { 200: { description: 'OK' } } } },
        '/integracoes/indicadores': {
          get: {
            summary: 'Consulta para parceiros',
            security: [{ apiKey: [] }],
            responses: { 200: { description: 'OK' }, 401: { description: 'Chave inválida' }, 429: { description: 'Quota excedida' } },
          },
        },
        '/ogc': { get: { summary: 'Landing page OGC API Features', responses: { 200: { description: 'OK' } } } },
        '/ogc/collections': { get: { summary: 'Coleções geográficas', responses: { 200: { description: 'OK' } } } },
        '/ogc/collections/{collectionId}/items': {
          get: {
            summary: 'Features GeoJSON',
            parameters: [{ name: 'collectionId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'GeoJSON FeatureCollection' }, 404: { description: 'Coleção inexistente' } },
          },
        },
        '/dcat': { get: { summary: 'Catálogo científico DCAT em JSON-LD', responses: { 200: { description: 'dcat:Catalog' } } } },
        '/dcat/datasets/{id}/reproducao': { get: { summary: 'Manifesto de reprodução do dataset', responses: { 200: { description: 'Cadeia reprodutível' }, 404: { description: 'Dataset inexistente' } } } },
        '/metrics': { get: { summary: 'Métricas Prometheus', responses: { 200: { description: 'OpenMetrics text' } } } },
      },
      components: { securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' } } },
    };
  }

  @Get('metrics')
  async metrics(@Req() req: Request, @Res() res: Response) {
    if (process.env.NODE_ENV === 'production') {
      const esperado = Buffer.from(`Bearer ${process.env.METRICS_TOKEN ?? ''}`);
      const recebido = Buffer.from(req.headers.authorization ?? '');
      if (!esperado.length || esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido))
        throw new UnauthorizedException('Credencial de mÃ©tricas invÃ¡lida.');
    }
    const r = await this.db.query<{ metrica: string; valor: string }>(`
      SELECT 'itmt_cargas_total' metrica, count(*)::text valor FROM "Carga"
      UNION ALL SELECT 'itmt_cargas_quarentena_total', coalesce(sum("Carga_LinhasQuarentena"),0)::text FROM "Carga"
      UNION ALL SELECT 'itmt_documentos_fila_pendente', count(*)::text FROM "DocumentoTarefa" WHERE "DocumentoTarefa_Status"='PENDENTE'
      UNION ALL SELECT 'itmt_documentos_fila_erro', count(*)::text FROM "DocumentoTarefa" WHERE "DocumentoTarefa_Status"='FALHOU'
      UNION ALL SELECT 'itmt_documentos_publicados', count(*)::text FROM "Documento" WHERE "Documento_Status"='PUBLICADO'
      UNION ALL SELECT 'itmt_documentos_embeddings_total', count(*)::text FROM "DocumentoEmbedding"
      UNION ALL SELECT 'itmt_api_chaves_ativas', count(*)::text FROM "ApiCliente" WHERE "ApiCliente_Status"='ATIVA'`);
    const corpo = r.rows.map((x) => `# TYPE ${x.metrica} gauge\n${x.metrica} ${x.valor}`).join('\n');
    res.type('text/plain; version=0.0.4; charset=utf-8').send(`${corpo}\n${this.observability.prometheus()}\n`);
  }

  @Get('ogc')
  ogc() {
    return {
      title: 'itMT OGC API Features',
      description: 'Feições territoriais públicas da Plataforma itMT.',
      links: [
        { href: `${BASE}/conformance`, rel: 'conformance', type: 'application/json' },
        { href: `${BASE}/collections`, rel: 'data', type: 'application/json' },
        { href: '/v1/openapi.json', rel: 'service-desc', type: 'application/vnd.oai.openapi+json;version=3.1' },
      ],
    };
  }

  @Get('ogc/conformance')
  conformance() {
    return { conformsTo: [
      'http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/core',
      'http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/geojson',
    ] };
  }

  @Get('ogc/collections')
  collections() {
    return { collections: [this.colecaoEstruturantes()] };
  }

  @Get('ogc/collections/:id')
  collection(@Param('id') id: string) {
    if (id !== 'projetos-estruturantes') throw this.naoEncontrada(id);
    return this.colecaoEstruturantes();
  }

  @Get('ogc/collections/:id/items')
  @Header('Content-Type', 'application/geo+json')
  async items(@Param('id') id: string, @Query('limit') limite?: string, @Query('municipio') municipio?: string) {
    if (id !== 'projetos-estruturantes') throw this.naoEncontrada(id);
    const limit = Math.min(Math.max(Number(limite) || 100, 1), 1000);
    const r = await this.db.query<Record<string, unknown>>(
      `SELECT e."ProjetoEstruturante_Id" AS id, e."ProjetoEstruturante_Tipo" AS tipo,
              e."ProjetoEstruturante_Nome" AS nome, e."ProjetoEstruturante_Descricao" AS descricao,
              e."ProjetoEstruturante_Latitude"::float8 AS latitude,
              e."ProjetoEstruturante_Longitude"::float8 AS longitude,
              m."Municipio_CodigoIbge" AS codigo_ibge, m."Municipio_Nome" AS municipio
         FROM "ProjetoEstruturante" e
         JOIN "Municipio" m ON m."Municipio_CodigoIbge"=e."ProjetoEstruturante_CodigoIbge"
        WHERE e."ProjetoEstruturante_Latitude" IS NOT NULL
          AND e."ProjetoEstruturante_Longitude" IS NOT NULL
          AND ($1::char(7) IS NULL OR m."Municipio_CodigoIbge"=$1)
        ORDER BY e."ProjetoEstruturante_Id" LIMIT $2`,
      [municipio ?? null, limit],
    );
    return {
      type: 'FeatureCollection',
      timeStamp: new Date().toISOString(),
      numberReturned: r.rows.length,
      features: r.rows.map(({ id: featureId, longitude, latitude, ...properties }) => ({
        type: 'Feature', id: String(featureId),
        geometry: { type: 'Point', coordinates: [longitude, latitude] }, properties,
      })),
      links: [{ href: `${BASE}/collections/${id}/items`, rel: 'self', type: 'application/geo+json' }],
    };
  }

  private colecaoEstruturantes() {
    return {
      id: 'projetos-estruturantes', title: 'Projetos estruturantes', itemType: 'feature',
      crs: ['http://www.opengis.net/def/crs/OGC/1.3/CRS84'],
      links: [{ href: `${BASE}/collections/projetos-estruturantes/items`, rel: 'items', type: 'application/geo+json' }],
    };
  }

  private naoEncontrada(id: string) {
    return new NotFoundException(`Coleção ${id} não existe.`);
  }

  @Get('dcat')
  @Header('Content-Type', 'application/ld+json; charset=utf-8')
  async dcat() {
    const r = await this.db.query<{
      id: number; nome: string; unidade: string; tema: string; inicio: string; fim: string;
      atualizado_em: string; licencas: string[]; observacoes: number;
    }>(
      `SELECT i."Indicador_Id" AS id, i."Indicador_Nome" AS nome,
              i."Indicador_Unidade" AS unidade, t."TemaConsulta_Nome" AS tema,
              min(o."Observacao_DataReferencia")::text AS inicio,
              max(o."Observacao_DataReferencia")::text AS fim,
              max(c."Carga_DataExtracao")::text AS atualizado_em,
              array_agg(DISTINCT f."Fonte_Licenca" ORDER BY f."Fonte_Licenca") AS licencas,
              count(*)::int AS observacoes
         FROM "Indicador" i
         JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_Id"=i."Indicador_SubtemaId"
         JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
         JOIN "Observacao" o ON o."Observacao_IndicadorId"=i."Indicador_Id"
         JOIN "Fonte" f ON f."Fonte_Id"=o."Observacao_FonteId"
         JOIN "Carga" c ON c."Carga_Id"=o."Observacao_CargaId"
        WHERE i."Indicador_StatusValidacao"='APROVADO'
          AND lower(coalesce(f."Fonte_Nome",'')) !~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
          AND lower(coalesce(f."Fonte_Origem",'')) !~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
          AND lower(replace(c."Carga_CaminhoBronze", chr(92), '/')) NOT LIKE '%/demo/%'
        GROUP BY i."Indicador_Id",i."Indicador_Nome",i."Indicador_Unidade",t."TemaConsulta_Nome"
        ORDER BY i."Indicador_Id"`,
    );
    return {
      '@context': {
        dcat: 'http://www.w3.org/ns/dcat#', dct: 'http://purl.org/dc/terms/',
        prov: 'http://www.w3.org/ns/prov#', xsd: 'http://www.w3.org/2001/XMLSchema#',
      },
      '@id': '/v1/dcat', '@type': 'dcat:Catalog',
      'dct:title': 'Catálogo científico da Plataforma itMT',
      'dct:description': 'Datasets territoriais publicados após validação técnica e parecer humano RG-09.',
      'dct:publisher': { '@type': 'dct:Agent', 'dct:title': 'Plataforma itMT' },
      'dct:spatial': `${REGIAO.nome}, Brasil`,
      'dcat:dataset': r.rows.map((item) => ({
        '@id': `/v1/dcat/datasets/${item.id}`, '@type': 'dcat:Dataset',
        'dct:identifier': `indicador-${item.id}`, 'dct:title': item.nome,
        'dct:description': `${item.tema}; unidade ${item.unidade}; ${item.observacoes} observações publicadas.`,
        'dct:temporal': { inicio: item.inicio, fim: item.fim },
        'dct:modified': item.atualizado_em, 'dct:license': item.licencas,
        'prov:wasGeneratedBy': `/v1/dcat/datasets/${item.id}/reproducao`,
        'dcat:distribution': [
          ['csv', 'text/csv'],
          ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
          ['pdf', 'application/pdf'],
        ].map(([formato, mime]) => ({
          '@type': 'dcat:Distribution', 'dct:format': mime,
          'dcat:accessURL': `/v1/indicadores/${item.id}/exportacao?formato=${formato}&recorte=ESTADO`,
        })),
      })),
    };
  }

  @Get('dcat/datasets/:id/reproducao')
  async reproducao(@Param('id') idParam: string) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundException('Dataset inexistente.');
    const indicador = await this.db.query<{ id: number; nome: string; unidade: string }>(
      `SELECT "Indicador_Id" AS id,"Indicador_Nome" AS nome,"Indicador_Unidade" AS unidade
         FROM "Indicador" WHERE "Indicador_Id"=$1 AND "Indicador_StatusValidacao"='APROVADO'`, [id],
    );
    if (!indicador.rows[0]) throw new NotFoundException('Dataset inexistente ou não publicado.');
    const fontes = await this.db.query<{
      fonte: string; url: string | null; licenca: string; versao: string; extraido_em: string; sha256: string;
    }>(
      `SELECT DISTINCT f."Fonte_Nome" AS fonte,f."Fonte_Url" AS url,f."Fonte_Licenca" AS licenca,
              c."Carga_Id"::text AS versao,c."Carga_DataExtracao"::text AS extraido_em,
              c."Carga_HashSha256" AS sha256
         FROM "Observacao" o JOIN "Fonte" f ON f."Fonte_Id"=o."Observacao_FonteId"
         JOIN "Carga" c ON c."Carga_Id"=o."Observacao_CargaId"
        WHERE o."Observacao_IndicadorId"=$1
          AND lower(coalesce(f."Fonte_Nome",'')) !~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
          AND lower(coalesce(f."Fonte_Origem",'')) !~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
          AND lower(replace(c."Carga_CaminhoBronze", chr(92), '/')) NOT LIKE '%/demo/%'
        ORDER BY c."Carga_Id"::text`, [id],
    );
    return {
      schema_version: 'itmt-reproducao-1.0.0',
      dataset: { indicador_id: id, nome: indicador.rows[0].nome, unidade: indicador.rows[0].unidade },
      cadeia: ['SOURCE','VERSION','TRANSFORMATION','CODE','DATASET','INDICATOR','PUBLICATION'].map((etapa, ordem) => ({ etapa, ordem: ordem + 1 })),
      fontes: fontes.rows,
      transformacao: { motor: 'itmt-motor-deterministico', agregacao: 'conforme Indicador_TipoAgregacao' },
      codigo: { commit: process.env.GIT_SHA ?? 'WORKTREE_LOCAL', contrato: '/v1/openapi.json' },
      regras: { procedencia: 'quinteto obrigatório', publicacao_humana: 'RG-09', ausencia: 'RN-005' },
      distribuicoes: ['csv','xlsx','pdf'].map((formato) => `/v1/indicadores/${id}/exportacao?formato=${formato}&recorte=ESTADO`),
    };
  }
}
