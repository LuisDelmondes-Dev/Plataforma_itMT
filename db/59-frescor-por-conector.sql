-- ============================================================
-- 59-frescor-por-conector.sql (Evolução E15 · verificação ≠ ingestão ≠ latência ≠ frescor)
--
-- ADR-010, evolução E15: absorção CONCEITUAL do pacote externo "Core R2.1 —
-- Periodicidade e Orquestração" (C:\Users\Del\Downloads\ITMT_Core_R2_1_...,
-- 28/08/2026). O pacote separa dez conceitos que F2-R048 hoje comprime num
-- só: granularidade do dado, periodicidade da origem, periodicidade de
-- publicação, frequência de VERIFICAÇÃO, frequência de ingestão, LATÊNCIA
-- esperada, calendário, revisão retroativa, SLA e estado operacional
-- (FRESCOR). O DDL externo (10 tabelas em 3 schemas snake_case) NÃO é
-- copiado — como em toda evolução do ADR-010, a ideia entra adaptada à
-- convenção da casa, no catálogo vivo que já existe ("FonteConector",
-- db/55/56/58) e na agenda que já opera ("FonteSincronizacao", db/41).
--
-- O PROBLEMA REAL que esta migração corrige: F2-R048 usa janelas fixas por
-- TIPO (mensal→35 dias, anual→400) e um único conceito de "atraso". Isso
-- confunde três coisas distintas:
--   (a) de quanto em quanto tempo o ITMT deve VERIFICAR a origem
--       (cadência de checagem — barata, pode ser frequente);
--   (b) qual a LATÊNCIA normal entre o período de referência e a
--       publicação (o Caged de julho sai em agosto/setembro — a fonte NÃO
--       está "atrasada"; o PIB municipal de 2023 sai no fim de 2025 — idem);
--   (c) quando um silêncio vira ATENÇÃO vs ATRASO real.
-- A regra essencial do modelo externo, que É a nossa doutrina (irmã da
-- RN-005 "ausência é resposta"): **ausência de atualização não significa
-- automaticamente falha**. Antes de gritar, olhe a latência esperada.
--
-- O QUE ENTRA (cada campo com consumidor real em
-- api/scripts/sincronizar-fontes.mjs + fontes-registry.mjs, provado em
-- api/test/fontes-registry.test.mjs):
--   · "FonteConector_IntervaloVerificacaoDias" — cadência de CHECAGEM da
--     origem. NULL = herda a janela do tipo ("FonteConector_IntervaloDias"),
--     preservando byte a byte o comportamento atual (retrocompatível,
--     assertado em teste). Presente, desacopla "verificar" de "esperar
--     dado novo": CNES mensal pode ser checado toda semana sem que isso
--     signifique esperar dado semanal.
--   · "FonteConector_LatenciaEsperadaDias" — atraso NORMAL de publicação
--     entre o período de referência e a disponibilização. Entra no cálculo
--     de frescor: só depois de janela+latência um silêncio vira ATENCAO.
--   · "FonteConector_UltimaCompetencia" — até onde a fonte está carregada
--     (competência/ano). Fica NULL até que um conector REPORTE a
--     competência que carregou: hoje nenhum reporta (rodam como processos
--     filhos sem contrato de saída estruturada), e inventar um valor aqui
--     seria mentir. Quando o contrato de saída dos conectores nascer, a
--     sincronização preenche — o campo já espera no lugar certo.
--   · "FonteSincronizacao_Frescor" — estado operacional calculado a cada
--     rodada da sincronização (classificarFrescor, função pura em
--     fontes-registry.mjs): DESCONHECIDO | EM_DIA | ATENCAO | ATRASADO |
--     INDISPONIVEL.
--
-- VOCABULÁRIO REDUZIDO (corte deliberado, YAGNI): o modelo externo traz
-- também ADIANTADO, CRITICO e DESCONTINUADO. Não entram: ADIANTADO exige
-- calendário oficial de publicação para ter sentido (não temos), CRITICO
-- exige SLA formal com escalonamento (não temos consumidor), DESCONTINUADO
-- já é coberto por "FonteConector_Ativa"=false (aposentadoria sem apagar
-- história, db/55). Se um consumidor real nascer, o CHECK cresce por
-- migração — nunca por antecipação.
--
-- SEMÂNTICA DO FRESCOR (quem NÃO está em operação não está "atrasado"):
--   · BLOQUEADA_EXTERNA e PLANEJADA ⇒ DESCONHECIDO, sempre. Fonte que
--     espera convênio ou coletor não tem frescor a medir — marcá-la
--     ATRASADA seria o alerta falso que a regra essencial proíbe.
--   · EXECUTAVEL sem histórico de sucesso ⇒ DESCONHECIDO.
--   · Última tentativa FALHOU ⇒ INDISPONIVEL (isso sim é problema nosso).
--   · Dentro de janela+latência ⇒ EM_DIA; além, mas < 1,5× ⇒ ATENCAO;
--     além de 1,5× ⇒ ATRASADO.
--
-- O QUE NÃO MUDA (F2-R048 intacto): advisory lock único, execução
-- sequencial, upsert observável da agenda, retry de falha em ≤7 dias. A
-- cadência de verificação passa a usar _IntervaloVerificacaoDias QUANDO
-- presente; ausente, a janela do tipo manda como hoje.
--
-- FICA PARA DEPOIS (registrado, não esquecido — cada um espera consumidor
-- real, regra do ADR-010):
--   · calendário oficial de publicação por fonte (catalogo.calendario_
--     publicacao do modelo externo) e exceções/feriados;
--   · SLA formal com escalonamento (atenção→alerta→crítico) e incidentes;
--   · regra de revisão retroativa / reprocessamento de N competências
--     (nosso pipeline Bronze→Prata→Ouro já é idempotente por upsert, mas a
--     POLÍTICA de reprocessamento por fonte não existe);
--   · herança de política recurso > conjunto > fonte (nosso catálogo é
--     plano, um conector = uma política);
--   · painel de frescor para a Xingú ("este número é recente?") — a coluna
--     _Frescor já deixa a resposta pronta no banco.
--
-- SEEDS DE CURADORIA (só os 9 EXECUTÁVEIS — quem roda tem cadência real;
-- bloqueadas/planejadas herdam NULL: sem operação, não há cadência a
-- curar). Valores HONESTAMENTE ESTIMADOS da realidade de cada fonte, sem
-- precisão inventada — "estimada" está dito em cada justificativa, e
-- ajustar é UPDATE de curadoria por migração. Justificativas nos UPDATEs.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS; UPDATEs naturalmente idempotentes.
-- Grants: nenhum novo — itmt_app segue só com SELECT nas duas tabelas
-- (db/41 e db/55); quem escreve _Frescor é a sincronização, que roda como
-- dono, fora da API. Nada entra na catraca de menor privilégio.
-- ============================================================

