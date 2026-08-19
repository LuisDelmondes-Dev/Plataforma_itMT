# Arquitetura-alvo de produção

## Topologia

- **Borda:** DNS, WAF, CDN, TLS e rate limit.
- **Aplicação:** Next.js e API NestJS sem estado, escaláveis horizontalmente.
- **Dados transacionais:** PostgreSQL 16; PostGIS e pgvector entram por ADR e piloto.
- **Arquivos:** object storage S3 compatível em região brasileira; versionamento e WORM no Bronze.
- **Assíncrono:** fila durável para ingestão, OCR, embeddings, GIS e mídia.
- **GIS:** PostGIS, GeoServer e MapLibre; Cesium/3D Tiles na F3.
- **IA:** gateway multiprovedor, políticas por classificação, budgets e fallback léxico.
- **Observabilidade:** OpenTelemetry, métricas, logs estruturados, traces, SIEM e status page.

## Ambientes

| Ambiente | Dados | Acesso | Regra |
|---|---|---|---|
| Desenvolvimento | sintéticos | equipe | nunca recebe dado pessoal real |
| Teste | fixtures descartáveis | CI | banco `_test` recriado em cada execução |
| Homologação | amostra anonimizada | convidados | mesmas políticas de produção |
| Produção | oficial | perfis autorizados | demo e caminhos de teste bloqueiam startup |

## SLOs e continuidade

- F1: API factual P95 ≤2 s; chat factual P95 ≤5 s.
- F4: disponibilidade mensal ≥99,9%, RPO ≤15 min e RTO ≤2 h.
- Backup diário completo, incremental conforme capacidade e restauração trimestral.
- Deploy progressivo com health checks, feature flags e rollback automatizado.

## Classificação e soberania

- Público, interno, restrito e dado pessoal/sensível.
- Modelos externos não recebem conteúdo restrito ou pessoal sem decisão formal.
- Toda mídia publicada preserva cópia soberana, licença, consentimento e derivados.
- Dados factuais preservam fonte, versão, referência, extração, licença e hash.

## ADRs obrigatórios antes da F2

1. PostGIS/pgvector no cluster principal ou serviços separados.
2. Provedor de object storage e política WORM.
3. Tecnologia de fila e semântica de retry/idempotência.
4. IdP OIDC institucional e política de MFA.
5. GeoServer/Cesium e formatos duráveis.
6. Gateway de IA, provedores permitidos e classificação de dados.

