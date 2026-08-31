# STATUS — Gauntlet "Pesquisa vs IA Xingú"

Atualizado a cada iteração pelo agente líder. Vereditos: APROVADO / VOLTAR /
BLOQUEADO (gate humano). Plano: `PLANO.md` · Referências: `referencias/README.md`.

| Peça | Onda | Rodada | Veredito | Maior gap | Referência |
|---|---|---|---|---|---|
| P1 PERSISTENCIA-PESQUISA | 1 | 1 | **APROVADO** | hash não verificável na reabertura → requisito da P4 | ataque SQL direto |
| P2 MOTOR-RANKING | 1 | 2 | **APROVADO** | total_estadual ausente → corrigido na rodada 2 | R1 (TabNet aberto e tabulado) |
| P3 MOTOR-CAUSAS | 4 | 3 | **APROVADO** (ataque re-executado → 404 correto; TMI motor×SQL 6/6 anos; fidelidade TabNet re-conferida ao vivo) | prova do "211" é indireta — malha completa só no dev (limitação de fixture, não bloqueia) | R1 |
| P4 RN-MODO (+P8 embutida) | 2 | 1 | **APROVADO** | diferenciação substantiva depende de P3/P7 (por desenho) | contrato PLANO + comportamento pré-modo |
| P5 DASH-PESQUISA | 3 | 3 | **APROVADO** (ano coerente ×4; CSV 13 linhas = tela; XLSX/PDF válidos) + 3 acabamentos do crítico aplicados pelo líder (chip do ano, overflow 375px, contagem "com dado") | — | R1, R2 (teste dos 10s: PASSOU) |
| P6 DASH-XINGU | 5 | 4 | **APROVADO** (r2: mapa RECALCULO=ranking provado + permalink; r3: só restou 375px; r4: vazamento 0 medido) — vence o painel MS em capacidade de decisão | pesquisa municipal destaca o cartão estadual (gap registrado, não confunde os modos) | R3 |
| P7 AGENTE-SUGESTOES | 3 | 3 | **APROVADO** (normas reconferidas na web; catraca testada negativamente; multi-eixo correto nos dois sentidos; 0 intrusos, 0 órfãs) | pareamento CAUSA_EVITAVEL por sobra de catálogo (refinamento futuro, não bloqueia) | R4 |
| P8 AUDITORIA | 2 | 1 | **APROVADO** (correlação 7/7 provada por SQL; fix da corrida validado por contrafactual) | ConsumoLlm sem correlação por desenho (registrado) | — |
| P9 CONTRATO-GENERICO | 5 | 1 | **APROVADO** (contrato idêntico nas 3 áreas; caça: ZERO branch por área no caminho genérico; 7 reaberturas hash_confere) + 2 acabamentos do crítico aplicados pelo líder (sinônimos 25–28; causas_motivo genérico) | vocabulário de dimensões de causa é fechado (extensibilidade declarada, não bloqueia) | — |

## ENCERRAMENTO — 28/08/2026
9/9 peças APROVADAS · 6/6 críticos especializados PASS · suíte integral
**212/212** (36 suítes, banco migrado do zero com 53 migrações, cadeia íntegra
com 347 eventos) · casos #1/#2/#3 nos dois modos com dado real.
SOFTWARE_GATE PASS · OPERATIONAL_GATE BLOCKED_EXTERNAL (migrar dev + parecer
RG-09). Relatório: `RELATORIO-FINAL.md` · Evidência:
`docs/evidence/gauntlets/GAUNTLET-20260828-PESQUISA-VS-XINGU.md` (EV-20260828-061).

## Críticos especializados (sobre o conjunto)
- Determinismo: coberto em toda rodada (3×/2× byte a byte em P2, P4, P7, P9) e
  no ratchet. PASS.
- Dados: P3 rodadas 1–3 (tabulações TabNet independentes; VOLTAR que virou a
  guarda de mesma referência). PASS.
- Gestão pública: P7 rodadas 1–3 (boletim SES-MT como barra; VOLTAR que
  atualizou as normas para Rede Alyne). PASS.
- Diferenciação: telas lado a lado, mesma pergunta, dois recortes — intenções
  distintas à primeira vista, números idênticos onde se sobrepõem. PASS.
- Generalidade: 3 áreas × 2 modos, caça a branch por área: zero no caminho
  genérico. PASS.
- Persistência: ataques ao schema (P1), roundtrip por service (P1), 7
  reaberturas com hash_confere=true em 3 áreas (P9), sugestão órfã vetada por
  CHECK (P7). PASS.

## Gates humanos previstos
1. Aprovação RG-09 dos indicadores novos (mortalidade etc.) — nascem EM_ANALISE.
2. Qualquer ação em produção (não há produção neste ambiente; N/A por ora).

## Diário (mais recente primeiro nas entradas do dia 26/08 abaixo da linha original)
- 26/08 — VOLTARs das rodadas 1 de P3 e P5, ambos por achados reais dos
  críticos: (P3) semântica vigente-≤-referência fabricava taxas com parcelas de
  anos distintos em dado de evento — no SIM, linha ausente é ZERO, não falta de
  dado; TMI estadual 2024 sairia 15,4 vs 14,2 oficial; (P5) ano exibido era o
  da consulta (2026) e o CSV de RECALCULO baixava vazio. Rodadas 2 entregues:
  zeros materializados (211) + guarda de mesma referência nos 3 caminhos
  RECALCULO com o ataque virando teste; ano derivado da procedência + exportação
  CSV/XLSX/PDF via ranking(). Suíte completa rodando como gate; re-críticas na
  sequência.
- 26/08 — Referências R1–R4 verificadas e salvas. PLANO.md escrito após
  mapeamento completo (motor/Xingú, schema, spec). Onda 1 iniciada.
- 26/08 — P1 e P2 construídas e autoverificadas (migração 48 do zero: 48/48;
  ranking 9/9 em banco descartável; tsc limpo). Suítes `pesquisas.unit.mjs` e
  `ranking.unit.mjs` registradas no runner. Críticos das duas peças despachados.
- 26/08 — Vereditos: P2 APROVADO (crítico abriu e tabulou o TabNet de verdade —
  106 municípios, total 785 em 2024 — e recomputou posições/médias por SQL
  independente; nosso artefato vence em posição/delta/ausência/procedência por
  linha; TabNet ainda vence em tabulação livre e total na tela). P1 APROVADO
  (ataques todos vetados; roundtrip byte a byte no service compilado). Gaps
  absorvidos: `total_estadual` no Ranking (rodada 2, com asserts no ratchet);
  `PesquisaSerieHistorica_CodigoIbge` adicionado à migração 48 (nenhum banco
  persistente a aplicara); verificação do hash na reabertura vira requisito da
  P4. Suíte completa (npm test) disparada como gate da Onda 1.
- 26/08 — Gate da Onda 1 VERDE: 167/167, cadeia íntegra (159 eventos).
- 26/08 — Interrupções por limite de uso da conta (2×); builders relançados
  após reset, política mudada para builders em série.
- 26/08 — P4+P8 construídas (modo.e2e 7/7; regressão conjunta 31/31; hash
  verificável `hash_confere` na reabertura). ACHADO RELEVANTE do builder:
  corrida pré-existente no AuditoriaService — dentro de transação tenant o
  `pg_advisory_xact_lock` é no-op e registros concorrentes liam o mesmo
  "último hash", quebrando o encadeamento (9 quebras em 50 eventos ao gravar
  o `comparar()` do dossiê). Corrigido com fila de serialização por client;
  crítico da P4 instruído a atacar exatamente esse ponto.
