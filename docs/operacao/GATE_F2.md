# Gate de encerramento — Fase 2

## Estado em 12/08/2026

O gate técnico de dados foi atingido no ambiente local: 9 temas, 67 indicadores com
observações oficiais, 142 municípios e 11.079 observações não demonstrativas. A carga
adicional usa 51 séries municipais do IBGE/SIDRA e mantém os novos indicadores em
`EM_ANALISE`, conforme RG-09.

O encerramento institucional da Fase 2 permanece bloqueado até existirem, simultaneamente:

1. pareceres humanos favoráveis que publiquem pelo menos 50 indicadores em 8 temas;
2. corpus real de pelo menos 20 documentos e 30 consultas, com responsável e data de
   homologação, aprovado pelos limiares de OCR/RAG;
3. responsável nominal da fase e homologação da operação monitorada.

Esses três itens são atos de governança e operação. Não podem ser preenchidos por fixture,
token de desenvolvimento ou aprovação automática.

Os limiares normativos são `CER <= 0,05`, `WER <= 0,10`, `recall@5 >= 0,80`,
`precision@5 >= 0,80`, `nDCG@5 >= 0,75`, `faithfulness >= 0,95`,
`groundedness >= 0,95` e correção de citações `>= 0,95`. Um corpus pode exigir
valores mais rigorosos, mas o avaliador não aceita redução desses patamares.

## Comandos reproduzíveis

```powershell
cd api
npm run ingest:f2:ibge
npm run avaliar:f2:documentos -- .\evaluation\f2\corpus-homologado.json --saida .\evaluation\f2\resultado-homologado.json
$env:F2_RESPONSAVEL_NOMINAL='nome e função do responsável'
$env:F2_OPERACAO_HOMOLOGADA='1'
node scripts/auditar-f2.mjs --gate
```

O último comando retorna código zero somente quando dados técnicos, publicação humana,
avaliação documental, responsável nominal e operação homologada estiverem comprovados.

## Evidências implementadas

- pipeline Bronze/Prata/Ouro, hash SHA-256, drift, quarentena e promoção em lote;
- catálogo documental, upload seguro, antivírus, extração, revisão humana, pgvector e
  busca híbrida com citações;
- avaliador de corpus com CER, WER, recall@5, precision@5, nDCG@5,
  faithfulness, groundedness e correção de citações;
- métricas Prometheus em `/v1/metrics`;
- contrato OpenAPI 3.1 em `/v1/openapi.json`;
- OGC API Features em `/v1/ogc`;
- API de parceiros com chaves hasheadas, escopos, quotas atômicas e revogação.
