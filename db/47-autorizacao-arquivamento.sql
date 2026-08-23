-- ============================================================
-- 47-autorizacao-arquivamento.sql (EV-20260822-055)
-- "Autorizacao" não tinha ciclo de vida: uma vez cadastrada, aparecia nos
-- alertas D-90/30/7 para sempre — inclusive 13 fixtures de suíte que poluíam
-- o painel do curador no dev. Mesma lacuna que "Direito" tinha antes do
-- endpoint de despublicação (EV-047): sem caminho auditado de saída, a única
-- alternativa era SQL direto, que fura a trilha.
-- ============================================================

ALTER TABLE "Autorizacao"
  ADD COLUMN IF NOT EXISTS "Autorizacao_Status" text NOT NULL DEFAULT 'ATIVA'
    CHECK ("Autorizacao_Status" IN ('ATIVA','ARQUIVADA'));

-- A API arquiva via endpoint auditado; exige UPDATE. Lembrete da catraca:
-- este grant precisa da linha correspondente na allowlist de
-- test/least-privilege.unit.mjs (EV-044) — sem ela, a suíte reprova.
GRANT UPDATE ON "Autorizacao" TO itmt_app;

-- O veto de campo (RF-CAMPO-002, db/04) validava autorização apenas pela
-- vigência — uma autorização ARQUIVADA continuaria autorizando missão. O
-- arquivamento precisa valer também na fronteira mais dura:
CREATE OR REPLACE FUNCTION f3_veto_execucao_missao() RETURNS trigger AS $$
DECLARE validas int;
BEGIN
  IF NEW."MissaoCampo_StatusExecucao" IN ('EM_CAMPO','EXECUTADA') THEN
    SELECT count(*) INTO validas
      FROM "MissaoAutorizacao" ma
      JOIN "Autorizacao" a ON a."Autorizacao_Id" = ma."MissaoAutorizacao_AutorizacaoId"
     WHERE ma."MissaoAutorizacao_MissaoId" = NEW."MissaoCampo_Id"
       AND a."Autorizacao_Status" = 'ATIVA'
       AND a."Autorizacao_VigenciaInicio" <= CURRENT_DATE
       AND a."Autorizacao_VigenciaFim"   >= CURRENT_DATE;
    IF validas = 0 THEN
      RAISE EXCEPTION 'RF-CAMPO-002: missão % sem autorização ATIVA e vigente — execução vetada por flag de banco.', NEW."MissaoCampo_Id";
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
