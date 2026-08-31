import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PoolClient } from 'pg';
import { DatabaseService, PLATFORM_PUBLIC_CONTEXT, TenantContext } from '../database/database.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

/**
 * PERSISTÊNCIA DE PESQUISAS (Gauntlet "Pesquisa vs IA Xingú" — P1, db/48).
 *
 * Toda pesquisa executada (modo pesquisa ou xingu) é gravada NORMALIZADA em
 * uma única transação; reabrir uma pesquisa reconstrói o envelope completo
 * SÓ do banco, sem reexecutar motor nem LLM. A gravação faz parte da
 * execução: se falhar, a exceção propaga e a pesquisa NÃO é considerada
 * concluída (regra do PLANO §3/P1). A trilha imutável continua sendo
 * "EventoAuditoria" (ação PESQUISA_EXECUTADA); estas tabelas são o registro
 * operacional consultável.
 *
 * CADEIA DE CORRELAÇÃO (P8 · AUDITORIA):
 *
 *   EventoAuditoria(CONSULTA_CHAT).payload.pesquisa_id ─┐   (trilha imutável)
 *   EventoAuditoria(PESQUISA_EXECUTADA).entidadeId ─────┤
 *                                                       ▼
 *                                   "Pesquisa"."Pesquisa_Id"
 *                                                       │
 *                                                       ▼
 *                     "PesquisaExecucaoAgente" (etapas A01/A04/A05/A06
 *                      DESTA pesquisa, com duração medida no orquestrador)
 *                                                       ↕ (por agente/janela)
 *                     "AgentExecution" (log operacional GLOBAL do
 *                      AgentExecutorService — sem FK: correlaciona-se por
 *                      nome do agente + timestamp)
 *
 *   Limitação registrada por desenho: "ConsumoLlm" NÃO carrega pesquisa_id.
 *   Ele só existe quando um provedor LLM está ativo (RG-05: o caminho
 *   primário é o léxico determinístico, que não consome tokens) e mede
 *   orçamento por borda (A01/A05/SITUACAO), não por pesquisa. Correlação
 *   fina de custo por pesquisa fica para quando houver crédito de LLM.
 */

export type ModoPesquisa = 'pesquisa' | 'xingu';
export type RecortePesquisa = 'ESTADO' | 'MUNICIPIO' | 'RGINT' | 'RGI' | 'CONSORCIO';
export type EstadoPesquisa = 'RESPONDIDA' | 'CLARIFICACAO' | 'SEM_DADO' | 'BLOQUEADA';
export type TipoDashboard = 'CARD' | 'BARRAS' | 'TABELA' | 'MAPA' | 'SERIE' | 'DECOMPOSICAO' | 'COMPARACAO';

const MODOS: ModoPesquisa[] = ['pesquisa', 'xingu'];
const RECORTES: RecortePesquisa[] = ['ESTADO', 'MUNICIPIO', 'RGINT', 'RGI', 'CONSORCIO'];
const ESTADOS: EstadoPesquisa[] = ['RESPONDIDA', 'CLARIFICACAO', 'SEM_DADO', 'BLOQUEADA'];
const TIPOS_DASHBOARD: TipoDashboard[] = ['CARD', 'BARRAS', 'TABELA', 'MAPA', 'SERIE', 'DECOMPOSICAO', 'COMPARACAO'];
// Evolução E1 (db/54): o vocabulário de dimensões de causa NÃO é mais uma
// lista fixa aqui — é o catálogo "DimensaoObservacao", validado em runtime
// na gravação (validarDimensoes), com a FK do banco como última linha.
const CATEGORIAS_SERIE = ['OBSERVADO', 'PROJECAO', 'CENARIO'] as const;

/** Versão do motor congelada em cada pesquisa (correlaciona snapshot ↔ código). */
export const VERSAO_MOTOR = 'itmt-api/0.1.0';

export interface SnapshotIndicadorMunicipio {
  codigoIbge: string;
  valor: number;
  posicao: number;
  topN?: boolean;
  deltaMediaEstadual?: number | null;
}

export interface SnapshotSerieHistorica {
  /** Território do ponto; ausente = o recorte principal da pesquisa. */
  codigoIbge?: string | null;
  ano: number;
  valor: number;
  categoria?: (typeof CATEGORIAS_SERIE)[number];
}

export interface SnapshotCausa {
  codigoIbge?: string | null;
  /** Código do catálogo "DimensaoObservacao" (db/54) — validado em runtime. */
  dimensao: string;
  categoria: string;
  periodo: string;
  valor: number;
}

export interface SnapshotIndicador {
  indicadorId: number;
  nome: string;
  valor: number;
  unidade: string;
  dataReferencia: string; // AAAA-MM-DD
  agregacao: string;
  municipiosAgregados?: number | null;
  municipios?: SnapshotIndicadorMunicipio[];
  serie?: SnapshotSerieHistorica[];
  causas?: SnapshotCausa[];
}

export interface SnapshotDashboard {
  tipo: TipoDashboard;
  configuracao: Record<string, unknown>;
  ordem: number;
  modo: ModoPesquisa;
}

/**
 * A origem é declarada por ÍNDICE no array `indicadores` do snapshot (as PKs
 * só existem depois do INSERT); o serviço resolve para as FKs reais. Sugestão
 * sem origem é rejeitada aqui E por CHECK no banco (dossiê, não decisão).
 */
export interface SnapshotSugestao {
  texto: string;
  praticaCitada: string;
  agente: string;
  indicadorIndice: number;
  /** presente ⇒ a FK aponta para a linha município daquele indicador */
  codigoIbge?: string | null;
}

