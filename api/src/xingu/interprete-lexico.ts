import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PlanoConsulta, Clarificacao } from './tipos';

export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export interface ItemCatalogo {
  id: number;
  nome: string;
  unidade: string;
  sinonimos: string[];
}

/** Sinônimos de domínio — em produção, tabela versionada como a taxonomia (RN-004). */
const SINONIMOS: Record<string, string[]> = {
  'Leitos de UTI': ['leitos de uti', 'leitos', 'uti', 'vagas de uti', 'terapia intensiva'],
  'População estimada': ['populacao', 'habitantes', 'moradores', 'gente', 'pessoas moram', 'populacional'],
  'Matrículas na rede pública': ['matriculas', 'alunos', 'estudantes', 'rede publica de ensino'],
  'PIB municipal': ['pib', 'produto interno bruto', 'economia gera', 'riqueza produzida'],
  'PIB per capita': ['pib per capita', 'renda per capita'],
  'Cobertura vacinal — poliomielite': ['cobertura vacinal', 'vacinacao', 'vacina', 'poliomielite', 'imunizacao'],
  'Área plantada': ['area plantada', 'plantio', 'lavoura', 'hectares plantados'],
};

@Injectable()
export class CatalogoService {
  private cache: {
    quando: number;
    municipios: { codigo: string; nome: string; nomeN: string }[];
    rgints: { codigo: string; nome: string; nomeN: string }[];
    rgis: { codigo: string; nome: string; nomeN: string }[];
    consorcios: { codigo: string; nome: string; nomeN: string }[];
    indicadores: ItemCatalogo[];
  } | null = null;

  constructor(private readonly db: DatabaseService) {}

  async obter() {
    if (this.cache && Date.now() - this.cache.quando < 60_000) return this.cache;
    const [mun, rgint, rgi, cons, inds] = await Promise.all([
      this.db.query<{ codigo: string; nome: string }>(
        `SELECT "Municipio_CodigoIbge" AS codigo, "Municipio_Nome" AS nome FROM "Municipio"`,
      ),
      this.db.query<{ codigo: string; nome: string }>(
        `SELECT "RegiaoIntermediaria_Codigo" AS codigo, "RegiaoIntermediaria_Nome" AS nome FROM "RegiaoIntermediaria"`,
      ),
      this.db.query<{ codigo: string; nome: string }>(
        `SELECT "RegiaoImediata_Codigo" AS codigo, "RegiaoImediata_Nome" AS nome FROM "RegiaoImediata"`,
      ),
      this.db.query<{ codigo: string; nome: string }>(
        `SELECT "Consorcio_Id"::text AS codigo, "Consorcio_Nome" AS nome FROM "Consorcio"`,
      ),
      this.db.query<{ id: number; nome: string; unidade: string }>(
        `SELECT "Indicador_Id" AS id, "Indicador_Nome" AS nome, "Indicador_Unidade" AS unidade
           FROM "Indicador" WHERE "Indicador_StatusValidacao" = 'APROVADO'`, // RG-09 vale na borda também
      ),
    ]);
    const marcar = (r: { codigo: string; nome: string }) => ({ ...r, nomeN: normalizar(r.nome) });
    this.cache = {
      quando: Date.now(),
      municipios: mun.rows.map(marcar).sort((a, b) => b.nomeN.length - a.nomeN.length),
      rgints: rgint.rows.map(marcar),
      rgis: rgi.rows.map(marcar),
      consorcios: cons.rows.map(marcar),
      indicadores: inds.rows.map((i) => ({
        ...i,
        sinonimos: [normalizar(i.nome), ...(SINONIMOS[i.nome] ?? []).map(normalizar)]
          .sort((a, b) => b.length - a.length),
      })),
    };
    return this.cache;
  }
}

export type SaidaInterprete =
  | { tipo: 'PLANO'; plano: PlanoConsulta }
  | { tipo: 'CLARIFICACAO'; clarificacao: Clarificacao };

/**
 * A01 (variante determinística) — Intérprete léxico.
 * É o fallback do RG-05: sem LLM disponível, a conversa continua
 * funcionando para as formulações do domínio. Também é o plano B
 * quando o LLM devolve JSON inválido.
 */
@Injectable()
export class InterpreteLexico {
  constructor(private readonly catalogo: CatalogoService) {}

