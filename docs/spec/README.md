# Especificação F0 — Plataforma ITMT

Este diretório versiona a **especificação de produto (F0)** da Plataforma ITMT —
PRD, catálogo de agentes, arquitetura-alvo, roadmap e critérios de aceite.
Antes vivia fora do repositório (`itmt-docs`); foi trazido para cá para alinhar
código e especificação e destravar rastreabilidade.

## Leitura importante: spec × código

O código deste repositório é uma **prova de arquitetura executável** — um
subconjunto **deliberadamente estreito e seguro** do que a especificação
descreve. Onde o código diverge do spec, a divergência é **intencional e mais
rigorosa**, não uma pendência:

- **Números nunca vêm do LLM** (RG-03 / auditor A06 com veto absoluto). O spec
  fala em "anti-alucinação"; o código é mais estrito: o motor determinístico é
  a única fonte de valores numéricos, e o LLM só narra.
- **Publicação é sempre ato humano** (RG-09). Nenhum agente auto-publica
  indicador — a Validação Técnica produz *dossiê*, não decisão.
- **Léxico como rede** (RG-05): sem crédito de LLM, a Xingú degrada para
  interpretação léxica em vez de falhar.

## Duas taxonomias de "agente" (não confundir)

1. **Catálogo de 16 agentes-especialistas** — [AGENTS.md](AGENTS.md), o roster
   de produto; autoritativo para "quais agentes devem existir".
2. **Numeração interna A01–A15** da IA Xingú — decomposição de implementação no
   código (`api/src/xingu`). Buracos na numeração (A07–A10, A13) nunca foram
   agentes prometidos.

## Índice

| Documento | Conteúdo |
|---|---|
| [PRD.md](PRD.md) | Requisitos de produto (fonte primária) |
| [AGENTS.md](AGENTS.md) | Catálogo dos 16 agentes-especialistas |
| [AI_ORCHESTRATOR.md](AI_ORCHESTRATOR.md) | Orquestrador multiagente (IA Xingú) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arquitetura-alvo e decisões (ADRs) |
| [ROADMAP.md](ROADMAP.md) / [BACKLOG.md](BACKLOG.md) | Fases e histórias |
| [MVP.md](MVP.md) / [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) | Recorte MVP e critérios |
| [DATABASE.md](DATABASE.md) / [API.md](API.md) | Modelo de dados e contratos |
| [DATA_SOURCES.md](DATA_SOURCES.md) / [TAXONOMY.md](TAXONOMY.md) | Fontes e taxonomia de temas |
| [GIS_PIPELINE.md](GIS_PIPELINE.md) | Pipeline geoespacial |
| [SECURITY_LGPD.md](SECURITY_LGPD.md) | Segurança e LGPD |
| [UI_UX.md](UI_UX.md) / [USER_FLOWS.md](USER_FLOWS.md) | UX e fluxos |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Implantação |
