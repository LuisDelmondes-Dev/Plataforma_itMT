# Matriz de rastreabilidade — F4 a F7

> **Atualização do encerramento técnico:** este baseline precede as migrações
> 27–40 e as evidências EV-024–EV-036. Multitenancy dos domínios privados,
> least privilege, S3, offline cifrado, 3D Tiles, participação, restore, game
> days e portabilidade regional foram implementados depois. Para o status atual,
> use `docs/programa/EXECUCAO_COMPLETA_F0_F7.md` e os gates F4–F7.

Baseline estático levantado em 15/08/2026 a partir do protocolo mestre, do roadmap e do repositório. Esta matriz não representa aprovação de fase e não inventa evidências de runtime, operação ou aceite institucional.

## Conflito nominal da F4

Os arquivos `db/06-f4.sql`, `db/07-seed-f4.sql`, `api/test/f4.e2e.mjs` e `docs/F4-PROMPT-MESTRE.md` usam “F4” para o **Mapa de Direitos**. Eles não comprovam a **F4 — Escala SaaS** definida no roadmap. Nesta matriz, F4 significa exclusivamente Escala SaaS.

## Legenda

- `NOT_STARTED`: não foi localizada implementação.
- `SPECIFIED`: existe desenho ou documentação, sem implementação comprovada.
- `PROTOTYPE`: há código com dados/objetos demonstrativos, sem operação real.
- `IMPLEMENTED_NOT_VALIDATED`: há implementação local, mas falta validação operacional ou gate.
- `PARTIAL`: somente parte do requisito atômico está implementada.
- `BLOCKED_EXTERNAL`: depende de contratação, convênio, campanha, auditor independente ou decisão institucional.

### Evidências abreviadas

- `EV-ROAD`: `docs/programa/FASES_DE_DESENVOLVIMENTO.md`; `docs/programa/PLANO_DIRETOR_36_MESES.md`; `docs/spec/ROADMAP.md`.
- `EV-BASE`: `docs/programa/MATRIZ_EVIDENCIAS.md`; `docs/operacao/GATE_F2.md`.
- `EV-SAAS`: `docs/spec/PRD.md`; `docs/spec/DATABASE.md`; `docs/spec/ARCHITECTURE.md`; `docs/spec/BACKLOG.md`; `docs/spec/SECURITY_LGPD.md`.
- `EV-OPS`: `docs/programa/ARQUITETURA_PRODUCAO.md`; `docs/spec/DEPLOYMENT.md`; `docker-compose.prod.yml`.
- `EV-METRICS`: `api/src/interoperabilidade/interoperabilidade.controller.ts`; `api/test/interoperabilidade.e2e.mjs`.
- `EV-COST`: `db/10-custo.sql`; `api/src/xingu/custo.service.ts`; `api/src/xingu/xingu.controller.ts`.
- `EV-FIELD`: `db/04-f3.sql`; `api/src/producao/producao.controller.ts`; `api/src/producao/geo.controller.ts`; `web/app/campo/page.tsx`; `api/test/f3.e2e.mjs`.
- `EV-GIS`: `docs/spec/GIS_PIPELINE.md`; `web/app/geoportal/page.tsx`; `web/app/acervo/page.tsx`; `db/05-seed-f3.sql`.
- `EV-GOV`: `docs/programa/GOVERNANCA_RACI.md`; `docs/programa/PLANO_AQUISICOES.md`.
- `EV-DATA`: `api/src/common/procedencia.ts`; `api/src/indicadores/indicadores.service.ts`; `api/src/indicadores/exportacao.controller.ts`; `api/test/e2e.mjs`.
- `EV-AUDIT`: `db/08-seguranca.sql`; `api/src/auditoria/auditoria.service.ts`.
- `EV-AUTH`: `db/11-auth.sql`; `api/src/auth/`.
- `EV-API`: `api/src/interoperabilidade/interoperabilidade.controller.ts`; `api/src/parceiros/`; `docs/operacao/API_PARCEIROS_F2.md`.
- `EV-TENANT`: `db/24-f4-multitenancy-control-plane.sql`; `db/25-f4-contexto-identidade.sql`; `api/src/auth/tenant-context.guard.ts`; `api/test/multitenancy.e2e.mjs`; `api/test/tenant-context.e2e.mjs`.

