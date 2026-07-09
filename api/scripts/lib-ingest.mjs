// ============================================================
// lib-ingest.mjs — infraestrutura comum dos conectores (INGEST)
// Implementa: RG-06 (base legal obrigatória), RF-INGEST-002
// (Bronze imutável com SHA-256), RF-INGEST-006 (idempotência),
// RF-INGEST-009 (linhagem) e RG-10 (auditoria encadeada).
// ============================================================
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
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

  const existente = await db.query(
    `SELECT "Fonte_Id" AS id FROM "Fonte" WHERE "Fonte_Nome" = $1`,
    [nome],
  );
  if (existente.rows[0]) return existente.rows[0].id;

  const r = await db.query(
    `INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING "Fonte_Id" AS id`,
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
  writeFileSync(caminho, conteudo, { flag: 'w' });
  return { caminho, hash: sha256(conteudo) };
}

export function lerBronze(caminho) {
  const conteudo = readFileSync(caminho, 'utf8');
  return { conteudo, hash: sha256(conteudo) };
}

export async function registrarCarga(db, { fonteId, hash, caminhoBronze, linhasLidas }) {
  const r = await db.query(
    `INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas")
     VALUES ($1, now(), $2, $3, 'PROMOVIDA', $4) RETURNING "Carga_Id" AS id`,
    [fonteId, hash, caminhoBronze, linhasLidas],
  );
  return r.rows[0].id;
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
  return chaves(amostra).join('|');
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
