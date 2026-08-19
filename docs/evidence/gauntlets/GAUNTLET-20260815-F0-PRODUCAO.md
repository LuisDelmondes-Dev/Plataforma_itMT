# GAUNTLET-20260815-F0-PRODUCAO

**Ciclo:** 2  
**Fase:** F0  
**Requisitos:** F0-R010–R017, F0-R025  
**Objetivo:** eliminar os quatro P0 reproduzíveis da topologia produtiva.  
**Referência:** fail-fast da API, least privilege, migrações idempotentes e
isolamento de rede.

## Gaps atacados

1. seeds demo herdados impediam bootstrap produtivo;
2. senha de `itmt_app` não era provisionada;
3. banco/API/web continuavam publicados pelo merge do Compose;
4. banco persistente não executava migrações pendentes.

## Implementação

- `migrator` executa migrações versionadas antes da API;
- preparação produtiva remove somente fixtures identificáveis, verifica inventário
  vazio e rotaciona `itmt_app`;
- `!reset`/`!override` removem portas e initdb herdados;
- Caddy é a única borda em 80/443, com TLS automático;
- redes separam backend interno e egress controlado;
- API só inicia após sucesso do migrador;
- `SESSION_SECRET` e senha inicial fortes passam a ser obrigatórios;
- token estático é recusado pelos guards em produção.

## Ataques e evidências

- dry-run produtivo em banco descartável detectou e tratou cinco categorias de
  fixture, com rollback deliberado;
- `docker compose ... config` confirmou que somente `proxy` publica portas;
- teste adversarial confirmou token estático aceito em teste e negado em produção;
- regressão API atualizada: 82/82, cadeia SHA-256 com 108 eventos;
- build do portal: PASS, TypeScript e 13 páginas;
- `scripts/gates/f0-gate.mjs` automatiza a fitness function da topologia.

## Resultado

**SOFTWARE_GATE:** PASS para os quatro P0.  
**OPERATIONAL_GATE:** BLOCKED_EXTERNAL até smoke deploy, DNS/certificado, nuvem,
KMS e homologação institucional.  
**Risco residual:** backup/restore, WAF, OIDC/MFA, observabilidade e CD ainda não
estão comprovados operacionalmente.
