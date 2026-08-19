-- Substitui, no gate inicial, os dois indicadores de Educação que dependiam
-- do arquivo integral do Inep por séries municipais da API SIDRA/IBGE.
-- Os indicadores do Inep permanecem no catálogo como complementares.

WITH novos(tema, subtema) AS (VALUES
  ('Educação','Frequência escolar'),
  ('Educação','Pessoas que frequentavam escola')
)
INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status")
SELECT t."TemaConsulta_Id", n.subtema, 'SEM_FONTE'
FROM novos n JOIN "TemaConsulta" t ON t."TemaConsulta_Nome" = n.tema
WHERE NOT EXISTS (
  SELECT 1 FROM "SubtemaConsulta" s
  WHERE s."SubtemaConsulta_TemaId" = t."TemaConsulta_Id"
    AND s."SubtemaConsulta_Nome" = n.subtema
);

WITH novos(subtema,nome,unidade,tipo) AS (VALUES
  ('Frequência escolar','Taxa de frequência escolar bruta — 6 a 14 anos','%','NAO_AGREGAVEL'),
  ('Pessoas que frequentavam escola','Pessoas de 6 a 17 anos que frequentavam escola','pessoas','SOMA')
)
INSERT INTO "Indicador"
  ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade","Indicador_TipoAgregacao",
   "Indicador_MetodologiaUrl","Indicador_StatusValidacao")
SELECT s."SubtemaConsulta_Id", n.nome, n.unidade, n.tipo,
       '/metodologias/PACOTE_F1_12_INDICADORES.md', 'EM_ANALISE'
FROM novos n JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_Nome" = n.subtema
WHERE NOT EXISTS (SELECT 1 FROM "Indicador" i WHERE i."Indicador_Nome" = n.nome);

DELETE FROM "IndicadorLancamentoF1"
WHERE "IndicadorLancamentoF1_Ordem" IN (5, 6);

WITH pacote(ordem,indicador,fonte,observacao) AS (VALUES
  (5,'Taxa de frequência escolar bruta — 6 a 14 anos',
     'IBGE — Censo Demográfico 2022, tabela SIDRA 10056',
     'Indicador percentual; não somar entre municípios.'),
  (6,'Pessoas de 6 a 17 anos que frequentavam escola',
     'IBGE — Censo Demográfico 2022, tabela SIDRA 10058', NULL)
)
INSERT INTO "IndicadorLancamentoF1"
  ("IndicadorLancamentoF1_IndicadorId","IndicadorLancamentoF1_Ordem",
   "IndicadorLancamentoF1_Tema","IndicadorLancamentoF1_FontePreferencial",
   "IndicadorLancamentoF1_Observacao")
SELECT i."Indicador_Id", p.ordem, 'Educação', p.fonte, p.observacao
FROM pacote p JOIN "Indicador" i ON i."Indicador_Nome" = p.indicador;

