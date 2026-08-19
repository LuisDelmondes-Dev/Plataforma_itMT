# Matriz de evidências do produto

Baseline técnico observado em 12/08/2026. O estado deve ser atualizado por release.

| Capacidade | Código | Dados reais | Operação | Aceite atual |
|---|---|---|---|---|
| Portal e consulta | implementado | parcial | desenvolvimento | build aprovado |
| Procedência/exportação | implementado | parcial | desenvolvimento | 56/56 no banco isolado |
| Xingú texto/voz | implementado | parcial | piloto | golden set e E2E parciais |
| 17 temas | catálogo integral | 9 temas e 67 indicadores com observações oficiais no baseline técnico; 14 aprovados | sem operação integral | gate técnico de volume aprovado; pareceres RG-09 pendentes |
| Seis recortes | motor implementado | consórcios incompletos | demo ocultada | parcial |
| GIS/Geoportal | catálogo e regras | objetos demo | sem storage/camadas reais | parcial |
| MT Imagens | catálogo e vetos | objetos demo | sem pipeline real | parcial |
| Campo offline | protótipo web | missões demo | sem campanha comprovada | parcial |
| OCR/RAG | quarentena, ClamAV, fila assíncrona, revisão, embeddings, busca híbrida/fallback, métricas e avaliador CER/WER/recall/nDCG | somente fixture de teste | desenvolvimento local | implementado; faltam corpus real e homologação operacional |
| API de parceiros | portal, chaves com hash, escopos, quotas atômicas, revogação e OpenAPI 3.1 | catálogo técnico ampliado | desenvolvimento local | implementado; faltam SLA, onboarding e homologação |
| GIS interoperável | OGC API Features com conformance e GeoJSON | projetos estruturantes do catálogo | desenvolvimento local | implementado e coberto por E2E; camadas reais dependem da operação GIS |
| Apps nativos | ausente | n/a | ausente | não iniciado |
| Segurança/auditoria | avançado | aplicável | produção não homologada | parcial |

## Regra de comunicação

Usar somente os estados `não iniciado`, `protótipo`, `implementado sem dados`,
`piloto`, `operacional` e `auditado`. “100%” só é permitido quando código, dados,
operação e aceite estiverem simultaneamente comprovados.
