# Plano Diretor ITMT — 36 meses

## Decisões de programa

- Entrega incremental, com gate verificável ao fim de cada fase.
- Primeiro lançamento: seis temas e dez municípios.
- Equipe permanente de 20–30 pessoas e contratação de campo por lotes.
- Nuvem em região brasileira, portabilidade e cópia soberana dos ativos.
- PWA antes dos aplicativos nativos.
- Gateway de IA multiprovedor com fallback determinístico.
- Nenhum valor factual sem fonte, referência, extração, licença e hash.

Municípios piloto: Cuiabá, Várzea Grande, Rondonópolis, Sinop, Sorriso, Cáceres,
Barra do Garças, Tangará da Serra, Alta Floresta e Primavera do Leste.

Temas iniciais: Demografia, Saúde, Educação, Agronegócio, Economia Privada e
Infraestrutura Macro.

## Ondas de execução

| Fase | Meses | Resultado utilizável | Gate principal |
|---|---:|---|---|
| F0 — Recuperação e fundação | 0–2 | Engenharia confiável e governança ativa | 100% dos testes em banco isolado; catálogo e arquitetura aprovados |
| F1 — MVP público confiável | 2–6 | Portal com 6 temas e 10 municípios | 12 indicadores reais; estradas vicinais; WCAG AA |
| F2 — Plataforma de dados | 5–12 | Ingestão, OCR, RAG, catálogo e API | 8 temas com dados; 50 indicadores; OCR/RAG avaliados |
| F3 — Inteligência e pilotos | 9–18 | Xingú multiagente, PWA e campo piloto | 100 indicadores; 10 pacotes GIS/audiovisual |
| F4 — Escala SaaS | 15–24 | Alta disponibilidade e apps nativos | 99,9%; 60 municípios; 200 indicadores |
| F5 — Mapeamento estadual | 18–30 | Operação GIS/360º/audiovisual estadual | 142 municípios com situação auditável |
| F6 — Ecossistema científico | 24–33 | Dados abertos, pesquisa e participação | metodologias independentes e dados reproduzíveis |
| F7 — Consolidação | 30–36 | Operação sustentável e auditada | 300 indicadores, DR comprovado e auditoria integral |

## Backlog vinculante por fase

### F0

- Banco `_test` criado e removido automaticamente; suítes serializadas.
- Integridade territorial, separação explícita de fixtures e bloqueio de demo em produção.
- CI com testes, auditoria de dependências, SBOM, secrets scan e CodeQL.
- Comitês, RACI, arquitetura-alvo, catálogo mestre e plano de aquisições.
- Matriz de evidências substituindo declarações genéricas de conclusão.

### F1

- Seis recortes territoriais sem opções vazias.
- Dois indicadores reais por tema inicial e cobertura dos dez municípios piloto.
- Caso estradas vicinais completo: ingestão, consulta, Xingú e relatório municipal.
- Identidade pública e OIDC/MFA administrativo.
- Qualidade, metodologia e cobertura visíveis em cada resultado.

### F2

- Taxonomia integral dos anexos e pipelines Bronze/Prata/Ouro observáveis.
- Catálogo público, upload seguro, OCR, revisão humana, pgvector e busca híbrida.
- Portal de parceiros, API com quotas e GIS por padrões OGC.

### F3–F4

- Gateway multiprovedor, avaliações contínuas e contratos de agentes.
- PWA offline, formulários versionados e pesquisa domiciliar piloto.
- Storage real, mídia derivada, VANT/360º e Cesium/3D Tiles.
- Multitenancy, apps nativos, alta disponibilidade, FinOps e suporte.

### F5–F7

- Escritório de campo, levantamentos estaduais e portfólios municipais.
- Portal científico, DCAT, participação cidadã e observatório de impacto.
- Auditoria integral, preservação digital, sustentabilidade e parametrização por UF.

## Política de avanço

Fases podem se sobrepor por squad, mas um recurso não é anunciado como entregue sem:

1. código integrado e revisado;
2. dados oficiais e licenciados;
3. operação monitorada;
4. testes e critérios de aceite verdes;
5. responsável nominal e plano de sustentação.

