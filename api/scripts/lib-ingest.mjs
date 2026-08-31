// ============================================================
// lib-ingest.mjs — infraestrutura comum dos conectores (INGEST)
// Implementa: RG-06 (base legal obrigatória), RF-INGEST-002
// (Bronze imutável com SHA-256), RF-INGEST-006 (idempotência),
// RF-INGEST-009 (linhagem) e RG-10 (auditoria encadeada).
// ============================================================
import { createHash } from 'node:crypto';
import { closeSync, constants, mkdirSync, openSync, writeFileSync, readFileSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
import pg from 'pg';

export function pool() {
  return new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgres://itmt:itmt@localhost:5432/itmt',
  });
}

export function sha256(texto) {
  return createHash('sha256').update(texto).digest('hex');
}

/**
 * RG-06 / RF-INGEST-003: fonte sem base legal registrada FALHA o pipeline.
 * Não avisa: falha. Não existe exceção "temporária".
 */
export async function registrarFonte(db, { nome, origem, url, baseLegal, licenca, periodicidade }) {
  const VALIDAS = ['AUTORIZACAO_FORMAL', 'API_PUBLICA', 'DADO_ABERTO', 'LICENCA_COMERCIAL'];
  if (!baseLegal || !VALIDAS.includes(baseLegal)) {
    throw new Error(
      `RG-06: fonte "${nome}" sem base legal válida (recebido: ${baseLegal}). ` +
        `Pipeline abortado — registre a base legal antes de desenvolver o conector.`,
    );
  }
  if (!licenca) throw new Error(`RG-06: fonte "${nome}" sem licença declarada. Pipeline abortado.`);

  const r = await db.query(
    `INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade")
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT ("Fonte_Nome") DO UPDATE SET
       "Fonte_Origem" = EXCLUDED."Fonte_Origem",
       "Fonte_Url" = EXCLUDED."Fonte_Url",
       "Fonte_BaseLegal" = EXCLUDED."Fonte_BaseLegal",
       "Fonte_Licenca" = EXCLUDED."Fonte_Licenca",
       "Fonte_Periodicidade" = EXCLUDED."Fonte_Periodicidade"
     RETURNING "Fonte_Id" AS id`,
    [nome, origem, url, baseLegal, licenca, periodicidade ?? null],
  );
  return r.rows[0].id;
}

/**
 * E17 (ADR-010 / db/62): a configuração de ingestão vem do BANCO —
 * "FonteConectorConfiguracao", versão VIGENTE pelo slug (= nome do arquivo
 * sem extensão). O arquivo em ingest-configs/ vira derivado/fallback:
 *   · banco ainda sem db/62 (42P01) ou slug fora do catálogo ⇒ o ARQUIVO
 *     continua valendo (degradação segura, espírito da RG-05 — a ingestão
 *     nunca depende da migração nova para funcionar);
 *   · banco E arquivo presentes mas divergentes ⇒ warn com os DOIS hashes
 *     e o BANCO vence — ele é a fonte de verdade versionada; mudar a config
 *     é criar uma versão nova no catálogo, não editar o .json.
 * O hash canônico é o mesmo do banco (e da cadeia de auditoria):
 * sha256(((conteúdo)::jsonb)::text) — calculado NO banco, para bater byte a
 * byte com o que o trigger de db/62 gravou.
 */
