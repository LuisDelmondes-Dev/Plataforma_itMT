# ADR-007 — Fila durável e semântica de retry

**Status:** Proposta  
**Data:** 15/08/2026

## Contexto

OCR, embeddings, ingestão, GIS e mídia são trabalhos longos. Loops com `sleep` e
filas somente no banco não cobrem todos os requisitos de escala e recuperação.

## Decisão proposta

Adotar fila durável com entrega ao menos uma vez, chave idempotente, backoff com
jitter, limite de tentativas, dead-letter queue e correlação observável. O banco
continua sendo a fonte do estado de negócio, não a fila.

## Alternativas

PostgreSQL `SKIP LOCKED` permanece válido no volume atual. Serviço gerenciado ou
broker aberto será escolhido por benchmark e capacidade operacional.

## Consequências e riscos

Consumidores precisam ser idempotentes. Poison messages devem ser isoladas e
reprocessadas somente por ação auditada.

