-- ============================================================
-- 12-hardening-serie.sql — Onda 1 (dados reais + governança).
--
-- (a) Partição retroativa de Observacao: a série histórica real
--     (IBGE) começa antes de 2020; sem a partição 2017-2019 a
--     carga aborta ("nenhuma partição encontrada para a linha").
--
-- (b) RG-09 endurecido no schema: Indicador_StatusValidacao tinha
--     DEFAULT 'APROVADO' — um INSERT que omitisse a coluna nasceria
--     publicado SEM parecer humano. Todo caminho da aplicação já
--     especifica 'EM_ANALISE' explicitamente; o default agora deixa
--     de ser uma brecha latente.
-- ============================================================

CREATE TABLE IF NOT EXISTS "Observacao_2017"
  PARTITION OF "Observacao" FOR VALUES FROM ('2017-01-01') TO ('2020-01-01');

-- Mesmos grants da aplicação nas demais partições (herdados por ser
-- partição, mas explícito não faz mal ao dono reexecutar).
GRANT SELECT, INSERT, UPDATE ON "Observacao_2017" TO itmt_app;

ALTER TABLE "Indicador" ALTER COLUMN "Indicador_StatusValidacao" SET DEFAULT 'EM_ANALISE';
