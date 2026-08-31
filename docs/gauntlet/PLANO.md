# PLANO — Gauntlet "Pesquisa vs IA Xingú"

Data de abertura: 26/08/2026 · Método: Gauntlet Loop (builder/crítico por peça,
comparação cega com referência real, loop até APROVADO, ratchet de testes).
Painel humano: `docs/gauntlet/STATUS.md`. Referências verificadas:
`docs/gauntlet/referencias/README.md`.

## 0. Mapeamento do prompt → repositório real

O prompt de abertura cita artefatos que não existem com esses nomes. Âncoras
reais usadas (verificadas em 26/08):

| Citado no prompt | Real no repositório |
|---|---|
| `PRD-ITMT.md` | `docs/spec/PRD.md` (RF001–RF022, RN01–RN15) + `README.md` raiz (RF-CHAT/RG/RN-00x) |
| `ARQUITETURA-ITMT.md` | `docs/spec/ARCHITECTURE.md` (nova seção entra como §3.7) |
| `docs/design-system/MERIDIANO.md` | Design system real: "Territorial Intelligence System" — tokens em `web/app/globals.css` + `docs/spec/UI_UX.md`. **Não existe "Meridiano"**; toda UI nova usa os tokens existentes |
| `docs/ia-xingu/ORQUESTRACAO.md` (15 agentes) | `docs/spec/AI_ORCHESTRATOR.md` (pipeline [1]–[11]) + `docs/spec/AGENTS.md` (**16** agentes de produto) + contratos reais A01–A15 em `api/src/xingu/contracts.ts` (A07–A10/A13 são buracos) |
| `ROADMAP-ITMT-2027.md` | `docs/spec/ROADMAP.md` |
| `docs/gauntlet/` | Novo (pedido explícito do prompt) — painel de trabalho. A evidência final TAMBÉM segue o rito da casa: `docs/evidence/gauntlets/GAUNTLET-20260826-PESQUISA-VS-XINGU.md` + linha no `docs/evidence/ledger.md` (próximo id: EV-20260826-061) |
| Nomenclatura `NomeTabela_NomeAtributo` | Confere com a convenção real (`"Pesquisa_Id"`, aspas duplas, CHECK inline, sem CREATE TYPE) |

## 1. Invariantes herdadas (valem nos DOIS modos, sem exceção)

- **RG-03/KR3.2**: todo numeral vem do motor; A06 veta numeral intruso —
  inclusive no texto das sugestões do Xingú.
- **RN-005/RN11**: ausência é resposta com contexto; nunca estimar. Município
  sem parcela fica fora do RECALCULO; ano sem dado é omitido.
- **RG-05**: degradação segura — tudo funciona sem LLM (intérprete léxico +
  templates determinísticos). A conta de LLM está sem créditos: o caminho
  determinístico é o caminho PRIMÁRIO deste gauntlet, LLM é enriquecimento.
- **RG-09 + doutrina "dossiê, não decisão"** (`docs/spec/README.md:19`): a peça
  de "sugestões" produz SUBSÍDIO estruturado, com FK no dado que a motivou e
  citação de prática reconhecida — não decisão autônoma. Indicador novo nasce
  `EM_ANALISE` e só humano aprova (o motor filtra `APROVADO`).
- **Auditoria INSERT-ONLY** SHA-256 continua sendo a prova imutável; as tabelas
  novas de persistência são o registro operacional consultável, não a trilha.
- **Tenant fail-closed**: tabelas novas tenant-owned seguem `db/40` (RLS
  ENABLE+FORCE, policy USING+WITH CHECK, grants mínimos, catraca do
  `least-privilege.unit.mjs`). Rotas públicas usam `PLATFORM_PUBLIC_CONTEXT`.

## 2. Realidade de dados (condiciona os casos de teste)

| Caso | Dado necessário | Existe hoje? | Caminho |
|---|---|---|---|
| #1 mortalidade infantil | Óbitos infantis (SIM) + nascidos vivos (SINASC), por município/ano; causas por capítulo CID-10 e evitáveis; componentes etários | **NÃO** (nenhuma tabela/config/coletor) | Novo conector TabNet (padrão CNES já existente em `coletores/`): fonte dado-aberto MS/SVSA/CGIAE. Referência R1 confirma as dimensões publicadas |
| #2 educação | IDEB ou proxy | Parcial: Matrículas (APROVADO), Escolas (EM_ANALISE) via INEP | Contrato genérico provado com o dado existente; IDEB opcional |
| #3 finanças | Execução orçamentária | **NÃO** | SICONFI/Tesouro (API pública) — conector novo; se não couber, gate humano com 2 caminhos documentados |

