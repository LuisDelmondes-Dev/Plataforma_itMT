# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este projeto

Monorepo da **Plataforma ITMT** (Inteligência Territorial de Mato Grosso) — um
programa público estruturado em fases **F0–F7**, não um app CRUD. Quatro partes:

| Pasta | Stack | Papel |
|---|---|---|
| `db/` | PostgreSQL 16+ / pgvector | 66 migrações SQL escritas à mão, **sem ORM** |
| `api/` | NestJS 11 + driver `pg` cru | o **motor determinístico** |
| `web/` | Next.js 16 / React 19 (App Router) | portal público, 23 páginas |
| `coletores/` | Python | raspagem de fontes sem API (CNES/TabNet, INEP) |

`README.md` tem o mapa exaustivo de requisitos (RF/RG) por fase; `AGENTS.md` na
raiz é o **protocolo de engenharia** (SPEC→…→GATE, estados, regras de evidência)
e vale para toda alteração crítica. O estado fase a fase está em
`docs/programa/EXECUCAO_COMPLETA_F0_F7.md` e nos gates `docs/gates/F0..F7.md`.

## Invariantes de arquitetura (não quebre)

Estas ideias atravessam todo o código e são o motivo de muitas decisões que
parecem "estranhas". Antes de alterar qualquer fluxo, confirme que ainda valem:

- **Número vem do motor, nunca do LLM.** Toda agregação/consulta é determinística
  (`IndicadoresService`, `TerritorioService`). Na IA Xingú, o LLM só atua em duas
  bordas — A01 (pergunta→plano validado contra schema **e** contra o catálogo real)
  e A05 (resultado→frase, onde o modelo é *proibido de escrever numerais*: só
  preenche slots `{{V1}}`/`{{ANO}}`/`{{N}}`). O **A06 Auditor**
  (`xingu/narrador.ts`) veta *qualquer* numeral no texto que não esteja no conjunto
  autorizado pelo motor. Regra RG-03/KR3.2.
- **Vetos são de banco.** Em F3/F4, as regras de publicação são triggers PL/pgSQL
  (`db/04-f3.sql`, `db/06-f4.sql`), não checagens só na aplicação — provadas por
  testes que tentam violar por SQL direto.
- **Auditoria é imutável.** `EventoAuditoria` é INSERT-ONLY encadeado por
  SHA-256(anterior ‖ payload canônico), serializado por `pg_advisory_xact_lock`.
  UPDATE/DELETE são revogados no DDL. `AuditoriaService` grava;
  `scripts/verificar-cadeia.mjs` recomputa a cadeia inteira.
- **Ausência é resposta.** Dado inexistente devolve 404/mensagem com contexto
  (referência mais recente, municípios cobertos) — **nunca estima** (RN-005). Vale
  no RECALCULO (município sem ambas as parcelas fica fora, sem imputação), na série
  histórica (ano sem dado é omitido, não zerado) e no mapa.
- **Publicação é ato humano (RG-09).** Nenhum agente auto-publica indicador/direito.
  Fluxo: nasce `EM_ANALISE`/`RASCUNHO` → parecer/vetos → publica. A Validação
  Técnica (`admin/validacao-tecnica.service.ts`) produz *dossiê*, não decisão — o
  campo se chama `aprovado_tecnicamente` (recomendação). `IndicadoresService.meta()`
  filtra `APROVADO` até no acesso por id direto, então não se burla por URL.
- **Degradação segura (RG-05).** Sem chave/crédito de LLM, a Xingú cai para o
  intérprete **léxico determinístico** e continua funcionando. Nunca faça o portal
  depender do LLM.
- **Isolamento tenant é fail-closed (F4).** Recurso `TENANT_OWNED` só é acessível
  dentro de `withTenantTransaction` (`SET LOCAL` + RLS `FORCE`); sem contexto, a
  leitura retorna zero e a escrita é negada. Tenant/organização vindos de header
  livre nunca podem chegar ao banco — só contexto já autenticado por membership.
