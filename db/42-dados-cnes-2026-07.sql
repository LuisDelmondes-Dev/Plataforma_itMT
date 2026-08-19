-- Snapshot oficial gerado de cargas auditadas; não contém usuários, tokens ou eventos privados.
-- Cargas locais de origem: 103, 104, 105. Observações: 299.

INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade","Fonte_VigenciaInicio","Fonte_VigenciaFim")
VALUES ('CNES/DATASUS — Leitos de internação existentes (TabNet)','Ministério da Saúde — Cadastro Nacional de Estabelecimentos de Saúde','http://tabnet.datasus.gov.br/cgi/deftohtm.exe?cnes/cnv/leiintmt.def','DADO_ABERTO','Informações de Saúde — DATASUS (Lei 12.527/2011)','MENSAL',NULL,NULL)
ON CONFLICT ("Fonte_Nome") DO UPDATE SET
  "Fonte_Origem"=EXCLUDED."Fonte_Origem", "Fonte_Url"=EXCLUDED."Fonte_Url",
  "Fonte_BaseLegal"=EXCLUDED."Fonte_BaseLegal", "Fonte_Licenca"=EXCLUDED."Fonte_Licenca",
  "Fonte_Periodicidade"=EXCLUDED."Fonte_Periodicidade";

INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade","Fonte_VigenciaInicio","Fonte_VigenciaFim")
VALUES ('CNES/DATASUS — Estabelecimentos de saúde ativos','Ministério da Saúde — Cadastro Nacional de Estabelecimentos de Saúde','https://cnes.datasus.gov.br/pages/estabelecimentos/consulta.jsp','DADO_ABERTO','Informações de Saúde — DATASUS (Lei 12.527/2011)','MENSAL',NULL,NULL)
ON CONFLICT ("Fonte_Nome") DO UPDATE SET
  "Fonte_Origem"=EXCLUDED."Fonte_Origem", "Fonte_Url"=EXCLUDED."Fonte_Url",
  "Fonte_BaseLegal"=EXCLUDED."Fonte_BaseLegal", "Fonte_Licenca"=EXCLUDED."Fonte_Licenca",
  "Fonte_Periodicidade"=EXCLUDED."Fonte_Periodicidade";

INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade","Fonte_VigenciaInicio","Fonte_VigenciaFim")
VALUES ('CNES/DataSUS — Leitos por município','Ministério da Saúde — Cadastro Nacional de Estabelecimentos de Saúde','http://tabnet.datasus.gov.br/cgi/deftohtm.exe?cnes/cnv/leiutimt.def','DADO_ABERTO','Dados Abertos do SUS (ODbL)','MENSAL',NULL,NULL)
ON CONFLICT ("Fonte_Nome") DO UPDATE SET
  "Fonte_Origem"=EXCLUDED."Fonte_Origem", "Fonte_Url"=EXCLUDED."Fonte_Url",
  "Fonte_BaseLegal"=EXCLUDED."Fonte_BaseLegal", "Fonte_Licenca"=EXCLUDED."Fonte_Licenca",
  "Fonte_Periodicidade"=EXCLUDED."Fonte_Periodicidade";

INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status")
SELECT t."TemaConsulta_Id",'Estabelecimentos de saúde','SEM_FONTE'
FROM "TemaConsulta" t WHERE t."TemaConsulta_Nome"='Saúde'
  AND NOT EXISTS (SELECT 1 FROM "SubtemaConsulta" s WHERE s."SubtemaConsulta_TemaId"=t."TemaConsulta_Id" AND s."SubtemaConsulta_Nome"='Estabelecimentos de saúde');
INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_MetodologiaUrl","Indicador_StatusValidacao")
SELECT s."SubtemaConsulta_Id",'Estabelecimentos de saúde ativos','estabelecimentos','SOMA','/metodologias/PACOTE_F1_12_INDICADORES.md','EM_ANALISE'
FROM "SubtemaConsulta" s JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
WHERE t."TemaConsulta_Nome"='Saúde' AND s."SubtemaConsulta_Nome"='Estabelecimentos de saúde'
  AND NOT EXISTS (SELECT 1 FROM "Indicador" existente WHERE existente."Indicador_Nome"='Estabelecimentos de saúde ativos');

INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status")
SELECT t."TemaConsulta_Id",'Leitos de internação','SEM_FONTE'
FROM "TemaConsulta" t WHERE t."TemaConsulta_Nome"='Saúde'
  AND NOT EXISTS (SELECT 1 FROM "SubtemaConsulta" s WHERE s."SubtemaConsulta_TemaId"=t."TemaConsulta_Id" AND s."SubtemaConsulta_Nome"='Leitos de internação');
INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_MetodologiaUrl","Indicador_StatusValidacao")
SELECT s."SubtemaConsulta_Id",'Leitos de internação','leitos','SOMA',NULL,'APROVADO'
FROM "SubtemaConsulta" s JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
WHERE t."TemaConsulta_Nome"='Saúde' AND s."SubtemaConsulta_Nome"='Leitos de internação'
  AND NOT EXISTS (SELECT 1 FROM "Indicador" existente WHERE existente."Indicador_Nome"='Leitos de internação');

INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status")
SELECT t."TemaConsulta_Id",'Número de leitos / vagas de UTI','DISPONIVEL'
FROM "TemaConsulta" t WHERE t."TemaConsulta_Nome"='Saúde'
  AND NOT EXISTS (SELECT 1 FROM "SubtemaConsulta" s WHERE s."SubtemaConsulta_TemaId"=t."TemaConsulta_Id" AND s."SubtemaConsulta_Nome"='Número de leitos / vagas de UTI');
INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_MetodologiaUrl","Indicador_StatusValidacao")
SELECT s."SubtemaConsulta_Id",'Leitos de UTI','leitos','SOMA',NULL,'APROVADO'
FROM "SubtemaConsulta" s JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
WHERE t."TemaConsulta_Nome"='Saúde' AND s."SubtemaConsulta_Nome"='Número de leitos / vagas de UTI'
  AND NOT EXISTS (SELECT 1 FROM "Indicador" existente WHERE existente."Indicador_Nome"='Leitos de UTI');

INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas","Carga_LinhasQuarentena")
SELECT f."Fonte_Id",'2026-08-19T19:05:16.384Z','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb','snapshot://sha256/8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb','PROMOVIDA',95,0
FROM "Fonte" f WHERE f."Fonte_Nome"='CNES/DATASUS — Leitos de internação existentes (TabNet)'
  AND NOT EXISTS (SELECT 1 FROM "Carga" x WHERE x."Carga_FonteId"=f."Fonte_Id" AND x."Carga_HashSha256"='8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb');

INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas","Carga_LinhasQuarentena")
SELECT f."Fonte_Id",'2026-08-19T19:05:17.559Z','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea','snapshot://sha256/7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea','PROMOVIDA',141,0
FROM "Fonte" f WHERE f."Fonte_Nome"='CNES/DATASUS — Estabelecimentos de saúde ativos'
  AND NOT EXISTS (SELECT 1 FROM "Carga" x WHERE x."Carga_FonteId"=f."Fonte_Id" AND x."Carga_HashSha256"='7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea');

INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas","Carga_LinhasQuarentena")
SELECT f."Fonte_Id",'2026-08-19T19:09:59.539Z','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9','snapshot://sha256/abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9','PROMOVIDA',63,0
FROM "Fonte" f WHERE f."Fonte_Nome"='CNES/DataSUS — Leitos por município'
  AND NOT EXISTS (SELECT 1 FROM "Carga" x WHERE x."Carga_FonteId"=f."Fonte_Id" AND x."Carga_HashSha256"='abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9');

