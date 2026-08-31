-- ============================================================
-- 66-e21-malha-vigente-por-data.sql — ADR-010 · Evolução E21
-- MALHA TERRITORIAL VIGENTE NA DATA DE REFERÊNCIA. Fecha o gap entre um dado
-- que a plataforma JÁ tinha e um motor que nunca o consultava.
--
-- O GAP, MEDIDO (não estimado):
-- "Municipio_DataInstalacao" nasceu no db/57 (E4) e, até aqui, era usada 11
-- vezes DENTRO do próprio db/57 e em nenhum outro lugar do programa:
-- `grep -rn "DataInstalacao" api/src/` devolvia ZERO. A plataforma sabia
-- quando cada município foi instalado e o motor tratava os 142 municípios
-- como universo fixo em QUALQUER ano.
-- Consequência concreta, medida no banco dev (leitura, 31/08/2026): para o
-- indicador "População residente — Censo 2022" (db/19), que tem cobertura
-- COMPLETA da malha real de 2022, o ranking respondia
-- `total_municipios: 142, ausentes: 1 (5101837)` — quando a verdade é
-- `141, ausentes: 0`. Boa Esperança do Norte (5101837) foi instalado em
-- 2025-01-01: em 2022 ele não era dado faltante, ESTAVA FORA DO UNIVERSO.
-- Contar ausência onde não há território é o espelho da imputação que a
-- RN-005 proíbe — ali se inventa número, aqui se inventa lacuna.
--
-- AS DUAS EVIDÊNCIAS EXTERNAS QUE CONFIRMAM A REGRA:
-- 1) FONTE OFICIAL, medida ao vivo por nós em 31/08/2026: a API SIDRA do
--    IBGE (tabela 4709, variável 93, período 2022, nível município, UF 51)
--    devolve EXATAMENTE 141 registros, e Boa Esperança do Norte NÃO está
--    entre eles. Conferido como CONJUNTO EXATO contra o snapshot desta base:
--    zero diferença nos dois sentidos (nenhum código da fonte falta aqui,
--    nenhum código daqui sobra lá).
-- 2) DOCUMENTAÇÃO EXTERNA, pacote "Core R2.3.4": modela a mesma regra como
--    `referencia.municipios_mt_validos_em(data)` e a promove a GATE
--    BLOQUEANTE de homologação (H03). NADA de DDL foi copiado (o pacote usa
--    outro esquema, outra nomenclatura e uma tabela `territorio` genérica
--    que esta casa não tem); o que se absorve é a TESE: "quais municípios
--    existiam na data X" é pergunta de PRIMEIRA CLASSE do motor, não
--    detalhe de carga. Provado no laboratório: 141 em 2024-12-31, 142 em
--    2025-01-01.
--
-- A DECISÃO — FUNÇÃO, e por quê:
-- - VIEW foi rejeitada: view não recebe parâmetro, e a pergunta é
--   inerentemente parametrizada pela data. Uma view "vigente hoje" seria
--   pior que o bug, porque congelaria o presente sobre a série histórica.
-- - COLUNA DERIVADA foi rejeitada: um booleano "vigente" só pode ser
--   verdadeiro em relação a UMA data; materializá-lo obrigaria a reescrever
--   a tabela a cada consulta de outro ano.
-- - FUNÇÃO SQL STABLE é o que a casa já faz para pergunta parametrizada com
--   grant próprio ("ResolverApiClientePorHash", db/29; "ContextoTenant_Id",
--   db/24) e é consumível pelo IndicadoresService sem contorcionismo: um
--   `SELECT ... FROM "MunicipiosVigentesEm"($1::date)` substitui, linha por
--   linha, o `SELECT ... FROM "Municipio"` que hoje devolve o universo fixo.
--   Devolve codigo_ibge E nome porque são exatamente as duas colunas que o
--   ranking() já lia; o mapa() usa só a primeira.
--
-- A SEMÂNTICA DO NULL (a metade que carrega o peso):
-- "Municipio_DataInstalacao" é NULL em 141 dos 142 municípios — NULL
-- significa "existe desde sempre no horizonte desta base", NÃO "data
-- desconhecida que invalida a linha". A guarda do db/57 (linhas 1815 e
-- 1837) já é exatamente `DataInstalacao IS NULL OR <= data`, e esta função
-- não inventa regra nova: PROMOVE A PREDICADO NOMEADO a que o db/57 já
-- escrevia inline. Escrever só `<= p_data` devolveria UM município em vez
-- de 141 — o erro seria catastrófico e silencioso, por isso está dito aqui
-- e travado no ratchet (api/test/malha-vigente.unit.mjs).
--
-- SEGURANÇA: SECURITY INVOKER (o default) de propósito — "Municipio" já é
-- legível por itmt_app (db/01) e não tem RLS, então SECURITY DEFINER seria
-- privilégio sem necessidade. search_path fixado mesmo assim (higiene da
-- casa). REVOKE de PUBLIC + GRANT EXECUTE só a itmt_app: menor privilégio,
-- coberto por test/least-privilege.unit.mjs.
--
-- ADIADO, COM GATILHO:
-- a) EXTINÇÃO/FUSÃO de município ("valido_ate" no vocabulário do pacote
--    externo). MT não teve nenhuma no horizonte desta base, e a coluna não
--    existe em "Municipio" — inventá-la agora seria schema sem consumidor,
--    o corte YAGNI da régua do db/59. GATILHO: a primeira lei estadual de
--    extinção/fusão curada. A função é o ponto ÚNICO onde o predicado
--    entraria (`AND (DataExtincao IS NULL OR DataExtincao > p_data)`) — é
--    justamente por isso que ela é função e não predicado espalhado.
-- b) SUCESSÃO TERRITORIAL (o território de Boa Esperança do Norte saiu de
--    outro município; comparar 2022 com 2025 compara malhas diferentes).
--    Exige o ato oficial de desmembramento com as parcelas de área/população
--    — dado que não temos. GATILHO: curadoria da lei de criação com o
--    município de origem. Até lá o motor NÃO afirma continuidade: ele
--    responde por data, que é a verdade disponível.
-- c) resolverRecorte('ESTADO') no TerritorioService continua sobre a malha
--    inteira, DE PROPÓSITO: ali o conjunto é FILTRO de observação, e
--    município não instalado não tem observação ≤ referência — a mudança
--    seria numericamente inerte e tocaria todos os recortes. GATILHO: se
--    algum dia existir observação datada ANTES da instalação (hoje
--    impossível: o db/57 apaga essas linhas e o ratchet trava).
--
-- Idempotente: CREATE OR REPLACE + grants repetíveis. Não escreve dado.
-- ============================================================

CREATE OR REPLACE FUNCTION "MunicipiosVigentesEm"(p_data date)
RETURNS TABLE (codigo_ibge char(7), nome text)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT m."Municipio_CodigoIbge", m."Municipio_Nome"
    FROM public."Municipio" m
   -- NULL = existe desde sempre no horizonte da base (141 de 142 hoje).
   WHERE m."Municipio_DataInstalacao" IS NULL
      OR m."Municipio_DataInstalacao" <= p_data
   ORDER BY m."Municipio_CodigoIbge"
$$;

COMMENT ON FUNCTION "MunicipiosVigentesEm"(date) IS
  'E21/ADR-010: malha municipal vigente na data (RN-001/RN-005). '
  'DataInstalacao NULL = vigente sempre. Municipio fora do universo na data '
  'NAO e ausencia de dado — nao entra em cobertura nem em ausentes.';

REVOKE ALL ON FUNCTION "MunicipiosVigentesEm"(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "MunicipiosVigentesEm"(date) TO itmt_app;