export async function carregarConfigIngestao(db, caminhoConfig) {
  const slug = basename(caminhoConfig).replace(/\.json$/i, '');
  let textoArquivo = null;
  try { textoArquivo = readFileSync(caminhoConfig, 'utf8'); } catch { /* sem arquivo: o banco é a única via */ }

  let linha = null;
  try {
    const r = await db.query(
      `SELECT "FonteConectorConfiguracao_Conteudo"   AS conteudo,
              "FonteConectorConfiguracao_Versao"     AS versao,
              "FonteConectorConfiguracao_HashSha256" AS hash,
              "FonteConectorConfiguracao_ConectorSlug" AS conector_slug
         FROM "FonteConectorConfiguracao"
        WHERE "FonteConectorConfiguracao_Slug" = $1
          AND "FonteConectorConfiguracao_Vigente"`,
      [slug],
    );
    linha = r.rows[0] ?? null;
  } catch (erro) {
    if (erro?.code !== '42P01') throw erro; // banco pré-db/62 ⇒ fallback honesto
  }

  if (linha) {
    if (textoArquivo !== null) {
      try {
        const h = await db.query(
          `SELECT encode(sha256(convert_to(($1::jsonb)::text,'UTF8')),'hex') AS hash`,
          [textoArquivo],
        );
        if (h.rows[0].hash !== linha.hash) {
          console.warn(
            `⚠ Config "${slug}": arquivo diverge do banco ` +
              `(arquivo ${h.rows[0].hash} ≠ banco ${linha.hash}, versão vigente ${linha.versao}). ` +
              'O banco vence (fonte de verdade, db/62) — para mudar a config, registre uma versão nova no catálogo.',
          );
        }
      } catch {
        console.warn(
          `⚠ Config "${slug}": o arquivo local não é JSON comparável; usando a versão vigente do banco (v${linha.versao}).`,
        );
      }
    }
    return {
      slug, config: linha.conteudo, origem: 'banco', versao: linha.versao, hash: linha.hash,
      // E20 (db/64): o conector dono desta config é o que resolve QUAL
      // convenção de símbolos aplicar às células deste CSV.
      conectorSlug: linha.conector_slug ?? null,
    };
  }

  if (textoArquivo === null) {
    throw new Error(
      `Config de ingestão não encontrada: nem no banco (slug "${slug}") nem no arquivo ${caminhoConfig}.`,
    );
  }
  return {
    slug, config: JSON.parse(textoArquivo), origem: 'arquivo', versao: null, hash: null,
    conectorSlug: null,
  };
}

// ============================================================
// E20 (ADR-010 / db/64) — STATUS DO VALOR
//
// Antes desta seção, QUATRO conectores decidiam sozinhos o que uma célula
// queria dizer, e discordavam entre si sobre o MESMO símbolo da MESMA fonte:
// ingestar-pacote-f1-ibge convertia '-' do SIDRA para 0 (certo, e
// documentado); ingestar-ibge-agregado e ingestar-ibge-populacao mandavam o
// mesmo '-' para a quarentena como se fosse ausência (errado: some da base o
// município que a fonte declarou ter zero); e o coletor Python destruía a
// distinção antes de qualquer conector ver.
//
// Daqui em diante existe UM ponto de decisão — classificarValor() — e a
// convenção da fonte é DADO curado ("ConvencaoValorSimbolo", db/64), não
// constante no parser.
//
// A REGRA DE PROMOÇÃO, em uma frase: só status PROMOVÍVEL vira observação
// numérica. O resto NÃO vira zero e NÃO vira observação — vai para a
// quarentena com código tipado e o símbolo original preservado.
// ============================================================

/**
 * Fallback embutido das convenções, na mesma forma do catálogo (db/64).
 *
 * Existe pelo mesmo motivo do fallback de arquivo em carregarConfigIngestao:
 * degradação segura (espírito da RG-05). Um banco anterior ao db/64 não pode
 * fazer o ingestar-pacote-f1-ibge REGREDIR — ele já acertava o '-' do SIDRA
 * antes desta evolução, e tem de continuar acertando.
 *
 * O BANCO é a fonte de verdade; isto aqui só entra quando a tabela não
 * existe. api/test/status-valor.unit.mjs é a catraca anti-drift: quem editar
 * o seed do db/64 sem editar este objeto (ou vice-versa) quebra a suíte.
 */
export const CONVENCOES_EMBUTIDAS = Object.freeze({
  SIDRA: {
    '-': 'ZERO_ABSOLUTO',
    '0': 'VALOR',
    X: 'SUPRIMIDO',
    '..': 'NAO_APLICAVEL',
    '...': 'NAO_DISPONIVEL',
  },
  TABNET_TABULACAO_COMPLETA: {
    '-': 'ZERO_ABSOLUTO',
    '0': 'VALOR',
  },
});

/**
 * Semântica dos status — espelho de "StatusValor" (db/64).
 * `implicito` é o valor que o SÍMBOLO já carrega por si; null num status
 * promovível significa "o número vem da própria célula".
 */
