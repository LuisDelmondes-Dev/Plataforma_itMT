import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Causas, DimensaoObservacaoCatalogo, Ranking } from '../indicadores/indicadores.service';
import { extrairNumerais } from './narrador';

/**
 * A16 — AGENTE DE SUGESTÕES (Gauntlet P7).
 *
 * Doutrina da casa (docs/spec/README.md): DOSSIÊ, NÃO DECISÃO. Cada sugestão
 * SUBSIDIA o gestor — "o dado X indica…; prática reconhecida: Y (ref.: Z)" —
 * e nunca ordena, decide ou auto-publica (RG-09). Três amarras estruturais:
 *
 * 1. ENTRADA = SOMENTE o JSON do motor determinístico (ranking, série,
 *    causas) + o catálogo curado "PraticaGestao" (db/51). Nenhum LLM nesta
 *    versão: a conta está sem créditos e o RG-05 manda o caminho
 *    determinístico ser o PRIMÁRIO — os textos são templates com slots
 *    preenchidos só com valores do dossiê. Re-redação por LLM é
 *    enriquecimento FUTURO e, quando existir, passa pelo A06 (auditor de
 *    numerais) como qualquer borda de linguagem.
 *
 * 2. ORIGEM POR FK: toda sugestão declara o dado do motor que a motivou
 *    (`origem`), e a persistência (PesquisaSugestao, db/48) exige a FK por
 *    CHECK — sugestão órfã é impossível até por SQL direto.
 *
 * 3. RG-03 fail-closed POR SUGESTÃO: depois de montado, o texto passa por
 *    auditoria de numerais (mesma extração pt-BR do A06 em narrador.ts). O
 *    conjunto autorizado = numerais dos SLOTS preenchidos a partir do dossiê
 *    + numerais dos METADADOS determinísticos (nome/descrição/fonte da
 *    prática — ex.: "Portaria 72/2010" —, nome do indicador, unidade, local),
 *    exatamente como numerosAutorizados() faz com unidade/local. Numeral que
 *    não venha de slot nem de metadado ⇒ a sugestão é DESCARTADA e logada,
 *    nunca corrigida.
 *
 * GATILHOS DETERMINÍSTICOS (nenhuma inferência estatística nova):
 *  (a) DELTA vs MÉDIA — recorte MUNICIPIO com delta_media_estadual ≠ 0.
 *      Com polaridade no catálogo: só o desvio DESFAVORÁVEL vira sugestão
 *      (acima da média quando menor é melhor; abaixo quando maior é melhor);
 *      desvio favorável não gera subsídio de correção. Sem polaridade o A16
 *      NÃO julga: gatilho factual (acima/abaixo), texto neutro, e as práticas
 *      vêm apenas da área reservada 'GERAL' (leitura comparada) — nunca uma
 *      prática finalística de área aplicada a desvio não julgado.
 *  (b) TENDÊNCIA — três últimos pontos da série estritamente crescentes
 *      (TENDENCIA_ALTA) ou decrescentes (TENDENCIA_QUEDA); comparação
 *      simples, sem regressão. Mesma regra de polaridade do gatilho (a).
 *  (c) CAUSA DOMINANTE — quando dossie.causas existe: TODAS as dimensões
 *      disponíveis (CAPITULO_CID10, CAUSA_EVITAVEL, COMPONENTE) são
 *      avaliadas e cada uma emite NO MÁXIMO UMA sugestão para a sua
 *      categoria dominante (o motor já ordena categorias por valor DESC).
 *      Rodada 2 do gauntlet (crítico de gestão pública): ler só o capítulo
 *      CID-10 escondia o eixo COMPONENTE — o dossiê recomendava sala de
 *      parto enquanto ele próprio mostrava a maioria dos óbitos no período
 *      PÓS-neonatal, que aponta para a atenção primária pós-alta. As
 *      dimensões entram na ordem de participação DESC da categoria
 *      dominante (o eixo mais concentrado primeiro); empate resolve pela
 *      ordem canônica do catálogo "DimensaoObservacao"."_Ordem" (db/54 —
 *      Evolução E1: rótulos e ordem vêm do banco, não de constantes; ver
 *      DIMENSOES_FALLBACK). Para COMPONENTE, a prática vem do
 *      mapeamento explícito PRATICA_POR_COMPONENTE (sem heurística).
 *  (d) COBERTURA INCOMPLETA — ranking.ausentes.total > 0.
 *
 * CRITÉRIO DE RELEVÂNCIA (ordem determinística das sugestões, documentada):
 *   1º CAUSA_DOMINANTE       (nomeia O QUE atacar — o subsídio mais acionável;
 *                             uma sugestão por eixo, eixo mais concentrado 1º)
 *   2º delta julgado          (desvio desfavorável frente à média estadual)
 *   3º tendência julgada      (movimento desfavorável na série)
 *   4º delta factual          (sem polaridade — constatação, não juízo)
 *   5º tendência factual      (idem)
 *   6º COBERTURA_INCOMPLETA   (qualidade do dado — importa, mas é meta-subsídio)
 * Dentro dos demais gatilhos: práticas da área do indicador primeiro, depois
 * 'GERAL', na ordem do catálogo (_Id) — máx. 2 práticas por gatilho e máx.
 * 5 sugestões por pesquisa. Uma mesma prática nunca é citada duas vezes
 * dentro do bloco de causa dominante.
 *
 * CONCORDÂNCIA (rodada 2): os templates usam formas INVARIANTES — nunca
 * dependem do gênero/número do nome do indicador ("o indicador X está em…")
 * nem da quantidade ("N de M municípios sem dado", sem verbo a flexionar).
 */

