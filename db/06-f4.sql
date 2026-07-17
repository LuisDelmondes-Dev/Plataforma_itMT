-- ============================================================
-- 06-f4.sql — F4: Mapa de Serviços Públicos Gratuitos, Benefícios
-- e Direitos do Cidadão ("Mapa de Direitos").
-- A ficha segue o §6 do prompt mestre (docs/F4-PROMPT-MESTRE.md);
-- a classificação de confiança segue o §10; e as regras de
-- confiabilidade do §2 viram VETOS DE BANCO (F4-RG-01..06):
-- nada publica sem base legal, fonte oficial e data de verificação
-- — trigger, não convenção de equipe (mesma marca do F3).
-- ============================================================

-- Públicos elegíveis (§3 do prompt mestre)
CREATE TABLE IF NOT EXISTS "PublicoAlvo" (
  "PublicoAlvo_Id"   serial PRIMARY KEY,
  "PublicoAlvo_Slug" text NOT NULL UNIQUE,
  "PublicoAlvo_Nome" text NOT NULL
);

-- Doenças, deficiências e condições que PODEM gerar direitos (§4.6–4.8).
-- A tabela registra a associação; o automatismo NUNCA é afirmado —
-- a nuance vai em "DireitoCondicao_Observacao".
CREATE TABLE IF NOT EXISTS "CondicaoSaude" (
  "CondicaoSaude_Id"   serial PRIMARY KEY,
  "CondicaoSaude_Slug" text NOT NULL UNIQUE,
  "CondicaoSaude_Nome" text NOT NULL,
  "CondicaoSaude_Tipo" text NOT NULL
    CHECK ("CondicaoSaude_Tipo" IN ('DOENCA','DEFICIENCIA','NEURODESENVOLVIMENTO','SEQUELA'))
);

-- A ficha do §6, campo a campo.
CREATE TABLE IF NOT EXISTS "Direito" (
  "Direito_Id"                serial PRIMARY KEY,
  "Direito_Nome"              text NOT NULL,
  "Direito_Area"              text NOT NULL CHECK ("Direito_Area" IN (
    'DOCUMENTACAO','ASSISTENCIA_SOCIAL','RENDA','PREVIDENCIA','SAUDE','PESSOA_COM_DEFICIENCIA',
    'EDUCACAO','TRABALHO','HABITACAO','TRANSPORTE','JUSTICA','CONSUMIDOR','TRIBUTOS',
    'SERVICOS_ESSENCIAIS','CULTURA_ESPORTE_LAZER','ALIMENTACAO','PROTECAO','PESSOA_IDOSA',
    'POVOS_TRADICIONAIS','RURAL_MEIO_AMBIENTE','SERVICOS_DIGITAIS')),
  "Direito_Resumo"            text NOT NULL,          -- linguagem simples (§14)
  "Direito_QuemPodeUsar"      text NOT NULL,
  "Direito_QuemNaoSeEnquadra" text,
  "Direito_Gratuidade"        text NOT NULL DEFAULT 'GRATUITO'
    CHECK ("Direito_Gratuidade" IN ('GRATUITO','SUBSIDIADO','COPARTICIPACAO','DEPENDE_DE_CRITERIOS')),
  "Direito_Abrangencia"       text NOT NULL
    CHECK ("Direito_Abrangencia" IN ('FEDERAL','ESTADUAL','DISTRITAL','MUNICIPAL','REGIONAL')),
  "Direito_OrgaoGestor"       text NOT NULL,
  "Direito_OrgaoExecutor"     text,
  "Direito_BaseLegal"         text,                   -- obrigatória NA PUBLICAÇÃO (F4-RG-02)
  "Direito_NaturezaNorma"     text NOT NULL
    CHECK ("Direito_NaturezaNorma" IN ('CONSTITUICAO','LEI','DECRETO','PORTARIA','RESOLUCAO',
      'INSTRUCAO_NORMATIVA','DECISAO_JUDICIAL','PRATICA_ADMINISTRATIVA','PROJETO_DE_LEI')),
  "Direito_Requisitos"        text,
  "Direito_CriterioRenda"     text,                   -- NULL = independe da renda
  "Direito_ExigeContribuicaoInss" boolean NOT NULL DEFAULT false,
  "Direito_Automatico"        boolean NOT NULL DEFAULT false, -- concedido sem pedido
  "Direito_Documentos"        text,
  "Direito_LaudoPericia"      text,                   -- quem emite, validade, avaliação oficial
  "Direito_ComoSolicitar"     text,
  "Direito_OndeSolicitar"     text,                   -- site, app, telefone, presencial
  "Direito_LinkOficial"       text,                   -- domínio oficial NA PUBLICAÇÃO (F4-RG-04)
  "Direito_PrazoEstimado"     text,
  "Direito_ValidadeRenovacao" text,
  "Direito_ValorCobertura"    text,                   -- preferir fórmula legal a R$ que expira (§2.11)
  "Direito_Acumulacao"        text,
  "Direito_MotivosNegativa"   text,
  "Direito_ComoRecorrer"      text,
  "Direito_CanaisReclamacao"  text,
  "Direito_Observacoes"       text,                   -- riscos, exceções, variações locais
  "Direito_Confianca"         text NOT NULL DEFAULT 'NECESSITA_CONFIRMACAO'
    CHECK ("Direito_Confianca" IN ('CONFIRMADA','CONFIRMADA_VARIACAO_LOCAL','CONDICIONADA_AVALIACAO',
      'JURISPRUDENCIAL','EM_REGULAMENTACAO','NECESSITA_CONFIRMACAO','REVOGADA')),
  "Direito_PoucoConhecido"    boolean NOT NULL DEFAULT false,  -- §5 do prompt mestre
  "Direito_DataVerificacao"   date,                   -- obrigatória NA PUBLICAÇÃO (F4-RG-05)
  "Direito_Status"            text NOT NULL DEFAULT 'RASCUNHO'
    CHECK ("Direito_Status" IN ('RASCUNHO','PUBLICADO'))
);

