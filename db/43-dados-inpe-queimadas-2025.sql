-- Snapshot oficial gerado de cargas auditadas; não contém usuários, tokens ou eventos privados.
-- Cargas locais de origem: 106. Observações: 142.

INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade","Fonte_VigenciaInicio","Fonte_VigenciaFim")
VALUES ('INPE — Programa Queimadas (focos de calor)','Instituto Nacional de Pesquisas Espaciais','https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/anual/Brasil_sat_ref/','DADO_ABERTO','Dados abertos INPE (CC-BY-SA)','ANUAL',NULL,NULL)
ON CONFLICT ("Fonte_Nome") DO UPDATE SET
  "Fonte_Origem"=EXCLUDED."Fonte_Origem", "Fonte_Url"=EXCLUDED."Fonte_Url",
  "Fonte_BaseLegal"=EXCLUDED."Fonte_BaseLegal", "Fonte_Licenca"=EXCLUDED."Fonte_Licenca",
  "Fonte_Periodicidade"=EXCLUDED."Fonte_Periodicidade";

INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status")
SELECT t."TemaConsulta_Id",'Focos de queimadas','SEM_FONTE'
FROM "TemaConsulta" t WHERE t."TemaConsulta_Nome"='Meio Ambiente'
  AND NOT EXISTS (SELECT 1 FROM "SubtemaConsulta" s WHERE s."SubtemaConsulta_TemaId"=t."TemaConsulta_Id" AND s."SubtemaConsulta_Nome"='Focos de queimadas');
INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_MetodologiaUrl","Indicador_StatusValidacao")
SELECT s."SubtemaConsulta_Id",'Focos de queimadas','focos','SOMA',NULL,'EM_ANALISE'
FROM "SubtemaConsulta" s JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
WHERE t."TemaConsulta_Nome"='Meio Ambiente' AND s."SubtemaConsulta_Nome"='Focos de queimadas'
  AND NOT EXISTS (SELECT 1 FROM "Indicador" existente WHERE existente."Indicador_Nome"='Focos de queimadas');

INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas","Carga_LinhasQuarentena")
SELECT f."Fonte_Id",'2026-08-19T19:10:30.020Z','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60','snapshot://sha256/c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60','PROMOVIDA',142,0
FROM "Fonte" f WHERE f."Fonte_Nome"='INPE — Programa Queimadas (focos de calor)'
  AND NOT EXISTS (SELECT 1 FROM "Carga" x WHERE x."Carga_FonteId"=f."Fonte_Id" AND x."Carga_HashSha256"='c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60');

WITH dados(indicador,tema,subtema,codigo,referencia,valor,fonte,hash) AS (
  VALUES ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5100102','2025-12-31',8,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5100201','2025-12-31',75,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5100250','2025-12-31',84,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5100300','2025-12-31',16,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5100359','2025-12-31',120,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5100409','2025-12-31',7,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5100508','2025-12-31',12,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5100607','2025-12-31',10,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5100805','2025-12-31',101,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5101001','2025-12-31',47,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5101209','2025-12-31',3,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5101258','2025-12-31',0,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5101308','2025-12-31',8,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5101407','2025-12-31',396,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5101605','2025-12-31',29,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5101704','2025-12-31',18,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5101803','2025-12-31',161,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5101837','2025-12-31',0,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5101852','2025-12-31',44,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5101902','2025-12-31',182,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5102504','2025-12-31',95,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5102603','2025-12-31',338,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5102637','2025-12-31',23,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5102678','2025-12-31',16,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5102686','2025-12-31',21,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5102694','2025-12-31',39,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5102702','2025-12-31',146,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5102793','2025-12-31',5,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5102850','2025-12-31',13,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103007','2025-12-31',82,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103056','2025-12-31',146,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103106','2025-12-31',250,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103205','2025-12-31',15,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103254','2025-12-31',982,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103304','2025-12-31',33,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103353','2025-12-31',99,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103361','2025-12-31',18,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103379','2025-12-31',109,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103403','2025-12-31',62,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103437','2025-12-31',0,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103452','2025-12-31',3,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103502','2025-12-31',33,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103601','2025-12-31',19,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103700','2025-12-31',150,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103809','2025-12-31',1,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103858','2025-12-31',266,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103908','2025-12-31',59,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5103957','2025-12-31',0,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5104104','2025-12-31',54,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5104203','2025-12-31',38,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5104500','2025-12-31',1,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5104526','2025-12-31',26,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5104542','2025-12-31',33,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5104559','2025-12-31',119,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5104609','2025-12-31',54,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5104807','2025-12-31',3,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5104906','2025-12-31',2,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105002','2025-12-31',4,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105101','2025-12-31',244,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105150','2025-12-31',162,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105176','2025-12-31',18,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105200','2025-12-31',8,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105234','2025-12-31',1,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105259','2025-12-31',6,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105309','2025-12-31',209,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105507','2025-12-31',92,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105580','2025-12-31',276,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105606','2025-12-31',31,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105622','2025-12-31',2,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5105903','2025-12-31',13,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106000','2025-12-31',3,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106109','2025-12-31',48,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106158','2025-12-31',83,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106174','2025-12-31',244,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106182','2025-12-31',13,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106190','2025-12-31',53,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106208','2025-12-31',51,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106216','2025-12-31',84,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106224','2025-12-31',55,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106232','2025-12-31',9,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106240','2025-12-31',376,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106257','2025-12-31',35,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106265','2025-12-31',37,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106273','2025-12-31',6,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106281','2025-12-31',53,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106299','2025-12-31',77,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106307','2025-12-31',421,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106315','2025-12-31',95,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106372','2025-12-31',3,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106422','2025-12-31',117,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106455','2025-12-31',30,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106505','2025-12-31',42,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106653','2025-12-31',7,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106703','2025-12-31',0,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106752','2025-12-31',71,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106778','2025-12-31',87,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106802','2025-12-31',75,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106828','2025-12-31',17,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5106851','2025-12-31',4,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107008','2025-12-31',70,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107040','2025-12-31',20,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107065','2025-12-31',168,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107107','2025-12-31',2,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107156','2025-12-31',0,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107180','2025-12-31',115,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107198','2025-12-31',0,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107206','2025-12-31',3,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107248','2025-12-31',80,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107263','2025-12-31',5,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107297','2025-12-31',0,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107305','2025-12-31',50,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107354','2025-12-31',61,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107404','2025-12-31',1,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107578','2025-12-31',70,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107602','2025-12-31',24,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107701','2025-12-31',91,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107743','2025-12-31',67,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107750','2025-12-31',1,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107768','2025-12-31',77,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107776','2025-12-31',199,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107792','2025-12-31',29,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107800','2025-12-31',113,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107859','2025-12-31',396,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107875','2025-12-31',88,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107883','2025-12-31',39,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107909','2025-12-31',34,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107925','2025-12-31',14,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107941','2025-12-31',57,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5107958','2025-12-31',220,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108006','2025-12-31',17,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108055','2025-12-31',21,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108105','2025-12-31',62,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108204','2025-12-31',28,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108303','2025-12-31',129,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108352','2025-12-31',5,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108402','2025-12-31',28,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108501','2025-12-31',42,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108600','2025-12-31',149,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108808','2025-12-31',2,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108857','2025-12-31',26,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108907','2025-12-31',459,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60'),
    ('Focos de queimadas','Meio Ambiente','Focos de queimadas','5108956','2025-12-31',63,'INPE — Programa Queimadas (focos de calor)','c6399b33711581a6b4664e468757a2e03636db6ddca6608537369a462de4fc60')
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