export type Polaridade = 'MAIOR_MELHOR' | 'MENOR_MELHOR';

export type GatilhoSugestao =
  | 'ACIMA_DA_MEDIA' | 'ABAIXO_DA_MEDIA'
  | 'TENDENCIA_ALTA' | 'TENDENCIA_QUEDA'
  | 'CAUSA_DOMINANTE' | 'COBERTURA_INCOMPLETA';

export interface PraticaCatalogo {
  id: number;
  area: string;
  gatilho: GatilhoSugestao;
  nome: string;
  descricao: string;
  fonte: string;
}

export interface Sugestao {
  texto: string;
  pratica_citada: string;
  fonte_referencia: string;
  gatilho: GatilhoSugestao;
  origem: {
    tipo: 'RANKING_MUNICIPIO' | 'INDICADOR' | 'CAUSA' | 'SERIE';
    codigo_ibge?: string;
    indicadorId: number;
  };
}

export interface EntradaSugestoes {
  dossie: {
    ranking: Ranking;
    serie: { pontos: { ano: number; valor: number }[] };
    causas: Causas | null;
  };
  indicador: {
    id: number;
    nome: string;
    unidade: string;
    tema: string | null;
    polaridade: Polaridade | null;
  };
  recorte: string;
  codigo: string | null;
  local: string;
}

export interface DescarteSugestao {
  gatilho: GatilhoSugestao;
  pratica: string;
  intrusos: number[];
}

export interface SaidaSugestoes {
  sugestoes: Sugestao[];
  /** Sugestões vetadas pela auditoria de numerais (fail-closed por sugestão). */
  descartadas: number;
}

const MAX_SUGESTOES = 5;
const MAX_POR_GATILHO = 2;
/** Área reservada multiárea do catálogo (db/51). */
const AREA_GERAL = 'GERAL';

const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/**
 * Evolução E1 (db/54): rótulo e ordem canônica dos eixos vêm do catálogo
 * "DimensaoObservacao" ("_Nome", "_Ordem") — o SugestoesService os lê
 * cacheados e os injeta em gerarSugestoes(). Este fallback embutido existe
 * SÓ para preservar a assinatura pura gerarSugestoes(entrada, praticas) dos
 * testes existentes (ratchet de determinismo dos textos): é uma CÓPIA do
 * seed de db/54, não a fonte de verdade — dimensão nova NÃO entra aqui,
 * entra no banco.
 */