CREATE TABLE IF NOT EXISTS "DireitoPublico" (
  "DireitoPublico_DireitoId" int NOT NULL REFERENCES "Direito"("Direito_Id"),
  "DireitoPublico_PublicoId" int NOT NULL REFERENCES "PublicoAlvo"("PublicoAlvo_Id"),
  PRIMARY KEY ("DireitoPublico_DireitoId","DireitoPublico_PublicoId")
);

CREATE TABLE IF NOT EXISTS "DireitoCondicao" (
  "DireitoCondicao_DireitoId"  int NOT NULL REFERENCES "Direito"("Direito_Id"),
  "DireitoCondicao_CondicaoId" int NOT NULL REFERENCES "CondicaoSaude"("CondicaoSaude_Id"),
  "DireitoCondicao_Observacao" text,  -- a nuance que impede o automatismo (§4.8 itens 1–2)
  PRIMARY KEY ("DireitoCondicao_DireitoId","DireitoCondicao_CondicaoId")
);

-- §8 — "Descubra todos os seus direitos": fatores DETERMINÍSTICOS.
-- Efeito REQUISITO   → não atendido = direito descartado com motivo;
-- Efeito AVALIACAO   → o motor NUNCA decide: encaminha para avaliação.
-- F4-RG-06 (CHECK): renda, perícia e condição específica são SEMPRE
-- AVALIACAO — o motor não afirma elegibilidade sobre limite de renda
-- vigente nem sobre laudo/avaliação biopsicossocial (§11).
CREATE TABLE IF NOT EXISTS "RegraElegibilidade" (
  "RegraElegibilidade_Id"        serial PRIMARY KEY,
  "RegraElegibilidade_DireitoId" int NOT NULL REFERENCES "Direito"("Direito_Id"),
  "RegraElegibilidade_Fator"     text NOT NULL CHECK ("RegraElegibilidade_Fator" IN (
    'IDADE_MIN','IDADE_MAX','CADUNICO','CONTRIBUINTE_INSS','DEFICIENCIA','DOENCA_GRAVE',
    'GESTANTE','ESTUDANTE','DESEMPREGADO','ZONA_RURAL','CUIDADOR','TRABALHADOR_FORMAL',
    'RENDA_LIMITE','PERICIA','CONDICAO_ESPECIFICA')),
  "RegraElegibilidade_ValorNumerico" numeric,          -- só IDADE_MIN / IDADE_MAX
  "RegraElegibilidade_Efeito"    text NOT NULL
    CHECK ("RegraElegibilidade_Efeito" IN ('REQUISITO','AVALIACAO')),
  "RegraElegibilidade_Descricao" text NOT NULL,
  CONSTRAINT f4_rg_06_avaliacao_obrigatoria CHECK (
    "RegraElegibilidade_Fator" NOT IN ('RENDA_LIMITE','PERICIA','CONDICAO_ESPECIFICA')
    OR "RegraElegibilidade_Efeito" = 'AVALIACAO')
);

