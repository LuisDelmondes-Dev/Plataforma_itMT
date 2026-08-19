-- ============================================================
-- 19-f1-pacote-lancamento.sql — pacote mínimo verificável da Fase 1.
-- Define os 10 municípios, os 12 indicadores e a régua objetiva de
-- prontidão. Dados e aprovação continuam separados: carregar não publica.
-- ============================================================

CREATE TABLE IF NOT EXISTS "MunicipioPilotoF1" (
  "MunicipioPilotoF1_CodigoIbge" char(7) PRIMARY KEY
    REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "MunicipioPilotoF1_Ordem" smallint NOT NULL UNIQUE CHECK ("MunicipioPilotoF1_Ordem" BETWEEN 1 AND 10)
);

INSERT INTO "MunicipioPilotoF1" VALUES
  ('5103403',1), ('5108402',2), ('5107602',3), ('5107909',4), ('5107925',5),
  ('5102504',6), ('5101803',7), ('5107958',8), ('5100250',9), ('5107040',10)
ON CONFLICT ("MunicipioPilotoF1_CodigoIbge") DO UPDATE
SET "MunicipioPilotoF1_Ordem" = EXCLUDED."MunicipioPilotoF1_Ordem";

-- Taxonomia mínima. Os subtemas nascem SEM_FONTE; só ficam DISPONIVEL
-- após dado real, aprovação e cobertura verificável.
WITH novos(tema, subtema) AS (VALUES
  ('Demografia','População residente'),
  ('Demografia','Densidade demográfica'),
  ('Saúde','Leitos de internação'),
  ('Saúde','Estabelecimentos de saúde'),
  ('Educação','Frequência escolar'),
  ('Educação','Pessoas que frequentavam escola'),
  ('Agronegócio','Área plantada'),
  ('Agronegócio','Valor da produção agrícola'),
  ('Economia — Setor Privado','Unidades locais'),
  ('Economia — Setor Privado','Pessoal ocupado assalariado'),
  ('Infraestrutura Macro','Cobertura de abastecimento de água'),
  ('Infraestrutura Macro','Cobertura de esgotamento sanitário')
)
INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status")
SELECT t."TemaConsulta_Id", n.subtema, 'SEM_FONTE'
FROM novos n JOIN "TemaConsulta" t ON t."TemaConsulta_Nome" = n.tema
WHERE NOT EXISTS (
  SELECT 1 FROM "SubtemaConsulta" s
  WHERE s."SubtemaConsulta_TemaId" = t."TemaConsulta_Id"
    AND s."SubtemaConsulta_Nome" = n.subtema
);

WITH novos(subtema,nome,unidade,tipo,metodologia) AS (VALUES
  ('População residente','População residente — Censo 2022','habitantes','SOMA','/metodologias/PACOTE_F1_12_INDICADORES.md'),
  ('Densidade demográfica','Densidade demográfica','hab./km²','NAO_AGREGAVEL','/metodologias/PACOTE_F1_12_INDICADORES.md'),
  ('Leitos de internação','Leitos de internação','leitos','SOMA','/metodologias/PACOTE_F1_12_INDICADORES.md'),
  ('Estabelecimentos de saúde','Estabelecimentos de saúde ativos','estabelecimentos','SOMA','/metodologias/PACOTE_F1_12_INDICADORES.md'),
  ('Frequência escolar','Taxa de frequência escolar bruta — 6 a 14 anos','%','NAO_AGREGAVEL','/metodologias/PACOTE_F1_12_INDICADORES.md'),
  ('Pessoas que frequentavam escola','Pessoas de 6 a 17 anos que frequentavam escola','pessoas','SOMA','/metodologias/PACOTE_F1_12_INDICADORES.md'),
  ('Área plantada','Área plantada','hectares','SOMA','/metodologias/PACOTE_F1_12_INDICADORES.md'),
  ('Valor da produção agrícola','Valor da produção agrícola','R$ mil','SOMA','/metodologias/PACOTE_F1_12_INDICADORES.md'),
  ('Unidades locais','Unidades locais de empresas e organizações','unidades locais','SOMA','/metodologias/PACOTE_F1_12_INDICADORES.md'),
  ('Pessoal ocupado assalariado','Pessoal ocupado assalariado','pessoas','SOMA','/metodologias/PACOTE_F1_12_INDICADORES.md'),
  ('Cobertura de abastecimento de água','Domicílios ligados à rede geral de água','%','NAO_AGREGAVEL','/metodologias/PACOTE_F1_12_INDICADORES.md'),
  ('Cobertura de esgotamento sanitário','Domicílios com esgotamento ligado à rede','%','NAO_AGREGAVEL','/metodologias/PACOTE_F1_12_INDICADORES.md')
)
INSERT INTO "Indicador"
  ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao",
   "Indicador_MetodologiaUrl","Indicador_StatusValidacao")
