-- ============================================================
-- 63-e18-carga-candidata-e-quarentena-idempotente.sql
-- (Evoluções E18 · checkpoint em duas fases na carga
--            e E19 · idempotência da quarentena)
--
-- ADR-010, adendo 31/08/2026. Diferente de E1–E17, esta migração NÃO absorve
-- ideia de pacote externo: ela CONSERTA dano ativo achado por auditoria do
-- nosso próprio pipeline. O ADR-010 afirmava, na lista de "convergências que
-- não viram código", que "checkpoint em duas fases ≈ nosso Bronze→Prata→Ouro
-- com drift bloqueando a promoção". A auditoria provou que a frase era
-- ASPIRACIONAL: não havia checkpoint algum — a `Carga` nascia PROMOVIDA.
--
-- ------------------------------------------------------------
-- O DEFEITO MEDIDO (banco dev `itmt`, 31/08/2026, 109 cargas)
-- ------------------------------------------------------------
-- E18. `registrarCarga` (api/scripts/lib-ingest.mjs) inseria a carga com
--      status 'PROMOVIDA' ANTES de Prata, de Ouro e de qualquer checagem de
--      qualidade; `Carga_Status` era `text NOT NULL DEFAULT 'PROMOVIDA'` sem
--      CHECK, e o estado "ainda não validada" simplesmente não existia.
--      Consequência medida:
--        · 12 cargas 'PROMOVIDA' sem UMA observação sequer;
--        · carga 96 (fonte 77, IBGE agregado 1612/v214, 2026-08-14) com
--          LinhasLidas=141 e LinhasQuarentena=141 — 100% quarentenado — e
--          mesmo assim 'PROMOVIDA';
--        · para scripts/alerta-fontes.mjs (RF-INGEST-011), que usa
--          max("Carga_DataExtracao") sem olhar status, essa fonte estava
--          "em dia". O alerta de fonte parada media o momento do DOWNLOAD,
--          não o da carga bem-sucedida.
--      A classe de defeito já tinha um incidente no ratchet
--      (api/test/lib-ingest.unit.mjs, EV-20260822-054, carga 14 / PIB
--      municipal): o status da carga não descrevia a realidade da carga.
--
-- E19. `quarentenar` fazia INSERT incondicional em "Quarentena" e
--      `UPDATE "Carga" SET LinhasQuarentena = LinhasQuarentena + 1`. Como
--      `registrarCarga` devolve a MESMA carga na reexecução (dedup por
--      SHA-256 do bruto), cada rodada repetida acumulava linha e contador.
--      Consequência medida:
--        · 2806 linhas em "Quarentena", 1512 distintas por
--          (carga, registro, motivo) — 1294 espúrias, 46,1% da tabela;
--        · 11 cargas com LinhasQuarentena > LinhasLidas, aritmeticamente
--          impossível (carga 52: lidas 141, quarentena 214);
--        · o padrão é exatamente 2× em 29 cargas: cada uma foi reexecutada
--          uma vez e a quarentena dobrou.
--      E o dedup de "Carga" por ("Carga_FonteId","Carga_HashSha256") era
--      garantido SÓ por pg_advisory_xact_lock em aplicação — sem UNIQUE no
--      banco, contra a doutrina "vetos são de banco" (F3/F4).
--
-- ------------------------------------------------------------
-- AS DECISÕES
-- ------------------------------------------------------------
-- 1) VOCABULÁRIO DE STATUS + CHECK. Entra 'CANDIDATA' (estado inicial) e o
--    DEFAULT passa a ser 'CANDIDATA'. O CHECK admite exatamente os três
--    valores COM CONSUMIDOR no código — 'CANDIDATA', 'PROMOVIDA',
--    'BLOQUEADA_DRIFT' — e nada além. Levantamento no dev antes de escrever
--    (SELECT DISTINCT, só leitura): PROMOVIDA 106, BLOQUEADA_DRIFT 3. Nenhum
--    estado inventado "para o futuro": estado sem consumidor é mentira de
--    catálogo (mesma régua do ADR-010 para tabela sem consumidor).
--    O DEFAULT novo NÃO reescreve nada: os seeds que inserem "Carga"
--    (db/02, db/42–45, db/50, db/53) rodam ANTES desta migração num banco
--    novo, e todos menos db/02 já declaram 'PROMOVIDA' explicitamente.
--
-- 2) DEDUP DE CARGA VIRA VETO DE BANCO — em duas camadas, por causa do
--    histórico. O dev tem 7 pares (fonte, hash) duplicados, 14 linhas, todos
--    de 17–22/07/2026, ANTERIORES ao advisory lock de `registrarCarga`
--    (commit 3419071). Não dá para criar o UNIQUE cegamente e NÃO se apaga
--    dado do usuário — pior: em 4 desses 7 pares a linha que carrega as 141
--    observações é a de id MAIOR (ex.: carga 12 BLOQUEADA_DRIFT/0 obs contra
--    carga 16 PROMOVIDA/141 obs), então nem "manter a primeira" é derivável
--    com segurança. Reconciliar é ato humano. Por isso:
--      · o UNIQUE é criado onde o dado permite (banco novo, CI, teste,
--        produção limpa) — lá o veto é o índice, forte e barato;
--      · o TRIGGER `trg_carga_dedup` é criado SEMPRE e veta a INSERÇÃO de
--        uma carga nova cujo (fonte, hash) já exista, mesmo num banco que
--        carregue as duplicatas históricas. Ele toma o MESMO
--        pg_advisory_xact_lock que a aplicação usa, então não tem corrida.
--    Quem quiser conferir o passivo do seu banco:
--      SELECT "Carga_FonteId","Carga_HashSha256", array_agg("Carga_Id" ORDER BY "Carga_Id")
--        FROM "Carga" GROUP BY 1,2 HAVING count(*) > 1;
--
-- 3) QUARENTENA IDEMPOTENTE POR CHAVE LÓGICA. Nova coluna GERADA
--    "Quarentena_ChaveLogica" = sha256 hex de (registro canônico ‖ LF ‖
--    motivo), e UNIQUE em ("Quarentena_CargaId","Quarentena_ChaveLogica").
--    Por que hash e não índice direto em (carga, registro, motivo): jsonb e
--    text entram no limite de ~2704 bytes por entrada de btree — um registro
--    gordo transformaria a QUARENTENA (caminho de falha suave, RF-INGEST-010)
--    em erro duro de INSERT. O hash é fixo em 64 caracteres e sempre cabe.
--    Detalhe que custou teste: o cast text→bytea (a mesma forma canônica da
--    cadeia de auditoria) usa o formato "escape" do bytea e EXPLODE quando o
--    texto jsonb contém "\n"/"\x" — sequências que o próprio jsonb_out
--    produz ao serializar quebra de linha ou caminho Windows. Daí o
--    `replace(..., chr(92), chr(92)||chr(92))`: dobrar toda barra invertida
--    torna a string sempre um literal bytea válido, e é injetivo (não cria
--    colisão). Conferido contra as 2806 linhas reais do dev: a chave
--    particiona a tabela em 1512 grupos, EXATAMENTE os mesmos 1512 grupos de
--    (carga, registro, motivo) — o hash não junta nem separa nada a mais.
--    A aplicação passa a usar ON CONFLICT DO NOTHING.
--
-- 4) O CONTADOR PASSA A SER DERIVADO — mantido pelo BANCO, não pela
--    aplicação. Alternativas consideradas: (a) recontar por count(*) ao fim
--    da carga — simples, mas deixa o contador mentindo enquanto a carga não
--    termina e some se a rodada aborta no meio; (b) trigger que reconta a
--    cada linha — O(n²) numa quarentena grande. Escolhido (c): trigger
--    AFTER INSERT/DELETE FOR EACH ROW que soma +1/−1 em
--    "Carga_LinhasQuarentena". É O(1), é exato, e — o ponto — só dispara
--    quando uma linha REALMENTE nasce: com ON CONFLICT DO NOTHING a
--    reexecução não insere, logo não conta. O contador deixa de ser um
--    número que a aplicação pode errar e passa a ser uma projeção da tabela.
--    A migração faz o backfill único (recontagem) depois da deduplicação.
--
-- 5) DADO HISTÓRICO — o que esta migração faz e o que se RECUSA a fazer.
--    · FAZ: deduplicar "Quarentena" mantendo a PRIMEIRA ocorrência de cada
--      (carga, chave lógica). Isso é correção de bug, não perda de dado: as
--      linhas removidas são cópias byte a byte de linhas que ficam, geradas
--      por reexecução. Esperado no dev: 1294 removidas, 1512 mantidas.
--    · FAZ: recontar "Carga_LinhasQuarentena" a partir da tabela, o que
--      zera as 11 impossibilidades aritméticas.
--    · NÃO FAZ: reclassificar as 12 cargas 'PROMOVIDA' sem observação. O
--      critério tentador — "carga sem NENHUMA observação nunca foi promovida
--      de fato" — é PROVADAMENTE FALSO nesta base: as cargas 2 e 6 são do
--      conector de território (IBGE Localidades), cujo Ouro é a malha
--      "Municipio" e que por construção não gera uma única "Observacao"; a
--      carga 1 é o seed demonstrativo. Demoter essas seria inventar um
--      defeito. Reclassificação do passivo é ato humano, com o inventário
--      abaixo na mão:
--      SELECT c."Carga_Id", f."Fonte_Nome", c."Carga_Status",
--             c."Carga_LinhasLidas", c."Carga_LinhasQuarentena"
--        FROM "Carga" c JOIN "Fonte" f ON f."Fonte_Id" = c."Carga_FonteId"
--       WHERE NOT EXISTS (SELECT 1 FROM "Observacao" o
--                          WHERE o."Observacao_CargaId" = c."Carga_Id")
--       ORDER BY 1;
--
-- CONSUMIDORES REAIS (regra do ADR-010 — nada de estrutura sem quem use):
--   · api/scripts/lib-ingest.mjs — `registrarCarga` cria CANDIDATA;
--     `confirmarCarga` (nova) promove só depois do Ouro, na mesma transação
--     do Ouro; `quarentenar` idempotente; `verificarEsquema` desbloqueia
--     BLOQUEADA_DRIFT para CANDIDATA (e não mais direto para PROMOVIDA).
--   · os 5 conectores que chamam `registrarCarga`.
--   · scripts/alerta-fontes.mjs — "em dia" passa a exigir carga PROMOVIDA.
--   · api/src/admin/validacao-tecnica.service.ts — a checagem
--     `Carga_Status <> 'PROMOVIDA'` continua correta e agora também pega
--     CANDIDATA, que é tão problemática quanto BLOQUEADA para o dossiê.
--   · ratchet: api/test/carga-candidata.unit.mjs.
--
-- FICA PARA DEPOIS (com gatilho registrado, sem estrutura órfã):
--   · reconciliação das duplicatas históricas de "Carga" (ato humano; o dia
--     em que ela acontecer, o UNIQUE nasce sozinho na re-execução do bloco
--     condicional abaixo — ele é idempotente e reavaliável);
--   · estados intermediários de carga (recebida/em crítica/…) só quando
--     algum conector precisar distinguir mais que "candidata × promovida ×
--     bloqueada";
--   · `vw_ProntidaoLancamentoF1` (db/19) NÃO filtra por "Carga_Status" hoje
--     — ela checa formato de hash e caminho não-demo. Fica como está de
--     propósito: com o checkpoint em pé, observação de carga não confirmada
--     deixa de existir na origem, e apertar a view agora mudaria a régua de
--     prontidão F1 sem necessidade.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Vocabulário de status: 'CANDIDATA' entra e vira o DEFAULT
-- ------------------------------------------------------------
ALTER TABLE "Carga" ALTER COLUMN "Carga_Status" SET DEFAULT 'CANDIDATA';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = '"Carga"'::regclass AND conname = 'Carga_Status_dominio'
  ) THEN
    ALTER TABLE "Carga" ADD CONSTRAINT "Carga_Status_dominio"
      CHECK ("Carga_Status" IN ('CANDIDATA', 'PROMOVIDA', 'BLOQUEADA_DRIFT'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2) Dedup de carga como veto de banco
--    (a) trigger — sempre; funciona mesmo com passivo histórico
--    (b) UNIQUE  — onde o dado permite
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION "fn_carga_dedup"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Mesmo lock que registrarCarga toma na aplicação: duas sessões
  -- inserindo o mesmo (fonte, hash) serializam aqui, então o SELECT
  -- abaixo não tem janela de corrida.
  PERFORM pg_advisory_xact_lock(
    hashtext('carga:' || NEW."Carga_FonteId" || ':' || NEW."Carga_HashSha256"));
  IF EXISTS (
    SELECT 1 FROM "Carga"
     WHERE "Carga_FonteId"   = NEW."Carga_FonteId"
       AND "Carga_HashSha256" = NEW."Carga_HashSha256"
  ) THEN
    RAISE EXCEPTION
      'RF-INGEST-006: carga duplicada — a fonte % já tem carga com o hash %. '
      'O mesmo Bronze não se carrega duas vezes; reaproveite a carga existente.',
      NEW."Carga_FonteId", NEW."Carga_HashSha256"
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS "trg_carga_dedup" ON "Carga";
CREATE TRIGGER "trg_carga_dedup"
  BEFORE INSERT ON "Carga"
  FOR EACH ROW EXECUTE FUNCTION "fn_carga_dedup"();

DO $$
DECLARE duplicadas int;
BEGIN
  SELECT count(*) INTO duplicadas FROM (
    SELECT 1 FROM "Carga"
     GROUP BY "Carga_FonteId", "Carga_HashSha256" HAVING count(*) > 1
  ) d;
  IF duplicadas = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_carga_fonte_hash"
      ON "Carga" ("Carga_FonteId", "Carga_HashSha256");
  ELSE
    RAISE WARNING
      'db/63: % par(es) (fonte, hash) duplicado(s) no histórico — UNIQUE não criado. '
      'O veto continua valendo por trigger (trg_carga_dedup). Reconcilie e recrie: '
      'CREATE UNIQUE INDEX "uq_carga_fonte_hash" ON "Carga" ("Carga_FonteId","Carga_HashSha256");',
      duplicadas;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3) Quarentena: chave lógica estável + deduplicação do histórico
