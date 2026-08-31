-- ============================================================
-- 56-catalogo-conectores-programa-completo.sql (Evolução E2b · programa completo)
--
-- ADR-010, evolução E2b: o catálogo "FonteConector" (db/55) nasceu com o
-- recorte que o código já executava — 14 slugs (o registro aposentado de
-- fontes-registry.mjs + os 3 conectores do gauntlet). O PROGRAMA, porém, é
-- maior: a curadoria externa entregou duas matrizes de integração
-- (recebidas em 28/08/2026) que definem o horizonte completo de fontes:
--
--   · Fase 1 — "Matriz_Mestre_Integracoes_ITMT_Fase_1.xlsx", aba
--     "Matriz_Fase_1": 25 fontes (IBGE, portais MT, TCE-MT, diários
--     oficiais, SICONFI, PNCP, Transferegov, DATASUS, INEP, RFB, RAIS/CAGED,
--     INCRA, INPE, MapBiomas…), com prioridade P0/P1, dificuldade e URLs.
--   · Fase 2 — "ITMT_Fase2_Matriz_44_Fontes_Refinada.csv": 44 fontes em 11
--     áreas analíticas (saúde especializada, financiamento da educação,
--     segurança, agronegócio, energia, rodovias e logística, saneamento,
--     telecomunicações, mineração, turismo, assistência social).
--
-- Esta migração leva o catálogo ao programa completo COMO BACKLOG HONESTO,
-- não como promessa: nenhuma linha nova finge ter conector.
--
-- NOVO VOCABULÁRIO DE _Situacao (o CHECK de db/55 é recriado):
--   · EXECUTAVEL        — o coletor existe e roda (⇔ _Comando NOT NULL).
--   · BLOQUEADA_EXTERNA — depende de ato externo (autorização, arquivo
--     oficial, convênio); _MotivoBloqueio diz o passo humano.
--   · PLANEJADA         — backlog das matrizes: o coletor ainda NÃO foi
--     construído. NÃO é bloqueio externo — é trabalho futuro NOSSO. Sem
--     comando (nada a executar) e sem motivo de bloqueio (não há ato
--     externo pendente). Promover a EXECUTAVEL = construir o coletor e
--     fazer UPDATE de curadoria; a BLOQUEADA_EXTERNA = descobrir que a
--     fonte exige ato externo, com o motivo dito.
--   Os CHECKs bicondicionais de db/55 (_MotivoBloqueio ⇔ BLOQUEADA_EXTERNA;
--   _Comando ⇔ EXECUTAVEL) NÃO precisam mudar: para PLANEJADA os dois lados
--   esquerdos são falsos, logo motivo e comando são forçados a NULL —
--   exatamente a semântica desejada ("todo PLANEJADA sem comando").
--
-- COLUNAS NOVAS (metadados das matrizes; NULL onde a matriz não fala):
--   _Fase (1|2)  — matriz de origem;      _Area — área analítica (só F2);
--   _UrlOficial  — URL oficial da fonte;  _Prioridade (P0|P1);
--   _Dificuldade (Baixa|Media|Alta) — normalizada sem acento ("Média"→
--   "Media", como a matriz F2 já escreve).
--
-- DEDUPE (matriz → conector já existente = UPDATE de metadados, sem slug
-- novo; a situação/classe/comando existentes NÃO são tocados):
--   F1 linha  1 IBGE SIDRA            → ibge-populacao, ibge-pib, ibge-f1,
--                                        ibge-f2 (todos consomem SIDRA/
--                                        servicodados; cobertura parcial da
--                                        linha — demais tabelas SIDRA são
--                                        extensão dos pacotes, não fonte nova)
--   F1 linha  2 IBGE Localidades      → ibge-territorio
--   F1 linha 13 SICONFI               → siconfi-despesas
--   F1 linha 18 DATASUS/TABNET        → sim-obitos-infantis +
--                                        sinasc-nascidos-vivos (PARCIAL: só
--                                        SIM e SINASC). A linha AINDA entra
--                                        como PLANEJADA ('datasus-tabnet')
--                                        para os sistemas não cobertos
--                                        (SIH/SIA/SINAN/PNI/SISVAN) — ver o
--                                        comentário junto ao INSERT.
--   F1 linha 19 OpenDataSUS/CNES      → cnes
--   F1 linha 20 INEP Dados Abertos    → inep
--   F1 linha 24 INPE TerraBrasilis    → inpe (PARCIAL: focos de queimadas;
--                                        PRODES/DETER seguem no escopo da
--                                        mesma integração TerraBrasilis)
--   F1 linha 25 MapBiomas             → mapbiomas
--   F2 SESP_MT                        → sesp-mt (já BLOQUEADA_EXTERNA)
--   F2 SINFRA_MT                      → sinfra-estradas (mesmo órgão/mesma
--                                        integração; o recorte vicinal
--                                        existente é subconjunto da linha)
--   Conta: 25 F1 + 44 F2 = 69 linhas de matriz; 9 linhas viram UPDATE puro
--   (F1: 1, 2, 13, 19, 20, 24, 25; F2: SESP_MT, SINFRA_MT) e a linha F1-18
--   gera 1 slug novo além dos 2 existentes ⇒ 18 slugs novos da F1 + 42 da
--   F2 = 60 novos; 14 existentes + 60 = 74 conectores no catálogo.
--
-- SITUAÇÃO DOS NOVOS: PLANEJADA por padrão. BLOQUEADA_EXTERNA (com motivo)
-- SÓ onde a matriz declara convênio/vínculo obrigatório:
--   · tce-mt      — Radar é público, mas a carga estruturada (leiautes
--                   APLIC/SIAFIC) exige vínculo institucional com o TCE-MT;
--   · indea-mt    — rebanho/defesa sanitária dependem de convênio;
--   · energisa-mt — concessionária privada: dados só por convênio/acordo.
--   (sesp-mt já era BLOQUEADA_EXTERNA desde db/55 e assim permanece.)
--
-- CLASSE A–E (seção 41 da pesquisa) derivada do "Tipo de acesso"/"Acesso"
-- da matriz, nesta ordem de decisão:
--   A se cita API/webservice/CKAN;  senão C se cita GIS/WMS/WFS/
--   FeatureServer/geosserviço/download geoespacial;  senão B se cita dados
--   abertos/arquivos/CSV/planilhas/microdados/download;  D quando o acesso
--   é convênio obrigatório (as bloqueadas acima);  E para crawler/PDF/
--   painel/relatório/sistema sem API (diários oficiais, Data HUB, SINISA,
--   SESAI, SECEL, SETASC).
-- _Tipo operacional (vocabulário herdado de db/41): A→'API'; B/C/E→
-- 'DOWNLOAD'; D→'ARQUIVO_AUTORIZADO'.
-- Periodicidade da matriz → vocabulário de db/41 + janela: mensal ou mais
-- frequente (diária/semanal/contínua/subdiária)→MENSAL/35; anual/safra/por
-- edição→ANUAL/400; bimestral→EVENTUAL/70; semestral→EVENTUAL/185;
-- variável/sob demanda→EVENTUAL/180.
--
-- "FonteSincronizacao" (db/41) ganha o status 'PLANEJADA' no CHECK: o
-- sincronizador (scripts/sincronizar-fontes.mjs) registra o backlog na
-- agenda observável com a mesma elegância das bloqueadas — visível, nunca
-- executado (planoDeSincronizacao em scripts/fontes-registry.mjs decide;
-- provado por api/test/fontes-registry.test.mjs). O índice parcial de
-- pendentes passa a excluir também PLANEJADA.
--
-- Idempotente: constraints recriadas só quando ainda não aceitam PLANEJADA
-- (descoberta dinâmica do nome em pg_constraint, como db/54 — CHECK inline
-- ganha nome autogerado que não se hardcoda); colunas com IF NOT EXISTS;
-- seeds com ON CONFLICT DO NOTHING; UPDATEs naturalmente idempotentes.
-- Curadoria por migração: itmt_app continua só com SELECT (nada novo na
-- catraca de menor privilégio).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Vocabulário: _Situacao aceita PLANEJADA (FonteConector) e o status
--    PLANEJADA existe na agenda (FonteSincronizacao).
-- ------------------------------------------------------------
DO $$
DECLARE
  c record;