## F4 — Escala SaaS

| ID | Título | Tipo | Dependências | Status baseline | Evidência | Gate |
|---|---|---|---|---|---|---|
| F4-R001 | Suportar multitenancy completo | SOFTWARE, DATA, SECURITY | identidade; modelo tenant; migrações | PARTIAL | EV-TENANT: control plane, membership, contexto assinado e RLS; domínios privados restantes ainda não migrados | Técnico F4 |
| F4-R002 | Isolar dados e recursos entre organizações | SECURITY, SOFTWARE, DATA | F4-R001 | PARTIAL | EV-TENANT prova configuração tenant-owned em API/DB; UI/storage/jobs/cache ainda ausentes | Isolamento |
| F4-R003 | Cadastrar planos comerciais | SOFTWARE, DATA | F4-R001 | IMPLEMENTED_NOT_VALIDATED | EV-TENANT: PlanoComercial e plano institucional; CRUD administrativo não implementado | Técnico F4 |
| F4-R004 | Aplicar limites por plano | SOFTWARE, SECURITY | F4-R003; medição de uso | PARTIAL | limites estruturados no plano e quotas API existentes; enforcement SaaS unificado ausente | Técnico F4 |
| F4-R005 | Implementar billing | SOFTWARE, EXTERNAL | F4-R003; provedor financeiro | NOT_STARTED | EV-SAAS | Técnico e operacional |
| F4-R006 | Gerenciar ciclo de assinaturas | SOFTWARE, DATA | F4-R003; F4-R005 | PARTIAL | EV-TENANT: schema/status/version da assinatura; ciclo e provedor de billing ausentes | Técnico F4 |
| F4-R007 | Disponibilizar aplicativos nativos após PWA | SOFTWARE | PWA F3 aprovada | NOT_STARTED | EV-BASE declara apps nativos ausentes | Técnico F4 |
| F4-R008 | Provar disponibilidade mensal mínima de 99,9% | INFRASTRUCTURE, SRE | deploy redundante; SLI/SLO | SPECIFIED | EV-OPS define SLO; compose não prova redundância/disponibilidade | Gate 99,9% |
| F4-R009 | Implantar observabilidade avançada | INFRASTRUCTURE, SRE | métricas; logs; traces; alertas | PARTIAL | EV-METRICS prova métricas básicas; tracing e SLO operacional não comprovados | Técnico F4 |
| F4-R010 | Implantar suporte operacional | OPERATIONAL, EXTERNAL | equipe; runbooks; SLA | BLOCKED_EXTERNAL | EV-ROAD; EV-GOV | Operacional F4 |
| F4-R011 | Implantar processo FinOps | OPERATIONAL, INFRASTRUCTURE | custos IA/infra; owners; orçamento | SPECIFIED | EV-ROAD; EV-OPS | Operacional F4 |
| F4-R012 | Medir e limitar custo de IA | SOFTWARE, AI, OPERATIONAL | telemetria de provedor | IMPLEMENTED_NOT_VALIDATED | EV-COST: ledger, tetos e fallback locais; sem homologação FinOps | Técnico F4 |
| F4-R013 | Medir e controlar custo de infraestrutura | INFRASTRUCTURE, OPERATIONAL | billing cloud; tags; budgets | NOT_STARTED | EV-ROAD; nenhuma integração de custo cloud localizada | Técnico e operacional |
| F4-R014 | Ampliar cobertura funcional e territorial | DATA, OPERATIONAL, EXTERNAL | fontes; convênios | BLOCKED_EXTERNAL | EV-BASE; EV-ROAD | Cobertura |
| F4-R015 | Ampliar fontes oficiais | DATA, EXTERNAL | convênios; licenças | BLOCKED_EXTERNAL | EV-BASE | Cobertura |
| F4-R016 | Ampliar integrações | SOFTWARE, DATA, EXTERNAL | APIs e credenciais externas | PARTIAL | EV-API comprova base de parceiros; expansão não homologada | Técnico e operacional |
| F4-R017 | Ampliar parcerias | INSTITUTIONAL, EXTERNAL | acordos formais | BLOCKED_EXTERNAL | EV-ROAD; EV-GOV | Operacional F4 |
| F4-R018 | Preparar marketplace de agentes plugáveis | SOFTWARE, AI, SECURITY | contratos; sandbox; permissões; billing | PARTIAL | executor possui contratos, allowlists, timeout/retry/fallback/log; sandbox, catálogo e billing ausentes | Técnico F4 |
| F4-R019 | Operar 200 indicadores | DATA, OPERATIONAL, EXTERNAL | pipelines; fontes; homologação | BLOCKED_EXTERNAL | EV-BASE: 67 com observações oficiais e 14 aprovados | Gate 200 |
| F4-R020 | Cobrir operacionalmente 60 municípios | DATA, OPERATIONAL | F4-R019; definição de cobertura | NOT_STARTED | 142 municípios cadastrados não comprovam 60 com cobertura F4 | Gate 60 |
| F4-R021 | Testar Tenant A→B na UI e exigir `DENIED` | SECURITY, TEST | F4-R001; F4-R002 | PARTIAL | Playwright: `/o/org-b` mostra DENIED sem request para B; prova usa fatia configuração e backend mockado | Isolamento |
| F4-R022 | Testar Tenant A→B na API e exigir `DENIED` | SECURITY, TEST | F4-R001; F4-R002 | PARTIAL | EV-TENANT: path B recebe 404 e não vaza configuração; demais domínios ainda não migrados | Isolamento |
| F4-R023 | Testar Tenant A→B no banco e exigir `DENIED` | SECURITY, TEST, DATA | F4-R001; F4-R002; RLS | PARTIAL | EV-TENANT: RLS FORCE/USING/WITH CHECK, FK composta e pool sem bleed; escopo atual é configuração | Isolamento |
| F4-R024 | Testar Tenant A→B no storage e exigir `DENIED` | SECURITY, TEST, INFRASTRUCTURE | storage tenant-aware | PARTIAL | adapter local canônico nega chave B/traversal e preserva hash; documentos legados/S3 pendentes | Isolamento |
| F4-R025 | Testar Tenant A→B em jobs e exigir `DENIED` | SECURITY, TEST | jobs tenant-aware | PARTIAL | TenantJob durável, envelope/FK/RLS/idempotência e path B negado; workers legados pendentes | Isolamento |
| F4-R026 | Testar Tenant A→B no cache e exigir `DENIED` | SECURITY, TEST | cache tenant-aware | PARTIAL | wrapper v1:tid:oid validado contra mesma chave/poisoning/invalidation; caches legados pendentes | Isolamento |