SELECT s."SubtemaConsulta_Id", n.nome, n.unidade, n.tipo, n.metodologia, 'EM_ANALISE'
FROM novos n JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_Nome" = n.subtema
WHERE NOT EXISTS (SELECT 1 FROM "Indicador" i WHERE i."Indicador_Nome" = n.nome);

CREATE TABLE IF NOT EXISTS "IndicadorLancamentoF1" (
  "IndicadorLancamentoF1_IndicadorId" int PRIMARY KEY
    REFERENCES "Indicador"("Indicador_Id"),
  "IndicadorLancamentoF1_Ordem" smallint NOT NULL UNIQUE CHECK ("IndicadorLancamentoF1_Ordem" BETWEEN 1 AND 12),
  "IndicadorLancamentoF1_Tema" text NOT NULL,
  "IndicadorLancamentoF1_CoberturaMinima" numeric(5,2) NOT NULL DEFAULT 100
    CHECK ("IndicadorLancamentoF1_CoberturaMinima" BETWEEN 0 AND 100),
  "IndicadorLancamentoF1_FontePreferencial" text NOT NULL,
  "IndicadorLancamentoF1_Observacao" text
);

WITH pacote(ordem,tema,indicador,fonte,observacao) AS (VALUES
  (1,'Demografia','População residente — Censo 2022','IBGE — Censo Demográfico 2022, tabela SIDRA 4714',NULL),
  (2,'Demografia','Densidade demográfica','IBGE — Censo Demográfico 2022, tabela SIDRA 4714',NULL),
  (3,'Saúde','Leitos de internação','CNES/DataSUS — TabNet','Estoque mensal; não confundir com leitos de UTI.'),
  (4,'Saúde','Estabelecimentos de saúde ativos','CNES/DataSUS — TabNet',NULL),
  (5,'Educação','Taxa de frequência escolar bruta — 6 a 14 anos','IBGE — Censo Demográfico 2022, tabela SIDRA 10056','Indicador percentual; não somar entre municípios.'),
  (6,'Educação','Pessoas de 6 a 17 anos que frequentavam escola','IBGE — Censo Demográfico 2022, tabela SIDRA 10058',NULL),
  (7,'Agronegócio','Área plantada','IBGE — PAM, tabela SIDRA 5457',NULL),
  (8,'Agronegócio','Valor da produção agrícola','IBGE — PAM, tabela SIDRA 5457',NULL),
  (9,'Economia — Setor Privado','Unidades locais de empresas e organizações','IBGE — CEMPRE, tabela SIDRA 1685','Série oficial encerrada em 2021; exibir selo DEFASADO.'),
  (10,'Economia — Setor Privado','Pessoal ocupado assalariado','IBGE — CEMPRE, tabela SIDRA 1685','Série oficial encerrada em 2021; exibir selo DEFASADO.'),
  (11,'Infraestrutura Macro','Domicílios ligados à rede geral de água','IBGE — Censo Demográfico 2022, tabela SIDRA 6803','Baseline censitário; substituir/conciliar com SINISA após curadoria.'),
  (12,'Infraestrutura Macro','Domicílios com esgotamento ligado à rede','IBGE — Censo Demográfico 2022, tabela SIDRA 6805','Baseline censitário; substituir/conciliar com SINISA após curadoria.')
)
-- Permite substituir, de forma idempotente, a composição do pacote sem
-- apagar os indicadores complementares nem suas observações históricas.
DELETE FROM "IndicadorLancamentoF1" f
USING pacote p
WHERE f."IndicadorLancamentoF1_Ordem" = p.ordem
  AND f."IndicadorLancamentoF1_IndicadorId" <> (
    SELECT i."Indicador_Id" FROM "Indicador" i WHERE i."Indicador_Nome" = p.indicador
  );