- **Modelo externo se absorve, nunca substitui (ADR-010).** O usuário traz, de
  tempos em tempos, pacotes de arquitetura gerados por outra IA (Fases 1–5, Core
  R2/R2.1/R2.2/R2.3.x — ~1.299 tabelas, snake_case, 11 schemas). A decisão vigente e
  aprovada: **a base da casa permanece o núcleo governado**; as ideias boas entram
  uma a uma por migração nova, adaptadas à convenção `"Tabela_Atributo"`, **cada
  uma com consumidor real no código e teste no ratchet**. Nunca copie DDL externo,
  nunca crie tabela sem quem a consuma (E7–E14/E16 estão na fila do ADR justamente
  por isso). O modelo externo é instalado só no laboratório `itmt_dw_homolog`
  (Postgres 18 local, sem PostGIS: colunas `geometry` viram stub `text`) — e,
  quando o pacote trouxer harness próprio, num contêiner PG17+PostGIS, que foi
  como o gate geoespacial fechou em 31/08 (226 colunas, todas SRID 4674), para
  validação física — os pacotes chegam com **zero GRANT/RLS/particionamento** e
  já reincidiram 5× na classe de defeito "seed silencioso" (`INSERT ... SELECT` de
  fonte vazia que não insere nada e não dá erro). Ao receber um pacote novo: rito
  de bateria de segurança → aplicar no lab com `ON_ERROR_STOP` → conferir os seeds
  alegados por contagem → decidir a absorção no ADR-010.

## Banco de dados — como funciona (sem ORM)

- **Driver `pg` cru + SQL versionado.** As migrações são `db/NN-*.sql` numeradas.
  `api/scripts/migrar.mjs` descobre os arquivos via `scripts/lib-migracoes.mjs`
  (regex `^\d{2,}-.*\.sql$`, **ordem numérica** pelo prefixo — sort lexicográfico
  aplicaria `100-` antes de `99-`; coberto por `test/migracoes.unit.mjs`) e
  registra o que aplicou em `_Migracao` (idempotente). **Não há Prisma/TypeORM** —
  não introduza um. Adicionar tabela = novo `db/NN-*.sql`.
- **Nunca renumere/remova um `.sql` já aplicado.** As migrações novas usam
  `CREATE TABLE IF NOT EXISTS`, então um banco que aplicou o arquivo antigo **pula
  silenciosamente** o substituto e diverge sem erro. (Já aconteceu: o banco dev
  local tem 49 registros em `_Migracao` para 47 arquivos — duas órfãs de 15/08.)
- **Convenção de nomes:** tabelas e colunas em PascalCase com prefixo do nome da
  tabela e aspas duplas — ex. `"Indicador_StatusValidacao"`, `"ConsumoLlm_Borda"`.
- **Dois papéis de banco (essencial):** as migrações rodam como **dono** (`itmt`);
  a **API conecta como `itmt_app`** (grants limitados, sem owner e sem `BYPASSRLS`).
  É isso que torna a imutabilidade da auditoria e o RLS reais também em dev/teste.
  Toda tabela nova precisa de `GRANT ... TO itmt_app` (e da sequência) no próprio
  `.sql` — senão a API não a lê. Tabela `TENANT_OWNED` precisa também de
  `ENABLE + FORCE ROW LEVEL SECURITY` e policy com `USING` **e** `WITH CHECK`.
- `Observacao` é **particionada por ano** de `DataReferencia`; `manter:particoes`
  cria as futuras antes de precisar.

## Comandos

Todos os comandos de `api/` rodam a partir de `cd api`.

```bash
# Build / dev
npm run build              # nest build (o test roda isto antes)
npm run start:dev          # API em watch, :3001
cd web && npm run dev      # portal :3000 (API_URL aponta para a API)

# Migrar (aplica db/NN-*.sql pendentes)
DATABASE_URL=postgres://itmt:itmt@localhost:5432/itmt npm run migrar

# Auditoria
npm run verificar-cadeia   # recomputa a cadeia SHA-256; exit 1 se quebrada
```

### Testes (suíte e2e — `node --test`)

`scripts/test-e2e.mjs` **cria e derruba sozinho** um banco descartável, aplica
todas as migrações, roda as 42 suítes e termina verificando a cadeia. Aponte
`DATABASE_URL` para o banco **administrativo** (`postgres`), não para o dev:

```bash
cd api
DATABASE_URL=postgres://itmt:itmt@localhost:5432/postgres npm test   # 282 testes, ~2,5 min
```

O runner recusa qualquer alvo cujo nome não termine em `_test`/`_teste`, e força
`NODE_ENV=test`, `XINGU_PROVEDOR=lexico`, `AGENTES_AUTO=0`. Nunca aponte os testes
para o banco dev `itmt` — ele tem dados reais e a suíte espera o seed demonstrativo.