export const STATUS_VALOR_EMBUTIDO = Object.freeze({
  VALOR:          { promovivel: true,  implicito: null },
  ZERO_ABSOLUTO:  { promovivel: true,  implicito: 0 },
  SUPRIMIDO:      { promovivel: false, implicito: null },
  NAO_APLICAVEL:  { promovivel: false, implicito: null },
  NAO_DISPONIVEL: { promovivel: false, implicito: null },
  INVALIDO:       { promovivel: false, implicito: null },
});

/** Status não promovível ⇒ código de razão tipado da "Quarentena" (db/64). */
const RAZAO_POR_STATUS = Object.freeze({
  SUPRIMIDO: 'VALOR_SUPRIMIDO',
  NAO_APLICAVEL: 'VALOR_NAO_APLICAVEL',
  NAO_DISPONIVEL: 'VALOR_NAO_DISPONIVEL',
  INVALIDO: 'VALOR_INVALIDO',
});

/**
 * Resolve as regras de leitura de célula de um conector.
 *
 * Banco primeiro (mesma doutrina do E17): a convenção sai de
 * "ConvencaoValorSimbolo"/"StatusValor", resolvida por
 *   · `convencao` — código explícito, para o conector que já sabe de que
 *     fonte veio (os três conectores IBGE são SIDRA por construção); ou
 *   · `conectorSlug` — a coluna "FonteConector_ConvencaoValor" (db/64), para
 *     o conector genérico de CSV, que só descobre a fonte pela config.
 *
 * Sem convenção resolvida devolve null, e null é o DEFAULT SEGURO: em
 * classificarValor, só número puro vira valor — símbolo nenhum vira zero.
 * É o comportamento correto para fonte cuja legenda ainda não foi curada
 * (hoje: cnes, inep e os demais conectores sem convenção no db/64).
 */
export async function carregarRegrasValor(db, { convencao, conectorSlug } = {}) {
  let codigo = convencao ?? null;
  try {
    if (!codigo && conectorSlug) {
      const r = await db.query(
        `SELECT "FonteConector_ConvencaoValor" AS c FROM "FonteConector"
          WHERE "FonteConector_Slug" = $1`, [conectorSlug],
      );
      codigo = r.rows[0]?.c ?? null;
    }
    if (!codigo) return null;

    const r = await db.query(
      `SELECT s."ConvencaoValorSimbolo_Simbolo"      AS simbolo,
              s."ConvencaoValorSimbolo_StatusValor"  AS status,
              v."StatusValor_Promovivel"             AS promovivel,
              v."StatusValor_ValorImplicito"         AS implicito
         FROM "ConvencaoValorSimbolo" s
         JOIN "StatusValor" v ON v."StatusValor_Codigo" = s."ConvencaoValorSimbolo_StatusValor"
        WHERE s."ConvencaoValorSimbolo_Convencao" = $1
          AND s."ConvencaoValorSimbolo_Ativa" AND v."StatusValor_Ativo"`,
      [codigo],
    );
    if (!r.rows.length) return regrasEmbutidas(codigo);
    const simbolos = new Map();
    for (const l of r.rows) {
      simbolos.set(l.simbolo, {
        status: l.status,
        promovivel: l.promovivel,
        implicito: l.implicito === null ? null : Number(l.implicito),
      });
    }
    return { convencao: codigo, origem: 'banco', simbolos };
  } catch (erro) {
    if (erro?.code !== '42P01' && erro?.code !== '42703') throw erro;
    return regrasEmbutidas(codigo); // banco pré-db/64 ⇒ fallback honesto
  }
}

function regrasEmbutidas(codigo) {
  const tabela = codigo ? CONVENCOES_EMBUTIDAS[codigo] : null;
  if (!tabela) return null;
  const simbolos = new Map();
  for (const [simbolo, status] of Object.entries(tabela)) {
    simbolos.set(simbolo, { status, ...STATUS_VALOR_EMBUTIDO[status] });
  }
  return { convencao: codigo, origem: 'embutida', simbolos };
}

