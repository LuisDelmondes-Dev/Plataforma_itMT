# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este projeto

Monorepo do MVP da **Plataforma ITMT** (Inteligência Territorial de Mato Grosso).
Três partes: `db/` (PostgreSQL, DDL + migrações SQL escritas à mão), `api/`
(NestJS — o **motor determinístico**), `web/` (Next.js 14 App Router). O README.md
tem o mapa exaustivo de requisitos (RF/RG) por fase (F1–F5); consulte-o para
detalhe de regra específica.

## Invariantes de arquitetura (não quebre)

Estas ideias atravessam todo o código e são o motivo de muitas decisões que
parecem "estranhas". Antes de alterar qualquer fluxo, confirme que ainda valem:

- **Número vem do motor, nunca do LLM.** Toda agregação/consulta é determinística
  (`IndicadoresService`, `TerritorioService`). Na IA Xingú, o LLM só atua em duas
  bordas — A01 (pergunta→plano validado contra schema) e A05 (resultado→frase). O
  **A06 Auditor** (`xingu/narrador.ts`) veta *qualquer* numeral no texto que não
  esteja no conjunto autorizado pelo motor. Regra RG-03/KR3.2.
- **Vetos são de banco.** Em F3/F4, as regras de publicação são triggers PL/pgSQL
  (`db/04-f3.sql`, `db/06-f4.sql`), não checagens só na aplicação — provadas por
  testes que tentam violar por SQL direto.
- **Auditoria é imutável.** `EventoAuditoria` é INSERT-ONLY encadeado por
  SHA-256(anterior ‖ payload). UPDATE/DELETE são revogados no DDL. `AuditoriaService`
  grava; `scripts/verificar-cadeia.mjs` recomputa a cadeia inteira.
- **Ausência é resposta.** Dado inexistente devolve 404/mensagem com contexto
  (fonte mais recente, municípios cobertos) — **nunca estima** (RN-005).
- **Publicação é ato humano (RG-09).** Nenhum agente auto-publica indicador/direito.
  Fluxo: nasce `EM_ANALISE`/`RASCUNHO` → parecer/vetos → publica. A Validação
  Técnica (`admin/validacao-tecnica.service.ts`) produz *dossiê*, não decisão.
- **Degradação segura (RG-05).** Sem chave/crédito de LLM, a Xingú cai para o
  intérprete **léxico determinístico** e continua funcionando. Nunca faça o portal
  depender do LLM.

## Banco de dados — como funciona (sem ORM)

- **Driver `pg` cru + SQL versionado.** As migrações são `db/NN-*.sql` numeradas.
  `api/scripts/migrar.mjs` descobre os arquivos por regex `^\d{2}-.*\.sql$` em ordem
  e registra o que aplicou em `_Migracao` (idempotente). **Não há Prisma/TypeORM** —
  não introduza um. Adicionar tabela = novo `db/NN-*.sql`.
- **Convenção de nomes:** tabelas e colunas em PascalCase com prefixo do nome da
  tabela e aspas duplas — ex. `"Indicador_StatusValidacao"`, `"ConsumoLlm_Borda"`.
- **Dois papéis de banco (essencial):** as migrações rodam como **dono** (`itmt`);
  a **API conecta como `itmt_app`** (grants limitados). É isso que torna a
  imutabilidade da auditoria real também em dev/teste. Toda tabela nova precisa de
  `GRANT ... TO itmt_app` (e da sequência) no próprio `.sql` — senão a API não a lê.

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

A suíte exige `DATABASE_URL` apontando para um banco **já migrado e com seed**. Ela
roda `build` antes e inclui o verificador de cadeia. Rode contra um `itmt_teste`
recriado do zero (mesmo fluxo do CI), com a API no papel `itmt_app`:

```bash
# recriar do zero (Postgres nativo local; ajuste o PATH do psql/createdb se preciso)
createdb itmt_teste && DATABASE_URL=postgres://itmt:itmt@localhost:5432/itmt_teste npm run migrar
DATABASE_URL=postgres://itmt_app:itmt_app@localhost:5432/itmt_teste XINGU_PROVEDOR=lexico npm test   # 44 testes

# um arquivo só (ex.: apenas a Xingú) — mantendo o mesmo DATABASE_URL/XINGU_PROVEDOR:
node --test test/xingu.e2e.mjs      # test/{e2e,xingu.e2e,f3.e2e,f4.e2e}.mjs
```

