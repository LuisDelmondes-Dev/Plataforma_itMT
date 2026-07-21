# ACCEPTANCE_CRITERIA.md — Critérios de Aceite

> Critérios por funcionalidade (formato Given/When/Then) + critérios gerais do produto.

## 1. Critérios gerais (produto pronto para uso)
- [ ] Responde corretamente ao caso de referência ✅ (km de estrada vicinal) com fonte e oferta de relatório por município.
- [ ] Toda resposta factual exibe **fonte** e **data de atualização** (RN03).
- [ ] Os **6 níveis de recorte** de localidade funcionam (Estado, município, intermediária, imediata, consórcio infra, consórcio saúde) ✅.
- [ ] O orquestrador registra **log de execução completo** por requisição.
- [ ] Relatórios PDF/planilha gerados com fontes e versão.
- [ ] OCR extrai e indexa dados corretamente em amostra de validação.
- [ ] Mapas exibem o recorte selecionado.
- [ ] Autenticação, perfis e permissões operam conforme RBAC.
- [ ] Conformidade LGPD verificada (consentimento, mascaramento, retenção).
- [ ] Respostas de baixa confiança roteadas para revisão humana.
- [ ] Metas de performance/disponibilidade atingidas (⚠️ valores a validar).

## 2. Por funcionalidade

### F1 — Consulta por linguagem natural (RF001)
- **Given** um usuário no chat, **When** pergunta por áudio, **Then** o áudio é transcrito e respondido em texto e áudio.
- **Given** uma pergunta factual com dado na base, **Then** a resposta inclui valor + fonte + data.
- **Given** o caso de referência, **Then** a IA oferece relatório por município.

### F2 — Pesquisa por localidade (RF006)
- **Given** seleção de "município", **Then** permite escolher 1 dos 142 por vez ✅.
- **Given** seleção de região/consórcio, **Then** os dados agregam os municípios componentes.

### F3 — Pesquisa por tema (RF003)
- **Given** um tema e recorte, **Then** retorna indicadores corretos do recorte.
- **Given** taxonomia, **Then** os temas/subtemas do MVP estão navegáveis.

### F4 — Relatórios (RF005)
- **Given** recorte + tema, **When** "Gerar relatório", **Then** PDF/planilha é gerado em ≤ 60s com fontes e versão.

### F7 — Upload + OCR (RF007)
- **Given** um documento, **When** enviado, **Then** o texto/dados são extraídos e indexados; confiança abaixo do limiar → revisão.

### F6/F10 — Mapas (RF010)
- **Given** um recorte, **Then** o mapa correspondente é renderizado.

### F11 — Rastreabilidade (RF011)
- **Given** qualquer requisição, **Then** existe registro de execução com modelo, fontes, custo e tempo.

### Orquestrador (RF002/RF004/RF016)
- **Given** uma solicitação, **Then** um plano de subtarefas é gerado e registrado.
- **Given** cada subtarefa, **Then** o log mostra agente/modelo escolhido e critério.
- **Given** resultado de baixa confiança, **Then** vai para revisão humana.

### Segurança/LGPD
- **Given** dado pessoal, **Then** é mascarado/anonimizado conforme perfil.
- **Given** ação relevante, **Then** é registrada no AuditLog (append-only).

## 3. Definição de Pronto (DoD)
- Código revisado e testado (unitário + integração).
- Critérios de aceite da história atendidos.
- Sem vulnerabilidades críticas (scan de segurança).
- Telemetria/logs implementados.
- Documentação atualizada.