-- ------------------------------------------------------------
-- 1) "FonteConector": cadência de checagem, latência esperada e
--    competência carregada — três conceitos, três colunas.
-- ------------------------------------------------------------
ALTER TABLE "FonteConector"
  ADD COLUMN IF NOT EXISTS "FonteConector_IntervaloVerificacaoDias" integer
    CHECK ("FonteConector_IntervaloVerificacaoDias" > 0),
  ADD COLUMN IF NOT EXISTS "FonteConector_LatenciaEsperadaDias" integer
    CHECK ("FonteConector_LatenciaEsperadaDias" >= 0),
  ADD COLUMN IF NOT EXISTS "FonteConector_UltimaCompetencia" text;

COMMENT ON COLUMN "FonteConector"."FonteConector_IntervaloVerificacaoDias" IS
  'E15: cadência de CHECAGEM da origem, em dias. NULL = herda "FonteConector_IntervaloDias" (janela do tipo, comportamento pré-E15). Verificar ≠ esperar dado novo.';
COMMENT ON COLUMN "FonteConector"."FonteConector_LatenciaEsperadaDias" IS
  'E15: atraso NORMAL entre o período de referência e a publicação, em dias (estimativa de curadoria). Silêncio dentro de janela+latência é EM_DIA, não atraso — "ausência de atualização não significa automaticamente falha".';
COMMENT ON COLUMN "FonteConector"."FonteConector_UltimaCompetencia" IS
  'E15: até onde a fonte está carregada (competência/ano). Preenchida pela sincronização QUANDO o conector reportar a competência carregada; NULL até existir esse contrato de saída — nunca inventada.';

-- ------------------------------------------------------------
-- 2) "FonteSincronizacao": o frescor calculado a cada rodada.
-- ------------------------------------------------------------
ALTER TABLE "FonteSincronizacao"
  ADD COLUMN IF NOT EXISTS "FonteSincronizacao_Frescor" text
    CHECK ("FonteSincronizacao_Frescor" IN
      ('DESCONHECIDO','EM_DIA','ATENCAO','ATRASADO','INDISPONIVEL'));

COMMENT ON COLUMN "FonteSincronizacao"."FonteSincronizacao_Frescor" IS
  'E15: estado operacional de frescor, gravado a cada rodada de sincronizar-fontes (classificarFrescor em scripts/fontes-registry.mjs). Vocabulário reduzido do Core R2.1: sem ADIANTADO/CRITICO/DESCONTINUADO até existir consumidor (corte documentado em db/59).';

