# ADR-004 — Multitenancy por linha e RLS

**Status:** Aceita em 22/08/2026 (decisão do mantenedor Luis Delmondes)  
**Data:** 15/08/2026

> **Registro do aceite.** A condição de aceite definida abaixo — *threat model e
> testes `Tenant A → Tenant B = DENIED` em todas as camadas* — está satisfeita:
> EV-20260815-018/019/020/021 e EV-20260815-024 provaram DENIED em API, banco,
> pool, storage, jobs, cache e UI (RLS `ENABLE+FORCE`, `USING+WITH CHECK`, FKs
> compostas, `itmt_app` sem owner/BYPASSRLS), e EV-20260822-044 colocou as
> suítes de menor privilégio e de expand tenant — que estavam fora do runner —
> em execução a cada push no CI. Escopo do aceite: o desenho técnico desta ADR;
> a operação SaaS em escala (IdP, billing, SLA) permanece externa (gate F4).

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
