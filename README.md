# ITMT — Plataforma de Inteligência Territorial de Mato Grosso

MVP executável da Fase 1, derivado de `PRD-ITMT.md` v2.0.
Monorepo com três partes:

| Pasta | Stack | Papel |
|---|---|---|
| `db/` | PostgreSQL 16 | DDL do núcleo F1 + seed demonstrativo |
| `api/` | NestJS + pg | **Motor determinístico** — território, taxonomia, consulta, rollup, auditoria |
| `web/` | Next.js 14 (App Router) | Portal com design system **Meridiano** |

## Subir tudo (Docker)

```bash
docker compose up --build
# web:  http://localhost:3000
# api:  http://localhost:3001/v1/temas
```

## Subir manualmente (dev)

```bash
# 1. Banco
createdb itmt
psql -d itmt -f db/01-ddl.sql
psql -d itmt -f db/02-seed.sql

# 2. API
cd api && npm install
DATABASE_URL=postgres://itmt:itmt@localhost:5432/itmt npm run start:dev   # :3001

# 3. Web
cd web && npm install
API_URL=http://localhost:3001 npm run dev                                # :3000
```

## Estado: F1 código-completo

Todos os requisitos do escopo F1 do roadmap (§16) estão implementados e cobertos
pela suíte `npm test` (11 testes e2e, incluindo o **teste de procedência** e o
**teste de números** que o DoD §18 exige — ambos falham o build se violados).

| Requisito F1 | Estado |
|---|---|
| RF-PORTAL-001 busca tolerante a acento | ✅ `unaccent` |
| RF-PORTAL-002/003 seletores Tema/Subtema com cobertura e status | ✅ rail 1-2-3 |
| RF-PORTAL-004 procedência indissociável | ✅ régua em todo valor |
| RF-PORTAL-005 exportação CSV/XLSX/PDF | ✅ com procedência linha a linha e régua no PDF |
| RF-PORTAL-006 comparação (RGI/RGInt/Estado + 4 livres, 5ª série recusada) | ✅ |
| RF-PORTAL-007 permalinks | ✅ `/consulta?municipio=&tema=&subtema=` |
| RF-PORTAL-009 WCAG AA | ✅ foco visível, semáforo forma+rótulo+cor, skip link, reduced-motion |
| RF-PORTAL-011/013 ficha municipal SSR | ✅ |
| RF-ADMIN-001 autorizações com D-90/D-30/D-7 | ✅ `/v1/admin/autorizacoes*` |
| RF-ADMIN-002 painel de cobertura publicado e honesto | ✅ `/cobertura` |
| RF-ADMIN-003/004 validação técnica (RG-09) | ✅ submissão EM_ANALISE → parecer → publicação |
| RF-ADMIN-005/006 auditoria INSERT-ONLY encadeada | ✅ grant revogado + advisory lock |
| RF-ADMIN-007 transparência pública | ✅ `/transparencia` (inventário, privacidade, canal do titular) |
| RF-ADMIN-008 verificador de cadeia | ✅ script independente, roda na suíte |
| RF-INGEST-001..003 fonte 1ª classe + Bronze/Prata/Ouro + RG-06 | ✅ |
| RF-INGEST-005 drift de esquema bloqueia promoção | ✅ `--aceitar-esquema` para aceite consciente |
| RF-INGEST-006 idempotência | ✅ upserts por chave natural |
| RF-INGEST-009 linhagem até o bruto | ✅ hash em toda resposta |
| RF-INGEST-010 quarentena | ✅ `/v1/admin/quarentena` |
| RF-INGEST-011 alerta de fonte parada | ✅ `alerta:fontes` (agendar no cron) |

