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
              "FonteConectorConfiguracao_HashSha256" AS hash
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
          `SELECT encode(sha256(($1::jsonb)::text::bytea),'hex') AS hash`,
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
    return { slug, config: linha.conteudo, origem: 'banco', versao: linha.versao, hash: linha.hash };
  }

  if (textoArquivo === null) {
    throw new Error(
      `Config de ingestão não encontrada: nem no banco (slug "${slug}") nem no arquivo ${caminhoConfig}.`,
    );
  }
  return { slug, config: JSON.parse(textoArquivo), origem: 'arquivo', versao: null, hash: null };
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
 */
export async function quarentenar(db, cargaId, registro, motivo) {
  const r = await db.query(
    `INSERT INTO "Quarentena" ("Quarentena_CargaId","Quarentena_Registro","Quarentena_Motivo")
     VALUES ($1,$2::jsonb,$3)
     ON CONFLICT ("Quarentena_CargaId","Quarentena_ChaveLogica") DO NOTHING
     RETURNING "Quarentena_Id"`,
    [cargaId, JSON.stringify(registro), motivo],
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