**Gate humano previsto**: indicadores novos (mortalidade etc.) nascem
`EM_ANALISE`; a aprovação (parecer RG-09) é ato do usuário. O loop constrói e
testa com o dado em análise via rotas admin/testes; a tela pública só mostra
após aprovação humana. STATUS.md sinaliza quando esse gate chegar.

## 3. Decomposição (9 peças)

### P1 · PERSISTENCIA-PESQUISA
Migração `db/48-f2-pesquisas-persistidas.sql` + módulo `api/src/pesquisas/`.
Tabelas (todas com `_TenantId/_OrganizacaoId`, FK composta para `"Organizacao"`,
RLS FORCE, grants mínimos; enum = CHECK inline):
- `"Pesquisa"` — id uuid, modo CHECK `pesquisa|xingu`, pergunta, área (tema),
  recorte, código, usuário (nullable — portal público), data, hash do payload,
  estado, versão do motor.
- `"PesquisaIndicador"` — indicador calculado: FK Pesquisa, IndicadorId, nome,
  valor, unidade, referência, agregação, nº municípios agregados.
- `"PesquisaIndicadorMunicipio"` — valor por município, posição no ranking,
  flag top-N, delta vs média estadual.
- `"PesquisaSerieHistorica"` — pontos ano×valor por território.
- `"PesquisaCausa"` — dimensão causa/componente/período (usada pelo Xingú;
  vazia até P3 entregar dado).
- `"PesquisaDashboard"` — visualizações geradas: tipo, configuração jsonb, ordem, modo.
- `"PesquisaSugestao"` — texto, prática citada, **FK obrigatória** para
  `PesquisaIndicadorMunicipio` OU `PesquisaIndicador`, agente responsável.
- `"PesquisaFonte"` — FonteId + CargaId + hash congelado (auditável mesmo com recarga).
- `"PesquisaExecucaoAgente"` — correlação com `"AgentExecution"` + entrada/saída sanitizadas.
Regras: gravação faz parte da execução (falhou gravação ⇒ pesquisa não
concluída); reabertura por `GET /v1/pesquisas/:id` reconstruindo a resposta
idêntica SEM reexecutar motor/LLM. Ajustes: `least-privilege.unit.mjs`
(permitidos), nova suíte em `test-e2e.mjs`.

### P2 · MOTOR-RANKING (o prompt chama MOTOR-INDICADOR; o motor já existe)
Reusar `IndicadoresService.consultar/serie/comparar/mapa`. Falta e entra aqui:
`ranking()` — ordenação completa dos municípios do recorte (base `mapa()`),
posição, top-N/bottom-N, delta vs média estadual (agregada conforme
`Indicador_TipoAgregacao`), com procedência por linha. Endpoint
`GET /v1/indicadores/:id/ranking?referencia=&n=`. RN-005: município sem dado
fica FORA do ranking (listado como ausente, nunca zero). Saída JSON tipada +
fixtures.

### P3 · MOTOR-CAUSAS
Novo eixo de dimensão (a `"Observacao"` não tem coluna de categoria — decisão
de modelagem do builder: tabela irmã `"ObservacaoDimensao"` OU indicadores por
capítulo; critério: idempotência da carga + RECALCULO intacto). Conector
SIM/SINASC via TabNet (padrão `coletores/coletar_fontes.py` + `ingest-configs`)
com Bronze→Prata→Ouro e drift de esquema. Decomposição por capítulo CID-10,
causas evitáveis 0–4 anos, componente (neonatal precoce/tardio/pós-neonatal),
por município e período. Só o Xingú consome. Enquanto o dado não existir/não
for aprovado: RN-005 com contexto (o modo Xingú declara a lacuna — nunca some).

### P4 · RN-MODO
`modo: 'pesquisa'|'xingu'` no `PerguntaDto` (`xingu.controller.ts`), na
assinatura do `OrquestradorService.perguntar` e na chave do cache de planos
(hoje não inclui modo — bug latente). UI: o toggle já existe
(`web/components/SeletorModoPesquisa.tsx`, tipo `ModoPesquisa` exportado) — hoje
é cosmético; passa a comandar o contrato de resposta. `RespostaXingu` ganha
`modo` e bloco `dossie?` (ranking, série, causas, sugestões) presente só no
modo xingu. Modo pesquisa: envelope atual + ranking top-5 + tabela.

