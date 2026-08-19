# Curadoria documental — Fase 2

## Estado da entrega

Esta capacidade está em **protótipo validado localmente**. Ela oferece catálogo público,
upload autenticado em quarentena, antivírus, processamento assíncrono com retentativas,
extração de texto, fila de revisão humana, embeddings versionados, publicação e busca
híbrida com citação da versão, licença e hash SHA-256.

Não deve ser comunicada como OCR/RAG operacional em produção. Ainda faltam homologação
do armazenamento e do ClamAV, avaliação de OCR em corpus real,
avaliação de relevância da busca e operação continuada da infraestrutura vetorial.

## Fluxo

1. Parceiro, universidade, curador ou administrador abre `/biblioteca/curadoria` e envia
   um arquivo de até 15 MB.
2. A API valida MIME e assinatura mínima, grava o arquivo por hash, cria o documento como
   `EM_ANALISE` e agenda `SCAN_EXTRAIR`; a requisição não executa OCR.
3. O worker reivindica tarefas com `FOR UPDATE SKIP LOCKED`, envia o conteúdo ao ClamAV e
   só extrai arquivos limpos. TXT, Markdown, CSV e JSON usam extração nativa; PDF usa
   `pdftotext`; imagens usam Tesseract em português.
4. Arquivo infectado é rejeitado. Aprovação também é bloqueada no banco enquanto antivírus
   e extração não estiverem concluídos.
5. Nenhum upload aparece no catálogo público sem parecer humano. Curador ou administrador
   confere fonte, licença e conteúdo, registra justificativa e
   aprova ou rejeita uma única vez.
6. A aprovação cria trechos pesquisáveis, publica a versão e agenda embeddings. A busca usa
   fusão RRF lexical + vetorial quando `pgvector` e o provedor estão disponíveis; caso
   contrário, responde explicitamente em modo lexical.

## Runtime

- `DOCUMENTOS_STORAGE_ROOT` define o diretório de objetos.
- `DOCUMENTOS_WORKER=1` ativa o consumidor contínuo; o painel também permite processamento
  manual controlado para operação e testes.
- `CLAMAV_HOST` e `CLAMAV_PORT` apontam para o daemon via protocolo INSTREAM.
- `EMBEDDINGS_PROVIDER=openai-compatible`, `EMBEDDINGS_URL`, `EMBEDDINGS_MODEL` e
  `EMBEDDINGS_API_KEY` configuram o provedor; sem provedor, a busca lexical permanece ativa.
- O Docker da API instala `poppler-utils`, `tesseract-ocr` e `tesseract-ocr-por`.
- O Compose monta o volume persistente `documentos`, executa ClamAV e usa PostgreSQL 16 com
  `pgvector`.
- Formatos aceitos: TXT, Markdown, CSV, JSON, PDF, PNG, JPEG e WebP.

## Gates já automatizados

- upload anônimo recebe `403`;
- upload nasce `EM_ANALISE` e arquivo não pode ser aberto publicamente;
- aprovação antes da liberação do antivírus e da extração é recusada;
- worker processa quarentena e extração fora da transação de reivindicação;
- arquivo marcado como contaminado é rejeitado e não entra no catálogo;
- aprovação cria trechos e embeddings versionados e conserva versão, licença e hash;
- busca informa se operou em modo híbrido ou em fallback lexical;
- decisão humana não pode ser reescrita;
- cadeia de auditoria continua íntegra.

## Próximos gates para operação

- object storage S3 compatível com URL assinada;
- alertas e fila de descarte definitivo (métricas Prometheus já estão em `/v1/metrics`);
- corpus homologado por tipo de documento; o avaliador CER/WER/recall@5/precision@5/nDCG@5,
  faithfulness, groundedness e correção de citações
  está disponível em `npm run avaliar:f2:documentos`;
- citações por página/coordenada para PDFs e imagens;
- política de retenção, descarte e classificação LGPD homologada.
