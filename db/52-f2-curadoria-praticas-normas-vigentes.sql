-- ============================================================
-- 52-f2-curadoria-praticas-normas-vigentes.sql (Gauntlet P7 · rodada 2)
--
-- VEREDITO DA RODADA 1 (crítico de gestão pública): VOLTAR — o catálogo
-- "PraticaGestao" (db/51) citava normas materno-infantis REVOGADAS num
-- dossiê que promete "fonte_referencia citável":
--   · RAMI — Portaria GM/MS nº 715, de 4 de abril de 2022 — REVOGADA pela
--     Portaria GM/MS nº 13, de 13 de janeiro de 2023 (art. 1º, V);
--   · Rede Cegonha — Portaria GM/MS nº 1.459, de 24 de junho de 2011 —
--     SUCEDIDA pela Rede Alyne (Portaria GM/MS nº 5.350, de 12 de setembro
--     de 2024, art. 2º: "fica a Rede Cegonha transformada na Rede Alyne").
-- Curadoria de catálogo é MIGRAÇÃO (db/51: a aplicação só LÊ a tabela) —
-- por isso a correção nasce aqui, não em código de aplicação.
--
-- FONTES CONFERIDAS NA WEB EM 27/08/2026 (builder da rodada 2):
--  [1] Rede Alyne — Portaria GM/MS nº 5.350, de 12/09/2024 (altera a
--      Portaria de Consolidação GM/MS nº 3/2017; transforma a Rede Cegonha):
--      https://bvsms.saude.gov.br/bvs/saudelegis/gm/2024/prt5350_13_09_2024.html
--      https://www.conass.org.br/conass-informa-n-152-2024-publicada-a-portaria-gm-n-5350-que-altera-a-portaria-de-consolidacao-gm-ms-no-3-de-28-de-setembro-de-2017-para-dispor-sobre-a-rede-alyne/
--  [2] Revogação da RAMI — Portaria GM/MS nº 13, de 13/01/2023:
--      https://bvsms.saude.gov.br/bvs/saudelegis/gm/2023/prt0013_16_01_2023.html
--      https://www.conass.org.br/conass-informa-n-06-2023-publicada-a-portaria-gm-n-13-que-revoga-portarias-que-especifica-e-da-outras-providencias/
--  [3] PNAB vigente — Anexo XXII da Portaria de Consolidação GM/MS nº 2,
--      de 28/09/2017 (consolida a Portaria nº 2.436/2017):
--      https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/MatrizesConsolidacao/Matriz-2-Politicas.html
--  [4] Caderneta da Criança — Ministério da Saúde, 6ª edição (2024):
--      https://www.gov.br/saude/pt-br/assuntos/noticias/2024/maio/conheca-a-6a-edicao-da-2018caderneta-da-crianca-2013-passaporte-da-cidadania2019-lancada-pelo-ministerio-da-saude
--
-- Além da troca das fontes, o veredito pediu duas práticas NOVAS para o eixo
-- COMPONENTE do gatilho CAUSA_DOMINANTE (o A16 passou a avaliar todas as
-- dimensões da decomposição — ver sugestoes.service.ts): pós-neonatal →
-- puericultura/atenção primária; neonatal → parto e recém-nascido na rede
-- vigente. O mapeamento componente→prática é explícito no código e casa pelo
-- NOME da prática ("puericultura" / "neonatal") — não renomear sem ajustar
-- PRATICA_POR_COMPONENTE em sugestoes.service.ts.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Fontes atualizadas para a norma vigente (idempotente por natureza).
--    A linhagem histórica permanece citável; a RAMI só aparece como
--    histórico, com a nota expressa de revogação.
-- ------------------------------------------------------------
UPDATE "PraticaGestao" SET "PraticaGestao_FonteReferencia" =
  'Rede Alyne — Portaria GM/MS nº 5.350, de 12 de setembro de 2024 (sucede a Rede Cegonha, Portaria GM/MS nº 1.459, de 24 de junho de 2011)'
 WHERE "PraticaGestao_Area" = 'Saúde'
   AND "PraticaGestao_Gatilho" = 'ACIMA_DA_MEDIA'
   AND "PraticaGestao_Nome" = 'Qualificação do pré-natal na atenção primária';

