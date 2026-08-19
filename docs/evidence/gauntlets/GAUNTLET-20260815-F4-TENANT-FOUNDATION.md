# Gauntlet F4 — fundação multitenant

Data: 15/08/2026  
Escopo honesto: control plane e recurso `OrganizacaoConfiguracao`; não equivale ao isolamento integral da plataforma.

## Spec Lock

- Tenant e organização são entidades distintas, ainda que o bootstrap opere 1:1.
- Recursos privados carregam os dois UUIDs e FK composta.
- Contexto ausente nega; não existe tenant default.
- A API nunca usa tenant/org de header livre como autoridade.
- `SET LOCAL` ocorre somente dentro de transação e precisa desaparecer ao liberar a conexão.
- `itmt_app` não pode ser owner nem `BYPASSRLS`; toda policy possui `USING` e `WITH CHECK`.
- Token contextual inclui `uid/tid/oid/membershipVersion`; mudança/suspensão da membership invalida imediatamente.
- Path de outra organização retorna 404 e não enumera dados.

## Red → Green

O teste inicial falhou porque `Tenant` não existia. Após as migrações 24/25 e a borda contextual:

- `multitenancy.e2e.mjs`: 5/5;
- `tenant-context.e2e.mjs`: 5/5;
- regressão integral: 108/108, 26 migrações e cadeia de 110 eventos íntegra.

## Ataques

| Ataque | Defesa | Resultado |
|---|---|---|
| SELECT sem contexto | RLS fail-closed | zero linhas |
| INSERT sem contexto | `WITH CHECK` | SQLSTATE 42501 |
| contexto A consulta ID B | RLS + filtro explícito | zero linhas |
| contexto A insere B | `WITH CHECK` | SQLSTATE 42501 |
| filho usa tenant A + organização B | FK composta | SQLSTATE 23503 |
| mesma conexão A, sem contexto, B | `SET LOCAL` transacional | 1, 0, 1; sem bleed |
| token identidade acessa privado | TenantContextGuard | 401 |
| token A usa path B | comparação claim/path | 404 sem vazamento |
| membership suspensa/versionada | revalidação a cada requisição | 401 imediato |
| mesma chave lógica no cache A/B | namespace `v1:tid:oid` | valores independentes |
| A lê chave de objeto B/traversal | prefixo canônico + path validation | negado |
| job repetido na organização A | unique idempotency envelope | mesmo job |
| URL `/o/org-b` com sessão A | slug/context check antes do fetch | DENIED; zero request B |

## O que falta para o gate

- classificar e migrar todos os agregados privados existentes;
- substituir adapters/fatias UI, storage, jobs e cache em todos os domínios legados;
- testes IDOR em list/detail/search/export/bulk de cada domínio;
- migração de API clients, documentos, campo, mídia e execuções/custos;
- storage/IAM/IdP reais e homologação operacional;
- metas F4 de 99,9%, 200 indicadores e 60 municípios.

Decisão: `TECHNICAL_SLICE=PASS`; `F4_TECHNICAL_GATE=FAIL`; `OPERATIONAL_GATE=BLOCKED_EXTERNAL`.
