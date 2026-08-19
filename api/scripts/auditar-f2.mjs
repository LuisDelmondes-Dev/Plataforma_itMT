import pg from 'pg';
import { existsSync, readFileSync } from 'node:fs';

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? 'postgres://itmt_app:itmt_app@localhost:5432/itmt',
});

await db.connect();
try {
  const consultas = {
    taxonomia: `
      SELECT count(DISTINCT t."TemaConsulta_Id")::int AS temas,
             count(DISTINCT s."SubtemaConsulta_Id")::int AS subtemas,
             count(DISTINCT i."Indicador_Id")::int AS indicadores_total,
             count(DISTINCT i."Indicador_Id") FILTER (WHERE i."Indicador_StatusValidacao"='APROVADO')::int AS indicadores_aprovados
        FROM "TemaConsulta" t
        LEFT JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_TemaId"=t."TemaConsulta_Id"
        LEFT JOIN "Indicador" i ON i."Indicador_SubtemaId"=s."SubtemaConsulta_Id"`,
    cobertura: `
      SELECT count(DISTINCT t."TemaConsulta_Id")::int AS temas_com_dados,
             count(DISTINCT i."Indicador_Id")::int AS indicadores_com_dados,
             count(DISTINCT o."Observacao_CodigoIbge")::int AS municipios_com_dados,
             count(o.*)::int AS observacoes
        FROM "Observacao" o
        JOIN "Indicador" i ON i."Indicador_Id"=o."Observacao_IndicadorId" AND i."Indicador_StatusValidacao"='APROVADO'
        JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_Id"=i."Indicador_SubtemaId"
        JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
        JOIN "Carga" c ON c."Carga_Id"=o."Observacao_CargaId"
        JOIN "Fonte" f ON f."Fonte_Id"=o."Observacao_FonteId"
       WHERE lower(coalesce(f."Fonte_Nome",'')) !~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
         AND lower(coalesce(f."Fonte_Origem",'')) !~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
         AND lower(replace(c."Carga_CaminhoBronze", chr(92), '/')) NOT LIKE '%/demo/%'
         AND c."Carga_CaminhoBronze" NOT LIKE 's3://t/%'`,
    cobertura_tecnica: `
      SELECT count(DISTINCT t."TemaConsulta_Id")::int AS temas_com_dados,
             count(DISTINCT i."Indicador_Id")::int AS indicadores_com_dados,
             count(DISTINCT o."Observacao_CodigoIbge")::int AS municipios_com_dados,
             count(o.*)::int AS observacoes
        FROM "Observacao" o
        JOIN "Indicador" i ON i."Indicador_Id"=o."Observacao_IndicadorId"
        JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_Id"=i."Indicador_SubtemaId"
        JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
        JOIN "Carga" c ON c."Carga_Id"=o."Observacao_CargaId"
        JOIN "Fonte" f ON f."Fonte_Id"=o."Observacao_FonteId"
       WHERE lower(coalesce(f."Fonte_Nome",'')) !~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
         AND lower(coalesce(f."Fonte_Origem",'')) !~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
         AND lower(replace(c."Carga_CaminhoBronze", chr(92), '/')) NOT LIKE '%/demo/%'
         AND c."Carga_CaminhoBronze" NOT LIKE 's3://t/%'`,
    temas: `
      SELECT t."TemaConsulta_Nome" AS tema,
             count(DISTINCT i."Indicador_Id") FILTER (WHERE i."Indicador_StatusValidacao"='APROVADO')::int AS indicadores,
             count(DISTINCT i."Indicador_Id") FILTER (WHERE o."Observacao_Id" IS NOT NULL)::int AS indicadores_com_dados,
             count(DISTINCT o."Observacao_CodigoIbge")::int AS municipios,
             count(o.*)::int AS observacoes
        FROM "TemaConsulta" t
        LEFT JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_TemaId"=t."TemaConsulta_Id"
        LEFT JOIN "Indicador" i ON i."Indicador_SubtemaId"=s."SubtemaConsulta_Id" AND i."Indicador_StatusValidacao"='APROVADO'
        LEFT JOIN "Observacao" o ON o."Observacao_IndicadorId"=i."Indicador_Id"
       GROUP BY 1 ORDER BY min(t."TemaConsulta_Ordem")`,
    cargas: `
      SELECT c."Carga_Status" AS status, count(*)::int AS total,
             sum(c."Carga_LinhasLidas")::int AS lidas,
             sum(c."Carga_LinhasQuarentena")::int AS quarentena
        FROM "Carga" c GROUP BY 1 ORDER BY 1`,
    documentos: `
      SELECT
        count(DISTINCT v."DocumentoVersao_Id") FILTER (WHERE v."DocumentoVersao_StatusSeguranca"='LIMPO')::int AS versoes_limpas,
        count(DISTINCT t."DocumentoTrecho_Id")::int AS trechos,
        count(DISTINCT e."DocumentoEmbedding_TrechoId")::int AS embeddings
      FROM "DocumentoVersao" v
      LEFT JOIN "DocumentoTrecho" t ON t."DocumentoTrecho_VersaoId"=v."DocumentoVersao_Id"
      LEFT JOIN "DocumentoEmbedding" e ON e."DocumentoEmbedding_TrechoId"=t."DocumentoTrecho_Id"`,
  };
  const resultado = {};
  for (const [nome, sql] of Object.entries(consultas)) resultado[nome] = (await db.query(sql)).rows;
  const avaliacaoPath = process.env.F2_AVALIACAO_DOCUMENTAL ?? 'evaluation/f2/resultado-homologado.json';
  let avaliacao = null;
  if (existsSync(avaliacaoPath)) {
    try { avaliacao = JSON.parse(readFileSync(avaliacaoPath, 'utf8')); } catch { avaliacao = { aprovado: false, erro: 'JSON inválido' }; }
  }
  const tecnico = resultado.cobertura_tecnica[0];
  resultado.gate = {
    dados_tecnicos: tecnico.temas_com_dados >= 8 && tecnico.indicadores_com_dados >= 50,
    dados_publicados: resultado.cobertura[0].temas_com_dados >= 8 && resultado.cobertura[0].indicadores_com_dados >= 50,
    ocr_rag_avaliados: avaliacao?.aprovado === true,
    responsavel_nominal: Boolean(process.env.F2_RESPONSAVEL_NOMINAL),
    operacao_homologada: process.env.F2_OPERACAO_HOMOLOGADA === '1',
    avaliacao_documental: avaliacao,
  };
  console.log(JSON.stringify(resultado, null, 2));
  if (process.argv.includes('--gate')) {
    const g = resultado.gate;
    process.exitCode = g.dados_tecnicos && g.dados_publicados && g.ocr_rag_avaliados &&
      g.responsavel_nominal && g.operacao_homologada ? 0 : 1;
  }
} finally {
  await db.end();
}