```bash
TEST_FILES=test/xingu.e2e.mjs npm test   # uma suíte só, com o mesmo banco descartável
npm run test:keep-db                      # preserva o banco para inspeção
npm run test:restore                      # prova destrutiva de backup/restore
```

### Golden set da Xingú (KR3.1/3.3)

```bash
npm run golden:gerar                                   # gera api/golden/golden-set.json do catálogo real
API_URL=http://localhost:3001 npm run golden:avaliar   # precisa da API no ar
```

### Ingestão de dados reais e cofre

O seed (`db/02-seed.sql`) é **fictício**. Conectores em `api/scripts/ingestar-*.mjs`
e configs em `api/ingest-configs/*.json` carregam dado real pelo pipeline
**Bronze→Prata→Ouro**: bruto salvo com SHA-256 → normalização/validação → upsert
idempotente, com drift de esquema bloqueando a promoção e linhagem até o byte de
origem. Fontes sem API (CNES/TabNet, INEP) passam pelos `coletores/` em Python, que
**nunca escrevem no banco** — normalizam CSV e delegam ao conector Node auditado.

Segredos (chaves de LLM) ficam cifrados via `scripts/cofre.mjs` (AES-256-GCM +
scrypt), decifrados só em memória por `carregarSegredos()` no topo do `main.ts`;
`.cofre/` e `.env` estão no `.gitignore`. Ver README §F5 e "Do seed aos dados reais".

## Módulos da API (NestJS)

Cada pasta em `api/src/` é um módulo Nest. `DatabaseModule`, `AuthModule` e
`AuditoriaModule` são `@Global` (injetáveis sem reimportar). Prefixo global `/v1`.

**Motor (F1)**
- **`territorio` / `taxonomia` / `indicadores`** — resolve recorte
  (município/RGI/RGInt/consórcio/estado, RN-001; consórcio resolvido **na data de
  referência**, RN-002), aplica `TipoAgregacao` (RN-003: `SOMA` soma, `RECALCULO`
  recomputa Σnum/Σden, `MEDIA_PONDERADA` pesa por população, `NAO_AGREGAVEL`→422) e
  anexa o quinteto de procedência (`common/procedencia.ts`) a todo valor. Também
  série histórica, projeção/cenários (`projecao.service.ts`), mapa e exportação
  CSV/XLSX/PDF. Também `ranking()` (ranking de competição com delta vs. média) e
  `causas()` (decomposição por dimensão do catálogo `DimensaoObservacao`);
  indicador `RECALCULO` pareia numerador/denominador pelo helper único
  `paresRecalculo`, compartilhado por ranking, mapa e exportação — se você tocar
  um, confira os três.
- **`pesquisas`** — toda consulta executada é gravada normalizada
  (`Pesquisa*`, db/48) e reabrível por id, com SHA-256 canônico que denuncia se o
  conteúdo divergiu. Tabelas imutáveis: INSERT sem UPDATE/DELETE.

**IA e agentes**
- **`xingu`** — `orquestrador.service.ts` é a máquina de estados (RG-01);
  `interprete.service.ts` define `ProvedorLlm` + a cascata Anthropic→OpenAI→léxico;
  `narrador.ts` tem A05 (slots) e A06 (auditor de números); `sentinela.ts` é o A14
  anti-injeção; `custo.service.ts` (A15) é o governador de gasto — só usa LLM se
  `disponivel() && dentroDoOrcamento()`. **Padrão `RefLlm`:** out-param por
  requisição passado a `completar()` para capturar `usage` sem corrida de
  concorrência. `agent-executor.service.ts` aplica contratos runtime (timeout,
  retry, allowlist, fallback) a cada etapa.
- **`fontes`** — um agente por fonte, com regra "banco primeiro": só vai à internet
  se o dado falta ou venceu a validade; fonte que exige arquivo oficial informa o
  passo manual em vez de inventar download.

**Governança e segurança**
- **`admin`** — validação técnica/dossiê, autorizações (D-90/30/7), quarentena. O
  `AdminGuard` aceita **dois** Bearer: o `ADMIN_TOKEN` estático (só fora de
  produção) **e** tokens de sessão com papel ADMIN/CURADOR. É o ponto único de
  troca para SSO/MFA.
