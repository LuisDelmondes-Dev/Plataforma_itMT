-- Fase 1: caso de referencia dos anexos. O indicador entra no catalogo,
-- mas o subtema permanece SEM_FONTE ate uma carga oficial ser validada.

INSERT INTO "SubtemaConsulta"
  ("SubtemaConsulta_TemaId", "SubtemaConsulta_Nome", "SubtemaConsulta_Status")
SELECT t."TemaConsulta_Id", 'Estradas vicinais', 'SEM_FONTE'
  FROM "TemaConsulta" t
 WHERE t."TemaConsulta_Nome" = 'Infraestrutura Macro'
   AND NOT EXISTS (
     SELECT 1 FROM "SubtemaConsulta" s
      WHERE s."SubtemaConsulta_TemaId" = t."TemaConsulta_Id"
        AND s."SubtemaConsulta_Nome" = 'Estradas vicinais'
   );

INSERT INTO "Indicador"
  ("Indicador_SubtemaId", "Indicador_Nome", "Indicador_Unidade",
   "Indicador_TipoAgregacao", "Indicador_MetodologiaUrl", "Indicador_StatusValidacao")
SELECT s."SubtemaConsulta_Id", 'Extensão de estradas vicinais', 'km', 'SOMA',
       'docs/metodologias/EXTENSAO_ESTRADAS_VICINAIS.md', 'APROVADO'
  FROM "SubtemaConsulta" s
 WHERE s."SubtemaConsulta_Nome" = 'Estradas vicinais'
   AND NOT EXISTS (
     SELECT 1 FROM "Indicador" i
      WHERE i."Indicador_Nome" = 'Extensão de estradas vicinais'
   );

INSERT INTO "ParecerValidacao"
  ("ParecerValidacao_IndicadorId", "ParecerValidacao_Parecerista",
   "ParecerValidacao_Decisao", "ParecerValidacao_Justificativa")
SELECT i."Indicador_Id", 'Comitê de Dados — Fase 1', 'APROVADO',
       'Aprovação da definição metodológica e do catálogo. Publicação de valores depende de fonte oficial e carga validada.'
  FROM "Indicador" i
 WHERE i."Indicador_Nome" = 'Extensão de estradas vicinais'
   AND NOT EXISTS (
     SELECT 1 FROM "ParecerValidacao" p
      WHERE p."ParecerValidacao_IndicadorId" = i."Indicador_Id"
        AND p."ParecerValidacao_Decisao" = 'APROVADO'
   );

