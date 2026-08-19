# Matriz de rastreabilidade — F0 a F3

> **Atualização do encerramento técnico:** este baseline precede as evidências
> EV-024–EV-036. Consulte `docs/programa/EXECUCAO_COMPLETA_F0_F7.md` e os gates
> atuais; PWA cifrada, S3, Cesium/3D Tiles, agentes do pipeline, restore e
> regressão 129/129 foram entregues posteriormente.

Baseline factual derivado da leitura do repositório e dos registros de 12–15/08/2026. Esta matriz não equivale a novo aceite operacional nem a uma nova execução da suíte.

## Legenda

Status: `VALIDATED`, `IMPLEMENTED_NOT_VALIDATED`, `PARTIAL`, `NOT_STARTED`, `BLOCKED_EXTERNAL`.

Evidências abreviadas:

- `E-F0-DOC`: `docs/spec/{PRD,ARCHITECTURE,DATABASE,DEPLOYMENT,AI_ORCHESTRATOR,AGENTS}.md`
- `E-F0-TEST`: `api/scripts/{test-e2e,migrar}.mjs`, `api/test/e2e.mjs`
- `E-F0-DATA`: `db/{01-ddl,13-ambiente,17-integridade-territorial}.sql`
- `E-F0-CI`: `.github/workflows/ci.yml`, `api/package.json`, `web/package.json`
- `E-F0-GOV`: `docs/programa/{CATALOGO_MESTRE,GOVERNANCA_RACI,MATRIZ_EVIDENCIAS,PLANO_AQUISICOES,ARQUITETURA_PRODUCAO}.md`
- `E-F1-DATA`: `db/{18-f1-estradas-vicinais,19-f1-pacote-lancamento,20-f1-educacao-api-ibge}.sql`, `api/scripts/{ingestar-pacote-f1-ibge,validar-pacote-f1}.mjs`
- `E-F1-MET`: `docs/metodologias/{PACOTE_F1_12_INDICADORES,EXTENSAO_ESTRADAS_VICINAIS}.md`, `docs/operacao/CURADORIA_PACOTE_F1.md`
- `E-F1-AUTH`: `db/11-auth.sql`, `api/src/auth/*`, `api/test/parceiros.e2e.mjs`
- `E-F1-X`: `api/src/xingu/*`, `api/test/xingu.e2e.mjs`, `web/app/xingu/page.tsx`, `api/golden/golden-set.json`
- `E-F1-PORTAL`: `api/src/{territorio,indicadores,transparencia}/*`, `web/app/{consulta,mapa,municipio,transparencia}/**`, `api/test/e2e.mjs`
- `E-F2-PIPE`: `db/41-f2-sincronizacao-fontes.sql`, `api/scripts/{lib-ingest,sincronizar-fontes,fontes-registry,refrescar-fontes,alerta-fontes,ingestar-pacote-f2-ibge,auditar-f2}.mjs`, `coletores/coletar_fontes.py`, `api/ingest-configs/*`
- `E-F2-DOC`: `db/{21-f2-documentos-rag,22-f2-seguranca-vetores}.sql`, `api/src/documentos/*`, `api/test/documentos.e2e.mjs`
- `E-F2-EVAL`: `api/scripts/avaliar-corpus-documental-f2.mjs`, `api/test/f2-gates.unit.mjs`, `docs/operacao/GATE_F2.md`
- `E-F2-API`: `db/23-f2-api-parceiros.sql`, `api/src/parceiros/*`, `api/src/interoperabilidade/*`, `api/test/{integracoes,interoperabilidade}.e2e.mjs`
- `E-F3-GEO`: `db/{04-f3,05-seed-f3}.sql`, `api/src/producao/*`, `api/test/f3.e2e.mjs`, `web/app/{geoportal,acervo,campo}/page.tsx`
- `E-F3-PRED`: `api/src/indicadores/projecao.service.ts`, `api/test/projecao.e2e.mjs`, `web/app/cenarios/page.tsx`
- `E-BASE`: `README.md`, `docs/programa/{FASES_DE_DESENVOLVIMENTO,MATRIZ_EVIDENCIAS}.md`

## F0 — Recuperação e fundação

