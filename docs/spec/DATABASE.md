# DATABASE.md — Modelo de Dados

> Proposta inicial de modelagem 🧩 derivada do PRD. Banco relacional PostgreSQL + PostGIS (geoespacial) e banco vetorial para RAG.

## 1. Visão geral de domínios

- **Identidade & acesso:** User, Organization, Role, Permission, RolePermission, Subscription, SubscriptionPlan.
- **Território:** Municipality, Region, Consortium.
- **Conhecimento/Indicadores:** Theme, Subtheme, Indicator, IndicatorValue, DataSource, Dataset.
- **Documentos & vetorial:** Document, DocumentChunk.
- **IA & execução:** Agent, AIModel, Workflow, Task, AgentExecution, Request.
- **Saídas:** Report, Dashboard, MapLayer, MediaAsset.
- **Governança:** AuditLog.
- **Campo:** FieldSurvey.

## 2. Entidades e campos principais

### Identidade & acesso
**User** — id, nome, email (único), senha_hash, telefone, tipo_usuario, organization_id (FK), status, criado_em, atualizado_em.
**Organization (Tenant)** — id, nome, tipo (pública/privada/acadêmica), cnpj, plano_id (FK), status, criado_em.
**Role** — id, nome, descrição.
**Permission** — id, código (único), descrição.
**RolePermission** — role_id (FK), permission_id (FK). *(PK composta)*
**SubscriptionPlan** — id, nome, preco, limites (jsonb), recursos (jsonb).
**Subscription** — id, organization_id (FK), plan_id (FK), status, inicio, fim.

### Território
**Municipality** — id, nome, codigo_ibge (único), regiao_intermediaria, regiao_imediata, consorcio_infra_id (FK), consorcio_saude_id (FK), geometria (geometry, PostGIS).
**Region** — id, tipo (intermediaria/imediata), nome, geometria (geometry).
**Consortium** — id, tipo (infraestrutura/saúde), nome. *(N:N com Municipality via tabela de junção)*
**ConsortiumMunicipality** — consortium_id (FK), municipality_id (FK).

### Conhecimento & indicadores
**Theme** — id, nome (1 dos 17 temas), descrição. *(ver TAXONOMY.md)*
**Subtheme** — id, theme_id (FK), nome.
**Indicator** — id, subtheme_id (FK), nome, unidade, descrição, fonte_padrao_id (FK DataSource).
**IndicatorValue** — id, indicator_id (FK), municipality_id (FK, nullable), region_id (FK, nullable), valor, periodo, fonte_id (FK), data_atualizacao, versao, origem (próprio/terceiro), confianca (0–1).
**DataSource** — id, nome, tipo (gov/privada/acadêmica/própria), url, contato, licenca_uso, ultima_coleta.
**Dataset** — id, nome, tema, descrição, formato, versao, fonte_id (FK).

### Documentos & vetorial
**Document** — id, organization_id (FK), nome, tipo_arquivo, storage_path, status_ocr, criado_em.
**DocumentChunk** — id, document_id (FK), texto, embedding (vector), metadados (jsonb), fonte. *(índice vetorial: HNSW/IVFFlat)*

### IA & execução
**Agent** — id, nome, função, status, config (jsonb).
**AIModel** — id, nome, provedor, tipo (texto/visão/ocr/embedding/stt/tts), custo_token, latencia_media, privacidade (local/externo), ativo (bool).
**Request (Consulta)** — id, user_id (FK, nullable p/ anônimo), canal (texto/áudio/visual), conteudo, intencao, recorte (jsonb), tema, criado_em.
**Workflow** — id, request_id (FK), plano (jsonb — grafo de tarefas), status, criado_em.
**Task** — id, workflow_id (FK), tipo, status, dependencias (jsonb), agent_id (FK).
**AgentExecution** — id, request_id (FK), agent_id (FK), ai_model_id (FK), input (jsonb), output (jsonb), fontes (jsonb), custo, tokens, tempo_ms, status, criado_em.

### Saídas
**Report** — id, request_id (FK), tipo, recorte (jsonb), tema, formato (pdf/xlsx), storage_path, fontes (jsonb), versao, criado_em.
**Dashboard** — id, organization_id (FK), nome, config (jsonb), criado_em.
**MapLayer** — id, nome, tipo (relevo/hidrografia/infra/ortomosaico/streetview), municipality_id (FK, nullable), region_id (FK, nullable), storage_path, formato.
**MediaAsset (MT Imagens)** — id, tipo (foto/vídeo/360/3D), municipality_id (FK), autor, fonte (própria/contribuição), storage_path, criado_em.

### Governança & campo
**AuditLog** — id, actor_tipo (user/agent), actor_id, acao, entidade, entidade_id, detalhes (jsonb), criado_em. *(append-only)*
**FieldSurvey** — id, agente_saude_id (FK User), municipality_id (FK), respostas (jsonb), localizacao (geometry), sincronizado_em.

## 3. Relacionamentos-chave

```
Organization 1───* User
Organization 1───* Subscription *───1 SubscriptionPlan
Theme 1───* Subtheme 1───* Indicator 1───* IndicatorValue
IndicatorValue *───1 Municipality / Region
IndicatorValue *───1 DataSource
Consortium *───* Municipality
Document 1───* DocumentChunk
Request 1───1 Workflow 1───* Task
Request 1───* AgentExecution *───1 Agent / AIModel
Request 1───* Report
```

## 4. Índices e considerações

- Índice geoespacial (GiST) em `Municipality.geometria` e `Region.geometria`.
- Índice vetorial (HNSW) em `DocumentChunk.embedding`.
- Índices em `IndicatorValue (indicator_id, municipality_id, periodo)` para consultas por recorte.
- `AuditLog` e `AgentExecution` particionados por data (volume).
- `email`, `codigo_ibge`, `permission.código` únicos.

## 5. Multitenancy

⚠️ A validar (ADR-004): isolamento por `organization_id` em linha (mais simples) vs. schema por tenant (mais isolado). Recomendação inicial 🧩: linha com `organization_id` + RLS (Row Level Security) do PostgreSQL.

## 6. Versionamento e origem

- `IndicatorValue.versao` + `data_atualizacao` + `origem` atendem às regras RN07/RN13 (distinção próprio/terceiro e versionamento).
- Conflitos entre fontes (RN12): manter múltiplos `IndicatorValue` com fontes diferentes; padrão = mais recente; sinalizar divergência na resposta.
