-- ============================================================
-- 64-e20-status-do-valor.sql (Evolução E20 · status do VALOR como domínio curado)
--
-- ADR-010, evolução E20. Como a E18/E19 (db/63), esta migração NÃO absorve
-- uma ideia externa inédita: ela conserta uma CONTRADIÇÃO ATIVA do nosso
-- pipeline, achada por auditoria própria e confirmada, de forma independente,
-- pela documentação oficial da fonte via o pacote externo "Core R2.3.3".
--
-- AS DUAS EVIDÊNCIAS QUE CONVERGIRAM (31/08/2026)
--
-- (a) AUDITORIA DO NOSSO CÓDIGO — o MESMO símbolo, da MESMA fonte, tratado
--     de três formas diferentes por quatro conectores:
--     · scripts/ingestar-pacote-f1-ibge.mjs documentava certo e convertia
--       '-' para 0 ("Na simbologia SIDRA, '-' significa zero absoluto");
--     · scripts/ingestar-ibge-agregado.mjs e scripts/ingestar-ibge-populacao.mjs
--       mandavam o MESMO '-' do MESMO IBGE para a Quarentena, como se fosse
--       ausência — ou seja, o município que a fonte declarou ter ZERO sumia
--       da base, e o motor passava a herdar/omitir onde havia resposta;
--     · coletores/coletar_fontes.py destruía a distinção ANTES do conector:
--       `_normalizar` fazia to_numeric(errors="coerce") + dropna() (célula
--       vazia, '-', '...', 'X' viravam NaN e SUMIAM do CSV), e `_por_nome`
--       fazia fillna(0) — que é pior: INVENTAVA zero para célula ilegível.
--       Para CNES e INEP a supressão da fonte era invisível ao pipeline
--       auditado, contra a própria doutrina do CLAUDE.md ("os coletores só
--       normalizam e delegam ao conector Node auditado").
--     · e o motivo de quarentena era string livre concatenada
--       (ingestar-csv.mjs), sem código: "código IBGE fora de MT", "valor
--       não numérico" e "valor suprimido pela fonte" viravam o mesmo tipo
--       de registro, impossível de contar ou filtrar.
--
-- (b) PACOTE EXTERNO "Core R2.3.3" — chegou à mesma conclusão pela
--     documentação oficial do SIDRA, e explicitamente registra a correção
--     ("A versão anterior tratava '-' como ausência. Isso foi corrigido").
--     A ideia BOA que absorvemos não é o DDL (nada é copiado): é que a
--     CONVENÇÃO DE SÍMBOLOS DA FONTE É DADO DE GOVERNANÇA — versionado,
--     curado, citável — e não constante enterrada no parser. É a mesma
--     tese da E17 (db/62) um degrau adiante: db/55 absorveu o REGISTRO do
--     conector, db/62 a REGRA DE EXECUÇÃO da carga, db/64 a REGRA DE
--     LEITURA DA CÉLULA.
--
-- SIMBOLOGIA OFICIAL (fonte citada, não inventada)
--   IBGE — Normas de Apresentação Tabular (3ª ed., 1993), seção "sinais
--   convencionais", vocabulário usado na legenda de toda tabela do SIDRA e
--   reproduzido na documentação da API de agregados v3
--   (https://servicodados.ibge.gov.br/api/docs/agregados):
--     '-'   dado numérico igual a ZERO não resultante de arredondamento
--     '0'   zero resultante de arredondamento/cálculo (valor publicado)
--     'X'   dado numérico omitido a fim de evitar individualização
--     '..'  não se aplica dado numérico
--     '...' dado numérico não disponível
--   A leitura "'-' é ausência" NUNCA teve respaldo documental: era um
--   palpite defensivo do conector que produzia o erro oposto ao que temia.
--
-- O QUE ENTRA (cada peça com consumidor real e teste no ratchet
-- api/test/status-valor.unit.mjs):
--   1. "StatusValor" — domínio curado do status do VALOR, com a regra de
--      promoção como DADO ("_Promovivel", "_ValorImplicito"), não como if.
--   2. "ConvencaoValorFonte" + "ConvencaoValorSimbolo" — a convenção de
--      símbolos por fonte, versionada e com documentação obrigatória.
--   3. "FonteConector_ConvencaoValor" — liga o catálogo vivo de conectores
--      (db/55) à convenção que ele deve aplicar. NULL = desconhecida, e
--      desconhecida cai no DEFAULT SEGURO (nada além de número puro vira
--      valor; símbolo algum vira zero).
--   4. "Quarentena_CodigoRazao" + "Quarentena_SimboloOrigem" — o motivo
--      deixa de ser só prosa: ganha código tipado e preserva o símbolo tal
--      como a fonte o serviu.
--
-- TABELA × CHECK — por que cada escolha (o precedente da casa manda)
--   · "StatusValor" é TABELA, como "DimensaoObservacao" (E1, db/54): o
--     vocabulário é ditado pelas FONTES, não por nós, e a semântica que o
--     código consome (é promovível? qual valor implícito?) vira COLUNA. Um
--     status novo — o dia em que uma fonte documentar um sexto símbolo —
--     entra como linha de catálogo, sem tocar o classificador. Foi
--     exatamente o CHECK que travou a evolução na E1; não repetimos.
--   · "Quarentena_CodigoRazao" é CHECK, como "Carga_Status" (db/63) e
--     "Observacao_StatusDado" (db/60): este vocabulário é NOSSO, produzido
--     pelos nossos validadores. Razão nova só existe quando um validador
--     novo existe — isto é, quando há mudança de código de qualquer forma.
--     Uma tabela aqui adicionaria join sem destravar nada.
--
-- VOCABULÁRIO ADOTADO (6) — cada um com consumidor HOJE:
--   VALOR, ZERO_ABSOLUTO, SUPRIMIDO, NAO_APLICAVEL, NAO_DISPONIVEL, INVALIDO.
-- ADIADO, com gatilho: FAIXA_VALOR (a convenção 'A'–'Z' exceto 'X', que a
--   documentação do R2.3.3 lista como faixa de valores). Nenhum agregado que
--   ingerimos publica faixa por letra, e — sintoma revelador — a própria
--   migração do pacote externo NÃO semeia essa linha: ela existe só na
--   tabela do .md. A casa não cria vocabulário sem consumidor (corte YAGNI
--   do db/59). GATILHO: um conector cuja fonte documente faixa por letra;
--   até lá o adiamento é SEGURO POR CONSTRUÇÃO — letra não casa com símbolo
--   catalogado nem com número, então cai em INVALIDO e vai para a
--   quarentena. Nunca vira zero, que é a única coisa que importa.
--
-- COMO ISTO CONCILIA COM O db/50 (e não o contradiz)
--   O db/50 já havia raciocinado sobre a MESMA questão para o TabNet/DATASUS,
--   em prosa, e materializado 211 zeros sob guarda: "nas duas tabulações
--   ESTADUAIS COMPLETAS (óbitos por município×ano; nascidos por
--   município×ano), o TabNet lista todo município com ao menos um evento no
--   período — logo, célula '-' ou linha ausente significa ZERO EVENTOS
--   NAQUELE ANO, não dado faltante", com a ressalva dura de que "nas
--   tabulações PARCIAIS a ausência de um município continua sendo AUSÊNCIA
--   DE COLETA — nunca vira zero (RN-005)".
--   O db/64 não muda uma vírgula disso: TORNA A PROSA EXECUTÁVEL. A
--   convenção 'TABNET_TABULACAO_COMPLETA' carrega no próprio código a
--   condição que o db/50 exigiu (tabulação estadual completa) e só é
--   atribuída aos dois conectores cuja completude o db/50 documenta. Não
--   existe convenção 'TABNET' genérica de propósito: uma tabulação parcial
--   NÃO herda esta regra — fica sem convenção e cai no default seguro.
--
-- CONECTORES QUE NÃO RECEBEM CONVENÇÃO AGORA (e por quê)
--   · 'cnes' e 'inep' — coletam via TabNet e via sinopse XLSX do INEP. É
--     PROVÁVEL que ambos usem os mesmos sinais convencionais, mas provável
--     não é documentado, e a regra desta migração é não semear símbolo que
--     não se possa citar. Ficam NULL. Isto já é um GANHO ENORME sobre o
--     estado anterior: hoje a célula suprimida some do CSV no Python e
--     ninguém vê; a partir daqui ela chega ao conector, não vira zero, e
--     aparece na quarentena com código tipado. GATILHO para promovê-los:
--     curadoria que registre a legenda do cubo/planilha com citação.
--   · 'ibge-territorio' e 'ibge-geociencias' — malha territorial, não
--     publicam célula de valor. Convenção seria enfeite.
--   · 'datasus-tabnet' (db/56) — conector genérico, cubo indeterminado:
--     atribuir a convenção de tabulação COMPLETA a um cubo desconhecido é
--     exatamente o erro que o db/50 proibiu.
--
-- O QUE MUDA NO DADO JÁ CARREGADO
--   NADA, retroativamente: esta migração não reclassifica observação nem
--   quarentena histórica. As linhas de "Quarentena" anteriores ficam com
--   "_CodigoRazao" NULL — que é a verdade (foram gravadas quando o código
--   não existia), pelo mesmo critério do db/60 (NULL = desconhecido, e
--   desconhecido é resposta). O efeito aparece na PRÓXIMA carga de cada
--   conector, e está descrito no cabeçalho de api/test/status-valor.unit.mjs.
--
-- GRANTS: itmt_app recebe SÓ SELECT nos três catálogos (padrão db/51/54/55/62)
-- — curadoria é migração. Nada entra na catraca de menor privilégio
-- (least-privilege.unit.mjs só vigia INSERT/UPDATE/DELETE).
-- Idempotente: CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- ON CONFLICT DO NOTHING/UPDATE e DO-block para os constraints.
-- ============================================================

-- ------------------------------------------------------------
-- 1) "StatusValor" — o domínio curado, com a regra de promoção como DADO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "StatusValor" (
  -- Código estável, MAIÚSCULO_COM_SUBLINHADO (mesma disciplina do
  -- "DimensaoObservacao_Codigo", db/54): vai em FK, em log e em relatório.
  "StatusValor_Codigo"    text PRIMARY KEY
    CHECK ("StatusValor_Codigo" ~ '^[A-Z][A-Z0-9_]*$'),
  "StatusValor_Nome"      text NOT NULL,
  "StatusValor_Descricao" text NOT NULL,
  -- A REGRA DE PROMOÇÃO, como dado: só status promovível vira observação
  -- numérica. É esta coluna que o classificador lê — não um if no parser.
  "StatusValor_Promovivel" boolean NOT NULL DEFAULT false,
  -- Valor que o símbolo JÁ CARREGA por si (ZERO_ABSOLUTO ⇒ 0). NULL num
  -- status promovível significa "o número vem da própria célula" (VALOR).
  -- Status não promovível NUNCA tem valor implícito — é o veto que impede,
  -- por construção, alguém semear "NAO_DISPONIVEL ⇒ 0" um dia.
  "StatusValor_ValorImplicito" numeric
    CHECK ("StatusValor_ValorImplicito" IS NULL OR "StatusValor_Promovivel"),
  "StatusValor_Ordem"     integer NOT NULL,
  "StatusValor_Ativo"     boolean NOT NULL DEFAULT true,
  -- Incrementa quando a curadoria ALTERA o sentido de um status existente
  -- (rastreabilidade de vocabulário, como "DimensaoObservacao_Versao").
  "StatusValor_Versao"    integer NOT NULL DEFAULT 1
);

INSERT INTO "StatusValor"
  ("StatusValor_Codigo","StatusValor_Nome","StatusValor_Descricao",
   "StatusValor_Promovivel","StatusValor_ValorImplicito","StatusValor_Ordem")
VALUES
  ('VALOR','valor publicado',
   'A fonte publicou um número. O valor vem da própria célula.',
   true, NULL, 1),
  ('ZERO_ABSOLUTO','zero absoluto',
   'A fonte AFIRMA zero — não é arredondamento nem ausência. É resposta, e '
   'omiti-la faria o motor herdar o período anterior (imputação silenciosa '
   'que a RN-005 proíbe).',
   true, 0, 2),
  ('SUPRIMIDO','valor suprimido pela fonte',
   'Número existe mas foi omitido pela fonte para evitar individualização '
   '(sigilo estatístico). Não é zero e não é ausência de fenômeno.',
   false, NULL, 3),
  ('NAO_APLICAVEL','não se aplica',
   'A célula não comporta número naquele cruzamento. Não é zero.',
   false, NULL, 4),
  ('NAO_DISPONIVEL','valor não disponível',
   'A fonte não dispõe do dado. Ausência é resposta (RN-005) — jamais zero, '
   'jamais estimativa.',
   false, NULL, 5),
  ('INVALIDO','célula ilegível',
   'A célula não é número nem símbolo catalogado na convenção da fonte. '
   'Default seguro: quando não se sabe o que a célula quer dizer, ela não '
   'vira número — vai para a quarentena com o símbolo preservado.',
   false, NULL, 6)
ON CONFLICT ("StatusValor_Codigo") DO NOTHING;

-- ------------------------------------------------------------
-- 2) "ConvencaoValorFonte" — a convenção de símbolos, versionada e CITADA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ConvencaoValorFonte" (
  "ConvencaoValorFonte_Codigo"       text PRIMARY KEY
    CHECK ("ConvencaoValorFonte_Codigo" ~ '^[A-Z][A-Z0-9_]*$'),
  "ConvencaoValorFonte_Nome"         text NOT NULL,
  "ConvencaoValorFonte_Descricao"    text NOT NULL,
  -- NOT NULL de propósito: convenção sem documentação citável é palpite, e
  -- palpite sobre símbolo foi exatamente o defeito que esta migração corrige.
  "ConvencaoValorFonte_Documentacao" text NOT NULL,
  "ConvencaoValorFonte_Versao"       integer NOT NULL DEFAULT 1,
  "ConvencaoValorFonte_Ativa"        boolean NOT NULL DEFAULT true
);

