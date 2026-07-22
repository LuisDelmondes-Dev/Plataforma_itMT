-- ============================================================
-- 13-ambiente.sql — Onda 4: subtemas de Meio Ambiente.
--
-- Pré-requisito dos conectores ambientais: o conector CSV aborta se o
-- subtema não existir, e indicador novo nasce EM_ANALISE (RG-09).
-- Subtema nasce SEM_FONTE (default) e só vira DISPONIVEL quando um
-- indicador aprovado tiver dado — o semáforo do portal é honesto
-- (RN-004): sem fonte é "sem fonte", nunca zero.
--
-- Fontes-alvo (registradas pelos conectores ao rodar):
--   Focos de queimadas ..... INPE / Programa Queimadas (CSV oficial)
--   Cobertura vegetal ...... MapBiomas (CSV oficial, CC-BY)
--   Silvicultura ........... IBGE PEVS (agregado 5930 — API online)
-- ============================================================

INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome")
SELECT t."TemaConsulta_Id", v.nome
  FROM "TemaConsulta" t
 CROSS JOIN (VALUES
   ('Focos de queimadas'),
   ('Cobertura vegetal nativa'),
   ('Silvicultura')
 ) AS v(nome)
 WHERE t."TemaConsulta_Nome" = 'Meio Ambiente'
   AND NOT EXISTS (
     SELECT 1 FROM "SubtemaConsulta" s
      WHERE s."SubtemaConsulta_TemaId" = t."TemaConsulta_Id"
        AND s."SubtemaConsulta_Nome" = v.nome);
