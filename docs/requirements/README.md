# Requisitos rastreáveis F0–F7

Este diretório é a fonte de continuidade do ITMT Master Engineering Protocol.
O baseline inicial foi minerado do roadmap, PRD, código, testes e documentos em
15/08/2026.

## Ordem de retomada

1. ler [matriz de rastreabilidade](TRACEABILITY.md);
2. ler o [ledger de evidências](../evidence/ledger.md);
3. ler os [gates](../gates/README.md);
4. abrir o último registro em `docs/evidence/gauntlets/`;
5. continuar pelo primeiro requisito elegível que ainda não esteja
   `GATE_APPROVED`.

## Estados

O fluxo oficial é:

```text
NOT_STARTED → DISCOVERED → SPECIFIED → PLANNED → IN_DEVELOPMENT
→ IMPLEMENTED → TESTED → VALIDATED → EVIDENCED → GATE_APPROVED
```

Estados alternativos: `BLOCKED_EXTERNAL`, `BLOCKED_TECHNICAL`, `DEFERRED`,
`REJECTED`, `LEGACY` e `NOT_APPLICABLE`.

O baseline também usa `PARTIAL` e `IMPLEMENTED_NOT_VALIDATED` como classificações
de descoberta. Elas devem ser substituídas pelos estados oficiais quando o
Requirement Gauntlet correspondente for aberto.

## Contagem inicial

| Fase | Requisitos |
|---|---:|
| F0 | 26 |
| F1 | 46 |
| F2 | 47 |
| F3 | 36 |
| F4 | 26 |
| F5 | 19 |
| F6 | 20 |
| F7 | 35 |
| **Programa** | **255** |

## Regra sobre o nome F4

`db/06-f4.sql`, `db/07-seed-f4.sql`, `api/test/f4.e2e.mjs` e
`docs/F4-PROMPT-MESTRE.md` usam “F4” para o **Mapa de Direitos**. Essa capacidade
é um módulo de produto, mas não comprova a fase **F4 — Escala SaaS** deste
programa. Evidências não podem ser transferidas entre esses dois escopos.