WITH pacote(ordem,tema,indicador,fonte,observacao) AS (VALUES
  (1,'Demografia','População residente — Censo 2022','IBGE — Censo Demográfico 2022, tabela SIDRA 4714',NULL),
  (2,'Demografia','Densidade demográfica','IBGE — Censo Demográfico 2022, tabela SIDRA 4714',NULL),
  (3,'Saúde','Leitos de internação','CNES/DataSUS — TabNet','Estoque mensal; não confundir com leitos de UTI.'),
  (4,'Saúde','Estabelecimentos de saúde ativos','CNES/DataSUS — TabNet',NULL),
  (5,'Educação','Taxa de frequência escolar bruta — 6 a 14 anos','IBGE — Censo Demográfico 2022, tabela SIDRA 10056','Indicador percentual; não somar entre municípios.'),
  (6,'Educação','Pessoas de 6 a 17 anos que frequentavam escola','IBGE — Censo Demográfico 2022, tabela SIDRA 10058',NULL),
  (7,'Agronegócio','Área plantada','IBGE — PAM, tabela SIDRA 5457',NULL),
  (8,'Agronegócio','Valor da produção agrícola','IBGE — PAM, tabela SIDRA 5457',NULL),
  (9,'Economia — Setor Privado','Unidades locais de empresas e organizações','IBGE — CEMPRE, tabela SIDRA 1685','Série oficial encerrada em 2021; exibir selo DEFASADO.'),
  (10,'Economia — Setor Privado','Pessoal ocupado assalariado','IBGE — CEMPRE, tabela SIDRA 1685','Série oficial encerrada em 2021; exibir selo DEFASADO.'),
  (11,'Infraestrutura Macro','Domicílios ligados à rede geral de água','IBGE — Censo Demográfico 2022, tabela SIDRA 6803','Baseline censitário; substituir/conciliar com SINISA após curadoria.'),
  (12,'Infraestrutura Macro','Domicílios com esgotamento ligado à rede','IBGE — Censo Demográfico 2022, tabela SIDRA 6805','Baseline censitário; substituir/conciliar com SINISA após curadoria.')
)
INSERT INTO "IndicadorLancamentoF1"
  ("IndicadorLancamentoF1_IndicadorId","IndicadorLancamentoF1_Ordem","IndicadorLancamentoF1_Tema",
   "IndicadorLancamentoF1_FontePreferencial","IndicadorLancamentoF1_Observacao")
SELECT i."Indicador_Id", p.ordem, p.tema, p.fonte, p.observacao
FROM pacote p JOIN "Indicador" i ON i."Indicador_Nome" = p.indicador
ON CONFLICT ("IndicadorLancamentoF1_IndicadorId") DO UPDATE SET
  "IndicadorLancamentoF1_Ordem" = EXCLUDED."IndicadorLancamentoF1_Ordem",
  "IndicadorLancamentoF1_Tema" = EXCLUDED."IndicadorLancamentoF1_Tema",
  "IndicadorLancamentoF1_FontePreferencial" = EXCLUDED."IndicadorLancamentoF1_FontePreferencial",
  "IndicadorLancamentoF1_Observacao" = EXCLUDED."IndicadorLancamentoF1_Observacao";