const DIMENSOES_FALLBACK: readonly DimensaoObservacaoCatalogo[] = [
  { codigo: 'CAPITULO_CID10', nome: 'capítulo CID-10', ordem: 1 },
  { codigo: 'CAUSA_EVITAVEL', nome: 'causas evitáveis', ordem: 2 },
  { codigo: 'COMPONENTE', nome: 'componente etário', ordem: 3 },
];

/**
 * Mapeamento EXPLÍCITO componente etário dominante → prática do catálogo
 * (área do indicador, gatilho CAUSA_DOMINANTE). Sem heurística mágica: o
 * PREFIXO da categoria publicada pelo motor (db/50: "Pós-neonatal (28 a 364
 * dias)", "Neonatal precoce (0 a 6 dias)", "Neonatal tardio (7 a 27 dias)")
 * seleciona a palavra que o NOME da prática precisa conter (db/52:
 * "…puericultura…" / "…(componente neonatal)"). Curadoria que renomear
 * essas práticas precisa ajustar este mapa — e vice-versa.
 */
const PRATICA_POR_COMPONENTE: readonly { prefixoCategoria: string; nomeContem: string }[] = [
  // Pós-neonatal (28–364 dias): óbito após a alta ⇒ puericultura/APS.
  { prefixoCategoria: 'Pós-neonatal', nomeContem: 'puericultura' },
  // Neonatal precoce/tardio (0–27 dias): parto e recém-nascido na rede vigente.
  { prefixoCategoria: 'Neonatal', nomeContem: 'neonatal' },
];

function sentidoDe(p: Polaridade): string {
  return p === 'MENOR_MELHOR' ? 'menor é melhor' : 'maior é melhor';
}

/** Candidata montada por um gatilho, antes da auditoria de numerais. */
interface Candidata {
  sugestao: Sugestao;
  /** Strings de onde numerais são LEGÍTIMOS: slots do dossiê + metadados. */
  autorizadores: string[];
}

function selecionarPraticas(
  praticas: PraticaCatalogo[],
  area: string | null,
  gatilho: GatilhoSugestao,
  apenasGeral: boolean,
): PraticaCatalogo[] {
  const doGatilho = praticas.filter((p) => p.gatilho === gatilho);
  const gerais = doGatilho.filter((p) => p.area === AREA_GERAL);
  if (apenasGeral) return gerais.slice(0, MAX_POR_GATILHO);
  const daArea = area ? doGatilho.filter((p) => p.area === area) : [];
  return [...daArea, ...gerais].slice(0, MAX_POR_GATILHO);
}

function fechoPratica(p: PraticaCatalogo): string {
  return `Prática reconhecida: ${p.nome} — ${p.descricao} (ref.: ${p.fonte}).`;
}

/**
 * Prática do catálogo para UM eixo dominante (gatilho CAUSA_DOMINANTE).
 * COMPONENTE usa o mapeamento explícito PRATICA_POR_COMPONENTE; sem prática
 * mapeada, o eixo NÃO vira sugestão (nada de aproximação). Os demais eixos
 * usam a seleção padrão do catálogo: CAUSA_EVITAVEL prefere a prática que
 * nomeia a evitabilidade; na falta, área do indicador primeiro, depois
 * GERAL, na ordem do catálogo (_Id). `usadas` impede a mesma prática de ser
 * citada duas vezes no bloco de causa — tudo determinístico.
 */
