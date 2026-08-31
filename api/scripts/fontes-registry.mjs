// ============================================================
// fontes-registry.mjs — LEITOR do catálogo curado "FonteConector" (db/55).
//
// Evolução E2 do ADR-010: o registro de conectores saiu deste arquivo (era
// um array hardcoded de 12 entradas) e virou catálogo no BANCO — "esse
// cadastro não deve ficar codificado no software" (pesquisa de fontes,
// seção 36). Conector novo = linha de curadoria por migração; este módulo
// só materializa a listagem com a MESMA superfície que os consumidores já
// usavam: { slug, nome, tipo, periodicidade, dias, comando?, bloqueio? }
// (+ os campos novos do catálogo: origem, classe, situacao, configIngestao;
// + E15/db/59: intervaloVerificacaoDias, latenciaDias, ultimaCompetencia —
// e as funções puras de frescor no fim deste arquivo).
//
// SEM FALLBACK HARDCODED, de propósito: banco sem db/55 recebe erro claro
// mandando migrar. Um fallback silencioso faria o banco nunca virar fonte
// de verdade — a lista fantasma no código voltaria a mandar.
//
// Scripts rodam fora do Nest: aceita um client/pool pg injetado (padrão dos
// consumidores, que já têm conexão aberta) ou, sem argumento, conecta uma
// vez via DATABASE_URL — exigida explicitamente, sem default para o banco
// dev (regra da casa: nada aponta para `itmt` por omissão).
// ============================================================
import pg from 'pg';

const SQL_LISTAGEM = `
  SELECT "FonteConector_Slug"           AS slug,
         "FonteConector_Nome"           AS nome,
         "FonteConector_Origem"         AS origem,
         "FonteConector_ClasseIntegracao" AS classe,
         "FonteConector_Tipo"           AS tipo,
         "FonteConector_Periodicidade"  AS periodicidade,
         "FonteConector_IntervaloDias"  AS dias,
         "FonteConector_Situacao"       AS situacao,
         "FonteConector_MotivoBloqueio" AS bloqueio,
         "FonteConector_Comando"        AS comando,
         "FonteConector_ConfigIngestao" AS "configIngestao",
         "FonteConector_Fase"           AS fase,
         "FonteConector_Area"           AS area,
         "FonteConector_UrlOficial"     AS "urlOficial",
         "FonteConector_Prioridade"     AS prioridade,
         "FonteConector_Dificuldade"    AS dificuldade,
         "FonteConector_IntervaloVerificacaoDias" AS "intervaloVerificacaoDias",
         "FonteConector_LatenciaEsperadaDias"     AS "latenciaDias",
         "FonteConector_UltimaCompetencia"        AS "ultimaCompetencia"
    FROM "FonteConector"
   WHERE "FonteConector_Ativa"
   ORDER BY "FonteConector_Ordem", "FonteConector_Slug"`;

function materializar(linha) {
  const fonte = {
    slug: linha.slug,
    nome: linha.nome,
    origem: linha.origem,
    classe: linha.classe,
    tipo: linha.tipo,
    periodicidade: linha.periodicidade,
    dias: linha.dias,
    situacao: linha.situacao,
    configIngestao: linha.configIngestao ?? null,
    // Metadados do programa completo (E2b, db/56 — matrizes F1/F2).
    fase: linha.fase ?? null,
    area: linha.area ?? null,
    urlOficial: linha.urlOficial ?? null,
    prioridade: linha.prioridade ?? null,
    dificuldade: linha.dificuldade ?? null,
    // E15 (db/59): verificação ≠ ingestão ≠ latência ≠ frescor. NULL = sem
    // curadoria específica — a janela do tipo (dias) segue mandando.
    intervaloVerificacaoDias: linha.intervaloVerificacaoDias ?? null,
    latenciaDias: linha.latenciaDias ?? null,
    ultimaCompetencia: linha.ultimaCompetencia ?? null,
  };
  // Mesmo contrato do registro antigo: `comando` só existe em fonte
  // executável; `bloqueio` só existe em fonte bloqueada (o CHECK de db/55
  // garante a exclusão mútua no banco).
  if (linha.comando) fonte.comando = Object.freeze([...linha.comando]);
  if (linha.bloqueio) fonte.bloqueio = linha.bloqueio;
  return Object.freeze(fonte);
}

/**
 * Lê o catálogo "FonteConector" (só ativas, na ordem canônica).
 * @param {{query: Function}} [db] client/pool pg já conectado; sem ele,
 *   conecta uma vez via DATABASE_URL.
 */
export async function carregarFontes(db) {
  let rows;
  try {
    if (db) {
      ({ rows } = await db.query(SQL_LISTAGEM));
    } else {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL é obrigatória para ler o catálogo "FonteConector" (db/55).');
      }
      const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await cliente.connect();
      try {
        ({ rows } = await cliente.query(SQL_LISTAGEM));
      } finally {
        await cliente.end();
      }
    }
  } catch (erro) {
    if (erro?.code === '42P01') { // undefined_table
      throw new Error(
        'O catálogo "FonteConector" não existe neste banco: aplique as migrações '
        + '(cd api && npm run migrar — db/55-catalogo-conectores-fonte.sql). '
        + 'Desde a evolução E2 (ADR-010) o registro de conectores vive no BANCO; '
        + 'não há fallback hardcoded.',
      );
    }
    throw erro;
  }
  return Object.freeze(rows.map(materializar));
}