BEGIN
  -- CHECK de situação de db/55 (inline, nome autogerado): derruba só o
  -- CHECK que cita _Situacao, ainda não aceita PLANEJADA e NÃO é um dos
  -- bicondicionais (que citam _Comando/_MotivoBloqueio e ficam como estão).
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE contype = 'c'
       AND conrelid = '"FonteConector"'::regclass
       AND pg_get_constraintdef(oid) LIKE '%FonteConector\_Situacao%' ESCAPE '\'
       AND pg_get_constraintdef(oid) NOT LIKE '%PLANEJADA%'
       AND pg_get_constraintdef(oid) NOT LIKE '%FonteConector\_Comando%' ESCAPE '\'
       AND pg_get_constraintdef(oid) NOT LIKE '%FonteConector\_MotivoBloqueio%' ESCAPE '\'
  LOOP
    EXECUTE format('ALTER TABLE "FonteConector" DROP CONSTRAINT %I', c.conname);
    RAISE NOTICE 'db/56: CHECK % de "FonteConector" recriado com PLANEJADA', c.conname;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fonteconector_situacao_check') THEN
    ALTER TABLE "FonteConector" ADD CONSTRAINT fonteconector_situacao_check
      CHECK ("FonteConector_Situacao" IN ('EXECUTAVEL','BLOQUEADA_EXTERNA','PLANEJADA'));
  END IF;

  -- Mesmo tratamento para o status da agenda (db/41).
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE contype = 'c'
       AND conrelid = '"FonteSincronizacao"'::regclass
       AND pg_get_constraintdef(oid) LIKE '%FonteSincronizacao\_Status%' ESCAPE '\'
       AND pg_get_constraintdef(oid) NOT LIKE '%PLANEJADA%'
  LOOP
    EXECUTE format('ALTER TABLE "FonteSincronizacao" DROP CONSTRAINT %I', c.conname);
    RAISE NOTICE 'db/56: CHECK % de "FonteSincronizacao" recriado com PLANEJADA', c.conname;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fontesincronizacao_status_check') THEN
    ALTER TABLE "FonteSincronizacao" ADD CONSTRAINT fontesincronizacao_status_check
      CHECK ("FonteSincronizacao_Status" IN
        ('PENDENTE','EM_EXECUCAO','EM_DIA','ATUALIZADA','FALHA','BLOQUEADA_EXTERNA','PLANEJADA'));
  END IF;