export interface SnapshotFonte {
  /** Id em "Fonte"; pode ser omitido quando o chamador só conhece o nome. */
  fonteId?: number;
  /**
   * Nome em "Fonte" (é o que a procedência do motor carrega) — resolvido
   * para FonteId DENTRO da transação de gravação. O schema (db/48) exige
   * "PesquisaFonte_FonteId" NOT NULL, então fonte irresolúvel fica FORA do
   * snapshot persistido (e, por consequência, fora do hash) — limitação
   * honesta: url/hash sem FonteId não têm onde morar sem alterar a P1.
   */
  nome?: string | null;
  cargaId?: number | null;
  hashSha256?: string | null;
  url?: string | null;
  dataExtracao?: string | null; // ISO
}

export interface SnapshotExecucaoAgente {
  agente: string;
  entrada?: unknown;
  saida?: unknown;
  duracaoMs?: number | null;
  ok: boolean;
}

export interface GravarPesquisaDto {
  modo: ModoPesquisa;
  pergunta: string;
  area?: string | null;
  recorte: RecortePesquisa;
  codigo?: string | null;
  usuarioId?: string | null;
  estado: EstadoPesquisa;
  versaoMotor?: string;
  indicadores?: SnapshotIndicador[];
  dashboards?: SnapshotDashboard[];
  sugestoes?: SnapshotSugestao[];
  fontes?: SnapshotFonte[];
  execucoes?: SnapshotExecucaoAgente[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Canonização PROFUNDA (chaves ordenadas em todos os níveis) + sha256 em
 * Node (nunca cast text::bytea — ver a lição em auditoria.service.ts). O
 * helper da auditoria usa `JSON.stringify(p, Object.keys(p).sort())`, que
 * basta para payloads rasos mas DESCARTA chaves aninhadas fora da lista
 * (o segundo argumento é allowlist para todos os níveis); o snapshot da
 * pesquisa é profundo, então a ordenação aqui é recursiva.
 */
export function canonizar(v: unknown): string {
  if (v === null || v === undefined || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonizar).join(',')}]`;
  const o = v as Record<string, unknown>;
  const chaves = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${chaves.map((k) => `${JSON.stringify(k)}:${canonizar(o[k])}`).join(',')}}`;
}

export function hashCanonico(payload: unknown): string {
  return createHash('sha256').update(canonizar(payload), 'utf8').digest('hex');
}

/** Sugestão na FORMA DE HASH: a origem já resolvida (id do indicador do
 *  catálogo + município), não o índice posicional do DTO de gravação. */
export interface SugestaoNormalizada {
  texto: string;
  praticaCitada: string;
  agente: string;
  origem: { indicadorId: number | null; codigoIbge: string | null };
}

/** Fonte na forma de hash: FonteId já resolvido, dataExtracao em ISO. */
export interface FonteNormalizada {
  fonteId: number;
  cargaId: number | null;
  hashSha256: string | null;
  url: string | null;
  dataExtracao: string | null;
}

/** Ordena um array pela forma canônica de cada elemento: a posição física
 *  das linhas (ordem de INSERT ou de SELECT) não participa do hash. */
function ordenarCanonico<T>(xs: T[]): T[] {
  return xs
    .map((x) => [canonizar(x), x] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, x]) => x);
}

/**
 * FORMA CANÔNICA DO SNAPSHOT — gap do crítico da P1, requisito da P4:
 * a MESMA função constrói o shape hasheado na gravação e o recomputado na
 * reabertura (`hash_confere`). Regras: defaults explícitos (undefined vira
 * null/false/'OBSERVADO'), datas de extração em ISO-8601, arrays em ordem
 * canônica. Telemetria (execuções) e identidade (usuarioId) ficam FORA do
 * hash: o selo cobre a RESPOSTA que a reabertura precisa devolver idêntica.
 */