**O que "100%" não cobre (por natureza, não por pendência de código):**
o critério "6 dos 17 temas com dados reais" se completa **rodando os conectores
contra as fontes reais** (abaixo) — 6 temas já têm conector/config prontos:
Demografia, Economia Privada (PIB), Saúde (CNES), Educação (INEP), Segurança
(SESP) e Agronegócio (PAM). MFA de produção substitui o token do `AdminGuard`
via SSO institucional (ponto único de troca). Os artefatos F0
(`ARQUITETURA-ITMT.md` consolidado) seguem como documento à parte.

## F2 — IA Xingú (código-completo, avaliado)

A borda de linguagem do PRD §10, exatamente como especificada:

| Regra / KR | Implementação | Evidência |
|---|---|---|
| **RG-01** orquestrador determinístico | `xingu/orquestrador.service.ts` — máquina de estados codificada; os estados percorridos voltam na resposta | teste "RG-01" |
| **RG-02** LLM só nas bordas | A01 (pergunta→plano validado contra schema) e A05 (resultado→frase com slots `{{V1}}`); entre eles, só o motor determinístico do F1 | código + testes |
| **RG-03 / KR3.2** número nunca vem do modelo | A06 Auditor de Números: todo numeral do texto é validado contra o conjunto autorizado; divergência ⇒ **veto absoluto**, alerta na trilha e fallback determinístico | teste de sabotagem: numeral intruso `999999` jamais publica |
| **RG-04/RF-CHAT-011** injeção | A14 Sentinela + pergunta envelopada como dado no prompt | teste de injeção → `BLOQUEADA` |
| **RG-05** degradação segura | Sem `ANTHROPIC_API_KEY`, o intérprete **léxico determinístico** assume — o chat continua funcionando para o vocabulário do domínio; o portal nunca dependeu do LLM | avaliação abaixo rodou 100% sem LLM |
| **RF-CHAT-003** plano exibido | bloco `✛ PLANO` acima da narrativa no chat | `/xingu` |
| **RF-CHAT-005** ambiguidade | pergunta de volta com no máximo 2 opções clicáveis | teste |
| **RF-CHAT-006/RN-005** ausência | mensagem do motor, sem estimativa | teste |
| **RF-CHAT-007/008** follow-up + citações | ações concretas do portal (permalink, exportação CSV) e procedência clicável | `/xingu` |
| **RF-CHAT-009** trilha | pergunta, plano, valores, intérprete, `PROMPT_VERSAO`, vetos e latência entram na cadeia SHA-256 | evento `CONSULTA_CHAT` |
| **RF-CHAT-010** contexto de sessão | "e em Sinop?" resolvido pelo contexto do turno anterior | teste |
| **RF-CHAT-012** cache de planos | por (pergunta normalizada, contexto), TTL 10 min | teste |
| **RF-CHAT-001/002** texto+voz | STT (Web Speech pt-BR) e TTS opcional no navegador | `/xingu` |
| **RNF-09** abstração de provedor | interface `ProvedorLlm`; `ProvedorAnthropic` incluso; trocar de fornecedor = 1 classe | `interprete.service.ts` |

### Golden set (KR3.1 / KR3.3)

```bash
cd api
npm run golden:gerar            # gera api/golden/golden-set.json a partir do catálogo real
API_URL=http://localhost:3001 npm run golden:avaliar
```

Resultado nesta base (500 casos, intérprete léxico, sem LLM):
**KR3.1 = 100%** de planos corretos (exige ≥85%) · **KR3.3 p95 = 12 ms** (exige ≤5 s).
Com um provedor LLM configurado, formulações livres fora do vocabulário do golden set
também passam pela mesma validação de schema, com o léxico como plano B.

