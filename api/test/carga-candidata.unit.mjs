// ============================================================
// carga-candidata.unit.mjs — catraca das evoluções E18 (checkpoint em duas
// fases na carga) e E19 (idempotência da quarentena), ADR-010 / db/63.
//
// PADRÃO: banco-direto, como siconfi.unit.mjs — node:test + pg.Pool sobre o
// DATABASE_URL de um banco DESCARTÁVEL migrado. NUNCA aponte para o dev.
//
// O QUE ESTA SUÍTE TRAVA (cada assert corresponde a um defeito MEDIDO no
// banco dev em 31/08/2026, antes do conserto):
//   · 12 cargas 'PROMOVIDA' sem uma observação sequer, e a carga 96 com
//     141 de 141 linhas em quarentena — também 'PROMOVIDA'. A carga nascia
//     promovida antes de qualquer validação.
//   · 2806 linhas em "Quarentena" para 1512 registros reais (1294 cópias,
//     46,1%) e 11 cargas com LinhasQuarentena > LinhasLidas.
//   · dedup de (fonte, hash) garantido só por advisory lock em aplicação.
//
// Os testes exercitam as funções REAIS de scripts/lib-ingest.mjs contra o
// banco, e os vetos são provados por SQL DIRETO — a doutrina da casa é que
// veto de banco tem que resistir a quem não passa pela aplicação.
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import pg from 'pg';
import {
  registrarCarga, confirmarCarga, quarentenar, promoverObservacoes, auditar,
} from '../scripts/lib-ingest.mjs';

const FONTES = ['E18 — fonte de catraca', 'E18 — fonte parada de catraca'];

let pool;
let fonteId;
let indicadorId;

/**
 * Hash sintético, único por caso e HEXADECIMAL DE VERDADE. Não é preciosismo:
 * o manifesto de reprodução (interoperabilidade) exige /^[0-9a-f]{64}$/ em
 * toda carga que alimente observação, e um hash falso desta suíte derrubaria
 * aquela — foi o que aconteceu na primeira execução.
 */
const hashDe = (semente) => createHash('sha256').update(`e18:${semente}`).digest('hex');

before(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const f = await pool.query(
    `INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade")
     VALUES ($1,'TESTE','https://exemplo.invalid','DADO_ABERTO','CC-BY','ANUAL')
     ON CONFLICT ("Fonte_Nome") DO UPDATE SET "Fonte_Origem" = EXCLUDED."Fonte_Origem"
     RETURNING "Fonte_Id" AS id`, [FONTES[0]],
  );
  fonteId = f.rows[0].id;
  const i = await pool.query(`SELECT "Indicador_Id" AS id FROM "Indicador" ORDER BY "Indicador_Id" LIMIT 1`);
  indicadorId = i.rows[0].id;
});

// Esta suíte cria fonte/carga/observação SINTÉTICAS. Elas não podem sobrar
// para as suítes seguintes (o banco descartável é compartilhado pela rodada):
// desfaz na ordem das FKs.
after(async () => {
  const alvo = `SELECT "Fonte_Id" FROM "Fonte" WHERE "Fonte_Nome" = ANY($1)`;
  await pool.query(`DELETE FROM "Observacao" WHERE "Observacao_FonteId" IN (${alvo})`, [FONTES]);
  await pool.query(
    `DELETE FROM "Quarentena" WHERE "Quarentena_CargaId" IN (
       SELECT "Carga_Id" FROM "Carga" WHERE "Carga_FonteId" IN (${alvo}))`, [FONTES]);
  await pool.query(`DELETE FROM "Carga" WHERE "Carga_FonteId" IN (${alvo})`, [FONTES]);
  await pool.query(`DELETE FROM "Fonte" WHERE "Fonte_Nome" = ANY($1)`, [FONTES]);
  await pool.end();
});

