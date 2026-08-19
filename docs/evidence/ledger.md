# Evidence Ledger — Programa F0–F7

Atualizado em 15/08/2026. Este ledger registra apenas evidência executada ou
inspecionada; fixtures e documentação de intenção não são evidência operacional.

## Execuções verificadas

| ID | Requisito / gate | Implementação | Testes / runtime | Segurança / dados | Resultado |
|---|---|---|---|---|---|
| EV-20260815-001 | F1 regressão | API NestJS e 23 migrações | `TEST_FILES=test/e2e.mjs npm test`: 12/12; cadeia com 18 eventos íntegra | banco descartável `itmt_test` | PASS |
| EV-20260815-002 | Portal | Next.js 16 | `npm run build`: 13 páginas geradas, TypeScript aprovado | build local | PASS |
| EV-20260815-003 | F1 harness | `api/test/e2e.mjs` | reprodução comprovou colisão com processo antigo em `3901`; porta isolada passou 12/12 | evita conexão com serviço alheio | PASS |
| EV-20260815-004 | Produção F0 | Compose base + overlay | inspeção de `docker compose config` | portas herdadas, seed demo, senha do papel e migração persistente inconsistentes | FAIL/P0 |
| EV-20260815-005 | Regressão integral | API, 26 migrações e 17 suítes | `npm test`: 108/108; cadeia com 110 eventos | banco descartável criado/removido | PASS |
| EV-20260815-006 | Build integral web | Next.js 16/React 19 | `npm run build`: TypeScript e 13 páginas | build de produção local | PASS |
| EV-20260815-007 | Bootstrap produtivo | `preparar-producao.mjs` | dry-run em `itmt_test` | cinco categorias demo tratadas e transação revertida | PASS |
| EV-20260815-008 | Topologia produtiva | migrator, redes e Caddy | Compose final válido; somente proxy publica portas | API usa papel restrito após rotação | PASS técnico |
| EV-20260815-009 | Gate técnico F1 | pacote de lançamento real | `npm run validar:f1:dados`: 12/12, dez municípios e cobertura 100% | procedência completa | PASS técnico |
| EV-20260815-010 | Gate de publicação F1 | parecer RG-09 | `npm run validar:f1`: 2/12 aprovados | dez decisões humanas pendentes | BLOCKED_EXTERNAL |
| EV-20260815-011 | Golden path estradas | indicador aprovado no catálogo | gate independente: 0 observações e 0 municípios | fonte oficial ausente | BLOCKED_EXTERNAL |
| EV-20260815-012 | WCAG página inicial | Next.js/React | Playwright: nomes/alt/IDs/console; foco do skip link; h1 | screenshot e build de produção | PASS parcial |
| EV-20260815-013 | RAG eval | avaliador F2 | 5/5 testes; precision@5 passou a ser gate não afrouxável; alucinação/contexto/citação adversariais | corpus real ainda ausente | PASS técnico / BLOCKED_EXTERNAL |
| EV-20260815-014 | Falha observável de pipelines | `refrescar-fontes.mjs` e volume `rotinas_status` | 3/3: API indisponível, falha parcial e sucesso | exit code não-zero, resumo estruturado e último estado persistente | PASS técnico |
| EV-20260815-015 | Gateway multiprovedor | Anthropic, OpenAI e cascata Xingú | build API + 4/4 contratos HTTP/usage/cascata/falha | sem chamada externa real ou segredo exposto | PASS técnico |
| EV-20260815-016 | PWA F3 | manifest, service worker e app shell público | build Next 14 artefatos; Playwright: manifest 200, SW activated/controlled e reload `/campo` offline | `/api` e curadoria excluídos do cache; headers SW restritivos | PASS técnico |
| EV-20260815-017 | Contratos de agentes | contrato runtime e executor A01 | 4/4 unitários + E2E de registro; timeout/retry/fallback/schema/allowlists | input sensível redigido; falha não publica output inválido | PASS técnico parcial |
| EV-20260815-018 | Isolamento F4 no banco | Tenant/Organização/Membership, contexto e RLS | 5/5: FORCE, sem contexto, A→B, pool bleed e FK composta | `itmt_app` sem owner/BYPASSRLS; USING+WITH CHECK | PASS da fatia DB |
| EV-20260815-019 | Isolamento F4 na API | seleção de contexto e configuração tenant-owned | 5/5: membership própria, claim contextual, A→B 404, escrita própria e revogação imediata | token sem contexto 401; B não é enumerado | PASS da fatia API |
| EV-20260815-020 | Storage/jobs/cache F4 | adapter tenant, TenantJob e cache namespaced | 3 testes novos: storage A→B/traversal, cache poisoning/invalidation e job idempotente/path B | prefixo tid/oid, SHA-256, envelope fora do payload e RLS | PASS das fatias |
| EV-20260815-021 | UI de organizações F4 | seletor e workspace `/o/[slug]` | build 15 artefatos; Playwright A mostra configuração e URL B recebe DENIED sem request B; console 0/0 | troca limpa contexto e envia PURGE_PRIVATE ao SW | PASS da fatia UI |
| EV-20260815-022 | Ecossistema científico F6 | portal `/ciencia`, DCAT JSON-LD e manifesto de reprodução | interoperabilidade 8/8; build Next.js 16 páginas | somente aprovados; conteúdo demo excluído; SHA-256 e licença expostos | PASS técnico parcial |
| EV-20260815-023 | Regressão final do ciclo | API NestJS, 26 migrações e portal Next.js | `npm test`: 110/110 e cadeia com 117 eventos; `npm run build`: 16 páginas | banco descartável criado/removido; TypeScript aprovado | PASS |