**Decisão F4:** `TECHNICAL_GATE=FAIL`; `OPERATIONAL_GATE=BLOCKED_EXTERNAL`. A fundação e uma fatia de isolamento API/DB estão comprovadas, mas o gate exige UI, todos os domínios, storage, jobs e cache, além de 99,9%, 200 indicadores e 60 municípios.

## F5 — Mapeamento estadual

| ID | Título | Tipo | Dependências | Status baseline | Evidência | Gate |
|---|---|---|---|---|---|---|
| F5-R001 | Instituir governança de campo | OPERATIONAL, INSTITUTIONAL | owners; comitê; processos | SPECIFIED | EV-GOV | Operacional F5 |
| F5-R002 | Gerenciar execução por lotes | SOFTWARE, OPERATIONAL | F5-R001; contratos | PROTOTYPE | EV-FIELD: missões, janelas, status e painel; sem lotes reais | Técnico e operacional |
| F5-R003 | Operar produtos GIS estaduais | GIS, DATA, INFRASTRUCTURE | storage; tiles; campo | PROTOTYPE | EV-GIS; EV-FIELD; seeds `s3://.../demo` | Técnico e operacional |
| F5-R004 | Operar levantamentos VANT | FIELD, GIS, EXTERNAL | aquisição; RT; autorizações | BLOCKED_EXTERNAL | EV-GOV; schema e vetos em EV-FIELD | Operacional |
| F5-R005 | Operar captura 360° | FIELD, GIS, EXTERNAL | equipamento; equipe; autorização | BLOCKED_EXTERNAL | EV-GIS; modelo existe, sem campanha real | Operacional |
| F5-R006 | Operar captura 8K | FIELD, EXTERNAL | equipamento; storage | BLOCKED_EXTERNAL | EV-GIS; sem ativo real comprovado | Operacional |
| F5-R007 | Operar acervo audiovisual estadual | SOFTWARE, DATA, FIELD | mídia; storage; direitos | PROTOTYPE | EV-FIELD; EV-GIS: publicação, consentimento, licença e moderação com dados demo | Técnico e operacional |
| F5-R008 | Priorizar áreas sem cobertura equivalente | GIS, OPERATIONAL | inventário de cobertura | SPECIFIED | `docs/spec/GIS_PIPELINE.md`; sem plano operacional comprovado | Operacional |
| F5-R009 | Produzir portfólios municipais | DATA, FIELD, OPERATIONAL | ativos reais | NOT_STARTED | EV-ROAD | Operacional |
| F5-R010 | Produzir pacotes municipais de evidência | DATA, GIS, OPERATIONAL | F5-R003 a F5-R009 | NOT_STARTED | EV-ROAD | Gate auditável |
| F5-R011 | Registrar situação do ativo | DATA, SOFTWARE | modelo de ativo | PARTIAL | EV-FIELD possui status distintos; não lifecycle F5 completo | Gate auditável |
| F5-R012 | Registrar data do ativo | DATA | modelo de ativo | IMPLEMENTED_NOT_VALIDATED | EV-FIELD: datas de voo, captura e consentimento | Gate auditável |
| F5-R013 | Registrar origem do ativo | DATA | modelo de ativo | PARTIAL | captura 360 tem origem; campo não uniforme | Gate auditável |
| F5-R014 | Registrar licença do ativo | DATA, LEGAL | curadoria; licenciamento | IMPLEMENTED_NOT_VALIDATED | EV-FIELD: licença obrigatória para mídia publicada | Gate auditável |
| F5-R015 | Registrar qualidade do ativo | DATA, GIS | QA/QC | PARTIAL | GSD, acurácia e checklist existem; contrato uniforme não | Gate auditável |
| F5-R016 | Registrar cobertura do ativo | DATA, GIS | geometria; medição | PARTIAL | cobertura de rua/km e polígonos de missão existem | Gate auditável |
| F5-R017 | Manter situação verificável dos 142 municípios | DATA, OPERATIONAL | F5-R001 a F5-R016 | PROTOTYPE | painel 4 frentes×municípios existe; missões e ativos são demo | Gate 142 |
| F5-R018 | Implementar contrato mínimo unificado do ativo | DATA, GIS, SOFTWARE | modelo; migração | PARTIAL | EV-FIELD: campos dispersos; faltam provider, processing, version e hash uniformes | Técnico F5 |
| F5-R019 | Implementar lifecycle oficial de mapeamento | SOFTWARE, DATA, OPERATIONAL | F5-R018 | NOT_STARTED | estados atuais diferem de `NOT_STARTED/PLANNED/CONTRACTED/IN_FIELD/PROCESSING/VALIDATING/PUBLISHED/PENDING/UNAVAILABLE` | Gate auditável |