### Ativar o LLM na borda

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export XINGU_MODELO=claude-haiku-4-5   # ou outro; A15 (custo) entra no roadmap F5
```

Sem a chave, nada quebra: `RG-05` por construção.

## F3 — Mapeamento próprio (código-completo)

Módulos `GEO`, `MTIMAGENS`/`VIDEOS` e `CAMPO`. A marca do F3: **todos os vetos são
de banco** — triggers PL/pgSQL em `db/04-f3.sql`, provados por teste tentando
violar cada um, inclusive por SQL direto.

| Regra | Veto | Evidência |
|---|---|---|
| **RF-GEO-007 / RC-02** | produto `RESTRITO`/`CLASSIFICADO` não publica — trigger | teste → 422 com a mensagem do banco |
| **RC-03 / A11** | imagem de via pública sem `AnonimizacaoAplicada` não publica; a verificação é registrada com responsável na trilha | teste veto→anonimiza→publica |
| **RC-04 / RF-IMG-006** | pessoa identificável sem `TermoConsentimento` vinculado não publica; termo arquivado com hash SHA-256 | teste |
| **A12 / RF-IMG-003** | ativo sem licença explícita não publica; toda mídia carrega autor + licença (cadeia de direitos) | teste |
| **RF-IMG-002** | contribuição externa exige moderação prévia APROVADA | teste |
| **RF-IMG-005 / RNF-10** | vídeo sem legenda **e** transcrição não publica | teste |
| **RF-CAMPO-002** | missão sem autorização **vigente na data** não vai a campo nem é executada — trigger consulta `Autorizacao` | teste veto→vincula→executa |
| **RF-GEO-009 / RC-11** | cópia soberana do 360° é coluna `NOT NULL` — restrição estrutural | DDL |
| **RF-GEO-004 / RNF-13** | projeto de levantamento só nasce com autorizações, RT, GSD, acurácia; SRC travado em SIRGAS 2000 por `CHECK` | teste 400 |

**Entregas de superfície:** `/geoportal` (produtos publicados com metadados completos,
cobertura de imagem de rua ● Publicado ITMT / ◐ Preexistente / ○ Pendente, projetos
estruturantes), `/acervo` (busca pública — só sobrevive ao filtro o que passou pelos
vetos) e `/campo` (app do operador, **offline-first**: capturas entram em fila local
com GNSS/checklist/momento-da-captura e sincronizam quando houver rede; painel das
4 frentes por município — RF-CAMPO-004).

**Fora do software, por natureza:** a fotogrametria em si (nuvem de pontos →
ortomosaico/MDS/MDT) roda em ODM ou suíte proprietária (ADR-04) e **registra** seus
produtos aqui; o WMS/WFS é servido pelo GeoServer (perfil `geo` no compose:
`docker compose --profile geo up`); e o borrão de rostos/placas é executado por
ferramenta de visão — o sistema garante que **sem a verificação registrada, nada
publica**, que é exatamente o que RC-03 pede do software. KR2.1/2.2/2.3 (30
municípios entregues) são metas de operação de campo medidas pelo painel.

## Detalhe de implementação (rastreado ao PRD)

| Regra / RF | Onde | Como verificar |
|---|---|---|
| **RN-001** `codigo_ibge` universal | `db/01-ddl.sql`, `TerritorioService` | todo recorte agregado é resolvido para municípios antes de consultar |
| **RN-002** consórcio temporal | `TerritorioService.resolverRecorte('CONSORCIO')` | a composição é resolvida **na data de referência**; membro com `DataFim` passada sai do rollup |
| **RN-003** TipoAgregacao | `IndicadoresService.consultar` | `SOMA` soma; `RECALCULO` recomputa Σnum/Σden; `NAO_AGREGAVEL` → **HTTP 422 na camada de serviço** |
| **RN-004** taxonomia é dado | tabelas `TemaConsulta`/`SubtemaConsulta` | subtema `SEM_FONTE` chega desabilitado na UI, com chip de semáforo |
| **RN-005** ausência é resposta | `IndicadoresService.ausencia` | 404 com fonte mais recente e nº de municípios cobertos — **nunca estima** |
| **§12.1** quinteto de procedência | `common/procedencia.ts` + toda resposta de `/consulta` | fonte, ref., extração, licença e hash indissociáveis do valor |
| **RG-10 / RF-ADMIN-005** auditoria imutável | `AuditoriaService` + grants no DDL | `UPDATE`/`DELETE` revogados; hash = SHA-256(anterior ‖ payload canônico) |
| **RF-ADMIN-008** verificador de cadeia | `api/scripts/verificar-cadeia.mjs` | `npm run verificar-cadeia` recomputa a cadeia inteira, exit 1 se houver quebra |
| **RF-PORTAL-001** busca tolerante a acento | `unaccent` no Postgres | `GET /v1/municipios?q=varzea` → Várzea Grande |
| **RF-PORTAL-006** comparação | `GET /v1/indicadores/:id/comparacao` | município × RGI × RGInt × Estado numa chamada |
| **RF-PORTAL-011/013** ficha municipal SSR | `web/app/municipio/[codigo]` | HTML já vem com os valores e a régua (SEO) |
| **§15** Meridiano | `web/app/globals.css` | tokens exatos do PRD; régua de procedência como assinatura; semáforo forma+rótulo+cor |
| **RF-API-001** versionamento | prefixo `/v1` global | — |

### Endpoints

```
# públicos
GET /v1/municipios?q=            GET /v1/municipios/:codigo
GET /v1/regioes                  GET /v1/consorcios
GET /v1/temas                    GET /v1/temas/:id/subtemas
GET /v1/subtemas/:id/indicadores GET /v1/fontes
GET /v1/cobertura
GET /v1/indicadores/:id/consulta?recorte=MUNICIPIO|RGI|RGINT|CONSORCIO|ESTADO&codigo=&referencia=AAAA-MM-DD
GET /v1/indicadores/:id/comparacao?codigo_ibge=&municipios=cod1,cod2,cod3,cod4
GET /v1/indicadores/:id/exportacao?formato=csv|xlsx|pdf&recorte=&codigo=&referencia=

