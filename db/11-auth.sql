-- ============================================================
-- 11-auth.sql — Identidade e RBAC + registry de execução de agentes.
--
-- Usuario: conta com papel (ADMIN/CURADOR/PUBLICO). A senha nunca é
-- gravada em claro — só o hash scrypt (formato scrypt$sal$hash), gerado
-- pela API. O seed do 1º admin é feito no bootstrap do AuthService a
-- partir de ADMIN_SENHA_INICIAL (env/cofre), nunca aqui em claro.
--
-- AgentExecution: log operacional plugável de cada execução de agente
-- (F5, Xingú) — entrada/saída, modelo, custo, duração, fontes. É MUTÁVEL
-- e consultável; distinto da cadeia imutável de auditoria (RG-10).
-- ============================================================

CREATE TABLE IF NOT EXISTS "Usuario" (
  "Usuario_Id"        bigserial PRIMARY KEY,
  "Usuario_Email"     text NOT NULL UNIQUE,
  "Usuario_SenhaHash" text NOT NULL,
  "Usuario_Papel"     text NOT NULL DEFAULT 'PUBLICO'
                        CHECK ("Usuario_Papel" IN ('ADMIN','CURADOR','PUBLICO')),
  "Usuario_Ativo"     boolean NOT NULL DEFAULT true,
  "Usuario_CriadoEm"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AgentExecution" (
  "AgentExecution_Id"            bigserial PRIMARY KEY,
  "AgentExecution_Quando"        timestamptz NOT NULL DEFAULT now(),
  "AgentExecution_Agente"        text NOT NULL,
  "AgentExecution_Entrada"       jsonb,
  "AgentExecution_Saida"         jsonb,
  "AgentExecution_Modelo"        text,
  "AgentExecution_Provedor"      text,
  "AgentExecution_TokensEntrada" int NOT NULL DEFAULT 0,
  "AgentExecution_TokensSaida"   int NOT NULL DEFAULT 0,
  "AgentExecution_DuracaoMs"     int NOT NULL DEFAULT 0,
  "AgentExecution_Fontes"        jsonb,
  "AgentExecution_Ok"            boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_agentexec_quando ON "AgentExecution" ("AgentExecution_Quando");
CREATE INDEX IF NOT EXISTS idx_agentexec_agente ON "AgentExecution" ("AgentExecution_Agente");

-- itmt_app: lê e cria usuários (bootstrap/rotação), lê/insere execuções.
GRANT SELECT, INSERT, UPDATE ON "Usuario" TO itmt_app;
GRANT USAGE, SELECT ON SEQUENCE "Usuario_Usuario_Id_seq" TO itmt_app;
GRANT SELECT, INSERT ON "AgentExecution" TO itmt_app;
GRANT USAGE, SELECT ON SEQUENCE "AgentExecution_AgentExecution_Id_seq" TO itmt_app;
