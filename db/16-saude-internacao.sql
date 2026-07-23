-- ============================================================
-- 16-saude-internacao.sql — subtema de leitos de internação (Saúde).
-- Destino do indicador "Leitos de internação" (CNES/DATASUS via TabNet,
-- cubo leiintmt). Distinto de "Número de leitos / vagas de UTI" (UTI é
-- cubo complementar, à parte). Nasce SEM_FONTE (RN-004).
-- ============================================================
INSERT INTO "SubtemaConsulta" ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome")
SELECT t."TemaConsulta_Id", 'Leitos de internação'
  FROM "TemaConsulta" t
 WHERE t."TemaConsulta_Nome" = 'Saúde'
   AND NOT EXISTS (
     SELECT 1 FROM "SubtemaConsulta" s
      WHERE s."SubtemaConsulta_TemaId" = t."TemaConsulta_Id"
        AND s."SubtemaConsulta_Nome" = 'Leitos de internação');
