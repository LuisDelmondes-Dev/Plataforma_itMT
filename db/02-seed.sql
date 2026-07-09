-- ============================================================
-- 02-seed.sql — DADOS DEMONSTRATIVOS
-- ⚠️ Os valores de observação abaixo são FICTÍCIOS, apenas para
-- demonstrar o fluxo Local→Tema→Subtema→Resultado com procedência.
-- Em produção, TODO dado entra via conector com Fonte_BaseLegal
-- registrada (RG-06); nada é digitado manualmente.
-- Códigos de RGI/RGInt do seed são ilustrativos — a carga canônica
-- vem da malha oficial do IBGE (conector F1).
-- ============================================================

INSERT INTO "RegiaoIntermediaria" VALUES
 ('5101','Cuiabá'),('5102','Sinop'),('5103','Cáceres'),
 ('5104','Rondonópolis'),('5105','Barra do Garças');

INSERT INTO "RegiaoImediata" VALUES
 ('510101','Cuiabá','5101'),
 ('510201','Sinop','5102'),
 ('510202','Sorriso','5102'),
 ('510301','Cáceres','5103'),
 ('510302','Tangará da Serra','5103'),
 ('510401','Rondonópolis','5104'),
 ('510402','Primavera do Leste','5104'),
 ('510501','Barra do Garças','5105');

INSERT INTO "Municipio"
 ("Municipio_CodigoIbge","Municipio_Nome","Municipio_CodigoRgi","Municipio_CodigoRgint","Municipio_AreaKm2") VALUES
 ('5103403','Cuiabá','510101','5101',3266.538),
 ('5108402','Várzea Grande','510101','5101',938.061),
 ('5107909','Sinop','510201','5102',3942.229),
 ('5107925','Sorriso','510202','5102',9329.603),
 ('5105259','Lucas do Rio Verde','510202','5102',3663.988),
 ('5100250','Alta Floresta','510201','5102',8976.184),
 ('5102504','Cáceres','510301','5103',24398.399),
 ('5107958','Tangará da Serra','510302','5103',11323.647),
 ('5106752','Pontes e Lacerda','510301','5103',8558.906),
 ('5107602','Rondonópolis','510401','5104',4159.122),
 ('5107040','Primavera do Leste','510402','5104',5471.599),
 ('5101803','Barra do Garças','510501','5105',9078.983);

INSERT INTO "Consorcio" ("Consorcio_Nome","Consorcio_Tipo") VALUES
 ('Consórcio Intermunicipal de Saúde Teles Pires (demo)','SAUDE');

INSERT INTO "ConsorcioMunicipio" VALUES
 (1,'5107909','2019-01-01',NULL),
 (1,'5107925','2019-01-01',NULL),
 (1,'5105259','2021-06-01',NULL),
 (1,'5100250','2019-01-01','2024-12-31'); -- saiu: RN-002 em ação

-- Taxonomia — os 17 temas (Anexo A)
INSERT INTO "TemaConsulta" ("TemaConsulta_Nome","TemaConsulta_Ordem") VALUES
 ('Imprensa Oficial',1),('Economia — Setor Público',2),('Economia — Setor Privado',3),
 ('Instituições Públicas e Privadas',4),('Demografia',5),('Geografia',6),
 ('Infraestrutura Macro',7),('Infraestrutura Urbana',8),('Registros Históricos',9),
 ('Outros Indicadores',10),('Saúde',11),('Segurança Pública',12),('Educação',13),
 ('Meio Ambiente',14),('Assistência Social',15),('Mercado de Trabalho',16),('Agronegócio',17);

INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status") VALUES
 (11,'Número de leitos / vagas de UTI','DISPONIVEL'),          -- id 1
 (11,'Cobertura vacinal','DISPONIVEL'),                        -- id 2
 (5,'População estimada','DISPONIVEL'),                        -- id 3
 (13,'Matrículas — rede pública','DISPONIVEL'),                -- id 4
 (3,'PIB municipal','DISPONIVEL'),                             -- id 5
 (11,'Unidades de saúde','EM_CONSTRUCAO'),
 (14,'Desmatamento','SEM_FONTE'),
 (16,'Estoque de empregos formais','SEM_FONTE');

INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade") VALUES
 ('Seed demonstrativo — substituir por conector oficial','ITMT (demo)','https://itmt.mt.gov.br/demo','DADO_ABERTO','CC-BY-4.0','ANUAL');

INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_LinhasLidas") VALUES
 (1,'2026-03-12T10:00:00Z', encode(sha256('seed-demo-itmt'::bytea),'hex'), 's3://itmt-bronze/demo/seed.csv', 60);

-- Indicadores (RN-003: cada um declara sua natureza de agregação)
INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao") VALUES
 (1,'Leitos de UTI','leitos','SOMA'),                                   -- id 1 (estoque)
 (3,'População estimada','habitantes','SOMA'),                          -- id 2 (estoque)
 (4,'Matrículas na rede pública','matrículas','SOMA'),                  -- id 3
 (5,'PIB municipal','R$ mil','SOMA'),                                   -- id 4
 (2,'Doses aplicadas (poliomielite)','doses','SOMA'),                   -- id 5 (numerador)
 (2,'População-alvo (poliomielite)','crianças','SOMA'),                 -- id 6 (denominador)
 (5,'PIB per capita','R$/hab','NAO_AGREGAVEL');                         -- id 7

-- Taxa = RECALCULO a partir de numerador/denominador (RN-003)
INSERT INTO "Indicador"
 ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao","Indicador_NumeradorId","Indicador_DenominadorId")
 VALUES (2,'Cobertura vacinal — poliomielite','%','RECALCULO',5,6);     -- id 8

-- Observações fictícias (ref. 2025)
INSERT INTO "Observacao"
 ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
SELECT t.id, t.cod, DATE '2025-12-31', t.v, 1, 1 FROM (VALUES
 -- Leitos de UTI (indicador 1)
 (1,'5103403',612),(1,'5108402',148),(1,'5107909',96),(1,'5107925',54),
 (1,'5105259',38),(1,'5100250',22),(1,'5102504',41),(1,'5107958',47),
 (1,'5106752',18),(1,'5107602',203),(1,'5107040',36),(1,'5101803',44),
 -- População estimada (indicador 2)
 (2,'5103403',650912),(2,'5108402',300784),(2,'5107909',209292),(2,'5107925',115104),
 (2,'5105259',82003),(2,'5100250',56186),(2,'5102504',94861),(2,'5107958',107631),
 (2,'5106752',46007),(2,'5107602',249333),(2,'5107040',65932),(2,'5101803',62088),
 -- Matrículas (indicador 3)
 (3,'5103403',118420),(3,'5108402',61200),(3,'5107909',41880),(3,'5107925',24310),
 (3,'5105259',17640),(3,'5100250',11250),(3,'5102504',19870),(3,'5107958',22140),
 (3,'5106752',9640),(3,'5107602',51230),(3,'5107040',13890),(3,'5101803',12760),
 -- PIB (indicador 4, R$ mil)
 (4,'5103403',28412000),(4,'5108402',9873000),(4,'5107909',11240000),(4,'5107925',14980000),
 (4,'5105259',9450000),(4,'5100250',2810000),(4,'5102504',2640000),(4,'5107958',4980000),
 (4,'5106752',1870000),(4,'5107602',13120000),(4,'5107040',8940000),(4,'5101803',2450000),
 -- Doses aplicadas (indicador 5)
 (5,'5103403',41210),(5,'5108402',19870),(5,'5107909',13980),(5,'5107925',8120),
 (5,'5105259',5710),(5,'5100250',3480),(5,'5102504',5920),(5,'5107958',6890),
 (5,'5106752',2870),(5,'5107602',16240),(5,'5107040',4380),(5,'5101803',3910),
 -- População-alvo (indicador 6)
 (6,'5103403',45640),(6,'5108402',22980),(6,'5107909',15110),(6,'5107925',8890),
 (6,'5105259',6060),(6,'5100250',4020),(6,'5102504',6880),(6,'5107958',7720),
 (6,'5106752',3390),(6,'5107602',18310),(6,'5107040',4770),(6,'5101803',4480)
) AS t(id,cod,v);

-- Gênese da cadeia de auditoria
INSERT INTO "EventoAuditoria"
 ("EventoAuditoria_Ator","EventoAuditoria_Acao","EventoAuditoria_Entidade","EventoAuditoria_EntidadeId",
  "EventoAuditoria_Payload","EventoAuditoria_HashAnterior","EventoAuditoria_HashAtual")
VALUES ('sistema','GENESIS','Sistema','0','{"evento":"inicializacao da cadeia"}'::jsonb,
        repeat('0',64),
        encode(sha256((repeat('0',64) || ('{"evento":"inicializacao da cadeia"}'::jsonb)::text)::bytea),'hex'));
