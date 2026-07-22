-- ============================================================
-- 05-seed-f3.sql — DEMONSTRATIVO (F3). Caminhos e produtos são
-- FICTÍCIOS; em produção, tudo nasce dos fluxos GEO/CAMPO/MTIMAGENS
-- com os vetos de banco ativos.
--
-- IDEMPOTENTE (RF-INGEST-006): todo INSERT é guardado por WHERE NOT
-- EXISTS sobre a chave natural, e as FKs são resolvidas por subconsulta
-- (nunca por id posicional fixo). Reexecutar este arquivo — inclusive
-- junto de `npm run migrar` — não duplica nada.
-- ============================================================

-- O seed F3 referencia Nova Mutum, que não está no seed demo F1.
-- Garante a linha aqui; a carga canônica do IBGE (ingest:territorio)
-- corrige/completa por upsert idempotente (RF-INGEST-006).
INSERT INTO "Municipio"
 ("Municipio_CodigoIbge","Municipio_Nome","Municipio_CodigoRgi","Municipio_CodigoRgint")
VALUES ('5106422','Nova Mutum','510202','5102')
ON CONFLICT DO NOTHING;

-- Projeto de levantamento (Cuiabá) — guarda pela autorização de voo.
INSERT INTO "ProjetoLevantamento"
 ("ProjetoLevantamento_CodigoIbge","ProjetoLevantamento_NumeroAutorizacaoCadastro",
  "ProjetoLevantamento_NumeroAutorizacaoVoo","ProjetoLevantamento_ResponsavelTecnico",
  "ProjetoLevantamento_RegistroProfissional","ProjetoLevantamento_DataVoo",
  "ProjetoLevantamento_Sensor","ProjetoLevantamento_AlturaVooM","ProjetoLevantamento_GsdCm",
  "ProjetoLevantamento_AcuraciaDeclarada")
SELECT '5103403','SISANT-DEMO-0001','SARPAS-DEMO-0001','Resp. Técnico (demo)','CREA-MT 00000-D',
       '2026-05-10','RGB 45MP (demo)',120,2.5,'PEC-PCD Classe A (demo)'
WHERE NOT EXISTS (
  SELECT 1 FROM "ProjetoLevantamento"
   WHERE "ProjetoLevantamento_NumeroAutorizacaoVoo" = 'SARPAS-DEMO-0001');

-- Produtos do projeto — FK resolvida pela autorização de voo; guarda por (projeto, tipo).
INSERT INTO "ProdutoGeografico"
 ("ProdutoGeografico_ProjetoId","ProdutoGeografico_Tipo","ProdutoGeografico_CaminhoObjeto",
  "ProdutoGeografico_FormatoDownload","ProdutoGeografico_Classificacao","ProdutoGeografico_StatusPublicacao")
SELECT p.id, v.tipo, v.caminho, v.formato, 'PUBLICO', 'PUBLICADO'
  FROM (SELECT "ProjetoLevantamento_Id" AS id FROM "ProjetoLevantamento"
         WHERE "ProjetoLevantamento_NumeroAutorizacaoVoo" = 'SARPAS-DEMO-0001') p
 CROSS JOIN (VALUES
   ('ORTOMOSAICO','s3://itmt-geo/demo/cuiaba/orto.tif','GeoTIFF'),
   ('MDS','s3://itmt-geo/demo/cuiaba/mds.tif','GeoTIFF'),
   ('MDT','s3://itmt-geo/demo/cuiaba/mdt.tif','GeoTIFF'),
   ('CURVA_NIVEL','s3://itmt-geo/demo/cuiaba/curvas.gpkg','GeoPackage')
 ) AS v(tipo, caminho, formato)
 WHERE NOT EXISTS (
   SELECT 1 FROM "ProdutoGeografico" pg
    WHERE pg."ProdutoGeografico_ProjetoId" = p.id
      AND pg."ProdutoGeografico_Tipo" = v.tipo);