  async interpretar(
    pergunta: string,
    contexto?: { indicador_id?: number; codigo_ibge?: string },
  ): Promise<SaidaInterprete> {
    const cat = await this.catalogo.obter();
    // pontuação vira espaço: "de Cuiabá." casa com " cuiaba "
    const q = ' ' + normalizar(pergunta).replace(/[.,!?;:()\-]/g, ' ').replace(/\s+/g, ' ') + ' ';

    // ---- período: ano explícito ou hoje ----
    const anoM = q.match(/\b(19|20)\d{2}\b/);
    const referencia = anoM ? `${anoM[0]}-12-31` : new Date().toISOString().slice(0, 10);

    // ---- recorte + código (A02 embutido na variante léxica) ----
    let recorte: PlanoConsulta['recorte'] | null = null;
    let codigo: string | null = null;
    let rotuloLocal = '';

    const rgintM = cat.rgints.find((r) => q.includes(`regiao intermediaria de ${r.nomeN}`));
    const rgiM = cat.rgis.find(
      (r) => q.includes(`regiao imediata de ${r.nomeN}`) || q.includes(`regiao de ${r.nomeN}`),
    );
    const consM = q.includes('consorcio')
      ? cat.consorcios.find((c) => c.nomeN.split(' ').some((p) => p.length > 4 && q.includes(p))) ??
        (cat.consorcios.length === 1 ? cat.consorcios[0] : undefined)
      : undefined;
    const munM = cat.municipios.find((m) => q.includes(` ${m.nomeN.replace(/-/g, ' ')} `));

    if (rgintM) { recorte = 'RGINT'; codigo = rgintM.codigo; rotuloLocal = rgintM.nome; }
    else if (rgiM) { recorte = 'RGI'; codigo = rgiM.codigo; rotuloLocal = rgiM.nome; }
    else if (consM) { recorte = 'CONSORCIO'; codigo = consM.codigo; rotuloLocal = consM.nome; }
    else if (munM) { recorte = 'MUNICIPIO'; codigo = munM.codigo; rotuloLocal = munM.nome; }
    else if (/\bmato grosso\b|\bno estado\b|\bestadual\b|\bem mt\b/.test(q)) {
      recorte = 'ESTADO'; codigo = null; rotuloLocal = 'Mato Grosso';
    } else if (contexto?.codigo_ibge) {
      // RF-CHAT-010: contexto territorial da sessão ("e em Sinop?" já resolvido no turno anterior)
      recorte = 'MUNICIPIO'; codigo = contexto.codigo_ibge; rotuloLocal = '';
    }

    // ---- indicador: entre todos, vence o sinônimo mais longo que casar
    //      ("pib per capita" > "pib"; "populacao-alvo" > "populacao") ----
    let indicador: ItemCatalogo | undefined;
    let melhor = 0;
    for (const i of cat.indicadores) {
      for (const sin of i.sinonimos) {
        const sinLimpo = sin.replace(/[.,!?;:()\-]/g, ' ').replace(/\s+/g, ' ').trim();
        if (sinLimpo.length > melhor && q.includes(` ${sinLimpo} `)) {
          indicador = i; melhor = sinLimpo.length;
        }
      }
    }
    if (!indicador && contexto?.indicador_id) {
      indicador = cat.indicadores.find((i) => i.id === contexto.indicador_id);
    }

    // ---- A02: sem território resolvido, a consulta é BLOQUEADA (veto) —
    //      e o bloqueio vira pergunta de volta (RF-CHAT-005, máx. 2 opções) ----
    if (!recorte) {
      return {
        tipo: 'CLARIFICACAO',
        clarificacao: {
          pergunta: 'De qual local você quer o dado?',
          opcoes: [
            { rotulo: 'Todo o Estado de Mato Grosso', pergunta_sugerida: `${pergunta} em Mato Grosso` },
            { rotulo: 'Um município específico', pergunta_sugerida: `${pergunta} em Cuiabá` },
          ],
        },
      };
    }
    if (!indicador) {
      const [a, b] = cat.indicadores;
      return {
        tipo: 'CLARIFICACAO',
        clarificacao: {
          pergunta: `Sobre ${rotuloLocal || 'esse local'}, qual dado você procura?`,
          opcoes: [a, b].filter(Boolean).map((i) => ({
            rotulo: i.nome,
            pergunta_sugerida: `${i.nome} ${rotuloLocal ? `em ${rotuloLocal}` : ''}`.trim(),
          })),
        },
      };
    }

    return {
      tipo: 'PLANO',
      plano: {
        acao: 'CONSULTAR',
        recorte,
        codigo,
        indicador_id: indicador.id,
        periodo: { referencia },
      },
    };
  }
}