function praticaParaDimensao(
  praticas: PraticaCatalogo[],
  area: string | null,
  dimensao: string,
  categoriaDominante: string,
  usadas: Set<number>,
): PraticaCatalogo | null {
  const doGatilho = praticas.filter((p) => p.gatilho === 'CAUSA_DOMINANTE' && !usadas.has(p.id));
  if (dimensao === 'COMPONENTE') {
    const regra = PRATICA_POR_COMPONENTE.find((r) => categoriaDominante.startsWith(r.prefixoCategoria));
    if (!regra) return null;
    return doGatilho.find(
      (p) => p.area === area && p.nome.toLowerCase().includes(regra.nomeContem),
    ) ?? null;
  }
  const daArea = area ? doGatilho.filter((p) => p.area === area) : [];
  if (dimensao === 'CAUSA_EVITAVEL') {
    const especifica = daArea.find((p) => p.nome.toLowerCase().includes('evitáve'));
    if (especifica) return especifica;
  }
  const gerais = doGatilho.filter((p) => p.area === AREA_GERAL);
  return [...daArea, ...gerais][0] ?? null;
}

/**
 * FUNÇÃO PURA sobre o JSON do motor + catálogo: mesma entrada ⇒ mesma saída,
 * byte a byte (o determinismo é coberto por teste). Exportada para que os
 * testes a exercitem sem Nest.
 */