/**
 * O ÚNICO ponto que decide o que uma célula bruta quer dizer.
 * Função PURA: as regras já vêm resolvidas (carregarRegrasValor), então o
 * ratchet prova símbolo a símbolo sem banco no ar.
 *
 * Devolve:
 *   { simbolo, status, promovivel, valor, codigoRazao }
 * onde `valor` é number quando promovível e null caso contrário — nunca 0
 * por descuido — e `codigoRazao` é o código tipado da "Quarentena" (null
 * quando a célula é promovível, porque aí não há descarte).
 *
 * Ordem de decisão, e o porquê de cada passo:
 *  1. Símbolo catalogado vence o parse numérico. É o que faz '0' do SIDRA ser
 *     VALOR e '-' ser ZERO_ABSOLUTO em vez de NaN.
 *  2. Sem símbolo catalogado, número puro é VALOR. É todo o comportamento do
 *     default seguro (fonte sem convenção curada).
 *  3. Qualquer outra coisa é INVALIDO — inclusive célula vazia e letra de
 *     faixa ('A'–'Z'), cujo status FAIXA_VALOR ficou adiado no db/64. O
 *     adiamento é seguro exatamente por isto: cai aqui e nunca vira zero.
 */
export function classificarValor(bruto, regras) {
  const simbolo = String(bruto ?? '').trim();
  const doCatalogo = regras?.simbolos?.get(simbolo) ?? null;

  const numero = (() => {
    if (simbolo === '') return NaN;
    return Number(simbolo.replace(',', '.'));
  })();

  let status;
  let promovivel;
  let implicito;
  if (doCatalogo) {
    ({ status, promovivel, implicito } = doCatalogo);
  } else if (Number.isFinite(numero)) {
    ({ promovivel, implicito } = STATUS_VALOR_EMBUTIDO.VALOR);
    status = 'VALOR';
  } else {
    ({ promovivel, implicito } = STATUS_VALOR_EMBUTIDO.INVALIDO);
    status = 'INVALIDO';
  }

  let valor = null;
  if (promovivel) {
    valor = implicito !== null && implicito !== undefined ? Number(implicito) : numero;
    if (!Number.isFinite(valor)) {
      // Catálogo diz promovível mas a célula não tem número (ex.: alguém
      // semeou um símbolo apontando para VALOR sem valor implícito). Não se
      // inventa número: rebaixa para INVALIDO, que é a verdade.
      status = 'INVALIDO';
      promovivel = false;
      valor = null;
    }
  }

  return {
    simbolo,
    status,
    promovivel,
    valor,
    codigoRazao: promovivel ? null : (RAZAO_POR_STATUS[status] ?? 'VALOR_INVALIDO'),
  };
}

/**
 * Camada BRONZE (RF-INGEST-002): preserva o bruto imutável com hash SHA-256.
 * Em produção o destino é object storage com Object Lock (WORM, RNF-06);
 * aqui, diretório local ./bronze.
 */
export function salvarBronze(nomeArquivo, conteudo) {
  if (typeof nomeArquivo !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,199}$/i.test(nomeArquivo))
    throw new Error('RF-INGEST-002: nome de arquivo Bronze inválido.');
  if (typeof conteudo !== 'string' && !Buffer.isBuffer(conteudo))
    throw new Error('RF-INGEST-002: conteúdo Bronze deve ser texto ou Buffer.');
  const payload = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, 'utf8');
  const limite = Number(process.env.BRONZE_MAX_BYTES ?? 268_435_456);
  if (!Number.isSafeInteger(limite) || limite < 1 || payload.byteLength > limite)
    throw new Error(`RF-INGEST-002: conteúdo Bronze excede o limite de ${limite} bytes.`);

  const dir = resolve(process.env.BRONZE_DIR ?? resolve(process.cwd(), 'bronze'));
  mkdirSync(dir, { recursive: true });
  const caminho = resolve(dir, nomeArquivo);
  if (!caminho.startsWith(`${dir}${sep}`))
    throw new Error('RF-INGEST-002: destino Bronze fora do diretório permitido.');
  const hash = sha256(payload);
  let descritor;
  try {
    descritor = openSync(caminho, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    writeFileSync(descritor, payload);
    return { caminho, hash };
  } catch (erro) {
    if (erro?.code !== 'EEXIST') throw erro;
    const leitura = openSync(caminho, constants.O_RDONLY);
    let existente;
    try { existente = readFileSync(leitura); } finally { closeSync(leitura); }
    const hashExistente = sha256(existente);
    if (hashExistente !== hash) {
      throw new Error(
        `RF-INGEST-002: Bronze imutável — ${caminho} já existe com hash diferente. ` +
        'Use um nome versionado para a nova extração.',
      );
    }
    return { caminho, hash };
  } finally {
    if (descritor !== undefined) closeSync(descritor);
  }
}