INSERT INTO "ConvencaoValorFonte"
  ("ConvencaoValorFonte_Codigo","ConvencaoValorFonte_Nome",
   "ConvencaoValorFonte_Descricao","ConvencaoValorFonte_Documentacao")
VALUES
  ('SIDRA','sinais convencionais do IBGE/SIDRA',
   'Vocabulário de sinais convencionais usado em toda tabela do SIDRA e nas '
   'séries da API de agregados v3. Vale para qualquer agregado do IBGE.',
   'IBGE — Normas de Apresentação Tabular, 3ª ed. (1993), "sinais '
   'convencionais"; legenda reproduzida em cada tabela do SIDRA '
   '(https://sidra.ibge.gov.br) e na documentação da API de agregados v3 '
   '(https://servicodados.ibge.gov.br/api/docs/agregados). Convergência '
   'independente: pacote externo "Core R2.3.3" (31/08/2026), que corrigiu o '
   'mesmo erro de tratar "-" como ausência.'),
  ('TABNET_TABULACAO_COMPLETA','TabNet/DATASUS — tabulação ESTADUAL COMPLETA',
   'Sinais do TabNet quando (e SOMENTE quando) a tabulação cobre todos os '
   'municípios da UF no período. Nessa condição o TabNet lista todo município '
   'com ao menos um evento, e a célula "-" significa zero eventos. Tabulação '
   'PARCIAL não herda esta convenção: lá a ausência é ausência de coleta '
   '(RN-005), e por isso não existe uma convenção "TABNET" genérica.',
   'Cabeçalho de db/50-dados-sim-sinasc-2019-2024.sql, seção "SEMÂNTICA DE '
   'ZERO × AUSÊNCIA" (veredito do crítico de dados do gauntlet, 26/08/2026), '
   'que documenta a completude das tabulações SIM/inf10mt e SINASC/nvmt e '
   'materializou 211 zeros sob essa guarda; legenda de sinais do TabNet '
   '(http://tabnet.datasus.gov.br), herdeira das Normas de Apresentação '
   'Tabular do IBGE.')