| ID | Título | Tipo | Dependências | Status baseline | Evidência | Gate |
|---|---|---|---|---|---|---|
| F0-R001 | PRD consolidado | INSTITUTIONAL/SOFTWARE | — | IMPLEMENTED_NOT_VALIDATED | E-F0-DOC | G0-ARCH |
| F0-R002 | Arquitetura-alvo consolidada | SOFTWARE/INFRASTRUCTURE | F0-R001 | IMPLEMENTED_NOT_VALIDATED | E-F0-DOC, E-F0-GOV | G0-ARCH |
| F0-R003 | ADRs das decisões relevantes | SOFTWARE/INFRASTRUCTURE | F0-R002 | PARTIAL | `ARQUITETURA_PRODUCAO.md`; ADRs obrigatórios ainda listados | G0-ARCH |
| F0-R004 | Modelagem de dados consolidada | DATA/SOFTWARE | F0-R001,F0-R002 | IMPLEMENTED_NOT_VALIDATED | `docs/spec/DATABASE.md`, `db/01-ddl.sql` | G0-ARCH |
| F0-R005 | Banco isolado para testes | DATA/INFRASTRUCTURE | F0-R004 | VALIDATED | E-F0-TEST | G0-TDB |
| F0-R006 | Criação automática do banco de teste | INFRASTRUCTURE | F0-R005 | VALIDATED | `test-e2e.mjs::recriarBanco` | G0-TDB |
| F0-R007 | Teardown automático do banco de teste | INFRASTRUCTURE | F0-R005 | VALIDATED | `test-e2e.mjs::removerBanco` | G0-TDB |
| F0-R008 | Suites serializadas quando necessário | SOFTWARE | F0-R005 | VALIDATED | `--test-concurrency=1` em E-F0-TEST | G0-TDB |
| F0-R009 | Integridade territorial | DATA/GIS | F0-R004 | VALIDATED | `db/17-integridade-territorial.sql`, testes territoriais | G0-TDB |
| F0-R010 | Separação DEMO/OFFICIAL | DATA/SECURITY | F0-R004 | VALIDATED | E-F0-DATA | G0-DEMO |
| F0-R011 | Bloqueio de DEMO em produção | SECURITY/DATA | F0-R010 | VALIDATED | E-F0-DATA, `api/src/main.ts` | G0-DEMO |
| F0-R012 | CI/CD | INFRASTRUCTURE | F0-R005 | PARTIAL | CI em E-F0-CI; CD real não homologado | G0-CICD |
| F0-R013 | Observabilidade | INFRASTRUCTURE/OPERATIONAL | F0-R002 | PARTIAL | `/v1/metrics`, `/v1/saude`; APM/traces/alertas externos pendentes | G0-CICD |
| F0-R014 | Auditoria de dependências | SECURITY | F0-R012 | VALIDATED | `npm audit` em E-F0-CI | G0-CICD |
| F0-R015 | SBOM | SECURITY | F0-R012 | VALIDATED | `npm sbom` e artefatos CI | G0-CICD |
| F0-R016 | Secret scanning | SECURITY | F0-R012 | VALIDATED | Gitleaks em E-F0-CI | G0-CICD |
| F0-R017 | Static analysis | SECURITY/SOFTWARE | F0-R012 | VALIDATED | CodeQL em E-F0-CI | G0-CICD |
| F0-R018 | Catálogo mestre | DATA/INSTITUTIONAL | F0-R001,F0-R004 | IMPLEMENTED_NOT_VALIDATED | `docs/programa/CATALOGO_MESTRE.md` | G0-CATALOG |
| F0-R019 | Catálogo de agentes | AI/SOFTWARE | F0-R001 | IMPLEMENTED_NOT_VALIDATED | `docs/spec/AGENTS.md` | G0-CATALOG |
| F0-R020 | Política de roteamento de IA | AI/SECURITY | F0-R019 | IMPLEMENTED_NOT_VALIDATED | `docs/spec/AI_ORCHESTRATOR.md` | G0-CATALOG |
| F0-R021 | Plano técnico de aquisições/convênios | EXTERNAL/INSTITUTIONAL | F0-R002 | IMPLEMENTED_NOT_VALIDATED | `docs/programa/PLANO_AQUISICOES.md` | G0-CATALOG |
| F0-R022 | RACI | INSTITUTIONAL/OPERATIONAL | — | IMPLEMENTED_NOT_VALIDATED | `docs/programa/GOVERNANCA_RACI.md` | G0-EVID |
| F0-R023 | Matriz de evidências | INSTITUTIONAL/OPERATIONAL | F0-R001 | IMPLEMENTED_NOT_VALIDATED | `docs/programa/MATRIZ_EVIDENCIAS.md` | G0-EVID |
| F0-R024 | Nuvem em região brasileira | INFRASTRUCTURE/LEGAL/EXTERNAL | F0-R021 | BLOCKED_EXTERNAL | E-F0-GOV; provedor/implantação ausentes | G0-OP |
| F0-R025 | Portabilidade | INFRASTRUCTURE/OPERATIONAL | F0-R002,F0-R021 | PARTIAL | Docker/formatos abertos; IaC/exportação homologada ausente | G0-OP |
| F0-R026 | Cópia soberana dos ativos | DATA/INFRASTRUCTURE/LEGAL | F0-R021,F0-R024 | PARTIAL | política/constraints; object storage soberano não implantado | G0-OP |