-- Capturas de imagem de rua — guarda pelo caminho do acervo próprio (cópia soberana).
INSERT INTO "CapturaImagemRua"
 ("CapturaImagemRua_CodigoIbge","CapturaImagemRua_Origem","CapturaImagemRua_DataCaptura",
  "CapturaImagemRua_KmPercorridos","CapturaImagemRua_CaminhoAcervoProprio","CapturaImagemRua_StatusPublicacao")
SELECT v.codigo_ibge, v.origem, v.data_captura::date, v.km, v.caminho, v.status
  FROM (VALUES
   ('5103403','PREEXISTENTE',NULL,           NULL,  's3://itmt-360/registro/cuiaba-preexistente','PENDENTE'),
   ('5107909','ITMT',        '2026-06-02',   184.5, 's3://itmt-360/demo/sinop',                  'PUBLICADO'),
   ('5106422','ITMT',        '2026-06-20',   96.0,  's3://itmt-360/demo/nova-mutum',             'PUBLICADO')
 ) AS v(codigo_ibge, origem, data_captura, km, caminho, status)
 WHERE NOT EXISTS (
   SELECT 1 FROM "CapturaImagemRua" c
    WHERE c."CapturaImagemRua_CaminhoAcervoProprio" = v.caminho);

-- Projetos estruturantes — guarda pelo nome.
INSERT INTO "ProjetoEstruturante"
 ("ProjetoEstruturante_CodigoIbge","ProjetoEstruturante_Tipo","ProjetoEstruturante_Nome",
  "ProjetoEstruturante_Latitude","ProjetoEstruturante_Longitude","ProjetoEstruturante_Descricao")
SELECT v.codigo_ibge, v.tipo, v.nome, v.lat, v.lon, v.descricao
  FROM (VALUES
   ('5107925','ARMAZENAGEM','Complexo de armazenagem de grãos (demo)',-12.55,-55.72,'Capacidade demo.'),
   ('5107909','TERMINAL',   'Terminal intermodal Norte (demo)',      -11.86,-55.50,'Ferrogrão demo.')
 ) AS v(codigo_ibge, tipo, nome, lat, lon, descricao)
 WHERE NOT EXISTS (
   SELECT 1 FROM "ProjetoEstruturante" e
    WHERE e."ProjetoEstruturante_Nome" = v.nome);

-- Termo de consentimento — guarda pelo hash.
INSERT INTO "TermoConsentimento"
 ("TermoConsentimento_TitularNome","TermoConsentimento_TipoTermo","TermoConsentimento_DataAssinatura",
  "TermoConsentimento_CaminhoDocumento","TermoConsentimento_HashSha256")
SELECT 'Entrevistado (demo)','IMAGEM_VOZ','2026-06-01','s3://itmt-termos/demo/termo-001.pdf',
       encode(sha256('termo-demo-001'::bytea),'hex')
WHERE NOT EXISTS (
  SELECT 1 FROM "TermoConsentimento"
   WHERE "TermoConsentimento_HashSha256" = encode(sha256('termo-demo-001'::bytea),'hex'));

-- Ativos de mídia — FK do termo resolvida pelo hash; guarda por caminho do objeto.
INSERT INTO "AtivoMidia"
 ("AtivoMidia_CodigoIbge","AtivoMidia_Tipo","AtivoMidia_Titulo","AtivoMidia_Autor","AtivoMidia_Licenca",
  "AtivoMidia_CaminhoObjeto","AtivoMidia_ViaPublica","AtivoMidia_TemPessoaIdentificavel",
  "AtivoMidia_TermoConsentimentoId","AtivoMidia_AnonimizacaoAplicada","AtivoMidia_StatusModeracao",
  "AtivoMidia_DuracaoMin","AtivoMidia_CaminhoLegenda","AtivoMidia_CaminhoTranscricao",
  "AtivoMidia_StatusPublicacao","AtivoMidia_Tags")
