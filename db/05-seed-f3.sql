-- ============================================================
-- 05-seed-f3.sql — DEMONSTRATIVO (F3). Caminhos e produtos são
-- FICTÍCIOS; em produção, tudo nasce dos fluxos GEO/CAMPO/MTIMAGENS
-- com os vetos de banco ativos.
-- ============================================================

INSERT INTO "ProjetoLevantamento"
 ("ProjetoLevantamento_CodigoIbge","ProjetoLevantamento_NumeroAutorizacaoCadastro",
  "ProjetoLevantamento_NumeroAutorizacaoVoo","ProjetoLevantamento_ResponsavelTecnico",
  "ProjetoLevantamento_RegistroProfissional","ProjetoLevantamento_DataVoo",
  "ProjetoLevantamento_Sensor","ProjetoLevantamento_AlturaVooM","ProjetoLevantamento_GsdCm",
  "ProjetoLevantamento_AcuraciaDeclarada")
VALUES ('5103403','SISANT-DEMO-0001','SARPAS-DEMO-0001','Resp. Técnico (demo)','CREA-MT 00000-D',
        '2026-05-10','RGB 45MP (demo)',120,2.5,'PEC-PCD Classe A (demo)')
ON CONFLICT DO NOTHING;

INSERT INTO "ProdutoGeografico"
 ("ProdutoGeografico_ProjetoId","ProdutoGeografico_Tipo","ProdutoGeografico_CaminhoObjeto",
  "ProdutoGeografico_FormatoDownload","ProdutoGeografico_Classificacao","ProdutoGeografico_StatusPublicacao")
VALUES
 (1,'ORTOMOSAICO','s3://itmt-geo/demo/cuiaba/orto.tif','GeoTIFF','PUBLICO','PUBLICADO'),
 (1,'MDS','s3://itmt-geo/demo/cuiaba/mds.tif','GeoTIFF','PUBLICO','PUBLICADO'),
 (1,'MDT','s3://itmt-geo/demo/cuiaba/mdt.tif','GeoTIFF','PUBLICO','PUBLICADO'),
 (1,'CURVA_NIVEL','s3://itmt-geo/demo/cuiaba/curvas.gpkg','GeoPackage','PUBLICO','PUBLICADO')
ON CONFLICT DO NOTHING;

INSERT INTO "CapturaImagemRua"
 ("CapturaImagemRua_CodigoIbge","CapturaImagemRua_Origem","CapturaImagemRua_DataCaptura",
  "CapturaImagemRua_KmPercorridos","CapturaImagemRua_CaminhoAcervoProprio","CapturaImagemRua_StatusPublicacao")
VALUES
 ('5103403','PREEXISTENTE',NULL,NULL,'s3://itmt-360/registro/cuiaba-preexistente','PENDENTE'),
 ('5107909','ITMT','2026-06-02',184.5,'s3://itmt-360/demo/sinop','PUBLICADO'),
 ('5106422','ITMT','2026-06-20',96.0,'s3://itmt-360/demo/nova-mutum','PUBLICADO');

INSERT INTO "ProjetoEstruturante"
 ("ProjetoEstruturante_CodigoIbge","ProjetoEstruturante_Tipo","ProjetoEstruturante_Nome",
  "ProjetoEstruturante_Latitude","ProjetoEstruturante_Longitude","ProjetoEstruturante_Descricao")
VALUES
 ('5107925','ARMAZENAGEM','Complexo de armazenagem de grãos (demo)',-12.55,-55.72,'Capacidade demo.'),
 ('5107909','TERMINAL','Terminal intermodal Norte (demo)',-11.86,-55.50,'Ferrogrão demo.');

INSERT INTO "TermoConsentimento"
 ("TermoConsentimento_TitularNome","TermoConsentimento_TipoTermo","TermoConsentimento_DataAssinatura",
  "TermoConsentimento_CaminhoDocumento","TermoConsentimento_HashSha256")
VALUES ('Entrevistado (demo)','IMAGEM_VOZ','2026-06-01','s3://itmt-termos/demo/termo-001.pdf',
        encode(sha256('termo-demo-001'::bytea),'hex'));

INSERT INTO "AtivoMidia"
 ("AtivoMidia_CodigoIbge","AtivoMidia_Tipo","AtivoMidia_Titulo","AtivoMidia_Autor","AtivoMidia_Licenca",
  "AtivoMidia_CaminhoObjeto","AtivoMidia_ViaPublica","AtivoMidia_TemPessoaIdentificavel",
  "AtivoMidia_TermoConsentimentoId","AtivoMidia_AnonimizacaoAplicada","AtivoMidia_StatusModeracao",
  "AtivoMidia_DuracaoMin","AtivoMidia_CaminhoLegenda","AtivoMidia_CaminhoTranscricao",
  "AtivoMidia_StatusPublicacao","AtivoMidia_Tags")
VALUES
 ('5103403','FOTO','Centro histórico ao amanhecer (demo)','Equipe ITMT','CC BY 4.0',
  's3://itmt-img/demo/cuiaba-centro.jpg',true,false,NULL,true,'APROVADO',NULL,NULL,NULL,'PUBLICADO','centro,historico'),
 ('5107909','VIDEO','Sinop — portfólio institucional (demo)','Equipe ITMT','CC BY 4.0',
  's3://itmt-video/demo/sinop.mp4',false,true,1,false,'APROVADO',18,
  's3://itmt-video/demo/sinop.vtt','s3://itmt-video/demo/sinop.txt','PUBLICADO','institucional');

-- Autorização vigente + missão de campo demo (GEO / Nova Mutum)
INSERT INTO "Autorizacao"
 ("Autorizacao_Tipo","Autorizacao_Numero","Autorizacao_Orgao","Autorizacao_Descricao",
  "Autorizacao_VigenciaInicio","Autorizacao_VigenciaFim")
VALUES ('AUTORIZACAO_VOO','SARPAS-DEMO-0002','DECEA (demo)','Janela de voo demo','2026-01-01','2027-12-31');

INSERT INTO "MissaoCampo"
 ("MissaoCampo_CodigoIbge","MissaoCampo_Frente","MissaoCampo_ProdutoEsperado","MissaoCampo_Equipe",
  "MissaoCampo_JanelaInicio","MissaoCampo_JanelaFim")
VALUES ('5106422','GEO','Ortomosaico + MDS + MDT da sede','Equipe VANT 1 (demo)','2026-07-15','2026-07-25');

INSERT INTO "MissaoAutorizacao"
SELECT max("MissaoCampo_Id"), max("Autorizacao_Id")
  FROM "MissaoCampo", "Autorizacao" WHERE "Autorizacao_Numero"='SARPAS-DEMO-0002';
