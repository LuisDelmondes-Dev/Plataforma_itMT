# ADR-010 — Absorção incremental da arquitetura analítica externa (não substituição)

**Status:** Aceita
**Data:** 28/08/2026

## Contexto

Uma pesquisa de fontes (400+ sistemas, 25 conectores estruturantes na Fase 1 —
`C:\DevClaude\Analise das fontes.md`) gerou, em ferramenta externa, uma
arquitetura de banco completa ("V2 Refinada": 288 tabelas, 11 schemas,
snake_case, fato universal + fatos tipados, catálogo mestre de fontes,
resolução de entidades, esteira documental granular, camada semântica).

A análise comparativa (sessão de 28/08) concluiu: a proposta é superior como
MODELO ANALÍTICO-ALVO (cauda longa dimensional, catálogo de fontes, papéis de
território, crosswalks) e inferior como BANCO DE PLATAFORMA — tem zero
GRANT/papéis, zero RLS/multitenancy, zero particionamento, nenhuma auditoria
imutável encadeada, nenhum gate humano RG-09, e é 100% incompatível com a
convenção `"Tabela_Atributo"` consumida por todo o `api/src` (212 testes
verdes vigiam o conjunto atual). A proposta foi desenhada a partir da
pesquisa, sem conhecimento do sistema em produção.

## Decisão

A base atual permanece o núcleo governado. As ideias comprovadamente
superiores da proposta entram por MIGRAÇÃO INCREMENTAL (`db/54+`), adaptadas
à convenção da casa, cada uma com consumidor real no código e teste no
ratchet, nesta ordem de valor:

- **E1** — vocabulário de dimensões de observação orientado a dados
  (`"DimensaoObservacao"` versionada; fecha o gap do crítico de generalidade
  do gauntlet: hoje o CHECK + 4 pontos de código travam a 4ª área).
