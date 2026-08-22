-- ============================================================
-- 46-taxonomia-disponivel-pos-parecer.sql
-- Fecha o ciclo RN-004 × RG-09: a ingestão promove o subtema
-- SEM_FONTE→EM_CONSTRUCAO quando a carga chega; faltava o elo em que o
-- parecer humano favorável torna o subtema DISPONIVEL na taxonomia —
-- sem ele, indicador aprovado com dado real fica invisível na UI
-- (subtema desabilitado). O endpoint de parecer passa a promover
-- (admin.controller.ts), o que exige UPDATE para o papel de aplicação.
-- ============================================================

GRANT UPDATE ON "SubtemaConsulta" TO itmt_app;

-- Reconciliação: subtemas que já têm indicador APROVADO com observação
-- (curadoria de 22/08/2026, EV-20260822-042/043) passam a DISPONIVEL.
-- Idempotente; não rebaixa nenhum subtema já DISPONIVEL.
UPDATE "SubtemaConsulta" s
   SET "SubtemaConsulta_Status" = 'DISPONIVEL'
 WHERE s."SubtemaConsulta_Status" <> 'DISPONIVEL'
   AND EXISTS (
     SELECT 1
       FROM "Indicador" i
       JOIN "Observacao" o ON o."Observacao_IndicadorId" = i."Indicador_Id"
      WHERE i."Indicador_SubtemaId" = s."SubtemaConsulta_Id"
        AND i."Indicador_StatusValidacao" = 'APROVADO'
   );
