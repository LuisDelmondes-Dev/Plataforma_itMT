-- ============================================================
-- 54-catalogo-dimensoes-observacao.sql (Evolução E1 · vocabulário aberto)
--
-- O crítico de generalidade do gauntlet registrou o gap (docs/gauntlet/
-- RELATORIO-FINAL.md, "Gaps que ficaram"): "Vocabulário de dimensões de
-- causa é fechado (CHECK + 4 pontos de código): 4ª área com eixo causal
-- exige migração + edição sincronizada". Os três eixos ('CAPITULO_CID10',
-- 'CAUSA_EVITAVEL','COMPONENTE') estavam fixos em DOIS CHECKs de banco
-- (db/48 "PesquisaCausa", db/49 "ObservacaoCausa") e em código TypeScript
-- (union type + allowlists + rótulos/ordem de exibição). Educação com eixo
-- "etapa de ensino" ou finanças com "função de governo" exigiriam tocar os
-- 4 pontos em sincronia — exatamente o acoplamento que esta migração desfaz.
--
-- A partir daqui o vocabulário é ORIENTADO A DADOS: nasce o catálogo
-- "DimensaoObservacao" (código, rótulo de exibição, ordem canônica, ativa,
-- versão) e os dois CHECKs viram FK para ele. Uma 4ª dimensão passa a ser
-- SÓ uma linha de catálogo (nova migração de curadoria): motor, sugestões
-- e persistência de pesquisas a aceitam sem nenhuma edição de código —
-- provado por api/test/dimensoes.unit.mjs.
--
-- INSPIRAÇÃO (adaptada, não copiada): a proposta externa "ITMT Fase 1 —
-- Banco Refinado V2" modela `referencia.valor_dominio` (vocabulários
-- versionados por domínio) e `dw.fato_observacao_dimensao` (eixo de
-- dimensão do fato apontando para o domínio). A ideia — vocabulário de
-- eixo como DADO versionado, não como constraint literal — é adotada; o
-- desenho é traduzido para a convenção da casa: PascalCase
-- "Tabela_Atributo", sem schemas novos, CHECK inline, grants mínimos, e o
-- eixo continua na tabela irmã "ObservacaoCausa" (db/49) em vez de um fato
-- universal (o gauntlet descartou generalização prematura do fato).
--
-- Decisões que não são óbvias no DDL:
-- - Catálogo GLOBAL sem RLS, como "PraticaGestao" (db/51): vocabulário de
--   dado público. itmt_app recebe SÓ SELECT — curadoria é migração (nada
--   entra na catraca de menor privilégio de least-privilege.unit.mjs).
-- - Os rótulos ("_Nome") são EXATAMENTE os que o A16 (sugestoes.service)
--   usava hardcoded — o ratchet de determinismo dos textos de sugestão
--   exige byte a byte igual.
-- - db/48 e db/49 NÃO são editadas: a regra da casa proíbe reescrever
--   migração já aplicada/commitada em sequência de gauntlet fechado com
--   evidência. A troca CHECK→FK acontece TODA aqui, com descoberta
--   dinâmica do nome do constraint (CHECK inline ganha nome autogerado
--   pelo Postgres — não se hardcoda o que o catálogo pode nomear diferente).
-- - "_Versao" incrementa quando a curadoria ALTERA o sentido de uma
--   dimensão existente (rastreabilidade de vocabulário, como o
--   valor_dominio versionado da proposta V2); "_Ativa" = false aposenta o
--   código sem quebrar FK de dado histórico.
-- ============================================================

CREATE TABLE IF NOT EXISTS "DimensaoObservacao" (
  -- Código estável usado nas FKs e nas URLs (?dimensao=...), SEMPRE
  -- MAIÚSCULO_COM_SUBLINHADO — o CHECK impede código com espaço/acento
  -- que quebraria query param e comparação case-insensitive do controller.
  "DimensaoObservacao_Codigo"    text PRIMARY KEY
    CHECK ("DimensaoObservacao_Codigo" ~ '^[A-Z][A-Z0-9_]*$'),
  -- Rótulo de exibição (minúsculo, pt-BR) — o que o A16 escreve no texto.
  "DimensaoObservacao_Nome"      text NOT NULL,
  "DimensaoObservacao_Descricao" text,
  -- Ordem canônica de exibição/desempate (A16: empate de participação
  -- dominante resolve pela ordem do catálogo).
  "DimensaoObservacao_Ordem"     int NOT NULL,
  "DimensaoObservacao_Ativa"     boolean NOT NULL DEFAULT true,
  "DimensaoObservacao_Versao"    int NOT NULL DEFAULT 1
);

