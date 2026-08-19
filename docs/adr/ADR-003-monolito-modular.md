# ADR-003 — Monólito modular no MVP

**Status:** Aceita tecnicamente  
**Data:** 15/08/2026

## Contexto

O produto possui muitos domínios, mas ainda não tem escala operacional que
justifique distribuição prematura.

## Decisão

Manter API NestJS modular e banco PostgreSQL compartilhado, com fronteiras por
módulo e contratos HTTP/SQL. Extrair serviços somente após métricas demonstrarem
necessidade de escala, isolamento ou ciclo de implantação independente.

## Consequências e riscos

Reduz complexidade de operação inicial. O acoplamento deve ser controlado por
fitness functions, testes de contrato e revisão de dependências entre módulos.