ON CONFLICT ("ConvencaoValorFonte_Codigo") DO NOTHING;

-- ------------------------------------------------------------
-- 3) "ConvencaoValorSimbolo" — símbolo ⇒ status, por convenção
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ConvencaoValorSimbolo" (
  "ConvencaoValorSimbolo_Convencao"  text NOT NULL
    REFERENCES "ConvencaoValorFonte"("ConvencaoValorFonte_Codigo"),
  -- O símbolo TAL COMO a fonte o imprime, já sem espaços em volta (o
  -- classificador compara contra a célula com btrim aplicado). O CHECK
  -- impede semear símbolo com espaço nas pontas, que nunca casaria.
  "ConvencaoValorSimbolo_Simbolo"    text NOT NULL
    CHECK ("ConvencaoValorSimbolo_Simbolo" = btrim("ConvencaoValorSimbolo_Simbolo")
       AND length("ConvencaoValorSimbolo_Simbolo") BETWEEN 1 AND 8),
  "ConvencaoValorSimbolo_StatusValor" text NOT NULL
    REFERENCES "StatusValor"("StatusValor_Codigo"),
  -- O significado NAS PALAVRAS DA FONTE — não na nossa paráfrase.
  "ConvencaoValorSimbolo_Significado" text NOT NULL,
  -- Aposentadoria sem DELETE (padrão db/55): fonte que muda de legenda vira
  -- versão nova da convenção, o símbolo velho fica inativo e a história fica.
  "ConvencaoValorSimbolo_Ativa"      boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("ConvencaoValorSimbolo_Convencao","ConvencaoValorSimbolo_Simbolo")
);