CREATE TABLE IF NOT EXISTS "ResultadoQualidadeIndicador" (
  "ResultadoQualidadeIndicador_Id" bigserial PRIMARY KEY,
  "ResultadoQualidadeIndicador_IndicadorId" int NOT NULL REFERENCES "Indicador"("Indicador_Id"),
  "ResultadoQualidadeIndicador_CargaId" int REFERENCES "Carga"("Carga_Id"),
  "ResultadoQualidadeIndicador_Status" text NOT NULL CHECK
    ("ResultadoQualidadeIndicador_Status" IN ('APROVADO_TECNICAMENTE','BLOQUEADO')),
  "ResultadoQualidadeIndicador_CoberturaPct" numeric(5,2) NOT NULL CHECK
    ("ResultadoQualidadeIndicador_CoberturaPct" BETWEEN 0 AND 100),
  "ResultadoQualidadeIndicador_Checagens" jsonb NOT NULL,
  "ResultadoQualidadeIndicador_CriadoEm" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carga_fonte ON "Carga" ("Carga_FonteId");
CREATE INDEX IF NOT EXISTS idx_observacao_fonte ON "Observacao" ("Observacao_FonteId");
CREATE INDEX IF NOT EXISTS idx_observacao_carga ON "Observacao" ("Observacao_CargaId");
CREATE INDEX IF NOT EXISTS idx_parecer_indicador ON "ParecerValidacao" ("ParecerValidacao_IndicadorId");
CREATE INDEX IF NOT EXISTS idx_quarentena_carga ON "Quarentena" ("Quarentena_CargaId");
CREATE INDEX IF NOT EXISTS idx_qualidade_indicador_data ON "ResultadoQualidadeIndicador"
  ("ResultadoQualidadeIndicador_IndicadorId", "ResultadoQualidadeIndicador_CriadoEm" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fonte_nome ON "Fonte" ("Fonte_Nome");

CREATE OR REPLACE VIEW "vw_ProntidaoLancamentoF1" AS
WITH ultima AS (
  SELECT p."IndicadorLancamentoF1_IndicadorId" indicador_id,
         max(o."Observacao_DataReferencia") referencia
  FROM "IndicadorLancamentoF1" p
  LEFT JOIN "Observacao" o ON o."Observacao_IndicadorId" = p."IndicadorLancamentoF1_IndicadorId"
  GROUP BY p."IndicadorLancamentoF1_IndicadorId"
), cobertura AS (
  SELECT p."IndicadorLancamentoF1_IndicadorId" indicador_id,
         count(DISTINCT o."Observacao_CodigoIbge") FILTER
           (WHERE mp."MunicipioPilotoF1_CodigoIbge" IS NOT NULL)::int municipios,
         bool_and(f."Fonte_BaseLegal" IS NOT NULL AND f."Fonte_Licenca" IS NOT NULL
           AND c."Carga_HashSha256" ~ '^[0-9a-f]{64}$'
           AND lower(f."Fonte_Nome") !~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
           AND lower(replace(c."Carga_CaminhoBronze", chr(92), '/')) NOT LIKE '%/demo/%')
           FILTER (WHERE o."Observacao_Id" IS NOT NULL) procedencia_ok
  FROM "IndicadorLancamentoF1" p
  JOIN ultima u ON u.indicador_id = p."IndicadorLancamentoF1_IndicadorId"
  LEFT JOIN "Observacao" o ON o."Observacao_IndicadorId" = p."IndicadorLancamentoF1_IndicadorId"
    AND o."Observacao_DataReferencia" = u.referencia
  LEFT JOIN "MunicipioPilotoF1" mp ON mp."MunicipioPilotoF1_CodigoIbge" = o."Observacao_CodigoIbge"
  LEFT JOIN "Fonte" f ON f."Fonte_Id" = o."Observacao_FonteId"
  LEFT JOIN "Carga" c ON c."Carga_Id" = o."Observacao_CargaId"
  GROUP BY p."IndicadorLancamentoF1_IndicadorId"
)
SELECT p."IndicadorLancamentoF1_Ordem" ordem,
       p."IndicadorLancamentoF1_Tema" tema,
       i."Indicador_Id" indicador_id,
       i."Indicador_Nome" indicador,
       i."Indicador_StatusValidacao" status_validacao,
       u.referencia,
       coalesce(c.municipios,0) municipios_piloto,
       round(coalesce(c.municipios,0) * 10.0, 2) cobertura_pct,
       coalesce(c.procedencia_ok,false) procedencia_ok,
       (coalesce(c.municipios,0) * 10.0 >= p."IndicadorLancamentoF1_CoberturaMinima"
        AND coalesce(c.procedencia_ok,false)) pronto_dados,
       (coalesce(c.municipios,0) * 10.0 >= p."IndicadorLancamentoF1_CoberturaMinima"
        AND coalesce(c.procedencia_ok,false)
        AND i."Indicador_StatusValidacao" = 'APROVADO') pronto_publicacao,
       p."IndicadorLancamentoF1_FontePreferencial" fonte_preferencial,
       p."IndicadorLancamentoF1_Observacao" observacao
FROM "IndicadorLancamentoF1" p
JOIN "Indicador" i ON i."Indicador_Id" = p."IndicadorLancamentoF1_IndicadorId"
JOIN ultima u ON u.indicador_id = i."Indicador_Id"
JOIN cobertura c ON c.indicador_id = i."Indicador_Id"
ORDER BY p."IndicadorLancamentoF1_Ordem";

GRANT SELECT ON "MunicipioPilotoF1", "IndicadorLancamentoF1", "ResultadoQualidadeIndicador",
  "vw_ProntidaoLancamentoF1" TO itmt_app;