### Golden set da Xingú (KR3.1/3.3)

```bash
npm run golden:gerar                                   # gera api/golden/golden-set.json do catálogo real
API_URL=http://localhost:3001 npm run golden:avaliar   # precisa da API no ar
```

### Ingestão de dados reais (IBGE) e cofre

O seed (`db/02-seed.sql`) é **fictício**. Conectores em `api/scripts/ingestar-*.mjs`
e configs em `api/ingest-configs/*.json` carregam dado real pelo pipeline
Bronze→Prata→Ouro. Segredos (chave de LLM) ficam cifrados via `scripts/cofre.mjs`
(AES-256-GCM + scrypt), decifrados só em memória; `.cofre/` e `.env` estão no
`.gitignore`. Ver README §F5 e "Do seed aos dados reais".

## Módulos da API (NestJS)

Cada pasta em `api/src/` é um módulo Nest. `DatabaseModule` e `AuthModule` são
`@Global` (injetáveis em qualquer lugar sem reimportar). Núcleo:

- **`territorio` / `taxonomia` / `indicadores`** — o motor F1: resolve recorte
  (município/RGI/RGInt/consórcio/estado, RN-001/002), aplica `TipoAgregacao`
  (RN-003: `SOMA` soma, `RECALCULO` recomputa Σnum/Σden, `NAO_AGREGAVEL`→422) e
  anexa o quinteto de procedência (`common/procedencia.ts`) a todo valor.
- **`xingu`** — IA Xingú. `orquestrador.service.ts` é a máquina de estados (RG-01);
  `interprete.service.ts` define `ProvedorLlm` + a cascata Anthropic→OpenAI→léxico;
  `custo.service.ts` (A15) é o governador de gasto — só usa LLM se
  `disponivel() && dentroDoOrcamento()`. **Padrão `RefLlm`:** out-param por
  requisição passado a `completar()` para capturar `usage` sem corrida de
  concorrência.
- **`admin`** — validação técnica, autorizações (D-90/30/7), quarentena. O
  `AdminGuard` aceita **dois** Bearer: o `ADMIN_TOKEN` estático **e** tokens de
  sessão com papel ADMIN/CURADOR (retrocompatível — a suíte usa `itmt-admin-dev`).
- **`auth`** — login/RBAC (RF012): scrypt (`senha.ts`), token HMAC stateless
  (`token.ts`), bootstrap idempotente do 1º admin via `ADMIN_SENHA_INICIAL`;
  `AgentExecutionService` é o registry de execução de agentes.
- **`fontes` (F5), `direitos` (F4), `producao`/`transparencia`, `auditoria`.**

`main.ts` faz fail-fast em produção (recusa subir com token de dev, papel errado
ou CORS ausente) e aplica helmet/CORS/rate-limit.

## Ambiente e convenções desta máquina

- **PostgreSQL nativo (sem Docker no dev local).** Papéis dev: `itmt/itmt` (dono,
  superuser) e `itmt_app/itmt_app` (app). O banco dev é `itmt`; os testes usam
  `itmt_teste`. Migrações 10/11 já aplicadas em ambos.
- **Windows/psql:** passe SQL com acentos por **arquivo** (`-f`), nunca inline
  (`-c` corrompe encoding/aspas no PowerShell).
- **Não rode `npm run build` (prod) do web com o dev server ativo** — corrompe o
  cache `.next`. Pare o preview e limpe `.next` se acontecer.
- **Git:** commits em português, um por unidade lógica de trabalho; antes de
  commitar, varra segredos (`git diff --cached | grep -cE "sk-ant|sk-proj"`).
  Trabalhe em branch e só suba para `main` quando o usuário pedir.

## Especificação (F0)

O spec de produto vive em `docs/spec/` (PRD, catálogo de 16 agentes em `AGENTS.md`,
arquitetura/ADRs). Cuidado com **duas taxonomias de "agente"**: os 16 agentes-
especialistas do produto (`docs/spec/AGENTS.md`) ≠ a numeração interna A01–A15 da
Xingú (decomposição de implementação; A07–A10/A13 são buracos, nunca existiram).
`docs/spec/README.md` explica onde o código diverge do spec **de propósito** (mais
rigoroso).
