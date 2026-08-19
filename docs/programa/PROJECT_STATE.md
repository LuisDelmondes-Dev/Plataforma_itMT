# Estado técnico do projeto

Baseline inspecionado em 15/08/2026.

```text
STACK: monorepo TypeScript/JavaScript, Python e SQL
FRONTEND: Next.js 16, React 19, App Router
BACKEND: NestJS 10, motor determinístico modular
DATABASE: PostgreSQL 16 + pgvector, driver pg, migrações SQL manuais
AUTH: login próprio com scrypt e sessão HMAC; OIDC/MFA institucional pendente
AUTHORIZATION: RBAC + contexto tenant assinado/RLS na primeira fatia; OIDC e migração integral pendentes
AI: Xingú, Anthropic/OpenAI em cascata, contratos A01, fallback léxico, auditor de números e golden set
GIS: OGC API Features, GeoJSON, GeoServer opcional; camadas reais pendentes
STORAGE: volume documental local/Compose; object storage produtivo pendente
DATA PIPELINES: Bronze/Prata/Ouro, drift, quarentena, conectores IBGE/CNES/INEP
CI/CD: CI com E2E, audit, SBOM, Gitleaks e CodeQL; CD institucional pendente
TESTS: 110 testes node:test; 26 migrações; banco descartável; cobertura por requisito parcial
OBSERVABILITY: health, métricas Prometheus e auditoria; tracing/alertas pendentes
DEPLOY: Compose com migrador, rede privada e proxy TLS; nuvem real não homologada
DOCUMENTATION: PRD, specs, ADRs, 255 requisitos, ledger e gates F0–F7
```

## Fase corrente

A primeira fase não aprovada é F0. O primeiro gap documental F0-R003 recebeu
ADRs formais, mas ADR-004/005 permanecem propostas. O Gauntlet atual trata os P0
de deploy produtivo encontrados pelo Architect/Security Critic.
