-- Snapshot oficial gerado de cargas auditadas; não contém usuários, tokens ou eventos privados.
-- Cargas locais de origem: 108, 109. Observações: 284.

INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade","Fonte_VigenciaInicio","Fonte_VigenciaFim")
VALUES ('INEP — Censo Escolar (matrículas rede pública)','Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira','https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar','DADO_ABERTO','Dados abertos INEP (Lei 12.527/2011)','ANUAL',NULL,NULL)
ON CONFLICT ("Fonte_Nome") DO UPDATE SET
  "Fonte_Origem"=EXCLUDED."Fonte_Origem", "Fonte_Url"=EXCLUDED."Fonte_Url",
  "Fonte_BaseLegal"=EXCLUDED."Fonte_BaseLegal", "Fonte_Licenca"=EXCLUDED."Fonte_Licenca",
  "Fonte_Periodicidade"=EXCLUDED."Fonte_Periodicidade";

INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade","Fonte_VigenciaInicio","Fonte_VigenciaFim")
VALUES ('INEP — Censo Escolar (escolas ativas)','Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira','https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar','DADO_ABERTO','Dados abertos INEP (Lei 12.527/2011)','ANUAL',NULL,NULL)
ON CONFLICT ("Fonte_Nome") DO UPDATE SET
  "Fonte_Origem"=EXCLUDED."Fonte_Origem", "Fonte_Url"=EXCLUDED."Fonte_Url",
  "Fonte_BaseLegal"=EXCLUDED."Fonte_BaseLegal", "Fonte_Licenca"=EXCLUDED."Fonte_Licenca",
  "Fonte_Periodicidade"=EXCLUDED."Fonte_Periodicidade";

INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status")
SELECT t."TemaConsulta_Id",'Escolas ativas','SEM_FONTE'
FROM "TemaConsulta" t WHERE t."TemaConsulta_Nome"='Educação'
  AND NOT EXISTS (SELECT 1 FROM "SubtemaConsulta" s WHERE s."SubtemaConsulta_TemaId"=t."TemaConsulta_Id" AND s."SubtemaConsulta_Nome"='Escolas ativas');
INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_MetodologiaUrl","Indicador_StatusValidacao")
SELECT s."SubtemaConsulta_Id",'Escolas ativas','escolas','SOMA','/metodologias/PACOTE_F1_12_INDICADORES.md','EM_ANALISE'
FROM "SubtemaConsulta" s JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
WHERE t."TemaConsulta_Nome"='Educação' AND s."SubtemaConsulta_Nome"='Escolas ativas'
  AND NOT EXISTS (SELECT 1 FROM "Indicador" existente WHERE existente."Indicador_Nome"='Escolas ativas');

INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status")
SELECT t."TemaConsulta_Id",'Matrículas — rede pública','DISPONIVEL'
FROM "TemaConsulta" t WHERE t."TemaConsulta_Nome"='Educação'
  AND NOT EXISTS (SELECT 1 FROM "SubtemaConsulta" s WHERE s."SubtemaConsulta_TemaId"=t."TemaConsulta_Id" AND s."SubtemaConsulta_Nome"='Matrículas — rede pública');
INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_MetodologiaUrl","Indicador_StatusValidacao")
SELECT s."SubtemaConsulta_Id",'Matrículas na rede pública','matrículas','SOMA',NULL,'APROVADO'
FROM "SubtemaConsulta" s JOIN "TemaConsulta" t ON t."TemaConsulta_Id"=s."SubtemaConsulta_TemaId"
WHERE t."TemaConsulta_Nome"='Educação' AND s."SubtemaConsulta_Nome"='Matrículas — rede pública'
  AND NOT EXISTS (SELECT 1 FROM "Indicador" existente WHERE existente."Indicador_Nome"='Matrículas na rede pública');

INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas","Carga_LinhasQuarentena")
SELECT f."Fonte_Id",'2026-08-19T19:28:19.184Z','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033','snapshot://sha256/115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033','PROMOVIDA',142,0
FROM "Fonte" f WHERE f."Fonte_Nome"='INEP — Censo Escolar (matrículas rede pública)'
  AND NOT EXISTS (SELECT 1 FROM "Carga" x WHERE x."Carga_FonteId"=f."Fonte_Id" AND x."Carga_HashSha256"='115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033');

INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas","Carga_LinhasQuarentena")
SELECT f."Fonte_Id",'2026-08-19T19:28:19.655Z','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759','snapshot://sha256/67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759','PROMOVIDA',142,0
FROM "Fonte" f WHERE f."Fonte_Nome"='INEP — Censo Escolar (escolas ativas)'
  AND NOT EXISTS (SELECT 1 FROM "Carga" x WHERE x."Carga_FonteId"=f."Fonte_Id" AND x."Carga_HashSha256"='67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759');