export function lerBronze(caminho) {
  const conteudo = readFileSync(caminho, 'utf8');
  return { conteudo, hash: sha256(conteudo) };
}

/**
 * E18 (ADR-010 / db/63): a carga nasce CANDIDATA — bruto salvo, NADA
 * validado ainda. Antes ela nascia 'PROMOVIDA', o que fazia o pipeline
 * mentir: 12 cargas do banco dev estavam PROMOVIDA sem uma observação
 * sequer, e a carga 96 estava PROMOVIDA com 141 de 141 linhas em quarentena.
 * A promoção agora é um ATO SEPARADO — confirmarCarga(), chamada só depois
 * do Ouro carregado, na mesma transação do Ouro. Carga que falhar no meio
 * fica CANDIDATA para sempre, que é a verdade sobre ela.
 *
 * O dedup por (fonte, hash) continua com pg_advisory_xact_lock aqui, mas
 * deixou de depender disso: db/63 pôs UNIQUE + trigger no banco (doutrina
 * "vetos são de banco"). Este SELECT-primeiro segue existindo porque a
 * REEXECUÇÃO legítima do mesmo Bronze precisa reaproveitar a carga, não
 * estourar.
 */
export async function registrarCarga(db, { fonteId, hash, caminhoBronze, linhasLidas }) {
  const cli = await db.connect();
  try {
    await cli.query('BEGIN');
    await cli.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`carga:${fonteId}:${hash}`]);
    const existente = await cli.query(
      `SELECT "Carga_Id" AS id FROM "Carga"
        WHERE "Carga_FonteId" = $1 AND "Carga_HashSha256" = $2
        ORDER BY "Carga_Id" LIMIT 1`, [fonteId, hash],
    );
    if (existente.rows[0]) {
      await cli.query('COMMIT');
      return existente.rows[0].id;
    }
    const r = await cli.query(
      `INSERT INTO "Carga"
         ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas")
       VALUES ($1, now(), $2, $3, 'CANDIDATA', $4)
       RETURNING "Carga_Id" AS id`,
      [fonteId, hash, caminhoBronze, linhasLidas],
    );
    await cli.query('COMMIT');
    return r.rows[0].id;
  } catch (e) {
    await cli.query('ROLLBACK');
    throw e;
  } finally {
    cli.release();
  }
}

/**
 * E18: segunda fase do checkpoint — CANDIDATA ⇒ PROMOVIDA.
 * Só chame DEPOIS do Ouro gravado com sucesso e, sempre que o conector
 * gerenciar a própria transação, DENTRO dela: assim ou o Ouro e a
 * confirmação sobrevivem juntos, ou nenhum dos dois.
 *
 * `exec` é qualquer coisa com .query() — o Pool ou o cliente da transação
 * do Ouro. Idempotente: reexecução da mesma carga não muda nada e devolve
 * false. Nunca promove uma carga BLOQUEADA_DRIFT: o WHERE exige CANDIDATA,
 * porque desbloquear drift é decisão de verificarEsquema (RF-INGEST-005),
 * não efeito colateral da promoção.
 */
export async function confirmarCarga(exec, cargaId) {
  const r = await exec.query(
    `UPDATE "Carga" SET "Carga_Status" = 'PROMOVIDA'
      WHERE "Carga_Id" = $1 AND "Carga_Status" = 'CANDIDATA'
      RETURNING "Carga_Id"`,
    [cargaId],
  );
  return (r.rows?.length ?? 0) > 0;
}

