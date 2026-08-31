# GAUNTLET-20260828-PESQUISA-VS-XINGU

**Ciclo:** 1 (9 peças, até 4 rodadas por peça)
**Fase:** F2 (borda de linguagem) com motor F1
**Requisitos:** F2-R049 · PRD RF023/RN16 · ARCHITECTURE §3.7
**Objetivo:** dois contratos de resposta (Pesquisa vs IA Xingú) sobre o mesmo
motor determinístico, com ranking, causas, sugestões com dado-origem e
persistência normalizada reabrível — sem relaxar RG-03/RN-005/RG-05/RG-09.

## Referência e contrato

Barra de qualidade REAL, aberta e comparada ao vivo pelos críticos
(`docs/gauntlet/referencias/README.md`): TabNet/SIM (completude), IBGE Cidades
(legibilidade), Painel de Mortalidade Infantil e Fetal SVS/MS (dashboard de
gestão), Boletim Epidemiológico SES-MT (linguagem de recomendação). Contrato
novo: `modo=pesquisa|xingu` no POST /v1/xingu/pergunta; `ranking_top` vs
`dossie`; tabelas `Pesquisa*` (db/48) com hash canônico verificado na
reabertura; correlação por `pesquisa_id` na trilha imutável; catálogo
`PraticaGestao` (db/51–52) com catraca anti-norma-revogada NA migração.

## TDD e ataque

Cada peça: builder → crítico independente em contexto novo (artefato real +
referência aberta). Ataques que reprovaram e viraram teste permanente:
- Crítico de dados refez tabulações no TabNet e provou taxa fabricada com
  parcelas de anos distintos (Sinop 8,7 falso; estado 15,4 vs 14,2 oficial) →
  zeros materializados + guarda de mesma referência (`causas.unit` g/h/i/j).
- Crítico-secretário conferiu normas na web e pegou RAMI revogada → db/52 com
  fontes oficiais verificadas + DO-block que aborta migração com norma morta
  (testado negativamente por injeção).
- Crítico visual mediu contradição mapa×ranking (RECALCULO sem observação
  própria) → helper único de pareamento; mapa=ranking provado célula a célula.
- Ataques de persistência: UPDATE/DELETE por grant, RLS sem contexto, tenant
  forjado, sugestão órfã — todos vetados; roundtrip byte a byte; 7 reaberturas
  `hash_confere=true` em 3 áreas.
- Corrida real na cadeia de auditoria (advisory lock no-op em transação
  tenant; 9 quebras/50 eventos) corrigida e provada por contrafactual.
- Generalidade: 3 áreas × 2 modos; caça a branch por área no caminho
  genérico: zero. Diferenciação: telas lado a lado, intenções distintas,
  números idênticos onde se sobrepõem.

## Regressão

`cd api && DATABASE_URL=postgres://itmt:itmt@localhost:5432/postgres npm test`
— 36 suítes (7 novas do gauntlet: pesquisas, ranking, modo, causas, sugestoes,
siconfi + extensões), banco descartável migrado do zero (53 migrações),
placar final: **212/212 PASS**, cadeia de auditoria íntegra — 347 eventos (verificador
recomputa SHA-256 de toda a trilha). Dados reais carregados por
migração-snapshot auditada (db/50 SIM/SINASC 2019–2024 com 35 cargas
hasheadas; db/53 SICONFI/DCA 2022–2024 com 423 cargas hasheadas), brutos
conferidos contra a fonte oficial por tabulação independente dos críticos.

**SOFTWARE_GATE:** PASS.
**OPERATIONAL_GATE:** BLOCKED_EXTERNAL até (1) aplicação das migrações 48–53
no banco dev pelo operador, (2) parecer RG-09 humano dos 4 indicadores novos
(nascem EM_ANALISE; o motor os filtra do público até o parecer), (3) rito de
produção fora do escopo local.