const statusDe = async (id) =>
  (await pool.query(`SELECT "Carga_Status" AS s FROM "Carga" WHERE "Carga_Id" = $1`, [id])).rows[0].s;

// ------------------------------------------------------------
// (a) e (b) — a carga nasce CANDIDATA e assim permanece se a rodada morre
// ------------------------------------------------------------
test('E18: a carga nasce CANDIDATA e uma falha depois do Bronze a deixa CANDIDATA e sem observações', async () => {
  const cargaId = await registrarCarga(pool, {
    fonteId, hash: hashDe('e18nasce'), caminhoBronze: 'bronze/e18-nasce.json', linhasLidas: 10,
  });

  assert.equal(await statusDe(cargaId), 'CANDIDATA',
    'registrarCarga não pode mais nascer PROMOVIDA — era esse o defeito das 12 cargas vazias do dev');

  // Simula o pipeline morrendo entre Bronze e Ouro (drift, rede, malha, o que for):
  // ninguém chama confirmarCarga, e nada mais acontece.
  const obs = await pool.query(
    `SELECT count(*)::int AS n FROM "Observacao" WHERE "Observacao_CargaId" = $1`, [cargaId],
  );
  assert.equal(obs.rows[0].n, 0, 'carga abortada não pode ter observação');
  assert.equal(await statusDe(cargaId), 'CANDIDATA',
    'carga que falhou no meio tem que FICAR CANDIDATA — nunca PROMOVIDA');
});

// ------------------------------------------------------------
// (c) — sucesso confirma; e a confirmação é idempotente
// ------------------------------------------------------------
test('E18: confirmarCarga promove CANDIDATA⇒PROMOVIDA, é idempotente e não toca carga bloqueada', async () => {
  const cargaId = await registrarCarga(pool, {
    fonteId, hash: hashDe('e18confirma'), caminhoBronze: 'bronze/e18-confirma.json', linhasLidas: 10,
  });

  assert.equal(await confirmarCarga(pool, cargaId), true, 'primeira confirmação deve promover');
  assert.equal(await statusDe(cargaId), 'PROMOVIDA');
  assert.equal(await confirmarCarga(pool, cargaId), false, 'reconfirmar não pode ser um segundo evento');
  assert.equal(await statusDe(cargaId), 'PROMOVIDA');

  // Uma carga BLOQUEADA_DRIFT jamais é promovida por confirmarCarga: sair do
  // bloqueio é decisão de verificarEsquema (RF-INGEST-005), não efeito
  // colateral da promoção.
  const bloqueada = await registrarCarga(pool, {
    fonteId, hash: hashDe('e18bloq'), caminhoBronze: 'bronze/e18-bloq.json', linhasLidas: 10,
  });
  await pool.query(`UPDATE "Carga" SET "Carga_Status" = 'BLOQUEADA_DRIFT' WHERE "Carga_Id" = $1`, [bloqueada]);
  assert.equal(await confirmarCarga(pool, bloqueada), false);
  assert.equal(await statusDe(bloqueada), 'BLOQUEADA_DRIFT',
    'confirmarCarga não pode desbloquear drift pelas costas');
});

