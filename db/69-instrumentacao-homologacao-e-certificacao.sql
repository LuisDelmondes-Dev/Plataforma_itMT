-- ============================================================
-- db/69 - Instrumentacao de homologacao, certificacao e execucao assistida
--
-- Completa a db/68 com o delta dos pacotes R2.3.4 a R2.3.7: 19 tabelas, todas
-- no schema `controle`, levando o modelo analitico de 1.299 para 1.318 tabelas.
-- Sao tabelas de INSTRUMENTACAO — registram como uma execucao foi verificada,
-- nao dado territorial nem indicador:
--
--   R2.3.4 (5)  homologacao_fisica, homologacao_gate, homologacao_artefato,
--               homologacao_metrica, homologacao_gate_catalogo
--               -> os 12 gates de homologacao fisica, com artefatos e metricas
--   R2.3.5 (5)  certificacao_fisica, certificacao_gate_snapshot,
--               certificacao_artefato_snapshot, certificacao_assinatura,
--               certificacao_verificacao
--               -> snapshot imutavel dos gates e raiz SHA-256 das evidencias
--   R2.3.6 (5)  ambiente_local, migracao_core_local, healthcheck_local,
--               backup_local, restauracao_teste
--               -> o banco passa a saber qual Core aplicou, com que SHA-256,
--                  qual backup existe e se ele foi REALMENTE restaurado
--   R2.3.7 (4)  execucao_local_assistida, execucao_local_gate,
--               execucao_local_evento, execucao_local_artefato
--
-- ALEM DAS TABELAS, esta migracao traz o que o R2.3.4 acrescentou junto e que
-- NAO e instrumentacao, e convem declarar: o bootstrap territorial do modelo
-- externo (Brasil -> Mato Grosso -> 142 municipios em referencia.territorio e
-- referencia.municipio, com Boa Esperanca do Norte valido a partir de
-- 2025-01-01), mais a URL canonica do recurso piloto do SIDRA. Esse bootstrap
-- e o que sustenta a funcao referencia.municipios_mt_validos_em(data), e foi
-- ele que permitiu provar nesta sessao que a fonte oficial devolve exatamente
-- 141 municipios para o Censo 2022 — conjunto IDENTICO ao do modelo, sem uma
-- diferenca nos dois sentidos. Sem ele as tabelas territoriais do modelo
-- ficariam vazias.
--
-- Origem: incrementais do R2.3.4 e do R2.3.5 usados verbatim (ambos aplicados
-- sem erro no laboratorio nesta sessao); R2.3.6 e R2.3.7 nao foram entregues
-- como incremental, entao suas secoes foram extraidas do consolidado, que as
-- demarca explicitamente.
--
-- Privilegios seguem FECHADOS por padrao, como na db/68. Estas tabelas em
-- particular guardam caminho de arquivo, hash de evidencia e resumo de
-- execucao — nao ha razao alguma para a API enxerga-las.
--
-- ADR-010, adendo de 31/08/2026 (diretriz que trouxe o modelo para o `itmt`).
-- ============================================================

BEGIN;

-- ===================== R2.3.4 - HOMOLOGACAO FISICA =====================
-- ============================================================================
-- ITMT CORE R2.3.4
-- HOMOLOGAÇÃO FÍSICA CONTROLADA + CONTRATO RUNTIME/DDL + TERRITÓRIO HISTÓRICO
-- ============================================================================



-- --------------------------------------------------------------------------
-- 1. LINHAGEM DIRETA DO RAW E DO CHECKPOINT PARA A EXECUÇÃO DO PIPELINE
-- --------------------------------------------------------------------------

ALTER TABLE bruto.objeto_coletado
  ADD COLUMN IF NOT EXISTS execucao_pipeline_id uuid
    REFERENCES ingestao.execucao_pipeline(execucao_pipeline_id);

CREATE INDEX IF NOT EXISTS idx_bruto_objeto_execucao_pipeline
ON bruto.objeto_coletado(execucao_pipeline_id)
WHERE execucao_pipeline_id IS NOT NULL;

ALTER TABLE controle.checkpoint_coleta
  ADD COLUMN IF NOT EXISTS ultima_execucao_pipeline_id uuid
    REFERENCES ingestao.execucao_pipeline(execucao_pipeline_id);

COMMENT ON COLUMN controle.checkpoint_coleta.ultima_execucao_pipeline_id IS
'Execução que confirmou o checkpoint atual.';

-- --------------------------------------------------------------------------
-- 2. HOMOLOGAÇÃO FÍSICA
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controle.homologacao_fisica (
  homologacao_fisica_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(160) NOT NULL UNIQUE,
  versao_core varchar(60) NOT NULL,
  ambiente varchar(80) NOT NULL,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  finalizada_em timestamptz,
  status varchar(30) NOT NULL DEFAULT 'EM_EXECUCAO'
    CHECK(status IN ('EM_EXECUCAO','APROVADA','APROVADA_COM_ALERTA','REPROVADA','CANCELADA')),
  postgres_version text,
  postgis_version text,
  runtime_version varchar(60),
  git_commit varchar(80),
  endpoint_fonte text,
  checksum_core char(64),
  resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes text
);

CREATE TABLE IF NOT EXISTS controle.homologacao_gate (
  homologacao_gate_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  homologacao_fisica_id uuid NOT NULL
    REFERENCES controle.homologacao_fisica(homologacao_fisica_id) ON DELETE CASCADE,
  codigo varchar(100) NOT NULL,
  ordem smallint NOT NULL,
  categoria varchar(80) NOT NULL,
  nome varchar(300) NOT NULL,
  bloqueante boolean NOT NULL DEFAULT true,
  status varchar(30) NOT NULL
    CHECK(status IN ('PENDENTE','APROVADO','ALERTA','REPROVADO','NAO_EXECUTADO')),
  valor_observado text,
  valor_esperado text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  UNIQUE(homologacao_fisica_id,codigo)
);