END $$;

-- Pendentes = nem bloqueadas, nem backlog (recriação idempotente em efeito).
DROP INDEX IF EXISTS idx_fonte_sincronizacao_pendentes;
CREATE INDEX idx_fonte_sincronizacao_pendentes
  ON "FonteSincronizacao" ("FonteSincronizacao_ProximaVerificacao")
  WHERE "FonteSincronizacao_Status" NOT IN ('BLOQUEADA_EXTERNA','PLANEJADA');

-- ------------------------------------------------------------
-- 2) Metadados das matrizes.
-- ------------------------------------------------------------
ALTER TABLE "FonteConector"
  ADD COLUMN IF NOT EXISTS "FonteConector_Fase" integer
    CHECK ("FonteConector_Fase" IN (1,2)),
  ADD COLUMN IF NOT EXISTS "FonteConector_Area" text,
  ADD COLUMN IF NOT EXISTS "FonteConector_UrlOficial" text,
  ADD COLUMN IF NOT EXISTS "FonteConector_Prioridade" text
    CHECK ("FonteConector_Prioridade" IN ('P0','P1')),
  ADD COLUMN IF NOT EXISTS "FonteConector_Dificuldade" text
    CHECK ("FonteConector_Dificuldade" IN ('Baixa','Media','Alta'));