export function gerarSugestoes(
  entrada: EntradaSugestoes,
  praticas: PraticaCatalogo[],
  dimensoesCatalogo: readonly DimensaoObservacaoCatalogo[] = DIMENSOES_FALLBACK,
): { sugestoes: Sugestao[]; descartes: DescarteSugestao[] } {
  const { dossie, indicador, recorte, codigo, local } = entrada;
  const candidatas: Candidata[] = [];
  const meta = [indicador.nome, indicador.unidade, local];
  // Rótulo e ordem por código, vindos do catálogo db/54 (Evolução E1).
  // Código fora do catálogo (janela de cache, dimensão inativada): rótulo
  // cai no próprio código (nunca inventa) e a ordem vai para o fim.
  const rotuloDimensao = new Map(dimensoesCatalogo.map((d) => [d.codigo, d.nome]));
  const ordemDimensao = new Map(dimensoesCatalogo.map((d) => [d.codigo, d.ordem]));
  const ordemDe = (codigoDim: string) => ordemDimensao.get(codigoDim) ?? Number.MAX_SAFE_INTEGER;

  // ---- (a) delta vs média estadual (recorte MUNICIPIO) ----
  type Delta = { direcao: 'acima' | 'abaixo'; julgado: boolean; textoBase: string; autorizadores: string[]; gatilho: GatilhoSugestao } | null;
  let delta: Delta = null;
  if (recorte === 'MUNICIPIO' && codigo && dossie.ranking.media_estadual !== null) {
    const linha = dossie.ranking.municipios.find((m) => m.codigo_ibge === codigo);
    if (linha && linha.delta_media_estadual !== null && linha.delta_media_estadual !== 0) {
      const direcao = linha.delta_media_estadual > 0 ? 'acima' : 'abaixo';
      const gatilho: GatilhoSugestao = direcao === 'acima' ? 'ACIMA_DA_MEDIA' : 'ABAIXO_DA_MEDIA';
      const desfavoravel = indicador.polaridade === null
        ? null
        : (indicador.polaridade === 'MENOR_MELHOR') === (direcao === 'acima');
      if (desfavoravel !== false) {
        // Ano do DADO (procedência da linha), nunca o ano da consulta.
        const ano = linha.procedencia[0]?.data_referencia.slice(0, 4) ?? '';
        const v = fmt.format(linha.valor);
        const m = fmt.format(dossie.ranking.media_estadual);
        const d = fmt.format(Math.abs(linha.delta_media_estadual));
        // Forma INVARIANTE: "o indicador X está em…" nunca depende do
        // gênero/número do nome do indicador (rodada 2, concordância).
        const abertura =
          `Em ${local}, o indicador "${indicador.nome}" está em ${v} ${indicador.unidade} (${ano}), ` +
          `${d} ${indicador.unidade} ${direcao} da média estadual de ${m}`;
        const textoBase = desfavoravel === true
          ? `${abertura} — desvio desfavorável para um indicador em que ${sentidoDe(indicador.polaridade!)}. ` +
            `O dado subsidia a gestão local. `
          : `${abertura}. O catálogo não declara polaridade para este indicador, portanto o ` +
            `desvio é registrado como fato, sem juízo de valor. `;
        delta = { direcao, julgado: desfavoravel === true, textoBase, autorizadores: [v, m, d, ano], gatilho };
      }
    }
  }

  // ---- (b) tendência nos três últimos pontos da série ----
  type Tend = { textoBase: string; autorizadores: string[]; julgado: boolean; gatilho: GatilhoSugestao } | null;
  let tendencia: Tend = null;
  const pontos = dossie.serie.pontos;
  if (pontos.length >= 3) {
    const [p1, p2, p3] = pontos.slice(-3);
    const alta = p1.valor < p2.valor && p2.valor < p3.valor;
    const queda = p1.valor > p2.valor && p2.valor > p3.valor;
    if (alta || queda) {
      const gatilho: GatilhoSugestao = alta ? 'TENDENCIA_ALTA' : 'TENDENCIA_QUEDA';
      const desfavoravel = indicador.polaridade === null
        ? null
        : (indicador.polaridade === 'MENOR_MELHOR') === alta;
      if (desfavoravel !== false) {
        const slots = [p1, p2, p3].flatMap((p) => [String(p.ano), fmt.format(p.valor)]);
        const trecho = [p1, p2, p3].map((p) => `${p.ano}: ${fmt.format(p.valor)}`).join('; ');
        // Forma INVARIANTE (concordância): sujeito fixo "o indicador".
        const abertura =
          `Em ${local}, o indicador "${indicador.nome}" apresenta ${alta ? 'alta' : 'queda'} contínua nos três ` +
          `últimos pontos da série (${trecho} ${indicador.unidade})`;
        const textoBase = desfavoravel === true
          ? `${abertura} — movimento desfavorável para um indicador em que ${sentidoDe(indicador.polaridade!)}. ` +
            `O dado subsidia a gestão local. `
          : `${abertura}. O catálogo não declara polaridade para este indicador, portanto a ` +
            `tendência é registrada como fato, sem juízo de valor. `;
        tendencia = { textoBase, autorizadores: slots, julgado: desfavoravel === true, gatilho };
      }
    }
  }

  // ---- (c) causa dominante — um subsídio por EIXO de decomposição ----
  // Rodada 2 do gauntlet: TODAS as dimensões disponíveis são avaliadas (não
  // só CAPITULO_CID10), cada uma com NO MÁXIMO uma sugestão, na ordem de
  // participação DESC da categoria dominante (o eixo mais concentrado
  // primeiro; empate: ORDEM_DIMENSOES). Nenhum score novo: só ordenação
  // sobre números que o motor já publicou.
  type CausaCand = { textoBase: string; autorizadores: string[]; pratica: PraticaCatalogo };
  const causasCand: CausaCand[] = [];
  if (dossie.causas) {
    const alvoNome = dossie.causas.decomposicao_de ?? dossie.causas.indicador;
    const dims = dossie.causas.dimensoes
      .filter((d) => d.total > 0 && d.categorias.length > 0)
      .slice()
      .sort((a, b) =>
        b.categorias[0].participacao - a.categorias[0].participacao ||
        ordemDe(a.dimensao) - ordemDe(b.dimensao));
    const usadas = new Set<number>();
    for (const dim of dims) {
      // O motor já ordena categorias por valor DESC (determinístico).
      const dominante = dim.categorias[0];
      const pratica = praticaParaDimensao(praticas, indicador.tema, dim.dimensao, dominante.categoria, usadas);
      if (!pratica) continue; // eixo sem prática curada/mapeada não vira sugestão
      usadas.add(pratica.id);
      const rotuloDim = rotuloDimensao.get(dim.dimensao) ?? dim.dimensao;
      const ano = dim.referencia.slice(0, 4);
      const vc = fmt.format(dominante.valor);
      const tot = fmt.format(dim.total);
      const part = fmt.format(dominante.participacao);
      causasCand.push({
        textoBase:
          `Em ${dossie.causas.local}, a decomposição de ${alvoNome} (${ano}) tem "${dominante.categoria}" ` +
          `como categoria dominante do eixo ${rotuloDim}: participação de ${part}% (${vc} de ${tot}). ` +
          `O dado subsidia a priorização. `,
        autorizadores: [vc, tot, part, ano, dominante.categoria, alvoNome, rotuloDim, dossie.causas.local],
        pratica,
      });
    }
  }

  // ---- (d) cobertura incompleta ----
  let cobertura: { textoBase: string; autorizadores: string[] } | null = null;
  if (dossie.ranking.ausentes.total > 0) {
    const aus = fmt.format(dossie.ranking.ausentes.total);
    const totm = fmt.format(dossie.ranking.total_municipios);
    cobertura = {
      // Forma INVARIANTE (concordância): o verbo concorda com "a cobertura"
      // (sempre singular) e a contagem fica sem verbo a flexionar — vale
      // igual para 1 ou N municípios ausentes.
      textoBase:
        `No recorte estadual do indicador "${indicador.nome}", a cobertura está incompleta: ` +
        `${aus} de ${totm} municípios sem dado publicado na referência consultada — ` +
        `a ausência é declarada, nunca estimada. `,
      autorizadores: [aus, totm],
    };
  }

  // ---- Montagem na ordem de relevância documentada acima ----
  const empurrar = (
    textoBase: string,
    autorizadores: string[],
    gatilho: GatilhoSugestao,
    origem: Sugestao['origem'],
    apenasGeral: boolean,
  ) => {
    for (const p of selecionarPraticas(praticas, indicador.tema, gatilho, apenasGeral)) {
      candidatas.push({
        sugestao: {
          texto: `${textoBase}${fechoPratica(p)}`,
          pratica_citada: p.nome,
          fonte_referencia: p.fonte,
          gatilho,
          origem,
        },
        autorizadores: [...autorizadores, ...meta, p.nome, p.descricao, p.fonte],
      });
    }
  };

  const origemMunicipio: Sugestao['origem'] = {
    tipo: 'RANKING_MUNICIPIO', codigo_ibge: codigo ?? undefined, indicadorId: indicador.id,
  };

  // Causa dominante: a prática já foi escolhida por eixo (praticaParaDimensao).
  for (const c of causasCand) {
    candidatas.push({
      sugestao: {
        texto: `${c.textoBase}${fechoPratica(c.pratica)}`,
        pratica_citada: c.pratica.nome,
        fonte_referencia: c.pratica.fonte,
        gatilho: 'CAUSA_DOMINANTE',
        origem: { tipo: 'CAUSA', indicadorId: indicador.id },
      },
      autorizadores: [...c.autorizadores, ...meta, c.pratica.nome, c.pratica.descricao, c.pratica.fonte],
    });
  }
  if (delta?.julgado) empurrar(delta.textoBase, delta.autorizadores, delta.gatilho, origemMunicipio, false);
  if (tendencia?.julgado) empurrar(tendencia.textoBase, tendencia.autorizadores, tendencia.gatilho, { tipo: 'SERIE', indicadorId: indicador.id }, false);
  if (delta && !delta.julgado) empurrar(delta.textoBase, delta.autorizadores, delta.gatilho, origemMunicipio, true);
  if (tendencia && !tendencia.julgado) empurrar(tendencia.textoBase, tendencia.autorizadores, tendencia.gatilho, { tipo: 'SERIE', indicadorId: indicador.id }, true);
  if (cobertura) empurrar(cobertura.textoBase, cobertura.autorizadores, 'COBERTURA_INCOMPLETA', { tipo: 'INDICADOR', indicadorId: indicador.id }, false);

  // ---- Auditoria de numerais (RG-03, fail-closed POR sugestão) ----
  const sugestoes: Sugestao[] = [];
  const descartes: DescarteSugestao[] = [];
  for (const c of candidatas.slice(0, MAX_SUGESTOES)) {
    const autorizados = c.autorizadores.flatMap((s) => extrairNumerais(s));
    const intrusos = extrairNumerais(c.sugestao.texto).filter(
      (n) => !autorizados.some((a) => Math.abs(a - n) < 1e-9),
    );
    if (intrusos.length > 0) {
      descartes.push({ gatilho: c.sugestao.gatilho, pratica: c.sugestao.pratica_citada, intrusos });
    } else {
      sugestoes.push(c.sugestao);
    }
  }
  return { sugestoes, descartes };
}

