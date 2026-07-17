import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { DatabaseService } from '../database/database.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

/**
 * F5 — AGENTES DE FONTE. Um agente por fonte de dados. Regra do produto:
 *   1. se a informação JÁ está no banco e ATUALIZADA → responde do banco,
 *      sem tocar a internet;
 *   2. se está ausente ou desatualizada → executa o conector oficial
 *      (Bronze→Prata→Ouro, com procedência e auditoria) e mostra o resultado;
 *   3. fontes que exigem arquivo oficial (CSV) não inventam download:
 *      o agente informa o passo manual — ausência é resposta (RN-005).
 * O agente NÃO decide conteúdo: ele decide QUANDO buscar. Quem valida e
 * publica indicador novo continua sendo o parecer humano (RG-09).
 */

export interface SituacaoFonte {
  atualizado: boolean;
  motivo: string;
  resumo: Record<string, unknown>;
}

interface DefAgente {
  slug: string;
  nome: string;
  fonte: string;
  tipo: 'API' | 'ARQUIVO';
  /** nome do indicador no catálogo que este agente alimenta (para a auto-busca) */
  indicador?: string;
  descricao: string;
  /** dias de validade de uma carga antes de ser considerada desatualizada */
  validadeDias: number;
  verificar(db: DatabaseService): Promise<SituacaoFonte>;
  /** tentativas de execução, em ordem (a primeira que der certo encerra) */
  comandos?(): string[][];
  /** instrução do passo manual, para tipo ARQUIVO */
  instrucao?: string;
}

const ANO = new Date().getFullYear();

async function cargaMaisRecente(db: DatabaseService, fonteLike: string) {
  const r = await db.query<{ ultima: string | null; cargas: number }>(
    `SELECT max(c."Carga_DataExtracao")::text AS ultima, count(c.*)::int AS cargas
       FROM "Fonte" f JOIN "Carga" c ON c."Carga_FonteId" = f."Fonte_Id"
      WHERE f."Fonte_Nome" ILIKE $1`, [fonteLike],
  );
  return r.rows[0] ?? { ultima: null, cargas: 0 };
}

function diasDesde(dataIso: string | null): number | null {
  return dataIso ? Math.floor((Date.now() - new Date(dataIso).getTime()) / 86400000) : null;
}

async function situacaoIndicador(db: DatabaseService, indicador: string, fonteLike: string, validadeDias: number): Promise<SituacaoFonte> {
  const r = await db.query<{ status: string; observacoes: number; referencia: string | null }>(
    `SELECT i."Indicador_StatusValidacao" AS status, count(o.*)::int AS observacoes,
            max(o."Observacao_DataReferencia")::text AS referencia
       FROM "Indicador" i LEFT JOIN "Observacao" o ON o."Observacao_IndicadorId" = i."Indicador_Id"
      WHERE i."Indicador_Nome" = $1 GROUP BY 1`, [indicador],
  );
  const carga = await cargaMaisRecente(db, fonteLike);
  const idade = diasDesde(carga.ultima);
  const linha = r.rows[0];
  const resumo = {
    indicador,
    status_validacao: linha?.status ?? null,
    observacoes: linha?.observacoes ?? 0,
    data_referencia_mais_recente: linha?.referencia?.slice(0, 10) ?? null,
    cargas_da_fonte: carga.cargas,
    ultima_carga: carga.ultima?.slice(0, 10) ?? null,
    idade_da_carga_dias: idade,
  };
  if (!linha || linha.observacoes === 0 || carga.cargas === 0)
    return { atualizado: false, motivo: 'Sem dados desta fonte no banco.', resumo };
  if (idade !== null && idade > validadeDias)
    return { atualizado: false, motivo: `Última carga há ${idade} dias (validade: ${validadeDias}).`, resumo };
  return { atualizado: true, motivo: `Carga de ${resumo.ultima_carga} dentro da validade (${validadeDias} dias).`, resumo };
}