export function normalizarParaHash(p: {
  modo: string;
  pergunta: string;
  area?: unknown;
  recorte: string;
  codigo?: unknown;
  estado: string;
  versaoMotor?: unknown;
  indicadores?: Array<{
    indicadorId: number;
    nome: unknown;
    valor: number;
    unidade: unknown;
    dataReferencia: unknown;
    agregacao: unknown;
    municipiosAgregados?: number | null;
    municipios?: Array<{
      codigoIbge: unknown; valor: number; posicao: number;
      topN?: boolean; deltaMediaEstadual?: number | null;
    }>;
    serie?: Array<{ codigoIbge?: unknown; ano: number; valor: number; categoria?: unknown }>;
    causas?: Array<{ codigoIbge?: unknown; dimensao: unknown; categoria: unknown; periodo: unknown; valor: number }>;
  }>;
  dashboards?: Array<{ tipo: unknown; configuracao: unknown; ordem: number; modo: unknown }>;
  sugestoes?: SugestaoNormalizada[];
  fontes?: FonteNormalizada[];
}): Record<string, unknown> {
  return {
    modo: p.modo,
    pergunta: p.pergunta,
    area: p.area ?? null,
    recorte: p.recorte,
    codigo: p.codigo ?? null,
    estado: p.estado,
    versaoMotor: p.versaoMotor ?? VERSAO_MOTOR,
    indicadores: ordenarCanonico((p.indicadores ?? []).map((i) => ({
      indicadorId: i.indicadorId,
      nome: i.nome,
      valor: i.valor,
      unidade: i.unidade,
      dataReferencia: i.dataReferencia,
      agregacao: i.agregacao,
      municipiosAgregados: i.municipiosAgregados ?? null,
      municipios: ordenarCanonico((i.municipios ?? []).map((m) => ({
        codigoIbge: m.codigoIbge,
        valor: m.valor,
        posicao: m.posicao,
        topN: m.topN ?? false,
        deltaMediaEstadual: m.deltaMediaEstadual ?? null,
      }))),
      serie: ordenarCanonico((i.serie ?? []).map((s) => ({
        codigoIbge: s.codigoIbge ?? null,
        ano: s.ano,
        valor: s.valor,
        categoria: s.categoria ?? 'OBSERVADO',
      }))),
      causas: ordenarCanonico((i.causas ?? []).map((c) => ({
        codigoIbge: c.codigoIbge ?? null,
        dimensao: c.dimensao,
        categoria: c.categoria,
        periodo: c.periodo,
        valor: c.valor,
      }))),
    }))),
    dashboards: ordenarCanonico((p.dashboards ?? []).map((d) => ({
      tipo: d.tipo, configuracao: d.configuracao, ordem: d.ordem, modo: d.modo,
    }))),
    sugestoes: ordenarCanonico((p.sugestoes ?? []).map((s) => ({
      texto: s.texto,
      praticaCitada: s.praticaCitada,
      agente: s.agente,
      origem: {
        indicadorId: s.origem.indicadorId ?? null,
        codigoIbge: s.origem.codigoIbge ?? null,
      },
    }))),
    fontes: ordenarCanonico((p.fontes ?? []).map((f) => ({
      fonteId: f.fonteId,
      cargaId: f.cargaId ?? null,
      hashSha256: f.hashSha256 ?? null,
      url: f.url ?? null,
      dataExtracao: f.dataExtracao ?? null,
    }))),
  };
}