-- Seed = as 3 dimensões que já existiam, com os rótulos EXATOS que o
-- sugestoes.service usava hardcoded (determinismo dos textos preservado).
INSERT INTO "DimensaoObservacao"
  ("DimensaoObservacao_Codigo","DimensaoObservacao_Nome","DimensaoObservacao_Descricao","DimensaoObservacao_Ordem")
VALUES
  ('CAPITULO_CID10','capítulo CID-10',
   'Decomposição por capítulo da CID-10 (causa básica do óbito, SIM/DATASUS).',1),
  ('CAUSA_EVITAVEL','causas evitáveis',
   'Classificação de evitabilidade em menores de 5 anos (lista SVS/MS, SIM/DATASUS).',2),
  ('COMPONENTE','componente etário',
   'Componente etário do óbito infantil: neonatal precoce (0–6 dias), neonatal tardio (7–27) e pós-neonatal (28–364).',3)
ON CONFLICT ("DimensaoObservacao_Codigo") DO NOTHING;

-- Catálogo global: a aplicação só lê; curadoria é migração (como db/51).
GRANT SELECT ON "DimensaoObservacao" TO itmt_app;

-- ------------------------------------------------------------
-- Troca CHECK → FK nas duas tabelas que congelavam o vocabulário.
-- Os CHECKs de db/48/49 são inline e sem nome — o Postgres autogera
-- (ex.: "ObservacaoCausa_ObservacaoCausa_Dimensao_check"), então o nome
-- real é descoberto em pg_constraint: derruba-se todo CHECK da tabela
-- cuja definição cite a coluna *_Dimensao (é o único CHECK de cada uma;
-- contype='c' não toca UNIQUE/NOT NULL/FK).
-- ------------------------------------------------------------
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conrelid::regclass AS tabela, conname
      FROM pg_constraint
     WHERE contype = 'c'
       AND conrelid IN ('"ObservacaoCausa"'::regclass, '"PesquisaCausa"'::regclass)
       AND pg_get_constraintdef(oid) LIKE '%\_Dimensao"%' ESCAPE '\'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tabela, c.conname);
    RAISE NOTICE 'db/54: CHECK % de % substituído por FK para "DimensaoObservacao"', c.conname, c.tabela;
  END LOOP;

  -- FKs nomeadas (idempotente: banco novo e futuro dev migrado passam igual).
  -- Sem ON DELETE: dimensão com dado histórico não pode sumir do catálogo —
  -- aposentadoria é "_Ativa" = false, nunca DELETE.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observacaocausa_dimensao_fk') THEN
    ALTER TABLE "ObservacaoCausa" ADD CONSTRAINT observacaocausa_dimensao_fk
      FOREIGN KEY ("ObservacaoCausa_Dimensao")
      REFERENCES "DimensaoObservacao"("DimensaoObservacao_Codigo");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pesquisacausa_dimensao_fk') THEN
    ALTER TABLE "PesquisaCausa" ADD CONSTRAINT pesquisacausa_dimensao_fk
      FOREIGN KEY ("PesquisaCausa_Dimensao")
      REFERENCES "DimensaoObservacao"("DimensaoObservacao_Codigo");
  END IF;
END $$;

COMMENT ON TABLE "DimensaoObservacao" IS
  'Evolução E1: catálogo versionado dos eixos de decomposição de "ObservacaoCausa"/"PesquisaCausa" (antes CHECK fixo — gap do crítico de generalidade). Rótulo e ordem alimentam motor, A16 e validações; 4ª dimensão = linha de curadoria, sem edição de código.';
