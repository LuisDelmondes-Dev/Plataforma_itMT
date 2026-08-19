# GAUNTLET-20260815-F1-HARNESS

**Ciclo:** 1  
**Fase:** F0/F1  
**Requisito:** F0-R005–R008; suporte ao gate F1  
**Objetivo:** restaurar uma regressão que reportava `404` no gate público F1.  
**Referência:** `api/test/e2e.mjs` e endpoint
`GET /v1/transparencia/lancamento-f1`.

## Build e execução

- API compilou.
- 23 migrações foram aplicadas em `itmt_test`.
- Reprodução original: 11/12 testes; endpoint esperado 200 reportado como 404.
- Execução manual da API recém-compilada: endpoint respondeu 200 e 12 itens.

## Crítica e ataque

Um processo antigo ocupava a porta fixa `3901`. O processo filho do teste morria
por colisão, mas o readiness probe aceitava o healthcheck do processo alheio. O
teste então consultava uma versão antiga da API.

**GAP-001 — P1:** harness podia conectar a qualquer serviço que ocupasse a porta.

## Correção

- porta isolada derivada do PID, com `TEST_PORT` opcional para depuração;
- detecção de encerramento prematuro do processo filho durante readiness.

## Regressão e evidência

`TEST_FILES=test/e2e.mjs npm test`:

- 12 testes aprovados;
- 0 falhas;
- cadeia de auditoria: 18 eventos íntegros;
- banco descartável removido automaticamente.

**Resultado:** PASS.  
**Risco residual:** as demais suítes ainda usam portas fixas e devem adotar o
mesmo helper de isolamento em Gauntlet posterior.