- **E2** — catálogo mestre de fontes (conjunto/recurso/campo/versão +
  cadastro de fontes municipais da seção 36 da pesquisa), absorvendo o
  `fontes-registry.mjs` hardcoded ("esse cadastro não deve ficar codificado
  no software" — a própria pesquisa).
- **E3** — tabelas de referência: status do dado
  (preliminar/consolidado/revisado), papel de território, faixas etárias e
  causas evitáveis como domínio curado.
- **E4** — staging tipado por conector (`integracao.*` da proposta) criado
  conector a conector, sobre o Bronze→Prata→Ouro existente.
- **E5** — resolução de entidades (quando o conector RFB/CNPJ nascer) e
  granularidade documental página→trecho→tabela→célula (evolução do módulo
  `documentos`).
- **E6** — persistência do banco de perguntas de regressão (golden set).

Adendo 28/08 (Fase 2 R1 da mesma proposta, examinada: +233 tabelas → 521;
44 fontes; 132 perguntas; bateria de segurança idêntica — 0 GRANT/RLS/
particionamento/trigger na extensão, adiados pelo próprio doc): o veredito e
a decisão NÃO mudam; o alvo analítico se amplia. Candidatos que entram na
fila QUANDO o conector consumidor nascer:
- **E7** — tempo subdiário/resolução temporal (ONS, ANA, PRF).
- **E8** — natureza do valor como domínio: observado/estimado/modelado/
  projetado (Anatel: cobertura é estimativa teórica; EPE: projeção por
  cenário) — generaliza a `categoria` já existente nas séries.
- **E9** — privacidade por projeto: base legal, finalidade, mínimo de
  célula, risco de reidentificação (CadÚnico agregado × restrito).
- **E10** — redes lineares (via/trecho/km/sentido) para DNIT/PRF/Anatel.
- **E11** — fase de homologação do dado (Sinesp/SISDEPEN/SINISA: coleta ≠
  ano-base ≠ publicação; preliminar ≠ consolidado) — fundir com E3.
Convergências registradas (a proposta reinventou doutrinas da casa, o que as
valida): 132 perguntas ≈ golden set/ratchet; limite_resposta ≈ RN-005;
consistencia_cruzada ≈ RN12; observado×projetado ≈ categoria de série.

Adendo 28/08 (Fase 3 R1: +182 tabelas → 703; municipalização 142×28 = 3.976
slots; 160 perguntas; bateria de segurança idêntica — zeros): veredito
inalterado. Absorções decorrentes:
- **E4 (imediata)** — malha territorial completa dos 142 municípios como
  migração-snapshot via conector ibge-territorio (fecha a limitação de
  fixture "prova do 211 é indireta" do crítico P3; os totais oficiais do
  db/50 passam a ser assertáveis no ratchet) + 17 consórcios conhecidos
  (SES-MT/CINCOP) SEM membership (curadoria honesta: vínculo só por ato).
- **E12 (quando o harvester municipal nascer)** — cadastro de fontes
  municipais 142×28 (`lacuna_publicacao`, fornecedor/endpoint/vigência,
  divergência local×TCE×SICONFI) — a matriz F3 é o insumo pronto.
- Convergência forte adicional: `lacuna_publicacao_municipal` (ausência ≠
  zero) É a RN-005; urbanismo temporal e vicinais-como-rede entram com os
  respectivos conectores.

Adendo 28/08 (Fase 4 R1: +179 tabelas → 882; schema `parceria` com 102
tabelas de governança de dados conveniados; 42 fontes candidatas; 180
perguntas; bateria de segurança: os mesmos zeros — ironicamente, o schema
sobre governança de ACESSO não tem GRANT/RLS algum): veredito inalterado.
No laboratório físico, a migração F1-3→F4 aplicou LIMPA de primeira sobre a
base corrigida (882 tabelas, 2.403 FKs reais, 472 perguntas, 42 parceiros) —
qualidade de DDL visivelmente superior às fases 1–3. Absorções:
- **E5 (imediata)** — 42 fontes parceiras F4 no "FonteConector" (db/58):
  conveniadas = BLOQUEADA_EXTERNA (candidato ≠ convênio, frase do próprio
  pacote); com publicações públicas = PLANEJADA (parte aberta coletável).
Adendo 28/08 (Fase 5 R1: +247 tabelas → 1.129; dados PRÓPRIOS — VANT/
geodésia/fotogrametria/360/mídia/pesquisa domiciliar em 4 schemas novos;
bateria: mesmos zeros; 159 colunas geometry — fase mais geoespacial, a
validação sem-PostGIS do lab cobre menos aqui): veredito inalterado; no lab,
F4→F5 aplicou LIMPA (1.129 tabelas, 3.037 FKs reais, 682 perguntas). SEM
absorção imediata — decisão: os 8 programas próprios não são conectores
externos; o consumidor real é o módulo `producao` da plataforma (F5 do
programa: CapturaCampo/CapturaImagemRua/AtivoMidia/acervo/geoportal), já
existente em embrião. Fica como **E14**: absorver cadeia de custódia,
qualidade/acurácia, privacidade visual e desenho amostral do modelo externo
QUANDO os programas de campo forem operacionalizados. Padrões adotáveis
anotados para o ADR-009/GIS: COG 1.0, STAC 1.x, COPC 1.0, 3D Tiles 1.1,
LAS 1.4+, RBAC 100/2026, SARPAS. Convergências: cadeia de custódia SHA-256 ≈
nosso Bronze; "opinião não vira fato" ≈ RG-03 aplicado a entrevista;
contribuição cidadã ≠ produção oficial ≈ nossa procedência; pesquisa com
CV/IC ≈ E8 (natureza do valor). Nota de qualidade registrada: as 210
perguntas da F5 são template (10×21), inferiores às gauntlets F2–F4.

Adendo 28/08 (pacote "Core R2.1 — Periodicidade e Orquestração": modelo
universal de periodicidade em 3 schemas/10+ tabelas — política, calendário,
SLA, revisão retroativa, estado operacional): mesma régua, absorção
conceitual sem cópia de DDL.
- **E15 (imediata, db/59)** — separação verificação ≠ ingestão ≠ latência ≠
  frescor no catálogo vivo: `"FonteConector"` ganha cadência de checagem
  (`_IntervaloVerificacaoDias`, NULL herda a janela do tipo), latência
  esperada de publicação (`_LatenciaEsperadaDias`) e competência carregada
  (`_UltimaCompetencia`, preenchida quando o conector reportar);
  `"FonteSincronizacao"` ganha `_Frescor` calculado a cada rodada
  (DESCONHECIDO/EM_DIA/ATENCAO/ATRASADO/INDISPONIVEL — vocabulário reduzido,
  sem ADIANTADO/CRITICO/DESCONTINUADO até existir consumidor). Regra
  essencial absorvida, irmã da RN-005: **ausência de atualização não
  significa automaticamente falha** — Caged de julho publicado em setembro
  não está "atrasado"; fonte bloqueada/planejada é DESCONHECIDO, nunca
  ATRASADO. Calendário oficial de publicação, SLA formal com escalonamento,
  reprocessamento retroativo e herança recurso>conjunto>fonte ficam para
  quando houver consumidor (registrado em db/59).

Adendo 29/08 (pacote "Core R2" — migração R1→R2, 92 tabelas: contratos de
dado/produtos, versionamento de indicador com compatibilidade, políticas de
particionamento/indexação/armazenamento/frescor POR PRODUTO, materialização
analítica, anomalia de dado, evento de schema): chegou DEPOIS do R2.1 e a
inversão de ordem não causou atrito — aplicou limpo no lab, fechando o
consolidado em **1.239 tabelas exatas** (= a validação do próprio gerador),
3.273 FKs reais. Bateria de segurança: os mesmos zeros. Defeito achado (3ª
ocorrência da classe "seed silencioso"): a gauntlet consolidada de 902
perguntas existia só em CSV — `capacidade_analitica` tinha 682; LAB-FIX
carregou as 100 da F1 e as 120 cross-phase do R2 (902/902). SEM absorção
imediata nova: contrato de dado/produto pressupõe consumidores publicados
(nosso equivalente embrionário é o quinteto de procedência + RG-09); fica
como **E16** — contrato de produto de dado com política de frescor por
produto — QUANDO a plataforma publicar produtos de dado formais (DCAT já
existe em `interoperabilidade`, é o gancho natural).

- **E13 (quando o primeiro convênio nascer)** — governança de acordo:
  finalidade, granularidade máxima publicável, política por campo, política
  de uso em IA/LLM/embedding/treinamento, sala limpa, reconciliação
  público×privado. Convergências: nosso módulo `parceiros` (API keys,
  escopos, quotas) e `TENANT_DATA_CLASSIFICATION` já são o embrião; a
  "política de IA por acordo" conversa com A15/cofre; "investimento
  anunciado ≠ executado" e "cobertura declarada ≠ medida" são a doutrina
  observado×projetado (E8) aplicada ao dado privado.

Adendo 28/08 — **E3 ENTREGUE** (db/60, com a **E11 fundida** como o próprio
ADR mandou): dos quatro sub-domínios listados na E3, entrou APENAS o que tinha
consumidor real — **status do dado** ('PRELIMINAR'/'CONSOLIDADO'/'REVISADO',
NULL = desconhecido e omitido, ausência honesta irmã da RN-005) como coluna
"Observacao_StatusDado", anexado ao quinteto de procedência pelo motor
(valor, agregado, ranking, mapa e citações da Xingú; selo "dado preliminar"
na régua de procedência do portal, sem texto de LLM — RG-03 intacto). Regra
de agregação: o PIOR status vence (PRELIMINAR contamina; parcela desconhecida
impede afirmar CONSOLIDADO). Curadoria inaugural: SIM/SINASC 2019–2024 ⇒
CONSOLIDADO (evidência escrita no cabeçalho do db/50: "dados FINAIS até 2024,
atualizados em 02/12/2025 na fonte"); nenhum ano marcado PRELIMINAR porque
nenhum está documentado como tal — o restante da base fica NULL. Ratchet:
api/test/status-dado.unit.mjs. ADIADOS por falta de consumidor (gatilhos em
db/60): papel de território (nenhuma superfície pergunta papéis), faixas
etárias (o componente etário já é dimensão E1 no "DimensaoObservacao") e
causas evitáveis como domínio curado (a lista SVS/MS já vive como categorias
em "ObservacaoCausa"; virar tabela de referência só quando algo precisar
enumerá-la/validá-la).

Adendo 28/08 — **E6 ENTREGUE** (db/61), o último degrau da lista original: o
golden set (KR3.1/3.3) vira dado governado. `"GoldenPergunta"` guarda o banco
de perguntas com código estável (sha256 do texto, 16 hex — o texto é a
identidade, o plano esperado evolui com o catálogo), origem GERADA×CURADA
(o gerador jamais toca CURADA) e aposentadoria por `Ativa=false` — nunca
DELETE (padrão db/55). `"GoldenAvaliacao"` é o histórico das rodadas,
**append-only por grant** (SELECT+INSERT para `itmt_app`, como db/39 e
db/48), provado por SQL direto no ratchet. Decisões: SEM seed na migração
(o dado nasce do catálogo real de cada instalação via `golden:gerar`, nunca
de fixture); o JSON `api/golden/golden-set.json` continua sendo escrito, mas
vira DERIVADO — `golden:avaliar` lê do banco quando `DATABASE_URL` existe e
cai para o JSON quando não (degradação segura, espírito da RG-05); com banco,
cada rodada é gravada e comparada com a anterior (regrediu/melhorou por
pergunta — o ganho real da persistência, antes perdido no stdout). Catálogo
global sem tenant/RLS (audita o motor, não dado de inquilino). Núcleo
extraído para `api/scripts/lib-golden.mjs` (funções puras testáveis sem
API no ar); ratchet: `api/test/golden.unit.mjs` + linhas novas na catraca
de menor privilégio.

Adendo 29/08 (pacote "Core R2.2 — Framework Universal de Ingestão": 46
tabelas em schema `ingestao`; tese central — o worker não carrega a regra da
fonte dentro dele, ele PERGUNTA AO BANCO como executar): mesma régua,
absorção conceitual sem cópia de DDL. **E17 ENTREGUE** (db/62): a
CONFIGURAÇÃO de cada ingestão sai dos arquivos (api/ingest-configs/*.json)
e vira `"FonteConectorConfiguracao"` no catálogo vivo — versionada (versão
inteira crescente, UMA vigente por slug via índice parcial único), com
histórico imutável por trigger (UPDATE só do flag de vigência; DELETE nunca
— veto de banco, doutrina F3/F4) e hash canônico
sha256((conteudo::jsonb)::text) calculado pelo próprio banco, a mesma forma
da cadeia de auditoria. É o precedente E2 um degrau abaixo: db/55 absorveu o
REGISTRO de conectores; db/62 absorve a REGRA de execução de cada carga.
Consumidor real: `carregarConfigIngestao()` em scripts/lib-ingest.mjs +
ingestar-csv.mjs — banco primeiro (versão vigente pelo slug = nome do
arquivo sem extensão); arquivo é fallback RG-05-like (banco pré-db/62 ou
slug fora do catálogo — as configs derivadas run-*.json do coletor Python
caem aí por construção); divergência banco×arquivo ⇒ warn com os dois
hashes e o banco vence. Ratchet: api/test/config-ingestao.unit.mjs — quem
editar um .json sem registrar versão nova quebra a suíte (catraca
anti-drift). Mapeamento grão-fino config→conector semeado com honestidade
(cnes-* → cnes; inep-* → inep; pam-area-plantada → ibge-f1, que já carrega
a PAM via SIDRA 5457; demais 1:1 de db/55). Ficam para depois, com gatilho
registrado em db/62: pipeline declarativo como DAG (TPL_* do R2.2 — espera
um orquestrador de workers real), descoberta automática de recursos (espera
o conector CKAN; dados-gov-br/dados-abertos-mt seguem PLANEJADA em db/56) e
rate-limit/retry/circuit-breaker como política de banco (espera mais de um
consumidor de política HTTP). Convergências que NÃO viram código — o R2.2
reinventou doutrinas da casa, o que as valida: credencial por
vault-reference (nunca o material) ≈ nosso cofre AES-256-GCM; logs
sanitizados de tokens/PII ≈ nossa doutrina de segredos; separação
transporte×parser ≈ coletores Python (transporte/normalização) + conector
Node auditado (parse/carga), que nunca escrevem no banco diretamente.

**CORREÇÃO (31/08/2026).** Este parágrafo afirmava, até aqui, mais três
convergências que a auditoria do nosso próprio pipeline derrubou. O texto
anterior dizia que "checkpoint em duas fases ≈ nosso Bronze→Prata→Ouro com
drift bloqueando a promoção (RF-INGEST-005); idempotência por chave ≈ nosso
SHA-256 do bruto + dedup de Carga; quarentena que não apaga nem contamina ≈
RF-INGEST-010". **As três eram aspiracionais** — descreviam a intenção do
desenho, não o que o código fazia:

- **Não havia checkpoint algum.** `registrarCarga` inseria a `Carga` já com
  status `PROMOVIDA`, ANTES de Prata, de Ouro e de qualquer checagem de
  qualidade; `Carga_Status` era `text` sem CHECK e o estado "ainda não
  validada" não existia no vocabulário. O drift não impedia a promoção da
  carga em curso — ele fazia a promoção SEGUINTE lançar exceção. Medida no
  banco dev: 12 cargas `PROMOVIDA` sem uma observação sequer, e a carga 96
  com 141 de 141 linhas em quarentena, também `PROMOVIDA`.
- **A idempotência da carga era cortesia da aplicação.** O dedup por
  `(Fonte, SHA-256)` existia só como `pg_advisory_xact_lock` + SELECT em
  `lib-ingest.mjs`; não havia UNIQUE no banco — o oposto da doutrina "vetos
  são de banco". O passivo prova: 7 pares duplicados no dev.
- **A quarentena contaminava, sim.** `quarentenar` fazia INSERT
  incondicional e `LinhasQuarentena = LinhasQuarentena + 1`; como a
  reexecução do mesmo Bronze devolve a MESMA carga, cada rodada acumulava:
  2806 linhas para 1512 registros reais (46,1% de cópias) e 11 cargas com
  `LinhasQuarentena` maior que `LinhasLidas`.

As três **passaram a ser reais com o db/63** (E18/E19, abaixo). Fica o
aprendizado de método: convergência anotada em ADR não é evidência de que o
código a implementa — enquanto não houver teste no ratchet provando o
comportamento, é intenção. As convergências que sobraram no parágrafo acima
são as que já tinham prova.

Adendo 31/08 (**E18 — checkpoint em duas fases na carga** e **E19 —
idempotência da quarentena**, db/63): primeira evolução do ADR-010 que não
absorve ideia externa — **conserta dano ativo** achado pela auditoria acima.
`Carga_Status` ganha CHECK e o estado inicial `CANDIDATA`, que vira o
DEFAULT: a carga nasce candidata (bruto salvo, nada validado) e só vira
`PROMOVIDA` por `confirmarCarga()`, chamada depois do Ouro e **na mesma
transação do Ouro** (nos conectores com transação própria; nos que usam
`promoverObservacoes`, na mesma CTE, e só se algum município casou com a
malha). Carga que falha no meio fica `CANDIDATA` — a verdade sobre ela.
Desbloquear drift passa a devolver a carga a `CANDIDATA`, nunca direto a
`PROMOVIDA`: sair do bloqueio significa "pode tentar de novo", não "deu
certo". O dedup `(fonte, hash)` vira veto de banco em duas camadas —
UNIQUE onde o dado permite, e trigger com o mesmo advisory lock **sempre**,
porque o passivo histórico do dev (7 pares) impede criar o índice lá e
reconciliar é ato humano (em 4 dos 7 pares é a linha de id MAIOR que
carrega as observações, então nem "manter a primeira" é derivável).
A quarentena ganha chave lógica gerada pelo banco — sha256 de (registro
canônico ‖ LF ‖ motivo) — com UNIQUE e `ON CONFLICT DO NOTHING`, e
`Carga_LinhasQuarentena` deixa de ser incrementada pela aplicação: vira
coluna derivada mantida por trigger (+1/−1), impossível de inflar por
construção. Consumidores que passam a significar algo: `alerta-fontes.mjs`
("em dia" agora exige carga confirmada — antes media o momento do
DOWNLOAD) e o dossiê RG-09 de `validacao-tecnica.service.ts` (distingue
`CANDIDATA` de `BLOQUEADA_DRIFT` para o revisor). O db/63 deduplica a
quarentena histórica (correção de bug: cópias byte a byte) e reconta o
contador, mas **se recusa a reclassificar as 12 cargas sem observação**: o
critério "sem observação ⇒ nunca foi promovida" é provadamente falso nesta
base — o conector de território tem como Ouro a malha `Municipio` e por
construção não gera observação alguma. Inventário documentado no cabeçalho
da migração, decisão do humano. Ratchet: `api/test/carga-candidata.unit.mjs`
(vetos provados por SQL direto) + ajustes em `lib-ingest.unit.mjs` e
`bordas-decisao.unit.mjs`.

Adendo 31/08 (**E20 — status do VALOR como domínio curado**, db/64): segunda
evolução seguida que não absorve ideia externa inédita — **conserta dano
ativo**. Duas evidências independentes convergiram no mesmo dia:

- **(a) auditoria do nosso próprio código.** O MESMO símbolo, da MESMA fonte,
  tratado de três formas por quatro conectores. `ingestar-pacote-f1-ibge.mjs`
  documentava certo e convertia `-` do SIDRA para 0; `ingestar-ibge-agregado.mjs`
  e `ingestar-ibge-populacao.mjs` mandavam o mesmo `-` do mesmo IBGE para a
  quarentena como se fosse ausência — o município que a fonte declarou ter
  ZERO sumia da base, e o motor passava a omitir onde havia resposta;
  `coletores/coletar_fontes.py` destruía a distinção ANTES de qualquer
  conector ver, com `to_numeric(coerce)+dropna()` em `_normalizar` (célula
  vazia, `-`, `...`, `X` sumiam do CSV: para CNES e INEP a supressão da fonte
  era invisível ao pipeline auditado) e — pior — `fillna(0)` em `_por_nome`,
  que INVENTAVA zero para célula ilegível, defeito que a auditoria original
  ainda não tinha visto. E o motivo de quarentena era string livre: "código
  IBGE fora de MT" e "valor suprimido pela fonte" eram indistinguíveis.
- **(b) documentação oficial, via o pacote externo "Core R2.3.3".** O pacote
  chegou à mesma conclusão pela legenda do SIDRA e registra explicitamente a
  correção ("a versão anterior tratava `-` como ausência"). A ideia absorvida
  não é o DDL (nada foi copiado): é que **a convenção de símbolos da fonte é
  DADO de governança** — versionado, curado, citável — e não constante no
  parser. É a tese da E17 um degrau adiante: db/55 absorveu o REGISTRO do
  conector, db/62 a REGRA DE EXECUÇÃO da carga, db/64 a REGRA DE LEITURA DA
  CÉLULA.

O que entrou: `"StatusValor"` (domínio curado com a regra de promoção como
DADO — `_Promovivel`, `_ValorImplicito`), `"ConvencaoValorFonte"` +
`"ConvencaoValorSimbolo"` (convenção por fonte, versionada, com documentação
`NOT NULL` — regra sem citação é palpite), `"FonteConector_ConvencaoValor"`
ligando o catálogo vivo de db/55, e na `"Quarentena"` um **código de razão
tipado** mais o **símbolo original preservado**. A regra inteira em uma
frase: **só `VALOR` e `ZERO_ABSOLUTO` viram observação numérica; o resto não
vira zero e não vira observação**. Um único ponto de decisão —
`classificarValor()` em `scripts/lib-ingest.mjs` — substitui as quatro
opiniões, com fallback embutido (RG-05-like) para banco pré-db/64, de modo
que o `ingestar-pacote-f1-ibge`, o único que já acertava, não regride.

Tabela × CHECK seguiu o precedente da casa, não o gosto: `"StatusValor"` é
TABELA como `"DimensaoObservacao"` (E1, db/54 — o vocabulário é ditado pelas
FONTES e a semântica que o código consome virou coluna, então um sexto
símbolo entra por curadoria sem tocar o classificador); o código de razão da
quarentena é CHECK como `"Carga_Status"` (db/63) e `"Observacao_StatusDado"`
(db/60), porque esse vocabulário é NOSSO — razão nova só existe quando um
validador novo existe, e tabela ali seria join sem destravar nada.

Conciliação com o db/50, sem contradizê-lo: o db/50 já raciocinara sobre o
TabNet em prosa e materializara 211 zeros sob a guarda "tabulação ESTADUAL
COMPLETA ⇒ `-` é zero eventos; tabulação PARCIAL ⇒ ausência de coleta,
RN-005". O db/64 **torna a prosa executável**: a convenção se chama
`TABNET_TABULACAO_COMPLETA` — o nome carrega a condição — e só é atribuída aos
dois conectores cuja completude o db/50 documenta. Não existe convenção
`TABNET` genérica de propósito.

Vocabulário adotado (6, todos com consumidor hoje): `VALOR`, `ZERO_ABSOLUTO`,
`SUPRIMIDO`, `NAO_APLICAVEL`, `NAO_DISPONIVEL`, `INVALIDO`. **ADIADO com
gatilho:** `FAIXA_VALOR` (as letras `A`–`Z` exceto `X`) — nenhum agregado que
ingerimos publica faixa por letra, e a própria migração do pacote externo não
semeia essa linha (ela existe só na tabela do .md); corte YAGNI na régua do
db/59. O adiamento é **seguro por construção**: letra cai em `INVALIDO`, vai
para a quarentena e nunca vira zero. Também ficaram sem convenção, de
propósito, `cnes` e `inep` (é provável que sigam os mesmos sinais, mas
provável não é documentado) e `datasus-tabnet` (cubo indeterminado — atribuir
a regra de tabulação COMPLETA a cubo desconhecido é o erro que o db/50
proibiu); todos caem no default seguro, que já é ganho enorme sobre "sumir no
Python". Gatilho: curadoria que registre a legenda com citação.

Coletores Python: continuam **sem escrever no banco** — só pararam de
destruir informação. `_normalizar` preserva a célula original e só descarta
por TERRITÓRIO; `_por_nome` deixou de inventar zero e falha alto em célula
ilegível (aquele caminho agrega por soma e não tem como preservar a célula
até o conector, então a saída honesta é recusar, não chutar). O
`preencher_zeros` continua válido e é outra coisa: afirma sobre LINHA AUSENTE
num recorte completo, não sobre célula — a mesma doutrina do db/50.

Ratchet: `api/test/status-valor.unit.mjs` (9 testes), com a catraca que
importa — nenhum dos quatro conectores pode voltar a comparar um sinal
convencional na mão, e o fallback embutido tem de bater símbolo a símbolo com
o seed do db/64. Nada é reclassificado retroativamente: quarentena anterior
fica com código NULL, que é a verdade (mesmo critério do db/60). Medido no
banco dev, em leitura: das 1.512 linhas únicas de quarentena, **1.293 (85,5%)
são células `-` de agregados do IBGE** — zeros que a fonte afirmou e que o
pipeline vinha jogando fora; elas voltam como observação na próxima carga de
cada conector, não por UPDATE.

Substituição integral foi REJEITADA: reescreveria todo o SQL da API, os 212
testes e as evidências de gate, para reimplementar do zero invariantes que a
proposta não contempla.

### E21 — malha territorial vigente na data de referência (db/66)

**O gap era entre dois pedaços da própria casa, não uma falta de dado.**
`"Municipio_DataInstalacao"` existe desde o db/57 (E4) e era usada **11 vezes
dentro do próprio db/57 e em nenhum outro lugar do programa** —
`grep -rn "DataInstalacao" api/src/` devolvia zero. A plataforma sabia quando
cada município foi instalado e o motor tratava os 142 municípios como
universo fixo em qualquer ano. Boa Esperança do Norte (5101837) foi instalado
em 2025-01-01: numa referência de 2022 ele não é dado **faltante**, está
**fora do universo**. Contar ausência onde não há território é o espelho da
imputação que a RN-005 proíbe — lá se inventa número, aqui se inventava
lacuna.

**Medido, não suposto.** No banco dev (leitura, 31/08/2026), o indicador
"População residente — Censo 2022" (db/19) tem cobertura COMPLETA da malha
real de 2022 e mesmo assim o ranking respondia
`total_municipios: 142, ausentes: 1 (5101837)` — a verdade é `141, ausentes:
0`. O portal dizia "1 município sem dado" onde não faltava absolutamente
nada.

**As duas evidências externas.** (1) *Fonte oficial, medida ao vivo por nós
em 31/08*: a API SIDRA do IBGE (tabela 4709, variável 93, período 2022, nível
município, UF 51) devolve **exatamente 141 registros**, sem Boa Esperança do
Norte; conferido contra o snapshot desta base **como conjunto exato, zero
diferença nos dois sentidos**. (2) *Documentação externa, pacote Core R2.3.4*:
modela a mesma regra como `referencia.municipios_mt_validos_em(data)` e a
promove a **gate bloqueante de homologação (H03)**. Nenhum DDL foi copiado — o
pacote usa outro esquema, outra nomenclatura e uma tabela `territorio`
genérica que esta casa não tem. O que se absorve é a **tese**: "quais
municípios existiam na data X" é pergunta de PRIMEIRA CLASSE do motor, não
detalhe de carga. Provado no laboratório: 141 em 2024-12-31, 142 em
2025-01-01.

**Forma escolhida: função, e a alternativa recusada.** View não recebe
parâmetro, e a pergunta é inerentemente parametrizada pela data — uma view
"vigente hoje" seria pior que o bug, porque congelaria o presente sobre a
série histórica. Coluna derivada só pode ser verdadeira em relação a UMA
data. Ficou `"MunicipiosVigentesEm"(date)`, função SQL `STABLE` no padrão que
a casa já usa para pergunta parametrizada com grant próprio
(`"ResolverApiClientePorHash"`, db/29; `"ContextoTenant_Id"`, db/24),
`SECURITY INVOKER` de propósito (`"Municipio"` já é legível por `itmt_app` e
não tem RLS — DEFINER seria privilégio sem necessidade), `REVOKE` de PUBLIC +
`GRANT EXECUTE` só a `itmt_app`.

**A metade que carrega o peso é o NULL.** `DataInstalacao` é NULL em **141 dos
142** municípios, e NULL significa "existe desde sempre no horizonte da base",
não "data desconhecida". O db/57 já escrevia inline exatamente
`DataInstalacao IS NULL OR <= data` (linhas 1815 e 1837); o db/66 não inventa
regra, **promove esse predicado a nome próprio**. Escrever só `<= p_data`
devolveria 0 municípios em 2022 e 1 em 2025 — erro catastrófico e silencioso,
por isso está travado no ratchet.

**Consumidor real:** `IndicadoresService.ranking()` e `.mapa()`. No ranking a
correção é **visível ao usuário** (`total_municipios` e `ausentes` alimentam
"N municípios sem dado" no dossiê e "Ver todos os N municípios"); no mapa é
hoje **numericamente inerte** — município não instalado não tem observação ≤
referência, então já não entrava na lista — e foi feita mesmo assim pela
coerência declarada em `paresRecalculo()`: ranking e coroplético do mesmo
dossiê partem do MESMO universo por construção, não por coincidência
aritmética.

**Achado colateral, registrado sem corrigir:** `web/public/mt-municipios.geojson`
tem **141 feições e não contém 5101837**. Ou seja, o mapa nunca pintou Boa
Esperança do Norte como "sem dado" — ele simplesmente não a desenha, em ano
nenhum. Isso é correto para 2022 e **errado para 2025+**, mas é lacuna de
GEOMETRIA (arquivo de malha do IBGE), não de motor, e nenhuma mudança em
`indicadores.service.ts` a resolve. GATILHO: atualizar o geojson para a malha
de 2025 — e aí o consumidor da E21 já existe para dizer, por ano, quem deve
ser desenhado.

Ratchet: `api/test/malha-vigente.unit.mjs` (5 testes), registrado no runner
logo após `malha.unit.mjs` e antes de `ranking.unit.mjs` (os municípios
sintéticos 5199xxx daquela suíte ainda não existem). Arquivo novo em vez de
extensão de `malha.unit.mjs` porque aquela trava o SNAPSHOT (invariante de
dado) e esta trava a LEITURA NO TEMPO (invariante de motor) — misturá-las
faria falha de motor parecer falha de malha no relatório do gate. O teste do
motor usa fixture sintética porque, num banco migrado do zero, **nenhum
indicador APROVADO tem observação ≤ 2022** (os 6 do seed começam em
2025-12-31): o Censo 2022 está `EM_ANALISE`, e isso está certo — publicar é
ato humano (RG-09), e só o dev tem a curadoria feita. A catraca decisiva é
dupla: em 2022 o município novo **não** é ausente; em 2025 ele **é** ausência
legítima — a E21 não o esconde, o coloca no tempo certo.

**ADIADO com gatilho:** (a) *extinção/fusão* de município (`valido_ate` no
vocabulário do pacote externo) — MT não teve nenhuma no horizonte desta base e
a coluna não existe em `"Municipio"`; inventá-la agora seria schema sem
consumidor, o corte YAGNI da régua do db/59. Gatilho: a primeira lei estadual
de extinção/fusão curada; a função é o ponto ÚNICO onde o predicado entraria —
é justamente por isso que é função e não predicado espalhado. (b) *sucessão
territorial* (o território do município novo saiu de outro; comparar 2022 com
2025 compara malhas diferentes) — exige o ato de desmembramento com as
parcelas de área/população, dado que não temos. Gatilho: curadoria da lei de
criação com o município de origem; até lá o motor não afirma continuidade,
responde por data. (c) `resolverRecorte('ESTADO')` no `TerritorioService`
continua sobre a malha inteira, de propósito: ali o conjunto é FILTRO de
observação, e município não instalado não tem observação ≤ referência — a
mudança seria numericamente inerte e tocaria todos os recortes. Gatilho: se
algum dia existir observação datada ANTES da instalação (hoje impossível — o
db/57 apaga essas linhas e o ratchet trava). (d) `IndicadoresService.cobertura()`
não recebeu a malha vigente porque **não tem uma data de referência**: agrega
`max(DataReferencia)` sobre todo o histórico. Sem data, "vigente em quando?"
não tem resposta, e arbitrar uma em silêncio é o que a RN-005 proíbe. Gatilho:
quando a matriz ganhar parâmetro de ano.

## Consequências e riscos

Cada evolução carrega grants mínimos e testes próprios (catraca de menor
privilégio continua valendo). O dado existente migra por mapeamento direto
quando/SE um DW dimensional tipado se justificar (E4+); a cadeia de auditoria
nunca é convertida — move-se verbatim ou permanece. Risco aceito: conviver
com dois vocabulários (convenção da casa × nomes da proposta) na documentação
— mitigado registrando neste ADR o mapeamento conceitual.

Adendo 31/08 (Core R2.3.5 — Execução Física Certificada): 5 tabelas de
certificação (snapshot imutável de gates e artefatos, raiz SHA-256 das
evidências, payload canônico, verificador independente). Aplicou limpa no
laboratório. Teste adversarial próprio, seis tentativas de fabricar um
certificado sem execução real: **cinco bloqueadas corretamente** — inclusive o
caso `NAO_EXECUTADO`, que recusaria a nossa própria homologação parcial de 6
de 12 gates. **Uma passou:** um artefato inventado, com SHA-256 arbitrário e
sem arquivo por trás, satisfaz a elegibilidade — a função verifica a FORMA da
evidência, não a PROCEDÊNCIA. Reportado ao gerador com a cura sugerida (re-ler
os bytes de cada artefato e conferir contra o hash antes de declarar elegível,
como o certificador já faz com o core.sql e os arquivos de runtime).

**SEM absorção imediata, por disciplina.** A ideia central — "certificação é
consequência da evidência, nunca um status manual" — já é doutrina desta casa
em duas formas: `EventoAuditoria` encadeada por SHA-256 com verificador
independente (`verificar-cadeia.mjs`, que recomputa a cadeia inteira sobre os
payloads reais), e o rito RG-09, em que publicar é ato humano registrado. Fica
como **E22**, com gatilho explícito: ligar criptograficamente o ledger de
evidências (`docs/evidence/ledger.md`, hoje prosa em markdown) às linhas de
`EventoAuditoria` que sustentam cada EV, QUANDO houver consumidor real — por
exemplo uma auditoria externa que precise verificar um gate sem confiar no
repositório. Criar as tabelas antes disso seria violar a própria regra do ADR:
nenhuma tabela sem quem a consuma.

Registrado também que o pedido do pacote para provisionar um projeto de banco
em nuvem NÃO foi atendido: é ato externo com custo, solicitado dentro de um
documento e não pelo usuário, e contradiz o `Guia_Local_Only.md` da mesma
entrega, que declara a plataforma local-first. A execução física já acontece
localmente; o que falta para os seis gates restantes é o pacote Python do
runtime, nunca entregue.

Adendo 31/08 (Core R2.3.6 — Instalação e Execução Física Local): 5 tabelas de
controle operacional local (ambiente, migração aplicada com SHA-256, healthcheck,
backup, teste de restauração), papéis PostgreSQL separados, observabilidade
(`pg_stat_statements`, slow query, log de DDL) e um controlador único de ciclo
de vida. Bateria: os mesmos zeros de sempre.

**Convergência confirmada e MEDIDA, não apenas anotada.** A tese central do
pacote — *"não basta ter backup; é preciso ter backup comprovadamente
restaurável"* — já é doutrina desta casa desde o `provar-backup-restore.mjs`
(`npm run test:restore`). Executamos a nossa prova com as 66 migrações
aplicadas: **PASS**, 86 tabelas restauradas, backup em 1,06 s e **RTO de
restauração em 9,35 s**. A nossa versão ainda reporta RTO, que a deles não
mede. Registre-se o método: esta convergência foi verificada rodando, e não
declarada — exatamente a lição que o adendo do E18/E19 obrigou a aprender.

**Um gap real, com consumidor real: E23 — papel próprio para a ingestão.**
Hoje `lib-ingest.mjs` conecta pelo `DATABASE_URL`, cujo padrão é o **dono
superusuário**, e a catraca de menor privilégio (`least-privilege.unit.mjs`)
vigia apenas o `itmt_app` da API. Ou seja: a superfície que baixa arquivo da
internet, faz parse e escreve é a que roda com mais privilégio de todas — o
inverso do desejável. O pacote propõe `itmt_ingest` com grants restritos, e a
proposta é boa e alinhada à doutrina "dois papéis" já documentada.

**Não absorvido nesta rodada, por prudência operacional e não por dúvida
técnica.** Criar o papel exige escrever no banco de desenvolvimento do usuário,
reemitir grants sobre ~86 tabelas e trocar a credencial de todos os conectores;
feito errado, quebra a ingestão inteira. É mudança de infraestrutura que pede
decisão e janela do usuário, logo após ele ter aplicado 18 migrações. Fica
como **E23**, com o gatilho explícito: executar quando o usuário puder validar
a ingestão ponta a ponta com a credencial nova. Os demais itens (observabilidade,
registro de healthcheck e de backup no próprio banco, papéis `itmt_admin` e
`itmt_readonly`) permanecem sem consumidor identificado e não entram.