const AGENTES: DefAgente[] = [
  {
    slug: 'territorio', nome: 'Malha territorial (142 municípios)',
    fonte: 'IBGE — API de Localidades', tipo: 'API', validadeDias: 366,
    descricao: 'Municípios de MT com RGI/RGInt oficiais — a base de todo recorte territorial (RN-001).',
    async verificar(db) {
      const n = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "Municipio"`)).rows[0].n;
      const carga = await cargaMaisRecente(db, '%API de Localidades%');
      const idade = diasDesde(carga.ultima);
      const resumo = { municipios_no_banco: n, esperado: 142, ultima_carga: carga.ultima?.slice(0, 10) ?? null, idade_da_carga_dias: idade };
      if (n < 142) return { atualizado: false, motivo: `Apenas ${n}/142 municípios no banco (malha demo).`, resumo };
      if (idade === null || idade > this.validadeDias)
        return { atualizado: false, motivo: 'Malha completa, mas sem carga oficial recente.', resumo };
      return { atualizado: true, motivo: `Malha oficial completa (carga de ${resumo.ultima_carga}).`, resumo };
    },
    comandos: () => [['scripts/ingestar-ibge-territorio.mjs']],
  },
  {
    slug: 'populacao', nome: 'População estimada', indicador: 'População estimada',
    fonte: 'IBGE — Estimativas de População (SIDRA 6579)', tipo: 'API', validadeDias: 366,
    descricao: 'População estimada por município — tema Demografia.',
    verificar(db) { return situacaoIndicador(db, 'População estimada', '%Estimativas de População%', this.validadeDias); },
    comandos: () => [
      ['scripts/ingestar-ibge-populacao.mjs', String(ANO - 1)],
      ['scripts/ingestar-ibge-populacao.mjs', String(ANO - 2)],
    ],
  },
  {
    slug: 'pib', nome: 'PIB municipal', indicador: 'PIB municipal',
    fonte: 'IBGE — PIB dos Municípios (SIDRA 5938)', tipo: 'API', validadeDias: 366,
    descricao: 'Produto Interno Bruto por município — tema Economia Privada (divulgação com ~2 anos de defasagem).',
    verificar(db) { return situacaoIndicador(db, 'PIB municipal', '%Produto Interno Bruto%', this.validadeDias); },
    comandos: () => [
      ['scripts/ingestar-ibge-agregado.mjs', 'pib', String(ANO - 2)],
      ['scripts/ingestar-ibge-agregado.mjs', 'pib', String(ANO - 3)],
    ],
  },
  {
    slug: 'cnes', nome: 'Leitos hospitalares (CNES)',
    fonte: 'CNES/DataSUS', tipo: 'ARQUIVO', validadeDias: 92,
    descricao: 'Leitos por município — tema Saúde.',
    verificar(db) { return situacaoIndicador(db, 'Leitos hospitalares', '%CNES%', this.validadeDias); },
    instrucao: 'Baixe o CSV oficial em opendatasus.saude.gov.br e rode: node scripts/ingestar-csv.mjs ingest-configs/cnes-leitos.json <arquivo.csv>',
  },
  {
    slug: 'inep', nome: 'Matrículas (Censo Escolar/INEP)',
    fonte: 'INEP — Censo Escolar', tipo: 'ARQUIVO', validadeDias: 366,
    descricao: 'Matrículas por município — tema Educação.',
    verificar(db) { return situacaoIndicador(db, 'Matrículas', '%INEP%', this.validadeDias); },
    instrucao: 'Baixe os microdados em gov.br/inep e rode: node scripts/ingestar-csv.mjs ingest-configs/inep-matriculas.json <arquivo.csv>',
  },
  {
    slug: 'sesp', nome: 'Ocorrências (SESP-MT)',
    fonte: 'SESP-MT', tipo: 'ARQUIVO', validadeDias: 92,
    descricao: 'Ocorrências por município — tema Segurança.',
    verificar(db) { return situacaoIndicador(db, 'Ocorrências', '%SESP%', this.validadeDias); },
    instrucao: 'Baixe o CSV no portal da SESP-MT e rode: node scripts/ingestar-csv.mjs ingest-configs/sesp-ocorrencias.json <arquivo.csv>',
  },
  {
    slug: 'pam', nome: 'Área plantada (PAM)',
    fonte: 'IBGE — Produção Agrícola Municipal', tipo: 'ARQUIVO', validadeDias: 366,
    descricao: 'Área plantada por município — tema Agronegócio.',
    verificar(db) { return situacaoIndicador(db, 'Área plantada', '%Agrícola Municipal%', this.validadeDias); },
    instrucao: 'Baixe o CSV da PAM no SIDRA e rode: node scripts/ingestar-csv.mjs ingest-configs/pam-area-plantada.json <arquivo.csv>',
  },
];

@Injectable()
export class AgentesFonteService {
  private readonly log = new Logger('AgentesFonte');
  private readonly emExecucao = new Set<string>();
  /** memo: última verificação por agente, para a auto-busca ficar barata */
  private readonly verificadoEm = new Map<string, number>();
  private static readonly MEMO_MS = 60_000;

  constructor(private readonly db: DatabaseService, private readonly trilha: AuditoriaService) {}

  async listar() {
    return Promise.all(
      AGENTES.map(async (a) => ({
        slug: a.slug, nome: a.nome, fonte: a.fonte, tipo: a.tipo,
        descricao: a.descricao, validade_dias: a.validadeDias,
        situacao: await a.verificar(this.db),
        instrucao: a.tipo === 'ARQUIVO' ? a.instrucao : undefined,
        em_execucao: this.emExecucao.has(a.slug),
      })),
    );
  }

  /**
   * O coração do agente: banco primeiro; internet só se faltar ou vencer.
   */
  async pesquisar(slug: string) {
    const agente = AGENTES.find((a) => a.slug === slug);
    if (!agente) throw new NotFoundException(`Agente de fonte "${slug}" não existe.`);
    if (this.emExecucao.has(slug)) throw new ConflictException('Este agente já está pesquisando — aguarde.');

    const antes = await agente.verificar(this.db);
    if (antes.atualizado) {
      // Regra 1: já temos, dentro da validade → responde do banco, sem rede.
      return { agente: agente.slug, origem: 'BANCO' as const, situacao: antes, saida: null };
    }
    if (agente.tipo === 'ARQUIVO') {
      // Regra 3: fonte exige arquivo oficial — o agente não inventa download.
      return { agente: agente.slug, origem: 'REQUER_ARQUIVO' as const, situacao: antes, instrucao: agente.instrucao, saida: null };
    }

    // Regra 2: buscar na fonte oficial via conector (Bronze→Prata→Ouro).
    this.emExecucao.add(slug);
    const t0 = Date.now();
    try {
      let saida = '';
      let sucesso = false;
      for (const comando of agente.comandos!()) {
        this.log.log(`agente ${slug}: executando ${comando.join(' ')}`);
        const r = await this.executar(comando);
        saida += `$ node ${comando.join(' ')}\n${r.saida}\n`;
        if (r.codigo === 0) { sucesso = true; break; }
        saida += `↻ tentativa falhou (código ${r.codigo}) — tentando período anterior…\n\n`;
      }
      const depois = await agente.verificar(this.db);
      await this.trilha.registrar('agente-fonte', 'AGENTE_FONTE_PESQUISA', 'Fonte', slug, {
        sucesso, motivo_da_busca: antes.motivo, situacao_final: depois.resumo, duracao_ms: Date.now() - t0,
      });
      return {
        agente: agente.slug,
        origem: 'INTERNET' as const,
        sucesso,
        motivo_da_busca: antes.motivo,
        situacao: depois,
        saida: saida.trim(),
        duracao_ms: Date.now() - t0,
      };
    } finally {
      this.emExecucao.delete(slug);
    }
  }

  /**
   * AUTO-BUSCA: chamada por TODA consulta do usuário que der ausência.
   * Banco primeiro (a consulta já falhou no banco) → se o agente da fonte
   * estiver vencido/vazio, busca na fonte oficial e retorna true para a
   * consulta tentar de novo. Rápido por construção: memo de 60s por
   * agente, e só um fetch por vez (mutex). AGENTES_AUTO=0 desliga.
   */
  async garantirParaIndicador(indicadorNome: string): Promise<boolean> {
    if (process.env.AGENTES_AUTO === '0') return false;
    const agente = AGENTES.find((a) => a.tipo === 'API' && a.indicador === indicadorNome);
    if (!agente) return false;
    const ultima = this.verificadoEm.get(agente.slug);
    if (ultima && Date.now() - ultima < AgentesFonteService.MEMO_MS) return false;
    if (this.emExecucao.has(agente.slug)) return false;
    try {
      const r = await this.pesquisar(agente.slug);
      this.verificadoEm.set(agente.slug, Date.now());
      return r.origem === 'INTERNET' && r.sucesso === true;
    } catch (e) {
      this.log.warn(`auto-busca ${agente.slug} falhou: ${(e as Error).message}`);
      this.verificadoEm.set(agente.slug, Date.now());
      return false;
    }
  }

  /** Executa o conector oficial como processo filho, capturando o log. */
  private executar(args: string[]): Promise<{ codigo: number; saida: string }> {
    return new Promise((resolve) => {
      const p = spawn('node', args, { cwd: process.cwd(), env: process.env, timeout: 180_000 });
      let saida = '';
      p.stdout.on('data', (d) => (saida += d));
      p.stderr.on('data', (d) => (saida += d));
      p.on('close', (codigo) => resolve({ codigo: codigo ?? 1, saida }));
      p.on('error', (e) => resolve({ codigo: 1, saida: `${saida}\n${e.message}` }));
    });
  }
}