- **`auth`** — login/RBAC (RF012): scrypt (`senha.ts`), token HMAC stateless
  (`token.ts`), bootstrap idempotente do 1º admin via `ADMIN_SENHA_INICIAL`.
  Também o núcleo multitenant: `tenant-context.guard.ts` (valida membership e
  versão a cada request — membership revogada mata o token na hora),
  `tenant-object-storage.service.ts`, `tenant-cache.service.ts`, `tenant-jobs`.
- **`auditoria`**, **`conformidade`** (não conformidades P0–P3, histórico
  append-only).

**Superfícies**
- **`direitos`** (F4 Mapa de Direitos + motor "Descubra seus direitos"),
  **`documentos`** (upload/OCR/RAG com pgvector, antivírus, curadoria),
  **`parceiros`** (API keys hasheadas, escopos, quotas), **`participacao`** (canal
  público anônimo com protocolo e devolutiva), **`producao`** (mídia/campo/GIS),
  **`interoperabilidade`** (OpenAPI, OGC API Features, DCAT JSON-LD, métricas
  Prometheus), **`transparencia`**.

`main.ts` faz **fail-fast em produção**: recusa subir com token de dev, papel de
banco errado, CORS/segredos ausentes, storage não-S3 — e ainda **bloqueia o boot se
o banco contiver fixtures demonstrativas** (produção nunca exibe DEMO como oficial).
Aplica helmet/CORS/rate-limit.

## Ambiente e convenções desta máquina

- **PostgreSQL 18 nativo (sem Docker no dev local).** Papéis dev: `itmt/itmt`
  (dono, superuser) e `itmt_app/itmt_app` (app). O banco dev é `itmt` e **tem dados
  reais** (142 municípios, ~12 mil observações) — não rode a suíte contra ele. Os
  bancos `itmt_teste` e `itmt_ci` são resquícios obsoletos; o runner cria o seu.
- **Windows/psql:** passe SQL com acentos por **arquivo** (`-f`), nunca inline
  (`-c` corrompe encoding/aspas no PowerShell).
- **Não rode `npm run build` (prod) do web com o dev server ativo** — corrompe o
  cache `.next`. Pare o preview e limpe `.next` se acontecer.
- **Git:** commits em português, um por unidade lógica de trabalho; antes de
  commitar, varra segredos (`git diff --cached | grep -cE "sk-ant|sk-proj"`).
  Trabalhe em branch e só suba para `main` quando o usuário pedir.

## Especificação (F0)

O spec de produto vive em `docs/spec/` (PRD, catálogo de 16 agentes em `AGENTS.md`,
arquitetura, ADRs 001–009). Cuidado com **duas taxonomias de "agente"**: os 16
agentes-especialistas do produto (`docs/spec/AGENTS.md`) ≠ a numeração interna
A01–A15 da Xingú (decomposição de implementação; A07–A10/A13 são buracos, nunca
existiram). `docs/spec/README.md` explica onde o código diverge do spec **de
propósito** (mais rigoroso).

## Onde o programa realmente está

Software local: **verde** — 66 migrações aplicam do zero, 282/282 testes, cadeia
íntegra, builds de API e web limpos, zero vulnerabilidades de produção no `npm audit`.

**Atenção ao entrar (situação de 31/08/2026):** as migrações **48–64 e todo o
código que as consome ainda NÃO estão commitados** — vivem só na cópia de
trabalho (39 arquivos novos, 30 alterados). E o **banco dev `itmt` está na 47**:
antes de rodar a API contra ele, aplique as pendentes (`npm run migrar`), senão
o motor procura colunas que lá ainda não existem. Duas frentes esperam ato
humano: o parecer RG-09 de 4 indicadores `EM_ANALISE` (óbitos infantis, nascidos
vivos, TMI, despesas empenhadas) e a revisão/commit da árvore.

O que trava as fases **não é código**: são atos que o repositório não pode simular —
nuvem soberana/IdP/WAF/KMS contratados, campanhas de campo com equipe e autorização,
convênios científicos e aceites institucionais. O backlog de pareceres RG-09 do
banco local foi zerado em 22/08/2026 (74 aprovados / 5 rejeitados / 0 em análise —
EV-20260822-042/043/054, curadoria + rejeição de duplicatas por dado idêntico); em produção o rito se
repete com o catálogo oficial. Ao mexer aqui, não confunda `BLOCKED_EXTERNAL` com
pendência técnica, e **nunca converta fixture em evidência** para "fechar" um gate.
