-- ============================================================
-- 04-f3.sql — Produção própria (PRD §11.4) — módulos GEO,
-- MTIMAGENS/VIDEOS e CAMPO, com os VETOS implementados como
-- triggers de banco: "por flag de banco, não por convenção
-- de equipe" (RF-GEO-007 / RC-02..04 / RF-CAMPO-002).
-- ============================================================

-- ---------------- GEO ----------------
CREATE TABLE IF NOT EXISTS "ProjetoLevantamento" (
  "ProjetoLevantamento_Id"          serial PRIMARY KEY,
  "ProjetoLevantamento_CodigoIbge"  char(7) NOT NULL REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "ProjetoLevantamento_NumeroAutorizacaoCadastro" text NOT NULL,   -- RF-GEO-004
  "ProjetoLevantamento_NumeroAutorizacaoVoo"      text NOT NULL,
  "ProjetoLevantamento_ResponsavelTecnico"        text NOT NULL,
  "ProjetoLevantamento_RegistroProfissional"      text NOT NULL,
  "ProjetoLevantamento_DataVoo"     date NOT NULL,
  "ProjetoLevantamento_Sensor"      text NOT NULL,
  "ProjetoLevantamento_AlturaVooM"  numeric,
  "ProjetoLevantamento_GsdCm"       numeric NOT NULL,
  "ProjetoLevantamento_AcuraciaDeclarada" text NOT NULL,           -- RF-GEO-002
  "ProjetoLevantamento_SistemaReferencia" text NOT NULL DEFAULT 'SIRGAS 2000'
    CHECK ("ProjetoLevantamento_SistemaReferencia" = 'SIRGAS 2000') -- RNF-13
);

CREATE TABLE IF NOT EXISTS "ProdutoGeografico" (
  "ProdutoGeografico_Id"        serial PRIMARY KEY,
  "ProdutoGeografico_ProjetoId" int NOT NULL REFERENCES "ProjetoLevantamento"("ProjetoLevantamento_Id"),
  "ProdutoGeografico_Tipo"      text NOT NULL
    CHECK ("ProdutoGeografico_Tipo" IN ('ORTOMOSAICO','MDS','MDT','CURVA_NIVEL','NUVEM_PONTOS')),
  "ProdutoGeografico_CaminhoObjeto" text NOT NULL,                 -- object storage
  "ProdutoGeografico_FormatoDownload" text,                        -- GeoTIFF | LAS-LAZ | GeoPackage (RF-GEO-003)
  "ProdutoGeografico_Classificacao" text NOT NULL DEFAULT 'PUBLICO'
    CHECK ("ProdutoGeografico_Classificacao" IN ('PUBLICO','RESTRITO','CLASSIFICADO')),
  "ProdutoGeografico_StatusPublicacao" text NOT NULL DEFAULT 'RASCUNHO'
    CHECK ("ProdutoGeografico_StatusPublicacao" IN ('RASCUNHO','PUBLICADO'))
);

-- RF-GEO-007 / RC-02: produto restrito/classificado é bloqueado NA PUBLICAÇÃO
-- por flag de banco. Trigger, não convenção.
CREATE OR REPLACE FUNCTION f3_bloquear_produto_classificado() RETURNS trigger AS $$
BEGIN
  IF NEW."ProdutoGeografico_StatusPublicacao" = 'PUBLICADO'
     AND NEW."ProdutoGeografico_Classificacao" <> 'PUBLICO' THEN
    RAISE EXCEPTION 'RF-GEO-007: produto % classificado como % — publicação bloqueada por flag de banco.',
      NEW."ProdutoGeografico_Id", NEW."ProdutoGeografico_Classificacao";
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_produto_classificado ON "ProdutoGeografico";
CREATE TRIGGER trg_produto_classificado
  BEFORE INSERT OR UPDATE ON "ProdutoGeografico"
  FOR EACH ROW EXECUTE FUNCTION f3_bloquear_produto_classificado();