/**
 * Promoção Ouro em lote. Evita N round-trips e mantém a transação curta.
 * Registros cujo município não existe na malha são ignorados pela junção.
 *
 * E18 (db/63): a CTE `confirmada` faz a segunda fase do checkpoint no MESMO
 * comando do Ouro — atomicidade de graça, sem transação explícita. Ela só
 * dispara se `normalizada` tiver alguma linha: se nenhum município casou com
 * a malha, nada foi gravado e a carga PERMANECE CANDIDATA, que é a verdade.
 * (Foi exatamente essa a mentira da carga 96 do dev: 141/141 quarentenadas,
 * zero observações, status PROMOVIDA.)
 */
export async function promoverObservacoes(db, {
  indicadorId, fonteId, cargaId, dataReferencia, linhas,
}) {
  if (!linhas.length) return { gravadas: 0, semMalha: 0 };
  const codigos = linhas.map((l) => String(l.codigo));
  const valores = linhas.map((l) => Number(l.valor));
  const r = await db.query(
    `WITH entrada AS (
       SELECT * FROM unnest($1::text[], $2::numeric[]) AS x(codigo, valor)
     ), normalizada AS (
       SELECT m."Municipio_CodigoIbge" codigo, e.valor
       FROM entrada e JOIN "Municipio" m
         ON m."Municipio_CodigoIbge" = e.codigo
         OR left(m."Municipio_CodigoIbge", 6) = left(e.codigo, 6)
     ), promovida AS (
       INSERT INTO "Observacao"
         ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia",
          "Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
       SELECT $3, codigo, $4::date, valor, $5, $6 FROM normalizada
       ON CONFLICT ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_FonteId")
       DO UPDATE SET "Observacao_Valor" = EXCLUDED."Observacao_Valor",
                     "Observacao_CargaId" = EXCLUDED."Observacao_CargaId"
       RETURNING 1
     ), confirmada AS (
       UPDATE "Carga" SET "Carga_Status" = 'PROMOVIDA'
        WHERE "Carga_Id" = $6 AND "Carga_Status" = 'CANDIDATA'
          AND EXISTS (SELECT 1 FROM normalizada)
       RETURNING 1
     )
     SELECT (SELECT count(*)::int FROM promovida) gravadas,
            (SELECT count(*)::int FROM entrada) - (SELECT count(*)::int FROM normalizada) sem_malha,
            (SELECT count(*)::int FROM confirmada) confirmada`,
    [codigos, valores, indicadorId, dataReferencia, fonteId, cargaId],
  );
  return {
    gravadas: r.rows[0]?.gravadas ?? 0,
    semMalha: r.rows[0]?.sem_malha ?? 0,
    confirmada: (r.rows[0]?.confirmada ?? 0) > 0,
  };
}

/**
 * Auditoria encadeada (RG-10) — MESMA forma canônica do serviço da API:
 * HashAtual = SHA-256(HashAnterior ‖ (payload::jsonb)::text), calculado no SQL,
 * para que o verificador independente recomponha a cadeia byte a byte.
 *
 * convert_to(...,'UTF8') e nunca cast text::bytea, pelo mesmo motivo já
 * documentado em auditoria.service.ts: o cast lê o texto no formato de ENTRADA
 * de bytea e rejeita qualquer payload com barra invertida — uma aspa escapada
 * dentro de uma string, ou um \n num motivo de quarentena, derrubava a gravação
 * do evento. Para payload sem barra invertida os dois produzem os mesmos bytes,
 * então a troca não invalida cadeia alguma já gravada.
 */
export async function auditar(db, ator, acao, entidade, entidadeId, payload) {
  const cli = await db.connect();
  try {
    await cli.query('BEGIN');
    await cli.query('SELECT pg_advisory_xact_lock(842001)');
    const ult = await cli.query(
      `SELECT "EventoAuditoria_HashAtual" AS h FROM "EventoAuditoria" ORDER BY "EventoAuditoria_Id" DESC LIMIT 1`,
    );
    const anterior = ult.rows[0]?.h ?? '0'.repeat(64);
    await cli.query(
      `INSERT INTO "EventoAuditoria"
         ("EventoAuditoria_Ator","EventoAuditoria_Acao","EventoAuditoria_Entidade",
          "EventoAuditoria_EntidadeId","EventoAuditoria_Payload",
          "EventoAuditoria_HashAnterior","EventoAuditoria_HashAtual")
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::text,
               encode(sha256(convert_to($6::text || ($5::jsonb)::text,'UTF8')),'hex'))`,
      [ator, acao, entidade, entidadeId, JSON.stringify(payload), anterior],
    );
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK');
    throw e;
  } finally {
    cli.release();
  }
}