-- ------------------------------------------------------------
ALTER TABLE "Quarentena"
  ADD COLUMN IF NOT EXISTS "Quarentena_ChaveLogica" char(64)
  GENERATED ALWAYS AS (
    encode(
      sha256(
        replace(
          "Quarentena_Registro"::text || chr(10) || "Quarentena_Motivo",
          chr(92), chr(92) || chr(92)
        )::bytea
      ), 'hex')
  ) STORED;

-- Remoção das cópias byte a byte geradas por reexecução (mantém a primeira).
DELETE FROM "Quarentena" q
 USING (
   SELECT "Quarentena_Id",
          row_number() OVER (
            PARTITION BY "Quarentena_CargaId", "Quarentena_ChaveLogica"
            ORDER BY "Quarentena_Id"
          ) AS ordem
     FROM "Quarentena"
 ) d
 WHERE q."Quarentena_Id" = d."Quarentena_Id" AND d.ordem > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_quarentena_carga_chave"
  ON "Quarentena" ("Quarentena_CargaId", "Quarentena_ChaveLogica");

-- ------------------------------------------------------------
-- 4) Contador derivado: backfill único + trigger que o mantém
-- ------------------------------------------------------------
UPDATE "Carga" c
   SET "Carga_LinhasQuarentena" = coalesce(q.n, 0)
  FROM (
    SELECT ca."Carga_Id" AS id,
           (SELECT count(*)::int FROM "Quarentena" x
             WHERE x."Quarentena_CargaId" = ca."Carga_Id") AS n
      FROM "Carga" ca
  ) q
 WHERE c."Carga_Id" = q.id
   AND c."Carga_LinhasQuarentena" IS DISTINCT FROM coalesce(q.n, 0);