**Decisão F5:** `SOFTWARE_PREPARATION=PARTIAL/PROTOTYPE`; `OPERATIONAL_GATE=BLOCKED_EXTERNAL`; o gate de 142 municípios não passa.

## F6 — Ecossistema científico

| ID | Título | Tipo | Dependências | Status baseline | Evidência | Gate |
|---|---|---|---|---|---|---|
| F6-R001 | Implantar portal científico | SOFTWARE | catálogo e dados F2–F5 | IMPLEMENTED_NOT_VALIDATED | `/ciencia` publica catálogo aprovado; ecossistema científico externo pendente | Técnico F6 |
| F6-R002 | Publicar catálogo DCAT | SOFTWARE, DATA | F6-R001; metadados | IMPLEMENTED_NOT_VALIDATED | endpoint JSON-LD `/v1/dcat`, testado sem conteúdo demo | Gate reprodução |
| F6-R003 | Publicar dados abertos | DATA, LEGAL | licenças; anonimização | PARTIAL | DCAT e CSV/XLSX/PDF; revisão jurídica/anonimização integral pendente | Gate reprodução |
| F6-R004 | Publicar metodologias | DATA, SCIENTIFIC | curadoria | PARTIAL | `docs/metodologias/`; biblioteca; cobertura não integral | Gate método |
| F6-R005 | Publicar versões | DATA | versionamento de datasets | PARTIAL | versões documentais existem; datasets científicos não comprovados | Gate reprodução |
| F6-R006 | Publicar proveniência | DATA | lineage | IMPLEMENTED_NOT_VALIDATED | EV-DATA prova quinteto para indicadores/exportações, não para todo dataset científico | Gate reprodução |
| F6-R007 | Publicar licenças | DATA, LEGAL | clearance jurídico | PARTIAL | licença de cada fonte é exposta no DCAT; clearance jurídico integral pendente | Gate reprodução |
| F6-R008 | Publicar artefatos de reprodução | SOFTWARE, DATA, SCIENTIFIC | código; ambiente; dataset versionado | IMPLEMENTED_NOT_VALIDATED | manifesto por dataset expõe fonte/hash/versão/transformação/código/distribuição; ambiente congelado/DOI pendentes | Gate reprodução |
| F6-R009 | Formalizar parceria com universidades | INSTITUTIONAL, EXTERNAL | convênio | BLOCKED_EXTERNAL | EV-ROAD; EV-GOV | Operacional F6 |
| F6-R010 | Formalizar parceria com instituições de pesquisa | INSTITUTIONAL, EXTERNAL | convênio | BLOCKED_EXTERNAL | EV-ROAD; EV-GOV | Operacional F6 |
| F6-R011 | Permitir avaliação independente | SCIENTIFIC, INSTITUTIONAL, EXTERNAL | F6-R001 a F6-R010 | BLOCKED_EXTERNAL | mecanismos e avaliadores ausentes | Gate método |
| F6-R012 | Permitir metodologias independentes | SCIENTIFIC, EXTERNAL | governança; publicação | BLOCKED_EXTERNAL | EV-ROAD | Gate método |
| F6-R013 | Implantar participação cidadã | SOFTWARE, OPERATIONAL, INSTITUTIONAL | moderação; LGPD | NOT_STARTED | EV-ROAD | Operacional F6 |
| F6-R014 | Implantar devolutiva à participação | SOFTWARE, OPERATIONAL | F6-R013 | NOT_STARTED | EV-ROAD | Operacional F6 |
| F6-R015 | Implantar observatório de impacto | SOFTWARE, DATA | métricas de impacto | NOT_STARTED | EV-ROAD | Técnico F6 |
| F6-R016 | Acompanhar uso público dos dados | SOFTWARE, DATA, OPERATIONAL | analytics; privacidade | NOT_STARTED | métricas técnicas não equivalem a impacto/uso público | Técnico F6 |
| F6-R017 | Ampliar APIs para pesquisadores | SOFTWARE, DATA | contratos EV-API | PARTIAL | API de parceiros existe; escopos são limitados | Técnico F6 |
| F6-R018 | Ampliar downloads para pesquisadores | SOFTWARE, DATA | datasets; licenças | PARTIAL | CSV/XLSX/PDF por indicador; datasets científicos ausentes | Técnico F6 |
| F6-R019 | Ampliar documentação para pesquisadores e parceiros | DOCUMENTATION, OPERATIONAL | F6-R017; F6-R018 | PARTIAL | OpenAPI/docs F2 existem; documentação científica não | Técnico F6 |
| F6-R020 | Garantir cadeia reprodutível completa | DATA, SOFTWARE, SCIENTIFIC | F6-R002 a F6-R008 | PARTIAL | cadeia completa é publicada e testada por dataset; validação científica independente e pacote de ambiente pendentes | Gate reprodução |

