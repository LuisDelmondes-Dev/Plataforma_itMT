import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { DatabaseService, TenantContext } from '../database/database.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EmbeddingsService } from './embeddings.service';
import { ExtracaoService } from './extracao.service';
import { TenantObjectStorageService } from '../auth/tenant-object-storage.service';

export interface ArquivoRecebido {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

interface CriarDocumentoDto {
  titulo?: string;
  descricao?: string;
  orgao?: string;
  tipo?: string;
  codigo_ibge?: string;
  licenca?: string;
  fonte_url?: string;
}

interface RevisaoDto {
  decisao?: 'APROVADO' | 'REJEITADO';
  justificativa?: string;
  texto_revisado?: string;
}

const MIME_EXTENSAO: Record<string, string> = {
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/csv': '.csv',
  'application/json': '.json',
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};
const TIPOS = new Set([
  'RELATORIO', 'ESTUDO', 'LEGISLACAO', 'PLANO', 'NOTA_TECNICA', 'BASE_METODOLOGICA', 'OUTRO',
]);

@Injectable()
export class DocumentosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly trilha: AuditoriaService,
    private readonly embeddings: EmbeddingsService,
    private readonly extracao: ExtracaoService,
    private readonly storage: TenantObjectStorageService,
  ) {}

  private validarArquivo(arquivo?: ArquivoRecebido) {
    if (!arquivo?.buffer?.length) throw new BadRequestException('Envie o campo arquivo.');
    if (arquivo.size > 15 * 1024 * 1024) throw new BadRequestException('Arquivo excede o limite de 15 MB.');
    if (!MIME_EXTENSAO[arquivo.mimetype]) throw new BadRequestException('Formato de arquivo não permitido.');
    if (arquivo.mimetype === 'application/pdf' && arquivo.buffer.subarray(0, 5).toString() !== '%PDF-')
      throw new BadRequestException('Conteúdo não corresponde a um PDF válido.');
    if (arquivo.mimetype === 'image/png' && arquivo.buffer.subarray(1, 4).toString() !== 'PNG')
      throw new BadRequestException('Conteúdo não corresponde a uma imagem PNG válida.');
    if (arquivo.mimetype === 'image/jpeg' && !(arquivo.buffer[0] === 0xff && arquivo.buffer[1] === 0xd8))
      throw new BadRequestException('Conteúdo não corresponde a uma imagem JPEG válida.');
    if (arquivo.mimetype.startsWith('text/') && arquivo.buffer.includes(0))
      throw new BadRequestException('Arquivo textual contém bytes binários.');
  }

  private async salvarImutavel(arquivo: ArquivoRecebido, contexto: TenantContext) {
    const hash = createHash('sha256').update(arquivo.buffer).digest('hex');
    const caminho = this.storage.criarChave(
      contexto, 'documentos', randomUUID(), MIME_EXTENSAO[arquivo.mimetype].slice(1),
    );
    const salvo = await this.storage.gravar(contexto, caminho, arquivo.buffer);
    if (salvo.sha256 !== hash) throw new Error('Hash divergente após gravação do documento.');
    return { hash, caminho };
  }

  private normalizarTexto(texto: string) {
    return this.extracao.normalizar(texto);
  }

  private trechos(texto: string) {
    const paragrafos = texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const saida: string[] = [];
    let atual = '';
    for (const paragrafo of paragrafos) {
      for (const parte of paragrafo.match(/[\s\S]{1,1200}(?:\s|$)/g) ?? [paragrafo]) {
        if (atual && atual.length + parte.length + 2 > 1400) {
          saida.push(atual.trim());
          atual = '';
        }
        atual += `${atual ? '\n\n' : ''}${parte.trim()}`;
      }
    }
    if (atual.trim()) saida.push(atual.trim());
    return saida.slice(0, 2000);
  }

  async criar(dto: CriarDocumentoDto, arquivo: ArquivoRecebido, ator: string, contexto: TenantContext) {
    this.validarArquivo(arquivo);
    const titulo = dto.titulo?.trim();
    const orgao = dto.orgao?.trim();
    const licenca = dto.licenca?.trim();
    const tipo = dto.tipo?.trim().toUpperCase();
    if (!titulo || titulo.length < 3 || !orgao || !licenca || !tipo || !TIPOS.has(tipo))
      throw new BadRequestException('Campos obrigatórios: titulo, orgao, licenca e tipo válido.');
    if (dto.codigo_ibge && !/^\d{7}$/.test(dto.codigo_ibge))
      throw new BadRequestException('codigo_ibge deve conter 7 dígitos.');
    if (dto.fonte_url) {
      try {
        const u = new URL(dto.fonte_url);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
      } catch { throw new BadRequestException('fonte_url deve ser uma URL HTTP(S).'); }
    }
    const { hash, caminho } = await this.salvarImutavel(arquivo, contexto);
    const nomeSeguro = basename(arquivo.originalname).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 180);
    const criado = await this.db.withTenantTransaction(contexto, async (client) => {
        const doc = await client.query<{ id: string }>(
          `INSERT INTO "Documento"
             ("Documento_Titulo","Documento_Descricao","Documento_Orgao","Documento_Tipo",
              "Documento_CodigoIbge","Documento_Licenca","Documento_FonteUrl","Documento_CriadoPor")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING "Documento_Id"::text AS id`,
          [titulo, dto.descricao?.trim() || null, orgao, tipo, dto.codigo_ibge || null,
           licenca, dto.fonte_url || null, ator],
        );
        const versao = await client.query<{ id: string }>(
          `INSERT INTO "DocumentoVersao"
             ("DocumentoVersao_DocumentoId","DocumentoVersao_Numero","DocumentoVersao_NomeArquivo",
              "DocumentoVersao_Mime","DocumentoVersao_TamanhoBytes","DocumentoVersao_HashSha256",
              "DocumentoVersao_CaminhoObjeto","DocumentoVersao_StatusExtracao")
           VALUES ($1,1,$2,$3,$4,$5,$6,'PENDENTE') RETURNING "DocumentoVersao_Id"::text AS id`,
          [doc.rows[0].id, nomeSeguro || `documento${extname(caminho)}`, arquivo.mimetype, arquivo.size,
           hash, caminho],
        );
        await client.query(
          `INSERT INTO "DocumentoTarefa" ("DocumentoTarefa_VersaoId","DocumentoTarefa_Tipo")
           VALUES ($1,'SCAN_EXTRAIR')`, [versao.rows[0].id],
        );
      return { documentoId: doc.rows[0].id, versaoId: versao.rows[0].id };
    });
    await this.trilha.registrar(ator, 'UPLOAD_DOCUMENTO', 'Documento', criado.documentoId, {
      hash, mime: arquivo.mimetype, tamanho: arquivo.size, status: 'QUARENTENA',
    }, contexto);
    return {
      id: criado.documentoId, versao_id: criado.versaoId, status: 'EM_ANALISE',
      seguranca: 'PENDENTE', extracao: 'PENDENTE', processamento: 'ASSINCRONO',
    };
  }

  async listar(q?: string, tipo?: string, codigoIbge?: string) {
    const termo = q?.trim() || null;
    const r = await this.db.query(
      `SELECT d."Documento_Id"::text AS id, d."Documento_Titulo" AS titulo,
              d."Documento_Descricao" AS descricao, d."Documento_Orgao" AS orgao,
              d."Documento_Tipo" AS tipo, d."Documento_CodigoIbge" AS codigo_ibge,
              m."Municipio_Nome" AS municipio, d."Documento_Licenca" AS licenca,
              d."Documento_FonteUrl" AS fonte_url, v."DocumentoVersao_Id"::text AS versao_id,
              v."DocumentoVersao_Numero" AS versao, v."DocumentoVersao_HashSha256" AS hash,
              v."DocumentoVersao_Mime" AS mime, v."DocumentoVersao_CriadoEm"::text AS publicado_em
         FROM "Documento" d
         JOIN LATERAL (
           SELECT v.* FROM "DocumentoVersao" v
            WHERE v."DocumentoVersao_DocumentoId" = d."Documento_Id"
              AND EXISTS (SELECT 1 FROM "DocumentoRevisao" r
                           WHERE r."DocumentoRevisao_VersaoId" = v."DocumentoVersao_Id"
                             AND r."DocumentoRevisao_Decisao" = 'APROVADO')
            ORDER BY v."DocumentoVersao_Numero" DESC LIMIT 1
         ) v ON true
         LEFT JOIN "Municipio" m ON m."Municipio_CodigoIbge" = d."Documento_CodigoIbge"
        WHERE d."Documento_Status" = 'PUBLICADO'
          AND ($1::text IS NULL OR d."Documento_Tipo" = $1)
          AND ($2::text IS NULL OR d."Documento_CodigoIbge" = $2)
          AND ($3::text IS NULL OR to_tsvector('portuguese', d."Documento_Titulo" || ' ' ||
              coalesce(d."Documento_Descricao", '') || ' ' || d."Documento_Orgao")
              @@ websearch_to_tsquery('portuguese', $3))
        ORDER BY d."Documento_AtualizadoEm" DESC LIMIT 100`,
      [tipo?.trim().toUpperCase() || null, codigoIbge?.trim() || null, termo],
    );
    return r.rows;
  }

  async buscar(q?: string) {
    if (!q?.trim() || q.trim().length < 2) throw new BadRequestException('Use ao menos 2 caracteres na busca.');
    const consultaTexto = q.trim();
    const lexical = await this.db.query(
      `WITH consulta AS (SELECT websearch_to_tsquery('portuguese', $1) AS q)
       SELECT t."DocumentoTrecho_Id"::text AS trecho_id, d."Documento_Id"::text AS documento_id,
              d."Documento_Titulo" AS titulo, d."Documento_Orgao" AS orgao,
              d."Documento_Licenca" AS licenca, d."Documento_FonteUrl" AS fonte_url,
              v."DocumentoVersao_Id"::text AS versao_id, v."DocumentoVersao_Numero" AS versao,
              v."DocumentoVersao_HashSha256" AS hash, t."DocumentoTrecho_Pagina" AS pagina,
              ts_headline('portuguese', t."DocumentoTrecho_Conteudo", consulta.q,
                'StartSel=<mark>, StopSel=</mark>, MaxWords=45, MinWords=18') AS trecho,
              ts_rank_cd(t."DocumentoTrecho_Busca", consulta.q)::float AS relevancia
         FROM consulta, "DocumentoTrecho" t
         JOIN "DocumentoVersao" v ON v."DocumentoVersao_Id" = t."DocumentoTrecho_VersaoId"
         JOIN "Documento" d ON d."Documento_Id" = v."DocumentoVersao_DocumentoId"
        WHERE d."Documento_Status" = 'PUBLICADO' AND t."DocumentoTrecho_Busca" @@ consulta.q
          AND EXISTS (SELECT 1 FROM "DocumentoRevisao" r WHERE r."DocumentoRevisao_VersaoId" = v."DocumentoVersao_Id"
                       AND r."DocumentoRevisao_Decisao" = 'APROVADO')
        ORDER BY relevancia DESC, t."DocumentoTrecho_Id" LIMIT 20`,
      [consultaTexto],
    );
    const lexicalRows = lexical.rows as Array<Record<string, unknown> & { trecho_id: string }>;
    const capacidade = await this.capacidadeVetorial();
    if (!capacidade.pgvector || !this.embeddings.habilitado || capacidade.embeddings === 0) {
      return {
        consulta: consultaTexto, total: lexicalRows.length, resultados: lexicalRows,
        modo: 'LEXICAL', vetorial: false,
        motivo_fallback: !capacidade.pgvector ? 'PGVECTOR_INDISPONIVEL'
          : !this.embeddings.habilitado ? 'PROVEDOR_EMBEDDINGS_DESABILITADO' : 'SEM_EMBEDDINGS_INDEXADOS',
      };
    }
    try {
      const vetor = (await this.embeddings.gerar([consultaTexto]))[0];
      const literal = `[${vetor.join(',')}]`;
      const semantica = await this.db.query(
        `SELECT t."DocumentoTrecho_Id"::text AS trecho_id, d."Documento_Id"::text AS documento_id,
                d."Documento_Titulo" AS titulo, d."Documento_Orgao" AS orgao,
                d."Documento_Licenca" AS licenca, d."Documento_FonteUrl" AS fonte_url,
                v."DocumentoVersao_Id"::text AS versao_id, v."DocumentoVersao_Numero" AS versao,
                v."DocumentoVersao_HashSha256" AS hash, t."DocumentoTrecho_Pagina" AS pagina,
                left(t."DocumentoTrecho_Conteudo", 420) AS trecho,
                (1 - (e."DocumentoEmbedding_Vetor" <=> $1::vector))::float AS relevancia
           FROM "DocumentoEmbedding" e
           JOIN "DocumentoTrecho" t ON t."DocumentoTrecho_Id" = e."DocumentoEmbedding_TrechoId"
           JOIN "DocumentoVersao" v ON v."DocumentoVersao_Id" = t."DocumentoTrecho_VersaoId"
           JOIN "Documento" d ON d."Documento_Id" = v."DocumentoVersao_DocumentoId"
          WHERE d."Documento_Status" = 'PUBLICADO' AND e."DocumentoEmbedding_Modelo" = $2
            AND e."DocumentoEmbedding_Vetor" IS NOT NULL
          ORDER BY e."DocumentoEmbedding_Vetor" <=> $1::vector LIMIT 20`,
        [literal, this.embeddings.modelo],
      );
      const combinados = new Map<string, {
        item: Record<string, unknown> & { trecho_id: string }; score: number;
      }>();
      lexicalRows.forEach((item, i) => combinados.set(item.trecho_id, { item, score: 1 / (61 + i) }));
      (semantica.rows as Array<Record<string, unknown> & { trecho_id: string }>).forEach((item, i) => {
        const anterior = combinados.get(item.trecho_id);
        combinados.set(item.trecho_id, {
          item: anterior?.item ?? item,
          score: (anterior?.score ?? 0) + 1 / (61 + i),
        });
      });
      const resultados = [...combinados.values()].sort((a, b) => b.score - a.score).slice(0, 20)
        .map(({ item, score }) => ({ ...item, relevancia_hibrida: score }));
      return { consulta: consultaTexto, total: resultados.length, resultados, modo: 'HIBRIDA_RRF', vetorial: true };
    } catch (erro) {
      console.error('[documentos] busca vetorial indisponível:', erro);
      return {
        consulta: consultaTexto, total: lexicalRows.length, resultados: lexicalRows,
        modo: 'LEXICAL', vetorial: false, motivo_fallback: 'ERRO_PROVEDOR_VETORIAL',
      };
    }
  }

  private async capacidadeVetorial() {
    const r = await this.db.query<{ pgvector: boolean; embeddings: number }>(
      `SELECT
        (EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AND EXISTS (
          SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
            AND table_name = 'DocumentoEmbedding' AND column_name = 'DocumentoEmbedding_Vetor'
        )) AS pgvector,
        (SELECT count(*)::int FROM "DocumentoEmbedding" WHERE "DocumentoEmbedding_Modelo" = $1) AS embeddings`,
      [this.embeddings.modelo],
    );
    return r.rows[0] ?? { pgvector: false, embeddings: 0 };
  }

  async pendentes(contexto: TenantContext) {
    return this.db.withTenantTransaction(contexto, async () => {
      const r = await this.db.query(
      `SELECT d."Documento_Id"::text AS id, d."Documento_Titulo" AS titulo,
              d."Documento_Orgao" AS orgao, d."Documento_Tipo" AS tipo,
              d."Documento_CriadoPor" AS criado_por, d."Documento_CriadoEm"::text AS criado_em,
              v."DocumentoVersao_Id"::text AS versao_id, v."DocumentoVersao_NomeArquivo" AS arquivo,
              v."DocumentoVersao_Mime" AS mime, v."DocumentoVersao_StatusExtracao" AS extracao,
              v."DocumentoVersao_StatusSeguranca" AS seguranca,
              v."DocumentoVersao_AntivirusAssinatura" AS antivirus,
              v."DocumentoVersao_AntivirusDetalhe" AS antivirus_detalhe,
              v."DocumentoVersao_MetodoExtracao" AS metodo, v."DocumentoVersao_Confianca"::float AS confianca,
              left(v."DocumentoVersao_TextoExtraido", 1200) AS texto_amostra
         FROM "Documento" d JOIN "DocumentoVersao" v
           ON v."DocumentoVersao_DocumentoId" = d."Documento_Id"
        WHERE d."Documento_Status" = 'EM_ANALISE'
          AND NOT EXISTS (SELECT 1 FROM "DocumentoRevisao" r WHERE r."DocumentoRevisao_VersaoId" = v."DocumentoVersao_Id")
        ORDER BY d."Documento_CriadoEm"`,
    );
      return r.rows;
    });
  }

  async revisar(versaoId: number, dto: RevisaoDto, revisor: string, contexto: TenantContext) {
    if (!['APROVADO', 'REJEITADO'].includes(dto?.decisao ?? '') || (dto.justificativa?.trim().length ?? 0) < 10)
      throw new BadRequestException('Informe decisao (APROVADO|REJEITADO) e justificativa com ao menos 10 caracteres.');
    const resultado = await this.db.withTenantTransaction(contexto, async (client) => {
        const atual = await client.query<{
          documento_id: string; texto: string | null; seguranca: string; extracao: string;
        }>(
          `SELECT "DocumentoVersao_DocumentoId"::text AS documento_id,
                  "DocumentoVersao_TextoExtraido" AS texto,
                  "DocumentoVersao_StatusSeguranca" AS seguranca,
                  "DocumentoVersao_StatusExtracao" AS extracao
             FROM "DocumentoVersao" v WHERE "DocumentoVersao_Id" = $1
              AND NOT EXISTS (SELECT 1 FROM "DocumentoRevisao" r
                               WHERE r."DocumentoRevisao_VersaoId" = v."DocumentoVersao_Id")
             FOR UPDATE`, [versaoId],
        );
        if (!atual.rows[0]) throw new NotFoundException(`Versão ${versaoId} não encontrada ou já revisada.`);
        if (dto.decisao === 'APROVADO' && atual.rows[0].seguranca !== 'LIMPO')
          throw new BadRequestException('A aprovação exige verificação antivírus com resultado LIMPO.');
        if (dto.decisao === 'APROVADO' && !['PROCESSADO', 'REVISAO_NECESSARIA'].includes(atual.rows[0].extracao))
          throw new BadRequestException('A aprovação exige que a extração tenha sido concluída.');
        const texto = this.normalizarTexto(dto.texto_revisado ?? atual.rows[0].texto ?? '');
        if (dto.decisao === 'APROVADO' && texto.length < 20)
          throw new BadRequestException('A aprovação exige texto extraído/revisado com ao menos 20 caracteres.');
        await client.query(
          `INSERT INTO "DocumentoRevisao"
             ("DocumentoRevisao_VersaoId","DocumentoRevisao_Revisor","DocumentoRevisao_Decisao",
              "DocumentoRevisao_Justificativa") VALUES ($1,$2,$3,$4)`,
          [versaoId, revisor, dto.decisao, dto.justificativa!.trim()],
        );
        if (dto.decisao === 'APROVADO') {
          await client.query(
            `UPDATE "DocumentoVersao" SET "DocumentoVersao_TextoExtraido" = $2,
                    "DocumentoVersao_StatusExtracao" = 'PROCESSADO'
              WHERE "DocumentoVersao_Id" = $1`, [versaoId, texto],
          );
          await client.query(`DELETE FROM "DocumentoTrecho" WHERE "DocumentoTrecho_VersaoId" = $1`, [versaoId]);
          const trechos = this.trechos(texto);
          await client.query(
            `INSERT INTO "DocumentoTrecho"
               ("DocumentoTrecho_VersaoId","DocumentoTrecho_Ordem","DocumentoTrecho_Conteudo")
             SELECT $1, x.ordem - 1, x.conteudo
               FROM unnest($2::text[]) WITH ORDINALITY AS x(conteudo, ordem)`,
            [versaoId, trechos],
          );
          await client.query(
            `INSERT INTO "DocumentoTarefa" ("DocumentoTarefa_VersaoId","DocumentoTarefa_Tipo")
             VALUES ($1,'GERAR_EMBEDDINGS')
             ON CONFLICT ("DocumentoTarefa_VersaoId","DocumentoTarefa_Tipo") DO UPDATE SET
               "DocumentoTarefa_Status" = 'PENDENTE', "DocumentoTarefa_Tentativas" = 0,
               "DocumentoTarefa_DisponivelEm" = now(), "DocumentoTarefa_Erro" = NULL`,
            [versaoId],
          );
        }
        await client.query(
          `UPDATE "Documento" SET "Documento_Status" = $2, "Documento_AtualizadoEm" = now()
            WHERE "Documento_Id" = $1`,
          [atual.rows[0].documento_id, dto.decisao === 'APROVADO' ? 'PUBLICADO' : 'REJEITADO'],
        );
      return { documentoId: atual.rows[0].documento_id, trechos: dto.decisao === 'APROVADO' ? this.trechos(texto).length : 0 };
    });
    await this.trilha.registrar(revisor, 'REVISAO_DOCUMENTO', 'Documento', resultado.documentoId, {
      versao_id: versaoId, decisao: dto.decisao, justificativa: dto.justificativa,
    }, contexto);
    return { id: resultado.documentoId, versao_id: versaoId, status: dto.decisao, trechos: resultado.trechos };
  }

  async operacao(contexto: TenantContext) {
    return this.db.withTenantTransaction(contexto, async () => {
      const [fila, versoes, vetorial] = await Promise.all([
      this.db.query<{ status: string; tipo: string; total: number }>(
        `SELECT "DocumentoTarefa_Tipo" AS tipo, "DocumentoTarefa_Status" AS status, count(*)::int AS total
           FROM "DocumentoTarefa" GROUP BY 1,2 ORDER BY 1,2`,
      ),
      this.db.query<{ seguranca: string; total: number }>(
        `SELECT "DocumentoVersao_StatusSeguranca" AS seguranca, count(*)::int AS total
           FROM "DocumentoVersao" GROUP BY 1 ORDER BY 1`,
      ),
      this.capacidadeVetorial(),
    ]);
      return {
      worker_automatico: process.env.DOCUMENTOS_WORKER === '1',
      antivirus: process.env.ANTIVIRUS_MODE === 'mock' && process.env.NODE_ENV === 'test'
        ? 'MOCK_TESTE' : 'CLAMAV',
      embeddings_provider: process.env.EMBEDDINGS_PROVIDER ?? 'disabled',
      pgvector: vetorial.pgvector,
      embeddings_indexados: vetorial.embeddings,
      fila: fila.rows,
        versoes: versoes.rows,
      };
    });
  }

  async arquivoPublicado(versaoId: number) {
    const r = await this.db.query<{ caminho: string; nome: string; mime: string; tenant_id: string; organization_id: string }>(
      `SELECT v."DocumentoVersao_CaminhoObjeto" AS caminho, v."DocumentoVersao_NomeArquivo" AS nome,
              v."DocumentoVersao_Mime" AS mime,
              v."DocumentoVersao_TenantId"::text AS tenant_id,
              v."DocumentoVersao_OrganizacaoId"::text AS organization_id
         FROM "DocumentoVersao" v JOIN "Documento" d
           ON d."Documento_Id" = v."DocumentoVersao_DocumentoId"
        WHERE v."DocumentoVersao_Id" = $1 AND d."Documento_Status" = 'PUBLICADO'
          AND EXISTS (SELECT 1 FROM "DocumentoRevisao" r WHERE r."DocumentoRevisao_VersaoId" = v."DocumentoVersao_Id"
                       AND r."DocumentoRevisao_Decisao" = 'APROVADO')`, [versaoId],
    );
    if (!r.rows[0]) throw new NotFoundException('Arquivo não publicado.');
    let conteudo: Buffer;
    try {
      conteudo = await this.storage.ler({
        tenantId: r.rows[0].tenant_id, organizationId: r.rows[0].organization_id,
      }, r.rows[0].caminho);
    } catch { throw new NotFoundException('Arquivo não está disponível no armazenamento.'); }
    return {
      arquivo: new StreamableFile(conteudo),
      nome: r.rows[0].nome,
      mime: r.rows[0].mime,
    };
  }
}