-- ------------------------------------------------------------
-- 3) Curadoria dos 9 executáveis. Cada valor é uma ESTIMATIVA honesta da
--    realidade da fonte, dita como estimativa; refinar é UPDATE futuro.
-- ------------------------------------------------------------

-- IBGE — malha municipal: produto anual; a malha do ano-base costuma ser
-- divulgada ao longo do ano seguinte (~9 meses de latência, estimada).
-- Checagem mensal é barata na API de localidades.
UPDATE "FonteConector" SET
  "FonteConector_IntervaloVerificacaoDias"=30,
  "FonteConector_LatenciaEsperadaDias"=270
  WHERE "FonteConector_Slug"='ibge-territorio';

-- IBGE — estimativas de população: referência 1º de julho do ano X,
-- divulgação tipicamente em agosto/setembro do MESMO ano (prazo TCU) —
-- latência curta, ~3 meses (estimada). Checagem mensal.
UPDATE "FonteConector" SET
  "FonteConector_IntervaloVerificacaoDias"=30,
  "FonteConector_LatenciaEsperadaDias"=90
  WHERE "FonteConector_Slug"='ibge-populacao';

-- IBGE/SIDRA — PIB municipal: o PIB do ano X é divulgado ao fim de X+2
-- (defasagem estrutural conhecida de ~2 anos; estimada em 730 dias).
-- Sem essa latência declarada, o PIB pareceria eternamente "atrasado" —
-- exatamente o alerta falso que a E15 elimina.
UPDATE "FonteConector" SET
  "FonteConector_IntervaloVerificacaoDias"=30,
  "FonteConector_LatenciaEsperadaDias"=730
  WHERE "FonteConector_Slug"='ibge-pib';

-- IBGE — pacotes F1/F2: agregados SIDRA anuais heterogêneos (PAM, PPM,
-- educação, saneamento…), cada tabela com defasagem própria; adota-se
-- "uma safra" (~365 dias) como latência típica do conjunto (estimada —
-- é a régua honesta possível para um pacote heterogêneo).
UPDATE "FonteConector" SET
  "FonteConector_IntervaloVerificacaoDias"=30,
  "FonteConector_LatenciaEsperadaDias"=365
  WHERE "FonteConector_Slug" IN ('ibge-f1','ibge-f2');

-- CNES — competência mensal; o TabNet disponibiliza a competência com ~2
-- meses de defasagem (estimada em 60 dias). Checagem SEMANAL (7 dias):
-- verificar é barato e a fonte é a mais dinâmica do catálogo — é o caso
-- exemplar de "verificação frequente ≠ dado frequente".
UPDATE "FonteConector" SET
  "FonteConector_IntervaloVerificacaoDias"=7,
  "FonteConector_LatenciaEsperadaDias"=60
  WHERE "FonteConector_Slug"='cnes';

-- INEP — Censo Escolar: coleta no ano letivo X, divulgação dos resultados
-- tipicamente em janeiro/fevereiro de X+1 (~8 meses após a referência de
-- maio; estimada em 240 dias). Checagem mensal.
UPDATE "FonteConector" SET
  "FonteConector_IntervaloVerificacaoDias"=30,
  "FonteConector_LatenciaEsperadaDias"=240
  WHERE "FonteConector_Slug"='inep';

-- INPE — focos de queimadas: o dado bruto é quase em tempo real; o nosso
-- conector consome o consolidado anual, fechado logo após o fim do ano
-- (~1 mês; estimada em 30 dias). Checagem mensal.
UPDATE "FonteConector" SET
  "FonteConector_IntervaloVerificacaoDias"=30,
  "FonteConector_LatenciaEsperadaDias"=30
  WHERE "FonteConector_Slug"='inpe';

-- MapBiomas — por COLEÇÃO (não por calendário fixo): a coleção que cobre o
-- ano-base X é lançada tipicamente em agosto/setembro de X+1 (~8 meses;
-- estimada em 240 dias). Checagem mensal — o exemplo do próprio Core R2.1
-- ("MapBiomas: dado anual, nova coleção por edição, verificação semanal")
-- é adaptado ao nosso custo: mensal basta para uma coleção anual.
UPDATE "FonteConector" SET
  "FonteConector_IntervaloVerificacaoDias"=30,
  "FonteConector_LatenciaEsperadaDias"=240
  WHERE "FonteConector_Slug"='mapbiomas';

COMMENT ON TABLE "FonteSincronizacao" IS
  'F2-R048 + E15 (ADR-010): estado operacional da verificação incremental de fontes, agora com frescor por conector (verificação ≠ ingestão ≠ latência ≠ frescor, absorção conceitual do Core R2.1). Cargas continuam auditadas em Carga/Auditoria.';
