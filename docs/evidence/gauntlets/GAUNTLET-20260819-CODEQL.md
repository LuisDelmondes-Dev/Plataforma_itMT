# Gauntlet — hardening dos alertas CodeQL do PR 1

Data: 19/08/2026

## Escopo e contratos

O gate externo de code scanning encontrou sete fluxos em quatro superfícies: derivação de API keys, tipos e acesso a arquivos do storage tenant, persistência Bronze e mensagens do service worker. A correção preserva os contratos de isolamento tenant, Bronze imutável, segredo exibido uma única vez e limpeza de cache privado.

## Critic e attack

- API key recebida por header não pode usar hash rápido sem segredo do servidor;
- valores HTTP que podem ser `string|string[]` devem falhar antes de operações de caminho;
- leitura e criação local não podem separar verificação do uso do arquivo;
- nome, destino, tipo e tamanho de conteúdo Bronze são validados antes da criação exclusiva;
- `PURGE_PRIVATE` vindo de outra origem não pode alcançar o cache.

## Correções

- derivação scrypt determinística com `API_KEY_PEPPER` obrigatório em produção;
- validação runtime de tipos e handles com `O_NOFOLLOW`, criação exclusiva e `fsync`;
- criação Bronze `O_EXCL`, limite configurável e namespace de arquivo restrito;
- verificação de `event.origin` no service worker;
- regressões adversariais incorporadas ao harness padrão.

## Evidência local

- `npm test`: 131/131, 40 migrações, cadeia íntegra com 124 eventos e teardown de `itmt_test`;
- `npm run build` no web: 17 páginas;
- `node scripts/gates/f0-gate.mjs`: PASS;
- `npm run test:restore`: PASS, 66 tabelas, restore em 1,761 s;
- audits API e web: 0 vulnerabilidades.

## Gate

SOFTWARE_GATE_LOCAL: PASS

CODE_SCANNING_REMOTE: PENDING — deve passar no commit do PR antes do merge.
