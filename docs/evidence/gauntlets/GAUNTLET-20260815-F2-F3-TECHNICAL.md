# Gauntlet técnico F2/F3 — 15/08/2026

## Escopo

- F2-R039 e F2-R043–R047: falha observável de refresh e avaliação RAG.
- F3-R001: gateway Anthropic/OpenAI com cascata.
- F3-R012: manifest, service worker e recarga offline da PWA.

## Spec Lock

1. Um corpus nunca pode afrouxar os limiares normativos do programa.
2. Baixa `precision@5` reprova o gate mesmo com recall e demais métricas aprovadas.
3. API de fontes indisponível ou qualquer atualização malsucedida produz `ok=false` e exit code não-zero.
4. O último resumo do refresh deve sobreviver ao processo de rotina.
5. Cada provedor LLM deve obedecer seu contrato HTTP e registrar tokens por requisição; falha do primeiro aciona o segundo.
6. A PWA deve publicar manifest válido, registrar um service worker restrito ao mesmo origin e recarregar `/campo` sem rede.
7. Respostas `/api`, conteúdo autenticado de curadoria e requisições não-GET não podem entrar no cache do service worker.

## Red → Green

- O teste adversarial de baixa precisão foi executado antes da correção e falhou: o avaliador retornava sucesso com `precision@5=0,2`.
- Após adicionar `precision_5_min=0,8`, composição restritiva de limiares e a métrica à conjunção, `f2-gates.unit.mjs` passou 5/5.
- O teste do refresh inicialmente falhou porque o script não exportava runner e escondia falhas; após refatoração, passou 3/3.
- Os contratos de provedor passaram 4/4 após build NestJS.
- O build Next.js gerou 14 artefatos, inclusive `/manifest.webmanifest`.

## Ataques e resultados

| Ataque | Resultado esperado | Resultado |
|---|---|---|
| Corpus define `precision_5_min: 0` | manter 0,8 e reprovar | PASS |
| Alucinação, suporte fora do contexto e citação incorreta | métricas zero e reprovação | PASS |
| API de fontes lança `ECONNREFUSED` | `API_INDISPONIVEL`, falha | PASS |
| Uma fonte em dia e outra sem sucesso | resumo parcial, falha | PASS |
| Anthropic retorna 503 | cascata tenta OpenAI/segundo membro | PASS |
| Todos os provedores falham | rejeição; Xingú pode degradar no nível superior | PASS |
| Browser fica offline e recarrega `/campo` | documento permanece disponível | PASS |
| Navegação offline dispara prefetch de rotas | prefetch do menu foi desativado; nenhum erro de rede novo | PASS |

## Evidência reproduzível

```powershell
cd api
node --test test/f2-gates.unit.mjs
node --test test/refrescar-fontes.unit.mjs
npm run build
node --test test/xingu-provedores.unit.mjs

cd ..\web
npm run build
```

O ensaio Playwright confirmou `manifest.status=200`, service worker `activated`, página controlada após reload e `/campo` renderizada offline com título e `h1`.

## Limites honestos

- F2-R043–R047 seguem `BLOCKED_EXTERNAL` para medição real até existir corpus homologado.
- A operação contínua das fontes ainda requer ambiente, alert manager e responsável operacional.
- O gateway não foi homologado com credenciais/SLAs reais dos provedores.
- PWA instalável e app shell não equivalem a fila de campo robusta: IndexedDB, idempotência, isolamento, criptografia e formulários versionados continuam pendentes.