## F1 — MVP público confiável

| ID | Título | Tipo | Dependências | Status baseline | Evidência | Gate |
|---|---|---|---|---|---|---|
| F1-R001 | Tema Demografia | DATA/SOFTWARE | F0-R018 | IMPLEMENTED_NOT_VALIDATED | E-F1-DATA,E-F1-MET | G1-6T |
| F1-R002 | Tema Saúde | DATA/SOFTWARE | F0-R018 | IMPLEMENTED_NOT_VALIDATED | configs CNES,E-F1-MET | G1-6T |
| F1-R003 | Tema Educação | DATA/SOFTWARE | F0-R018 | IMPLEMENTED_NOT_VALIDATED | `db/20-*`,E-F1-MET | G1-6T |
| F1-R004 | Tema Agronegócio | DATA/SOFTWARE | F0-R018 | IMPLEMENTED_NOT_VALIDATED | configs PAM,E-F1-MET | G1-6T |
| F1-R005 | Tema Economia Privada | DATA/SOFTWARE | F0-R018 | IMPLEMENTED_NOT_VALIDATED | scripts IBGE,E-F1-MET | G1-6T |
| F1-R006 | Tema Infraestrutura Macro | DATA/GIS | F0-R018 | PARTIAL | estrada estruturada; publicação factual incompleta | G1-6T/G1-ROAD |
| F1-R007 | Cuiabá piloto | DATA/GIS | F0-R009 | IMPLEMENTED_NOT_VALIDATED | E-F1-DATA | G1-10M |
| F1-R008 | Várzea Grande piloto | DATA/GIS | F0-R009 | IMPLEMENTED_NOT_VALIDATED | E-F1-DATA | G1-10M |
| F1-R009 | Rondonópolis piloto | DATA/GIS | F0-R009 | IMPLEMENTED_NOT_VALIDATED | E-F1-DATA | G1-10M |
| F1-R010 | Sinop piloto | DATA/GIS | F0-R009 | IMPLEMENTED_NOT_VALIDATED | E-F1-DATA | G1-10M |
| F1-R011 | Sorriso piloto | DATA/GIS | F0-R009 | IMPLEMENTED_NOT_VALIDATED | E-F1-DATA | G1-10M |
| F1-R012 | Cáceres piloto | DATA/GIS | F0-R009 | IMPLEMENTED_NOT_VALIDATED | E-F1-DATA | G1-10M |
| F1-R013 | Barra do Garças piloto | DATA/GIS | F0-R009 | IMPLEMENTED_NOT_VALIDATED | E-F1-DATA | G1-10M |
| F1-R014 | Tangará da Serra piloto | DATA/GIS | F0-R009 | IMPLEMENTED_NOT_VALIDATED | E-F1-DATA | G1-10M |
| F1-R015 | Alta Floresta piloto | DATA/GIS | F0-R009 | IMPLEMENTED_NOT_VALIDATED | E-F1-DATA | G1-10M |
| F1-R016 | Primavera do Leste piloto | DATA/GIS | F0-R009 | IMPLEMENTED_NOT_VALIDATED | E-F1-DATA | G1-10M |
| F1-R017 | Pelo menos 12 indicadores oficiais | DATA/INSTITUTIONAL | F1-R001–F1-R006 | PARTIAL | gate técnico previsto; gate final/teste 404 | G1-12I |
| F1-R018 | Seis recortes territoriais | DATA/GIS/SOFTWARE | F0-R009 | PARTIAL | E-F1-PORTAL; consórcios incompletos | G1 |
| F1-R019 | Login | SOFTWARE/SECURITY | F0-R004 | VALIDATED | E-F1-AUTH | G1 |
| F1-R020 | Identidade pública | SOFTWARE/SECURITY | F1-R019 | PARTIAL | cadastro/perfis; IdP não homologado | G1 |
| F1-R021 | OIDC administrativo | SECURITY/INFRASTRUCTURE/EXTERNAL | F1-R019 | BLOCKED_EXTERNAL | ADR pendente; token dev em uso | G1 |
| F1-R022 | MFA administrativo | SECURITY/EXTERNAL | F1-R021 | BLOCKED_EXTERNAL | E-BASE,E-F0-GOV | G1 |
| F1-R023 | Upload de documentos | SOFTWARE/SECURITY | F1-R019 | IMPLEMENTED_NOT_VALIDATED | E-F2-DOC | G1 |
| F1-R024 | OCR | SOFTWARE/AI/DATA | F1-R023 | IMPLEMENTED_NOT_VALIDATED | E-F2-DOC; corpus real não homologado | G1 |
| F1-R025 | Xingú texto | AI/SOFTWARE | F0-R020 | VALIDATED | E-F1-X | G1 |
| F1-R026 | Xingú áudio | AI/SOFTWARE/ACCESSIBILITY | F1-R025 | IMPLEMENTED_NOT_VALIDATED | `web/app/xingu/page.tsx`; sem E2E de navegador | G1 |
| F1-R027 | Orquestração | AI/SOFTWARE | F1-R025 | VALIDATED | E-F1-X | G1 |
| F1-R028 | Agentes essenciais | AI/SOFTWARE | F1-R027,F0-R019 | PARTIAL | E-F1-X; operação integral não homologada | G1 |
| F1-R029 | RAG inicial | AI/DATA | F1-R023,F1-R024 | IMPLEMENTED_NOT_VALIDATED | E-F2-DOC | G1 |
| F1-R030 | Mapas básicos | GIS/SOFTWARE | F0-R009 | IMPLEMENTED_NOT_VALIDATED | E-F1-PORTAL,`web/public/mt-municipios.geojson` | G1 |
| F1-R031 | Exportação PDF | SOFTWARE | F1-R017 | VALIDATED | export controller,E2E | G1 |
| F1-R032 | Exportação planilha | SOFTWARE | F1-R017 | VALIDATED | XLSX/CSV,E2E | G1 |
| F1-R033 | Rastreabilidade | DATA/SECURITY | F0-R023 | VALIDATED | procedência,auditoria encadeada,E2E | G1 |
| F1-R034 | Estradas: ingestão | DATA/GIS | F0-R018 | IMPLEMENTED_NOT_VALIDATED | `db/18-*`,E-F1-MET | G1-ROAD |
| F1-R035 | Estradas: processamento | DATA/GIS | F1-R034 | IMPLEMENTED_NOT_VALIDATED | E-F1-MET | G1-ROAD |
| F1-R036 | Estradas: indicador | DATA/GIS | F1-R035 | PARTIAL | estrutura existe; resposta pode ser 404/SEM_DADO | G1-ROAD |
| F1-R037 | Estradas: mapa | GIS/SOFTWARE | F1-R036 | PARTIAL | mapa básico; camada oficial completa não comprovada | G1-ROAD |
| F1-R038 | Estradas: relatório municipal | SOFTWARE/DATA | F1-R036 | PARTIAL | exportação genérica; golden path não provado | G1-ROAD |
| F1-R039 | Estradas: resposta Xingú | AI/DATA | F1-R036,F1-R025 | VALIDATED | `api/test/xingu.e2e.mjs` | G1-ROAD |
| F1-R040 | Estradas: provenance | DATA/SECURITY | F1-R034 | IMPLEMENTED_NOT_VALIDATED | E-F1-MET,cadeia de procedência | G1-ROAD |
| F1-R041 | Estradas: evidence package | OPERATIONAL/INSTITUTIONAL | F1-R034–F1-R040 | NOT_STARTED | dossiê específico completo ausente | G1-ROAD |
| F1-R042 | Exibir fonte | DATA/SOFTWARE | F1-R033 | VALIDATED | `ReguaProcedencia`,E2E | G1 |
| F1-R043 | Exibir metodologia | DATA/SOFTWARE | F1-R033 | VALIDATED | consulta,dossiê,E-F1-MET | G1 |
| F1-R044 | Exibir qualidade | DATA/SOFTWARE | F1-R033 | VALIDATED | chips/régua/API | G1 |
| F1-R045 | Exibir cobertura | DATA/GIS/SOFTWARE | F1-R018 | VALIDATED | `/cobertura`,consulta,E2E | G1 |
| F1-R046 | WCAG AA | SOFTWARE/ACCESSIBILITY | F1-R025–F1-R032 | IMPLEMENTED_NOT_VALIDATED | recursos implementados; auditoria formal ausente | G1-WCAG |
| F1-R047 | Alternar Pesquisa e Xingú IA sem execução acidental | SOFTWARE/AI/ACCESSIBILITY | F1-R025,F1-R046 | VALIDATED | `PesquisaPrincipal`, `SeletorModoPesquisa`, `/consulta?rascunho=`, `/xingu?q=`; EV-20260819-038, EV-20260819-039 | G1-WCAG |