-- RF-GEO-008/009: cobertura de imagem de rua com CÓPIA SOBERANA estrutural
CREATE TABLE IF NOT EXISTS "CapturaImagemRua" (
  "CapturaImagemRua_Id"          serial PRIMARY KEY,
  "CapturaImagemRua_CodigoIbge"  char(7) NOT NULL REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "CapturaImagemRua_Origem"      text NOT NULL DEFAULT 'ITMT'
    CHECK ("CapturaImagemRua_Origem" IN ('ITMT','PREEXISTENTE')),
  "CapturaImagemRua_DataCaptura" date,
  "CapturaImagemRua_KmPercorridos" numeric,
  -- RF-GEO-009: a cópia soberana é NOT NULL — restrição estrutural, não procedural
  "CapturaImagemRua_CaminhoAcervoProprio" text NOT NULL,
  "CapturaImagemRua_StatusPublicacao" text NOT NULL DEFAULT 'PENDENTE'
    CHECK ("CapturaImagemRua_StatusPublicacao" IN ('PENDENTE','PUBLICADO')),
  "CapturaImagemRua_IdColecaoExterna" text   -- publicação externa: assíncrona e não garantida (RC-11)
);

-- RF-GEO-006: projetos estruturantes
CREATE TABLE IF NOT EXISTS "ProjetoEstruturante" (
  "ProjetoEstruturante_Id"         serial PRIMARY KEY,
  "ProjetoEstruturante_CodigoIbge" char(7) NOT NULL REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "ProjetoEstruturante_Tipo"       text NOT NULL CHECK ("ProjetoEstruturante_Tipo" IN
    ('PCH','HIDRELETRICA','FABRICA','ARMAZENAGEM','TERMINAL','FAZENDA','AEROPORTO','REBAIXAMENTO_ENERGIA','PONTO_TURISTICO','FRIGORIFICO')),
  "ProjetoEstruturante_Nome"       text NOT NULL,
  "ProjetoEstruturante_Latitude"   numeric,
  "ProjetoEstruturante_Longitude"  numeric,
  "ProjetoEstruturante_Descricao"  text
);

