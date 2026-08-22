# Evidence Ledger — Programa F0–F7

Atualizado em 22/08/2026. Este ledger registra apenas evidência executada ou
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
| EV-20260819-037 | CodeQL hardening | scrypt+pepper, IO sem check-then-use, Bronze restrito e origem de SW; 131/131, build 17 páginas, F0, restore e audits | PASS local; gate remoto pendente no PR 1 |
| EV-20260819-038 | F1-R047 — Pesquisa/Xingú IA | Build Next.js/TypeScript com 17 páginas; Playwright real validou mouse, teclado, `aria-pressed`, preservação do texto, `/xingu?q=` sem envio automático, retorno por `?rascunho=`, cápsula responsiva, voz e painel `+` limitado a sugestões/pesquisa estruturada/limpeza; capturas `f1-search-modes-*` e `f1-xingu-*` | PASS de software; API externa não necessária para o gate |
| EV-20260819-039 | F1-R047 — entrada e compositor Xingú | Build Next.js/TypeScript com 17 páginas; Playwright real validou clique na marca da home, transporte do rascunho para `/xingu?q=` sem envio automático, compositor aderente à referência no rodapé, microfone no estado vazio, envio no estado preenchido e responsividade; capturas `f1-xingu-footer-desktop.png` e `f1-xingu-footer-mobile.png` | PASS de software; backend local desligado não afeta o gate de interface |
| EV-20260819-040 | F2-R048 — sincronização das fontes | Migrações 24–41 aplicadas no banco local; IBGE território/população/PIB/F1/F2, CNES 07/2026, INEP 2025, INPE 2025 e MapBiomas 2024 executados; 142 municípios, 39 fontes, 109 cargas, 79 indicadores e 12.086 observações; segunda execução concorrente bloqueada por advisory lock; execução sem `--force` não consultou fontes válidas; testes de normalização 3/3, agenda 2/2 e regressão 131/131 com 124 eventos de auditoria íntegros | PASS técnico/local; SESP-MT e estradas vicinais `BLOCKED_EXTERNAL`; indicadores seed de vacinação e PIB per capita continuam sem observação e não foram simulados |
| EV-20260819-041 | F2-R048 — snapshots SQL oficiais | Migrações `42`–`45` versionam 7 cargas novas: CNES 07/2026 (299 observações), INPE 2025 (142), MapBiomas 2024 (141) e INEP 2025 (284), total 866; aplicação limpa das 45 migrações em `itmt_test`; regressão 131/131 e cadeia íntegra com 131 eventos; teste da Xingú passou a conferir dinamicamente o número mais recente vindo do motor | PASS técnico/local; snapshots usam chaves naturais e `ON CONFLICT`, sem usuários, tokens, auditoria privada ou caminhos locais |
| EV-20260822-042 | Curadoria RG-09 — backlog de pareceres | Diretiva expressa do curador Luis Delmondes em 22/08/2026; `scripts/curadoria-lote.mjs` (novo, versionado, com `--dry-run` e `--parecerista` obrigatório) consultou o dossiê RF-ADMIN-003 dos 64 indicadores `EM_ANALISE` no banco dev: 64/64 com validação técnica 6/6; dry-run prévio sem gravação; lote real emitiu 64 pareceres APROVADO via `POST /v1/admin/indicadores/:id/parecer` (API no papel `itmt_app`), cada um com justificativa citando cobertura, fonte, licença e status das cargas; 64 registros em `ParecerValidacao` + 64 eventos `PARECER_INDICADOR`; cadeia íntegra com 5.278 eventos; `npm run validar:f1` passou de 2/12 para **12/12 com parecer favorável** | PASS local; catálogo dev fica 78 APROVADO / 1 REJEITADO / 0 EM_ANALISE; sobreposições 23×32 (densidade demográfica, agregado 4714) e 20×69 (pessoal assalariado, agregado 1685/var. 708) sinalizadas para revisão de duplicidade do curador |
| EV-20260822-043 | Duplicidades + bug da auditoria (P1) | Decisão do curador: REJEITADO para 32 e 69 (mantidos 23 e 20, do pacote F1; sem dependência RECALCULO; observações preservadas). A 1ª emissão expôs bug real: o cast `text::bytea` do `AuditoriaService` rejeita JSON canônico contendo `\"` e o evento era **engolido pelo catch** — decisão sem trilha, em silêncio; o lote de 64 só passou porque nenhuma justificativa tinha aspas. Correção: `convert_to(...,'UTF8')` (mesmos bytes que o verificador Node hasheia — compatível com toda a cadeia existente) + teste de regressão "RG-10: parecer com aspas e barra invertida entra na cadeia" em `test/e2e.mjs`; suíte **132/132** com cadeia de 133 eventos no banco descartável; re-registro dos pareceres de 32/69 pelo endpoint auditado gerou eventos 5279–5280 e `verificar-cadeia` fecha **5.280 íntegros** no dev | PASS local; catálogo dev final 76 APROVADO / 3 REJEITADO / 0 EM_ANALISE; as linhas de parecer das 15:28 (sem evento) permanecem em `ParecerValidacao` como histórico versionado, superadas pelo re-registro das 15:38 |
| EV-20260822-044 | Gauntlet A1 — suítes de segurança órfãs | ATTACK provou que `least-privilege.unit.mjs`, `tenant-expand.unit.mjs` e `fontes-registry.test.mjs` existiam em `api/test/` mas não constavam de `SUITES_PADRAO` (`test-e2e.mjs`) nem do CI — a catraca de menor privilégio ficou 13 migrações sem girar e, ao rodar, **falhou de verdade**: 10 grants DML de `itmt_app` fora da allowlist (Assinatura/UsoPlano db/38, NaoConformidade* db/39, ParticipacaoCidada db/40, SubtemaConsulta:UPDATE db/46), todos rastreados às suas migrações de origem e incorporados à allowlist com anotação. As três suítes entraram em `SUITES_PADRAO`; regressão completa **136/136** (antes 132) com cadeia íntegra em banco descartável | PASS local; CI passa a executar as três suítes em todo push; item novo de backlog: guard que exija atualização consciente da allowlist a cada grant novo |
| EV-20260822-045 | Gauntlet B1 — golden set regenerado (KR3.1/3.3) | ATTACK: o golden de 23/07 (`golden-set.json`, 2900 casos) cobria só **11 de 76** indicadores APROVADOS — os 65 restantes, incluindo tudo curado em EV-042, não eram vigiados por nenhum eval; baseline no set velho 100,0% / p95 81 ms. FIX: `npm run golden:gerar` do catálogo real → **12.183 casos, 76/76 indicadores**. Reavaliação (`golden:avaliar`, API léxica): **100,0% / p95 81 ms**, passa KR3.1(≥85%) e KR3.3(≤5s). Ressalva honesta: o 100% mede **cobertura de vocabulário**, não robustez de linguagem natural — a pergunta-fallback do gerador usa o nome do indicador verbatim, que o léxico casa por construção; o valor entregue é o gate passar a cobrir os 76 indicadores | PASS local; artefato `golden-set.json` versionado (2900→12183 casos). Limitações registradas: (a) `golden:avaliar` **não** está no CI (exige API no ar); (b) estressar o A01 com formulação adversarial fora do vocabulário é trabalho distinto — vira o novo B2, sem material auto-gerado |

O quadro “Baseline por fase” é histórico e anterior a EV-024–EV-036. O estado
corrente está em `docs/programa/EXECUCAO_COMPLETA_F0_F7.md`.
