-- F2-R048: agenda persistente e observável de sincronização das fontes oficiais.
CREATE TABLE IF NOT EXISTS "FonteSincronizacao" (
  "FonteSincronizacao_Slug" text PRIMARY KEY,
  "FonteSincronizacao_Nome" text NOT NULL,
  "FonteSincronizacao_Tipo" text NOT NULL
    CHECK ("FonteSincronizacao_Tipo" IN ('API','DOWNLOAD','ARQUIVO_AUTORIZADO')),
  "FonteSincronizacao_Periodicidade" text NOT NULL
    CHECK ("FonteSincronizacao_Periodicidade" IN ('MENSAL','ANUAL','EVENTUAL')),
  "FonteSincronizacao_IntervaloDias" integer NOT NULL
    CHECK ("FonteSincronizacao_IntervaloDias" BETWEEN 1 AND 3660),
  "FonteSincronizacao_Status" text NOT NULL DEFAULT 'PENDENTE'
    CHECK ("FonteSincronizacao_Status" IN
      ('PENDENTE','EM_EXECUCAO','EM_DIA','ATUALIZADA','FALHA','BLOQUEADA_EXTERNA')),
  "FonteSincronizacao_UltimaVerificacao" timestamptz,
  "FonteSincronizacao_UltimoSucesso" timestamptz,
  "FonteSincronizacao_ProximaVerificacao" timestamptz NOT NULL DEFAULT now(),
  "FonteSincronizacao_Detalhes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "FonteSincronizacao_AtualizadoEm" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fonte_sincronizacao_pendentes
  ON "FonteSincronizacao" ("FonteSincronizacao_ProximaVerificacao")
  WHERE "FonteSincronizacao_Status" <> 'BLOQUEADA_EXTERNA';

REVOKE ALL ON "FonteSincronizacao" FROM PUBLIC, itmt_app;
GRANT SELECT ON "FonteSincronizacao" TO itmt_app;

COMMENT ON TABLE "FonteSincronizacao" IS
  'F2-R048: estado operacional da verificação incremental de fontes; cargas continuam auditadas em Carga/Auditoria.';
