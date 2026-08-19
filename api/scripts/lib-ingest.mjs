// ============================================================
// lib-ingest.mjs — infraestrutura comum dos conectores (INGEST)
// Implementa: RG-06 (base legal obrigatória), RF-INGEST-002
// (Bronze imutável com SHA-256), RF-INGEST-006 (idempotência),
// RF-INGEST-009 (linhagem) e RG-10 (auditoria encadeada).
// ============================================================
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
 * Camada BRONZE (RF-INGEST-002): preserva o bruto imutável com hash SHA-256.
 * Em produção o destino é object storage com Object Lock (WORM, RNF-06);
 * aqui, diretório local ./bronze.
 */
export function salvarBronze(nomeArquivo, conteudo) {
  const dir = process.env.BRONZE_DIR ?? join(process.cwd(), 'bronze');
  mkdirSync(dir, { recursive: true });
  const caminho = join(dir, nomeArquivo);
  const hash = sha256(conteudo);
  if (existsSync(caminho)) {
    const existente = readFileSync(caminho);
    const hashExistente = sha256(existente);
    if (hashExistente !== hash) {
      throw new Error(
        `RF-INGEST-002: Bronze imutável — ${caminho} já existe com hash diferente. ` +
        'Use um nome versionado para a nova extração.',
      );
    }
    return { caminho, hash };
  }
  writeFileSync(caminho, conteudo, { flag: 'wx' });
  return { caminho, hash };
}

export function lerBronze(caminho) {
  const conteudo = readFileSync(caminho, 'utf8');
  return { conteudo, hash: sha256(conteudo) };
}

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
       VALUES ($1, now(), $2, $3, 'PROMOVIDA', $4)
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
 * Promoção Ouro em lote. Evita N round-trips e mantém a transação curta.
 * Registros cujo município não existe na malha são ignorados pela junção.
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
     )
     SELECT (SELECT count(*)::int FROM promovida) gravadas,
            (SELECT count(*)::int FROM entrada) - (SELECT count(*)::int FROM normalizada) sem_malha`,
    [codigos, valores, indicadorId, dataReferencia, fonteId, cargaId],
  );
  return {
    gravadas: r.rows[0]?.gravadas ?? 0,
    semMalha: r.rows[0]?.sem_malha ?? 0,
  };
}

/**
 * Auditoria encadeada (RG-10) — MESMA forma canônica do serviço da API:
 * HashAtual = SHA-256(HashAnterior ‖ (payload::jsonb)::text), calculado no SQL,
 * para que o verificador independente recomponha a cadeia byte a byte.
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
               encode(sha256(($6::text || ($5::jsonb)::text)::bytea),'hex'))`,
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
  const t = setTimeout(() => ctl.abort(), 30000);
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
 */
export async function quarentenar(db, cargaId, registro, motivo) {
  await db.query(
    `INSERT INTO "Quarentena" ("Quarentena_CargaId","Quarentena_Registro","Quarentena_Motivo")
     VALUES ($1,$2::jsonb,$3)`,
    [cargaId, JSON.stringify(registro), motivo],
  );
  await db.query(
    `UPDATE "Carga" SET "Carga_LinhasQuarentena" = "Carga_LinhasQuarentena" + 1 WHERE "Carga_Id" = $1`,
    [cargaId],
  );
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
  if (!atual.rows[0]) {
    await db.query(
      `INSERT INTO "EsquemaFonte" ("EsquemaFonte_FonteId","EsquemaFonte_Fingerprint") VALUES ($1,$2)`,
      [fonteId, fp],
    );
    return; // primeiro contrato registrado
  }
  if (atual.rows[0].fp === fp) return;
  if (aceitarNovo) {
    await db.query(
      `UPDATE "EsquemaFonte" SET "EsquemaFonte_Fingerprint" = $2, "EsquemaFonte_AtualizadoEm" = now()
       WHERE "EsquemaFonte_FonteId" = $1`,
      [fonteId, fp],
    );
    await auditar(db, 'ingest', 'ESQUEMA_ATUALIZADO', 'Fonte', String(fonteId), { novo: fp });
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
