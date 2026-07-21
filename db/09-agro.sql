-- ============================================================
-- 09-agro.sql — abre o tema Agronegócio (RN-004: taxonomia é dado).
-- Cria o subtema "Área plantada" para receber a série PAM do IBGE
-- (SIDRA agregado 1612 / variável 214), ingerida pelo agente de fonte
-- 'pam' (F5) reusando o conector genérico. Nasce EM_CONSTRUCAO: passa a
-- DISPONIVEL quando o indicador for aprovado no ADMIN (RG-09).
-- Idempotente.
-- ============================================================
INSERT INTO "SubtemaConsulta"
 ("SubtemaConsulta_TemaId","SubtemaConsulta_Nome","SubtemaConsulta_Status")
SELECT t."TemaConsulta_Id", 'Área plantada', 'EM_CONSTRUCAO'
  FROM "TemaConsulta" t
 WHERE t."TemaConsulta_Nome" = 'Agronegócio'
   AND NOT EXISTS (
     SELECT 1 FROM "SubtemaConsulta" s WHERE s."SubtemaConsulta_Nome" = 'Área plantada'
   );
