-- ============================================================
-- 15-agro-pecuaria.sql — subtema de pecuária no Agronegócio.
-- Destino do indicador "Efetivo do rebanho bovino" (IBGE PPM,
-- agregado 3939, variável 105, classificação 79[2670]).
-- Nasce SEM_FONTE (RN-004); vira DISPONIVEL quando o indicador
-- aprovado tiver dado.
-- ============================================================
INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome")
SELECT t."TemaConsulta_Id", 'Efetivo de rebanho'
  FROM "TemaConsulta" t
 WHERE t."TemaConsulta_Nome" = 'Agronegócio'
   AND NOT EXISTS (
     SELECT 1 FROM "SubtemaConsulta" s
      WHERE s."SubtemaConsulta_TemaId" = t."TemaConsulta_Id"
        AND s."SubtemaConsulta_Nome" = 'Efetivo de rebanho');
