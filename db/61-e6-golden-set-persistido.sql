-- ============================================================
-- 61-e6-golden-set-persistido.sql (Evolução E6 · ADR-010)
--
-- ADR-010 (docs/adr/ADR-010-absorcao-arquitetura-analitica.md), evolução E6 —
-- o último degrau da lista original: o banco de perguntas de regressão da IA
-- Xingú (golden set, KR3.1/3.3) vira DADO GOVERNADO no banco da plataforma.
-- A própria pesquisa externa validou a doutrina ("132 perguntas ≈ golden
-- set/ratchet", registro do ADR): perguntas de regressão são catálogo vivo,
-- não artefato solto. Até aqui o golden set vivia só em
-- api/golden/golden-set.json (gerado por npm run golden:gerar) e o RESULTADO
-- de cada avaliação (npm run golden:avaliar) se perdia no stdout — impossível
-- responder "regredimos em relação à rodada passada?" sem grep em terminal.
--
-- Duas tabelas:
--   · "GoldenPergunta"  — o banco de perguntas. Código estável (sha256 do
--     texto, prefixo de 16 hex — o texto É a identidade; o plano esperado
--     evolui com o catálogo). Origem GERADA (produzida do catálogo real pelo
--     gerador) ou CURADA (adicionada à mão; o gerador NUNCA a toca). Pergunta
--     que sai do catálogo vira Ativa=false — nunca DELETE (aposentadoria sem
--     apagar história, padrão "FonteConector" db/55).
--   · "GoldenAvaliacao" — histórico APPEND-ONLY das rodadas: cada caso
--     avaliado grava resultado (CORRETO/INCORRETO/ERRO), detalhe (plano
--     obtido × esperado), provedor usado (lexico/anthropic/...) e latência.
--     Imutável POR GRANT, como o histórico de conformidade (db/39) e as
--     pesquisas persistidas (db/48): itmt_app recebe SELECT+INSERT e nunca
--     UPDATE/DELETE. Rodada nova = linhas novas; comparação entre rodadas é
--     SELECT, não reescrita.
--
-- SEM SEED de propósito: quem popula é o gerador — o dado nasce do catálogo
-- real de CADA instalação (municípios e indicadores APROVADOS dela), nunca de
-- fixture ("nunca converta fixture em evidência", CLAUDE.md). O JSON continua
-- sendo escrito pelo gerador (retrocompatibilidade/uso offline), mas passa a
-- ser DERIVADO: o banco é a fonte de verdade quando disponível (degradação
-- segura no espírito da RG-05, documentada nos scripts).
--
-- Catálogo global da plataforma (como "FonteConector"): SEM colunas de
-- tenant e SEM RLS — o golden set audita o motor, não dado de inquilino.
-- Ratchet: api/test/golden.unit.mjs; grants novos têm linha correspondente
-- na allowlist de api/test/least-privilege.unit.mjs (a catraca, EV-044).
-- ============================================================

CREATE TABLE IF NOT EXISTS "GoldenPergunta" (
  -- sha256(pergunta) truncado em 16 hex para GERADA; CURADA pode usar um
  -- slug legível — por isso o CHECK é de formato frouxo, não de hex.
  "GoldenPergunta_Codigo"       text PRIMARY KEY
    CHECK (char_length("GoldenPergunta_Codigo") BETWEEN 1 AND 64),
  "GoldenPergunta_Pergunta"     text NOT NULL
    CHECK (char_length("GoldenPergunta_Pergunta") BETWEEN 1 AND 1000),
  -- O plano de consulta esperado — exatamente o que o golden-set.json guarda
  -- hoje em "esperado": {recorte, codigo, indicador_id, referencia} ou os
  -- terminais {clarificacao: true} / {bloqueio: true}.
  "GoldenPergunta_Esperado"     jsonb NOT NULL,
  "GoldenPergunta_Categoria"    text NOT NULL,
  "GoldenPergunta_Origem"       text NOT NULL DEFAULT 'GERADA'
    CHECK ("GoldenPergunta_Origem" IN ('GERADA','CURADA')),
  "GoldenPergunta_Ativa"        boolean NOT NULL DEFAULT true,
  -- Ordem canônica de avaliação (posição na geração; amostragem por limite
  -- corta um prefixo representativo, como o JSON fazia).
  "GoldenPergunta_Ordem"        integer NOT NULL DEFAULT 0,
  "GoldenPergunta_CriadaEm"     timestamptz NOT NULL DEFAULT now(),
  "GoldenPergunta_AtualizadaEm" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goldenpergunta_ativas
  ON "GoldenPergunta" ("GoldenPergunta_Ativa", "GoldenPergunta_Ordem");

CREATE TABLE IF NOT EXISTS "GoldenAvaliacao" (
  "GoldenAvaliacao_Id"             bigserial PRIMARY KEY,
  -- RESTRICT: apagar pergunta com histórico é impossível (e a pergunta, de
  -- todo modo, nunca é apagada — vira Ativa=false).
  "GoldenAvaliacao_PerguntaCodigo" text NOT NULL
    REFERENCES "GoldenPergunta"("GoldenPergunta_Codigo") ON DELETE RESTRICT,
  -- Identificador da rodada (ISO-8601 do início da execução): todas as linhas
  -- de uma rodada compartilham o valor; comparação entre rodadas agrupa aqui.
  "GoldenAvaliacao_Rodada"         text NOT NULL,
  "GoldenAvaliacao_Resultado"      text NOT NULL
    CHECK ("GoldenAvaliacao_Resultado" IN ('CORRETO','INCORRETO','ERRO')),
  -- Plano obtido × esperado quando divergiu; NULL quando CORRETO (o acerto
  -- não precisa de dossiê, o erro precisa).
  "GoldenAvaliacao_Detalhe"        jsonb,
  -- Intérprete que respondeu (auditoria.interprete da Xingú): lexico,
  -- anthropic, openai, cache...
  "GoldenAvaliacao_Provedor"       text NOT NULL,
  "GoldenAvaliacao_LatenciaMs"     integer,
  "GoldenAvaliacao_DataHora"       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goldenavaliacao_rodada
  ON "GoldenAvaliacao" ("GoldenAvaliacao_Rodada", "GoldenAvaliacao_PerguntaCodigo");

-- Menor privilégio (linhas correspondentes na allowlist da catraca):
--   · "GoldenPergunta": o gerador faz upsert (INSERT+UPDATE) e aposenta por
--     UPDATE (Ativa=false); DELETE nunca — pergunta não some, se aposenta.
--   · "GoldenAvaliacao": histórico append-only POR GRANT (padrão db/39 e
--     db/48) — SELECT+INSERT, nunca UPDATE/DELETE; provado por SQL direto
--     como itmt_app em api/test/golden.unit.mjs.
REVOKE ALL ON "GoldenPergunta", "GoldenAvaliacao" FROM PUBLIC, itmt_app;
GRANT SELECT, INSERT, UPDATE ON "GoldenPergunta" TO itmt_app;
GRANT SELECT, INSERT ON "GoldenAvaliacao" TO itmt_app;
GRANT USAGE, SELECT ON SEQUENCE "GoldenAvaliacao_GoldenAvaliacao_Id_seq" TO itmt_app;

COMMENT ON TABLE "GoldenPergunta" IS
  'Evolução E6 (ADR-010): banco de perguntas de regressão da Xingú (golden set KR3.1/3.3) como dado governado. Origem GERADA (do catálogo real, via golden:gerar) ou CURADA (manual, intocada pelo gerador); aposentadoria é Ativa=false, nunca DELETE. O JSON api/golden/golden-set.json passa a ser derivado.';
COMMENT ON TABLE "GoldenAvaliacao" IS
  'Evolução E6 (ADR-010): histórico append-only (por grant) das rodadas do golden:avaliar — resultado, plano obtido × esperado, provedor e latência por caso. Rodada nova = linhas novas; regressão entre rodadas vira consulta, não grep de stdout.';