WITH dados(indicador,tema,subtema,codigo,referencia,valor,fonte,hash) AS (
  VALUES ('Escolas ativas','Educação','Escolas ativas','5100102','2025-12-31',8,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5100201','2025-12-31',26,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5100250','2025-12-31',39,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5100300','2025-12-31',16,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5100359','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5100409','2025-12-31',8,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5100508','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5100607','2025-12-31',5,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5100805','2025-12-31',10,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5101001','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5101209','2025-12-31',2,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5101258','2025-12-31',11,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5101308','2025-12-31',8,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5101407','2025-12-31',24,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5101605','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5101704','2025-12-31',25,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5101803','2025-12-31',60,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5101837','2025-12-31',7,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5101852','2025-12-31',6,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5101902','2025-12-31',18,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5102504','2025-12-31',67,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5102603','2025-12-31',24,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5102637','2025-12-31',27,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5102678','2025-12-31',31,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5102686','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5102694','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5102702','2025-12-31',24,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5102793','2025-12-31',10,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5102850','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103007','2025-12-31',21,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103056','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103106','2025-12-31',7,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103205','2025-12-31',25,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103254','2025-12-31',21,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103304','2025-12-31',20,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103353','2025-12-31',26,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103361','2025-12-31',7,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103379','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103403','2025-12-31',381,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103437','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103452','2025-12-31',5,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103502','2025-12-31',29,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103601','2025-12-31',7,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103700','2025-12-31',15,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103809','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103858','2025-12-31',15,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103908','2025-12-31',11,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5103957','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5104104','2025-12-31',34,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5104203','2025-12-31',8,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5104500','2025-12-31',2,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5104526','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5104542','2025-12-31',7,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5104559','2025-12-31',6,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5104609','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5104807','2025-12-31',19,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5104906','2025-12-31',8,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105002','2025-12-31',7,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105101','2025-12-31',33,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105150','2025-12-31',34,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105176','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105200','2025-12-31',10,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105234','2025-12-31',5,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105259','2025-12-31',38,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105309','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105507','2025-12-31',19,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105580','2025-12-31',13,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105606','2025-12-31',20,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105622','2025-12-31',18,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5105903','2025-12-31',14,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106000','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106109','2025-12-31',25,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106158','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106174','2025-12-31',13,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106182','2025-12-31',8,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106190','2025-12-31',5,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106208','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106216','2025-12-31',11,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106224','2025-12-31',36,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106232','2025-12-31',11,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106240','2025-12-31',11,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106257','2025-12-31',12,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106265','2025-12-31',7,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106273','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106281','2025-12-31',8,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106299','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106307','2025-12-31',28,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106315','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106372','2025-12-31',16,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106422','2025-12-31',24,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106455','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106505','2025-12-31',26,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106653','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106703','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106752','2025-12-31',22,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106778','2025-12-31',11,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106802','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106828','2025-12-31',11,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5106851','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107008','2025-12-31',22,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107040','2025-12-31',52,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107065','2025-12-31',20,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107107','2025-12-31',16,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107156','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107180','2025-12-31',16,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107198','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107206','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107248','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107263','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107297','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107305','2025-12-31',13,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107354','2025-12-31',8,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107404','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107578','2025-12-31',11,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107602','2025-12-31',164,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107701','2025-12-31',18,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107743','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107750','2025-12-31',2,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107768','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107776','2025-12-31',11,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107792','2025-12-31',5,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107800','2025-12-31',22,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107859','2025-12-31',11,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107875','2025-12-31',22,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107883','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107909','2025-12-31',88,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107925','2025-12-31',58,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107941','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5107958','2025-12-31',69,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108006','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108055','2025-12-31',10,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108105','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108204','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108303','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108352','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108402','2025-12-31',168,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108501','2025-12-31',9,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108600','2025-12-31',17,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108808','2025-12-31',5,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108857','2025-12-31',3,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108907','2025-12-31',4,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Escolas ativas','Educação','Escolas ativas','5108956','2025-12-31',6,'INEP — Censo Escolar (escolas ativas)','67b7e3b0707812b15b6b02b394fb423e65781411ce06947fe4c133bf76d0b759'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5100102','2025-12-31',1281,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5100201','2025-12-31',6521,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5100250','2025-12-31',11732,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5100300','2025-12-31',2581,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5100359','2025-12-31',1352,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5100409','2025-12-31',2715,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5100508','2025-12-31',1491,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5100607','2025-12-31',2497,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5100805','2025-12-31',2196,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5101001','2025-12-31',767,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5101209','2025-12-31',181,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5101258','2025-12-31',3022,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5101308','2025-12-31',2269,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5101407','2025-12-31',6361,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5101605','2025-12-31',1350,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5101704','2025-12-31',6496,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5101803','2025-12-31',13543,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5101837','2025-12-31',1735,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5101852','2025-12-31',2026,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5101902','2025-12-31',4168,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5102504','2025-12-31',17981,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5102603','2025-12-31',5304,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5102637','2025-12-31',12236,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5102678','2025-12-31',9853,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5102686','2025-12-31',2625,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5102694','2025-12-31',1185,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5102702','2025-12-31',5663,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5102793','2025-12-31',2016,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5102850','2025-12-31',1376,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103007','2025-12-31',4189,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103056','2025-12-31',2350,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103106','2025-12-31',1344,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103205','2025-12-31',6331,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103254','2025-12-31',6249,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103304','2025-12-31',4623,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103353','2025-12-31',9575,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103361','2025-12-31',1046,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103379','2025-12-31',2309,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103403','2025-12-31',110070,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103437','2025-12-31',1075,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103452','2025-12-31',1548,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103502','2025-12-31',5430,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103601','2025-12-31',1349,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103700','2025-12-31',2728,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103809','2025-12-31',649,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103858','2025-12-31',3097,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103908','2025-12-31',1539,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5103957','2025-12-31',626,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5104104','2025-12-31',7569,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5104203','2025-12-31',1710,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5104500','2025-12-31',465,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5104526','2025-12-31',2232,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5104542','2025-12-31',1817,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5104559','2025-12-31',1417,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5104609','2025-12-31',3087,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5104807','2025-12-31',5804,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5104906','2025-12-31',1804,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105002','2025-12-31',1791,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105101','2025-12-31',7767,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105150','2025-12-31',9651,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105176','2025-12-31',2460,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105200','2025-12-31',2469,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105234','2025-12-31',1087,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105259','2025-12-31',20093,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105309','2025-12-31',663,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105507','2025-12-31',3835,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105580','2025-12-31',2987,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105606','2025-12-31',5347,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105622','2025-12-31',5440,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5105903','2025-12-31',3915,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106000','2025-12-31',1155,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106109','2025-12-31',3198,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106158','2025-12-31',2847,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106174','2025-12-31',1289,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106182','2025-12-31',1603,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106190','2025-12-31',1022,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106208','2025-12-31',905,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106216','2025-12-31',2642,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106224','2025-12-31',14358,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106232','2025-12-31',3598,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106240','2025-12-31',2494,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106257','2025-12-31',4377,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106265','2025-12-31',1686,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106273','2025-12-31',769,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106281','2025-12-31',1669,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106299','2025-12-31',2531,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106307','2025-12-31',5727,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106315','2025-12-31',509,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106372','2025-12-31',4070,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106422','2025-12-31',7896,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106455','2025-12-31',929,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106505','2025-12-31',7242,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106653','2025-12-31',952,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106703','2025-12-31',366,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106752','2025-12-31',11103,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106778','2025-12-31',2453,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106802','2025-12-31',1228,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106828','2025-12-31',2397,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5106851','2025-12-31',672,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107008','2025-12-31',4054,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107040','2025-12-31',19361,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107065','2025-12-31',6821,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107107','2025-12-31',3187,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107156','2025-12-31',526,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107180','2025-12-31',2228,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107198','2025-12-31',650,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107206','2025-12-31',1040,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107248','2025-12-31',1532,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033')
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
  VALUES ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107263','2025-12-31',642,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107297','2025-12-31',485,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107305','2025-12-31',3535,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107354','2025-12-31',1937,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107404','2025-12-31',895,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107578','2025-12-31',882,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107602','2025-12-31',50885,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107701','2025-12-31',3030,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107743','2025-12-31',719,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107750','2025-12-31',768,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107768','2025-12-31',1071,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107776','2025-12-31',1717,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107792','2025-12-31',1114,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107800','2025-12-31',4464,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107859','2025-12-31',2663,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107875','2025-12-31',7406,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107883','2025-12-31',405,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107909','2025-12-31',40325,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107925','2025-12-31',26209,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107941','2025-12-31',2671,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5107958','2025-12-31',20268,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108006','2025-12-31',3165,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108055','2025-12-31',2629,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108105','2025-12-31',529,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108204','2025-12-31',680,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108303','2025-12-31',1139,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108352','2025-12-31',747,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108402','2025-12-31',61051,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108501','2025-12-31',2538,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108600','2025-12-31',4288,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108808','2025-12-31',1052,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108857','2025-12-31',956,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108907','2025-12-31',1556,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033'),
    ('Matrículas na rede pública','Educação','Matrículas — rede pública','5108956','2025-12-31',2056,'INEP — Censo Escolar (matrículas rede pública)','115f5883995712446cde68054780c027134e269f79b164bf3b9bbe0c644d6033')
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