# ADMIN (Authorization: Bearer $ADMIN_TOKEN — padrão dev: itmt-admin-dev)
POST /v1/admin/indicadores                       # submissão (nasce EM_ANALISE)
GET  /v1/admin/indicadores/pendentes
POST /v1/admin/indicadores/:id/parecer           # {parecerista, decisao, justificativa}
POST /v1/admin/autorizacoes                      # {tipo, numero, orgao, vigencia_inicio, vigencia_fim}
GET  /v1/admin/autorizacoes
GET  /v1/admin/autorizacoes/vencimentos          # alertas D-90/D-30/D-7
GET  /v1/admin/quarentena
```

### Testes (DoD §18)

```bash
cd api
DATABASE_URL=postgres://itmt:itmt@localhost:5432/itmt npm test   # 11 testes e2e
```

### Casos de teste que demonstram as regras

```bash
# RECALCULO em consórcio (taxa jamais é somada)
curl 'localhost:3001/v1/indicadores/8/consulta?recorte=CONSORCIO&codigo=1&referencia=2025-12-31'

# NAO_AGREGAVEL bloqueado (422)
curl 'localhost:3001/v1/indicadores/7/consulta?recorte=RGINT&codigo=5101'

# Ausência como resposta legítima (404 com contexto)
curl 'localhost:3001/v1/indicadores/2/consulta?recorte=MUNICIPIO&codigo=5103403&referencia=2019-01-01'

# Integridade da cadeia de auditoria
cd api && npm run verificar-cadeia
```

## ⚠️ Do seed aos dados reais (módulo INGEST)

Os valores em `db/02-seed.sql` são **fictícios** — servem só para exercitar o fluxo.
Para carregar dados **reais**, use os conectores do IBGE (dado aberto, sem chave de API):

```bash
cd api
export DATABASE_URL=postgres://itmt:itmt@localhost:5432/itmt

# 1º — malha territorial oficial: os 142 municípios com RGI/RGInt reais
npm run ingest:territorio

# 2º — Demografia: população estimada (agregado 6579)
npm run ingest:populacao

