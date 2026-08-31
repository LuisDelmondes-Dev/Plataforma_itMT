-- ============================================================
-- 55-catalogo-conectores-fonte.sql (Evolução E2 · registro de conectores)
--
-- ADR-010 (docs/adr/ADR-010-absorcao-arquitetura-analitica.md), evolução E2:
-- o registro de conectores de fontes sai do CÓDIGO e vira catálogo curado no
-- BANCO. A própria pesquisa que motivou o ADR manda (C:\DevClaude\Analise das
-- fontes.md, seção 36): "Esse cadastro não deve ficar codificado no software."
-- Até aqui ele ficava: api/scripts/fontes-registry.mjs era um array hardcoded
-- de 12 entradas — adicionar/bloquear/aposentar um conector exigia editar
-- JavaScript. A partir desta migração, "FonteConector" é a ÚNICA fonte de
-- verdade: fontes-registry.mjs vira um leitor (sem fallback hardcoded — banco
-- sem db/55 recebe erro mandando migrar) e um conector novo é uma linha de
-- curadoria por migração, provado sem mudança de código por
-- api/test/fontes-registry.test.mjs (prova de extensibilidade, espírito da E1).
--
-- ESCOPO CONTIDO (de propósito): SÓ o registro de conectores. O cadastro de
-- fontes POR MUNICÍPIO da seção 36 (fonte_dados por prefeitura/câmara/portal)
-- fica para quando a colheita municipal existir — tabela sem consumidor real
-- seria especulação, contra a regra do ADR ("cada uma com consumidor real no
-- código e teste no ratchet").
--
-- CLASSE DE INTEGRAÇÃO (seção 41 da pesquisa — "Eu classificaria as
-- integrações em 5 níveis"): A=API oficial, B=dados abertos/arquivos, C=GIS,
-- D=convênio institucional, E=crawler/OCR. Prioridade A→B→C→D→E. As classes
-- do seed são derivadas da NATUREZA REAL de cada integração, não inventadas:
--   · ibge-*            → A (APIs oficiais IBGE/SIDRA — servicodados/agregados)
--   · cnes              → E (CNES via TabNet: raspagem de página sem API pelo
--                          coletor Python; o _Tipo herdado continua 'API' —
--                          ver nota de compatibilidade abaixo)
--   · inep              → B (microdados/arquivos de dados abertos do INEP)
--   · inpe              → B (arquivos de dados abertos de focos de queimadas)
--   · mapbiomas         → C (coleções geoespaciais de cobertura — GIS)
--   · sesp-mt           → D (exige autorização formal e arquivo oficial)
--   · sinfra-estradas   → D (arquivo validado pelo órgão responsável)
--   · sim-*/sinasc-*    → E (TabNet/DATASUS: página sem API — hoje sem crawler
--                          implementado; carga por exportação manual do CSV)
--   · siconfi-despesas  → A (API oficial do Tesouro — a própria seção 41 cita
--                          SICONFI como exemplo de classe A)
--
-- NOTA DE COMPATIBILIDADE (colunas além do esboço da E2): _Tipo,
-- _IntervaloDias e _Comando existem porque o consumidor real do registro —
-- scripts/sincronizar-fontes.mjs (F2-R048, db/41 "FonteSincronizacao") —
-- precisa exatamente deles: _Tipo alimenta "FonteSincronizacao_Tipo" (mesmo
-- CHECK de db/41: API/DOWNLOAD/ARQUIVO_AUTORIZADO — vocabulário OPERACIONAL
-- herdado, distinto da classe da pesquisa, que descreve a natureza),
-- _IntervaloDias alimenta a janela de verificação, e _Comando é a linha de
-- execução do conector. Sem elas o catálogo não substituiria o hardcoded —
-- viraria uma segunda lista pela metade.
--
-- SEMÂNTICA DE _Situacao (a mesma honestidade de F2-R048):
--   · EXECUTAVEL        ⇒ _Comando NOT NULL — o agendador pode rodar sozinho.
--   · BLOQUEADA_EXTERNA ⇒ _MotivoBloqueio NOT NULL e _Comando NULL — a fonte
--     NÃO é sincronizável de forma autônoma e o motivo diz o passo humano
--     (autorização, arquivo oficial, exportação manual). É a regra da casa:
--     "fonte que exige arquivo oficial informa o passo manual em vez de
--     inventar download". Nunca se inventa um comando que não existe.
--
-- CONECTORES DO GAUNTLET (sim/sinasc/siconfi) ENTRAM no seed: as três configs
-- já existem em api/ingest-configs/ e o dado real já está no banco (db/50 e
-- db/53); deixá-las fora do catálogo repetiria o defeito que a E2 corrige
-- (cadastro implícito, espalhado). Entram como BLOQUEADA_EXTERNA porque hoje
-- nenhum coletor as automatiza: TabNet (SIM/SINASC) não expõe API e a DCA do
-- SICONFI ainda não tem conector — a carga vigente é exportação/consulta
-- manual + scripts/ingestar-csv.mjs com a config apontada em _ConfigIngestao
-- (ou curadoria por migração, como db/50 e db/53). Quando um coletor nascer,
-- a promoção a EXECUTAVEL é UPDATE de curadoria, não código.
--
-- _ConfigIngestao aponta o arquivo 1:1 em api/ingest-configs/ quando houver;
-- cnes e inep ficam NULL porque o grupo do coletor Python cobre VÁRIAS configs
-- (cnes-*.json, inep-*.json) — o vínculo 1:N vive no coletor, não aqui.
--
-- Curadoria por migração, como "PraticaGestao" (db/51) e
-- "DimensaoObservacao" (db/54): itmt_app recebe SÓ SELECT — nada entra na
-- catraca de menor privilégio (least-privilege.unit.mjs). Aposentadoria é
-- _Ativa=false (sai da listagem sem apagar história); remoção física, nunca.
-- ============================================================

CREATE TABLE IF NOT EXISTS "FonteConector" (
  -- Slug estável usado em --fonte <slug>, em "FonteSincronizacao_Slug" e nos
  -- logs; SEMPRE kebab-case (minúsculas/dígitos separados por hífen).
  "FonteConector_Slug" text PRIMARY KEY
    CHECK ("FonteConector_Slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  "FonteConector_Nome" text NOT NULL,
  -- Instituição de origem (quem publica o dado).
  "FonteConector_Origem" text NOT NULL,
  -- Classe de integração da pesquisa (seção 41): natureza da integração.
  "FonteConector_ClasseIntegracao" text NOT NULL
    CHECK ("FonteConector_ClasseIntegracao" IN ('A','B','C','D','E')),
  -- Vocabulário OPERACIONAL herdado de db/41 (alimenta "FonteSincronizacao_Tipo").
  "FonteConector_Tipo" text NOT NULL
    CHECK ("FonteConector_Tipo" IN ('API','DOWNLOAD','ARQUIVO_AUTORIZADO')),
  "FonteConector_Periodicidade" text NOT NULL
    CHECK ("FonteConector_Periodicidade" IN ('MENSAL','ANUAL','EVENTUAL')),
  -- Janela de verificação em dias (mesmos limites de db/41).
  "FonteConector_IntervaloDias" integer NOT NULL
    CHECK ("FonteConector_IntervaloDias" BETWEEN 1 AND 3660),
  "FonteConector_Situacao" text NOT NULL
    CHECK ("FonteConector_Situacao" IN ('EXECUTAVEL','BLOQUEADA_EXTERNA')),
  -- Obrigatório quando (e somente quando) bloqueada: o motivo é o passo humano.
  "FonteConector_MotivoBloqueio" text
    CHECK (("FonteConector_Situacao" = 'BLOQUEADA_EXTERNA')
         = ("FonteConector_MotivoBloqueio" IS NOT NULL)),
  -- Linha de execução do conector (argv). Obrigatória quando (e somente
  -- quando) executável: BLOQUEADA_EXTERNA nunca carrega comando inventado.
  "FonteConector_Comando" text[]
    CHECK (("FonteConector_Situacao" = 'EXECUTAVEL')
         = ("FonteConector_Comando" IS NOT NULL)),
  -- Arquivo 1:1 em api/ingest-configs/, quando houver.
  "FonteConector_ConfigIngestao" text
    CHECK ("FonteConector_ConfigIngestao" IS NULL
        OR "FonteConector_ConfigIngestao" ~ '^[a-z0-9][a-z0-9-]*\.json$'),
  -- Ordem canônica de listagem (a mesma do array hardcoded aposentado).
  "FonteConector_Ordem" integer NOT NULL,
  "FonteConector_Ativa" boolean NOT NULL DEFAULT true
);

-- Seed = EXATAMENTE o conteúdo do fontes-registry.mjs aposentado (mesmos
-- slugs, nomes, tipos, periodicidades, janelas, comandos, situações e motivos,
-- na mesma ordem) + os três conectores do gauntlet (racional no cabeçalho).
INSERT INTO "FonteConector"
  ("FonteConector_Slug","FonteConector_Nome","FonteConector_Origem",
   "FonteConector_ClasseIntegracao","FonteConector_Tipo",
   "FonteConector_Periodicidade","FonteConector_IntervaloDias",
   "FonteConector_Situacao","FonteConector_MotivoBloqueio",
   "FonteConector_Comando","FonteConector_ConfigIngestao","FonteConector_Ordem")
VALUES
  ('ibge-territorio','IBGE — Malha municipal','IBGE',
   'A','API','ANUAL',400,'EXECUTAVEL',NULL,
   ARRAY['node','scripts/ingestar-ibge-territorio.mjs'],NULL,10),
  ('ibge-populacao','IBGE — População estimada','IBGE',
   'A','API','ANUAL',400,'EXECUTAVEL',NULL,
   ARRAY['node','scripts/ingestar-ibge-ultimo.mjs','populacao'],NULL,20),
  ('ibge-pib','IBGE/SIDRA — PIB municipal','IBGE',
   'A','API','ANUAL',400,'EXECUTAVEL',NULL,
   ARRAY['node','scripts/ingestar-ibge-ultimo.mjs','pib'],NULL,30),
  ('ibge-f1','IBGE — Pacote territorial F1','IBGE',
   'A','API','ANUAL',400,'EXECUTAVEL',NULL,
   ARRAY['node','scripts/ingestar-pacote-f1-ibge.mjs'],NULL,40),
  ('ibge-f2','IBGE — Pacote temático F2','IBGE',
   'A','API','ANUAL',400,'EXECUTAVEL',NULL,
   ARRAY['node','scripts/ingestar-pacote-f2-ibge.mjs'],NULL,50),
  ('cnes','CNES/DATASUS — leitos e estabelecimentos',
   'Ministério da Saúde — DATASUS',
   'E','API','MENSAL',35,'EXECUTAVEL',NULL,
   ARRAY['python','-m','coletores.coletar_fontes','--grupo','cnes'],NULL,60),
  ('inep','INEP — Censo Escolar','INEP/MEC',
   'B','DOWNLOAD','ANUAL',400,'EXECUTAVEL',NULL,
   ARRAY['python','-m','coletores.coletar_fontes','--grupo','inep'],NULL,70),
  ('inpe','INPE — focos de queimadas','INPE/MCTI',
   'B','DOWNLOAD','ANUAL',400,'EXECUTAVEL',NULL,
   ARRAY['python','-m','coletores.coletar_fontes','--fonte','inpe'],
   'inpe-queimadas.json',80),
  ('mapbiomas','MapBiomas — cobertura vegetal','Projeto MapBiomas',
   'C','DOWNLOAD','ANUAL',400,'EXECUTAVEL',NULL,
   ARRAY['python','-m','coletores.coletar_fontes','--fonte','mapbiomas'],
   'mapbiomas-cobertura.json',90),
  ('sesp-mt','SESP-MT — ocorrências criminais','SESP-MT',
   'D','ARQUIVO_AUTORIZADO','MENSAL',35,'BLOQUEADA_EXTERNA',
   'Exige autorização formal e arquivo oficial da SESP-MT.',
   NULL,'sesp-ocorrencias.json',100),
  ('sinfra-estradas','SINFRA/municípios — estradas vicinais',
   'SINFRA-MT e prefeituras municipais',
   'D','ARQUIVO_AUTORIZADO','ANUAL',400,'BLOQUEADA_EXTERNA',
   'Não há API pública municipal completa; exige arquivo validado pelo órgão responsável.',
   NULL,NULL,110),
  -- Conectores do gauntlet (dado real já em db/50 e db/53; configs em
  -- api/ingest-configs/). Honestidade de situação: sem coletor automatizado,
  -- o motivo diz o passo humano — nunca se inventa comando.
  ('sim-obitos-infantis','SIM/DATASUS — óbitos infantis (TabNet)',
   'Ministério da Saúde — SVSA/CGIAE',
   'E','DOWNLOAD','ANUAL',400,'BLOQUEADA_EXTERNA',
   'TabNet não expõe API; exige exportação manual do CSV oficial e carga via scripts/ingestar-csv.mjs com ingest-configs/sim-obitos-infantis.json.',
   NULL,'sim-obitos-infantis.json',120),
  ('sinasc-nascidos-vivos','SINASC/DATASUS — nascidos vivos (TabNet)',
   'Ministério da Saúde — SVSA/CGIAE',
   'E','DOWNLOAD','ANUAL',400,'BLOQUEADA_EXTERNA',
   'TabNet não expõe API; exige exportação manual do CSV oficial e carga via scripts/ingestar-csv.mjs com ingest-configs/sinasc-nascidos-vivos.json.',
   NULL,'sinasc-nascidos-vivos.json',130),
  ('siconfi-despesas','SICONFI/Tesouro Nacional — DCA Anexo I-D (despesas)',
   'Secretaria do Tesouro Nacional',
   'A','API','ANUAL',400,'BLOQUEADA_EXTERNA',
   'API oficial disponível, mas sem conector automatizado: a carga vigente é consulta parametrizada + curadoria por migração (db/53); via genérica: CSV com ingest-configs/siconfi-despesas.json.',
   NULL,'siconfi-despesas.json',140)
ON CONFLICT ("FonteConector_Slug") DO NOTHING;

-- Catálogo global: a aplicação e os scripts só leem; curadoria é migração
-- (como db/51 e db/54) — nada entra na catraca de menor privilégio.
REVOKE ALL ON "FonteConector" FROM PUBLIC, itmt_app;
GRANT SELECT ON "FonteConector" TO itmt_app;

COMMENT ON TABLE "FonteConector" IS
  'Evolução E2 (ADR-010): catálogo curado do registro de conectores de fontes, antes hardcoded em api/scripts/fontes-registry.mjs ("esse cadastro não deve ficar codificado no software" — pesquisa, seção 36). Fonte de verdade de sincronizar-fontes (F2-R048); conector novo = linha de curadoria, sem mudança de código.';