INSERT INTO "ConvencaoValorSimbolo"
  ("ConvencaoValorSimbolo_Convencao","ConvencaoValorSimbolo_Simbolo",
   "ConvencaoValorSimbolo_StatusValor","ConvencaoValorSimbolo_Significado")
VALUES
  -- SIDRA — os cinco sinais das Normas de Apresentação Tabular do IBGE.
  ('SIDRA','-',   'ZERO_ABSOLUTO', 'dado numérico igual a zero não resultante de arredondamento'),
  ('SIDRA','0',   'VALOR',         'zero resultante de arredondamento de um dado numérico originalmente positivo'),
  ('SIDRA','X',   'SUPRIMIDO',     'dado numérico omitido a fim de evitar a individualização da informação'),
  ('SIDRA','..',  'NAO_APLICAVEL', 'não se aplica dado numérico'),
  ('SIDRA','...', 'NAO_DISPONIVEL','dado numérico não disponível'),
  -- TabNet, tabulação estadual completa. Só o que o db/50 documentou: nesta
  -- condição "-" é zero de eventos. Os demais sinais NÃO são semeados aqui
  -- porque o db/50 não os documenta — e no default eles caem em INVALIDO,
  -- que nunca vira zero.
  ('TABNET_TABULACAO_COMPLETA','-','ZERO_ABSOLUTO',
   'célula sem evento em tabulação que cobre todos os municípios da UF: zero '
   'eventos no período, não dado faltante (db/50)'),
  ('TABNET_TABULACAO_COMPLETA','0','VALOR',
   'zero publicado explicitamente pela tabulação')