-- ------------------------------------------------------------
-- 3) DEDUPE: as 9 linhas de matriz já cobertas viram UPDATE de metadados
--    nos conectores existentes (mapeamento no cabeçalho). Situação, classe,
--    comando e motivo existentes NÃO são tocados.
-- ------------------------------------------------------------
UPDATE "FonteConector" SET
  "FonteConector_Fase"=1, "FonteConector_UrlOficial"='https://servicodados.ibge.gov.br/api/docs/localidades',
  "FonteConector_Prioridade"='P0', "FonteConector_Dificuldade"='Baixa'
  WHERE "FonteConector_Slug"='ibge-territorio';                       -- F1 linha 2
UPDATE "FonteConector" SET
  "FonteConector_Fase"=1, "FonteConector_UrlOficial"='https://sidra.ibge.gov.br/',
  "FonteConector_Prioridade"='P0', "FonteConector_Dificuldade"='Media'
  WHERE "FonteConector_Slug" IN ('ibge-populacao','ibge-pib','ibge-f1','ibge-f2'); -- F1 linha 1
UPDATE "FonteConector" SET
  "FonteConector_Fase"=1, "FonteConector_UrlOficial"='https://opendatasus.saude.gov.br/',
  "FonteConector_Prioridade"='P0', "FonteConector_Dificuldade"='Media'
  WHERE "FonteConector_Slug"='cnes';                                  -- F1 linha 19
UPDATE "FonteConector" SET
  "FonteConector_Fase"=1, "FonteConector_UrlOficial"='https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos',
  "FonteConector_Prioridade"='P0', "FonteConector_Dificuldade"='Alta'
  WHERE "FonteConector_Slug"='inep';                                  -- F1 linha 20
UPDATE "FonteConector" SET
  "FonteConector_Fase"=1, "FonteConector_UrlOficial"='https://terrabrasilis.dpi.inpe.br/',
  "FonteConector_Prioridade"='P0', "FonteConector_Dificuldade"='Alta'
  WHERE "FonteConector_Slug"='inpe';                                  -- F1 linha 24
UPDATE "FonteConector" SET
  "FonteConector_Fase"=1, "FonteConector_UrlOficial"='https://brasil.mapbiomas.org/',
  "FonteConector_Prioridade"='P0', "FonteConector_Dificuldade"='Alta'
  WHERE "FonteConector_Slug"='mapbiomas';                             -- F1 linha 25
UPDATE "FonteConector" SET
  "FonteConector_Fase"=1, "FonteConector_UrlOficial"='https://www.siconfi.tesouro.gov.br/',
  "FonteConector_Prioridade"='P0', "FonteConector_Dificuldade"='Alta'
  WHERE "FonteConector_Slug"='siconfi-despesas';                      -- F1 linha 13
UPDATE "FonteConector" SET
  "FonteConector_Fase"=1, "FonteConector_UrlOficial"='https://datasus.saude.gov.br/informacoes-de-saude-tabnet/',
  "FonteConector_Prioridade"='P0', "FonteConector_Dificuldade"='Alta'
  WHERE "FonteConector_Slug" IN ('sim-obitos-infantis','sinasc-nascidos-vivos'); -- F1 linha 18 (parcial)
UPDATE "FonteConector" SET
  "FonteConector_Fase"=2, "FonteConector_Area"='Seguranca publica',
  "FonteConector_UrlOficial"='https://www.sesp.mt.gov.br/',
  "FonteConector_Prioridade"='P0', "FonteConector_Dificuldade"='Alta'
  WHERE "FonteConector_Slug"='sesp-mt';                               -- F2 SESP_MT
UPDATE "FonteConector" SET
  "FonteConector_Fase"=2, "FonteConector_Area"='Rodovias e logistica',
  "FonteConector_UrlOficial"='https://www.sinfra.mt.gov.br/',
  "FonteConector_Prioridade"='P0', "FonteConector_Dificuldade"='Alta'
  WHERE "FonteConector_Slug"='sinfra-estradas';                       -- F2 SINFRA_MT