SELECT v.codigo_ibge, v.tipo, v.titulo, v.autor, v.licenca, v.caminho, v.via_publica,
       v.tem_pessoa,
       CASE WHEN v.usa_termo THEN (SELECT "TermoConsentimento_Id" FROM "TermoConsentimento"
              WHERE "TermoConsentimento_HashSha256" = encode(sha256('termo-demo-001'::bytea),'hex')) END,
       v.anon, v.moderacao, v.duracao, v.legenda, v.transcricao, v.status, v.tags
  FROM (VALUES
   ('5103403','FOTO','Centro histórico ao amanhecer (demo)','Equipe ITMT','CC BY 4.0',
    's3://itmt-img/demo/cuiaba-centro.jpg',true,false,false,true,'APROVADO',
    NULL::int,NULL::text,NULL::text,'PUBLICADO','centro,historico'),
   ('5107909','VIDEO','Sinop — portfólio institucional (demo)','Equipe ITMT','CC BY 4.0',
    's3://itmt-video/demo/sinop.mp4',false,true,true,false,'APROVADO',
    18,'s3://itmt-video/demo/sinop.vtt','s3://itmt-video/demo/sinop.txt','PUBLICADO','institucional')
 ) AS v(codigo_ibge, tipo, titulo, autor, licenca, caminho, via_publica, tem_pessoa, usa_termo,
        anon, moderacao, duracao, legenda, transcricao, status, tags)
 WHERE NOT EXISTS (
   SELECT 1 FROM "AtivoMidia" a
    WHERE a."AtivoMidia_CaminhoObjeto" = v.caminho);

-- Autorização vigente — guarda pelo número.
INSERT INTO "Autorizacao"
 ("Autorizacao_Tipo","Autorizacao_Numero","Autorizacao_Orgao","Autorizacao_Descricao",
  "Autorizacao_VigenciaInicio","Autorizacao_VigenciaFim")
SELECT 'AUTORIZACAO_VOO','SARPAS-DEMO-0002','DECEA (demo)','Janela de voo demo','2026-01-01','2027-12-31'
WHERE NOT EXISTS (
  SELECT 1 FROM "Autorizacao" WHERE "Autorizacao_Numero" = 'SARPAS-DEMO-0002');

-- Missão de campo (GEO / Nova Mutum) — guarda por (município, frente, janela).
INSERT INTO "MissaoCampo"
 ("MissaoCampo_CodigoIbge","MissaoCampo_Frente","MissaoCampo_ProdutoEsperado","MissaoCampo_Equipe",
  "MissaoCampo_JanelaInicio","MissaoCampo_JanelaFim")
SELECT '5106422','GEO','Ortomosaico + MDS + MDT da sede','Equipe VANT 1 (demo)','2026-07-15','2026-07-25'
WHERE NOT EXISTS (
  SELECT 1 FROM "MissaoCampo"
   WHERE "MissaoCampo_CodigoIbge" = '5106422' AND "MissaoCampo_Frente" = 'GEO'
     AND "MissaoCampo_JanelaInicio" = '2026-07-15');

-- Vínculo missão↔autorização — resolvido por chave natural, guardado por NOT EXISTS.
INSERT INTO "MissaoAutorizacao" ("MissaoAutorizacao_MissaoId","MissaoAutorizacao_AutorizacaoId")
SELECT mi."MissaoCampo_Id", a."Autorizacao_Id"
  FROM "MissaoCampo" mi, "Autorizacao" a
 WHERE mi."MissaoCampo_CodigoIbge" = '5106422' AND mi."MissaoCampo_Frente" = 'GEO'
   AND mi."MissaoCampo_JanelaInicio" = '2026-07-15'
   AND a."Autorizacao_Numero" = 'SARPAS-DEMO-0002'
   AND NOT EXISTS (
     SELECT 1 FROM "MissaoAutorizacao" ma
      WHERE ma."MissaoAutorizacao_MissaoId" = mi."MissaoCampo_Id"
        AND ma."MissaoAutorizacao_AutorizacaoId" = a."Autorizacao_Id");
