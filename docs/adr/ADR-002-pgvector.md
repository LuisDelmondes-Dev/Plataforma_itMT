# ADR-002 — pgvector como banco vetorial inicial

**Status:** Aceita tecnicamente  
**Data:** 15/08/2026

## Contexto

O RAG precisa combinar busca textual e vetorial, mantendo versão, licença, hash e
decisão humana junto do documento.

## Decisão

Usar PostgreSQL 16 com pgvector e fusão híbrida RRF. Quando extensão ou provedor
de embeddings estiver indisponível, responder explicitamente em modo lexical.

## Alternativas

Qdrant e Weaviate permanecem alternativas caso medições comprovem necessidade de
escala independente.

## Consequências e riscos

Simplifica operação e consistência transacional. Requer índices, monitoramento de
latência/recall e plano de migração se o volume superar a capacidade medida.