-- ------------------------------------------------------------
-- 4) SEEDS do programa completo (60 slugs novos; ordem = sequência da
--    matriz, F1 antes de F2). PLANEJADA salvo onde o cabeçalho justifica
--    BLOQUEADA_EXTERNA. Nenhuma linha nova carrega comando: honestidade.
-- ------------------------------------------------------------
INSERT INTO "FonteConector"
  ("FonteConector_Slug","FonteConector_Nome","FonteConector_Origem",
   "FonteConector_ClasseIntegracao","FonteConector_Tipo",
   "FonteConector_Periodicidade","FonteConector_IntervaloDias",
   "FonteConector_Situacao","FonteConector_MotivoBloqueio",
   "FonteConector_Comando","FonteConector_ConfigIngestao","FonteConector_Ordem",
   "FonteConector_Fase","FonteConector_Area","FonteConector_UrlOficial",
   "FonteConector_Prioridade","FonteConector_Dificuldade")
VALUES
  -- ===== Fase 1 (Matriz_Mestre_Integracoes_ITMT_Fase_1, 28/08/2026) =====
  ('ibge-geociencias','IBGE — Geociências / malhas territoriais','IBGE',
   'C','DOWNLOAD','ANUAL',400,'PLANEJADA',NULL,NULL,NULL,150,
   1,NULL,'https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais.html','P0','Media'),
  ('dados-gov-br','Portal Brasileiro de Dados Abertos (dados.gov.br)','Governo Federal',
   'A','API','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,160,
   1,NULL,'https://dados.gov.br/','P1','Media'),
  ('dados-abertos-mt','Dados Abertos MT (CKAN estadual)','SEPLAG-MT',
   'A','API','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,170,
   1,NULL,'https://dadosabertos.mt.gov.br/','P0','Media'),
  ('datahub-mt','Dados MT / Data HUB MT','SEPLAG-MT',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,180,
   1,NULL,'https://dados.mt.gov.br/','P1','Media'),
  ('transparencia-mt','Portal da Transparência de Mato Grosso','Governo de MT',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,190,
   1,NULL,'https://www.transparencia.mt.gov.br/','P0','Media'),
  ('intermat-intergeo','INTERMAT / INTERGEO — base cartográfica estadual','INTERMAT-MT',
   'C','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,200,
   1,NULL,'https://intergeo.intermat.mt.gov.br/','P0','Media'),
  ('sema-mt','SEMA-MT Geoportal (SIMGEO/GeoServer)','SEMA-MT',
   'C','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,210,
   1,NULL,'https://sema.mt.gov.br/transparencia/index.php/sistemas/simgeo','P0','Alta'),
  ('tce-mt','TCE-MT — APLIC / Radar / SIAFIC-MT','TCE-MT',
   'D','ARQUIVO_AUTORIZADO','MENSAL',35,'BLOQUEADA_EXTERNA',
   'Radar tem painéis e exportações públicas, mas a carga estruturada (leiautes APLIC/SIAFIC) exige vínculo institucional com o TCE-MT — parceria formal antes de qualquer conector.',
   NULL,NULL,220,
   1,NULL,'https://radar.tce.mt.gov.br/','P0','Alta'),
  ('iomat','IOMAT — Diário Oficial de Mato Grosso','IOMAT',
   'E','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,230,
   1,NULL,'https://iomat.mt.gov.br/','P1','Alta'),
  ('amm-diario','Jornal Oficial AMM-MT','AMM-MT',
   'E','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,240,
   1,NULL,'https://amm.diariomunicipal.org/','P1','Alta'),
  ('transparencia-federal','Portal da Transparência do Governo Federal','CGU',
   'A','API','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,250,
   1,NULL,'https://portaldatransparencia.gov.br/','P0','Media'),
  ('pncp','PNCP — Portal Nacional de Contratações Públicas','MGI / Comitê Gestor PNCP',
   'A','API','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,260,
   1,NULL,'https://www.gov.br/pncp/pt-br/','P0','Media'),
  ('transferegov','Transferegov.br','MGI',
   'A','API','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,270,
   1,NULL,'https://www.gov.br/transferegov/','P0','Media'),
  ('obrasgov','ObrasGov.br','MGI',
   'A','API','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,280,
   1,NULL,'https://www.gov.br/obrasgov/','P0','Media'),
  -- F1 linha 18 (DATASUS) além do já coberto: SIM e SINASC têm conectores
  -- próprios desde db/55 (sim-obitos-infantis, sinasc-nascidos-vivos, via
  -- TabNet/exportação manual); esta linha PLANEJADA cobre os DEMAIS
  -- sistemas da matriz (SIH, SIA, SINAN, PNI, SISVAN) por arquivos
  -- nacionais DBC/DBF — coletor ainda não construído.
  ('datasus-tabnet','DATASUS — demais sistemas (SIH, SIA, SINAN, PNI, SISVAN)','Ministério da Saúde',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,290,
   1,NULL,'https://datasus.saude.gov.br/informacoes-de-saude-tabnet/','P0','Alta'),
  ('rfb-cnpj','Receita Federal — Dados Abertos CNPJ','Receita Federal',
   'B','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,300,
   1,NULL,'https://www.gov.br/receitafederal/dados','P0','Alta'),
  ('rais-caged','RAIS / Novo CAGED — microdados','Ministério do Trabalho e Emprego',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,310,
   1,NULL,'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/microdados-rais-e-caged','P0','Alta'),
  ('incra-sigef','INCRA — Acervo Fundiário / SIGEF','INCRA',
   'C','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,320,
   1,NULL,'https://acervofundiario.incra.gov.br/','P0','Alta'),
  -- ===== Fase 2 (ITMT_Fase2_Matriz_44_Fontes_Refinada, 28/08/2026) =====
  ('siops','SIOPS — Orçamentos Públicos em Saúde','Ministério da Saúde/FNS',
   'A','API','EVENTUAL',70,'PLANEJADA',NULL,NULL,NULL,330,
   2,'Saude especializada e financiamento','https://portalfns.saude.gov.br/siops/siops-downloads/','P0','Media'),
  ('sisab','SISAB / e-Gestor APS','Ministério da Saúde',
   'A','API','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,340,
   2,'Saude especializada e financiamento','https://sisab.saude.gov.br/','P0','Alta'),
  ('pni','PNI / OpenDataSUS — Vacinação','Ministério da Saúde',
   'A','API','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,350,
   2,'Saude especializada e financiamento','https://opendatasus.saude.gov.br/','P0','Media'),
  ('sisvan','SISVAN — vigilância alimentar e nutricional','Ministério da Saúde',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,360,
   2,'Saude especializada e financiamento','https://sisaps.saude.gov.br/sisvan/','P1','Media'),
  ('sivep-gripe','SIVEP-Gripe — SRAG','Ministério da Saúde',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,370,
   2,'Saude especializada e financiamento','https://opendatasus.saude.gov.br/','P1','Alta'),
  ('sesai','SESAI — Saúde Indígena','Ministério da Saúde',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,380,
   2,'Saude especializada e financiamento','https://www.gov.br/saude/pt-br/composicao/sesai','P1','Alta'),
  ('ans','ANS Dados Abertos — saúde suplementar','Agência Nacional de Saúde Suplementar',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,390,
   2,'Saude especializada e financiamento','https://dadosabertos.ans.gov.br/','P1','Media'),
  ('ses-mt','SES-MT — indicadores e sistemas estaduais de saúde','Secretaria de Estado de Saúde de MT',
   'B','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,400,
   2,'Saude especializada e financiamento','https://www.saude.mt.gov.br/','P0','Alta'),
  ('siope','SIOPE — Orçamentos Públicos em Educação','FNDE',
   'B','DOWNLOAD','EVENTUAL',70,'PLANEJADA',NULL,NULL,NULL,410,
   2,'Financiamento da educacao','https://www.fnde.gov.br/siope/','P0','Media'),
  ('fnde','FNDE Dados Abertos — repasses e programas','FNDE',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,420,
   2,'Financiamento da educacao','https://www.gov.br/fnde/pt-br/acesso-a-informacao/dados-abertos','P0','Media'),
  ('inep-fin','INEP — indicadores financeiros educacionais','INEP',
   'B','DOWNLOAD','ANUAL',400,'PLANEJADA',NULL,NULL,NULL,430,
   2,'Financiamento da educacao','https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos','P1','Media'),
  ('sinesp-vde','Sinesp VDE — indicadores criminais nacionais','Ministério da Justiça e Segurança Pública',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,440,
   2,'Seguranca publica','https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica','P0','Media'),
  ('sisdepen','SISDEPEN — sistema prisional','SENAPPEN',
   'B','DOWNLOAD','EVENTUAL',185,'PLANEJADA',NULL,NULL,NULL,450,
   2,'Seguranca publica','https://www.gov.br/senappen/pt-br/servicos/sisdepen/bases-de-dados','P0','Media'),
  ('prf','PRF Dados Abertos — acidentes rodoviários','Polícia Rodoviária Federal',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,460,
   2,'Seguranca publica','https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos','P0','Media'),
  ('mapa','MAPA — Dados Abertos / SIGSIF / SIPEAGRO / ZARC / Agrostat','Ministério da Agricultura e Pecuária',
   'A','API','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,470,
   2,'Agronegocio','https://www.gov.br/agricultura/pt-br/acesso-a-informacao/dadosabertos','P0','Alta'),
  ('conab','CONAB Dados Abertos — safras e estoques','CONAB',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,480,
   2,'Agronegocio','https://www.conab.gov.br/info-agro/dados-abertos','P0','Media'),
  ('indea-mt','INDEA-MT — rebanho e defesa sanitária','INDEA-MT',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Rebanho e defesa sanitária animal/vegetal dependem de convênio com o INDEA-MT; sem o acordo não há acesso estruturado aos dados.',
   NULL,NULL,490,
   2,'Agronegocio','https://www.indea.mt.gov.br/','P0','Alta'),
  ('embrapa','Embrapa GeoInfo','Embrapa',
   'C','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,500,
   2,'Agronegocio','https://geoinfo.dados.embrapa.br/','P1','Media'),
  ('aneel','ANEEL Dados Abertos / SIGA','ANEEL',
   'A','API','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,510,
   2,'Energia','https://dadosabertos.aneel.gov.br/','P0','Media'),
  ('ons','ONS Dados Abertos — carga e geração','Operador Nacional do Sistema Elétrico',
   'A','API','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,520,
   2,'Energia','https://dados.ons.org.br/','P0','Alta'),
  ('epe','EPE Dados Abertos — consumo e projeções','Empresa de Pesquisa Energética',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,530,
   2,'Energia','https://www.epe.gov.br/pt/publicacoes-dados-abertos/dados-abertos','P0','Media'),
  ('energisa-mt','Energisa Mato Grosso — indicadores operacionais','Energisa MT',
   'D','ARQUIVO_AUTORIZADO','MENSAL',35,'BLOQUEADA_EXTERNA',
   'Concessionária privada: indicadores operacionais locais e interrupções só por convênio/relatórios acordados com a Energisa MT.',
   NULL,NULL,540,
   2,'Energia','https://www.energisa.com.br/','P1','Alta'),
  ('dnit','DNIT Dados Abertos — SNV, pavimento, tráfego e obras','DNIT',
   'B','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,550,
   2,'Rodovias e logistica','https://www.gov.br/dnit/pt-br/acesso-a-informacao/dados-abertos','P0','Alta'),
  ('antt','ANTT Dados Abertos','ANTT',
   'B','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,560,
   2,'Rodovias e logistica','https://dados.antt.gov.br/','P0','Media'),
  ('antaq','ANTAQ Dados Abertos','ANTAQ',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,570,
   2,'Rodovias e logistica','https://dados.gov.br/dados/organizacoes/visualizar/agencia-nacional-de-transportes-aquaviarios','P1','Media'),
  ('anac','ANAC Dados Abertos','ANAC',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,580,
   2,'Rodovias e logistica','https://www.gov.br/anac/pt-br/acesso-a-informacao/dados-abertos','P1','Media'),
  ('infra-sa','Infra S.A. Dados Abertos','Infra S.A.',
   'B','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,590,
   2,'Rodovias e logistica','https://www.infrasa.gov.br/dados-abertos/','P1','Media'),
  ('sinisa','SINISA — saneamento (sucessor do SNIS)','Ministério das Cidades',
   'E','DOWNLOAD','ANUAL',400,'PLANEJADA',NULL,NULL,NULL,600,
   2,'Saneamento e recursos hidricos','https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa','P0','Alta'),
  ('snis','SNIS — série histórica de saneamento','Ministério das Cidades',
   'B','DOWNLOAD','ANUAL',400,'PLANEJADA',NULL,NULL,NULL,610,
   2,'Saneamento e recursos hidricos','https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/snis','P0','Media'),
  ('ana','ANA / SNIRH / HidroWeb / Atlas','ANA',
   'A','API','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,620,
   2,'Saneamento e recursos hidricos','https://www.snirh.gov.br/','P0','Alta'),
  ('anatel','ANATEL Dados Abertos — acessos e cobertura','ANATEL',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,630,
   2,'Telecomunicacoes','https://www.gov.br/anatel/pt-br/dados/dados-abertos','P0','Alta'),
  ('cetic','Cetic.br — TIC Domicílios','NIC.br / Cetic.br',
   'B','DOWNLOAD','ANUAL',400,'PLANEJADA',NULL,NULL,NULL,640,
   2,'Telecomunicacoes','https://cetic.br/','P1','Media'),
  ('anm','ANM Dados Abertos / SIGMINE / CFEM / SIGBM','Agência Nacional de Mineração',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,650,
   2,'Mineracao e geologia','https://dadosabertos.anm.gov.br/','P0','Alta'),
  ('sgb','GeoSGB — Serviço Geológico do Brasil','Serviço Geológico do Brasil',
   'C','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,660,
   2,'Mineracao e geologia','https://geosgb.sgb.gov.br/','P0','Alta'),
  ('mtur','Ministério do Turismo — Cadastur / Mapa do Turismo','Ministério do Turismo',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,670,
   2,'Turismo','https://www.gov.br/turismo/','P0','Media'),
  ('secel-mt','SECEL-MT — turismo e cultura','SECEL-MT',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,680,
   2,'Turismo','https://www.secel.mt.gov.br/','P1','Alta'),
  ('cadunico','Cadastro Único — dados agregados','MDS',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,690,
   2,'Assistencia social','https://www.gov.br/mds/pt-br/acoes-e-programas/cadastro-unico/dados-e-ferramentas-do-cadastro-unico','P0','Alta'),
  ('censo-suas','Censo SUAS','MDS',
   'B','DOWNLOAD','ANUAL',400,'PLANEJADA',NULL,NULL,NULL,700,
   2,'Assistencia social','https://aplicacoes.mds.gov.br/sagirmps/portal-censo/','P0','Media'),
  ('mds','MDS Dados Abertos — benefícios sociais','MDS',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,710,
   2,'Assistencia social','https://www.gov.br/mds/pt-br/acesso-a-informacao/dados-abertos','P0','Media'),
  ('fnas','FNAS — transferências fundo a fundo','FNAS/MDS',
   'B','DOWNLOAD','MENSAL',35,'PLANEJADA',NULL,NULL,NULL,720,
   2,'Assistencia social','https://fnas.mds.gov.br/','P1','Media'),
  ('mapa-osc','Mapa das OSCs','IPEA',
   'A','API','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,730,
   2,'Assistencia social','https://mapaosc.ipea.gov.br/','P1','Media'),
  ('setasc-mt','SETASC-MT — rede e indicadores sociais','Governo de Mato Grosso',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,740,
   2,'Assistencia social','https://www.setasc.mt.gov.br/','P0','Alta')
ON CONFLICT ("FonteConector_Slug") DO NOTHING;

COMMENT ON TABLE "FonteConector" IS
  'Evolução E2/E2b (ADR-010): catálogo curado do registro de conectores de fontes — o recorte executável de db/55 mais o PROGRAMA COMPLETO das matrizes de integração (25 fontes F1 + 44 fontes F2, 28/08/2026) como backlog honesto: PLANEJADA = coletor ainda não construído (trabalho futuro nosso), BLOQUEADA_EXTERNA = depende de ato externo. Fonte de verdade de sincronizar-fontes (F2-R048); conector novo = linha de curadoria, sem mudança de código.';
