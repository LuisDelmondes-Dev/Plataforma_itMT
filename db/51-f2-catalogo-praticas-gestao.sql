-- ============================================================
-- 51-f2-catalogo-praticas-gestao.sql (Gauntlet "Pesquisa vs IA Xingú" — P7)
--
-- O bloco `dossie.sugestoes` do modo xingu deixa de ser um placeholder vazio:
-- o agente A16 passa a montar um DOSSIÊ DE SUGESTÕES determinístico. Doutrina
-- da casa (docs/spec/README.md — "dossiê, não decisão"): a sugestão SUBSIDIA o
-- gestor ("o dado X indica…; prática reconhecida: Y"), nunca ordena nem decide.
-- Para isso o A16 precisa de duas coisas que nascem aqui:
--
-- 1) "PraticaGestao" — catálogo CURADO e VERSIONADO de práticas reconhecidas
--    de gestão pública, cada uma com a fonte pública que a reconhece
--    (portaria, lei, manual, plataforma). O catálogo é seedado NA MIGRAÇÃO e
--    a aplicação NUNCA escreve nele (GRANT SELECT apenas — nada a acrescentar
--    na catraca do least-privilege.unit.mjs, que só audita INSERT/UPDATE/
--    DELETE). Catálogo global SEM RLS, como "Observacao"/"ObservacaoCausa":
--    conhecimento público, não é TENANT_OWNED. Curadoria = nova migração.
--
--    A chave de seleção é (Área da taxonomia, Gatilho determinístico):
--    o A16 detecta um gatilho no JSON do motor (município acima/abaixo da
--    média, tendência na série, causa dominante, cobertura incompleta) e
--    seleciona as práticas da área com aquele gatilho. A área 'GERAL' é o
--    valor reservado multiárea: práticas de leitura/qualidade de dado que
--    valem para qualquer tema — usadas também quando o indicador NÃO tem
--    polaridade declarada (aí o A16 não julga o desvio; apenas o constata e
--    sugere leitura comparada, nunca uma prática finalística de outra área).
--
-- 2) "Indicador_Polaridade" — metadado do CATÁLOGO que declara se, para o
--    indicador, valor maior é melhor (cobertura vacinal) ou menor é melhor
--    (mortalidade). Sem polaridade o motor NÃO julga desvio como bom ou ruim
--    (nada de "desfavorável" inventado): a coluna é NULL por padrão e só os
--    indicadores em que a direção é consenso sanitário a recebem aqui.
--    "Nascidos vivos" fica propositalmente SEM polaridade (é denominador
--    demográfico, não meta).
--
-- RG-03/RG-05 (contexto): nenhum numeral do texto de sugestão sai deste
-- arquivo para o usuário sem auditoria — o A16 audita os numerais do texto
-- contra o conjunto autorizado (valores do dossiê + metadados deterministicos
-- como "Portaria 72/2010"), e o caminho é 100% template, sem LLM.
-- ============================================================

ALTER TABLE "Indicador"
  ADD COLUMN IF NOT EXISTS "Indicador_Polaridade" text NULL
  CHECK ("Indicador_Polaridade" IN ('MAIOR_MELHOR','MENOR_MELHOR'));

-- Polaridade dos indicadores existentes em que a direção é consenso:
-- mortalidade (taxa e óbitos) menor é melhor; cobertura vacinal maior é
-- melhor. Nascidos vivos: sem polaridade (denominador, não meta).
UPDATE "Indicador" SET "Indicador_Polaridade" = 'MENOR_MELHOR'
 WHERE "Indicador_Nome" IN ('Óbitos infantis','Taxa de mortalidade infantil')
   AND "Indicador_Polaridade" IS NULL;
UPDATE "Indicador" SET "Indicador_Polaridade" = 'MAIOR_MELHOR'
 WHERE "Indicador_Nome" = 'Cobertura vacinal — poliomielite'
   AND "Indicador_Polaridade" IS NULL;

CREATE TABLE IF NOT EXISTS "PraticaGestao" (
  "PraticaGestao_Id"              serial PRIMARY KEY,
  -- Nome do TemaConsulta ('Saúde', 'Educação', …) ou 'GERAL' (multiárea).
  "PraticaGestao_Area"            text NOT NULL,
  "PraticaGestao_Gatilho"         text NOT NULL CHECK ("PraticaGestao_Gatilho" IN
    ('ACIMA_DA_MEDIA','ABAIXO_DA_MEDIA','TENDENCIA_ALTA','TENDENCIA_QUEDA',
     'CAUSA_DOMINANTE','COBERTURA_INCOMPLETA')),
  "PraticaGestao_Nome"            text NOT NULL,
  -- 1 a 2 frases, linguagem de secretaria: o que a prática é e o que habilita.
  "PraticaGestao_Descricao"       text NOT NULL,
  -- Documento/base pública que RECONHECE a prática (portaria, lei, manual).
  "PraticaGestao_FonteReferencia" text NOT NULL,
  UNIQUE ("PraticaGestao_Area","PraticaGestao_Gatilho","PraticaGestao_Nome")
);