**Decisão F6:** `TECHNICAL_GATE=FAIL`; `INDEPENDENT_METHOD_EVALUATION=BLOCKED_EXTERNAL`; `REPRODUCIBLE_DATASETS=FAIL`.

## F7 — Consolidação

| ID | Título | Tipo | Dependências | Status baseline | Evidência | Gate |
|---|---|---|---|---|---|---|
| F7-R001 | Atingir 300 indicadores | DATA, EXTERNAL | fontes; pipelines; homologação | BLOCKED_EXTERNAL | EV-BASE: 67 com observações oficiais e 14 aprovados | Gate 300 |
| F7-R002 | Sustentar 300 indicadores ao longo do tempo | DATA, OPERATIONAL | F7-R001; owners; SLA; refresh | BLOCKED_EXTERNAL | sem operação permanente | Gate 300 |
| F7-R003 | Executar auditoria integral do programa | SECURITY, DATA, OPERATIONAL, EXTERNAL | F0–F7; evidências | BLOCKED_EXTERNAL | EV-AUDIT é auditoria interna; auditoria integral externa ausente | Gate auditoria |
| F7-R004 | Registrar não conformidades | SOFTWARE, OPERATIONAL | F7-R003 | NOT_STARTED | nenhum workflow formal localizado | Gate NC |
| F7-R005 | Tratar não conformidades críticas | OPERATIONAL | F7-R004; owners; prazos | NOT_STARTED | sem evidência | Gate NC |
| F7-R006 | Comprovar continuidade de negócio | INFRASTRUCTURE, OPERATIONAL | runbooks; SLO; equipe | SPECIFIED | EV-OPS | Gate operação |
| F7-R007 | Comprovar disaster recovery | INFRASTRUCTURE, SRE | F7-R018 a F7-R023 | NOT_STARTED | backup configurado não equivale a DR comprovado | Gate DR |
| F7-R008 | Implantar preservação digital | DATA, INFRASTRUCTURE, LEGAL | storage; formatos; checksums | SPECIFIED | EV-OPS menciona cópia soberana; sem política integral | Técnico F7 |
| F7-R009 | Implantar política de retenção | DATA, LEGAL, OPERATIONAL | classificação; LGPD | PARTIAL | backup retém 14 dias; não é política integral de ativos | Técnico e legal |
| F7-R010 | Consolidar operação permanente | OPERATIONAL, EXTERNAL | equipe; orçamento; runbooks | BLOCKED_EXTERNAL | EV-ROAD | Gate operação |
| F7-R011 | Consolidar suporte permanente | OPERATIONAL, EXTERNAL | equipe; SLA | BLOCKED_EXTERNAL | EV-ROAD | Gate operação |
| F7-R012 | Consolidar segurança operacional | SECURITY, OPERATIONAL | auditoria; SOC; incidentes | PARTIAL | EV-AUTH; EV-AUDIT; produção não homologada | Gate operação |
| F7-R013 | Consolidar FinOps | OPERATIONAL, INFRASTRUCTURE | F4-R011 a F4-R013 | NOT_STARTED | apenas custo de IA parcial | Gate operação |
| F7-R014 | Definir e operar SLA | OPERATIONAL, INSTITUTIONAL | SLO; suporte; contratos | SPECIFIED | EV-OPS define SLO, não SLA aprovado | Gate operação |
| F7-R015 | Garantir financiamento permanente | INSTITUTIONAL, EXTERNAL | decisão; orçamento | BLOCKED_EXTERNAL | EV-ROAD | Gate operação |
| F7-R016 | Instituir governança permanente | INSTITUTIONAL, EXTERNAL | ato formal; owners | BLOCKED_EXTERNAL | RACI proposto não prova instituição permanente | Gate operação |
| F7-R017 | Instituir processo permanente de atualização | OPERATIONAL, DATA | owners; SLA; fontes | BLOCKED_EXTERNAL | pipelines existem; operação permanente não | Gate operação |
| F7-R018 | Definir e provar RPO | INFRASTRUCTURE, SRE | backups; monitoramento | SPECIFIED | EV-OPS contém metas divergentes de 15 min e 24 h; sem prova | Gate DR |
| F7-R019 | Definir e provar RTO | INFRASTRUCTURE, SRE | restore; failover | SPECIFIED | EV-OPS contém metas divergentes de 2 h e 4 h; sem prova | Gate DR |
| F7-R020 | Automatizar e verificar backup | INFRASTRUCTURE | storage seguro; monitoramento | IMPLEMENTED_NOT_VALIDATED | `docker-compose.prod.yml` executa `pg_dump`; sem runtime evidenciado | Gate DR |
| F7-R021 | Executar e provar restore | INFRASTRUCTURE, TEST | F7-R020 | NOT_STARTED | `docs/spec/DEPLOYMENT.md` somente prescreve restauração | Gate DR |
| F7-R022 | Executar e provar failover | INFRASTRUCTURE, TEST | arquitetura redundante | NOT_STARTED | nenhuma implementação/teste localizado | Gate DR |
| F7-R023 | Executar e provar recuperação regional | INFRASTRUCTURE, TEST, EXTERNAL | segunda região; cópia soberana | NOT_STARTED | EV-OPS somente especifica portabilidade/soberania | Gate DR |
| F7-R024 | Game day: banco indisponível | TEST, SRE | F7-R006 a F7-R023 | NOT_STARTED | nenhum teste localizado | Gate DR |
| F7-R025 | Game day: provedor de IA indisponível | TEST, AI, SRE | gateway; fallback | PARTIAL | fallback determinístico existe; game day não | Gate DR |
| F7-R026 | Game day: storage indisponível | TEST, SRE | storage real | NOT_STARTED | nenhum teste localizado | Gate DR |
| F7-R027 | Game day: fila congestionada | TEST, SRE | filas/jobs operacionais | NOT_STARTED | nenhum teste localizado | Gate DR |
| F7-R028 | Game day: serviço GIS indisponível | TEST, GIS, SRE | GIS operacional | NOT_STARTED | nenhum teste localizado | Gate DR |
| F7-R029 | Game day: credencial comprometida | TEST, SECURITY, SRE | resposta a incidente; rotação | NOT_STARTED | nenhum teste localizado | Gate segurança |
| F7-R030 | Separar `PLATFORM CORE` da configuração regional | SOFTWARE, ARCHITECTURE | refatoração; contratos de configuração | NOT_STARTED | hardcodes MT/UF 51/142 no código e docs | Técnico F7 |
| F7-R031 | Externalizar configuração de Mato Grosso/UF | SOFTWARE, DATA | F7-R030 | NOT_STARTED | `api/scripts/ingestar-ibge-territorio.mjs`; `web/public/mt-municipios.geojson` | Técnico F7 |
| F7-R032 | Parametrizar adoção por outras UFs | SOFTWARE, DATA | F7-R030; F7-R031 | NOT_STARTED | EV-ROAD | Técnico F7 |
| F7-R033 | Publicar balanço final de evidências | DOCUMENTATION, AUDIT | ledger completo F0–F7 | IMPLEMENTED_NOT_VALIDATED | `docs/programa/EXECUCAO_COMPLETA_F0_F7.md` e gates F0–F7; auditoria externa pendente | Gate auditoria |
| F7-R034 | Publicar itens efetivamente entregues | DOCUMENTATION, AUDIT | F7-R033 | IMPLEMENTED_NOT_VALIDATED | balanço e gates separam entrega técnica de validação | Gate auditoria |
| F7-R035 | Publicar pendências remanescentes | DOCUMENTATION, AUDIT | F7-R033 | IMPLEMENTED_NOT_VALIDATED | balanço e gates registram pendências técnicas e `BLOCKED_EXTERNAL` | Gate auditoria |