## F2 — Plataforma de dados

| ID | Título | Tipo | Dependências | Status baseline | Evidência | Gate |
|---|---|---|---|---|---|---|
| F2-R001 | Taxonomia de 17 temas | DATA/SOFTWARE | F0-R018 | VALIDATED | catálogo,taxonomia API/DB | G2-8T |
| F2-R002 | Camada Bronze | DATA/INFRASTRUCTURE | F0-R004 | VALIDATED | E-F2-PIPE,E2E | G2-PIPE |
| F2-R003 | Camada Prata | DATA/SOFTWARE | F2-R002 | VALIDATED | E-F2-PIPE | G2-PIPE |
| F2-R004 | Camada Ouro | DATA/SOFTWARE | F2-R003 | VALIDATED | E-F2-PIPE | G2-PIPE |
| F2-R005 | Monitoramento de pipelines | OPERATIONAL/INFRASTRUCTURE | F2-R002–F2-R004 | PARTIAL | métricas/alert scripts; operação externa não homologada | G2-PIPE |
| F2-R006 | Ingestão contínua | DATA/OPERATIONAL | F2-R002–F2-R005 | PARTIAL | refresh/rotinas; execução contínua real não provada | G2-PIPE |
| F2-R007 | Integrações externas | DATA/EXTERNAL | F2-R006 | PARTIAL | IBGE/CNES/INEP/PAM/configs; demais fontes/convênios pendentes | G2-PIPE |
| F2-R008 | Catálogo público | DATA/SOFTWARE | F2-R001 | VALIDATED | endpoints taxonomia/integrações/portal | G2 |
| F2-R009 | Upload seguro | SECURITY/SOFTWARE | F1-R023 | VALIDATED | E-F2-DOC | G2-OCR |
| F2-R010 | Quarentena documental | SECURITY/DATA | F2-R009 | VALIDATED | E-F2-DOC | G2-OCR |
| F2-R011 | OCR operacional | AI/DATA | F2-R010 | IMPLEMENTED_NOT_VALIDATED | worker/extrator; corpus real ausente | G2-OCR |
| F2-R012 | Revisão humana documental | OPERATIONAL/DATA | F2-R011 | IMPLEMENTED_NOT_VALIDATED | fluxo/API; operação humana não homologada | G2-OCR |
| F2-R013 | Vetores | AI/DATA | F2-R012 | IMPLEMENTED_NOT_VALIDATED | pgvector/embeddings; produção pendente | G2-RAG |
| F2-R014 | Busca híbrida | AI/DATA/SOFTWARE | F2-R013 | VALIDATED | E-F2-DOC | G2-RAG |
| F2-R015 | Avaliação OCR real | AI/DATA/OPERATIONAL | F2-R011 | BLOCKED_EXTERNAL | avaliador validado; corpus real homologado ausente | G2-OCR |
| F2-R016 | Avaliação RAG real | AI/DATA/OPERATIONAL | F2-R014 | BLOCKED_EXTERNAL | E-F2-EVAL | G2-RAG |
| F2-R017 | Dashboards | SOFTWARE/DATA | F2-R004 | PARTIAL | `web/app/painel`; operação incompleta | G2 |
| F2-R018 | GIS avançado | GIS/SOFTWARE/INFRASTRUCTURE | F2-R004 | PARTIAL | OGC/GeoJSON; camadas/storage reais ausentes | G2 |
| F2-R019 | Portal de parceiros | SOFTWARE/OPERATIONAL | F2-R020 | IMPLEMENTED_NOT_VALIDATED | `web/app/integracoes`,E-F2-API | G2-API |
| F2-R020 | API de parceiros | SOFTWARE/EXTERNAL | F2-R004 | IMPLEMENTED_NOT_VALIDATED | E-F2-API; homologação/SLA/onboarding pendentes | G2-API |
| F2-R021 | API keys | SECURITY/SOFTWARE | F2-R020 | VALIDATED | hashes/segredo único,E2E | G2-API |
| F2-R022 | Scopes | SECURITY/SOFTWARE | F2-R021 | VALIDATED | guard,E2E 403 | G2-API |
| F2-R023 | Quotas | SECURITY/OPERATIONAL | F2-R021 | VALIDATED | consumo atômico,E2E 429 | G2-API |
| F2-R024 | Revogação | SECURITY/SOFTWARE | F2-R021 | VALIDATED | revogação imediata,E2E 401 | G2-API |
| F2-R025 | OpenAPI 3.1 | SOFTWARE/EXTERNAL | F2-R020 | IMPLEMENTED_NOT_VALIDATED | contrato,E2E; homologação formal ausente | G2-API |
| F2-R026 | OGC API Features | GIS/SOFTWARE | F2-R018 | VALIDATED | conformance/GeoJSON,E2E | G2-API |
| F2-R027 | Auditoria evoluída | SECURITY/OPERATIONAL | F1-R033 | VALIDATED | cadeia append-only,verificador,E2E | G2 |
| F2-R028 | Gestão de usuários | SOFTWARE/SECURITY | F1-R019 | VALIDATED | auth/admin,testes | G2 |
| F2-R029 | Gestão de organizações | SOFTWARE/SECURITY | F2-R028 | PARTIAL | schema/papéis; administração integral não comprovada | G2 |
| F2-R030 | Gestão de tenants | SECURITY/SOFTWARE | F2-R029 | PARTIAL | modelo/organization_id; isolamento integral não provado | G2 |
| F2-R031 | Coordenação multiagente | AI/SOFTWARE | F1-R027,F0-R019 | PARTIAL | orquestrador/agentes; coordenação integral incompleta | G2 |
| F2-R032 | Data Contract: schema | DATA | F2-R002 | VALIDATED | configs,validação de drift | G2-PIPE |
| F2-R033 | Data Contract: owner | DATA/INSTITUTIONAL | F2-R032 | PARTIAL | campo definido; responsáveis nominais incompletos | G2-PIPE |
| F2-R034 | Data Contract: refresh | DATA/OPERATIONAL | F2-R032 | VALIDATED | catálogo/configs/agentes de fonte | G2-PIPE |
| F2-R035 | Data Contract: quality | DATA | F2-R032 | VALIDATED | qualidade/quarentena/gates | G2-PIPE |
| F2-R036 | Data Contract: license | DATA/LEGAL | F2-R032 | VALIDATED | RG-06,catálogo | G2-PIPE |
| F2-R037 | Data Contract: lineage | DATA | F2-R032 | VALIDATED | carga→Bronze→hash→observação | G2-PIPE |
| F2-R038 | Data Contract: SLA | OPERATIONAL/EXTERNAL | F2-R032 | BLOCKED_EXTERNAL | especificado; SLA institucional não homologado | G2-API |
| F2-R039 | Data Contract: failure policy | DATA/OPERATIONAL | F2-R032 | VALIDATED | quarentena/drift/aborto; refresh retorna falha, resumo estruturado e estado persistente; testes indisponível/parcial/sucesso | G2-PIPE |
| F2-R040 | OCR eval: CER | AI/DATA | F2-R015 | BLOCKED_EXTERNAL | cálculo/teste; medição real pendente | G2-OCR |
| F2-R041 | OCR eval: WER | AI/DATA | F2-R015 | BLOCKED_EXTERNAL | E-F2-EVAL | G2-OCR |
| F2-R042 | OCR eval: precisão por tipo documental | AI/DATA | F2-R015 | PARTIAL | avaliador-base; estratificação real não comprovada | G2-OCR |
| F2-R043 | RAG eval: recall | AI/DATA | F2-R016 | BLOCKED_EXTERNAL | recall@5; corpus real pendente | G2-RAG |
| F2-R044 | RAG eval: precision | AI/DATA | F2-R016 | BLOCKED_EXTERNAL | precision@5; corpus real pendente | G2-RAG |
| F2-R045 | RAG eval: faithfulness | AI/DATA | F2-R016 | BLOCKED_EXTERNAL | cálculo e ataque de alucinação validados; corpus real homologado pendente | G2-RAG |
| F2-R046 | RAG eval: groundedness | AI/DATA | F2-R016 | BLOCKED_EXTERNAL | cálculo e contexto sem suporte validados; corpus real homologado pendente | G2-RAG |
| F2-R047 | RAG eval: citation correctness | AI/DATA | F2-R016 | BLOCKED_EXTERNAL | cálculo e citação incorreta validados; corpus real homologado pendente | G2-RAG |
| F2-R048 | Sincronização incremental das fontes oficiais | DATA/OPERATIONAL | F2-R002–F2-R007 | VALIDATED | `docs/requirements/F2-R048-SINCRONIZACAO-FONTES.md`, E-F2-PIPE, EV-20260819-040 | G2-PIPE |