CREATE TABLE IF NOT EXISTS controle.homologacao_artefato (
  homologacao_artefato_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homologacao_fisica_id uuid NOT NULL
    REFERENCES controle.homologacao_fisica(homologacao_fisica_id) ON DELETE CASCADE,
  gate_codigo varchar(100),
  tipo varchar(80) NOT NULL,
  nome varchar(300) NOT NULL,
  uri text,
  mime_type varchar(160),
  sha256 char(64),
  tamanho_bytes bigint,
  conteudo_json jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS controle.homologacao_metrica (
  homologacao_metrica_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  homologacao_fisica_id uuid NOT NULL
    REFERENCES controle.homologacao_fisica(homologacao_fisica_id) ON DELETE CASCADE,
  gate_codigo varchar(100),
  nome varchar(160) NOT NULL,
  valor_numerico numeric(38,10),
  valor_texto text,
  unidade varchar(60),
  medido_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_homologacao_gate_status
ON controle.homologacao_gate(homologacao_fisica_id,status,bloqueante);

CREATE OR REPLACE VIEW controle.v_homologacao_ultima AS
SELECT
  h.homologacao_fisica_id,
  h.codigo,
  h.versao_core,
  h.ambiente,
  h.status,
  h.iniciada_em,
  h.finalizada_em,
  h.postgres_version,
  h.postgis_version,
  count(*) FILTER (WHERE g.status='APROVADO') AS gates_aprovados,
  count(*) FILTER (WHERE g.status='ALERTA') AS gates_alerta,
  count(*) FILTER (WHERE g.status='REPROVADO') AS gates_reprovados,
  count(*) FILTER (WHERE g.status='NAO_EXECUTADO') AS gates_nao_executados
FROM controle.homologacao_fisica h
LEFT JOIN controle.homologacao_gate g
  ON g.homologacao_fisica_id=h.homologacao_fisica_id
WHERE h.homologacao_fisica_id=(
  SELECT homologacao_fisica_id
  FROM controle.homologacao_fisica
  ORDER BY iniciada_em DESC
  LIMIT 1
)
GROUP BY h.homologacao_fisica_id,h.codigo,h.versao_core,h.ambiente,h.status,
         h.iniciada_em,h.finalizada_em,h.postgres_version,h.postgis_version;

-- --------------------------------------------------------------------------
-- 3. BOOTSTRAP TERRITORIAL CANÔNICO
--    O Core tinha a lista de municípios, mas a promoção usa referencia.territorio.
-- --------------------------------------------------------------------------

INSERT INTO referencia.territorio
(tipo_territorio_id,codigo_oficial,nome,sigla,valido_desde,ativo,metadados)
SELECT tt.tipo_territorio_id,'BR','Brasil','BR',NULL,true,
       jsonb_build_object('codigo_iso2','BR','fonte','IBGE')
FROM referencia.tipo_territorio tt
WHERE tt.codigo='PAIS'
ON CONFLICT (tipo_territorio_id,codigo_oficial)
DO UPDATE SET nome=EXCLUDED.nome,sigla=EXCLUDED.sigla,ativo=true,
              metadados=referencia.territorio.metadados || EXCLUDED.metadados;

INSERT INTO referencia.pais(territorio_id,codigo_iso2,codigo_iso3,nome)
SELECT t.territorio_id,'BR','BRA','Brasil'
FROM referencia.territorio t
JOIN referencia.tipo_territorio tt ON tt.tipo_territorio_id=t.tipo_territorio_id
WHERE tt.codigo='PAIS' AND t.codigo_oficial='BR'
ON CONFLICT (codigo_iso2)
DO UPDATE SET territorio_id=EXCLUDED.territorio_id,
              codigo_iso3=EXCLUDED.codigo_iso3,nome=EXCLUDED.nome;

INSERT INTO referencia.territorio
(tipo_territorio_id,codigo_oficial,nome,sigla,valido_desde,ativo,metadados)
SELECT tt.tipo_territorio_id,'51','Mato Grosso','MT',NULL,true,
       jsonb_build_object('uf_sigla','MT','codigo_ibge','51','fonte','IBGE')
FROM referencia.tipo_territorio tt
WHERE tt.codigo='UF'
ON CONFLICT (tipo_territorio_id,codigo_oficial)
DO UPDATE SET nome=EXCLUDED.nome,sigla=EXCLUDED.sigla,ativo=true,
              metadados=referencia.territorio.metadados || EXCLUDED.metadados;

INSERT INTO referencia.unidade_federativa
(territorio_id,codigo_ibge,sigla,nome,regiao)
SELECT t.territorio_id,'51','MT','Mato Grosso','Centro-Oeste'
FROM referencia.territorio t
JOIN referencia.tipo_territorio tt ON tt.tipo_territorio_id=t.tipo_territorio_id
WHERE tt.codigo='UF' AND t.codigo_oficial='51'
ON CONFLICT (codigo_ibge)
DO UPDATE SET territorio_id=EXCLUDED.territorio_id,sigla=EXCLUDED.sigla,
              nome=EXCLUDED.nome,regiao=EXCLUDED.regiao;

WITH municipios(codigo_ibge,nome,valido_desde) AS (
VALUES
('5100102','Acorizal',NULL),
('5100201','Água Boa',NULL),
('5100250','Alta Floresta',NULL),
('5100300','Alto Araguaia',NULL),
('5100359','Alto Boa Vista',NULL),
('5100409','Alto Garças',NULL),
('5100508','Alto Paraguai',NULL),
('5100607','Alto Taquari',NULL),
('5100805','Apiacás',NULL),
('5101001','Araguaiana',NULL),
('5101209','Araguainha',NULL),
('5101258','Araputanga',NULL),
('5101308','Arenápolis',NULL),
('5101407','Aripuanã',NULL),
('5101605','Barão de Melgaço',NULL),
('5101704','Barra do Bugres',NULL),
('5101803','Barra do Garças',NULL),
('5101837','Boa Esperança do Norte',DATE '2025-01-01'),
('5101852','Bom Jesus do Araguaia',NULL),
('5101902','Brasnorte',NULL),
('5102504','Cáceres',NULL),
('5102603','Campinápolis',NULL),
('5102637','Campo Novo do Parecis',NULL),
('5102678','Campo Verde',NULL),
('5102686','Campos de Júlio',NULL),
('5102694','Canabrava do Norte',NULL),
('5102702','Canarana',NULL),
('5102793','Carlinda',NULL),
('5102850','Castanheira',NULL),
('5103007','Chapada dos Guimarães',NULL),
('5103056','Cláudia',NULL),
('5103106','Cocalinho',NULL),
('5103205','Colíder',NULL),
('5103254','Colniza',NULL),
('5103304','Comodoro',NULL),
('5103353','Confresa',NULL),
('5103361','Conquista d''Oeste',NULL),
('5103379','Cotriguaçu',NULL),
('5103403','Cuiabá',NULL),
('5103437','Curvelândia',NULL),
('5103452','Denise',NULL),
('5103502','Diamantino',NULL),
('5103601','Dom Aquino',NULL),
('5103700','Feliz Natal',NULL),
('5103809','Figueirópolis d''Oeste',NULL),
('5103858','Gaúcha do Norte',NULL),
('5103908','General Carneiro',NULL),
('5103957','Glória d''Oeste',NULL),
('5104104','Guarantã do Norte',NULL),
('5104203','Guiratinga',NULL),
('5104500','Indiavaí',NULL),
('5104526','Ipiranga do Norte',NULL),
('5104542','Itanhangá',NULL),
('5104559','Itaúba',NULL),
('5104609','Itiquira',NULL),
('5104807','Jaciara',NULL),
('5104906','Jangada',NULL),
('5105002','Jauru',NULL),
('5105101','Juara',NULL),
('5105150','Juína',NULL),
('5105176','Juruena',NULL),
('5105200','Juscimeira',NULL),
('5105234','Lambari d''Oeste',NULL),
('5105259','Lucas do Rio Verde',NULL),
('5105309','Luciara',NULL),
('5105580','Marcelândia',NULL),
('5105606','Matupá',NULL),
('5105622','Mirassol d''Oeste',NULL),
('5105903','Nobres',NULL),
('5106000','Nortelândia',NULL),
('5106109','Nossa Senhora do Livramento',NULL),
('5106158','Nova Bandeirantes',NULL),
('5106208','Nova Brasilândia',NULL),
('5106216','Nova Canaã do Norte',NULL),
('5108808','Nova Guarita',NULL),
('5106182','Nova Lacerda',NULL),
('5108857','Nova Marilândia',NULL),
('5108907','Nova Maringá',NULL),
('5108956','Nova Monte Verde',NULL),
('5106224','Nova Mutum',NULL),
('5106174','Nova Nazaré',NULL),
('5106232','Nova Olímpia',NULL),
('5106190','Nova Santa Helena',NULL),
('5106240','Nova Ubiratã',NULL),
('5106257','Nova Xavantina',NULL),
('5106273','Novo Horizonte do Norte',NULL),
('5106265','Novo Mundo',NULL),
('5106315','Novo Santo Antônio',NULL),
('5106281','Novo São Joaquim',NULL),
('5106299','Paranaíta',NULL),
('5106307','Paranatinga',NULL),
('5106372','Pedra Preta',NULL),
('5106422','Peixoto de Azevedo',NULL),
('5106455','Planalto da Serra',NULL),
('5106505','Poconé',NULL),
('5106653','Pontal do Araguaia',NULL),
('5106703','Ponte Branca',NULL),
('5106752','Pontes e Lacerda',NULL),
('5106778','Porto Alegre do Norte',NULL),
('5106802','Porto dos Gaúchos',NULL),
('5106828','Porto Esperidião',NULL),
('5106851','Porto Estrela',NULL),
('5107008','Poxoréu',NULL),
('5107040','Primavera do Leste',NULL),
('5107065','Querência',NULL),
('5107156','Reserva do Cabaçal',NULL),
('5107180','Ribeirão Cascalheira',NULL),
('5107198','Ribeirãozinho',NULL),
('5107206','Rio Branco',NULL),
('5107578','Rondolândia',NULL),
('5107602','Rondonópolis',NULL),
('5107701','Rosário Oeste',NULL),
('5107750','Salto do Céu',NULL),
('5107248','Santa Carmem',NULL),
('5107743','Santa Cruz do Xingu',NULL),
('5107768','Santa Rita do Trivelato',NULL),
('5107776','Santa Terezinha',NULL),
('5107263','Santo Afonso',NULL),
('5107792','Santo Antônio do Leste',NULL),
('5107800','Santo Antônio de Leverger',NULL),
('5107859','São Félix do Araguaia',NULL),
('5107297','São José do Povo',NULL),
('5107305','São José do Rio Claro',NULL),
('5107354','São José do Xingu',NULL),
('5107107','São José dos Quatro Marcos',NULL),
('5107404','São Pedro da Cipa',NULL),
('5107875','Sapezal',NULL),
('5107883','Serra Nova Dourada',NULL),
('5107909','Sinop',NULL),
('5107925','Sorriso',NULL),
('5107941','Tabaporã',NULL),
('5107958','Tangará da Serra',NULL),
('5108006','Tapurah',NULL),
('5108055','Terra Nova do Norte',NULL),
('5108105','Tesouro',NULL),
('5108204','Torixoréu',NULL),
('5108303','União do Sul',NULL),
('5108352','Vale de São Domingos',NULL),
('5108402','Várzea Grande',NULL),
('5108501','Vera',NULL),
('5105507','Vila Bela da Santíssima Trindade',NULL),
('5108600','Vila Rica',NULL)
)
INSERT INTO referencia.territorio
(tipo_territorio_id,codigo_oficial,nome,valido_desde,ativo,metadados)
SELECT
  tt.tipo_territorio_id,m.codigo_ibge,m.nome,m.valido_desde,true,
  jsonb_build_object(
    'uf_sigla','MT',
    'uf_codigo_ibge','51',
    'fonte','IBGE',
    'snapshot_atual',true,
    'nota_validade',
      CASE WHEN m.codigo_ibge='5101837'
           THEN 'Boa Esperança do Norte instalado oficialmente em 2025-01-01.'
           ELSE 'Data inicial histórica não modelada nesta carga; vigente em 2022 conforme snapshot do piloto.'
      END
  )
FROM municipios m
JOIN referencia.tipo_territorio tt ON tt.codigo='MUNICIPIO'
ON CONFLICT (tipo_territorio_id,codigo_oficial)
DO UPDATE SET nome=EXCLUDED.nome,
              valido_desde=COALESCE(referencia.territorio.valido_desde,EXCLUDED.valido_desde),
              ativo=true,
              metadados=referencia.territorio.metadados || EXCLUDED.metadados;

WITH municipios(codigo_ibge,nome,valido_desde) AS (
VALUES
('5100102','Acorizal',NULL),
('5100201','Água Boa',NULL),
('5100250','Alta Floresta',NULL),
('5100300','Alto Araguaia',NULL),
('5100359','Alto Boa Vista',NULL),
('5100409','Alto Garças',NULL),
('5100508','Alto Paraguai',NULL),
('5100607','Alto Taquari',NULL),
('5100805','Apiacás',NULL),
('5101001','Araguaiana',NULL),
('5101209','Araguainha',NULL),
('5101258','Araputanga',NULL),
('5101308','Arenápolis',NULL),
('5101407','Aripuanã',NULL),
('5101605','Barão de Melgaço',NULL),
('5101704','Barra do Bugres',NULL),
('5101803','Barra do Garças',NULL),
('5101837','Boa Esperança do Norte',DATE '2025-01-01'),
('5101852','Bom Jesus do Araguaia',NULL),
('5101902','Brasnorte',NULL),
('5102504','Cáceres',NULL),
('5102603','Campinápolis',NULL),
('5102637','Campo Novo do Parecis',NULL),
('5102678','Campo Verde',NULL),
('5102686','Campos de Júlio',NULL),
('5102694','Canabrava do Norte',NULL),
('5102702','Canarana',NULL),
('5102793','Carlinda',NULL),
('5102850','Castanheira',NULL),
('5103007','Chapada dos Guimarães',NULL),
('5103056','Cláudia',NULL),
('5103106','Cocalinho',NULL),
('5103205','Colíder',NULL),
('5103254','Colniza',NULL),
('5103304','Comodoro',NULL),
('5103353','Confresa',NULL),
('5103361','Conquista d''Oeste',NULL),
('5103379','Cotriguaçu',NULL),
('5103403','Cuiabá',NULL),
('5103437','Curvelândia',NULL),
('5103452','Denise',NULL),
('5103502','Diamantino',NULL),
('5103601','Dom Aquino',NULL),
('5103700','Feliz Natal',NULL),
('5103809','Figueirópolis d''Oeste',NULL),
('5103858','Gaúcha do Norte',NULL),
('5103908','General Carneiro',NULL),
('5103957','Glória d''Oeste',NULL),
('5104104','Guarantã do Norte',NULL),
('5104203','Guiratinga',NULL),
('5104500','Indiavaí',NULL),
('5104526','Ipiranga do Norte',NULL),
('5104542','Itanhangá',NULL),
('5104559','Itaúba',NULL),
('5104609','Itiquira',NULL),
('5104807','Jaciara',NULL),
('5104906','Jangada',NULL),
('5105002','Jauru',NULL),
('5105101','Juara',NULL),
('5105150','Juína',NULL),
('5105176','Juruena',NULL),
('5105200','Juscimeira',NULL),
('5105234','Lambari d''Oeste',NULL),
('5105259','Lucas do Rio Verde',NULL),
('5105309','Luciara',NULL),
('5105580','Marcelândia',NULL),
('5105606','Matupá',NULL),
('5105622','Mirassol d''Oeste',NULL),
('5105903','Nobres',NULL),
('5106000','Nortelândia',NULL),
('5106109','Nossa Senhora do Livramento',NULL),
('5106158','Nova Bandeirantes',NULL),
('5106208','Nova Brasilândia',NULL),
('5106216','Nova Canaã do Norte',NULL),
('5108808','Nova Guarita',NULL),
('5106182','Nova Lacerda',NULL),
('5108857','Nova Marilândia',NULL),
('5108907','Nova Maringá',NULL),
('5108956','Nova Monte Verde',NULL),
('5106224','Nova Mutum',NULL),
('5106174','Nova Nazaré',NULL),
('5106232','Nova Olímpia',NULL),
('5106190','Nova Santa Helena',NULL),
('5106240','Nova Ubiratã',NULL),
('5106257','Nova Xavantina',NULL),
('5106273','Novo Horizonte do Norte',NULL),
('5106265','Novo Mundo',NULL),
('5106315','Novo Santo Antônio',NULL),
('5106281','Novo São Joaquim',NULL),
('5106299','Paranaíta',NULL),
('5106307','Paranatinga',NULL),
('5106372','Pedra Preta',NULL),
('5106422','Peixoto de Azevedo',NULL),
('5106455','Planalto da Serra',NULL),
('5106505','Poconé',NULL),
('5106653','Pontal do Araguaia',NULL),
('5106703','Ponte Branca',NULL),
('5106752','Pontes e Lacerda',NULL),
('5106778','Porto Alegre do Norte',NULL),
('5106802','Porto dos Gaúchos',NULL),
('5106828','Porto Esperidião',NULL),
('5106851','Porto Estrela',NULL),
('5107008','Poxoréu',NULL),
('5107040','Primavera do Leste',NULL),
('5107065','Querência',NULL),
('5107156','Reserva do Cabaçal',NULL),
('5107180','Ribeirão Cascalheira',NULL),
('5107198','Ribeirãozinho',NULL),
('5107206','Rio Branco',NULL),
('5107578','Rondolândia',NULL),
('5107602','Rondonópolis',NULL),
('5107701','Rosário Oeste',NULL),
('5107750','Salto do Céu',NULL),
('5107248','Santa Carmem',NULL),
('5107743','Santa Cruz do Xingu',NULL),
('5107768','Santa Rita do Trivelato',NULL),
('5107776','Santa Terezinha',NULL),
('5107263','Santo Afonso',NULL),
('5107792','Santo Antônio do Leste',NULL),
('5107800','Santo Antônio de Leverger',NULL),
('5107859','São Félix do Araguaia',NULL),
('5107297','São José do Povo',NULL),
('5107305','São José do Rio Claro',NULL),
('5107354','São José do Xingu',NULL),
('5107107','São José dos Quatro Marcos',NULL),
('5107404','São Pedro da Cipa',NULL),
('5107875','Sapezal',NULL),
('5107883','Serra Nova Dourada',NULL),
('5107909','Sinop',NULL),
('5107925','Sorriso',NULL),
('5107941','Tabaporã',NULL),
('5107958','Tangará da Serra',NULL),
('5108006','Tapurah',NULL),
('5108055','Terra Nova do Norte',NULL),
('5108105','Tesouro',NULL),
('5108204','Torixoréu',NULL),
('5108303','União do Sul',NULL),
('5108352','Vale de São Domingos',NULL),
('5108402','Várzea Grande',NULL),
('5108501','Vera',NULL),
('5105507','Vila Bela da Santíssima Trindade',NULL),
('5108600','Vila Rica',NULL)
)
INSERT INTO referencia.municipio
(territorio_id,codigo_ibge,nome,uf_id)
SELECT t.territorio_id,m.codigo_ibge,m.nome,uf.uf_id
FROM municipios m
JOIN referencia.tipo_territorio tt ON tt.codigo='MUNICIPIO'
JOIN referencia.territorio t
  ON t.tipo_territorio_id=tt.tipo_territorio_id
 AND t.codigo_oficial=m.codigo_ibge
JOIN referencia.unidade_federativa uf ON uf.codigo_ibge='51'
ON CONFLICT (codigo_ibge)
DO UPDATE SET territorio_id=EXCLUDED.territorio_id,
              nome=EXCLUDED.nome,uf_id=EXCLUDED.uf_id;

-- Brasil -> Mato Grosso.
INSERT INTO referencia.territorio_hierarquia
(territorio_pai_id,territorio_filho_id,tipo_relacao,valido_desde,valido_ate)
SELECT br.territorio_id,mt.territorio_id,'contem',NULL,NULL
FROM referencia.territorio br
JOIN referencia.tipo_territorio tbr ON tbr.tipo_territorio_id=br.tipo_territorio_id AND tbr.codigo='PAIS'
JOIN referencia.territorio mt ON mt.codigo_oficial='51'
JOIN referencia.tipo_territorio tmt ON tmt.tipo_territorio_id=mt.tipo_territorio_id AND tmt.codigo='UF'
WHERE br.codigo_oficial='BR'
ON CONFLICT (territorio_pai_id,territorio_filho_id,tipo_relacao)
DO UPDATE SET valido_ate=NULL;

-- Mato Grosso -> municípios, respeitando validade conhecida.
INSERT INTO referencia.territorio_hierarquia
(territorio_pai_id,territorio_filho_id,tipo_relacao,valido_desde,valido_ate)
SELECT mt.territorio_id,m.territorio_id,'contem',m.valido_desde,m.valido_ate
FROM referencia.territorio mt
JOIN referencia.tipo_territorio tmt
  ON tmt.tipo_territorio_id=mt.tipo_territorio_id AND tmt.codigo='UF'
JOIN referencia.territorio m ON true
JOIN referencia.tipo_territorio tm
  ON tm.tipo_territorio_id=m.tipo_territorio_id AND tm.codigo='MUNICIPIO'
WHERE mt.codigo_oficial='51'
  AND m.metadados->>'uf_sigla'='MT'
ON CONFLICT (territorio_pai_id,territorio_filho_id,tipo_relacao)
DO UPDATE SET valido_desde=EXCLUDED.valido_desde,valido_ate=EXCLUDED.valido_ate;

CREATE OR REPLACE VIEW referencia.v_snapshot_municipios_mt AS
SELECT
  t.territorio_id,
  t.codigo_oficial::char(7) AS codigo_ibge,
  t.nome,
  t.valido_desde,
  t.valido_ate,
  t.ativo
FROM referencia.territorio t
JOIN referencia.tipo_territorio tt
  ON tt.tipo_territorio_id=t.tipo_territorio_id
WHERE tt.codigo='MUNICIPIO'
  AND t.metadados->>'uf_sigla'='MT';

CREATE OR REPLACE FUNCTION referencia.municipios_mt_validos_em(p_data date)
RETURNS TABLE(territorio_id bigint,codigo_ibge char(7),nome varchar)
LANGUAGE sql
STABLE
AS $$
  SELECT t.territorio_id,t.codigo_oficial::char(7),t.nome
  FROM referencia.territorio t
  JOIN referencia.tipo_territorio tt
    ON tt.tipo_territorio_id=t.tipo_territorio_id
  WHERE tt.codigo='MUNICIPIO'
    AND t.metadados->>'uf_sigla'='MT'
    AND (t.valido_desde IS NULL OR t.valido_desde<=p_data)
    AND (t.valido_ate IS NULL OR t.valido_ate>=p_data)
  ORDER BY t.codigo_oficial;
$$;

-- --------------------------------------------------------------------------
-- 4. ENDPOINT PILOTO CANÔNICO + DESCRITOR
-- --------------------------------------------------------------------------

UPDATE catalogo.recurso_fonte r
SET url_recurso=
      'https://apisidra.ibge.gov.br/values/t/4709/n6/in%20n3%2051/v/93/p/2022',
    parametros_padrao =
      COALESCE(r.parametros_padrao,'{}'::jsonb)
      || jsonb_build_object(
          'descriptor_url','https://apisidra.ibge.gov.br/DescritoresTabela/t/4709',
          'table_url','https://sidra.ibge.gov.br/tabela/4709',
          'expected_table','4709',
          'expected_variable','93',
          'expected_period','2022',
          'expected_territorial_level','6',
          'expected_uf_code','51',
          'role_detection','auto_validate'
        )
FROM catalogo.conjunto_dado c
JOIN catalogo.fonte_dado f ON f.fonte_id=c.fonte_id
WHERE r.conjunto_id=c.conjunto_id
  AND f.codigo='IBGE_SIDRA'
  AND r.codigo_origem='SIDRA_4709_V93_MT_MUNICIPIOS_2022';

UPDATE ingestao.instancia_conector
SET versao_runtime='r2.3.4',
    configuracao_base =
      configuracao_base
      || jsonb_build_object(
           'sidra_role_detection','auto_validate',
           'sidra_expected_variable','93',
           'sidra_expected_period','2022',
           'sidra_expected_uf_prefix','51',
           'sidra_period_type','censo'
         )
WHERE codigo='IBGE_SIDRA_REST';

-- --------------------------------------------------------------------------
-- 5. GATES FORMAIS DA HOMOLOGAÇÃO
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS controle.homologacao_gate_catalogo (
  codigo varchar(100) PRIMARY KEY,
  ordem smallint NOT NULL UNIQUE,
  categoria varchar(80) NOT NULL,
  nome varchar(300) NOT NULL,
  bloqueante boolean NOT NULL DEFAULT true,
  criterio text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);

INSERT INTO controle.homologacao_gate_catalogo
(codigo,ordem,categoria,nome,bloqueante,criterio)
VALUES
('H01_DDL',10,'Banco','DDL completo aplicado',true,'Core R2.3.4 deve aplicar em banco limpo sem erro.'),
('H02_PREFLIGHT',20,'Banco','Preflight aprovado',true,'controle.executar_preflight_r233() deve resultar APROVADO.'),
('H03_TERRITORIO',30,'Referência','Snapshot territorial consistente',true,'2022 deve conter 141 municípios válidos; snapshot atual 142.'),
('H04_DESCRIPTOR',40,'Fonte','Descritor SIDRA válido',true,'Descritor da tabela 4709 responde e é preservado com checksum.'),
('H05_ENDPOINT',50,'Fonte','Endpoint piloto válido',true,'Resposta JSON contém registros e atende variável/período/território esperados.'),
('H06_INGESTAO',60,'Ingestão','Carga normalizada concluída',true,'RAW, contrato, qualidade e Data Product devem ser publicados.'),
('H07_COBERTURA',70,'Qualidade','Cobertura territorial 2022',true,'Códigos da resposta devem coincidir com o snapshot territorial válido em 2022.'),
('H08_PROMOCAO',80,'DW','Promoção governada concluída',true,'Fatos atuais criados somente para mapeamento 4709/V93.'),
('H09_IDEMPOTENCIA',90,'Runtime','Reexecução sem duplicidade',true,'Mesmo conteúdo não cria novo fato nem nova carga lógica.'),
('H10_SEMANTICO',100,'Semântico','Consulta governada responde',true,'semantico.consultar_indicador retorna fatos atuais.'),
('H11_XINGU',110,'IA','Resposta auditável da Xingú',true,'Afirmações devem estar ligadas a observacao_id/evidência.'),
('H12_PERFORMANCE',120,'Performance','Plano de consulta aceitável',false,'EXPLAIN ANALYZE/BUFFERS deve ser capturado e avaliado.')
ON CONFLICT (codigo)
DO UPDATE SET ordem=EXCLUDED.ordem,categoria=EXCLUDED.categoria,nome=EXCLUDED.nome,
              bloqueante=EXCLUDED.bloqueante,criterio=EXCLUDED.criterio,ativo=true;

-- ===================== R2.3.5 - CERTIFICACAO =====================
-- ============================================================================
-- ITMT CORE R2.3.5
-- EXECUÇÃO FÍSICA CERTIFICADA
-- ============================================================================
-- Esta camada NÃO certifica uma execução por si só.
-- Ela fornece o modelo para que uma homologação física real produza um
-- certificado imutável, verificável e ligado a todos os gates/evidências.
-- ============================================================================



CREATE TABLE IF NOT EXISTS controle.certificacao_fisica (
  certificacao_fisica_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homologacao_fisica_id uuid NOT NULL UNIQUE
    REFERENCES controle.homologacao_fisica(homologacao_fisica_id),

  codigo varchar(180) NOT NULL UNIQUE,
  versao_core varchar(60) NOT NULL,
  runtime_version varchar(60) NOT NULL,
  ambiente varchar(80) NOT NULL,

  status varchar(40) NOT NULL DEFAULT 'PENDENTE'
    CHECK(status IN (
      'PENDENTE','EM_CERTIFICACAO','CERTIFICADA',
      'CERTIFICADA_COM_ALERTA','REPROVADA','REVOGADA'
    )),

  banco_fingerprint char(64),
  core_sha256 char(64) NOT NULL,
  runtime_sha256 char(64),
  report_sha256 char(64),
  evidence_root_sha256 char(64),

  postgres_version text,
  postgis_version text,
  timezone text,

  endpoint_fonte text,
  endpoint_fonte_sha256 char(64),
  data_product_version_id bigint
    REFERENCES catalogo.versao_produto_dado(versao_produto_dado_id),

  total_gates integer NOT NULL DEFAULT 0,
  gates_aprovados integer NOT NULL DEFAULT 0,
  gates_alerta integer NOT NULL DEFAULT 0,
  gates_reprovados integer NOT NULL DEFAULT 0,
  gates_nao_executados integer NOT NULL DEFAULT 0,

  total_artefatos integer NOT NULL DEFAULT 0,
  total_fatos_dw bigint,
  total_afirmacoes_xingu bigint,

  iniciado_em timestamptz NOT NULL DEFAULT now(),
  certificado_em timestamptz,
  revogado_em timestamptz,
  motivo_revogacao text,

  metadados jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS controle.certificacao_gate_snapshot (
  certificacao_gate_snapshot_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  certificacao_fisica_id uuid NOT NULL
    REFERENCES controle.certificacao_fisica(certificacao_fisica_id) ON DELETE CASCADE,
  homologacao_gate_id bigint NOT NULL
    REFERENCES controle.homologacao_gate(homologacao_gate_id),
  codigo varchar(100) NOT NULL,
  ordem smallint NOT NULL,
  bloqueante boolean NOT NULL,
  status varchar(30) NOT NULL,
  valor_observado text,
  valor_esperado text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_sha256 char(64) NOT NULL,
  UNIQUE(certificacao_fisica_id,codigo)
);

CREATE TABLE IF NOT EXISTS controle.certificacao_artefato_snapshot (
  certificacao_artefato_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificacao_fisica_id uuid NOT NULL
    REFERENCES controle.certificacao_fisica(certificacao_fisica_id) ON DELETE CASCADE,
  homologacao_artefato_id uuid NOT NULL
    REFERENCES controle.homologacao_artefato(homologacao_artefato_id),
  gate_codigo varchar(100),
  nome varchar(300) NOT NULL,
  uri text,
  mime_type varchar(160),
  sha256 char(64) NOT NULL,
  tamanho_bytes bigint,
  snapshot_sha256 char(64) NOT NULL,
  UNIQUE(certificacao_fisica_id,homologacao_artefato_id)
);

CREATE TABLE IF NOT EXISTS controle.certificacao_assinatura (
  certificacao_assinatura_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificacao_fisica_id uuid NOT NULL
    REFERENCES controle.certificacao_fisica(certificacao_fisica_id) ON DELETE CASCADE,
  algoritmo varchar(80) NOT NULL DEFAULT 'SHA256-MERKLE-LIKE',
  payload_canonico jsonb NOT NULL,
  payload_sha256 char(64) NOT NULL,
  assinatura_externa text,
  chave_publica_ref text,
  assinada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(certificacao_fisica_id,algoritmo)
);

CREATE TABLE IF NOT EXISTS controle.certificacao_verificacao (
  certificacao_verificacao_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificacao_fisica_id uuid NOT NULL
    REFERENCES controle.certificacao_fisica(certificacao_fisica_id) ON DELETE CASCADE,
  verificada_em timestamptz NOT NULL DEFAULT now(),
  verificador varchar(160) NOT NULL,
  status varchar(30) NOT NULL
    CHECK(status IN ('VALIDA','INVALIDA','INCOMPLETA')),
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  mensagem text
);

CREATE INDEX IF NOT EXISTS idx_certificacao_status
ON controle.certificacao_fisica(status,certificado_em DESC);

CREATE INDEX IF NOT EXISTS idx_certificacao_gate_snapshot
ON controle.certificacao_gate_snapshot(certificacao_fisica_id,status,bloqueante);

-- --------------------------------------------------------------------------
-- Função de elegibilidade: não cria certificado se homologação não for real.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION controle.homologacao_elegivel_certificacao(
  p_homologacao_fisica_id uuid
)
RETURNS TABLE(
  elegivel boolean,
  status_homologacao varchar,
  total_gates bigint,
  bloqueantes_reprovados bigint,
  bloqueantes_nao_executados bigint,
  artefatos bigint,
  mensagem text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (
      h.status IN ('APROVADA','APROVADA_COM_ALERTA')
      AND count(*) FILTER (WHERE g.bloqueante AND g.status <> 'APROVADO') = 0
      AND (SELECT count(*) FROM controle.homologacao_artefato a
           WHERE a.homologacao_fisica_id=h.homologacao_fisica_id) > 0
    ) AS elegivel,
    h.status,
    count(g.homologacao_gate_id),
    count(*) FILTER (WHERE g.bloqueante AND g.status='REPROVADO'),
    count(*) FILTER (WHERE g.bloqueante AND g.status='NAO_EXECUTADO'),
    (SELECT count(*) FROM controle.homologacao_artefato a
     WHERE a.homologacao_fisica_id=h.homologacao_fisica_id),
    CASE
      WHEN h.status NOT IN ('APROVADA','APROVADA_COM_ALERTA')
        THEN 'Homologação não está aprovada.'
      WHEN count(*) FILTER (WHERE g.bloqueante AND g.status <> 'APROVADO') > 0
        THEN 'Um ou mais gates bloqueantes não estão APROVADOS.'
      WHEN (SELECT count(*) FROM controle.homologacao_artefato a
            WHERE a.homologacao_fisica_id=h.homologacao_fisica_id)=0
        THEN 'Homologação não possui artefatos de evidência.'
      ELSE 'Elegível para certificação.'
    END
  FROM controle.homologacao_fisica h
  LEFT JOIN controle.homologacao_gate g
    ON g.homologacao_fisica_id=h.homologacao_fisica_id
  WHERE h.homologacao_fisica_id=p_homologacao_fisica_id
  GROUP BY h.homologacao_fisica_id,h.status;
$$;

CREATE OR REPLACE VIEW controle.v_certificacao_ultima AS
SELECT
  c.certificacao_fisica_id,
  c.homologacao_fisica_id,
  c.codigo,
  c.versao_core,
  c.runtime_version,
  c.ambiente,
  c.status,
  c.core_sha256,
  c.report_sha256,
  c.evidence_root_sha256,
  c.total_gates,
  c.gates_aprovados,
  c.gates_alerta,
  c.gates_reprovados,
  c.gates_nao_executados,
  c.total_artefatos,
  c.total_fatos_dw,
  c.total_afirmacoes_xingu,
  c.certificado_em
FROM controle.certificacao_fisica c
ORDER BY c.iniciado_em DESC
LIMIT 1;

-- ============ R2.3.6 e R2.3.7 - OPERACAO LOCAL E PRIMEIRA EXECUCAO ============
-- (extraidos do consolidado: estes dois nao foram entregues como incremental)
-- ===== CORE R2.3.6 — OPERAÇÃO LOCAL =====

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

CREATE TABLE IF NOT EXISTS controle.ambiente_local (
  ambiente_local_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(120) NOT NULL UNIQUE,
  nome varchar(240) NOT NULL,
  tipo varchar(40) NOT NULL CHECK(tipo IN ('homologacao','producao','desenvolvimento')),
  host varchar(255) NOT NULL DEFAULT 'localhost',
  porta integer NOT NULL DEFAULT 5432,
  database_name varchar(120) NOT NULL,
  timezone varchar(80) NOT NULL DEFAULT 'America/Cuiaba',
  postgres_version text,
  postgis_version text,
  docker boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS controle.backup_local (
  backup_local_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente_local_id uuid REFERENCES controle.ambiente_local(ambiente_local_id),
  arquivo text NOT NULL,
  formato varchar(30) NOT NULL DEFAULT 'custom',
  sha256 char(64) NOT NULL,
  tamanho_bytes bigint NOT NULL,
  iniciado_em timestamptz,
  finalizado_em timestamptz NOT NULL DEFAULT now(),
  status varchar(30) NOT NULL CHECK(status IN ('SUCESSO','FALHA','REMOVIDO')),
  postgres_version text,
  observacoes text
);

CREATE TABLE IF NOT EXISTS controle.restauracao_teste (
  restauracao_teste_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_local_id uuid NOT NULL REFERENCES controle.backup_local(backup_local_id),
  database_teste varchar(120) NOT NULL,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  status varchar(30) NOT NULL DEFAULT 'EM_EXECUCAO'
    CHECK(status IN ('EM_EXECUCAO','APROVADA','REPROVADA','CANCELADA')),
  verificacoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  mensagem text
);

CREATE TABLE IF NOT EXISTS controle.healthcheck_local (
  healthcheck_local_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente_local_id uuid REFERENCES controle.ambiente_local(ambiente_local_id),
  verificado_em timestamptz NOT NULL DEFAULT now(),
  status varchar(30) NOT NULL CHECK(status IN ('OK','ALERTA','FALHA')),
  conexao_ok boolean NOT NULL,
  postgis_ok boolean NOT NULL,
  pgcrypto_ok boolean NOT NULL,
  pg_stat_statements_ok boolean NOT NULL,
  core_ok boolean NOT NULL,
  tempo_conexao_ms numeric(14,3),
  tamanho_banco_bytes bigint,
  conexoes_ativas integer,
  transacoes_longas integer,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS controle.migracao_core_local (
  migracao_core_local_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  versao varchar(80) NOT NULL,
  arquivo varchar(300) NOT NULL,
  sha256 char(64) NOT NULL,
  aplicada_em timestamptz NOT NULL DEFAULT now(),
  aplicada_por varchar(160) NOT NULL DEFAULT current_user,
  duracao_ms numeric(18,3),
  status varchar(30) NOT NULL CHECK(status IN ('APLICADA','FALHA')),
  UNIQUE(versao,sha256)
);

INSERT INTO controle.ambiente_local
(codigo,nome,tipo,host,porta,database_name,timezone,docker,ativo)
VALUES
('LOCAL-HOMOLOG','ITMT Homologação Local','homologacao','localhost',55432,'itmt_homolog',
 'America/Cuiaba',true,true)
ON CONFLICT (codigo)
DO UPDATE SET nome=EXCLUDED.nome,tipo=EXCLUDED.tipo,timezone=EXCLUDED.timezone,
              ativo=true,atualizado_em=now();

-- ------------------------------------------------------------
-- BLOCO DE PRIVILEGIOS DO R2.3.6 — NEUTRALIZADO DE PROPOSITO.
--
-- Duas razoes, e as duas sao decisivas:
--
-- 1. Ele contraria a diretriz desta casa. O usuario decidiu em 31/08/2026 que
--    o modelo analitico entra com privilegio FECHADO por padrao, liberado
--    tabela a tabela quando houver consumidor. Este bloco faz o oposto:
--    concede SELECT em TODAS as tabelas de referencia, catalogo, dw e
--    semantico, e ainda instala ALTER DEFAULT PRIVILEGES para que toda tabela
--    futura nasca legivel. Medido no laboratorio antes de neutralizar: 442
--    tabelas passaram a ser visiveis ao papel da API (190 em dw, 107 em
--    referencia, 80 em catalogo, 65 em semantico), sem uma policy de tenant
--    sequer — exatamente a critica que o ADR-010 faz ao modelo externo.
--
-- 2. Ele referencia papeis que NAO EXISTEM neste banco. `itmt_owner`,
--    `itmt_ingest`, `itmt_readonly` e `itmt_admin` sao a separacao de papeis
--    proposta pelo R2.3.6; a plataforma tem dois papeis (`itmt` dono e
--    `itmt_app`). Executado como esta, o comando falharia com
--    "role itmt_owner does not exist" e derrubaria a migracao inteira.
--
-- Adotar a separacao de cinco papeis e uma decisao propria — esta registrada
-- como E23 no ADR-010, com um motivo real por tras (hoje a ingestao conecta
-- como dono superusuario). Ela merece migracao propria, janela e validacao da
-- ingestao ponta a ponta; nao entra de carona aqui.
--
-- O bloco original fica abaixo, comentado, para que a decisao seja auditavel
-- e para que quem for implementar a E23 tenha o ponto de partida.
-- ------------------------------------------------------------
-- -- Permissões por responsabilidade.
-- GRANT USAGE ON SCHEMA referencia,catalogo,dw,semantico TO itmt_app,itmt_ingest,itmt_readonly;
-- GRANT USAGE ON SCHEMA controle,bruto,integracao,ingestao,orquestracao TO itmt_ingest;
-- GRANT USAGE ON SCHEMA controle TO itmt_admin;

-- GRANT SELECT ON ALL TABLES IN SCHEMA referencia,catalogo,dw,semantico
-- TO itmt_app,itmt_ingest,itmt_readonly;

-- GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA
-- controle,bruto,integracao,ingestao,orquestracao
-- TO itmt_ingest;

-- GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA dw,semantico TO itmt_ingest;

-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA
-- controle,bruto,integracao,ingestao,orquestracao,dw,semantico,referencia,catalogo
-- TO itmt_admin;

-- GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA
-- controle,bruto,integracao,ingestao,orquestracao,dw,semantico,referencia,catalogo
-- TO itmt_ingest,itmt_admin;

-- ALTER DEFAULT PRIVILEGES FOR ROLE itmt_owner IN SCHEMA referencia,catalogo,dw,semantico
-- GRANT SELECT ON TABLES TO itmt_readonly,itmt_app,itmt_ingest;

-- ALTER DEFAULT PRIVILEGES FOR ROLE itmt_owner IN SCHEMA
-- controle,bruto,integracao,ingestao,orquestracao
-- GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO itmt_ingest;

CREATE OR REPLACE VIEW controle.v_saude_local AS
SELECT
  current_database() AS database_name,
  version() AS postgres_version,
  postgis_full_version() AS postgis_version,
  current_setting('TimeZone') AS timezone,
  pg_database_size(current_database()) AS database_size_bytes,
  (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()) AS connections,
  (SELECT count(*) FROM pg_stat_activity
    WHERE datname=current_database()
      AND xact_start IS NOT NULL
      AND now()-xact_start > interval '5 minutes') AS long_transactions,
  (SELECT count(*) FROM pg_extension WHERE extname='pg_stat_statements')=1 AS pg_stat_statements_ok,
  to_regclass('dw.fato_observacao') IS NOT NULL AS core_ok;

-- ===== CORE R2.3.7 — PRIMEIRA EXECUÇÃO ASSISTIDA =====

CREATE TABLE IF NOT EXISTS controle.execucao_local_assistida (
  execucao_local_assistida_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(180) NOT NULL UNIQUE,
  versao_core varchar(80) NOT NULL,
  runtime_version varchar(80) NOT NULL,
  tipo_execucao varchar(40) NOT NULL DEFAULT 'PRIMEIRA_EXECUCAO'
    CHECK(tipo_execucao IN ('PRIMEIRA_EXECUCAO','REEXECUCAO','DIAGNOSTICO','RECUPERACAO')),
  status varchar(40) NOT NULL DEFAULT 'EM_EXECUCAO'
    CHECK(status IN (
      'EM_EXECUCAO','APROVADA','APROVADA_COM_ALERTA',
      'REPROVADA','INTERROMPIDA','RECUPERADA'
    )),
  host_fingerprint char(64),
  host_resumo jsonb NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  etapa_atual varchar(100),
  etapa_falha varchar(100),
  mensagem text,
  suporte_bundle_uri text,
  suporte_bundle_sha256 char(64),
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS controle.execucao_local_gate (
  execucao_local_gate_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  execucao_local_assistida_id uuid NOT NULL
    REFERENCES controle.execucao_local_assistida(execucao_local_assistida_id)
    ON DELETE CASCADE,
  codigo varchar(100) NOT NULL,
  ordem smallint NOT NULL,
  categoria varchar(80) NOT NULL,
  nome varchar(300) NOT NULL,
  bloqueante boolean NOT NULL DEFAULT true,
  status varchar(30) NOT NULL DEFAULT 'PENDENTE'
    CHECK(status IN (
      'PENDENTE','EM_EXECUCAO','APROVADO','ALERTA',
      'REPROVADO','NAO_EXECUTADO'
    )),
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  duracao_ms numeric(18,3),
  valor_observado text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(execucao_local_assistida_id,codigo)
);

CREATE TABLE IF NOT EXISTS controle.execucao_local_evento (
  execucao_local_evento_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  execucao_local_assistida_id uuid NOT NULL
    REFERENCES controle.execucao_local_assistida(execucao_local_assistida_id)
    ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  nivel varchar(20) NOT NULL
    CHECK(nivel IN ('DEBUG','INFO','WARN','ERROR','CRITICAL')),
  etapa varchar(100),
  codigo varchar(120),
  mensagem text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS controle.execucao_local_artefato (
  execucao_local_artefato_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_local_assistida_id uuid NOT NULL
    REFERENCES controle.execucao_local_assistida(execucao_local_assistida_id)
    ON DELETE CASCADE,
  gate_codigo varchar(100),
  tipo varchar(80) NOT NULL,
  nome varchar(300) NOT NULL,
  uri text NOT NULL,
  sha256 char(64) NOT NULL,
  tamanho_bytes bigint NOT NULL,
  sanitizado boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(execucao_local_assistida_id,nome,sha256)
);

CREATE INDEX IF NOT EXISTS idx_execucao_local_assistida_status
ON controle.execucao_local_assistida(status,iniciado_em DESC);

CREATE INDEX IF NOT EXISTS idx_execucao_local_gate_status
ON controle.execucao_local_gate(execucao_local_assistida_id,status,bloqueante);

CREATE INDEX IF NOT EXISTS idx_execucao_local_evento_tempo
ON controle.execucao_local_evento(execucao_local_assistida_id,criado_em);

CREATE OR REPLACE VIEW controle.v_execucao_local_ultima AS
SELECT
  e.execucao_local_assistida_id,
  e.codigo,
  e.versao_core,
  e.runtime_version,
  e.tipo_execucao,
  e.status,
  e.iniciado_em,
  e.finalizado_em,
  e.etapa_atual,
  e.etapa_falha,
  e.mensagem,
  e.suporte_bundle_uri,
  count(*) FILTER (WHERE g.status='APROVADO') AS gates_aprovados,
  count(*) FILTER (WHERE g.status='ALERTA') AS gates_alerta,
  count(*) FILTER (WHERE g.status='REPROVADO') AS gates_reprovados,
  count(*) FILTER (WHERE g.status='NAO_EXECUTADO') AS gates_nao_executados
FROM controle.execucao_local_assistida e
LEFT JOIN controle.execucao_local_gate g
  ON g.execucao_local_assistida_id=e.execucao_local_assistida_id
WHERE e.execucao_local_assistida_id=(
  SELECT execucao_local_assistida_id
  FROM controle.execucao_local_assistida
  ORDER BY iniciado_em DESC
  LIMIT 1
)
GROUP BY e.execucao_local_assistida_id,e.codigo,e.versao_core,e.runtime_version,
         e.tipo_execucao,e.status,e.iniciado_em,e.finalizado_em,e.etapa_atual,
         e.etapa_falha,e.mensagem,e.suporte_bundle_uri;

-- ------------------------------------------------------------
-- Privilegios: fechado por padrao, como na db/68.
-- ------------------------------------------------------------
-- Cobre os 20 schemas, não só `controle`: as seções embutidas tocam também
-- referencia, catalogo, dw e semantico, e uma revogação estreita deixaria
-- passar o que a verificação abaixo iria pegar de qualquer forma.
DO $priv$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['bruto','campo','catalogo','controle','documental','dw',
                           'geoespacial','ingestao','integracao','levantamento','midia',
                           'municipal','nucleo','orquestracao','parceria','pesquisa',
                           'producao','referencia','seguranca','semantico'] LOOP
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM itmt_app', s);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM itmt_app', s);
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM itmt_app', s);
    EXECUTE format('REVOKE ALL ON SCHEMA %I FROM itmt_app', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM itmt_app', s);
  END LOOP;
END
$priv$;

-- ------------------------------------------------------------
-- Verificacao — falha alto, como manda a licao do seed silencioso.
-- ------------------------------------------------------------
DO $conf$
DECLARE faltando text; total int; visivel int;
BEGIN
  SELECT string_agg(esperada, ', ') INTO faltando
    FROM unnest(ARRAY['controle.ambiente_local','controle.backup_local','controle.certificacao_artefato_snapshot',
    'controle.certificacao_assinatura','controle.certificacao_fisica','controle.certificacao_gate_snapshot',
    'controle.certificacao_verificacao','controle.execucao_local_artefato','controle.execucao_local_assistida',
    'controle.execucao_local_evento','controle.execucao_local_gate','controle.healthcheck_local',
    'controle.homologacao_artefato','controle.homologacao_fisica','controle.homologacao_gate',
    'controle.homologacao_gate_catalogo','controle.homologacao_metrica','controle.migracao_core_local',
    'controle.restauracao_teste']) AS esperada
   WHERE to_regclass(esperada) IS NULL;

  IF faltando IS NOT NULL THEN
    RAISE EXCEPTION 'db/69: tabela(s) de instrumentacao ausente(s): %', faltando;
  END IF;

  SELECT count(*) INTO total FROM pg_tables
   WHERE schemaname IN ('bruto','campo','catalogo','controle','documental','dw',
                        'geoespacial','ingestao','integracao','levantamento','midia',
                        'municipal','nucleo','orquestracao','parceria','pesquisa',
                        'producao','referencia','seguranca','semantico');
  IF total <> 1318 THEN
    RAISE EXCEPTION 'db/69: modelo analitico ficou com % tabelas, esperado 1318.', total;
  END IF;

  -- Nos 20 schemas, não só em `controle`. A primeira versão desta verificação
  -- olhava só `controle` e passava com 442 tabelas visíveis em dw, referencia,
  -- catalogo e semantico — concedidas pelo bloco do R2.3.6 que hoje está
  -- neutralizado acima. Uma verificação estreita demais é pior que nenhuma:
  -- ela dá a impressão de que se conferiu.
  SELECT count(*) INTO visivel FROM information_schema.role_table_grants
   WHERE grantee = 'itmt_app'
     AND table_schema IN ('bruto','campo','catalogo','controle','documental','dw',
                          'geoespacial','ingestao','integracao','levantamento','midia',
                          'municipal','nucleo','orquestracao','parceria','pesquisa',
                          'producao','referencia','seguranca','semantico');
  IF visivel <> 0 THEN
    RAISE EXCEPTION
      'db/69: itmt_app enxerga % tabela(s) do modelo analitico; a diretriz e fechado por padrao.', visivel;
  END IF;

  RAISE NOTICE 'db/69: 19 tabelas de instrumentacao criadas; modelo analitico em % tabelas, 0 visiveis a itmt_app.', total;
END
$conf$;

COMMIT;