@Injectable()
export class PesquisasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly trilha: AuditoriaService,
  ) {}

  /**
   * Grava o snapshot completo em UMA transação tenant. Reusa a transação
   * corrente quando o chamador (orquestrador via controller) já está dentro
   * de withTenantTransaction; senão abre a sua com o contexto informado.
   * Qualquer falha propaga — a execução não se conclui sem persistir.
   */
  async gravar(
    dto: GravarPesquisaDto,
    contexto: TenantContext = PLATFORM_PUBLIC_CONTEXT,
  ): Promise<{ id: string; hash: string }> {
    this.validar(dto);
    await this.validarDimensoes(dto);

    // Tudo dentro de UMA transação: resolve FonteId por nome, sela o hash
    // pela FORMA CANÔNICA (a mesma que reabrir() recomputa — hash_confere)
    // e insere. O hash cobre a RESPOSTA; telemetria (execuções de agentes)
    // e identidade do usuário ficam fora.
    const executarTudo = async (client: PoolClient) => {
      const fontes = await this.resolverFontes(client, dto.fontes ?? []);
      const hash = hashCanonico(normalizarParaHash({
        modo: dto.modo,
        pergunta: dto.pergunta,
        area: dto.area,
        recorte: dto.recorte,
        codigo: dto.codigo,
        estado: dto.estado,
        versaoMotor: dto.versaoMotor,
        indicadores: dto.indicadores,
        dashboards: dto.dashboards,
        // A forma de hash carrega a ORIGEM resolvida (id de catálogo +
        // município), não o índice posicional — é o que a reabertura vê.
        sugestoes: (dto.sugestoes ?? []).map((s) => ({
          texto: s.texto,
          praticaCitada: s.praticaCitada,
          agente: s.agente,
          origem: {
            indicadorId: dto.indicadores?.[s.indicadorIndice]?.indicadorId ?? null,
            codigoIbge: s.codigoIbge ?? null,
          },
        })),
        fontes,
      }));
      const id = await this.inserirTudo(client, { ...dto, fontes }, hash);
      return { id, hash };
    };

    const emTransacao = this.db.currentTransactionClient();
    const { id, hash } = emTransacao
      ? await executarTudo(emTransacao)
      : await this.db.withTenantTransaction(contexto, executarTudo);

    // Trilha imutável (P8 correlaciona por entidadeId = uuid da pesquisa).
    // AuditoriaService não derruba a operação em caso de falha própria (RNF-11).
    await this.trilha.registrar('pesquisas', 'PESQUISA_EXECUTADA', 'Pesquisa', id, {
      modo: dto.modo,
      pergunta: dto.pergunta.slice(0, 200),
      estado: dto.estado,
      indicadores: dto.indicadores?.length ?? 0,
    }, contexto);

    return { id, hash };
  }

  /**
   * Resolve FonteId por nome DENTRO da transação (o nome é o que a
   * procedência do motor carrega). Fonte sem id resolvível fica fora do
   * snapshot — o schema exige FonteId NOT NULL (ver SnapshotFonte.nome) —
   * e a exclusão acontece ANTES do hash, mantendo o selo consistente com
   * o que de fato foi persistido. Datas de extração são normalizadas para
   * ISO-8601 (o que o timestamptz devolve na reabertura).
   */
  private async resolverFontes(client: PoolClient, fontes: SnapshotFonte[]): Promise<FonteNormalizada[]> {
    const out: FonteNormalizada[] = [];
    for (const f of fontes) {
      let fonteId = Number.isInteger(f.fonteId) ? (f.fonteId as number) : undefined;
      if (fonteId === undefined && typeof f.nome === 'string' && f.nome) {
        const r = await client.query<{ id: number }>(
          `SELECT "Fonte_Id" AS id FROM "Fonte" WHERE "Fonte_Nome" = $1 ORDER BY "Fonte_Id" LIMIT 1`,
          [f.nome],
        );
        fonteId = r.rows[0] ? Number(r.rows[0].id) : undefined;
      }
      if (fonteId === undefined) continue;
      out.push({
        fonteId,
        cargaId: f.cargaId ?? null,
        hashSha256: f.hashSha256 ?? null,
        url: f.url ?? null,
        dataExtracao: f.dataExtracao ? new Date(f.dataExtracao).toISOString() : null,
      });
    }
    return out;
  }

  private async inserirTudo(client: PoolClient, dto: GravarPesquisaDto, hash: string): Promise<string> {
    // Escopo real da transação (fail-closed): sem contexto tenant não se grava.
    const escopo = await client.query<{ tid: string | null; oid: string | null }>(
      `SELECT "ContextoTenant_Id"()::text AS tid, "ContextoOrganizacao_Id"()::text AS oid`,
    );
    const tid = escopo.rows[0]?.tid;
    const oid = escopo.rows[0]?.oid;
    if (!tid || !oid) throw new BadRequestException('Gravação de pesquisa exige contexto tenant ativo.');

    const pesquisa = await client.query<{ id: string }>(
      `INSERT INTO "Pesquisa"
         ("Pesquisa_TenantId","Pesquisa_OrganizacaoId","Pesquisa_Modo","Pesquisa_Pergunta",
          "Pesquisa_Area","Pesquisa_Recorte","Pesquisa_Codigo","Pesquisa_UsuarioId",
          "Pesquisa_Estado","Pesquisa_VersaoMotor","Pesquisa_Hash")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING "Pesquisa_Id" AS id`,
      [tid, oid, dto.modo, dto.pergunta, dto.area ?? null, dto.recorte, dto.codigo ?? null,
       dto.usuarioId ?? null, dto.estado, dto.versaoMotor ?? VERSAO_MOTOR, hash],
    );
    const pesquisaId = pesquisa.rows[0].id;

    // Mapas índice→PK para resolver as FKs das sugestões.
    const idIndicador: number[] = [];
    const idMunicipio: Map<string, number>[] = [];

    for (const ind of dto.indicadores ?? []) {
      const r = await client.query<{ id: string }>(
        `INSERT INTO "PesquisaIndicador"
           ("PesquisaIndicador_TenantId","PesquisaIndicador_OrganizacaoId","PesquisaIndicador_PesquisaId",
            "PesquisaIndicador_IndicadorId","PesquisaIndicador_Nome","PesquisaIndicador_Valor",
            "PesquisaIndicador_Unidade","PesquisaIndicador_DataReferencia","PesquisaIndicador_Agregacao",
            "PesquisaIndicador_MunicipiosAgregados")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING "PesquisaIndicador_Id" AS id`,
        [tid, oid, pesquisaId, ind.indicadorId, ind.nome, ind.valor, ind.unidade,
         ind.dataReferencia, ind.agregacao, ind.municipiosAgregados ?? null],
      );
      const indId = Number(r.rows[0].id);
      idIndicador.push(indId);
      const mapaMun = new Map<string, number>();
      idMunicipio.push(mapaMun);

      for (const m of ind.municipios ?? []) {
        const rm = await client.query<{ id: string }>(
          `INSERT INTO "PesquisaIndicadorMunicipio"
             ("PesquisaIndicadorMunicipio_TenantId","PesquisaIndicadorMunicipio_OrganizacaoId",
              "PesquisaIndicadorMunicipio_PesquisaIndicadorId","PesquisaIndicadorMunicipio_CodigoIbge",
              "PesquisaIndicadorMunicipio_Valor","PesquisaIndicadorMunicipio_Posicao",
              "PesquisaIndicadorMunicipio_TopN","PesquisaIndicadorMunicipio_DeltaMediaEstadual")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING "PesquisaIndicadorMunicipio_Id" AS id`,
          [tid, oid, indId, m.codigoIbge, m.valor, m.posicao, m.topN ?? false, m.deltaMediaEstadual ?? null],
        );
        mapaMun.set(m.codigoIbge, Number(rm.rows[0].id));
      }

      for (const s of ind.serie ?? []) {
        await client.query(
          `INSERT INTO "PesquisaSerieHistorica"
             ("PesquisaSerieHistorica_TenantId","PesquisaSerieHistorica_OrganizacaoId",
              "PesquisaSerieHistorica_PesquisaIndicadorId","PesquisaSerieHistorica_CodigoIbge",
              "PesquisaSerieHistorica_Ano","PesquisaSerieHistorica_Valor","PesquisaSerieHistorica_Categoria")
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [tid, oid, indId, s.codigoIbge ?? null, s.ano, s.valor, s.categoria ?? 'OBSERVADO'],
        );
      }

      for (const c of ind.causas ?? []) {
        await client.query(
          `INSERT INTO "PesquisaCausa"
             ("PesquisaCausa_TenantId","PesquisaCausa_OrganizacaoId","PesquisaCausa_PesquisaIndicadorId",
              "PesquisaCausa_CodigoIbge","PesquisaCausa_Dimensao","PesquisaCausa_Categoria",
              "PesquisaCausa_Periodo","PesquisaCausa_Valor")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [tid, oid, indId, c.codigoIbge ?? null, c.dimensao, c.categoria, c.periodo, c.valor],
        );
      }
    }

    for (const d of dto.dashboards ?? []) {
      await client.query(
        `INSERT INTO "PesquisaDashboard"
           ("PesquisaDashboard_TenantId","PesquisaDashboard_OrganizacaoId","PesquisaDashboard_PesquisaId",
            "PesquisaDashboard_Tipo","PesquisaDashboard_Configuracao","PesquisaDashboard_Ordem",
            "PesquisaDashboard_Modo")
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
        [tid, oid, pesquisaId, d.tipo, JSON.stringify(d.configuracao), d.ordem, d.modo],
      );
    }

    for (const s of dto.sugestoes ?? []) {
      const fkIndicador = idIndicador[s.indicadorIndice];
      const fkMunicipio = s.codigoIbge ? idMunicipio[s.indicadorIndice]?.get(s.codigoIbge) : undefined;
      if (s.codigoIbge && fkMunicipio === undefined) {
        throw new BadRequestException(
          `Sugestão cita município ${s.codigoIbge} que não está no snapshot do indicador ${s.indicadorIndice}.`,
        );
      }
      await client.query(
        `INSERT INTO "PesquisaSugestao"
           ("PesquisaSugestao_TenantId","PesquisaSugestao_OrganizacaoId","PesquisaSugestao_PesquisaId",
            "PesquisaSugestao_Texto","PesquisaSugestao_PraticaCitada",
            "PesquisaSugestao_PesquisaIndicadorMunicipioId","PesquisaSugestao_PesquisaIndicadorId",
            "PesquisaSugestao_Agente")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [tid, oid, pesquisaId, s.texto, s.praticaCitada,
         fkMunicipio ?? null, fkMunicipio !== undefined ? null : fkIndicador, s.agente],
      );
    }

    for (const f of dto.fontes ?? []) {
      await client.query(
        `INSERT INTO "PesquisaFonte"
           ("PesquisaFonte_TenantId","PesquisaFonte_OrganizacaoId","PesquisaFonte_PesquisaId",
            "PesquisaFonte_FonteId","PesquisaFonte_CargaId","PesquisaFonte_HashSha256",
            "PesquisaFonte_Url","PesquisaFonte_DataExtracao")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [tid, oid, pesquisaId, f.fonteId, f.cargaId ?? null, f.hashSha256 ?? null,
         f.url ?? null, f.dataExtracao ?? null],
      );
    }

    for (const e of dto.execucoes ?? []) {
      await client.query(
        `INSERT INTO "PesquisaExecucaoAgente"
           ("PesquisaExecucaoAgente_TenantId","PesquisaExecucaoAgente_OrganizacaoId",
            "PesquisaExecucaoAgente_PesquisaId","PesquisaExecucaoAgente_Agente",
            "PesquisaExecucaoAgente_Entrada","PesquisaExecucaoAgente_Saida",
            "PesquisaExecucaoAgente_DuracaoMs","PesquisaExecucaoAgente_Ok")
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8)`,
        [tid, oid, pesquisaId, e.agente,
         e.entrada === undefined ? null : JSON.stringify(e.entrada),
         e.saida === undefined ? null : JSON.stringify(e.saida),
         e.duracaoMs ?? null, e.ok],
      );
    }

    return pesquisaId;
  }

  /**
   * Reconstrói o envelope completo SÓ do banco (as 9 tabelas), sem tocar
   * motor nem LLM. Ausência é resposta com contexto (RN-005).
   */
  async reabrir(id: string) {
    if (!UUID.test(id)) throw new BadRequestException('Identificador de pesquisa inválido (uuid esperado).');

    const p = await this.db.query<Record<string, unknown>>(
      `SELECT "Pesquisa_Id" AS id, "Pesquisa_Modo" AS modo, "Pesquisa_Pergunta" AS pergunta,
              "Pesquisa_Area" AS area, "Pesquisa_Recorte" AS recorte, "Pesquisa_Codigo" AS codigo,
              "Pesquisa_UsuarioId" AS usuario_id, "Pesquisa_DataHora" AS data_hora,
              "Pesquisa_Estado" AS estado, "Pesquisa_VersaoMotor" AS versao_motor,
              "Pesquisa_Hash" AS hash
         FROM "Pesquisa" WHERE "Pesquisa_Id" = $1`,
      [id],
    );
    if (p.rows.length === 0) {
      throw new NotFoundException(
        'Pesquisa não encontrada. Ela pode não existir ou pertencer a outro contexto; consulte a lista em GET /v1/pesquisas.',
      );
    }
    const cab = p.rows[0];

    const inds = await this.db.query<Record<string, unknown>>(
      `SELECT "PesquisaIndicador_Id" AS id, "PesquisaIndicador_IndicadorId" AS indicador_id,
              "PesquisaIndicador_Nome" AS nome, "PesquisaIndicador_Valor" AS valor,
              "PesquisaIndicador_Unidade" AS unidade,
              "PesquisaIndicador_DataReferencia"::text AS data_referencia,
              "PesquisaIndicador_Agregacao" AS agregacao,
              "PesquisaIndicador_MunicipiosAgregados" AS municipios_agregados
         FROM "PesquisaIndicador" WHERE "PesquisaIndicador_PesquisaId" = $1
        ORDER BY "PesquisaIndicador_Id"`,
      [id],
    );

    const indicadores = [] as Array<Record<string, unknown>>;
    const porIdIndicador = new Map<number, Record<string, unknown>>();
    const municipioPorId = new Map<number, { indicadorId: number; codigoIbge: string }>();

    for (const row of inds.rows) {
      const indId = Number(row.id);
      const municipios = await this.db.query<Record<string, unknown>>(
        `SELECT "PesquisaIndicadorMunicipio_Id" AS id,
                "PesquisaIndicadorMunicipio_CodigoIbge" AS codigo_ibge,
                "PesquisaIndicadorMunicipio_Valor" AS valor,
                "PesquisaIndicadorMunicipio_Posicao" AS posicao,
                "PesquisaIndicadorMunicipio_TopN" AS top_n,
                "PesquisaIndicadorMunicipio_DeltaMediaEstadual" AS delta_media_estadual
           FROM "PesquisaIndicadorMunicipio"
          WHERE "PesquisaIndicadorMunicipio_PesquisaIndicadorId" = $1
          ORDER BY "PesquisaIndicadorMunicipio_Posicao"`,
        [indId],
      );
      const serie = await this.db.query<Record<string, unknown>>(
        `SELECT "PesquisaSerieHistorica_CodigoIbge" AS codigo_ibge,
                "PesquisaSerieHistorica_Ano" AS ano, "PesquisaSerieHistorica_Valor" AS valor,
                "PesquisaSerieHistorica_Categoria" AS categoria
           FROM "PesquisaSerieHistorica"
          WHERE "PesquisaSerieHistorica_PesquisaIndicadorId" = $1
          ORDER BY "PesquisaSerieHistorica_CodigoIbge" NULLS FIRST, "PesquisaSerieHistorica_Ano"`,
        [indId],
      );
      const causas = await this.db.query<Record<string, unknown>>(
        `SELECT "PesquisaCausa_CodigoIbge" AS codigo_ibge, "PesquisaCausa_Dimensao" AS dimensao,
                "PesquisaCausa_Categoria" AS categoria, "PesquisaCausa_Periodo" AS periodo,
                "PesquisaCausa_Valor" AS valor
           FROM "PesquisaCausa" WHERE "PesquisaCausa_PesquisaIndicadorId" = $1
          ORDER BY "PesquisaCausa_Id"`,
        [indId],
      );

      const envelopeInd = {
        indicadorId: Number(row.indicador_id),
        nome: row.nome,
        valor: Number(row.valor),
        unidade: row.unidade,
        dataReferencia: row.data_referencia,
        agregacao: row.agregacao,
        municipiosAgregados: row.municipios_agregados === null ? null : Number(row.municipios_agregados),
        municipios: municipios.rows.map((m) => {
          municipioPorId.set(Number(m.id), { indicadorId: indId, codigoIbge: String(m.codigo_ibge) });
          return {
            codigoIbge: m.codigo_ibge,
            valor: Number(m.valor),
            posicao: Number(m.posicao),
            topN: Boolean(m.top_n),
            deltaMediaEstadual: m.delta_media_estadual === null ? null : Number(m.delta_media_estadual),
          };
        }),
        // codigoIbge INCLUÍDO (null = recorte principal): faz parte do dado
        // e do shape normalizado do hash — omiti-lo quebraria o selo.
        serie: serie.rows.map((s) => ({
          codigoIbge: s.codigo_ibge, ano: Number(s.ano), valor: Number(s.valor), categoria: s.categoria,
        })),
        causas: causas.rows.map((c) => ({
          codigoIbge: c.codigo_ibge, dimensao: c.dimensao, categoria: c.categoria,
          periodo: c.periodo, valor: Number(c.valor),
        })),
      };
      indicadores.push(envelopeInd);
      porIdIndicador.set(indId, envelopeInd);
    }

    const dashboards = await this.db.query<Record<string, unknown>>(
      `SELECT "PesquisaDashboard_Tipo" AS tipo, "PesquisaDashboard_Configuracao" AS configuracao,
              "PesquisaDashboard_Ordem" AS ordem, "PesquisaDashboard_Modo" AS modo
         FROM "PesquisaDashboard" WHERE "PesquisaDashboard_PesquisaId" = $1
        ORDER BY "PesquisaDashboard_Ordem"`,
      [id],
    );

    const sugestoes = await this.db.query<Record<string, unknown>>(
      `SELECT "PesquisaSugestao_Texto" AS texto, "PesquisaSugestao_PraticaCitada" AS pratica_citada,
              "PesquisaSugestao_Agente" AS agente,
              "PesquisaSugestao_PesquisaIndicadorId" AS origem_indicador_id,
              "PesquisaSugestao_PesquisaIndicadorMunicipioId" AS origem_municipio_id
         FROM "PesquisaSugestao" WHERE "PesquisaSugestao_PesquisaId" = $1
        ORDER BY "PesquisaSugestao_Id"`,
      [id],
    );

    const fontes = await this.db.query<Record<string, unknown>>(
      `SELECT "PesquisaFonte_FonteId" AS fonte_id, "PesquisaFonte_CargaId" AS carga_id,
              "PesquisaFonte_HashSha256" AS hash_sha256, "PesquisaFonte_Url" AS url,
              "PesquisaFonte_DataExtracao" AS data_extracao
         FROM "PesquisaFonte" WHERE "PesquisaFonte_PesquisaId" = $1
        ORDER BY "PesquisaFonte_Id"`,
      [id],
    );

    const execucoes = await this.db.query<Record<string, unknown>>(
      `SELECT "PesquisaExecucaoAgente_Agente" AS agente, "PesquisaExecucaoAgente_Entrada" AS entrada,
              "PesquisaExecucaoAgente_Saida" AS saida, "PesquisaExecucaoAgente_DuracaoMs" AS duracao_ms,
              "PesquisaExecucaoAgente_Ok" AS ok
         FROM "PesquisaExecucaoAgente" WHERE "PesquisaExecucaoAgente_PesquisaId" = $1
        ORDER BY "PesquisaExecucaoAgente_Id"`,
      [id],
    );

    const dashboardsEnvelope = dashboards.rows.map((d) => ({
      tipo: d.tipo, configuracao: d.configuracao, ordem: Number(d.ordem), modo: d.modo,
    }));
    const fontesEnvelope = fontes.rows.map((f) => ({
      fonteId: Number(f.fonte_id),
      cargaId: f.carga_id === null ? null : Number(f.carga_id),
      hashSha256: f.hash_sha256,
      url: f.url,
      dataExtracao: f.data_extracao instanceof Date ? f.data_extracao.toISOString() : f.data_extracao,
    }));
    const sugestoesEnvelope = sugestoes.rows.map((s) => {
        const viaMunicipio = s.origem_municipio_id === null ? null : municipioPorId.get(Number(s.origem_municipio_id)) ?? null;
        const origemIndicadorId = viaMunicipio
          ? viaMunicipio.indicadorId
          : s.origem_indicador_id === null ? null : Number(s.origem_indicador_id);
        return {
          texto: s.texto,
          praticaCitada: s.pratica_citada,
          agente: s.agente,
          origem: {
            indicadorId: origemIndicadorId === null ? null
              : (porIdIndicador.get(origemIndicadorId) as { indicadorId?: number } | undefined)?.indicadorId ?? null,
            codigoIbge: viaMunicipio?.codigoIbge ?? null,
          },
        };
      });

    // HASH VERIFICÁVEL (P4): recomputa o sha256 pela MESMA forma canônica
    // usada na gravação, agora a partir do que o banco devolveu. Se algo
    // divergir (corrupção, escrita fora do serviço), hash_confere: false.
    const hashRecomputado = hashCanonico(normalizarParaHash({
      modo: String(cab.modo),
      pergunta: String(cab.pergunta),
      area: cab.area,
      recorte: String(cab.recorte),
      codigo: cab.codigo,
      estado: String(cab.estado),
      versaoMotor: cab.versao_motor,
      indicadores: indicadores as unknown as Parameters<typeof normalizarParaHash>[0]['indicadores'],
      dashboards: dashboardsEnvelope as unknown as Parameters<typeof normalizarParaHash>[0]['dashboards'],
      sugestoes: sugestoesEnvelope as unknown as SugestaoNormalizada[],
      fontes: fontesEnvelope as unknown as FonteNormalizada[],
    }));

    return {
      id: cab.id,
      modo: cab.modo,
      pergunta: cab.pergunta,
      area: cab.area,
      recorte: cab.recorte,
      codigo: cab.codigo,
      usuarioId: cab.usuario_id,
      dataHora: cab.data_hora instanceof Date ? cab.data_hora.toISOString() : cab.data_hora,
      estado: cab.estado,
      versaoMotor: cab.versao_motor,
      hash: cab.hash,
      hash_confere: hashRecomputado === String(cab.hash),
      indicadores,
      dashboards: dashboardsEnvelope,
      sugestoes: sugestoesEnvelope,
      fontes: fontesEnvelope,
      execucoes: execucoes.rows.map((e) => ({
        agente: e.agente, entrada: e.entrada, saida: e.saida,
        duracaoMs: e.duracao_ms === null ? null : Number(e.duracao_ms), ok: e.ok,
      })),
    };
  }

  /** Lista resumida recente (mais novas primeiro), no contexto ativo. */
  async listar(limite = 20) {
    const n = Math.min(Math.max(Math.trunc(limite) || 20, 1), 100);
    const r = await this.db.query<Record<string, unknown>>(
      `SELECT p."Pesquisa_Id" AS id, p."Pesquisa_Modo" AS modo, p."Pesquisa_Pergunta" AS pergunta,
              p."Pesquisa_Area" AS area, p."Pesquisa_Recorte" AS recorte, p."Pesquisa_Codigo" AS codigo,
              p."Pesquisa_DataHora" AS data_hora, p."Pesquisa_Estado" AS estado,
              (SELECT count(*)::int FROM "PesquisaIndicador" i
                WHERE i."PesquisaIndicador_PesquisaId" = p."Pesquisa_Id") AS indicadores
         FROM "Pesquisa" p
        ORDER BY p."Pesquisa_DataHora" DESC
        LIMIT $1`,
      [n],
    );
    return {
      pesquisas: r.rows.map((p) => ({
        id: p.id, modo: p.modo, pergunta: p.pergunta, area: p.area, recorte: p.recorte,
        codigo: p.codigo, estado: p.estado, indicadores: Number(p.indicadores),
        dataHora: p.data_hora instanceof Date ? p.data_hora.toISOString() : p.data_hora,
      })),
    };
  }

  /** Validação manual (sem class-validator), no padrão da casa. */
  private validar(dto: GravarPesquisaDto): void {
    if (!dto || typeof dto !== 'object') throw new BadRequestException('Snapshot de pesquisa ausente.');
    if (!MODOS.includes(dto.modo)) throw new BadRequestException(`modo deve ser um de: ${MODOS.join(', ')}.`);
    if (typeof dto.pergunta !== 'string' || dto.pergunta.length < 1 || dto.pergunta.length > 1000)
      throw new BadRequestException('pergunta deve ser string de 1 a 1000 caracteres.');
    if (!RECORTES.includes(dto.recorte)) throw new BadRequestException(`recorte deve ser um de: ${RECORTES.join(', ')}.`);
    if (!ESTADOS.includes(dto.estado)) throw new BadRequestException(`estado deve ser um de: ${ESTADOS.join(', ')}.`);
    if (dto.recorte !== 'ESTADO' && (typeof dto.codigo !== 'string' || !dto.codigo))
      throw new BadRequestException('codigo é obrigatório para recortes que não sejam ESTADO.');
    if (dto.usuarioId != null && !UUID.test(dto.usuarioId))
      throw new BadRequestException('usuarioId, quando presente, deve ser uuid.');

    for (const [i, ind] of (dto.indicadores ?? []).entries()) {
      if (!Number.isInteger(ind.indicadorId)) throw new BadRequestException(`indicadores[${i}].indicadorId inválido.`);
      if (typeof ind.nome !== 'string' || !ind.nome) throw new BadRequestException(`indicadores[${i}].nome inválido.`);
      if (typeof ind.valor !== 'number' || !Number.isFinite(ind.valor))
        throw new BadRequestException(`indicadores[${i}].valor inválido.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ind.dataReferencia))
        throw new BadRequestException(`indicadores[${i}].dataReferencia deve ser AAAA-MM-DD.`);
      for (const [j, s] of (ind.serie ?? []).entries()) {
        if (s.categoria && !CATEGORIAS_SERIE.includes(s.categoria))
          throw new BadRequestException(`indicadores[${i}].serie[${j}].categoria inválida.`);
      }
      for (const [j, c] of (ind.causas ?? []).entries()) {
        // Forma aqui; o VOCABULÁRIO é conferido em validarDimensoes() contra
        // o catálogo db/54 (Evolução E1) — não há mais lista fixa no código.
        if (typeof c.dimensao !== 'string' || !c.dimensao)
          throw new BadRequestException(`indicadores[${i}].causas[${j}].dimensao inválida.`);
      }
    }

    for (const [i, d] of (dto.dashboards ?? []).entries()) {
      if (!TIPOS_DASHBOARD.includes(d.tipo))
        throw new BadRequestException(`dashboards[${i}].tipo deve ser um de: ${TIPOS_DASHBOARD.join(', ')}.`);
      if (!MODOS.includes(d.modo)) throw new BadRequestException(`dashboards[${i}].modo inválido.`);
      if (!Number.isInteger(d.ordem)) throw new BadRequestException(`dashboards[${i}].ordem inválida.`);
    }

    const totalIndicadores = dto.indicadores?.length ?? 0;
    for (const [i, s] of (dto.sugestoes ?? []).entries()) {
      if (typeof s.texto !== 'string' || !s.texto) throw new BadRequestException(`sugestoes[${i}].texto inválido.`);
      if (typeof s.praticaCitada !== 'string' || !s.praticaCitada)
        throw new BadRequestException(`sugestoes[${i}].praticaCitada é obrigatória (dossiê cita prática reconhecida).`);
      if (typeof s.agente !== 'string' || !s.agente) throw new BadRequestException(`sugestoes[${i}].agente inválido.`);
      if (!Number.isInteger(s.indicadorIndice) || s.indicadorIndice < 0 || s.indicadorIndice >= totalIndicadores)
        throw new BadRequestException(
          `sugestoes[${i}].indicadorIndice deve apontar um indicador do snapshot (sugestão sem dado-origem é vetada).`,
        );
    }

    for (const [i, f] of (dto.fontes ?? []).entries()) {
      if (!Number.isInteger(f.fonteId) && !(typeof f.nome === 'string' && f.nome))
        throw new BadRequestException(`fontes[${i}] precisa de fonteId inteiro OU nome para resolução.`);
      if (f.hashSha256 != null && !/^[0-9a-f]{64}$/i.test(f.hashSha256))
        throw new BadRequestException(`fontes[${i}].hashSha256 deve ter 64 hex.`);
    }

    for (const [i, e] of (dto.execucoes ?? []).entries()) {
      if (typeof e.agente !== 'string' || !e.agente) throw new BadRequestException(`execucoes[${i}].agente inválido.`);
      if (typeof e.ok !== 'boolean') throw new BadRequestException(`execucoes[${i}].ok deve ser boolean.`);
    }
  }

  private cacheDimensoes: { quando: number; codigos: Set<string> } | null = null;
  private static readonly DIMENSOES_TTL_MS = 60_000;

  /**
   * Evolução E1 (db/54): o vocabulário de dimensões de causa vem do catálogo
   * "DimensaoObservacao" (consulta cacheada 60s, padrão dos catálogos da
   * casa), não de lista fixa — 400 honesto ANTES da transação, com a FK do
   * banco como última linha de defesa contra corrida de cache/curadoria.
   */
  private async validarDimensoes(dto: GravarPesquisaDto): Promise<void> {
    const comCausas = (dto.indicadores ?? []).some((i) => (i.causas ?? []).length > 0);
    if (!comCausas) return;
    if (!this.cacheDimensoes || Date.now() - this.cacheDimensoes.quando >= PesquisasService.DIMENSOES_TTL_MS) {
      const r = await this.db.query<{ codigo: string }>(
        `SELECT "DimensaoObservacao_Codigo" AS codigo FROM "DimensaoObservacao"`,
      );
      this.cacheDimensoes = { quando: Date.now(), codigos: new Set(r.rows.map((x) => x.codigo)) };
    }
    for (const [i, ind] of (dto.indicadores ?? []).entries()) {
      for (const [j, c] of (ind.causas ?? []).entries()) {
        if (!this.cacheDimensoes.codigos.has(c.dimensao))
          throw new BadRequestException(
            `indicadores[${i}].causas[${j}].dimensao "${c.dimensao}" não existe no catálogo "DimensaoObservacao".`,
          );
      }
    }
  }
}
