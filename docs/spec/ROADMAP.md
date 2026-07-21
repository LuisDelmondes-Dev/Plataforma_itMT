# ROADMAP.md — Roadmap por Fases

> Marcos derivados do PRD. Prazos ⚠️ a validar com proponentes (orçamento/equipe).

## Fase 0 — Planejamento e Fundação
**Objetivo:** preparar bases técnicas e de dados.
- Documentação (PRD + docs técnicos deste pacote).
- Protótipo navegável (UX).
- Definição de arquitetura e ADRs.
- Modelagem de dados.
- Ambiente (nuvem, CI/CD, observabilidade).
- Definição do catálogo de agentes e política de roteamento de IA.
- Mapeamento de fontes e convênios iniciais (DATA_SOURCES.md).
- **Marco:** arquitetura aprovada + ambiente provisionado + fontes do MVP definidas.

## Fase 1 — MVP
**Objetivo:** provar a proposta de valor central.
- Login; upload de documentos com OCR.
- Chat inteligente (texto/áudio) com Xingú.
- Orquestrador básico + agentes essenciais.
- Base de dados inicial + RAG (busca semântica com fontes).
- Relatórios simples (PDF/planilha).
- Mapas básicos por recorte.
- Rastreabilidade/auditoria básica.
- **Marco:** responde ao caso de referência (estrada vicinal) com fonte + oferta de relatório.

## Fase 2 — Plataforma Operacional
**Objetivo:** operação ampla e integrada.
- Dashboards; mapas/GIS avançados.
- APIs e integrações com fontes externas.
- Multiagente avançado.
- Auditoria completa.
- Gestão de usuários/tenants.
- Ingestão contínua automatizada.
- Taxonomia completa (17 temas) (TAXONOMY.md).
- **Marco:** atualização contínua de dados + 17 temas navegáveis.

## Fase 3 — Inteligência Avançada
**Objetivo:** análise avançada e dados próprios.
- IA preditiva (análise preditiva ✅).
- Voz aprimorada; automação de workflows; agentes autônomos.
- Geração avançada de relatórios; validação cruzada.
- Banco de imagens MT Imagens.
- Pesquisa domiciliar (app de agentes de saúde) ✅.
- Street View 360º/8K dos 103 municípios faltantes.
- **Marco:** cobertura de mapeamento ampliada + coleta de campo ativa.

## Fase 4 — Escala SaaS
**Objetivo:** escala comercial e enterprise.
- Marketplace de agentes.
- Gestão de planos/billing.
- Multitenant completo; alta disponibilidade.
- Observabilidade avançada; operação enterprise.
- **Marco:** meta estratégica — entre os 10 endereços virtuais mais acessados do Estado ✅.

## Dependências críticas
- Disponibilidade/convênios de fontes de dados (impacta Fase 1–2).
- Decisão sobre a Xingú (ADR-001) — impacta custo e cronograma de todas as fases.
- Definições LGPD (impacta coleta domiciliar e dados cedidos).