**Decisão F7:** todos os gates falham ou estão bloqueados externamente. O backup existente é preparação técnica, não disaster recovery.

## Totais

| Fase | Requisitos |
|---|---:|
| F4 | 26 |
| F5 | 19 |
| F6 | 20 |
| F7 | 35 |
| **Total** | **100** |

## Maiores gaps verificáveis

1. **F4-GAP-001 — multitenancy inexistente:** não há modelo tenant/org, contexto, RLS, isolamento de storage/jobs/cache nem testes de crossover. Impacto P0 para SaaS.
2. **F4-GAP-002 — escala não comprovada:** faltam HA real, load/stress/soak/chaos, SLI operacional e evidência de 99,9%.
3. **F4-GAP-003 — produto comercial ausente:** planos, limites, assinaturas, billing, apps nativos e marketplace não foram iniciados.
4. **F4/F7-GAP-004 — metas de indicadores distantes:** baseline documentado de 67 indicadores com observações oficiais e 14 aprovados, contra 200/300.
5. **F5-GAP-001 — operação de campo não realizada:** software de missões/GIS/mídia é protótipo com seeds demo; VANT, 360°, 8K e pacotes reais dependem de contratação, autorizações, equipe e storage.
6. **F5-GAP-002 — modelo auditável não unificado:** falta contrato único do ativo e lifecycle exigido; campos estão dispersos.
7. **F6-GAP-001 — ecossistema científico ausente:** não há portal científico, DCAT, pacotes reprodutíveis, observatório ou participação cidadã.
8. **F6-GAP-002 — gate depende do mundo externo:** universidades, instituições e avaliação independente requerem convênios e atores externos.
9. **F7-GAP-001 — DR não comprovado:** existe apenas configuração de backup; faltam restore, failover, recuperação regional, RPO/RTO medidos e game days.
10. **F7-GAP-002 — operação permanente inexistente:** financiamento, governança, suporte, SLA, FinOps e atualização permanente são decisões institucionais externas.
11. **F7-GAP-003 — acoplamento regional:** hardcodes de MT/UF 51/142 municípios impedem alegar parametrização nacional.
12. **GAP transversal — evidência e gates:** não existem scripts de gate F4–F7, ledger por requisito ou relatórios formais de Phase Gauntlet para essas fases.

## Síntese de fase

- **F4:** possui fundações reaproveitáveis de métricas, custo de IA e APIs, mas o núcleo SaaS não existe.
- **F5:** possui protótipo técnico relevante de campo, GIS e mídia; a execução estadual é externa e não ocorreu.
- **F6:** possui componentes gerais de proveniência e download; o ecossistema científico não foi implantado.
- **F7:** possui desenho de continuidade e backup configurado; não há DR comprovado nem operação permanente.

Nenhuma das fases F4–F7 está tecnicamente aprovada ou operacionalmente encerrada.