WITH dados(indicador,tema,subtema,codigo,referencia,valor,fonte,hash) AS (
  VALUES ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5100102','2026-07-28',12,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5100201','2026-07-28',113,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5100250','2026-07-28',290,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5100300','2026-07-28',46,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5100359','2026-07-28',22,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5100409','2026-07-28',21,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5100508','2026-07-28',16,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5100607','2026-07-28',29,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5100805','2026-07-28',21,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5101001','2026-07-28',13,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5101209','2026-07-28',5,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5101258','2026-07-28',45,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5101308','2026-07-28',43,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5101407','2026-07-28',51,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5101605','2026-07-28',12,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5101704','2026-07-28',87,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5101803','2026-07-28',257,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5101852','2026-07-28',17,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5101902','2026-07-28',57,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5102504','2026-07-28',296,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5102603','2026-07-28',27,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5102637','2026-07-28',142,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5102678','2026-07-28',147,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5102686','2026-07-28',41,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5102694','2026-07-28',17,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5102702','2026-07-28',97,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5102793','2026-07-28',28,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5102850','2026-07-28',17,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103007','2026-07-28',42,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103056','2026-07-28',24,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103106','2026-07-28',27,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103205','2026-07-28',111,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103254','2026-07-28',43,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103304','2026-07-28',76,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103353','2026-07-28',96,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103361','2026-07-28',15,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103379','2026-07-28',18,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103403','2026-07-28',2385,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103437','2026-07-28',10,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103452','2026-07-28',17,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103502','2026-07-28',82,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103601','2026-07-28',13,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103700','2026-07-28',25,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103809','2026-07-28',9,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103858','2026-07-28',47,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103908','2026-07-28',16,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5103957','2026-07-28',8,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5104104','2026-07-28',98,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5104203','2026-07-28',25,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5104500','2026-07-28',8,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5104526','2026-07-28',24,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5104542','2026-07-28',19,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5104559','2026-07-28',14,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5104609','2026-07-28',39,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5104807','2026-07-28',81,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5104906','2026-07-28',15,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105002','2026-07-28',22,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105101','2026-07-28',124,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105150','2026-07-28',146,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105176','2026-07-28',38,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105200','2026-07-28',22,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105234','2026-07-28',10,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105259','2026-07-28',345,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105309','2026-07-28',9,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105507','2026-07-28',21,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105580','2026-07-28',22,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105606','2026-07-28',70,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105622','2026-07-28',121,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5105903','2026-07-28',56,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106000','2026-07-28',12,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106109','2026-07-28',11,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106158','2026-07-28',36,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106174','2026-07-28',13,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106182','2026-07-28',15,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106190','2026-07-28',12,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106208','2026-07-28',13,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106216','2026-07-28',32,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106224','2026-07-28',236,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106232','2026-07-28',46,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106240','2026-07-28',32,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106257','2026-07-28',60,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106265','2026-07-28',18,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106273','2026-07-28',14,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106281','2026-07-28',18,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106299','2026-07-28',33,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106307','2026-07-28',50,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106315','2026-07-28',9,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106372','2026-07-28',36,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106422','2026-07-28',84,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106455','2026-07-28',12,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106505','2026-07-28',40,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106653','2026-07-28',12,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106703','2026-07-28',10,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106752','2026-07-28',144,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106778','2026-07-28',17,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106802','2026-07-28',18,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106828','2026-07-28',22,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5106851','2026-07-28',15,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107008','2026-07-28',29,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107040','2026-07-28',279,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107065','2026-07-28',79,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107107','2026-07-28',62,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107156','2026-07-28',6,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107180','2026-07-28',39,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107198','2026-07-28',14,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107206','2026-07-28',14,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107248','2026-07-28',19,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107263','2026-07-28',10,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107297','2026-07-28',4,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107305','2026-07-28',51,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107354','2026-07-28',10,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107404','2026-07-28',8,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107578','2026-07-28',13,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107602','2026-07-28',1018,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107701','2026-07-28',34,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107743','2026-07-28',10,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107750','2026-07-28',14,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107768','2026-07-28',15,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107776','2026-07-28',16,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107792','2026-07-28',12,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107800','2026-07-28',17,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107859','2026-07-28',35,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107875','2026-07-28',128,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107883','2026-07-28',10,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107909','2026-07-28',900,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107925','2026-07-28',501,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107941','2026-07-28',32,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5107958','2026-07-28',419,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108006','2026-07-28',42,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108055','2026-07-28',30,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108105','2026-07-28',8,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108204','2026-07-28',16,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108303','2026-07-28',19,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108352','2026-07-28',14,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108402','2026-07-28',306,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108501','2026-07-28',40,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108600','2026-07-28',44,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108808','2026-07-28',14,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108857','2026-07-28',9,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108907','2026-07-28',14,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Estabelecimentos de saúde ativos','Saúde','Estabelecimentos de saúde','5108956','2026-07-28',19,'CNES/DATASUS — Estabelecimentos de saúde ativos','7d11243f8c60f77993120c3031edbebe32c238f98b18b42556d05d6e886c85ea'),
    ('Leitos de internação','Saúde','Leitos de internação','5100201','2026-07-28',78,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5100250','2026-07-28',216,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5100300','2026-07-28',24,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5100409','2026-07-28',22,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5100607','2026-07-28',21,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5100805','2026-07-28',31,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5101258','2026-07-28',17,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5101308','2026-07-28',40,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5101407','2026-07-28',37,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5101605','2026-07-28',11,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5101704','2026-07-28',32,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5101803','2026-07-28',142,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5101902','2026-07-28',40,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5102504','2026-07-28',221,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5102603','2026-07-28',21,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5102637','2026-07-28',32,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5102678','2026-07-28',66,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5102686','2026-07-28',16,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5102702','2026-07-28',34,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103007','2026-07-28',5,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103056','2026-07-28',18,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103106','2026-07-28',16,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103205','2026-07-28',81,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103254','2026-07-28',34,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103304','2026-07-28',42,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103353','2026-07-28',89,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103379','2026-07-28',33,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103403','2026-07-28',2090,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103502','2026-07-28',44,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103601','2026-07-28',8,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103858','2026-07-28',14,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5103908','2026-07-28',14,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5104104','2026-07-28',43,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5104203','2026-07-28',5,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5104559','2026-07-28',16,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5104609','2026-07-28',35,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5104807','2026-07-28',66,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5105002','2026-07-28',37,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5105101','2026-07-28',61,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5105150','2026-07-28',114,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5105176','2026-07-28',18,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5105200','2026-07-28',15,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5105259','2026-07-28',122,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5105507','2026-07-28',59,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5105580','2026-07-28',21,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5105606','2026-07-28',42,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5105622','2026-07-28',40,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5105903','2026-07-28',62,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106000','2026-07-28',4,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106109','2026-07-28',16,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106158','2026-07-28',14,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106174','2026-07-28',2,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106216','2026-07-28',5,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106224','2026-07-28',154,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106232','2026-07-28',56,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106240','2026-07-28',10,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106257','2026-07-28',56,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106273','2026-07-28',12,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106281','2026-07-28',30,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106299','2026-07-28',31,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106307','2026-07-28',25,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106372','2026-07-28',21,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106422','2026-07-28',58,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106505','2026-07-28',58,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106703','2026-07-28',17,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106752','2026-07-28',86,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106778','2026-07-28',18,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106802','2026-07-28',16,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5106828','2026-07-28',4,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107008','2026-07-28',80,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107040','2026-07-28',181,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107065','2026-07-28',26,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107107','2026-07-28',52,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107180','2026-07-28',21,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107198','2026-07-28',11,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107206','2026-07-28',18,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107305','2026-07-28',22,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107602','2026-07-28',594,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107701','2026-07-28',48,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107750','2026-07-28',14,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107776','2026-07-28',13,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107800','2026-07-28',15,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107859','2026-07-28',30,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107875','2026-07-28',52,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107909','2026-07-28',380,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107925','2026-07-28',244,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107941','2026-07-28',13,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5107958','2026-07-28',305,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5108006','2026-07-28',13,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5108055','2026-07-28',28,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5108105','2026-07-28',13,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5108204','2026-07-28',25,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5108402','2026-07-28',620,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5108600','2026-07-28',21,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de internação','Saúde','Leitos de internação','5108956','2026-07-28',13,'CNES/DATASUS — Leitos de internação existentes (TabNet)','8caa65757871eb8f0326c273f91ab8908ac84a85a59640e14352e101ecdd0dcb'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5100201','2026-07-28',10,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5100250','2026-07-28',51,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5100409','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5100805','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5101258','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5101308','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5101407','2026-07-28',3,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5101605','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5101803','2026-07-28',11,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5102504','2026-07-28',67,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5102603','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5102637','2026-07-28',4,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5102678','2026-07-28',12,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5102686','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9')
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
DO UPDATE SET "Observacao_Valor"=EXCLUDED."Observacao_Valor", "Observacao_CargaId"=EXCLUDED."Observacao_CargaId";

WITH dados(indicador,tema,subtema,codigo,referencia,valor,fonte,hash) AS (
  VALUES ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5102702','2026-07-28',4,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5103106','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5103205','2026-07-28',21,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5103254','2026-07-28',2,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5103353','2026-07-28',4,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5103379','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5103403','2026-07-28',761,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5103502','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5103908','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5104104','2026-07-28',18,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5104609','2026-07-28',2,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5104807','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5105002','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5105101','2026-07-28',2,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5105150','2026-07-28',14,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5105176','2026-07-28',3,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5105259','2026-07-28',48,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5105507','2026-07-28',2,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5105580','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5105606','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5105622','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5105903','2026-07-28',2,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5106224','2026-07-28',62,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5106232','2026-07-28',2,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5106257','2026-07-28',6,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5106273','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5106281','2026-07-28',3,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5106299','2026-07-28',2,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5106372','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5106422','2026-07-28',12,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5106505','2026-07-28',2,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5106752','2026-07-28',3,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5106802','2026-07-28',4,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5107008','2026-07-28',2,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5107040','2026-07-28',70,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5107602','2026-07-28',144,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5107701','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5107800','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5107859','2026-07-28',2,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5107875','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5107909','2026-07-28',89,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5107925','2026-07-28',40,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5107941','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5107958','2026-07-28',93,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5108006','2026-07-28',2,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5108055','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5108105','2026-07-28',1,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5108204','2026-07-28',3,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9'),
    ('Leitos de UTI','Saúde','Número de leitos / vagas de UTI','5108402','2026-07-28',126,'CNES/DataSUS — Leitos por município','abb05d8e48af30416072841b9d41968e64db7ad999d31d8c3081f829b8415cd9')
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
DO UPDATE SET "Observacao_Valor"=EXCLUDED."Observacao_Valor", "Observacao_CargaId"=EXCLUDED."Observacao_CargaId";