/** Busca HTTP com timeout — usada apenas no modo ao vivo. */
export async function baixar(url) {
  const ctl = new AbortController();
  // Consultas municipais do SIDRA podem levar mais de 30 s sem estarem
  // travadas. O limite continua finito e configurável pela operação.
  const limite = Number(process.env.INGEST_HTTP_TIMEOUT_MS ?? 120000);
  const t = setTimeout(() => ctl.abort(), limite);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

/**
 * RF-INGEST-010: quarentena — o registro inválido é isolado com motivo,
 * sem bloquear a carga do restante.
 *
 * E19 (ADR-010 / db/63): IDEMPOTENTE. Como registrarCarga devolve a MESMA
 * carga na reexecução (dedup por SHA-256 do bruto), o INSERT incondicional
 * de antes acumulava a cada rodada: o banco dev chegou a 2806 linhas para
 * 1512 registros reais (46% de cópias) e 11 cargas com LinhasQuarentena
 * MAIOR que LinhasLidas — aritmeticamente impossível. A identidade estável
 * é (carga, registro canônico, motivo), materializada pelo banco na coluna
 * gerada "Quarentena_ChaveLogica"; daqui em diante a repetição é um no-op.
 *
 * O contador "Carga_LinhasQuarentena" NÃO é mais tocado aqui: virou coluna
 * derivada, mantida pelo trigger trg_quarentena_contador (db/63). Ele só
 * conta linha que REALMENTE nasceu — o que torna impossível, por
 * construção, a aplicação inflar o número de novo.
 *
 * Devolve true se a linha era nova, false se já existia.
 *
 * E20 (db/64): o 5º parâmetro traz o código de razão TIPADO e o símbolo
 * ORIGINAL. O motivo em prosa continua (é o que o humano lê no dossiê); o
 * que se ganha é poder CONTAR e FILTRAR — "quantas linhas a fonte suprimiu
 * nesta carga?" deixa de exigir LIKE em string livre, que era como
 * "código IBGE fora de MT" e "valor suprimido pela fonte" acabavam
 * indistinguíveis. Opcional por compatibilidade: chamada antiga grava NULL,
 * que é a verdade sobre ela (mesmo critério do db/60).
 *
 * A chave lógica da E19 é sha256(registro ‖ LF ‖ motivo) e NÃO inclui estes
 * campos — de propósito: eles são derivados do mesmo par, então incluí-los
 * não mudaria a identidade e só quebraria a dedução do histórico já gravado.
 */
export async function quarentenar(db, cargaId, registro, motivo, { codigoRazao, simbolo } = {}) {
  const r = await db.query(
    `INSERT INTO "Quarentena"
       ("Quarentena_CargaId","Quarentena_Registro","Quarentena_Motivo",
        "Quarentena_CodigoRazao","Quarentena_SimboloOrigem")
     VALUES ($1,$2::jsonb,$3,$4,$5)
     ON CONFLICT ("Quarentena_CargaId","Quarentena_ChaveLogica") DO NOTHING
     RETURNING "Quarentena_Id"`,
    [cargaId, JSON.stringify(registro), motivo, codigoRazao ?? null, simbolo ?? null],
  );
  return (r.rows?.length ?? 0) > 0;
}

/**
 * RF-INGEST-005: detecção de drift de esquema na origem.
 * O fingerprint é o conjunto ordenado de chaves do primeiro registro.
 * Divergência ⇒ carga marcada BLOQUEADA_DRIFT + alerta na auditoria +
 * promoção abortada. Para aceitar o novo esquema conscientemente:
 * rode o conector com --aceitar-esquema.
 *
 * Chaves que são PERÍODO (ex.: "serie.2023" nos agregados SIDRA) são
 * normalizadas para "serie.<ano>": drift é mudança de ESTRUTURA da
 * fonte, não a virada natural do ano de referência — senão o guard
 * dispararia falso positivo a cada exercício.
 */
export function fingerprintDe(amostra) {
  const chaves = (obj, prefixo = '') =>
    Object.keys(obj ?? {})
      .sort()
      .flatMap((k) =>
        obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])
          ? [prefixo + k, ...chaves(obj[k], `${prefixo}${k}.`)]
          : [prefixo + k],
      );
  return chaves(amostra)
    .map((c) => c.replace(/^(serie)\.\d{4}$/, '$1.<ano>'))
    .join('|');
}