-- Benefícios que NÃO acumulam (§1 "quais benefícios não podem ser acumulados")
CREATE TABLE IF NOT EXISTS "IncompatibilidadeBeneficio" (
  "IncompatibilidadeBeneficio_Id"       serial PRIMARY KEY,
  "IncompatibilidadeBeneficio_DireitoA" int NOT NULL REFERENCES "Direito"("Direito_Id"),
  "IncompatibilidadeBeneficio_DireitoB" int NOT NULL REFERENCES "Direito"("Direito_Id"),
  "IncompatibilidadeBeneficio_Descricao" text NOT NULL,
  CHECK ("IncompatibilidadeBeneficio_DireitoA" <> "IncompatibilidadeBeneficio_DireitoB")
);

-- ------------------------------------------------------------
-- VETOS DE PUBLICAÇÃO — as regras do §2 e §10 como trigger.
-- F4-RG-01: projeto de lei jamais publica como direito vigente (§2.6).
-- F4-RG-02: sem base legal não publica (§2.3).
-- F4-RG-03: REVOGADA não publica como direito atual (§10).
-- F4-RG-04: o link deve apontar para domínio oficial (§2.1/2.4/2.7).
-- F4-RG-05: sem data de verificação não publica (§2.2).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION f4_vetos_publicacao() RETURNS trigger AS $$
BEGIN
  IF NEW."Direito_Status" <> 'PUBLICADO' THEN RETURN NEW; END IF;
  IF NEW."Direito_NaturezaNorma" = 'PROJETO_DE_LEI' THEN
    RAISE EXCEPTION 'F4-RG-01: "%" é projeto de lei — não publica como direito vigente.',
      NEW."Direito_Nome";
  END IF;
  IF NEW."Direito_BaseLegal" IS NULL OR btrim(NEW."Direito_BaseLegal") = '' THEN
    RAISE EXCEPTION 'F4-RG-02: "%" sem base legal — publicação bloqueada por flag de banco.',
      NEW."Direito_Nome";
  END IF;
  IF NEW."Direito_Confianca" = 'REVOGADA' THEN
    RAISE EXCEPTION 'F4-RG-03: "%" está REVOGADA — não é apresentada como direito atual.',
      NEW."Direito_Nome";
  END IF;
  IF NEW."Direito_LinkOficial" IS NULL
     OR NEW."Direito_LinkOficial" !~* '^https?://[^/]*(gov\.br|jus\.br|leg\.br|mp\.br|def\.br)(/|$)' THEN
    RAISE EXCEPTION 'F4-RG-04: "%" sem link para domínio oficial (gov.br/jus.br/leg.br/mp.br/def.br).',
      NEW."Direito_Nome";
  END IF;
  IF NEW."Direito_DataVerificacao" IS NULL THEN
    RAISE EXCEPTION 'F4-RG-05: "%" sem data de última verificação — publicação bloqueada.',
      NEW."Direito_Nome";
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_f4_vetos_publicacao ON "Direito";
CREATE TRIGGER trg_f4_vetos_publicacao
  BEFORE INSERT OR UPDATE ON "Direito"
  FOR EACH ROW EXECUTE FUNCTION f4_vetos_publicacao();

CREATE INDEX IF NOT EXISTS idx_direito_area ON "Direito"("Direito_Area") WHERE "Direito_Status"='PUBLICADO';