-- Catálogo global (dado público, sem RLS); a app só LÊ — curadoria é migração.
GRANT SELECT ON "PraticaGestao" TO itmt_app;

-- ------------------------------------------------------------
-- Seed curado (idempotente). Cada linha cita o documento público que
-- reconhece a prática — nada aqui é recomendação inventada pela plataforma.
-- ------------------------------------------------------------
INSERT INTO "PraticaGestao"
  ("PraticaGestao_Area","PraticaGestao_Gatilho","PraticaGestao_Nome","PraticaGestao_Descricao","PraticaGestao_FonteReferencia")
VALUES
-- ===== Saúde · município com desvio desfavorável frente à média (mortalidade: menor é melhor) =====
('Saúde','ACIMA_DA_MEDIA','Vigilância e investigação do óbito infantil e fetal',
 'Investigar cada óbito infantil e fetal ocorrido no território, identificando falhas evitáveis na linha do cuidado e alimentando o SIM com a causa qualificada. A vigilância do óbito é obrigatória nos serviços de saúde do SUS.',
 'Portaria GM/MS nº 72, de 11 de janeiro de 2010 (vigilância do óbito infantil e fetal obrigatória no SUS)'),
('Saúde','ACIMA_DA_MEDIA','Comitê de prevenção do óbito infantil e fetal',
 'Instituir ou reativar o comitê municipal/regional que analisa os óbitos investigados, classifica a evitabilidade e recomenda medidas às equipes e à gestão. O comitê transforma cada óbito em aprendizado institucional.',
 'Ministério da Saúde — Manual dos comitês de prevenção do óbito infantil e fetal (2005)'),
('Saúde','ACIMA_DA_MEDIA','Qualificação do pré-natal na atenção primária',
 'Rever captação precoce da gestante, número e qualidade das consultas, exames e vinculação ao serviço de parto, conforme as diretrizes da rede de atenção materna e infantil.',
 'Rede Cegonha (Portaria GM/MS nº 1.459, de 24 de junho de 2011) e RAMI — Rede de Atenção Materna e Infantil (Portaria GM/MS nº 715, de 4 de abril de 2022)'),
('Saúde','ACIMA_DA_MEDIA','Pactuação interfederativa de metas',
 'Pactuar na comissão intergestores regional uma meta explícita de redução com apoio estadual, usando o indicador interfederativo correspondente como referência de acompanhamento.',
 'Resolução CIT nº 8, de 24 de novembro de 2016 (pactuação interfederativa de indicadores, inclui mortalidade infantil)'),

-- ===== Saúde · município abaixo da média (cobertura: maior é melhor) =====
('Saúde','ABAIXO_DA_MEDIA','Microplanejamento de vacinação com busca ativa',
 'Elaborar microplano local por território e público-alvo, com busca ativa de faltosos e ações extramuros, para recuperar coberturas vacinais em queda ou abaixo do esperado.',
 'OPAS/Ministério da Saúde — Microplanejamento para atividades de vacinação de alta qualidade (2022); Movimento Nacional pela Vacinação (2023)'),
('Saúde','ABAIXO_DA_MEDIA','Análise de situação de saúde (sala de situação)',
 'Analisar o desvio em sala de situação, cruzando o indicador com estrutura da rede, cobertura da atenção primária e perfil demográfico, antes de definir a intervenção.',
 'Ministério da Saúde — Asis: Análise de Situação de Saúde (livro-texto, 2015)'),

-- ===== Saúde · tendência de alta na série (mortalidade: menor é melhor) =====
('Saúde','TENDENCIA_ALTA','Vigilância e investigação do óbito infantil e fetal',
 'Diante de série em elevação, priorizar a investigação oportuna dos óbitos recentes para identificar o que mudou na linha do cuidado — a resposta rápida depende de causa conhecida.',
 'Portaria GM/MS nº 72, de 11 de janeiro de 2010 (vigilância do óbito infantil e fetal obrigatória no SUS)'),
('Saúde','TENDENCIA_ALTA','Revisão da linha de cuidado materna e infantil',
 'Rever pactos de referência do parto, transporte da gestante e retaguarda neonatal com a região de saúde, conforme o desenho da rede de atenção materna e infantil.',
 'RAMI — Rede de Atenção Materna e Infantil (Portaria GM/MS nº 715, de 4 de abril de 2022)'),

