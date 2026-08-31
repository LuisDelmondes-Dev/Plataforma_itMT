# RELATÓRIO FINAL — Gauntlet "Pesquisa vs IA Xingú"

Período: 26–28/08/2026 · Método: Gauntlet Loop (builder/crítico por peça,
comparação cega com referência real, loop até APROVADO, ratchet). Painel de
rodadas: `STATUS.md`. Plano e mapeamento prompt→repositório: `PLANO.md`.
Referências verificadas: `referencias/README.md`. Evidência no rito da casa:
`docs/evidence/gauntlets/GAUNTLET-20260828-PESQUISA-VS-XINGU.md` + ledger.

## Resultado

**As 9 peças APROVADAS** por críticos independentes em contexto novo, e os 6
críticos especializados PASS (determinismo, dados, gestão pública,
diferenciação, generalidade, persistência). Casos #1 (mortalidade infantil),
#2 (educação) e #3 (finanças) passam nos DOIS modos com dado real e sem
nenhum branch por área no caminho genérico. Suíte integral verde com cadeia
de auditoria íntegra ao fim de cada onda.

## O que venceu (comparação cega com as referências)

- **Modo Pesquisa vs TabNet (R1)**: teste dos 10 segundos PASSOU (~5–8s na
  tela contra "minutos e conhecimento de domínio" — o TabNet tabula óbitos,
  não taxa; o leigo teria de abrir o SINASC e dividir na mão). Nosso ranking
  entrega o que a tabulação entrega e mais: posição, delta vs média, ausência
  explícita e o quinteto de procedência POR LINHA com hash verificável.
- **Modo Xingú vs painel SVS/MS (R3)**: o painel filtra e mostra; o dossiê
  posiciona (1º de N, Δ vs média), decompõe (3 eixos de causa com dominante),
  projeta (série sem imputação) e recomenda com norma vigente e dado-origem.
  Critério do gestor: ≥3 ações defensáveis saíram da tela (4–5 nas rodadas).
- **Sugestões vs boletim SES-MT (R4)**: o crítico-secretário: "melhor do que
  o que eu costumo receber" — o boletim real fecha com 1 recomendação
  genérica; o dossiê entrega 4–5 subsídios presos a dados, com norma citada.

## O que perdeu / onde as referências ainda ganham (honestidade)

- TabNet: tabulação livre (períodos compostos, dimensões cruzadas), série
  1996–2026 e recortes demográficos que não temos.
- Painel MS: atualidade (prévias mensais de 2026 vs nosso anual 2024),
  abrangência nacional, recortes raça/cor/sexo/fetal.
- IBGE Cidades: nada relevante — o card foi imitado e superado com ranking.

## Os VOLTARs (o método funcionando)

1. **P3/dados**: a semântica "vigente ≤ referência" fabricava taxas com
   parcelas de anos distintos em dado de EVENTO (Sinop 8,7 falso; TMI 2024
   daria 15,4 vs 14,2 oficial). Cura: zeros materializados na cobertura
   tabulada (no SIM, linha ausente = zero eventos) + guarda de mesma
   referência nos 3 caminhos RECALCULO. O ataque virou teste permanente.
2. **P5/visual**: ano exibido era o da consulta (2026) contradizendo a
   própria tela (2024); CSV de RECALCULO baixava vazio. Cura: ano derivado da
   procedência; exportação CSV/XLSX/PDF via ranking().
3. **P7/gestão**: catálogo citava norma REVOGADA (RAMI 715/2022 → Portaria
   13/2023; vigente: Rede Alyne 5.350/2024) e o gatilho de causa ignorava o
   eixo COMPONENTE (recomendava sala de parto com 60,9% pós-neonatal). Cura:
   db/52 com normas verificadas em fonte oficial + catraca anti-norma-morta
   NA MIGRAÇÃO + gatilho multi-eixo.
4. **P6/visual (2 rodadas)**: mapa() não cobria RECALCULO (estado cinza
   contradizendo "todos têm dado") e link caía no PIB; depois, 35px de
   overflow móvel. Cura: helper único de pareamento para mapa+ranking,
   permalink fonte-de-verdade, `min-width:0` no grid (vazamento 0 medido).

Achado colateral relevante: **corrida pré-existente no AuditoriaService**
(advisory lock é no-op dentro de transação tenant; 9 quebras de cadeia em 50
eventos sob concorrência) — corrigida com fila por client e provada por
contrafactual pelo crítico.

## Gaps que ficaram (registrados, não bloqueiam)

- Cartão-destaque da Pesquisa municipal titula o estado (o valor municipal
  fica na frase) — enfraquece o "responder rápido" no recorte municipal.
- Dossiê estadual sem "onde estamos" (posicionamento só existe no recorte
  municipal — inaplicável por definição, mas o pilar some).
- Vocabulário de dimensões de causa é fechado (CHECK + 4 pontos de código):
  4ª área com eixo causal exige migração + edição sincronizada.
- Causas evitáveis municipais cobrem estadual + 20 maiores municípios
  (limite de tabulação do TabNet, documentado no db/50).
- Pareamento CAUSA_EVITAVEL por sobra de catálogo quando a dominante é "não
  claramente evitáveis" (refinamento de curadoria futura).
- `ConsumoLlm` sem correlação por pesquisa (por desenho; só existe com LLM).
- Prova do "211 zeros" é indireta em fixture (malha completa só no dev).

## Gates humanos (pendentes, seus)

1. **Aplicar as migrações 48–53 no banco dev** (`npm run migrar` com o
   DATABASE_URL do dev) — o gauntlet nunca tocou o dev.
2. **Parecer RG-09** dos 4 indicadores novos (Óbitos infantis, Nascidos
   vivos, Taxa de mortalidade infantil, Despesas orçamentárias empenhadas) —
   nascem EM_ANALISE; o motor os filtra do público até a sua aprovação.
3. Produção: fora do escopo (BLOCKED_EXTERNAL, como sempre).