ON CONFLICT ("ConvencaoValorSimbolo_Convencao","ConvencaoValorSimbolo_Simbolo") DO NOTHING;

-- ------------------------------------------------------------
-- 4) Liga o catálogo vivo de conectores (db/55) à convenção
--    NULL = convenção desconhecida ⇒ DEFAULT SEGURO no classificador.
-- ------------------------------------------------------------
ALTER TABLE "FonteConector"
  ADD COLUMN IF NOT EXISTS "FonteConector_ConvencaoValor" text
    REFERENCES "ConvencaoValorFonte"("ConvencaoValorFonte_Codigo");

-- Só os conectores cuja convenção está DOCUMENTADA (racional no cabeçalho).
UPDATE "FonteConector" SET "FonteConector_ConvencaoValor" = 'SIDRA'
 WHERE "FonteConector_Slug" IN ('ibge-populacao','ibge-pib','ibge-f1','ibge-f2')
   AND "FonteConector_ConvencaoValor" IS NULL;

UPDATE "FonteConector" SET "FonteConector_ConvencaoValor" = 'TABNET_TABULACAO_COMPLETA'
 WHERE "FonteConector_Slug" IN ('sim-obitos-infantis','sinasc-nascidos-vivos')
   AND "FonteConector_ConvencaoValor" IS NULL;

