# ITMT ENGINEERING PROTOCOL

## Regra central

Nenhuma tarefa está concluída apenas porque o código foi escrito.

Toda alteração crítica deve seguir:

```text
SPEC
→ DOMAIN
→ CONTRACT
→ TEST
→ IMPLEMENT
→ RUN
→ CRITIC
→ ATTACK
→ FIX
→ REGRESSION
→ EVIDENCE
→ GATE
```

## Regras permanentes

- Ler este arquivo, `docs/requirements`, `docs/evidence/ledger.md` e `docs/gates`
  antes de retomar um Gauntlet existente.
- Não modificar código crítico sem compreender e caracterizar o fluxo existente.
- Usar Characterization Tests quando houver código legado sem cobertura.
- Para regras de domínio, preferir TDD; para comportamento de usuário, BDD.
- Para APIs, usar Contract-First; para banco, Schema/Data Contracts.
- Para IA, usar Eval-Driven Development, contratos de agentes e fallback
  determinístico.
- Toda tarefa crítica passa por Gauntlet Loop e regressão proporcional ao risco.
- P0 bloqueia aprovação. P1 bloqueia quando viola requisito obrigatório ou gate.
- Toda entrega deve possuir evidência verificável; afirmação do implementador não é
  evidência suficiente.
- Separar `SOFTWARE_GATE` de `OPERATIONAL_GATE` e marcar dependências do mundo real
  como `BLOCKED_EXTERNAL`.
- Produção nunca pode exibir dados `DEMO` como dados oficiais.
- Tenant A nunca pode acessar recursos do Tenant B em UI, API, banco, storage,
  jobs ou cache.
- Nunca expor service role, tokens ou segredos no frontend, logs ou repositório.
- Números apresentados pela Xingú vêm do motor determinístico, nunca do LLM.
- Publicação de indicadores, documentos e direitos exige decisão humana conforme
  RG-09.
- Ausência de dado deve ser explícita; nunca estimar silenciosamente.
- Vetos críticos de publicação permanecem no banco quando essa for a proteção mais
  forte.
- Auditoria é INSERT-ONLY e encadeada; nenhuma alteração pode enfraquecê-la.
- Toda tabela nova deve conceder privilégios mínimos ao papel `itmt_app` no mesmo
  arquivo de migração.
- Não introduzir ORM: o projeto usa `pg` e migrações SQL versionadas.
- Não executar comandos destrutivos sem necessidade, alvo validado e autorização
  explícita quando aplicável.
- Preservar alterações existentes do usuário e evitar refatorações não relacionadas.

## Estados e gates

Use os estados:

```text
NOT_STARTED → DISCOVERED → SPECIFIED → PLANNED → IN_DEVELOPMENT
→ IMPLEMENTED → TESTED → VALIDATED → EVIDENCED → GATE_APPROVED
```

Estados alternativos: `BLOCKED_EXTERNAL`, `BLOCKED_TECHNICAL`, `DEFERRED`,
`REJECTED`, `LEGACY` e `NOT_APPLICABLE`.

Gates retornam somente `PASS`, `FAIL` ou `BLOCKED_EXTERNAL`. Uma fase só recebe
`PHASE_APPROVED` quando não há P0, a regressão crítica passa, o ledger está
atualizado e o Red Critic não encontra bloqueador.

## Evidência e rastreabilidade

- Todo requisito F0–F7 deve possuir ID `F{fase}-R{número}`.
- Manter requisito → spec → código → teste → evidência → gate.
- Não inventar evidência ou converter fixture em comprovação operacional.
- Registrar histórico dos Gauntlets, maior gap, correção, regressão e risco
  residual.
- Cobertura de implementação, testes, validação e evidência deve ser calculada
  separadamente.

## Invariantes de testes

- Testes de integração usam banco descartável cujo nome termina em `_test` ou
  `_teste`.
- Nunca apontar testes para banco de produção.
- Serviços iniciados pelos testes devem usar portas isoladas e ter teardown
  comprovado.
- E2E não substitui testes de domínio, contrato ou propriedades.

