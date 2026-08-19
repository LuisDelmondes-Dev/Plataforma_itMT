# API para parceiros — Fase 2

## Estado

Capacidade em **protótipo validado localmente**. O portal `/integracoes` permite que
parceiros, universidades e administradores criem e revoguem credenciais próprias para a
API versionada. O segredo é exibido uma única vez; o banco armazena somente uma derivação
scrypt com `API_KEY_PEPPER` e um prefixo não secreto para identificação. Produção exige
pepper com pelo menos 32 caracteres; sua rotação invalida as chaves e requer reemissão
coordenada das credenciais.

Este estado não representa API comercial homologada. Ainda faltam contrato OpenAPI
publicado, SLA, processo formal de onboarding, alertas e política automatizada de retenção
dos agregados de consumo.

## Segurança e quotas

- autenticação por `X-API-Key` ou `Authorization: ApiKey <chave>`;
- formato do segredo: `itmt_live_<prefixo>_<segredo aleatório>`;
- escopos disponíveis: `catalogo:ler` e `indicadores:ler`;
- quotas independentes por minuto e por dia;
- cobrança transacional com bloqueio por credencial, evitando ultrapassagem sob chamadas
  concorrentes;
- revogação imediata e vinculada ao proprietário;
- criação e revogação registradas na cadeia de auditoria;
- a chave completa não deve ser usada em JavaScript do navegador, aplicativo distribuído
  ou repositório. O consumidor deve mantê-la no backend ou em cofre de segredos.

## Endpoints de gestão

Todos exigem token de sessão `PARCEIRO`, `UNIVERSIDADE` ou `ADMIN`:

- `POST /v1/parceiros/chaves` — cria a credencial e devolve o segredo uma única vez;
- `GET /v1/parceiros/chaves` — lista prefixo, estado, escopos, quotas e consumo do dia;
- `POST /v1/parceiros/chaves/:id/revogar` — bloqueia definitivamente a credencial.

## Endpoints de integração

- `GET /v1/integracoes/temas`;
- `GET /v1/integracoes/temas/:id/subtemas`;
- `GET /v1/integracoes/subtemas/:id/indicadores`;
- `GET /v1/integracoes/indicadores/:id/consulta?recorte=MUNICIPIO&codigo=5103403`.

Respostas autenticadas incluem:

- `X-RateLimit-Limit-Minute`;
- `X-RateLimit-Remaining-Minute`;
- `X-RateLimit-Limit-Day`;
- `X-RateLimit-Remaining-Day`.

Quota excedida responde `429`; chave ausente, expirada ou revogada responde `401`; escopo
insuficiente responde `403`.

## Exemplo

```bash
curl https://SEU_DOMINIO/v1/integracoes/temas \
  -H "X-API-Key: SUA_CHAVE"
```

## Gates automatizados

- anônimo não cria credencial;
- segredo aparece apenas na criação e nunca na listagem;
- duas chamadas concorrentes consomem a quota de forma atômica;
- saldo restante é retornado nos cabeçalhos;
- excedente recebe `429`;
- escopo insuficiente é bloqueado antes da consulta de domínio;
- credencial revogada deixa de funcionar imediatamente;
- cadeia de auditoria permanece íntegra.