### P5 · DASH-PESQUISA (web)
Resposta do modo pesquisa na home/`/consulta`: card do índice geral
(`CartaoIndicador`), barras top-5 (`GraficoBarras`), tabela completa filtrável
(`TabelaDados`), tudo com `ReguaProcedencia`. Tokens existentes; nada de lib nova.
Barra: vencer TabNet (R1) em clareza sem perder completude; IBGE Cidades (R2)
como barra de legibilidade do card.

### P6 · DASH-XINGU (web)
Dashboard explicativo: mapa coroplético (reusar o SVG de `/mapa`), série
histórica (`GraficoLinha` + projeção), ranking completo ordenado com posição e
delta vs média, decomposição por causa (quando P3 tiver dado; senão estado
RN-005 explícito), comparação entre municípios semelhantes (porte populacional/
região de saúde — critério determinístico documentado), bloco de sugestões (P7).
Barra: vencer o painel SVS/MS (R3) em capacidade de decisão.

### P7 · AGENTE-SUGESTOES
Novo contrato `a16-sugestoes` em `contracts.ts` (padrão `Object.freeze`,
executado via `AgentExecutorService`). Entrada: SOMENTE o JSON do motor
(ranking, série, causas, metas). Saída: dossiê de sugestões, cada uma com
(a) FK do dado-origem, (b) prática de gestão citada de um catálogo curado e
versionado (`"PraticaGestao"` seedada de fontes públicas — Rede Cegonha/RAMI,
vigilância do óbito, pré-natal; barra R4 = boletim SES-MT), (c) redação por
template determinístico com slots (RG-05); LLM, quando houver crédito, apenas
re-redige — e o A06 audita numerais da saída contra o conjunto autorizado.
Se consumir LLM: migração do CHECK `ConsumoLlm_Borda` (+`'A16'`).

### P8 · AUDITORIA
Ação nova `PESQUISA_EXECUTADA` na trilha com `pesquisaId` correlacionando
`EventoAuditoria` ↔ `Pesquisa` ↔ `AgentExecution` ↔ `ConsumoLlm` (hoje não há
correlação nenhuma — só timestamp). Cadeia verificada por
`verificar-cadeia.mjs` ao fim de toda rodada.

### P9 · CONTRATO-GENERICO
Prova com caso #2 (educação: matrículas/escolas INEP existentes) e caso #3
(finanças: conector SICONFI, ou gate humano com 2 caminhos) de que P2/P4/P5/P6
não têm NENHUM código especial por área — a área vem da taxonomia
(`TemaConsulta`) e do catálogo, nunca de `if` por domínio.

## 4. Ondas e dependências

- **Onda 1 (paralela)**: P1 (schema+módulo) ∥ P2 (ranking). Arquivos disjuntos;
  registro de suítes em `test-e2e.mjs` centralizado pelo líder para evitar conflito.
- **Onda 2**: P4 (integra P1+P2 no orquestrador) → P8 (correlação).
- **Onda 3 (paralela)**: P5 (dash pesquisa) ∥ P7 (sugestões com template determinístico).
- **Onda 4**: P3 (ingestão SIM/SINASC + dimensão de causa) → gate humano de aprovação.
- **Onda 5**: P6 (dash Xingú completo, consome P3/P7) → P9 (generalidade).
- Ratchet contínuo: cada APROVADO vira teste em `api/test/` registrado na suíte.

## 5. Críticos

Por peça: crítico visual/funcional em contexto novo, com o artefato real + a
referência de `referencias/README.md`, veredito APROVADO/VOLTAR + o maior gap
(um só). Especializados sobre o conjunto: determinismo (3× idêntico; nenhum
número fora do JSON do motor), dados (estado + 3 municípios vs fonte oficial),
gestão pública (sugestões vs R4), diferenciação (lado a lado; intenções
distintas), generalidade (casos #2/#3), persistência (nenhuma informação órfã;
reabertura idêntica do banco). Máx. 6 rodadas por peça; depois, gate humano com
2 caminhos propostos.

## 6. Condições de parada e entrega

Como no prompt de abertura, mais: evidência final no rito da casa
(`docs/evidence/gauntlets/` + ledger), requisitos novos como **RF023/RN16** no
`docs/spec/PRD.md` + **F2-R049** na rastreabilidade, seção **§3.7 "Pesquisa vs
IA Xingú — contrato de resposta"** em `docs/spec/ARCHITECTURE.md`, e ADR-010 se
a modelagem de dimensão de causa alterar arquitetura de dados.

Gates humanos conhecidos de antemão: aprovação RG-09 dos indicadores novos;
qualquer migration/ação em produção; fonte que exija autorização formal.
