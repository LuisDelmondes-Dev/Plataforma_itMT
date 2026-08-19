# ADR-005 — Nuvem em região brasileira, portabilidade e cópia soberana

**Status:** Proposta — decisão institucional externa pendente  
**Data:** 15/08/2026

## Contexto

Dados públicos, documentos, mídias e coletas podem exigir residência nacional,
continuidade e preservação de longo prazo.

## Decisão proposta

Executar workloads e dados primários em região brasileira; usar PostgreSQL,
S3-compatible storage, OCI containers e formatos abertos; manter cópia soberana
verificável, criptografada e independente do provedor principal.

## Alternativas

Nuvem privada ou híbrida são aceitáveis se cumprirem SLO, segurança, custo,
portabilidade e residência. Uma única cópia no mesmo provedor não atende soberania.

## Consequências e riscos

Exige contratação, classificação de dados, KMS, testes de restore, inventário de
egress e verificação periódica de hashes. A implementação permanece
`BLOCKED_EXTERNAL` até provedor e responsáveis serem formalmente definidos.

