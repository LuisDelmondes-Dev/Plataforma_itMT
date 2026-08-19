# Classificação de dados multitenant

Data: 15/08/2026. Esta classificação é normativa para a migração F4.

## `GLOBAL_PUBLICA`

Território IBGE, consórcios, taxonomia, catálogo oficial publicado, fontes, cargas, indicadores, observações, direitos publicados e tabelas mestres. Esses dados não recebem owner organizacional nesta etapa; publicação continua protegida por RG-09.

## `IDENTITY_CONTROL_PLANE`

`Usuario`, `Tenant`, `Organizacao`, `OrganizacaoMembro`, `PlanoComercial` e `Assinatura`. Identidade é global; autorização vem da membership e do contexto assinado.

## `TENANT_OWNED`

| Domínio | Tabelas |
|---|---|
| Documentos/RAG | `Documento`, `DocumentoVersao`, `DocumentoTrecho`, `DocumentoRevisao`, `DocumentoTarefa`, `DocumentoEmbedding` |
| Integrações | `ApiCliente`, `ApiConsumoJanela`, `ContribuicaoDado` |
| IA e custos | `AgentExecution`, `ConsumoLlm` |
| GIS e campo | `ProjetoLevantamento`, `ProdutoGeografico`, `CapturaImagemRua`, `ProjetoEstruturante`, `TermoConsentimento`, `AtivoMidia`, `MissaoCampo`, `MissaoAutorizacao`, `CapturaCampo` |
| Control plane privado | `OrganizacaoConfiguracao`, `TenantJob` |

## Sequência expand/contract

1. `27-f4-tenant-expand-dominios.sql`: colunas, backfill, FK e índices, ainda compatível com serviços legados.
2. Dual-write em todas as bordas de criação e propagação imutável para filhos/jobs/storage.
3. Leitura/escrita exclusivamente por `withTenantTransaction`; publicação pública por contrato separado.
4. Validação de zero `NULL`, zero crossover e zero acesso sem contexto.
5. Contract: `NOT NULL`, FKs compostas pai-filho, `ENABLE + FORCE RLS`, `USING + WITH CHECK` e grants mínimos.

Atalhos proibidos: tenant vindo de header livre, valor default silencioso, `SET` fora de transação, papel runtime owner/BYPASSRLS e exceção administrativa na conexão normal.