-- ---------------- MTIMAGENS / VIDEOS ----------------
CREATE TABLE IF NOT EXISTS "TermoConsentimento" (
  "TermoConsentimento_Id"          serial PRIMARY KEY,
  "TermoConsentimento_TitularNome" text NOT NULL,
  "TermoConsentimento_TipoTermo"   text NOT NULL
    CHECK ("TermoConsentimento_TipoTermo" IN ('IMAGEM_VOZ','COLETA_DOMICILIAR')),
  "TermoConsentimento_DataAssinatura" date NOT NULL,
  "TermoConsentimento_CaminhoDocumento" text NOT NULL,
  "TermoConsentimento_HashSha256"  char(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS "AtivoMidia" (
  "AtivoMidia_Id"          serial PRIMARY KEY,
  "AtivoMidia_CodigoIbge"  char(7) NOT NULL REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "AtivoMidia_Tipo"        text NOT NULL
    CHECK ("AtivoMidia_Tipo" IN ('FOTO','VIDEO','VIDEO_360','FOTO_360')),
  "AtivoMidia_Titulo"      text NOT NULL,
  "AtivoMidia_Autor"       text NOT NULL,                          -- cadeia de direitos (RF-IMG-003)
  "AtivoMidia_Licenca"     text,                                   -- A12 exige na publicação
  "AtivoMidia_CaminhoObjeto" text NOT NULL,
  "AtivoMidia_ViaPublica"  boolean NOT NULL DEFAULT false,
  "AtivoMidia_TemPessoaIdentificavel" boolean NOT NULL DEFAULT false,
  "AtivoMidia_TermoConsentimentoId" int REFERENCES "TermoConsentimento"("TermoConsentimento_Id"),
  "AtivoMidia_AnonimizacaoAplicada" boolean NOT NULL DEFAULT false, -- A11
  "AtivoMidia_Contribuicao" boolean NOT NULL DEFAULT false,         -- RF-IMG-002
  "AtivoMidia_StatusModeracao" text NOT NULL DEFAULT 'PENDENTE'
    CHECK ("AtivoMidia_StatusModeracao" IN ('PENDENTE','APROVADO','REJEITADO')),
  "AtivoMidia_DuracaoMin"  numeric,                                 -- vídeos institucionais 15–20 min
  "AtivoMidia_CaminhoLegenda" text,                                 -- RNF-10
  "AtivoMidia_CaminhoTranscricao" text,
  "AtivoMidia_StatusPublicacao" text NOT NULL DEFAULT 'RASCUNHO'
    CHECK ("AtivoMidia_StatusPublicacao" IN ('RASCUNHO','PUBLICADO')),
  "AtivoMidia_Tags"        text
);
CREATE INDEX IF NOT EXISTS idx_ativo_busca
  ON "AtivoMidia" ("AtivoMidia_CodigoIbge","AtivoMidia_Tipo","AtivoMidia_StatusPublicacao");

-- VETOS A11 + A12 + RC-04 + RF-IMG-002/005, todos por flag de banco:
CREATE OR REPLACE FUNCTION f3_vetos_publicacao_midia() RETURNS trigger AS $$
BEGIN
  IF NEW."AtivoMidia_StatusPublicacao" = 'PUBLICADO' THEN
    -- A12 Guardião de Licença: sem licença explícita, não publica (RF-IMG-003 / RC-08)
    IF NEW."AtivoMidia_Licenca" IS NULL OR NEW."AtivoMidia_Licenca" = '' THEN
      RAISE EXCEPTION 'A12/RF-IMG-003: ativo % sem licença explícita — publicação vetada.', NEW."AtivoMidia_Id";
    END IF;
    -- A11 Anonimizador: via pública exige anonimização verificada (RC-03)
    IF NEW."AtivoMidia_ViaPublica" AND NOT NEW."AtivoMidia_AnonimizacaoAplicada" THEN
      RAISE EXCEPTION 'A11/RC-03: ativo % é de via pública sem anonimização aplicada — publicação vetada.', NEW."AtivoMidia_Id";
    END IF;
    -- RC-04: pessoa identificável exige termo de consentimento vinculado
    IF NEW."AtivoMidia_TemPessoaIdentificavel" AND NEW."AtivoMidia_TermoConsentimentoId" IS NULL THEN
      RAISE EXCEPTION 'RC-04/RF-IMG-006: ativo % com pessoa identificável sem termo — publicação vetada.', NEW."AtivoMidia_Id";
    END IF;
    -- RF-IMG-002: contribuição externa exige moderação prévia APROVADA
    IF NEW."AtivoMidia_Contribuicao" AND NEW."AtivoMidia_StatusModeracao" <> 'APROVADO' THEN
      RAISE EXCEPTION 'RF-IMG-002: contribuição % sem moderação aprovada — publicação vetada.', NEW."AtivoMidia_Id";
    END IF;
    -- RF-IMG-005 / RNF-10: vídeo publicado exige legenda E transcrição
    IF NEW."AtivoMidia_Tipo" IN ('VIDEO','VIDEO_360')
       AND (NEW."AtivoMidia_CaminhoLegenda" IS NULL OR NEW."AtivoMidia_CaminhoTranscricao" IS NULL) THEN
      RAISE EXCEPTION 'RNF-10/RF-IMG-005: vídeo % sem legenda/transcrição — publicação vetada.', NEW."AtivoMidia_Id";
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_vetos_midia ON "AtivoMidia";
CREATE TRIGGER trg_vetos_midia
  BEFORE INSERT OR UPDATE ON "AtivoMidia"
  FOR EACH ROW EXECUTE FUNCTION f3_vetos_publicacao_midia();

-- ---------------- CAMPO ----------------
CREATE TABLE IF NOT EXISTS "MissaoCampo" (
  "MissaoCampo_Id"          serial PRIMARY KEY,
  "MissaoCampo_CodigoIbge"  char(7) NOT NULL REFERENCES "Municipio"("Municipio_CodigoIbge"),
  "MissaoCampo_Frente"      text NOT NULL
    CHECK ("MissaoCampo_Frente" IN ('GEO','ESTRUTURANTE','AUDIOVISUAL','ESTATISTICO')),
  "MissaoCampo_ProdutoEsperado" text NOT NULL,
  "MissaoCampo_Equipe"      text NOT NULL,
  "MissaoCampo_PoligonoGeoJson" jsonb,
  "MissaoCampo_JanelaInicio" date NOT NULL,
  "MissaoCampo_JanelaFim"    date NOT NULL,
  "MissaoCampo_StatusExecucao" text NOT NULL DEFAULT 'PLANEJADA'
    CHECK ("MissaoCampo_StatusExecucao" IN ('PLANEJADA','EM_CAMPO','EXECUTADA','CANCELADA'))
);

CREATE TABLE IF NOT EXISTS "MissaoAutorizacao" (
  "MissaoAutorizacao_MissaoId"      int NOT NULL REFERENCES "MissaoCampo"("MissaoCampo_Id"),
  "MissaoAutorizacao_AutorizacaoId" int NOT NULL REFERENCES "Autorizacao"("Autorizacao_Id"),
  PRIMARY KEY ("MissaoAutorizacao_MissaoId","MissaoAutorizacao_AutorizacaoId")
);

-- RF-CAMPO-002 (P0): missão sem autorização VÁLIDA não pode ser executada.
CREATE OR REPLACE FUNCTION f3_veto_execucao_missao() RETURNS trigger AS $$
DECLARE validas int;
BEGIN
  IF NEW."MissaoCampo_StatusExecucao" IN ('EM_CAMPO','EXECUTADA') THEN
    SELECT count(*) INTO validas
      FROM "MissaoAutorizacao" ma
      JOIN "Autorizacao" a ON a."Autorizacao_Id" = ma."MissaoAutorizacao_AutorizacaoId"
     WHERE ma."MissaoAutorizacao_MissaoId" = NEW."MissaoCampo_Id"
       AND a."Autorizacao_VigenciaInicio" <= CURRENT_DATE
       AND a."Autorizacao_VigenciaFim"   >= CURRENT_DATE;
    IF validas = 0 THEN
      RAISE EXCEPTION 'RF-CAMPO-002: missão % sem autorização vigente — execução vetada por flag de banco.', NEW."MissaoCampo_Id";
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_veto_missao ON "MissaoCampo";
CREATE TRIGGER trg_veto_missao
  BEFORE UPDATE ON "MissaoCampo"
  FOR EACH ROW EXECUTE FUNCTION f3_veto_execucao_missao();

-- RF-CAMPO-003: capturas de campo com metadados (EXIF, GNSS, sensor, operador)
CREATE TABLE IF NOT EXISTS "CapturaCampo" (
  "CapturaCampo_Id"        bigserial PRIMARY KEY,
  "CapturaCampo_MissaoId"  int NOT NULL REFERENCES "MissaoCampo"("MissaoCampo_Id"),
  "CapturaCampo_Operador"  text NOT NULL,
  "CapturaCampo_Sensor"    text,
  "CapturaCampo_Gnss"      jsonb,        -- {lat, lon, alt, precisao_m}
  "CapturaCampo_Exif"      jsonb,
  "CapturaCampo_ChecklistOk" boolean NOT NULL DEFAULT false,
  "CapturaCampo_CaminhoObjeto" text NOT NULL,
  "CapturaCampo_CapturadoEm" timestamptz NOT NULL,
  "CapturaCampo_SincronizadoEm" timestamptz NOT NULL DEFAULT now() -- offline-first: captura ≠ sincronização
);

GRANT SELECT ON ALL TABLES IN SCHEMA public TO itmt_app;