export async function verificarEsquema(db, { fonteId, cargaId, amostra, aceitarNovo }) {
  const fp = fingerprintDe(amostra);
  const atual = await db.query(
    `SELECT "EsquemaFonte_Fingerprint" AS fp FROM "EsquemaFonte" WHERE "EsquemaFonte_FonteId" = $1`,
    [fonteId],
  );
  // EV-20260822-054: uma carga marcada BLOQUEADA_DRIFT ficava bloqueada PARA
  // SEMPRE — nem `--aceitar-esquema` limpava o status, e `registrarCarga`
  // (dedup por hash) devolvia a mesma carga bloqueada nas reexecuções. O
  // aceite consciente do esquema (RF-INGEST-005) — ou o esquema voltar a
  // casar com o contrato — é exatamente a condição em que o bloqueio deixa
  // de fazer sentido; a partir daqui, ambos os caminhos desbloqueiam a carga
  // desta execução, com evento na trilha.
  //
  // E18 (db/63): desbloquear devolve a carga a CANDIDATA, NÃO a PROMOVIDA.
  // Antes, aceitar o esquema promovia a carga na hora — de novo o status
  // afirmando um sucesso que ainda não tinha acontecido. Sair do bloqueio só
  // significa "pode tentar de novo"; quem promove é confirmarCarga(), depois
  // do Ouro.
  const desbloquear = async (motivo) => {
    const r = await db.query(
      `UPDATE "Carga" SET "Carga_Status" = 'CANDIDATA'
        WHERE "Carga_Id" = $1 AND "Carga_Status" = 'BLOQUEADA_DRIFT'
        RETURNING "Carga_Id"`, [cargaId],
    );
    if (r.rows[0])
      await auditar(db, 'ingest', 'CARGA_DESBLOQUEADA', 'Carga', String(cargaId), { fonte_id: fonteId, motivo });
  };
  if (!atual.rows[0]) {
    await db.query(
      `INSERT INTO "EsquemaFonte" ("EsquemaFonte_FonteId","EsquemaFonte_Fingerprint") VALUES ($1,$2)`,
      [fonteId, fp],
    );
    return; // primeiro contrato registrado
  }
  if (atual.rows[0].fp === fp) {
    await desbloquear('esquema confere com o contrato vigente');
    return;
  }
  if (aceitarNovo) {
    await db.query(
      `UPDATE "EsquemaFonte" SET "EsquemaFonte_Fingerprint" = $2, "EsquemaFonte_AtualizadoEm" = now()
       WHERE "EsquemaFonte_FonteId" = $1`,
      [fonteId, fp],
    );
    await auditar(db, 'ingest', 'ESQUEMA_ATUALIZADO', 'Fonte', String(fonteId), { novo: fp });
    await desbloquear('novo esquema aceito conscientemente (--aceitar-esquema)');
    return;
  }
  await db.query(`UPDATE "Carga" SET "Carga_Status" = 'BLOQUEADA_DRIFT' WHERE "Carga_Id" = $1`, [cargaId]);
  await auditar(db, 'ingest', 'ALERTA_DRIFT_ESQUEMA', 'Carga', String(cargaId), {
    fonte_id: fonteId, esperado: atual.rows[0].fp, recebido: fp,
  });
  throw new Error(
    `RF-INGEST-005: drift de esquema detectado na fonte ${fonteId}. ` +
      `Promoção Bronze→Prata BLOQUEADA. Revise a origem e, se o novo esquema for legítimo, rode com --aceitar-esquema.`,
  );
}
