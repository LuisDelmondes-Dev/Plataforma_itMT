# ADR-006 — Object storage S3 compatível e WORM no Bronze

**Status:** Proposta — contratação externa pendente  
**Data:** 15/08/2026

## Contexto

Documentos, mídias, rasters, nuvens de pontos e dados Bronze não podem depender
do filesystem efêmero da API. A proveniência exige retenção por hash e versão.

## Decisão proposta

Adotar API S3 compatível em região brasileira, com criptografia por KMS,
versionamento, lifecycle e Object Lock/WORM para Bronze e evidências. A aplicação
usa URLs assinadas e nunca expõe credenciais de storage ao frontend.

## Alternativas

Filesystem compartilhado foi rejeitado para produção por ser ponto único de
falha. Storage proprietário só é aceitável com exportação verificável.

## Consequências e riscos

Exige classificação, retenção, rotação de chaves, teste de restore e replicação
independente. O volume local permanece apenas para desenvolvimento.

