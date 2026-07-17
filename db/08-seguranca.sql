-- ============================================================
-- 08-seguranca.sql — Produção: a API conecta como itmt_app,
-- NUNCA como dono do banco. Com isso a imutabilidade da trilha
-- (RG-10) volta a ser flag de banco: itmt_app pode INSERT em
-- toda parte, mas UPDATE/DELETE em "EventoAuditoria" é revogado
-- no nível do Postgres — nem bug nem operador via API alteram
-- o histórico.
-- Em produção: DATABASE_URL=postgres://itmt_app:...@host/itmt
-- ============================================================

-- Escrita de aplicação em todas as tabelas de domínio
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO itmt_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO itmt_app;

-- A exceção que define o sistema: trilha de auditoria é INSERT-ONLY.
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria" FROM itmt_app;

-- Tabelas e sequências futuras criadas pelo dono seguem a mesma regra.
-- ATENÇÃO: toda nova tabela imutável precisa do seu próprio REVOKE
-- explícito (como acima) na migração que a criar.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT INSERT, UPDATE, DELETE ON TABLES TO itmt_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO itmt_app;