-- ------------------------------------------------------------
-- 5) Quarentena: código de razão TIPADO + símbolo original preservado
--    O motivo em prosa continua (é o que o humano lê); o que entra é a
--    capacidade de CONTAR e FILTRAR — "quantas linhas a fonte suprimiu?"
--    deixa de exigir LIKE em string livre.
-- ------------------------------------------------------------
ALTER TABLE "Quarentena"
  -- NULL permitido e significante: linha anterior ao db/64 não tem código
  -- porque o código não existia. Mesmo critério do db/60 — NULL é
  -- desconhecido, e inventar código retroativo seria fabricar evidência.
  ADD COLUMN IF NOT EXISTS "Quarentena_CodigoRazao"   text,
  -- A célula EXATAMENTE como a fonte a serviu ('-', '...', 'X', '', 'n/d').
  -- É o que permite auditar a classificação depois, sem reabrir o Bronze.
  ADD COLUMN IF NOT EXISTS "Quarentena_SimboloOrigem" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = '"Quarentena"'::regclass
       AND conname = 'Quarentena_CodigoRazao_dominio'
  ) THEN
    ALTER TABLE "Quarentena" ADD CONSTRAINT "Quarentena_CodigoRazao_dominio"
      CHECK ("Quarentena_CodigoRazao" IS NULL OR "Quarentena_CodigoRazao" IN (
        -- Razões de VALOR (espelham o status não promovível que as gerou)
        'VALOR_SUPRIMIDO',           -- fonte omitiu por sigilo (SIDRA 'X')
        'VALOR_NAO_APLICAVEL',       -- cruzamento sem número (SIDRA '..')
        'VALOR_NAO_DISPONIVEL',      -- fonte não dispõe (SIDRA '...')
        'VALOR_INVALIDO',            -- célula ilegível / símbolo fora da convenção
        'VALOR_IMPLAUSIVEL',         -- número legível mas rejeitado por regra do indicador
                                     -- (ex.: negativo; população <= 0)
        -- Razões de TERRITÓRIO (o valor pode estar perfeito)
        'TERRITORIO_FORA_DE_ESCOPO', -- código IBGE válido, mas fora de MT
        'TERRITORIO_INVALIDO'        -- código IBGE malformado/ausente
      ));
  END IF;
END $$;

-- Índice para a pergunta que o código tipado passa a permitir ("o que esta
-- carga perdeu, e por quê"). Parcial: linha legada (NULL) não ocupa espaço.
CREATE INDEX IF NOT EXISTS "ix_quarentena_razao"
  ON "Quarentena" ("Quarentena_CargaId","Quarentena_CodigoRazao")
  WHERE "Quarentena_CodigoRazao" IS NOT NULL;

-- ------------------------------------------------------------
-- 6) Grants — SELECT e nada mais (curadoria é migração)
-- ------------------------------------------------------------
GRANT SELECT ON "StatusValor"            TO itmt_app;
GRANT SELECT ON "ConvencaoValorFonte"    TO itmt_app;
GRANT SELECT ON "ConvencaoValorSimbolo"  TO itmt_app;

COMMENT ON TABLE "StatusValor" IS
  'E20 (db/64): domínio curado do status do VALOR — o que a célula QUER DIZER. '
  'Ortogonal a "Observacao_StatusDado" (db/60/E3), que é a fase de HOMOLOGAÇÃO '
  'do dado na fonte (PRELIMINAR/CONSOLIDADO/REVISADO). Um número CONSOLIDADO '
  'pode ser ZERO_ABSOLUTO; um valor SUPRIMIDO não tem fase de homologação '
  'porque não chega a existir como número.';
COMMENT ON COLUMN "StatusValor"."StatusValor_Promovivel" IS
  'A regra de promoção como DADO: só status promovível vira observação numérica. '
  'O resto é preservado na quarentena e NUNCA vira zero (E20).';
COMMENT ON TABLE "ConvencaoValorFonte" IS
  'E20 (db/64): a convenção de símbolos da fonte como dado de governança '
  'versionado e citável, não constante no parser. Documentação é NOT NULL de '
  'propósito — regra sem citação é palpite.';
COMMENT ON COLUMN "FonteConector"."FonteConector_ConvencaoValor" IS
  'Convenção de símbolos a aplicar às células deste conector (db/64). '
  'NULL = desconhecida: o classificador cai no default seguro (só número puro '
  'vira valor; símbolo nenhum vira zero).';
COMMENT ON COLUMN "Quarentena"."Quarentena_CodigoRazao" IS
  'Razão TIPADA do descarte (db/64). NULL = linha anterior ao código. '
  'Substitui a contagem por LIKE em string livre.';
COMMENT ON COLUMN "Quarentena"."Quarentena_SimboloOrigem" IS
  'A célula exatamente como a fonte a serviu, preservada para auditoria da '
  'classificação sem reabrir o Bronze (db/64).';
