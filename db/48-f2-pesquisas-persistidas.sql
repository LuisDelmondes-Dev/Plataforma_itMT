-- ============================================================
-- 48-f2-pesquisas-persistidas.sql (Gauntlet "Pesquisa vs IA Xingú" — P1)
-- Até aqui toda resposta do portal era efêmera: o motor calculava, a Xingú
-- narrava, o navegador exibia — e nada sobrava além de uma linha na trilha
-- de auditoria (que é prova imutável, não registro consultável). Reabrir uma
-- pesquisa significava reexecutar motor e LLM, sem garantia de resposta
-- idêntica (catálogo muda, dado é recarregado, o LLM não é determinístico).
-- Estas tabelas viram a memória operacional da pesquisa: o snapshot completo
-- e normalizado do que foi perguntado e respondido, suficiente para
-- reconstruir o envelope byte a byte SEM tocar motor nem LLM. A trilha
-- continua sendo "EventoAuditoria" (o serviço grava PESQUISA_EXECUTADA lá);
-- aqui NÃO há encadeamento de hash por linha — o "Pesquisa_Hash" é o sha256
-- do payload canônico da resposta, o selo que prova que a reabertura devolveu
-- exatamente o que foi exibido. Pesquisa concluída é imutável por grant:
-- itmt_app recebe SELECT+INSERT e nunca UPDATE/DELETE.
-- Sugestão sem dado-origem é impossível por CHECK (doutrina "dossiê, não
-- decisão": todo subsídio aponta a linha do motor que o motivou).
-- ============================================================

CREATE TABLE IF NOT EXISTS "Pesquisa" (
  "Pesquisa_Id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "Pesquisa_TenantId"       uuid NOT NULL,
  "Pesquisa_OrganizacaoId"  uuid NOT NULL,
  "Pesquisa_Modo"           text NOT NULL CHECK ("Pesquisa_Modo" IN ('pesquisa','xingu')),
  "Pesquisa_Pergunta"       text NOT NULL CHECK (char_length("Pesquisa_Pergunta") BETWEEN 1 AND 1000),
  "Pesquisa_Area"           text,                -- nome do tema (taxonomia), quando resolvido
  "Pesquisa_Recorte"        text NOT NULL CHECK ("Pesquisa_Recorte" IN ('ESTADO','MUNICIPIO','RGINT','RGI','CONSORCIO')),
  "Pesquisa_Codigo"         text,                -- codigo_ibge | rgi | rgint | consorcio_id (NULL p/ ESTADO)
  "Pesquisa_UsuarioId"      uuid,                -- portal público é anônimo; sem FK (correlação lógica)
  "Pesquisa_DataHora"       timestamptz NOT NULL DEFAULT now(),
  "Pesquisa_Estado"         text NOT NULL CHECK ("Pesquisa_Estado" IN ('RESPONDIDA','CLARIFICACAO','SEM_DADO','BLOQUEADA')),
  "Pesquisa_VersaoMotor"    text NOT NULL,
  "Pesquisa_Hash"           char(64) NOT NULL,   -- sha256 do payload canônico da resposta
  FOREIGN KEY ("Pesquisa_TenantId","Pesquisa_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pesquisa_recentes ON "Pesquisa"
  ("Pesquisa_TenantId","Pesquisa_OrganizacaoId","Pesquisa_DataHora" DESC);

CREATE TABLE IF NOT EXISTS "PesquisaIndicador" (
  "PesquisaIndicador_Id"                  bigserial PRIMARY KEY,
  "PesquisaIndicador_TenantId"            uuid NOT NULL,
  "PesquisaIndicador_OrganizacaoId"       uuid NOT NULL,
  "PesquisaIndicador_PesquisaId"          uuid NOT NULL REFERENCES "Pesquisa"("Pesquisa_Id") ON DELETE CASCADE,
  "PesquisaIndicador_IndicadorId"         int  NOT NULL REFERENCES "Indicador"("Indicador_Id"),
  "PesquisaIndicador_Nome"                text NOT NULL,     -- congelado: o nome no momento da pesquisa
  "PesquisaIndicador_Valor"               numeric NOT NULL,
  "PesquisaIndicador_Unidade"             text NOT NULL,
  "PesquisaIndicador_DataReferencia"      date NOT NULL,
  "PesquisaIndicador_Agregacao"           text NOT NULL,
  "PesquisaIndicador_MunicipiosAgregados" int,               -- NULL quando recorte municipal
  FOREIGN KEY ("PesquisaIndicador_TenantId","PesquisaIndicador_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pesquisaindicador_pesquisa ON "PesquisaIndicador"
  ("PesquisaIndicador_TenantId","PesquisaIndicador_OrganizacaoId","PesquisaIndicador_PesquisaId");

CREATE TABLE IF NOT EXISTS "PesquisaIndicadorMunicipio" (
  "PesquisaIndicadorMunicipio_Id"                  bigserial PRIMARY KEY,
  "PesquisaIndicadorMunicipio_TenantId"            uuid NOT NULL,
  "PesquisaIndicadorMunicipio_OrganizacaoId"       uuid NOT NULL,
  "PesquisaIndicadorMunicipio_PesquisaIndicadorId" bigint NOT NULL
    REFERENCES "PesquisaIndicador"("PesquisaIndicador_Id") ON DELETE CASCADE,
  "PesquisaIndicadorMunicipio_CodigoIbge"          char(7) NOT NULL REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "PesquisaIndicadorMunicipio_Valor"               numeric NOT NULL,
  "PesquisaIndicadorMunicipio_Posicao"             int NOT NULL,   -- posição no ranking (RN-005: sem dado = fora, nunca zero)
  "PesquisaIndicadorMunicipio_TopN"                boolean NOT NULL DEFAULT false,
  "PesquisaIndicadorMunicipio_DeltaMediaEstadual"  numeric,
  FOREIGN KEY ("PesquisaIndicadorMunicipio_TenantId","PesquisaIndicadorMunicipio_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pesquisaindicadormunicipio_pai ON "PesquisaIndicadorMunicipio"
  ("PesquisaIndicadorMunicipio_TenantId","PesquisaIndicadorMunicipio_OrganizacaoId","PesquisaIndicadorMunicipio_PesquisaIndicadorId");

CREATE TABLE IF NOT EXISTS "PesquisaSerieHistorica" (
  "PesquisaSerieHistorica_Id"                  bigserial PRIMARY KEY,
  "PesquisaSerieHistorica_TenantId"            uuid NOT NULL,
  "PesquisaSerieHistorica_OrganizacaoId"       uuid NOT NULL,
  "PesquisaSerieHistorica_PesquisaIndicadorId" bigint NOT NULL
    REFERENCES "PesquisaIndicador"("PesquisaIndicador_Id") ON DELETE CASCADE,
  -- Território do ponto (NULL = o recorte principal da pesquisa); permite
  -- série comparada multi-município sem multiplicar indicadores (crítico P1).
  "PesquisaSerieHistorica_CodigoIbge"          char(7) REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "PesquisaSerieHistorica_Ano"                 int NOT NULL,
  "PesquisaSerieHistorica_Valor"               numeric NOT NULL,
  "PesquisaSerieHistorica_Categoria"           text NOT NULL DEFAULT 'OBSERVADO'
    CHECK ("PesquisaSerieHistorica_Categoria" IN ('OBSERVADO','PROJECAO','CENARIO')),
  FOREIGN KEY ("PesquisaSerieHistorica_TenantId","PesquisaSerieHistorica_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pesquisaseriehistorica_pai ON "PesquisaSerieHistorica"
  ("PesquisaSerieHistorica_TenantId","PesquisaSerieHistorica_OrganizacaoId","PesquisaSerieHistorica_PesquisaIndicadorId");

-- Vazia até P3 entregar a dimensão de causa (SIM/SINASC); o schema nasce
-- pronto para que a reabertura não mude de contrato quando o dado chegar.
CREATE TABLE IF NOT EXISTS "PesquisaCausa" (
  "PesquisaCausa_Id"                  bigserial PRIMARY KEY,
  "PesquisaCausa_TenantId"            uuid NOT NULL,
  "PesquisaCausa_OrganizacaoId"       uuid NOT NULL,
  "PesquisaCausa_PesquisaIndicadorId" bigint NOT NULL
    REFERENCES "PesquisaIndicador"("PesquisaIndicador_Id") ON DELETE CASCADE,
  "PesquisaCausa_CodigoIbge"          char(7) REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "PesquisaCausa_Dimensao"            text NOT NULL
    CHECK ("PesquisaCausa_Dimensao" IN ('CAPITULO_CID10','CAUSA_EVITAVEL','COMPONENTE')),
  "PesquisaCausa_Categoria"           text NOT NULL,
  "PesquisaCausa_Periodo"             text NOT NULL,
  "PesquisaCausa_Valor"               numeric NOT NULL,
  FOREIGN KEY ("PesquisaCausa_TenantId","PesquisaCausa_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pesquisacausa_pai ON "PesquisaCausa"
  ("PesquisaCausa_TenantId","PesquisaCausa_OrganizacaoId","PesquisaCausa_PesquisaIndicadorId");

CREATE TABLE IF NOT EXISTS "PesquisaDashboard" (
  "PesquisaDashboard_Id"             bigserial PRIMARY KEY,
  "PesquisaDashboard_TenantId"       uuid NOT NULL,
  "PesquisaDashboard_OrganizacaoId"  uuid NOT NULL,
  "PesquisaDashboard_PesquisaId"     uuid NOT NULL REFERENCES "Pesquisa"("Pesquisa_Id") ON DELETE CASCADE,
  "PesquisaDashboard_Tipo"           text NOT NULL
    CHECK ("PesquisaDashboard_Tipo" IN ('CARD','BARRAS','TABELA','MAPA','SERIE','DECOMPOSICAO','COMPARACAO')),
  "PesquisaDashboard_Configuracao"   jsonb NOT NULL,
  "PesquisaDashboard_Ordem"          int NOT NULL,
  "PesquisaDashboard_Modo"           text NOT NULL CHECK ("PesquisaDashboard_Modo" IN ('pesquisa','xingu')),
  FOREIGN KEY ("PesquisaDashboard_TenantId","PesquisaDashboard_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pesquisadashboard_pesquisa ON "PesquisaDashboard"
  ("PesquisaDashboard_TenantId","PesquisaDashboard_OrganizacaoId","PesquisaDashboard_PesquisaId");

-- RG-09 / doutrina "dossiê, não decisão": a sugestão é SUBSÍDIO e nasce
-- amarrada por FK ao dado do motor que a motivou — o CHECK torna impossível
-- gravar sugestão órfã (sem origem), por SQL direto inclusive.
CREATE TABLE IF NOT EXISTS "PesquisaSugestao" (
  "PesquisaSugestao_Id"                           bigserial PRIMARY KEY,
  "PesquisaSugestao_TenantId"                     uuid NOT NULL,
  "PesquisaSugestao_OrganizacaoId"                uuid NOT NULL,
  "PesquisaSugestao_PesquisaId"                   uuid NOT NULL REFERENCES "Pesquisa"("Pesquisa_Id") ON DELETE CASCADE,
  "PesquisaSugestao_Texto"                        text NOT NULL,
  "PesquisaSugestao_PraticaCitada"                text NOT NULL,
  "PesquisaSugestao_PesquisaIndicadorMunicipioId" bigint
    REFERENCES "PesquisaIndicadorMunicipio"("PesquisaIndicadorMunicipio_Id") ON DELETE CASCADE,
  "PesquisaSugestao_PesquisaIndicadorId"          bigint
    REFERENCES "PesquisaIndicador"("PesquisaIndicador_Id") ON DELETE CASCADE,
  "PesquisaSugestao_Agente"                       text NOT NULL,
  FOREIGN KEY ("PesquisaSugestao_TenantId","PesquisaSugestao_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT,
  CONSTRAINT pesquisasugestao_origem_obrigatoria CHECK (
    "PesquisaSugestao_PesquisaIndicadorMunicipioId" IS NOT NULL
    OR "PesquisaSugestao_PesquisaIndicadorId" IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS idx_pesquisasugestao_pesquisa ON "PesquisaSugestao"
  ("PesquisaSugestao_TenantId","PesquisaSugestao_OrganizacaoId","PesquisaSugestao_PesquisaId");
CREATE INDEX IF NOT EXISTS idx_pesquisasugestao_origem_municipio ON "PesquisaSugestao"
  ("PesquisaSugestao_PesquisaIndicadorMunicipioId");
CREATE INDEX IF NOT EXISTS idx_pesquisasugestao_origem_indicador ON "PesquisaSugestao"
  ("PesquisaSugestao_PesquisaIndicadorId");

-- Procedência congelada: mesmo que a fonte seja recarregada depois, o hash e
-- a extração aqui gravados são os que sustentaram ESTA resposta.
CREATE TABLE IF NOT EXISTS "PesquisaFonte" (
  "PesquisaFonte_Id"             bigserial PRIMARY KEY,
  "PesquisaFonte_TenantId"       uuid NOT NULL,
  "PesquisaFonte_OrganizacaoId"  uuid NOT NULL,
  "PesquisaFonte_PesquisaId"     uuid NOT NULL REFERENCES "Pesquisa"("Pesquisa_Id") ON DELETE CASCADE,
  "PesquisaFonte_FonteId"        int NOT NULL REFERENCES "Fonte"("Fonte_Id"),
  "PesquisaFonte_CargaId"        int REFERENCES "Carga"("Carga_Id"),
  "PesquisaFonte_HashSha256"     char(64),
  "PesquisaFonte_Url"            text,
  "PesquisaFonte_DataExtracao"   timestamptz,
  FOREIGN KEY ("PesquisaFonte_TenantId","PesquisaFonte_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pesquisafonte_pesquisa ON "PesquisaFonte"
  ("PesquisaFonte_TenantId","PesquisaFonte_OrganizacaoId","PesquisaFonte_PesquisaId");

CREATE TABLE IF NOT EXISTS "PesquisaExecucaoAgente" (
  "PesquisaExecucaoAgente_Id"             bigserial PRIMARY KEY,
  "PesquisaExecucaoAgente_TenantId"       uuid NOT NULL,
  "PesquisaExecucaoAgente_OrganizacaoId"  uuid NOT NULL,
  "PesquisaExecucaoAgente_PesquisaId"     uuid NOT NULL REFERENCES "Pesquisa"("Pesquisa_Id") ON DELETE CASCADE,
  "PesquisaExecucaoAgente_Agente"         text NOT NULL,
  "PesquisaExecucaoAgente_Entrada"        jsonb,
  "PesquisaExecucaoAgente_Saida"          jsonb,
  "PesquisaExecucaoAgente_DuracaoMs"      int,
  "PesquisaExecucaoAgente_Ok"             boolean NOT NULL,
  FOREIGN KEY ("PesquisaExecucaoAgente_TenantId","PesquisaExecucaoAgente_OrganizacaoId")
    REFERENCES "Organizacao"("Organizacao_TenantId","Organizacao_Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pesquisaexecucaoagente_pesquisa ON "PesquisaExecucaoAgente"
  ("PesquisaExecucaoAgente_TenantId","PesquisaExecucaoAgente_OrganizacaoId","PesquisaExecucaoAgente_PesquisaId");

-- RLS fail-closed + menor privilégio, o mesmo bloco para as 9 tabelas
-- (padrão db/40, em loop para não divergir tabela a tabela). Lembrete da
-- catraca: cada GRANT INSERT daqui tem linha correspondente na allowlist de
-- api/test/least-privilege.unit.mjs (EV-044) — sem ela a suíte reprova.
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'Pesquisa','PesquisaIndicador','PesquisaIndicadorMunicipio',
    'PesquisaSerieHistorica','PesquisaCausa','PesquisaDashboard',
    'PesquisaSugestao','PesquisaFonte','PesquisaExecucaoAgente'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t AND policyname = lower(t) || '_contexto'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I
           USING (%I = "ContextoTenant_Id"() AND %I = "ContextoOrganizacao_Id"())
           WITH CHECK (%I = "ContextoTenant_Id"() AND %I = "ContextoOrganizacao_Id"())',
        lower(t) || '_contexto', t,
        t || '_TenantId', t || '_OrganizacaoId',
        t || '_TenantId', t || '_OrganizacaoId');
    END IF;
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC, itmt_app', t);
    -- Pesquisa concluída é imutável: nunca UPDATE/DELETE para a aplicação.
    EXECUTE format('GRANT SELECT, INSERT ON %I TO itmt_app', t);
    IF t <> 'Pesquisa' THEN -- "Pesquisa" usa uuid, não tem sequência
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I TO itmt_app', t || '_' || t || '_Id_seq');
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE "Pesquisa" IS
  'Gauntlet P1: snapshot imutável de cada pesquisa executada (modo pesquisa/xingu); reabertura idêntica sem reexecutar motor/LLM. Hash = sha256 do payload canônico da resposta.';
COMMENT ON TABLE "PesquisaSugestao" IS
  'Subsídio (RG-09: dossiê, não decisão) — CHECK exige FK para o dado do motor que motivou a sugestão.';
COMMENT ON TABLE "PesquisaFonte" IS
  'Procedência congelada da resposta: fonte/carga/hash no momento da execução, auditável mesmo após recarga.';