UPDATE "PraticaGestao" SET "PraticaGestao_FonteReferencia" =
  'Rede Alyne — Portaria GM/MS nº 5.350, de 12 de setembro de 2024. Histórico: RAMI (Portaria GM/MS nº 715/2022), revogada pela Portaria GM/MS nº 13, de 13 de janeiro de 2023'
 WHERE "PraticaGestao_Area" = 'Saúde'
   AND "PraticaGestao_Gatilho" = 'TENDENCIA_ALTA'
   AND "PraticaGestao_Nome" = 'Revisão da linha de cuidado materna e infantil';

UPDATE "PraticaGestao" SET "PraticaGestao_FonteReferencia" =
  'Rede Alyne — Portaria GM/MS nº 5.350, de 12 de setembro de 2024 (sucede a Rede Cegonha, Portaria GM/MS nº 1.459, de 24 de junho de 2011)'
 WHERE "PraticaGestao_Area" = 'Saúde'
   AND "PraticaGestao_Gatilho" = 'CAUSA_DOMINANTE'
   AND "PraticaGestao_Nome" = 'Qualificação da atenção ao parto e ao recém-nascido';

-- ------------------------------------------------------------
-- 2) Práticas novas para o eixo COMPONENTE dominante (normas VIGENTES,
--    conferidas acima). Idempotente pelo ON CONFLICT da chave natural.
-- ------------------------------------------------------------
INSERT INTO "PraticaGestao"
  ("PraticaGestao_Area","PraticaGestao_Gatilho","PraticaGestao_Nome","PraticaGestao_Descricao","PraticaGestao_FonteReferencia")
VALUES
('Saúde','CAUSA_DOMINANTE','Fortalecimento da puericultura na atenção primária',
 'Quando o componente pós-neonatal (28 a 364 dias) domina os óbitos, reforçar o acompanhamento da criança após a alta da maternidade: consultas de puericultura, visita domiciliar e vigilância do crescimento e do desenvolvimento registradas na Caderneta da Criança, sob coordenação da atenção primária.',
 'Política Nacional de Atenção Básica — Anexo XXII da Portaria de Consolidação GM/MS nº 2, de 28 de setembro de 2017; Caderneta da Criança — Ministério da Saúde (6ª edição, 2024)'),
('Saúde','CAUSA_DOMINANTE','Qualificação da assistência ao parto e ao nascimento (componente neonatal)',
 'Quando o componente neonatal (0 a 27 dias) domina os óbitos, concentrar a ação na assistência ao parto e ao nascimento: boas práticas na maternidade, reanimação em sala de parto, retaguarda de leitos neonatais e transporte seguro, no desenho da rede vigente de atenção materna e infantil.',
 'Rede Alyne — Portaria GM/MS nº 5.350, de 12 de setembro de 2024 (sucede a Rede Cegonha, Portaria GM/MS nº 1.459/2011)')
ON CONFLICT ("PraticaGestao_Area","PraticaGestao_Gatilho","PraticaGestao_Nome") DO NOTHING;

-- ------------------------------------------------------------
-- 3) Catraca dentro da própria migração: nenhuma fonte do catálogo pode
--    citar a Portaria 715/2022 sem a nota expressa de revogação, nem a
--    Rede Cegonha/1.459 sem registrar a sucessão pela Rede Alyne.
-- ------------------------------------------------------------
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "PraticaGestao"
   WHERE ("PraticaGestao_FonteReferencia" LIKE '%715%'
          AND "PraticaGestao_FonteReferencia" NOT ILIKE '%revogada%')
      OR ("PraticaGestao_FonteReferencia" LIKE '%1.459%'
          AND "PraticaGestao_FonteReferencia" NOT ILIKE '%sucede%'
          AND "PraticaGestao_FonteReferencia" NOT ILIKE '%sucedida%');
  IF n > 0 THEN
    RAISE EXCEPTION 'curadoria incompleta: % fonte(s) citando norma revogada sem nota de revogação/sucessão', n;
  END IF;
END $$;

COMMENT ON TABLE "PraticaGestao" IS
  'Gauntlet P7: catálogo curado de práticas reconhecidas de gestão pública, selecionadas pelo A16 por (área, gatilho determinístico). Seed vem da migração; a aplicação só lê (curadoria = nova migração, ex.: db/52 trocou RAMI/Rede Cegonha pela Rede Alyne vigente). Área GERAL é o valor reservado multiárea.';
