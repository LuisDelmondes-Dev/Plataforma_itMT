-- ============================================================
-- 62-e17-config-ingestao-versionada.sql (Evolução E17 · configuração de
-- ingestão versionada no catálogo vivo)
--
-- ADR-010, evolução E17: absorção CONCEITUAL do pacote externo "Core R2.2 —
-- Framework Universal de Ingestão" (C:\Users\Del\Downloads\ITMT_Core_R2_2_
-- Pacote_Framework_Universal_Ingestao\, 29/08/2026; 46 tabelas em schema
-- `ingestao` — DDL NÃO copiado, como em toda evolução do ADR-010). A tese
-- central do pacote: **o worker não carrega a regra da fonte dentro dele;
-- ele pergunta ao banco como executar** (plano de execução = cadastro +
-- configuração + contrato + mapeamento + política temporal —
-- `ingestao.obter_plano_execucao()` no modelo externo).
--
-- O PRECEDENTE é a E2 (db/55): o REGISTRO de conectores saiu do código
-- (fontes-registry.mjs hardcoded) e virou "FonteConector". Mas a
-- CONFIGURAÇÃO de cada ingestão continuou em arquivos: api/ingest-configs/
-- *.json (12 configs declarativas — fonte/indicador/colunas/dataReferencia/
-- separador), consumidas por scripts/ingestar-csv.mjs. É o mesmo defeito que
-- a E2 corrigiu, um degrau abaixo: "esse cadastro não deve ficar codificado
-- no software". A partir desta migração, "FonteConectorConfiguracao" é a
-- fonte de verdade VERSIONADA da configuração:
--   · slug da config = nome do arquivo sem extensão (grão mais fino que o
--     conector: cnes-estabelecimentos/cnes-internacao/cnes-leitos pertencem
--     todas ao conector 'cnes' — o vínculo 1:N que db/55 anotou como "vive
--     no coletor" agora vive AQUI, em "FonteConectorConfiguracao_ConectorSlug");
--   · HISTÓRICO IMUTÁVEL: mudar a config = INSERT de versão+1 e troca da
--     vigente (UPDATE só do flag "Vigente"); conteúdo/versão/hash jamais
--     sofrem UPDATE, e DELETE nunca — vetos DE BANCO (triggers PL/pgSQL,
--     doutrina F3/F4), não checagem de aplicação;
--   · uma vigente por slug, garantida por índice parcial único;
--   · hash SHA-256 do CONTEÚDO CANÔNICO, calculado pelo próprio banco no
--     INSERT: sha256(((conteúdo)::jsonb)::text) — a MESMA forma canônica da
--     cadeia de auditoria (jsonb normaliza espaço/ordem de chaves; edição
--     só de formatação no arquivo não é drift de conteúdo, de propósito).
--
-- CONSUMIDOR REAL (regra do ADR-010): scripts/lib-ingest.mjs ganha
-- carregarConfigIngestao() e scripts/ingestar-csv.mjs passa a buscar a
-- config no banco (versão vigente pelo slug). Degradação segura, espírito
-- da RG-05: banco sem esta migração (42P01) ou slug fora do catálogo ⇒ o
-- arquivo continua valendo. Banco E arquivo divergentes ⇒ warn com os dois
-- hashes e o BANCO vence — é ele a fonte de verdade versionada. Ratchet:
-- api/test/config-ingestao.unit.mjs — as 12 configs semeadas são comparadas
-- por hash canônico com os arquivos: quem editar o .json sem criar versão
-- nova no banco QUEBRA a suíte (catraca anti-drift).
--
-- NOTA (coletores Python): coletores/coletar_fontes.py continua lendo o
-- arquivo-base e gravando uma config DERIVADA (run-*.json, com a competência
-- coletada) que passa ao ingestar-csv; o slug derivado (run-*) não existe no
-- catálogo e cai no fallback de arquivo POR CONSTRUÇÃO — comportamento
-- preservado, sem tocar o coletor.
--
-- SEED: as 12 configs de api/ingest-configs/*.json copiadas VERBATIM
-- (byte a byte dos arquivos em 29/08/2026) como versão 1 vigente — o jsonb
-- normaliza a forma, o teste compara pelo hash canônico. Mapeamento
-- config→conector derivado honestamente do código que as consome:
--   · cnes-estabelecimentos / cnes-internacao / cnes-leitos → 'cnes'
--     (grupo "cnes" de coletores/coletar_fontes.py cobre exatamente as três);
--   · inep-escolas / inep-matriculas → 'inep' (grupo "inep" do coletor);
--   · inpe-queimadas → 'inpe' e mapbiomas-cobertura → 'mapbiomas'
--     (db/55 já apontava o 1:1 em "FonteConector_ConfigIngestao");
--   · pam-area-plantada → 'ibge-f1' (a PAM/área plantada — SIDRA 5457,
--     variável 8331 — é carregada por ingestar-pacote-f1-ibge.mjs, comando
--     do conector ibge-f1; a config CSV é a via manual do MESMO conjunto);
--   · sesp-ocorrencias → 'sesp-mt'; siconfi-despesas → 'siconfi-despesas';
--     sim-obitos-infantis / sinasc-nascidos-vivos → idem (1:1 de db/55).
--   Nenhuma config ficou órfã hoje; a coluna aceita NULL para a config
--   futura sem conector correspondente (com comentário na curadoria).
--
-- GRANTS: itmt_app recebe SÓ SELECT (padrão db/51/54/55) — quem escreve é a
-- curadoria por migração e os scripts de ingestão, que rodam como DONO fora
-- da API. Nada entra na catraca de menor privilégio.
--
-- FICA PARA DEPOIS (registrado, não esquecido — cada item espera o
-- consumidor real, regra do ADR-010):
--   · pipeline declarativo como DAG de etapas (TPL_API/TPL_BULK_FILE/… do
--     R2.2) — gatilho: um orquestrador de workers real; hoje o único
--     executor é ingestar-csv.mjs, processo único com etapas fixas
--     Bronze→Prata→Ouro;
--   · descoberta automática de recursos (CKAN/ArcGIS/STAC: item novo/
--     alterado/removido/homologado) — gatilho: o conector CKAN nascer
--     (dados-gov-br e dados-abertos-mt já estão catalogados em db/56 como
--     PLANEJADA, sem coletor);
--   · rate-limit / retry / circuit-breaker como política de banco por
--     conector — gatilho: mais de um consumidor de política HTTP; hoje só
--     baixar() em lib-ingest.mjs, com timeout único configurável.
-- ============================================================

CREATE TABLE IF NOT EXISTS "FonteConectorConfiguracao" (
  "FonteConectorConfiguracao_Id" bigserial PRIMARY KEY,
  -- Slug da config = nome do arquivo em api/ingest-configs/ sem extensão;
  -- kebab-case como "FonteConector_Slug".
  "FonteConectorConfiguracao_Slug" text NOT NULL
    CHECK ("FonteConectorConfiguracao_Slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Conector do catálogo vivo (db/55/56/58) a que a config pertence; grão
  -- mais fino que o conector (1 conector : N configs). NULL = config sem
  -- conector correspondente no catálogo (documentar na curadoria).
  "FonteConectorConfiguracao_ConectorSlug" text
    REFERENCES "FonteConector"("FonteConector_Slug"),
  -- Versão inteira crescente por slug; nova config = versão+1, nunca UPDATE.
  "FonteConectorConfiguracao_Versao" integer NOT NULL
    CHECK ("FonteConectorConfiguracao_Versao" >= 1),
  "FonteConectorConfiguracao_Conteudo" jsonb NOT NULL,
  -- Hash canônico calculado pelo trigger no INSERT (nunca confiado ao
  -- chamador): sha256(((Conteudo)::jsonb)::text) — mesma forma canônica da
  -- cadeia de auditoria.
  "FonteConectorConfiguracao_HashSha256" text NOT NULL
    CHECK ("FonteConectorConfiguracao_HashSha256" ~ '^[0-9a-f]{64}$'),
  "FonteConectorConfiguracao_Vigente" boolean NOT NULL DEFAULT true,
  "FonteConectorConfiguracao_CriadaEm" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("FonteConectorConfiguracao_Slug","FonteConectorConfiguracao_Versao")
);

-- Uma (e só uma) vigente por slug.
CREATE UNIQUE INDEX IF NOT EXISTS "FonteConectorConfiguracao_VigenteUnica"
  ON "FonteConectorConfiguracao" ("FonteConectorConfiguracao_Slug")
  WHERE "FonteConectorConfiguracao_Vigente";

-- O hash é do BANCO, não do chamador: BEFORE INSERT recalcula sempre.
CREATE OR REPLACE FUNCTION e17_config_ingestao_hash() RETURNS trigger AS $$
BEGIN
  NEW."FonteConectorConfiguracao_HashSha256" :=
    encode(sha256((NEW."FonteConectorConfiguracao_Conteudo")::text::bytea), 'hex');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_config_ingestao_hash ON "FonteConectorConfiguracao";
CREATE TRIGGER trg_config_ingestao_hash
  BEFORE INSERT ON "FonteConectorConfiguracao"
  FOR EACH ROW EXECUTE FUNCTION e17_config_ingestao_hash();

-- Veto de banco (doutrina F3/F4): histórico imutável — UPDATE só pode tocar
-- o flag Vigente (a troca de vigência); DELETE, nunca.
CREATE OR REPLACE FUNCTION e17_config_ingestao_imutavel() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'FonteConectorConfiguracao é histórico imutável: remoção física nunca (padrão db/55 — aposentar = nova versão vigente).';
  END IF;
  IF NEW."FonteConectorConfiguracao_Id"           IS DISTINCT FROM OLD."FonteConectorConfiguracao_Id"
  OR NEW."FonteConectorConfiguracao_Slug"         IS DISTINCT FROM OLD."FonteConectorConfiguracao_Slug"
  OR NEW."FonteConectorConfiguracao_ConectorSlug" IS DISTINCT FROM OLD."FonteConectorConfiguracao_ConectorSlug"
  OR NEW."FonteConectorConfiguracao_Versao"       IS DISTINCT FROM OLD."FonteConectorConfiguracao_Versao"
  OR NEW."FonteConectorConfiguracao_Conteudo"     IS DISTINCT FROM OLD."FonteConectorConfiguracao_Conteudo"
  OR NEW."FonteConectorConfiguracao_HashSha256"   IS DISTINCT FROM OLD."FonteConectorConfiguracao_HashSha256"
  OR NEW."FonteConectorConfiguracao_CriadaEm"     IS DISTINCT FROM OLD."FonteConectorConfiguracao_CriadaEm" THEN
    RAISE EXCEPTION 'FonteConectorConfiguracao é imutável: só "FonteConectorConfiguracao_Vigente" pode mudar; conteúdo novo = INSERT de versão nova (E17, db/62).';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_config_ingestao_imutavel ON "FonteConectorConfiguracao";
CREATE TRIGGER trg_config_ingestao_imutavel
  BEFORE UPDATE OR DELETE ON "FonteConectorConfiguracao"
  FOR EACH ROW EXECUTE FUNCTION e17_config_ingestao_imutavel();

-- Catálogo global: a aplicação e os scripts só leem; curadoria/ingestão
-- escrevem como dono (padrão db/55) — nada entra na catraca de menor
-- privilégio (least-privilege.unit.mjs).
REVOKE ALL ON "FonteConectorConfiguracao" FROM PUBLIC, itmt_app;
GRANT SELECT ON "FonteConectorConfiguracao" TO itmt_app;

COMMENT ON TABLE "FonteConectorConfiguracao" IS
  'Evolução E17 (ADR-010): configuração de ingestão versionada no catálogo vivo — absorção conceitual do Core R2.2 ("o worker pergunta ao banco como executar"), precedente E2/db/55. Fonte de verdade das configs antes em api/ingest-configs/*.json; arquivo vira fallback RG-05-like. Histórico imutável por trigger; uma vigente por slug; hash canônico sha256((conteudo::jsonb)::text) calculado pelo banco.';

-- ------------------------------------------------------------
-- SEED — as 12 configurações de api/ingest-configs/*.json, versão 1
-- vigente. Conteúdo copiado VERBATIM (byte a byte) dos arquivos em
-- 29/08/2026; o hash é recalculado pelo trigger no INSERT. Idempotente
-- pelo ON CONFLICT (slug, versão).
-- ------------------------------------------------------------
INSERT INTO "FonteConectorConfiguracao"
  ("FonteConectorConfiguracao_Slug","FonteConectorConfiguracao_ConectorSlug",
   "FonteConectorConfiguracao_Versao","FonteConectorConfiguracao_Conteudo")
VALUES
  ('cnes-estabelecimentos','cnes',1,$cfg${
  "fonte": {
    "nome": "CNES/DATASUS — Estabelecimentos de saúde ativos",
    "origem": "Ministério da Saúde — Cadastro Nacional de Estabelecimentos de Saúde",
    "url": "https://cnes.datasus.gov.br/pages/estabelecimentos/consulta.jsp",
    "baseLegal": "DADO_ABERTO",
    "licenca": "Informações de Saúde — DATASUS (Lei 12.527/2011)",
    "periodicidade": "MENSAL"
  },
  "indicador": {
    "nome": "Estabelecimentos de saúde ativos",
    "unidade": "estabelecimentos",
    "tipoAgregacao": "SOMA",
    "subtemaNome": "Estabelecimentos de saúde"
  },
  "colunas": { "codigoIbge": "codigo_ibge", "valor": "valor" },
  "dataReferencia": "2026-06-28",
  "separador": ";",
  "agregarPorMunicipio": true
}
$cfg$::jsonb),
  ('cnes-internacao','cnes',1,$cfg${
  "fonte": {
    "nome": "CNES/DATASUS — Leitos de internação existentes (TabNet)",
    "origem": "Ministério da Saúde — Cadastro Nacional de Estabelecimentos de Saúde",
    "url": "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?cnes/cnv/leiintmt.def",
    "baseLegal": "DADO_ABERTO",
    "licenca": "Informações de Saúde — DATASUS (Lei 12.527/2011)",
    "periodicidade": "MENSAL"
  },
  "indicador": { "nome": "Leitos de internação", "unidade": "leitos", "tipoAgregacao": "SOMA", "subtemaNome": "Leitos de internação" },
  "colunas": { "codigoIbge": "codigo_ibge", "valor": "valor" },
  "dataReferencia": "2026-06-28",
  "separador": ";",
  "agregarPorMunicipio": true
}
$cfg$::jsonb),
  ('cnes-leitos','cnes',1,$cfg${
  "fonte": {
    "nome": "CNES/DataSUS — Leitos por município",
    "origem": "Ministério da Saúde — Cadastro Nacional de Estabelecimentos de Saúde",
    "url": "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?cnes/cnv/leiutimt.def",
    "baseLegal": "DADO_ABERTO",
    "licenca": "Dados Abertos do SUS (ODbL)",
    "periodicidade": "MENSAL"
  },
  "indicador": { "nome": "Leitos de UTI", "unidade": "leitos", "tipoAgregacao": "SOMA", "subtemaNome": "Número de leitos / vagas de UTI" },
  "colunas": { "codigoIbge": "codigo_ibge", "valor": "valor" },
  "dataReferencia": "2026-05-31",
  "separador": ";",
  "agregarPorMunicipio": true
}
$cfg$::jsonb),
  ('inep-escolas','inep',1,$cfg${
  "fonte": {
    "nome": "INEP — Censo Escolar (escolas ativas)",
    "origem": "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira",
    "url": "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar",
    "baseLegal": "DADO_ABERTO",
    "licenca": "Dados abertos INEP (Lei 12.527/2011)",
    "periodicidade": "ANUAL"
  },
  "indicador": {
    "nome": "Escolas ativas",
    "unidade": "escolas",
    "tipoAgregacao": "SOMA",
    "subtemaNome": "Escolas ativas"
  },
  "colunas": { "codigoIbge": "codigo_ibge", "valor": "valor" },
  "dataReferencia": "2025-12-31",
  "separador": ";",
  "agregarPorMunicipio": true
}
$cfg$::jsonb),
  ('inep-matriculas','inep',1,$cfg${
  "fonte": {
    "nome": "INEP — Censo Escolar (matrículas rede pública)",
    "origem": "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira",
    "url": "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar",
    "baseLegal": "DADO_ABERTO",
    "licenca": "Dados abertos INEP (Lei 12.527/2011)",
    "periodicidade": "ANUAL"
  },
  "indicador": { "nome": "Matrículas na rede pública", "unidade": "matrículas", "tipoAgregacao": "SOMA", "subtemaNome": "Matrículas — rede pública" },
  "colunas": { "codigoIbge": "CO_MUNICIPIO", "valor": "QT_MAT_BAS" },
  "dataReferencia": "2025-05-31",
  "separador": ";",
  "agregarPorMunicipio": true
}
$cfg$::jsonb),
  ('inpe-queimadas','inpe',1,$cfg${
  "fonte": {
    "nome": "INPE — Programa Queimadas (focos de calor)",
    "origem": "Instituto Nacional de Pesquisas Espaciais",
    "url": "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/anual/Brasil_sat_ref/",
    "baseLegal": "DADO_ABERTO",
    "licenca": "Dados abertos INPE (CC-BY-SA)",
    "periodicidade": "ANUAL"
  },
  "indicador": { "nome": "Focos de queimadas", "unidade": "focos", "tipoAgregacao": "SOMA", "subtemaNome": "Focos de queimadas" },
  "colunas": { "codigoIbge": "id_municipio", "valor": "focos" },
  "dataReferencia": "2025-12-31",
  "separador": ";",
  "agregarPorMunicipio": true
}
$cfg$::jsonb),
  ('mapbiomas-cobertura','mapbiomas',1,$cfg${
  "fonte": {
    "nome": "MapBiomas — Cobertura vegetal nativa por município",
    "origem": "Projeto MapBiomas (rede colaborativa)",
    "url": "https://brasil.mapbiomas.org/estatisticas/",
    "baseLegal": "DADO_ABERTO",
    "licenca": "CC-BY 4.0 (citação obrigatória ao MapBiomas)",
    "periodicidade": "ANUAL"
  },
  "indicador": { "nome": "Cobertura vegetal nativa", "unidade": "hectares", "tipoAgregacao": "SOMA", "subtemaNome": "Cobertura vegetal nativa" },
  "colunas": { "codigoIbge": "geocode", "valor": "area_ha" },
  "dataReferencia": "2024-12-31",
  "separador": ";",
  "agregarPorMunicipio": true
}
$cfg$::jsonb),
  ('pam-area-plantada','ibge-f1',1,$cfg${
  "fonte": {
    "nome": "IBGE — PAM Produção Agrícola Municipal (área plantada, CSV/SIDRA)",
    "origem": "Instituto Brasileiro de Geografia e Estatística",
    "url": "https://sidra.ibge.gov.br/pesquisa/pam",
    "baseLegal": "DADO_ABERTO",
    "licenca": "Dados abertos IBGE (Lei 12.527/2011)",
    "periodicidade": "ANUAL"
  },
  "indicador": { "nome": "Área plantada", "unidade": "hectares", "tipoAgregacao": "SOMA", "subtemaNome": "Área plantada" },
  "colunas": { "codigoIbge": "Cod_Municipio", "valor": "Area_Plantada_ha" },
  "dataReferencia": "2024-12-31",
  "separador": ";",
  "agregarPorMunicipio": true
}
$cfg$::jsonb),
  ('sesp-ocorrencias','sesp-mt',1,$cfg${
  "fonte": {
    "nome": "SESP-MT — Ocorrências criminais por município",
    "origem": "Secretaria de Estado de Segurança Pública de Mato Grosso",
    "url": "http://www.sesp.mt.gov.br/estatisticas",
    "baseLegal": "AUTORIZACAO_FORMAL",
    "licenca": "Autorização formal SESP-MT (registrar nº no ADMIN antes de rodar)",
    "periodicidade": "MENSAL"
  },
  "indicador": { "nome": "Ocorrências criminais registradas", "unidade": "ocorrências", "tipoAgregacao": "SOMA", "subtemaNome": "Delegacias" },
  "colunas": { "codigoIbge": "COD_IBGE", "valor": "TOTAL_OCORRENCIAS" },
  "dataReferencia": "2026-05-31",
  "separador": ";",
  "agregarPorMunicipio": true
}
$cfg$::jsonb),
  ('siconfi-despesas','siconfi-despesas',1,$cfg${
  "fonte": {
    "nome": "SICONFI/Tesouro Nacional — DCA Anexo I-D (despesas orçamentárias)",
    "origem": "Secretaria do Tesouro Nacional — SICONFI (Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro)",
    "url": "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca",
    "baseLegal": "DADO_ABERTO",
    "licenca": "Dados abertos do Tesouro Nacional (Lei 12.527/2011; LC 101/2000 art. 48)",
    "periodicidade": "ANUAL"
  },
  "indicador": { "nome": "Despesas orçamentárias empenhadas", "unidade": "R$", "tipoAgregacao": "SOMA", "subtemaNome": "Execução orçamentária" },
  "colunas": { "codigoIbge": "codigo_ibge", "valor": "valor" },
  "dataReferencia": "2024-12-31",
  "separador": ";",
  "agregarPorMunicipio": false
}
$cfg$::jsonb),
  ('sim-obitos-infantis','sim-obitos-infantis',1,$cfg${
  "fonte": {
    "nome": "SIM/DATASUS — Óbitos infantis (TabNet, inf10mt)",
    "origem": "Ministério da Saúde — SVSA/CGIAE — Sistema de Informações sobre Mortalidade (SIM)",
    "url": "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sim/cnv/inf10mt.def",
    "baseLegal": "DADO_ABERTO",
    "licenca": "Informações de Saúde — DATASUS (Lei 12.527/2011)",
    "periodicidade": "ANUAL"
  },
  "indicador": { "nome": "Óbitos infantis", "unidade": "óbitos", "tipoAgregacao": "SOMA", "subtemaNome": "Mortalidade infantil" },
  "colunas": { "codigoIbge": "codigo_ibge", "valor": "valor" },
  "dataReferencia": "2024-12-31",
  "separador": ";",
  "agregarPorMunicipio": true
}
$cfg$::jsonb),
  ('sinasc-nascidos-vivos','sinasc-nascidos-vivos',1,$cfg${
  "fonte": {
    "nome": "SINASC/DATASUS — Nascidos vivos (TabNet, nvmt)",
    "origem": "Ministério da Saúde — SVSA/CGIAE — Sistema de Informações sobre Nascidos Vivos (SINASC)",
    "url": "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sinasc/cnv/nvmt.def",
    "baseLegal": "DADO_ABERTO",
    "licenca": "Informações de Saúde — DATASUS (Lei 12.527/2011)",
    "periodicidade": "ANUAL"
  },
  "indicador": { "nome": "Nascidos vivos", "unidade": "nascidos vivos", "tipoAgregacao": "SOMA", "subtemaNome": "Mortalidade infantil" },
  "colunas": { "codigoIbge": "codigo_ibge", "valor": "valor" },
  "dataReferencia": "2024-12-31",
  "separador": ";",
  "agregarPorMunicipio": true
}
$cfg$::jsonb)
ON CONFLICT ("FonteConectorConfiguracao_Slug","FonteConectorConfiguracao_Versao") DO NOTHING;
