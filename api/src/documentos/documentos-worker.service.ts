import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { hostname } from 'node:os';
import { DatabaseService, TenantContext } from '../database/database.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AntivirusService } from './antivirus.service';
import { EmbeddingsService } from './embeddings.service';
import { ExtracaoService } from './extracao.service';
import { TenantObjectStorageService } from '../auth/tenant-object-storage.service';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

interface Tarefa {
  id: string;
  tipo: 'SCAN_EXTRAIR' | 'GERAR_EMBEDDINGS';
  versao_id: string;
  documento_id: string;
  caminho: string;
  mime: string;
  tentativas: number;
}

@Injectable()
export class DocumentosWorkerService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private executando = false;
  private readonly worker = `${hostname()}:${process.pid}`;

  constructor(
    private readonly db: DatabaseService,
    private readonly trilha: AuditoriaService,
    private readonly antivirus: AntivirusService,
    private readonly extracao: ExtracaoService,
    private readonly embeddings: EmbeddingsService,
    private readonly storage: TenantObjectStorageService,
  ) {}

  onModuleInit() {
    if (process.env.DOCUMENTOS_WORKER !== '1') return;
    this.timer = setInterval(() => void this.ciclo(), 2_000);
    this.timer.unref();
    void this.ciclo();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private async ciclo() {
    if (this.executando) return;
    this.executando = true;
    try {
      const tenantId = process.env.DOCUMENTOS_WORKER_TENANT_ID;
      const organizationId = process.env.DOCUMENTOS_WORKER_ORGANIZATION_ID;
      if (!tenantId || !organizationId)
        throw new Error('Worker documental exige DOCUMENTOS_WORKER_TENANT_ID e DOCUMENTOS_WORKER_ORGANIZATION_ID.');
      await this.processar({ tenantId, organizationId }, 5);
    }
    catch (e) { console.error('[documentos-worker]', e); }
    finally { this.executando = false; }
  }

  async processar(contexto: TenantContext, limite = 1) {
    const max = Math.min(Math.max(limite, 1), 20);
    let processadas = 0;
    for (; processadas < max; processadas++) {
      const tarefa = await this.db.withTenantTransaction(contexto, () => this.reivindicar());
      if (!tarefa) break;
      try {
        await this.db.withTenantTransaction(contexto, async () => {
          if (tarefa.tipo === 'SCAN_EXTRAIR') await this.scanearExtrair(tarefa, contexto);
          else await this.gerarEmbeddings(tarefa);
          await this.concluir(tarefa.id);
        });
      } catch (erro) {
        await this.db.withTenantTransaction(contexto, () => this.falhar(tarefa, erro as Error));
      }
    }
    return { processadas };
  }

  private async reivindicar(): Promise<Tarefa | null> {
    const r = await this.db.query<Tarefa>(
      `UPDATE "DocumentoTarefa" tarefa SET
          "DocumentoTarefa_Status" = 'PROCESSANDO',
          "DocumentoTarefa_Tentativas" = tarefa."DocumentoTarefa_Tentativas" + 1,
          "DocumentoTarefa_ReivindicadaEm" = now(), "DocumentoTarefa_Worker" = $1,
          "DocumentoTarefa_Erro" = NULL
        WHERE tarefa."DocumentoTarefa_Id" = (
          SELECT fila."DocumentoTarefa_Id" FROM "DocumentoTarefa" fila
           WHERE fila."DocumentoTarefa_Status" = 'PENDENTE'
             AND fila."DocumentoTarefa_DisponivelEm" <= now()
           ORDER BY fila."DocumentoTarefa_DisponivelEm", fila."DocumentoTarefa_Id"
           LIMIT 1 FOR UPDATE SKIP LOCKED
        )
        RETURNING tarefa."DocumentoTarefa_Id"::text AS id,
          tarefa."DocumentoTarefa_Tipo" AS tipo,
          tarefa."DocumentoTarefa_VersaoId"::text AS versao_id,
          (SELECT v."DocumentoVersao_DocumentoId"::text FROM "DocumentoVersao" v
            WHERE v."DocumentoVersao_Id" = tarefa."DocumentoTarefa_VersaoId") AS documento_id,
          (SELECT v."DocumentoVersao_CaminhoObjeto" FROM "DocumentoVersao" v
            WHERE v."DocumentoVersao_Id" = tarefa."DocumentoTarefa_VersaoId") AS caminho,
          (SELECT v."DocumentoVersao_Mime" FROM "DocumentoVersao" v
            WHERE v."DocumentoVersao_Id" = tarefa."DocumentoTarefa_VersaoId") AS mime,
          tarefa."DocumentoTarefa_Tentativas" AS tentativas`,
      [this.worker],
    );
    return r.rows[0] ?? null;
  }

  private async scanearExtrair(tarefa: Tarefa, contexto: TenantContext) {
    const diretorio = await mkdtemp(join(tmpdir(), 'itmt-documento-'));
    const arquivoTemporario = join(diretorio, `entrada${extname(tarefa.caminho) || '.bin'}`);
    try {
    await writeFile(arquivoTemporario, await this.storage.ler(contexto, tarefa.caminho), { mode: 0o600 });
    const scan = await this.antivirus.verificar(arquivoTemporario);
    if (!scan.limpo) {
      await this.db.query(
            `UPDATE "DocumentoVersao" SET "DocumentoVersao_StatusSeguranca" = 'INFECTADO',
                    "DocumentoVersao_AntivirusAssinatura" = $2,
                    "DocumentoVersao_AntivirusDetalhe" = $3,
                    "DocumentoVersao_VerificadoEm" = now(), "DocumentoVersao_StatusExtracao" = 'ERRO'
              WHERE "DocumentoVersao_Id" = $1`, [tarefa.versao_id, scan.assinatura, scan.detalhe],
      );
      await this.db.query(`UPDATE "Documento" SET "Documento_Status" = 'REJEITADO',
        "Documento_AtualizadoEm" = now() WHERE "Documento_Id" = $1`, [tarefa.documento_id]);
      await this.trilha.registrar('worker-documentos', 'ARQUIVO_INFECTADO', 'Documento', tarefa.documento_id,
        { versao_id: tarefa.versao_id, assinatura: scan.assinatura });
      return;
    }
    const extracao = this.extracao.extrair(arquivoTemporario, tarefa.mime);
    await this.db.query(
      `UPDATE "DocumentoVersao" SET "DocumentoVersao_StatusSeguranca" = 'LIMPO',
              "DocumentoVersao_AntivirusAssinatura" = $2, "DocumentoVersao_AntivirusDetalhe" = $3,
              "DocumentoVersao_VerificadoEm" = now(), "DocumentoVersao_StatusExtracao" = $4,
              "DocumentoVersao_MetodoExtracao" = $5, "DocumentoVersao_Confianca" = $6,
              "DocumentoVersao_TextoExtraido" = $7
        WHERE "DocumentoVersao_Id" = $1`,
      [tarefa.versao_id, scan.assinatura, scan.detalhe, extracao.status, extracao.metodo,
       extracao.confianca, extracao.texto || null],
    );
    await this.trilha.registrar('worker-documentos', 'ARQUIVO_VERIFICADO', 'Documento', tarefa.documento_id,
      { versao_id: tarefa.versao_id, antivirus: scan.assinatura, extracao: extracao.status });
    } finally {
      await rm(diretorio, { recursive: true, force: true });
    }
  }

  private async gerarEmbeddings(tarefa: Tarefa) {
    if (!this.embeddings.habilitado) throw new Error('Provedor de embeddings desabilitado.');
    const r = await this.db.query<{ id: string; conteudo: string }>(
      `SELECT t."DocumentoTrecho_Id"::text AS id, t."DocumentoTrecho_Conteudo" AS conteudo
         FROM "DocumentoTrecho" t
         JOIN "DocumentoVersao" v ON v."DocumentoVersao_Id" = t."DocumentoTrecho_VersaoId"
         JOIN "Documento" d ON d."Documento_Id" = v."DocumentoVersao_DocumentoId"
        WHERE t."DocumentoTrecho_VersaoId" = $1 AND d."Documento_Status" = 'PUBLICADO'
        ORDER BY t."DocumentoTrecho_Ordem"`, [tarefa.versao_id],
    );
    if (!r.rows.length) throw new Error('Versão não publicada ou sem trechos para vetorizar.');
    const vetores: number[][] = [];
    for (let i = 0; i < r.rows.length; i += 100) {
      vetores.push(...await this.embeddings.gerar(r.rows.slice(i, i + 100).map((x) => x.conteudo)));
    }
    const payload = r.rows.map((linha, i) => ({
      trecho_id: linha.id,
      hash: this.embeddings.hashConteudo(linha.conteudo),
      vetor: vetores[i],
      literal: `[${vetores[i].join(',')}]`,
    }));
    await this.db.query(
      `WITH entrada AS (
         SELECT (x->>'trecho_id')::bigint AS trecho_id, x->>'hash' AS hash,
                ARRAY(SELECT jsonb_array_elements_text(x->'vetor'))::real[] AS vetor
           FROM jsonb_array_elements($1::jsonb) x
       )
       INSERT INTO "DocumentoEmbedding"
         ("DocumentoEmbedding_TrechoId","DocumentoEmbedding_Modelo","DocumentoEmbedding_Dimensoes",
          "DocumentoEmbedding_VetorArray","DocumentoEmbedding_ConteudoHash")
       SELECT trecho_id, $2, 1536, vetor, hash FROM entrada
       ON CONFLICT ("DocumentoEmbedding_TrechoId","DocumentoEmbedding_Modelo") DO UPDATE SET
         "DocumentoEmbedding_VetorArray" = EXCLUDED."DocumentoEmbedding_VetorArray",
         "DocumentoEmbedding_ConteudoHash" = EXCLUDED."DocumentoEmbedding_ConteudoHash",
         "DocumentoEmbedding_CriadoEm" = now()`,
      [JSON.stringify(payload), this.embeddings.modelo],
    );
    if (await this.pgvectorAtivo()) {
      await this.db.query(
        `WITH entrada AS (
           SELECT (x->>'trecho_id')::bigint AS trecho_id, x->>'literal' AS literal
             FROM jsonb_array_elements($1::jsonb) x
         )
         UPDATE "DocumentoEmbedding" e
            SET "DocumentoEmbedding_Vetor" = entrada.literal::vector
           FROM entrada WHERE e."DocumentoEmbedding_TrechoId" = entrada.trecho_id
             AND e."DocumentoEmbedding_Modelo" = $2`,
        [JSON.stringify(payload), this.embeddings.modelo],
      );
    }
    await this.trilha.registrar('worker-documentos', 'EMBEDDINGS_GERADOS', 'Documento', tarefa.documento_id,
      { versao_id: tarefa.versao_id, modelo: this.embeddings.modelo, trechos: payload.length });
  }

  async pgvectorAtivo() {
    const r = await this.db.query<{ ativo: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AND EXISTS (
         SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
          AND table_name = 'DocumentoEmbedding' AND column_name = 'DocumentoEmbedding_Vetor'
       ) AS ativo`,
    );
    return Boolean(r.rows[0]?.ativo);
  }

  private concluir(id: string) {
    return this.db.query(
      `UPDATE "DocumentoTarefa" SET "DocumentoTarefa_Status" = 'CONCLUIDA',
              "DocumentoTarefa_ConcluidaEm" = now(), "DocumentoTarefa_Erro" = NULL
        WHERE "DocumentoTarefa_Id" = $1`, [id],
    );
  }

  private async falhar(tarefa: Tarefa, erro: Error) {
    const mensagem = (erro?.message ?? String(erro)).slice(0, 1000);
    const terminal = tarefa.tentativas >= 3 || /desabilitado|ausente para gerar/i.test(mensagem);
    await this.db.query(
      `UPDATE "DocumentoTarefa" SET "DocumentoTarefa_Status" = $2,
              "DocumentoTarefa_DisponivelEm" = now() + (($3 * $3) || ' minutes')::interval,
              "DocumentoTarefa_Erro" = $4
        WHERE "DocumentoTarefa_Id" = $1`,
      [tarefa.id, terminal ? 'FALHOU' : 'PENDENTE', tarefa.tentativas, mensagem],
    );
    if (tarefa.tipo === 'SCAN_EXTRAIR') {
      await this.db.query(
        `UPDATE "DocumentoVersao" SET "DocumentoVersao_StatusSeguranca" = 'ERRO',
                "DocumentoVersao_AntivirusDetalhe" = $2
          WHERE "DocumentoVersao_Id" = $1`, [tarefa.versao_id, mensagem],
      );
    }
  }
}
