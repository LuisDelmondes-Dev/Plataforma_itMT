import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const arg = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : null;
};
const ids = String(arg('cargas') ?? '').split(',').map(Number).filter(Number.isInteger);
const destino = arg('saida');
if (!ids.length || !destino) throw new Error('uso: --cargas 103,104 --saida ../db/42-arquivo.sql');

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? 'postgres://itmt:itmt@localhost:5432/itmt',
});
await db.connect();

const sqlLiteral = (valor) => valor == null ? 'NULL' : `'${String(valor).replaceAll("'", "''")}'`;
const numero = (valor) => {
  const texto = String(valor);
  if (!/^-?\d+(?:\.\d+)?$/.test(texto)) throw new Error(`valor numérico inválido: ${texto}`);
  return texto;
};

try {
  const { rows: cargas } = await db.query(`
    SELECT c.*, f.* FROM "Carga" c JOIN "Fonte" f ON f."Fonte_Id"=c."Carga_FonteId"
    WHERE c."Carga_Id"=ANY($1::int[]) ORDER BY c."Carga_Id"`, [ids]);
  if (cargas.length !== ids.length) throw new Error(`esperadas ${ids.length} cargas; encontradas ${cargas.length}`);

  const { rows: indicadores } = await db.query(`
    SELECT DISTINCT i."Indicador_Nome" nome, i."Indicador_Unidade" unidade,
      i."Indicador_TipoAgregacao" tipo, i."Indicador_MetodologiaUrl" metodologia,
      i."Indicador_StatusValidacao" status, s."SubtemaConsulta_Nome" subtema,
      s."SubtemaConsulta_Status" subtema_status, t."TemaConsulta_Nome" tema
    FROM "Observacao" o
    JOIN "Indicador" i ON i."Indicador_Id"=o."Observacao_IndicadorId"
    JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_Id"=i."Indicador_SubtemaId"
    JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
    WHERE o."Observacao_CargaId"=ANY($1::int[]) ORDER BY tema,subtema,nome`, [ids]);

  const { rows: observacoes } = await db.query(`
    SELECT i."Indicador_Nome" indicador, t."TemaConsulta_Nome" tema,
      s."SubtemaConsulta_Nome" subtema, o."Observacao_CodigoIbge" codigo,
      o."Observacao_DataReferencia"::text referencia, o."Observacao_Valor"::text valor,
      f."Fonte_Nome" fonte, c."Carga_HashSha256" hash
    FROM "Observacao" o
    JOIN "Indicador" i ON i."Indicador_Id"=o."Observacao_IndicadorId"
    JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_Id"=i."Indicador_SubtemaId"
    JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
    JOIN "Fonte" f ON f."Fonte_Id"=o."Observacao_FonteId"
    JOIN "Carga" c ON c."Carga_Id"=o."Observacao_CargaId"
    WHERE o."Observacao_CargaId"=ANY($1::int[])
    ORDER BY fonte,indicador,referencia,codigo`, [ids]);

  const partes = [
    `-- Snapshot oficial gerado de cargas auditadas; não contém usuários, tokens ou eventos privados.`,
    `-- Cargas locais de origem: ${ids.join(', ')}. Observações: ${observacoes.length}.`,
  ];

  for (const f of cargas) {
    partes.push(`
INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade","Fonte_VigenciaInicio","Fonte_VigenciaFim")
VALUES (${sqlLiteral(f.Fonte_Nome)},${sqlLiteral(f.Fonte_Origem)},${sqlLiteral(f.Fonte_Url)},${sqlLiteral(f.Fonte_BaseLegal)},${sqlLiteral(f.Fonte_Licenca)},${sqlLiteral(f.Fonte_Periodicidade)},${sqlLiteral(f.Fonte_VigenciaInicio?.toISOString?.().slice(0, 10))},${sqlLiteral(f.Fonte_VigenciaFim?.toISOString?.().slice(0, 10))})
ON CONFLICT ("Fonte_Nome") DO UPDATE SET
  "Fonte_Origem"=EXCLUDED."Fonte_Origem", "Fonte_Url"=EXCLUDED."Fonte_Url",
  "Fonte_BaseLegal"=EXCLUDED."Fonte_BaseLegal", "Fonte_Licenca"=EXCLUDED."Fonte_Licenca",
  "Fonte_Periodicidade"=EXCLUDED."Fonte_Periodicidade";`);
  }

  for (const i of indicadores) {
    partes.push(`
INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status")
SELECT t."TemaConsulta_Id",${sqlLiteral(i.subtema)},${sqlLiteral(i.subtema_status)}
FROM "TemaConsulta" t WHERE t."TemaConsulta_Nome"=${sqlLiteral(i.tema)}
  AND NOT EXISTS (SELECT 1 FROM "SubtemaConsulta" s WHERE s."SubtemaConsulta_TemaId"=t."TemaConsulta_Id" AND s."SubtemaConsulta_Nome"=${sqlLiteral(i.subtema)});
INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_MetodologiaUrl","Indicador_StatusValidacao")
SELECT s."SubtemaConsulta_Id",${sqlLiteral(i.nome)},${sqlLiteral(i.unidade)},${sqlLiteral(i.tipo)},${sqlLiteral(i.metodologia)},${sqlLiteral(i.status)}
FROM "SubtemaConsulta" s JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
WHERE t."TemaConsulta_Nome"=${sqlLiteral(i.tema)} AND s."SubtemaConsulta_Nome"=${sqlLiteral(i.subtema)}
  AND NOT EXISTS (SELECT 1 FROM "Indicador" existente WHERE existente."Indicador_Nome"=${sqlLiteral(i.nome)});`);
  }

  for (const c of cargas) {
    const extraida = new Date(c.Carga_DataExtracao).toISOString();
    partes.push(`
INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas","Carga_LinhasQuarentena")
SELECT f."Fonte_Id",${sqlLiteral(extraida)},${sqlLiteral(c.Carga_HashSha256)},${sqlLiteral(`snapshot://sha256/${c.Carga_HashSha256}`)},${sqlLiteral(c.Carga_Status)},${numero(c.Carga_LinhasLidas ?? 0)},${numero(c.Carga_LinhasQuarentena ?? 0)}
FROM "Fonte" f WHERE f."Fonte_Nome"=${sqlLiteral(c.Fonte_Nome)}
  AND NOT EXISTS (SELECT 1 FROM "Carga" x WHERE x."Carga_FonteId"=f."Fonte_Id" AND x."Carga_HashSha256"=${sqlLiteral(c.Carga_HashSha256)});`);
  }

  for (let inicio = 0; inicio < observacoes.length; inicio += 250) {
    const lote = observacoes.slice(inicio, inicio + 250);
    const valores = lote.map((o) => `(${sqlLiteral(o.indicador)},${sqlLiteral(o.tema)},${sqlLiteral(o.subtema)},${sqlLiteral(o.codigo)},${sqlLiteral(o.referencia)},${numero(o.valor)},${sqlLiteral(o.fonte)},${sqlLiteral(o.hash)})`).join(',\n    ');
    partes.push(`
WITH dados(indicador,tema,subtema,codigo,referencia,valor,fonte,hash) AS (
  VALUES ${valores}
), resolvidos AS (
  SELECT i."Indicador_Id" indicador_id,d.codigo,d.referencia::date referencia,d.valor,
    f."Fonte_Id" fonte_id,c."Carga_Id" carga_id
  FROM dados d
  JOIN "TemaConsulta" t ON t."TemaConsulta_Nome"=d.tema
  JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_TemaId"=t."TemaConsulta_Id" AND s."SubtemaConsulta_Nome"=d.subtema
  JOIN "Indicador" i ON i."Indicador_SubtemaId"=s."SubtemaConsulta_Id" AND i."Indicador_Nome"=d.indicador
  JOIN "Fonte" f ON f."Fonte_Nome"=d.fonte
  JOIN "Carga" c ON c."Carga_FonteId"=f."Fonte_Id" AND c."Carga_HashSha256"=d.hash
  JOIN "Municipio" m ON m."Municipio_CodigoIbge"=d.codigo
)
INSERT INTO "Observacao" ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
SELECT indicador_id,codigo,referencia,valor,fonte_id,carga_id FROM resolvidos
ON CONFLICT ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_FonteId")
DO UPDATE SET "Observacao_Valor"=EXCLUDED."Observacao_Valor", "Observacao_CargaId"=EXCLUDED."Observacao_CargaId";`);
  }
  partes.push('');
  const caminho = resolve(process.cwd(), destino);
  writeFileSync(caminho, partes.join('\n'), 'utf8');
  console.log(`${caminho}: ${cargas.length} carga(s), ${indicadores.length} indicador(es), ${observacoes.length} observação(ões).`);
} finally {
  await db.end();
}
