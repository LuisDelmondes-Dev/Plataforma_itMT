# ARCHITECTURE.md — Arquitetura Técnica

> Arquitetura agnóstica de stack para a Plataforma ITMT. Tecnologias citadas são exemplos. ✅ O modelo SaaS na nuvem e a orquestração multiagente vêm dos documentos; 🧩 o detalhamento é proposta técnica.

## 1. Princípios de arquitetura

- **SaaS multitenant na nuvem** ✅ — acesso por navegador e apps; tudo na nuvem (atualizações, storage, segurança).
- **Orquestração multiagente** ✅ — a IA Xingú coordena múltiplos agentes interligados e independentes.
- **Agnóstico de modelos de IA** 🧩 — gateway que roteia cada subtarefa ao modelo mais adequado.
- **Rastreabilidade ponta a ponta** 🧩 — toda resposta liga-se a fontes e a um log de execução.
- **Sem lock-in** — abstrações para banco, storage e provedores de IA.
- **Escalabilidade horizontal** — meta de alto tráfego (top 10 sites do Estado ✅).

## 2. Diagrama de alto nível

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLIENTES (Front-end)                       │
│  Web (browser desktop/mobile)  │  App iOS  │  App Android  │ Voz    │
└───────────────┬────────────────┴───────────┴──────────────┴────────┘
                │ HTTPS / WebSocket
        ┌───────▼────────┐
        │  API Gateway   │  (auth, rate limit, roteamento)
        └───────┬────────┘
                │
   ┌────────────▼─────────────┐     ┌──────────────────────────┐
   │  Serviço de Aplicação    │◄────┤  Auth & Permissões (RBAC) │
   │  (BFF / API REST/GraphQL)│     └──────────────────────────┘
   └────────────┬─────────────┘
                │
        ┌───────▼─────────────────────────────────────────┐
        │       MOTOR DE AGENTES — IA XINGÚ                 │
        │  Orquestrador + Catálogo de Agentes + Planner     │
        └───────┬───────────────┬───────────────┬──────────┘
                │               │               │
        ┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼─────────┐
        │ GATEWAY DE IA│ │ Fila/Workers │ │ Agentes       │
        │ (roteamento  │ │ (async jobs) │ │ Especialistas │
        │  multimodelo)│ └──────────────┘ └───────────────┘
        └───────┬──────┘
                │  (LLM aberto/local + comercial; STT/TTS; OCR; visão)
   ┌────────────┼───────────────────────────────────────────────┐
┌──▼───────┐ ┌──▼────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Banco    │ │ Banco     │ │ Object   │ │ GIS /    │ │ Cache    │
│ Relacion.│ │ Vetorial  │ │ Storage  │ │ Tiles 3D │ │ (Redis)  │
│(Postgres)│ │(pgvector/ │ │(arquivos,│ │(GeoServer│ │          │
│ +PostGIS │ │ Qdrant)   │ │ imagens, │ │ /PostGIS)│ │          │
│          │ │           │ │ vídeos)  │ │          │ │          │
└──────────┘ └───────────┘ └──────────┘ └──────────┘ └──────────┘
        │
┌───────▼───────────────────────────────────────────────────────┐
│ INTEGRAÇÕES: IBGE, fontes oficiais, imprensa oficial, APIs gov,  │
│ Google Maps/Street View, parceiros (convênios)                   │
└────────────────────────────────────────────────────────────────┘
        │
┌───────▼───────────────────────────────────────────────────────┐
│ OBSERVABILIDADE & SEGURANÇA: logs, tracing, métricas, custo IA, │
│ auditoria, gestão de segredos, backup                            │
└────────────────────────────────────────────────────────────────┘
```

## 3. Camadas e responsabilidades

### 3.1. Front-end
- **Web:** React/Next.js, responsivo (desktop + mobile) ✅.
- **Mobile:** React Native ou Flutter (código compartilhado iOS/Android) ✅.
- **Voz:** captura de áudio → STT; reprodução de resposta → TTS ✅.

### 3.2. API Gateway / BFF
- Autenticação, rate limiting, roteamento, agregação de respostas.
- WebSocket/SSE para streaming de respostas do chat.

### 3.3. Motor de Agentes (IA Xingú)
- Orquestrador (planner), catálogo de agentes, execução sequencial/paralela.
- Ver [AI_ORCHESTRATOR.md](./AI_ORCHESTRATOR.md) e [AGENTS.md](./AGENTS.md).

### 3.4. Gateway de IA
- Registro de modelos (LLM/visão/OCR/embedding/STT/TTS).
- Política de roteamento por custo, velocidade, precisão, privacidade.
- Fallback e retries.

### 3.5. Processamento assíncrono
- Fila (RabbitMQ/Kafka/Redis) para jobs pesados: OCR em lote, geração de relatórios, processamento GIS/3D, ingestão de dados.

### 3.6. Dados
- **Relacional (PostgreSQL + PostGIS):** entidades de negócio e geoespacial.
- **Vetorial (pgvector/Qdrant):** RAG e busca semântica.
- **Object storage (S3-compatível):** documentos, imagens, vídeos, ortomosaicos, nuvens de pontos.
- **Cache (Redis):** sessões, respostas frequentes, rate limiting.
- **GIS/Tiles:** GeoServer + MapLibre/Cesium para 2D/3D.

## 4. Padrões de implantação

- **Início:** monólito modular (mais simples de operar) com fronteiras claras por módulo.
- **Evolução:** extrair microsserviços por carga (motor de agentes, GIS, ingestão).
- **Containers** (Docker) orquestrados por **Kubernetes**; autoscaling por fila e CPU.

## 5. Decisões de arquitetura (ADR) a registrar

| ID | Decisão | Status |
|----|---------|--------|
| ADR-001 | Xingú como orquestrador sobre modelos abertos vs. modelo treinado do zero | ⚠️ Aberta (recomendação: orquestrador) |
| ADR-002 | Banco vetorial: pgvector (simplicidade) vs. Qdrant/Weaviate (escala) | 🧩 Proposta |
| ADR-003 | Monólito modular no MVP, microsserviços por necessidade | 🧩 Proposta |
| ADR-004 | Multitenancy: schema por tenant vs. linha com tenant_id | ⚠️ A validar |
| ADR-005 | Hospedagem: nuvem pública/privada/híbrida; dado em território nacional | ⚠️ A validar (LGPD) |

## 6. Requisitos não funcionais (resumo)

Segurança (TLS/AES-256, RBAC), LGPD, performance (chat ≤5s P95 ⚠️), escalabilidade horizontal, disponibilidade (SLA ≥99,5% ⚠️), observabilidade, auditabilidade, acessibilidade (WCAG 2.1 AA), backup (RPO≤24h/RTO≤4h ⚠️). Detalhes em [SECURITY_LGPD.md](./SECURITY_LGPD.md) e PRD §15.