export function proximaVerificacao(agora, dias, sucesso = true) {
  const atrasoFalha = Math.min(dias, 7);
  return new Date(agora.getTime() + (sucesso ? dias : atrasoFalha) * 86400000);
}

// ============================================================
// E15 (ADR-010, db/59) — verificação ≠ ingestão ≠ latência ≠ frescor.
// Absorção conceitual do pacote "Core R2.1 — Periodicidade e Orquestração":
// a cadência de CHECAGEM da origem é uma coisa; a LATÊNCIA normal de
// publicação é outra; e o FRESCOR do dado carregado é uma terceira. Regra
// essencial (irmã da RN-005): ausência de atualização NÃO significa
// automaticamente falha — só depois de janela+latência um silêncio vira
// ATENCAO, e só bem além disso vira ATRASADO.
// ============================================================

/** Vocabulário reduzido do Core R2.1 (sem ADIANTADO/CRITICO/DESCONTINUADO —
 *  YAGNI até existir consumidor; corte documentado em db/59). */
export const FRESCORES = Object.freeze(
  ['DESCONHECIDO', 'EM_DIA', 'ATENCAO', 'ATRASADO', 'INDISPONIVEL'],
);

/**
 * Cadência de verificação efetiva: a curadoria por conector
 * (_IntervaloVerificacaoDias, db/59) quando presente; senão a janela do
 * tipo (dias, comportamento pré-E15 — retrocompatível, assertado em teste).
 */
export function intervaloEfetivo(fonte) {
  return fonte.intervaloVerificacaoDias ?? fonte.dias;
}

/**
 * Função PURA de classificação de frescor (E15).
 * @param {object} p
 * @param {Date|string|null} p.ultimaCargaEm última carga bem-sucedida (null = sem histórico)
 * @param {number} p.intervaloDias cadência de verificação efetiva
 * @param {number|null} [p.latenciaDias] atraso normal de publicação (null = 0)
 * @param {Date} [p.agora]
 * @param {boolean} [p.falhouAgora] a última tentativa falhou
 * @returns {'DESCONHECIDO'|'EM_DIA'|'ATENCAO'|'ATRASADO'|'INDISPONIVEL'}
 */
export function classificarFrescor({ ultimaCargaEm, intervaloDias, latenciaDias = 0, agora = new Date(), falhouAgora = false }) {
  if (falhouAgora) return 'INDISPONIVEL';
  if (!ultimaCargaEm) return 'DESCONHECIDO';
  const janela = intervaloDias + (latenciaDias ?? 0);
  const decorridos = (agora.getTime() - new Date(ultimaCargaEm).getTime()) / 86400000;
  if (decorridos <= janela) return 'EM_DIA';          // dentro de janela+latência: silêncio é normal
  if (decorridos < janela * 1.5) return 'ATENCAO';    // passou, mas ainda < 1,5× — vale olhar
  return 'ATRASADO';                                  // além de 1,5×: atraso real
}

/**
 * Frescor de uma fonte do catálogo numa rodada de sincronização.
 * BLOQUEADA_EXTERNA e PLANEJADA não estão em operação: DESCONHECIDO,
 * sempre — quem não roda não pode estar "atrasado" (alerta falso proibido).
 */
export function frescorDaFonte(fonte, { ultimoSucesso = null, ultimaFalhou = false, agora = new Date() } = {}) {
  if (fonte.situacao !== 'EXECUTAVEL') return 'DESCONHECIDO';
  return classificarFrescor({
    ultimaCargaEm: ultimoSucesso,
    intervaloDias: intervaloEfetivo(fonte),
    latenciaDias: fonte.latenciaDias,
    agora,
    falhouAgora: ultimaFalhou,
  });
}

export const MOTIVO_PLANEJADA =
  'Backlog da matriz de integrações (ADR-010/E2b): coletor ainda não construído — trabalho futuro, não bloqueio externo.';

/**
 * E2b: decisão única de sincronização por fonte, usada por
 * sincronizar-fontes.mjs no upsert da agenda E no laço de execução —
 * PLANEJADA (backlog de db/56) fica visível na agenda com a mesma
 * elegância das bloqueadas, mas NUNCA é executada (não tem comando).
 * @returns {{status: string, executa: boolean, detalhes: object}}
 */
export function planoDeSincronizacao(fonte) {
  if (fonte.situacao === 'BLOQUEADA_EXTERNA') {
    return { status: 'BLOQUEADA_EXTERNA', executa: false, detalhes: { motivo: fonte.bloqueio } };
  }
  if (fonte.situacao === 'PLANEJADA') {
    return { status: 'PLANEJADA', executa: false, detalhes: { motivo: MOTIVO_PLANEJADA } };
  }
  return { status: 'PENDENTE', executa: true, detalhes: {} };
}
