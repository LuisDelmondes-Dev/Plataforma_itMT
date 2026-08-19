-- Contrato de leitura uniforme para ativos GIS, audiovisuais e de campo.
-- security_invoker preserva as políticas RLS das tabelas de origem.
CREATE OR REPLACE VIEW "AtivoMapeamento" WITH (security_invoker=true) AS
SELECT
  p."ProdutoGeografico_TenantId" AS "Ativo_TenantId",
  p."ProdutoGeografico_OrganizacaoId" AS "Ativo_OrganizacaoId",
  'PRODUTO_GEO'::text AS "Ativo_Dominio", p."ProdutoGeografico_Id"::text AS "Ativo_Id",
  p."ProdutoGeografico_Tipo" AS "Ativo_Tipo", pl."ProjetoLevantamento_CodigoIbge" AS "Ativo_CodigoIbge",
  CASE WHEN p."ProdutoGeografico_StatusPublicacao"='PUBLICADO' THEN 'PUBLISHED' ELSE 'VALIDATING' END AS "Ativo_Lifecycle",
  pl."ProjetoLevantamento_DataVoo"::timestamptz AS "Ativo_Data",
  pl."ProjetoLevantamento_ResponsavelTecnico" AS "Ativo_Origem",
  NULL::text AS "Ativo_Licenca", p."ProdutoGeografico_CaminhoObjeto" AS "Ativo_ObjectKey",
  p."ProdutoGeografico_HashSha256"::text AS "Ativo_HashSha256", '1'::text AS "Ativo_Versao",
  jsonb_build_object('gsd_cm',pl."ProjetoLevantamento_GsdCm",'acuracia',pl."ProjetoLevantamento_AcuraciaDeclarada",'crs',pl."ProjetoLevantamento_SistemaReferencia") AS "Ativo_Qualidade",
  jsonb_build_object('codigo_ibge',pl."ProjetoLevantamento_CodigoIbge",'bounds_wgs84',p."ProdutoGeografico_BoundsWgs84") AS "Ativo_Cobertura",
  jsonb_build_object('classificacao',p."ProdutoGeografico_Classificacao",'formato',p."ProdutoGeografico_FormatoDownload") AS "Ativo_Processamento"
FROM "ProdutoGeografico" p JOIN "ProjetoLevantamento" pl ON pl."ProjetoLevantamento_Id"=p."ProdutoGeografico_ProjetoId"
UNION ALL
SELECT
  a."AtivoMidia_TenantId", a."AtivoMidia_OrganizacaoId", 'MIDIA', a."AtivoMidia_Id"::text,
  a."AtivoMidia_Tipo", a."AtivoMidia_CodigoIbge",
  CASE WHEN a."AtivoMidia_StatusPublicacao"='PUBLICADO' THEN 'PUBLISHED'
       WHEN a."AtivoMidia_StatusModeracao"='REJEITADO' THEN 'UNAVAILABLE'
       WHEN a."AtivoMidia_StatusModeracao"='APROVADO' THEN 'VALIDATING' ELSE 'PROCESSING' END,
  NULL::timestamptz, a."AtivoMidia_Autor", a."AtivoMidia_Licenca", a."AtivoMidia_CaminhoObjeto",
  NULL::text, '1',
  jsonb_build_object('anonimizacao',a."AtivoMidia_AnonimizacaoAplicada",'moderacao',a."AtivoMidia_StatusModeracao"),
  jsonb_build_object('codigo_ibge',a."AtivoMidia_CodigoIbge"),
  jsonb_build_object('legenda',a."AtivoMidia_CaminhoLegenda",'transcricao',a."AtivoMidia_CaminhoTranscricao")
FROM "AtivoMidia" a
UNION ALL
SELECT
  c."CapturaImagemRua_TenantId", c."CapturaImagemRua_OrganizacaoId", 'IMAGEM_RUA', c."CapturaImagemRua_Id"::text,
  'IMAGEM_360', c."CapturaImagemRua_CodigoIbge",
  CASE WHEN c."CapturaImagemRua_StatusPublicacao"='PUBLICADO' THEN 'PUBLISHED' ELSE 'PROCESSING' END,
  c."CapturaImagemRua_DataCaptura"::timestamptz, c."CapturaImagemRua_Origem", NULL::text,
  c."CapturaImagemRua_CaminhoAcervoProprio", NULL::text, '1',
  jsonb_build_object('km_percorridos',c."CapturaImagemRua_KmPercorridos"),
  jsonb_build_object('codigo_ibge',c."CapturaImagemRua_CodigoIbge"),
  jsonb_build_object('colecao_externa',c."CapturaImagemRua_IdColecaoExterna")
FROM "CapturaImagemRua" c
UNION ALL
SELECT
  c."CapturaCampo_TenantId", c."CapturaCampo_OrganizacaoId", 'CAPTURA_CAMPO', c."CapturaCampo_Id"::text,
  coalesce(c."CapturaCampo_Sensor",m."MissaoCampo_Frente"), m."MissaoCampo_CodigoIbge",
  CASE m."MissaoCampo_StatusExecucao" WHEN 'PLANEJADA' THEN 'PLANNED' WHEN 'EM_CAMPO' THEN 'IN_FIELD'
    WHEN 'EXECUTADA' THEN 'PROCESSING' ELSE 'UNAVAILABLE' END,
  c."CapturaCampo_CapturadoEm", c."CapturaCampo_Operador", NULL::text, c."CapturaCampo_CaminhoObjeto",
  c."CapturaCampo_PayloadHash"::text, c."CapturaCampo_FormularioVersao",
  jsonb_build_object('checklist_ok',c."CapturaCampo_ChecklistOk",'gnss',c."CapturaCampo_Gnss"),
  jsonb_build_object('codigo_ibge',m."MissaoCampo_CodigoIbge",'poligono',m."MissaoCampo_PoligonoGeoJson"),
  jsonb_build_object('sincronizado_em',c."CapturaCampo_SincronizadoEm",'exif',c."CapturaCampo_Exif")
FROM "CapturaCampo" c JOIN "MissaoCampo" m ON m."MissaoCampo_Id"=c."CapturaCampo_MissaoId";

REVOKE ALL ON "AtivoMapeamento" FROM PUBLIC, itmt_app;
GRANT SELECT ON "AtivoMapeamento" TO itmt_app;
COMMENT ON VIEW "AtivoMapeamento" IS 'F5-R018/R019: contrato uniforme e lifecycle oficial derivado, preservando RLS das origens.';