// ------------------------------------------------------------
// (c') — o Ouro confirma na mesma transação; sem Ouro, sem promoção
// ------------------------------------------------------------
test('E18: promoverObservacoes confirma no mesmo comando do Ouro — e não confirma quando nada casa com a malha', async () => {
  const bom = await registrarCarga(pool, {
    fonteId, hash: hashDe('e18ouro'), caminhoBronze: 'bronze/e18-ouro.json', linhasLidas: 1,
  });
  const municipio = (await pool.query(
    `SELECT "Municipio_CodigoIbge" AS c FROM "Municipio" ORDER BY 1 LIMIT 1`)).rows[0].c;
  const r = await promoverObservacoes(pool, {
    indicadorId, fonteId, cargaId: bom, dataReferencia: '2024-12-31',
    linhas: [{ codigo: municipio, valor: 42 }],
  });
  assert.ok(r.gravadas > 0, 'o Ouro precisa ter gravado para o caso fazer sentido');
  assert.equal(r.confirmada, true);
  assert.equal(await statusDe(bom), 'PROMOVIDA');

  // Caso da carga 96 do dev: nada casou com a malha ⇒ zero observações.
  // O status TEM que continuar dizendo a verdade.
  const vazio = await registrarCarga(pool, {
    fonteId, hash: hashDe('e18vazio'), caminhoBronze: 'bronze/e18-vazio.json', linhasLidas: 1,
  });
  const semMalha = await promoverObservacoes(pool, {
    indicadorId, fonteId, cargaId: vazio, dataReferencia: '2024-12-31',
    linhas: [{ codigo: '9999999', valor: 1 }],
  });
  assert.equal(semMalha.gravadas, 0);
  assert.equal(semMalha.confirmada, false);
  assert.equal(await statusDe(vazio), 'CANDIDATA',
    'sem observação gravada a carga NÃO pode ser promovida (defeito da carga 96 do dev)');
});

// ------------------------------------------------------------
// (d) — quarentena idempotente: reexecutar não duplica nem infla
// ------------------------------------------------------------
test('E19: reexecutar a mesma ingestão não duplica linhas de quarentena nem infla o contador', async () => {
  const cargaId = await registrarCarga(pool, {
    // 4 linhas lidas, todas inválidas: o caso extremo da carga 96 do dev
    // (141 lidas, 141 quarentenadas) — que mesmo assim estava PROMOVIDA.
    fonteId, hash: hashDe('e19quar'), caminhoBronze: 'bronze/e19-quar.json', linhasLidas: 4,
  });

  const rodada = async () => {
    await quarentenar(pool, cargaId, { codigo: 'x', valor: '-' }, 'valor indisponível');
    await quarentenar(pool, cargaId, { codigo: 'y', valor: '...' }, 'valor indisponível');
    // registro com barra invertida e quebra de linha: o cast text→bytea da
    // chave lógica explodiria sem o replace() de db/63.
    await quarentenar(pool, cargaId, { caminho: 'C:\\pasta\\x', txt: 'a\nb' }, 'motivo com \\ e\nquebra');
  };

  assert.equal(await quarentenar(pool, cargaId, { codigo: 'z' }, 'primeira'), true,
    'linha nova deve ser reportada como inserida');
  assert.equal(await quarentenar(pool, cargaId, { codigo: 'z' }, 'primeira'), false,
    'repetição do MESMO (carga, registro, motivo) tem que ser no-op');

  await rodada();
  const depoisDaPrimeira = await pool.query(
    `SELECT (SELECT count(*)::int FROM "Quarentena" WHERE "Quarentena_CargaId" = $1) AS linhas,
            (SELECT "Carga_LinhasQuarentena" FROM "Carga" WHERE "Carga_Id" = $1) AS contador,
            (SELECT "Carga_LinhasLidas" FROM "Carga" WHERE "Carga_Id" = $1) AS lidas`, [cargaId]);
  const { linhas, contador, lidas } = depoisDaPrimeira.rows[0];
  assert.equal(linhas, 4, 'quatro registros distintos quarentenados');
  assert.equal(contador, linhas, 'o contador é derivado da tabela, não incrementado pela aplicação');

  await rodada();
  await rodada();
  const depoisDeTres = await pool.query(
    `SELECT (SELECT count(*)::int FROM "Quarentena" WHERE "Quarentena_CargaId" = $1) AS linhas,
            (SELECT "Carga_LinhasQuarentena" FROM "Carga" WHERE "Carga_Id" = $1) AS contador`, [cargaId]);
  assert.equal(depoisDeTres.rows[0].linhas, 4,
    'três rodadas idênticas não podem virar 12 linhas (era o defeito: 2806 para 1512 reais)');
  assert.equal(depoisDeTres.rows[0].contador, 4,
    'o contador não pode inflar com a reexecução');
  assert.ok(depoisDeTres.rows[0].contador <= lidas,
    'LinhasQuarentena > LinhasLidas é aritmeticamente impossível (11 cargas do dev violavam isso)');
});