`EV-20260815-004` é a evidência do gap antes da correção; `EV-20260815-007/008`
registram a correção. A implantação real continua bloqueada externamente.

## Baseline por fase

| Fase | Implementação | Testes | Validação | Evidência | Gate |
|---|---:|---:|---:|---:|---|
| F0 | 24/26 com alguma preparação | 10 requisitos validados | aceite institucional ausente | parcial | FAIL |
| F1 | 43/46 com alguma implementação | regressão F1 12/12 | dados/publicação e WCAG formal pendentes | parcial | FAIL |
| F2 | 45/47 com alguma preparação | suítes locais existentes | corpus, curadoria e operação pendentes | parcial | BLOCKED_EXTERNAL |
| F3 | 32/36 com alguma preparação | testes de projeção/GIS/campo | pilotos e pacotes reais pendentes | parcial | FAIL/BLOCKED_EXTERNAL |
| F4 | 6/26 com alguma preparação | isolamento tenant ausente | SaaS não validado | insuficiente | FAIL |
| F5 | 14/19 com protótipo/preparação | vetos de mídia/campo | operação estadual ausente | demo | BLOCKED_EXTERNAL |
| F6 | 8/20 com componentes reutilizáveis | sem gate científico | validação independente ausente | insuficiente | FAIL/BLOCKED_EXTERNAL |
| F7 | 8/35 com desenho/preparação | restore/failover/game days ausentes | auditoria final ausente | insuficiente | FAIL/BLOCKED_EXTERNAL |

Os numeradores acima significam **qualquer preparação encontrada**, não conclusão.
Cobertura de implementação, teste, validação e evidência não deve ser fundida em
um percentual único.

## Bloqueadores externos conhecidos

| Requisitos | Blocker | Owner esperado | Preparação técnica | Ausência |
|---|---|---|---|---|
| F0-R024–R026 | nuvem em região brasileira e cópia soberana | patrocinador + infraestrutura | arquitetura e containers | contratação/provisionamento/homologação |
| F1-R021–R022 | OIDC/MFA institucional | segurança/IdP | auth/RBAC e ponto de troca | IdP, configuração e aceite |
| F2-R015–R016 | corpus real OCR/RAG | curadoria | avaliador automatizado | 20 documentos, 30 consultas e pareceres |
| F2 gate | publicação e operação | curadoria + responsável F2 | 67 indicadores carregados no baseline | 50 aprovados em 8 temas e homologação |
| F3/F5 campo | VANT, 360°, 8K e pesquisa | operações/contratações | schemas, vetos e app protótipo | autorizações, equipamentos e campanha |
| F4/F7 escala | cobertura e operação permanente | programa | fundações técnicas parciais | equipe, orçamento, SLA e homologação |
| F6 | avaliação científica independente | universidades/instituições | proveniência e APIs parciais | convênios e avaliadores externos |

## Encerramento técnico — substitui o baseline intermediário

| ID | Escopo | Evidência executada em 15/08/2026 | Resultado |
|---|---|---|---|
| EV-20260815-024 | Multitenancy | RLS FORCE, menor privilégio e ataques A→B em API, banco, pool, storage, jobs, cache e UI | PASS |
| EV-20260815-025 | Offline/campo | IndexedDB AES-GCM, blob, formulário versionado e sincronização idempotente | PASS técnico |
| EV-20260815-026 | GIS/3D | Cesium, 3D Tiles, CRS/bounds/hash e fallback acessível | PASS técnico |
| EV-20260815-027 | Storage | S3 tenant-aware, checksum, SSE/KMS e URL assinada | PASS técnico |
| EV-20260815-028 | Continuidade | backup 0,654 s; restore 4,164 s; 66 tabelas e contagens preservadas | PASS local |
| EV-20260815-029 | Resiliência | game days banco/storage/fila/IA/GIS/credencial | PASS automatizado |
| EV-20260815-030 | Participação | envio, token hash, devolutiva e Playwright real sem erros de console | PASS técnico |
| EV-20260815-031 | Conformidade | não conformidades P0–P3 e histórico append-only | PASS técnico |
| EV-20260815-032 | Portabilidade | outra UF sem alteração do core; configuração inválida falha cedo | PASS técnico |
| EV-20260815-033 | Dependências | audit API/Web em nível moderate, somente produção | PASS — 0 vulnerabilidades |
| EV-20260815-034 | Regressão | 40 migrações; 129/129; auditoria íntegra com 124 eventos | PASS |
| EV-20260815-035 | Web | Next.js/TypeScript; 17 páginas | PASS |
| EV-20260815-036 | F0 | fitness gate de topologia e CI | PASS técnico |

O quadro “Baseline por fase” é histórico e anterior a EV-024–EV-036. O estado
corrente está em `docs/programa/EXECUCAO_COMPLETA_F0_F7.md`.
