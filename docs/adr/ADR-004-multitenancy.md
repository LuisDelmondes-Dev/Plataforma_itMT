# ADR-004 — Multitenancy por linha e RLS

**Status:** Proposta — bloqueia F4  
**Data:** 15/08/2026

## Contexto

A F4 exige isolamento entre organizações em UI, API, banco, storage, jobs e
cache. O repositório possui desde a migração 24 o control plane e uma primeira
fatia tenant-owned com RLS. O modelo ainda não cobre todos os domínios privados.

## Decisão proposta

Usar `tenant_id` e `organization_id` obrigatórios nos agregados tenant-owned,
FKs compostas e Row Level Security `FORCE` no PostgreSQL, propagando contexto
assinado e revalidado pela API. Storage, jobs e cache devem incluir ambos os
identificadores na chave e negar contexto ausente.

## Alternativas

- schema por tenant: isolamento maior, operação e migração mais complexas;
- banco por tenant: isolamento máximo, custo operacional incompatível com o estágio.

## Consequências e riscos

RLS incorreta pode causar vazamento transversal. A decisão só se torna `Aceita`
após threat model e testes `Tenant A → Tenant B = DENIED` em todas as camadas.