// ------------------------------------------------------------
// (e) e (f) — os vetos são DE BANCO: provados por SQL direto
// ------------------------------------------------------------
test('db/63: o CHECK rejeita status fora do domínio — por SQL direto', async () => {
  await assert.rejects(
    () => pool.query(
      `INSERT INTO "Carga"
         ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas")
       VALUES ($1, now(), $2, 'bronze/e18-check.json', 'INVENTADO', 1)`,
      [fonteId, hashDe('e18check')],
    ),
    (e) => e.code === '23514' && /Carga_Status_dominio/.test(e.constraint ?? e.message),
    'status fora de (CANDIDATA, PROMOVIDA, BLOQUEADA_DRIFT) tem que ser recusado pelo BANCO',
  );
});

test('db/63: o banco impede duas cargas com o mesmo (fonte, hash) — por SQL direto, sem passar pela aplicação', async () => {
  const hash = hashDe('e18unico');
  await pool.query(
    `INSERT INTO "Carga"
       ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_LinhasLidas")
     VALUES ($1, now(), $2, 'bronze/e18-unico.json', 1)`, [fonteId, hash],
  );
  await assert.rejects(
    () => pool.query(
      `INSERT INTO "Carga"
         ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_LinhasLidas")
       VALUES ($1, now(), $2, 'bronze/e18-unico-bis.json', 1)`, [fonteId, hash],
    ),
    (e) => e.code === '23505',
    'o dedup deixou de ser cortesia da aplicação: é veto de banco (RF-INGEST-006)',
  );

  // Num banco limpo o UNIQUE existe além do trigger. Se ele faltar aqui,
  // alguma migração posterior o derrubou.
  const idx = await pool.query(
    `SELECT 1 FROM pg_indexes WHERE indexname = 'uq_carga_fonte_hash'`);
  assert.equal(idx.rows.length, 1, 'uq_carga_fonte_hash sumiu do banco de teste');
});

test('db/63: a chave lógica da quarentena impede duplicata por SQL direto', async () => {
  const cargaId = await registrarCarga(pool, {
    fonteId, hash: hashDe('e19sql'), caminhoBronze: 'bronze/e19-sql.json', linhasLidas: 1,
  });
  const inserir = () => pool.query(
    `INSERT INTO "Quarentena" ("Quarentena_CargaId","Quarentena_Registro","Quarentena_Motivo")
     VALUES ($1, '{"a":1}'::jsonb, 'motivo')`, [cargaId],
  );
  await inserir();
  await assert.rejects(inserir, (e) => e.code === '23505',
    'sem ON CONFLICT, o banco tem que recusar a cópia — a idempotência não pode depender da aplicação lembrar');
});