-- ===== Saúde · causa dominante na decomposição =====
('Saúde','CAUSA_DOMINANTE','Priorização por causas evitáveis',
 'Usar a classificação de evitabilidade para dirigir o esforço à causa que mais pesa: causas evitáveis por atenção à gestação, ao parto e ao recém-nascido respondem a intervenções conhecidas do SUS.',
 'Lista brasileira de causas de mortes evitáveis por intervenções do SUS (Malta et al., Epidemiologia e Serviços de Saúde, 2007; atualização 2010) — adotada pelo Ministério da Saúde/SVS'),
('Saúde','CAUSA_DOMINANTE','Qualificação da atenção ao parto e ao recém-nascido',
 'Quando o componente dominante é perinatal/neonatal, concentrar a ação na assistência ao parto e ao recém-nascido: boas práticas na maternidade, retaguarda neonatal e transporte seguro.',
 'Rede Cegonha (Portaria GM/MS nº 1.459, de 24 de junho de 2011) e RAMI (Portaria GM/MS nº 715, de 4 de abril de 2022)'),

-- ===== Educação =====
('Educação','ABAIXO_DA_MEDIA','Busca ativa escolar',
 'Identificar nominalmente crianças e adolescentes fora da escola ou em risco de abandono e acionar a rede intersetorial (educação, saúde, assistência) para rematrícula e permanência.',
 'Estratégia Busca Ativa Escolar — UNICEF/Undime (plataforma nacional, desde 2017)'),
('Educação','ABAIXO_DA_MEDIA','Monitoramento nominal de matrícula e frequência',
 'Acompanhar matrícula e frequência aluno a aluno a partir dos registros administrativos, conferindo a rede local contra o Censo Escolar para achar onde a matrícula se perde.',
 'Censo Escolar da Educação Básica — INEP (Decreto nº 6.425, de 4 de abril de 2008)'),
('Educação','TENDENCIA_QUEDA','Busca ativa escolar',
 'Série de matrículas em queda pede identificação nominal de quem saiu e por quê; a busca ativa intersetorial é a prática reconhecida para reverter abandono e evasão.',
 'Estratégia Busca Ativa Escolar — UNICEF/Undime (plataforma nacional, desde 2017)'),
('Educação','TENDENCIA_QUEDA','Garantia do transporte escolar',
 'Verificar se a oferta de transporte escolar acompanha a demanda das zonas rural e distante — a falta de transporte é causa direta e mensurável de perda de matrícula.',
 'PNATE — Programa Nacional de Apoio ao Transporte do Escolar (Lei nº 10.880, de 9 de junho de 2004; FNDE)'),

-- ===== GERAL (multiárea) · desvio factual quando o catálogo não declara polaridade =====
('GERAL','ACIMA_DA_MEDIA','Leitura comparada com municípios de porte semelhante',
 'Antes de qualquer conclusão, comparar o valor com municípios de porte e perfil semelhantes: sem polaridade declarada no catálogo, o desvio frente à média é um fato a interpretar, não um juízo.',
 'IBGE — Cidades e Estados (panorama municipal comparado)'),
('GERAL','ABAIXO_DA_MEDIA','Leitura comparada com municípios de porte semelhante',
 'Antes de qualquer conclusão, comparar o valor com municípios de porte e perfil semelhantes: sem polaridade declarada no catálogo, o desvio frente à média é um fato a interpretar, não um juízo.',
 'IBGE — Cidades e Estados (panorama municipal comparado)'),

-- ===== GERAL (multiárea) · cobertura incompleta do dado =====
('GERAL','COBERTURA_INCOMPLETA','Investigação da lacuna de registro',
 'Apurar com as unidades responsáveis pelo registro se a ausência de dado é falta de evento ou falta de notificação, e documentar o motivo — cobertura completa e desagregada é condição de comparabilidade.',
 'Agenda 2030/ONU — princípio da desagregação e cobertura dos dados ("não deixar ninguém para trás")'),
('GERAL','COBERTURA_INCOMPLETA','Publicação transparente da ausência de dado',
 'Manter a lacuna visível como "dado não disponível" no portal e nos relatórios, em vez de estimar ou ocultar — a transparência da ausência orienta a priorização da coleta.',
 'Política de Dados Abertos do Poder Executivo Federal (Decreto nº 8.777, de 11 de maio de 2016)')
ON CONFLICT ("PraticaGestao_Area","PraticaGestao_Gatilho","PraticaGestao_Nome") DO NOTHING;

COMMENT ON TABLE "PraticaGestao" IS
  'Gauntlet P7: catálogo curado de práticas reconhecidas de gestão pública, selecionadas pelo A16 por (área, gatilho determinístico). Seed vem da migração; a aplicação só lê (curadoria = nova migração). Área GERAL é o valor reservado multiárea.';
COMMENT ON COLUMN "Indicador"."Indicador_Polaridade" IS
  'MAIOR_MELHOR | MENOR_MELHOR | NULL. NULL = o motor não julga desvio como bom/ruim (sugestões apenas factuais, sem "desfavorável").';
