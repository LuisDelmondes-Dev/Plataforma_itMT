# API.md — APIs e Integrações

> APIs internas (expostas) e integrações externas (consumidas). Especificação detalhada deve ser publicada em OpenAPI. Autenticação via token (Bearer/JWT); consultas básicas podem ser anônimas (acesso gratuito ✅).

## 1. APIs internas

### 1.1. Autenticação — `/auth`
- **Objetivo:** login, registro, refresh de token.
- **Entrada:** credenciais (email/senha) ou SSO.
- **Saída:** access token + refresh token.
- **Auth:** pública.
- **Prioridade:** Alta · **Riscos:** segurança (brute force, vazamento) → rate limit, hashing forte, MFA opcional.

### 1.2. Consulta em linguagem natural — `/query`
- **Objetivo:** receber pergunta (texto/áudio) e retornar resposta orquestrada.
- **Entrada:** `{ canal, conteudo|audio, recorte?, tema? }`.
- **Saída:** `{ resposta, audio?, fontes[], formato, request_id, sugestoes[] }`.
- **Auth:** token ou anônimo (com cota).
- **Prioridade:** Alta · **Riscos:** alucinação, custo de IA → RAG+citação, roteamento por custo, cache.

### 1.3. Indicadores — `/indicators`
- **Objetivo:** buscar indicadores por tema/recorte.
- **Entrada:** `{ tema, subtema?, municipality_id|region_id|consortium_id, periodo? }`.
- **Saída:** `{ valores[], fonte, data_atualizacao, versao }`.
- **Auth:** token · **Prioridade:** Alta · **Riscos:** dado defasado → exibir data e origem.

### 1.4. Relatórios — `/reports`
- **Objetivo:** gerar e baixar relatórios.
- **Entrada:** `{ recorte, tema, formato: pdf|xlsx }`.
- **Saída (assíncrona):** `{ report_id, status }` → polling/webhook → `storage_url`.
- **Auth:** token · **Prioridade:** Alta · **Riscos:** tempo de geração → processamento assíncrono.

### 1.5. Documentos — `/documents`
- **Objetivo:** upload + OCR + extração.
- **Entrada:** arquivo (multipart).
- **Saída:** `{ document_id, status_ocr, dados_extraidos }`.
- **Auth:** token · **Prioridade:** Alta · **Riscos:** qualidade OCR → confiança mínima + revisão.

### 1.6. Mapas — `/maps`
- **Objetivo:** camadas e tiles GIS por recorte.
- **Entrada:** `{ recorte, camada }`.
- **Saída:** GeoJSON/tiles/links 3D.
- **Auth:** token ou anônimo · **Prioridade:** Alta · **Riscos:** volume → tiles + CDN.

### 1.7. Mídia (MT Imagens) — `/media`
- **Objetivo:** acervo de fotos/vídeos/360/3D.
- **Entrada:** filtros (município, tipo).
- **Saída:** URLs de mídia + metadados.
- **Auth:** token ou anônimo · **Prioridade:** Média · **Riscos:** direitos de imagem → termos de uso.

### 1.8. Administração — `/admin/agents`, `/admin/models`, `/admin/audit`
- **Objetivo:** gerir agentes, modelos de IA e consultar auditoria.
- **Entrada:** config / filtros.
- **Saída:** status / registros.
- **Auth:** admin · **Prioridade:** Média · **Riscos:** erro de config → validação + RBAC.

## 2. Integrações externas (consumidas)

| Nome | Objetivo | Entrada | Saída | Auth | Prioridade | Riscos |
|------|----------|---------|-------|------|:----------:|--------|
| IBGE | Censos 1990/2000/2010/2022, geografia | consulta | dados demográficos/geo | Pública | Alta | formato/limites de taxa |
| Imprensa Oficial MT | Publicações diárias (✅ exceto RH) | datas/termos | atos administrativos | Pública | Alta | parsing/volume |
| Fontes gov. (economia pública) | Arrecadação, repasses, obras | consulta | indicadores | Convênio | Alta | acesso/atualização |
| Google Maps / Street View | Mapas e cobertura de ruas | coords | tiles/imagens | API key | Alta | custo/quota |
| Provedores de IA (LLM/OCR/STT/TTS) | Modelos de IA | prompt/arquivo | resultado | API key | Alta | custo/privacidade |
| Parceiros institucionais | Cessão de dados (convênios) | — | datasets | Convênio | Média | disponibilidade |

## 3. Convenções

- **Versionamento:** prefixo `/v1`.
- **Formato:** JSON (UTF-8); geoespacial em GeoJSON.
- **Erros:** padrão `{ error_code, message, details }` + HTTP status apropriado.
- **Paginação:** cursor ou offset/limit.
- **Rate limiting:** por token/IP; cotas por plano.
- **Idempotência:** chave de idempotência em POSTs de geração de relatório.

## 4. Pontos a validar ⚠️

- Quais fontes oficiais já têm API pública vs. exigem convênio/scraping (✅ documentos preveem "mineração por meios digitais").
- Há fonte estruturada para "estradas vicinais" (caso de referência)?
- Limites/custo do Google Maps/Street View para cobertura dos 103 municípios restantes.