// ------------------------------------------------------------
// (g) — o alerta de fonte parada passa a significar alguma coisa
// ------------------------------------------------------------
test('E18: fonte cuja última carga é CANDIDATA não conta como "em dia" no alerta de fonte parada', async () => {
  // Fonte própria, para não interferir no restante da suíte.
  const f = await pool.query(
    `INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade")
     VALUES ($1,'TESTE','https://exemplo.invalid','DADO_ABERTO','CC-BY','DIARIA')
     ON CONFLICT ("Fonte_Nome") DO UPDATE SET "Fonte_Origem" = EXCLUDED."Fonte_Origem"
     RETURNING "Fonte_Id" AS id`, [FONTES[1]]);
  const parada = f.rows[0].id;

  // Baixou HOJE, mas nunca completou o Ouro: é exatamente o caso da carga 96.
  await pool.query(
    `INSERT INTO "Carga"
       ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_LinhasLidas","Carga_Status")
     VALUES ($1, now(), $2, 'bronze/e18-parada.json', 141, 'CANDIDATA')`,
    [parada, hashDe('e18parada')],
  );

  // A MESMA consulta de scripts/alerta-fontes.mjs.
  const { rows } = await pool.query(`
    SELECT max(c."Carga_DataExtracao") FILTER (WHERE c."Carga_Status" = 'PROMOVIDA') AS ultima,
           count(*) FILTER (WHERE c."Carga_Status" <> 'PROMOVIDA') AS nao_confirmadas
      FROM "Fonte" f LEFT JOIN "Carga" c ON c."Carga_FonteId" = f."Fonte_Id"
     WHERE f."Fonte_Id" = $1`, [parada]);

  assert.equal(rows[0].ultima, null,
    'carga CANDIDATA não pode fazer a fonte parecer atualizada — o alerta media o DOWNLOAD, não a carga');
  assert.equal(Number(rows[0].nao_confirmadas), 1, 'o alerta precisa saber que há carga pendente');

  // Confirmada, aí sim entra na conta.
  await pool.query(
    `UPDATE "Carga" SET "Carga_Status" = 'PROMOVIDA' WHERE "Carga_FonteId" = $1`, [parada]);
  const depois = await pool.query(`
    SELECT max(c."Carga_DataExtracao") FILTER (WHERE c."Carga_Status" = 'PROMOVIDA') AS ultima
      FROM "Fonte" f LEFT JOIN "Carga" c ON c."Carga_FonteId" = f."Fonte_Id"
     WHERE f."Fonte_Id" = $1`, [parada]);
  assert.ok(depois.rows[0].ultima, 'carga confirmada tem que voltar a contar');
});

/**
 * Regressão de auditoria: o hash encadeado de auditar() era calculado com
 * `(...)::text::bytea`, cast que lê o texto no formato de ENTRADA de bytea e
 * REJEITA qualquer barra invertida. Um nome de fonte com aspas ou um motivo de
 * quarentena com quebra de linha derrubava a gravação do evento — justamente o
 * caminho que registra a ingestão. O AuditoriaService da API já documentava a
 * cura (convert_to UTF8) desde a correção anterior; ela nunca chegara aqui.
 */
test('E18/RG-10: auditoria da ingestão sobrevive a barra invertida no payload', async () => {
  const payload = { fonte: 'Fonte "X" — TabNet', motivo: 'linha1\nlinha2\fim' };

  const antes = await pool.query(
    `SELECT count(*)::int AS n FROM "EventoAuditoria"`);

  await auditar(pool, 'suite:e18', 'INGESTAO_TESTE', 'Carga', 'e18-barra', payload);

  const depois = await pool.query(
    `SELECT count(*)::int AS n FROM "EventoAuditoria"`);
  assert.equal(depois.rows[0].n, antes.rows[0].n + 1,
    'o evento com barra invertida tem que ser gravado, não engolido por erro de cast');

  // E o elo tem que fechar exatamente como o verificador independente recomputa.
  const { rows } = await pool.query(
    `SELECT "EventoAuditoria_HashAnterior" AS ant,
            "EventoAuditoria_HashAtual"    AS atual,
            encode(sha256(convert_to("EventoAuditoria_HashAnterior"
                   || ("EventoAuditoria_Payload")::text,'UTF8')),'hex') AS recomputado
       FROM "EventoAuditoria" ORDER BY "EventoAuditoria_Id" DESC LIMIT 1`);
  assert.equal(rows[0].atual, rows[0].recomputado,
    'hash gravado tem que bater com a recomputação canônica da cadeia');

  // E o cast antigo, este sim, falha — é a prova de que o teste não é vazio.
  await assert.rejects(
    pool.query(`SELECT sha256((($1::jsonb)::text)::bytea)`, [JSON.stringify(payload)]),
    /bytea/i,
    'o cast antigo precisa continuar falhando, senão esta catraca não prova nada');
});