## F3 — Inteligência e pilotos

| ID | Título | Tipo | Dependências | Status baseline | Evidência | Gate |
|---|---|---|---|---|---|---|
| F3-R001 | Gateway multiprovedor | AI/INFRASTRUCTURE | F0-R020 | VALIDATED | Anthropic+OpenAI+cascata+léxico; contratos HTTP, telemetria, falha e cascata testados | G3-X |
| F3-R002 | Fallback determinístico | AI/SOFTWARE | F3-R001 | VALIDATED | fallback léxico,golden set,E2E | G3-X |
| F3-R003 | Xingú multiagente | AI/SOFTWARE | F2-R031 | PARTIAL | papéis/orquestração; operação integral não comprovada | G3-X |
| F3-R004 | Contratos entre agentes | AI/SOFTWARE | F3-R003 | PARTIAL | contrato runtime A01 e executor genérico validados; demais agentes ainda não integrados | G3-X |
| F3-R005 | Evals contínuos | AI/OPERATIONAL | F3-R003,F3-R004 | PARTIAL | golden scripts/set; CI contínuo não provado | G3-X |
| F3-R006 | Análise preditiva | AI/DATA | F2-R004 | VALIDATED | E-F3-PRED | G3-X |
| F3-R007 | Voz aprimorada | AI/ACCESSIBILITY | F1-R026 | PARTIAL | Web Speech/TTS básico | G3-X |
| F3-R008 | Workflows automatizados | AI/SOFTWARE | F3-R003 | PARTIAL | máquinas/worker/agent execution parciais | G3-X |
| F3-R009 | Agentes autônomos | AI/SECURITY | F3-R004,F3-R008 | PARTIAL | agentes de fonte; autonomia integral não homologada | G3-X |
| F3-R010 | Relatórios avançados | SOFTWARE/DATA | F1-R031,F3-R006 | PARTIAL | PDF/XLSX básicos; avançados não comprovados | G3 |
| F3-R011 | Validação cruzada | DATA/AI | F2-R035 | PARTIAL | validação técnica/reconciliação parcial | G3 |
| F3-R012 | PWA instalável | SOFTWARE/FIELD | — | VALIDATED | manifest Next.js, service worker, headers e app shell; Playwright comprovou controle e reload offline | G3-PWA |
| F3-R013 | Operação offline | SOFTWARE/FIELD | F3-R012 | IMPLEMENTED_NOT_VALIDATED | fila local/sincronização; piloto real ausente | G3-PWA |
| F3-R014 | Formulários versionados | SOFTWARE/FIELD/DATA | F3-R013 | NOT_STARTED | nenhum schema/API/UI de questionário versionado localizado | G3-PWA |
| F3-R015 | Pesquisa domiciliar piloto | FIELD/LEGAL/EXTERNAL | F3-R013,F3-R014 | BLOCKED_EXTERNAL | software preparado; convênio/ética/LGPD/campanha ausentes | G3-FIELD |
| F3-R016 | Coleta de campo piloto | FIELD/EXTERNAL | F3-R013,F3-R014 | BLOCKED_EXTERNAL | missões demo; campanha real ausente | G3-FIELD |
| F3-R017 | MT Imagens | SOFTWARE/DATA/GIS | F2-R018 | IMPLEMENTED_NOT_VALIDATED | acervo,vetos,E2E; dados demo | G3-10P |
| F3-R018 | Armazenamento de mídia | INFRASTRUCTURE/DATA | F3-R017 | PARTIAL | volume/local; object storage/CDN reais ausentes | G3-10P |
| F3-R019 | Mídias derivadas | SOFTWARE/DATA | F3-R017,F3-R018 | PARTIAL | metadados/estrutura; pipeline real não comprovado | G3-10P |
| F3-R020 | Levantamento VANT | GIS/FIELD/EXTERNAL | F3-R018 | BLOCKED_EXTERNAL | gestão/vetos; voo exige contratação/autorização/RT | G3-FIELD |
| F3-R021 | Captura 360° | GIS/FIELD/EXTERNAL | F3-R018 | BLOCKED_EXTERNAL | modelo/cobertura; captura real ausente | G3-10P |
| F3-R022 | Captura 8K | GIS/FIELD/EXTERNAL | F3-R021 | BLOCKED_EXTERNAL | requisito/modelo; equipamento/campanha ausentes | G3-10P |
| F3-R023 | Cesium | GIS/SOFTWARE | F2-R018,F3-R018 | NOT_STARTED | somente arquitetura-alvo | G3-10P |
| F3-R024 | 3D Tiles | GIS/SOFTWARE/DATA | F3-R020,F3-R023 | NOT_STARTED | geração/publicação ausentes | G3-10P |
| F3-R025 | Pacotes GIS/audiovisuais | GIS/FIELD/OPERATIONAL | F3-R017–F3-R024 | BLOCKED_EXTERNAL | estruturas/demo; 10 pacotes reais ausentes | G3-10P |
| F3-R026 | Agent contract: purpose | AI | F3-R004 | PARTIAL | papéis documentados | G3-X |
| F3-R027 | Agent contract: input | AI/SOFTWARE | F3-R004 | PARTIAL | tipos Xingú parciais | G3-X |
| F3-R028 | Agent contract: output | AI/SOFTWARE | F3-R004 | PARTIAL | tipos/respostas parciais | G3-X |
| F3-R029 | Agent contract: tools | AI/SECURITY | F3-R004 | PARTIAL | serviços implícitos; contrato formal ausente | G3-X |
| F3-R030 | Agent contract: permissions | AI/SECURITY | F3-R004 | PARTIAL | guards/least privilege parcial | G3-X |
| F3-R031 | Agent contract: timeout | AI/RELIABILITY | F3-R004 | VALIDATED | AbortSignal, limite por contrato e ataque de timeout testado | G3-X |
| F3-R032 | Agent contract: retry | AI/RELIABILITY | F3-R004 | VALIDATED | retry limitado exige idempotency key; fallback e logging de tentativas testados | G3-X |
| F3-R033 | Agent contract: fallback | AI/RELIABILITY | F3-R004,F3-R002 | VALIDATED | fallback léxico testado | G3-X |
| F3-R034 | Agent contract: evaluation | AI/QA | F3-R004,F3-R005 | PARTIAL | golden eval parcial | G3-X |
| F3-R035 | Agent contract: logging | AI/OBSERVABILITY | F3-R004 | PARTIAL | A01 grava versão/resultado em AgentExecution e falhas são testadas; demais etapas/agentes pendentes | G3-X |
| F3-R036 | 100 indicadores | DATA/INSTITUTIONAL | Gate F2 | PARTIAL | 67 com observações; 100 não atingidos | G3-100I |

## Totais do baseline

| Fase | Requisitos | VALIDATED | IMPLEMENTED_NOT_VALIDATED | PARTIAL | NOT_STARTED | BLOCKED_EXTERNAL | Gate baseline |
|---|---:|---:|---:|---:|---:|---:|---|
| F0 | 26 | 10 | 9 | 5 | 0 | 2 | Não aprovado |
| F1 | 47 | 16 | 19 | 8 | 1 | 3 | Não aprovado |
| F2 | 48 | 20 | 7 | 11 | 2 | 8 | Técnico parcial / operacional bloqueado |
| F3 | 36 | 5 | 4 | 18 | 4 | 5 | Não aprovado / campo bloqueado |
| **Total** | **157** | **51** | **39** | **42** | **7** | **18** | — |

O primeiro requisito bloqueante da primeira fase não aprovada é `F0-R003` — ADRs das decisões relevantes. Em seguida estão os aceites formais de arquitetura, catálogo e evidências e as dependências externas `F0-R024` e `F0-R026`.
