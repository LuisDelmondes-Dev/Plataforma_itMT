-- ============================================================
-- 60-e3-status-do-dado.sql (Evolução E3 · status do dado como domínio curado)
--
-- ADR-010, evolução E3 — e a E11 ("fase de homologação do dado: preliminar ≠
-- consolidado", adendo Fase 2 R1) FUNDIDA aqui, como o próprio ADR mandou.
-- O problema real: o SIM/SINASC (e quase toda estatística pública) publica os
-- anos recentes como PRELIMINARES e só consolida com ~18 meses de defasagem.
-- O quinteto de procedência (api/src/common/procedencia.ts) diz DE ONDE o
-- número veio, mas não diz EM QUE FASE DE HOMOLOGAÇÃO ele está — um gestor
-- pode citar uma taxa recente sem saber que a fonte ainda vai revisá-la.
--
-- O QUE ENTRA (consumidor real: IndicadoresService anexa o status ao
-- quinteto de procedência em valor pontual, agregado, ranking e mapa;
-- ratchet: api/test/status-dado.unit.mjs):
--   · "Observacao_StatusDado" — coluna nova na tabela particionada
--     "Observacao" (ALTER no pai propaga a todas as partições), CHECK IN
--     ('PRELIMINAR','CONSOLIDADO','REVISADO'). NULL permitido e SIGNIFICANTE:
--     status desconhecido é ausência honesta (irmã da RN-005) — o motor OMITE
--     o campo, nunca chuta um default. Vocabulário mínimo do modelo externo
--     (Fase 2 R1, homologação Sinesp/SISDEPEN/SINISA), adaptado à convenção
--     da casa; estados intermediários (coletado/em crítica/homologado etc.)
--     só entram por migração quando uma fonte os documentar E houver
--     consumidor.
--   · Regra de agregação (documentada no código, provada no ratchet): em
--     RECALCULO/SOMA com parcelas de status divergente, o agregado reporta o
--     PIOR — PRELIMINAR contamina; parcela de status DESCONHECIDO impede
--     afirmar CONSOLIDADO/REVISADO (o campo é omitido: não se afirma o que
--     não se sabe).
--
-- CURADORIA DO DADO JÁ CARREGADO (só o que a evidência escrita sustenta):
--   · SIM/SINASC 2019–2024 (db/50) ⇒ CONSOLIDADO. Evidência: o cabeçalho do
--     db/50 documenta "dados FINAIS até 2024, atualizados em 02/12/2025 na
--     fonte" — a coleta de 2026-08-26 pegou a tabulação já consolidada pelo
--     MS (dado "final" do TabNet = consolidado; "REVISADO" ficaria para uma
--     republicação posterior documentada, que não há).
--   · NENHUM ano é marcado PRELIMINAR: o db/50 não documenta ano preliminar
--     algum, e inventar seria exatamente a mentira que esta coluna existe
--     para impedir.
--   · Todo o resto (seed demonstrativo db/02/05/07, CNES db/42, INPE db/43,
--     MapBiomas db/44, INEP db/45, SICONFI db/53) fica NULL: nenhum desses
--     arquivos documenta a fase de homologação do que carregou. NULL =
--     desconhecido, e desconhecido é resposta.
--
-- ADIADOS (os outros 3 sub-domínios da E3 do ADR — regra da casa: nada
-- entra sem consumidor real + teste no ratchet; cada um com seu gatilho):
--   · papel de território — gatilho: um conector/consulta que precise
--     distinguir papéis (sede de RGI, polo de consórcio, crosswalks da
--     proposta externa). Hoje TerritorioService resolve recorte por
--     malha/membership e nenhuma superfície pergunta "que papel este
--     município exerce".
--   · faixas etárias — gatilho: um conector que carregue dado POR faixa
--     etária como eixo próprio. Hoje o único uso (componente etário do
--     óbito infantil) já vive como dimensão curada 'COMPONENTE' no catálogo
--     "DimensaoObservacao" (E1, db/54) — criar tabela de faixas agora seria
--     duplicar vocabulário sem consumidor.
--   · causas evitáveis como domínio curado — gatilho: algo que precise
--     ENUMERAR/validar a lista SVS/MS além de exibi-la. Hoje os grupos da
--     lista (1.1–1.4, 2, 3) são categorias de 'CAUSA_EVITAVEL' em
--     "ObservacaoCausa" (db/49/50) e nenhum código valida contra uma tabela
--     de referência.
--   (Registrado também: "ObservacaoCausa" NÃO ganha a coluna nesta migração
--   — o consumidor provado é o quinteto do motor, que hoje nasce de
--   "Observacao"; estender às causas é migração futura quando a superfície
--   de causas exibir procedência com status.)
--
-- Grants: NENHUM novo. A coluna nasce em tabela cujos grants de tabela já
-- cobrem colunas novas — itmt_app tem SELECT/INSERT/UPDATE em "Observacao"
-- (db/01 + db/08/12); a ingestão real (api/scripts/ingestar-*.mjs e as
-- migrações de dados) roda como dono. Nada entra na catraca de menor
-- privilégio (test/least-privilege.unit.mjs).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS; UPDATE de curadoria naturalmente
-- idempotente (reaplicar produz o mesmo estado).
-- ============================================================

-- ------------------------------------------------------------
-- 1) A coluna: fase de homologação do dado na fonte. NULL = desconhecido.
-- ------------------------------------------------------------
ALTER TABLE "Observacao"
  ADD COLUMN IF NOT EXISTS "Observacao_StatusDado" text
    CHECK ("Observacao_StatusDado" IN ('PRELIMINAR','CONSOLIDADO','REVISADO'));

COMMENT ON COLUMN "Observacao"."Observacao_StatusDado" IS
  'E3 (ADR-010, E11 fundida): fase de homologação do dado NA FONTE — PRELIMINAR (sujeito a revisão), CONSOLIDADO (final) ou REVISADO (republicado após consolidação). NULL = desconhecido: a fonte/carga não documenta a fase, e o motor OMITE o campo em vez de chutar (ausência honesta, irmã da RN-005). Em agregações, PRELIMINAR contamina o agregado (pior status vence).';

-- ------------------------------------------------------------
-- 2) Curadoria do carregado: SIM/SINASC 2019–2024 ⇒ CONSOLIDADO.
--    Evidência: cabeçalho do db/50 — "dados FINAIS até 2024, atualizados em
--    02/12/2025 na fonte". Escopo restrito às DUAS fontes do db/50 e ao
--    período que o arquivo documenta; nada além disso é afirmável.
-- ------------------------------------------------------------
UPDATE "Observacao" o SET "Observacao_StatusDado" = 'CONSOLIDADO'
 WHERE o."Observacao_FonteId" IN (
         SELECT f."Fonte_Id" FROM "Fonte" f
          WHERE f."Fonte_Nome" IN (
            'SIM/DATASUS — Óbitos infantis (TabNet, inf10mt)',
            'SINASC/DATASUS — Nascidos vivos (TabNet, nvmt)'))
   AND o."Observacao_DataReferencia" >= '2019-01-01'
   AND o."Observacao_DataReferencia" <  '2025-01-01'
   AND o."Observacao_StatusDado" IS DISTINCT FROM 'CONSOLIDADO';

-- As demais observações (seed demo, CNES, INPE, MapBiomas, INEP, SICONFI)
-- permanecem NULL de propósito: nenhuma migração/carga documenta a fase de
-- homologação desses dados, e status não documentado não se inventa —
-- curadoria futura é UPDATE por migração, com a evidência no cabeçalho.