@Injectable()
export class SugestoesService {
  private readonly log = new Logger('Xingu.A16');
  private cache: { quando: number; praticas: PraticaCatalogo[] } | null = null;
  private cacheDimensoes: { quando: number; linhas: DimensaoObservacaoCatalogo[] } | null = null;
  private static readonly TTL_MS = 60_000;

  constructor(private readonly db: DatabaseService) {}

  /** Catálogo curado (db/51) — a aplicação só lê; curadoria é migração. */
  private async catalogo(): Promise<PraticaCatalogo[]> {
    if (this.cache && Date.now() - this.cache.quando < SugestoesService.TTL_MS) {
      return this.cache.praticas;
    }
    const r = await this.db.query<PraticaCatalogo>(
      `SELECT "PraticaGestao_Id" AS id, "PraticaGestao_Area" AS area,
              "PraticaGestao_Gatilho" AS gatilho, "PraticaGestao_Nome" AS nome,
              "PraticaGestao_Descricao" AS descricao,
              "PraticaGestao_FonteReferencia" AS fonte
         FROM "PraticaGestao" ORDER BY "PraticaGestao_Id"`,
    );
    this.cache = { quando: Date.now(), praticas: r.rows };
    return r.rows;
  }

  /**
   * Vocabulário de dimensões (db/54 — Evolução E1), mesmo padrão de cache do
   * catálogo de práticas: rótulo ("_Nome") e ordem canônica ("_Ordem") que
   * antes eram constantes ROTULO_DIMENSAO/ORDEM_DIMENSOES no código.
   */
  private async dimensoes(): Promise<DimensaoObservacaoCatalogo[]> {
    if (this.cacheDimensoes && Date.now() - this.cacheDimensoes.quando < SugestoesService.TTL_MS) {
      return this.cacheDimensoes.linhas;
    }
    const r = await this.db.query<DimensaoObservacaoCatalogo>(
      `SELECT "DimensaoObservacao_Codigo" AS codigo,
              "DimensaoObservacao_Nome"   AS nome,
              "DimensaoObservacao_Ordem"::int AS ordem
         FROM "DimensaoObservacao"
        WHERE "DimensaoObservacao_Ativa"
        ORDER BY "DimensaoObservacao_Ordem", "DimensaoObservacao_Codigo"`,
    );
    this.cacheDimensoes = { quando: Date.now(), linhas: r.rows };
    return r.rows;
  }

  async gerar(entrada: EntradaSugestoes): Promise<SaidaSugestoes> {
    const [praticas, dims] = await Promise.all([this.catalogo(), this.dimensoes()]);
    const { sugestoes, descartes } = gerarSugestoes(entrada, praticas, dims);
    for (const d of descartes) {
      // Fail-closed auditável: numeral fora do conjunto autorizado ⇒ descarte.
      this.log.warn(
        `A16 descartou sugestão (gatilho ${d.gatilho}, prática "${d.pratica}"): ` +
        `numerais intrusos ${JSON.stringify(d.intrusos)}.`,
      );
    }
    return { sugestoes, descartadas: descartes.length };
  }
}