# 3º — Economia Privada: PIB municipal (agregado 5938)
npm run ingest:pib -- 2021

# Qualquer outro agregado municipal do IBGE, sem escrever código:
node scripts/ingestar-ibge-agregado.mjs custom 2022 --agregado 1612 --variavel 216 \
     --indicador "Área plantada" --unidade hectares --tipo SOMA

# 4º–6º — Saúde (CNES), Educação (INEP), Segurança (SESP), Agronegócio (PAM):
# baixe o CSV oficial da fonte e rode o conector genérico com o config pronto:
node scripts/ingestar-csv.mjs ingest-configs/cnes-leitos.json  ~/Downloads/cnes.csv
node scripts/ingestar-csv.mjs ingest-configs/inep-matriculas.json ~/Downloads/censo-escolar.csv
node scripts/ingestar-csv.mjs ingest-configs/sesp-ocorrencias.json ~/Downloads/sesp.csv
node scripts/ingestar-csv.mjs ingest-configs/pam-area-plantada.json ~/Downloads/pam.csv
# (ajuste "colunas" no config se o cabeçalho oficial diferir — o drift
#  de esquema avisa exatamente o que foi lido)

# Monitoramento (agendar no cron):
npm run alerta:fontes            # RF-INGEST-011: fonte parada
npm run verificar-cadeia         # RF-ADMIN-008: integridade da auditoria
```

> Indicador criado por conector nasce **EM_ANALISE** e só aparece no portal
> após parecer favorável no ADMIN (RG-09) — a governança vale também para
> a ingestão.

Cada execução cumpre o pipeline do PRD:

1. **RG-06** — a fonte é registrada com `Fonte_BaseLegal` e licença; sem isso o script **aborta**.
2. **Bronze** (RF-INGEST-002) — o JSON bruto é salvo em `./bronze/` com SHA-256 (em produção: object storage com Object Lock).
3. **Prata** — normalização e validação; registro inválido aborta a promoção.
4. **Ouro** — upsert **idempotente** (RF-INGEST-006): rode quantas vezes quiser, nada duplica.
5. **Linhagem** (RF-INGEST-009) — `Carga` guarda hash e caminho do bruto; toda `Observacao` aponta para a sua `Carga`; a procedência na API leva o hash até o byte de origem.
6. **Auditoria** — eventos `INGESTAO_BRONZE` e `PROMOCAO_OURO` entram na cadeia SHA-256.

Reprocessamento a partir de um Bronze já capturado (sem rede):

```bash
node scripts/ingestar-ibge-territorio.mjs --from-bronze bronze/ibge-municipios-mt-2026-07-08.json
node scripts/ingestar-ibge-populacao.mjs 2024 --from-bronze bronze/ibge-populacao-mt-2024.json
```

> Os demais indicadores do seed (leitos, matrículas, PIB, vacinação) continuam
> demonstrativos até ganharem seus próprios conectores — este é o backlog de F1,
> um conector por linha da tabela de fontes do PRD (§14).

## Fora deste MVP (roadmap do PRD)

- **IA Xingú** (borda de linguagem, agentes A01–A15) — F2; o motor determinístico
  que ela consumirá já é este.
- `GEO`, `MTIMAGENS`, `VIDEOS`, `CAMPO`, `CENSO` — F3+.
- Exportação CSV/XLSX/PDF, permalinks por combinação, painel de cobertura completo,
  ingestão Bronze/Prata/Ouro com quarentena — próximos incrementos de F1.

## Decisão divergente do PRD (registrar em ADR)

O PRD manda F0 (documentação) antes de qualquer código. Este MVP foi construído
como **prova de arquitetura executável** — os invariantes críticos (RN-001..005,
RG-10, procedência) estão demonstrados em código testável. `ARQUITETURA-ITMT.md`
e `DDL-ITMT.sql` completos continuam sendo os artefatos de F0; este repositório
serve de referência viva para escrevê-los.