CREATE OR REPLACE FUNCTION "fn_quarentena_contador"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "Carga" SET "Carga_LinhasQuarentena" = coalesce("Carga_LinhasQuarentena", 0) + 1
     WHERE "Carga_Id" = NEW."Quarentena_CargaId";
    RETURN NEW;
  END IF;
  UPDATE "Carga" SET "Carga_LinhasQuarentena" = greatest(coalesce("Carga_LinhasQuarentena", 0) - 1, 0)
   WHERE "Carga_Id" = OLD."Quarentena_CargaId";
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS "trg_quarentena_contador" ON "Quarentena";
CREATE TRIGGER "trg_quarentena_contador"
  AFTER INSERT OR DELETE ON "Quarentena"
  FOR EACH ROW EXECUTE FUNCTION "fn_quarentena_contador"();

-- ------------------------------------------------------------
-- 5) Grants — mínimo necessário, nada além
--    itmt_app já tem SELECT em "Carga" e "Quarentena" (db/01), e GRANT de
--    tabela cobre colunas novas: a "Quarentena_ChaveLogica" não precisa de
--    grant próprio. Os conectores de ingestão conectam como DONO (itmt),
--    então o trigger do contador roda com privilégio suficiente para
--    atualizar "Carga" sem SECURITY DEFINER — que seria elevar privilégio
--    sem necessidade.
-- ------------------------------------------------------------

COMMENT ON COLUMN "Carga"."Carga_Status" IS
  'CANDIDATA (nasce assim; bruto salvo, nada validado) → PROMOVIDA (Ouro '
  'carregado com sucesso, confirmada na mesma transação do Ouro) | '
  'BLOQUEADA_DRIFT (RF-INGEST-005). Só PROMOVIDA conta como carga real.';
COMMENT ON COLUMN "Carga"."Carga_LinhasQuarentena" IS
  'Derivado: mantido por trg_quarentena_contador a partir de "Quarentena". '
  'A aplicação NÃO incrementa esta coluna (db/63 / E19).';
COMMENT ON COLUMN "Quarentena"."Quarentena_ChaveLogica" IS
  'Identidade estável do registro quarentenado dentro da carga: sha256 hex de '
  '(registro canônico ‖ LF ‖ motivo). Base do ON CONFLICT DO NOTHING (E19).';
