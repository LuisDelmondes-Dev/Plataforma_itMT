# Fotografia de dívida técnica — 24/08/2026

Ciclo D3 do Gauntlet Loop (plano de 22/08). Consolida o que **restou** do
inventário de 45 sinais (varredura Explore de 22/08) depois de 15 ciclos
executados entre 22 e 24/08 (EV-20260822-044 a EV-20260824-056). Cada item
residual foi **reverificado no código nesta data** — fotografia não herda
sinal já corrigido.

Método de priorização: `Prioridade = (Impacto + Risco) × (6 − Esforço)`,
escalas 1–5. Impacto = quanto atrasa o trabalho; Risco = o que acontece se
não corrigir; Esforço = custo da correção (menor esforço ⇒ prioridade maior).

## O que o inventário tinha e já não existe

Dos 45 sinais originais, a grande maioria foi resolvida ou derrubada nos
ciclos (delta completo no ledger, EV-044…056). Destaques do que **saiu** da
dívida:

- Suítes de segurança órfãs fora do CI (A1/EV-044) — hoje na regressão, e a
  catraca de grants já girou duas vezes por conta própria (EV-044, EV-055).
- Golden set obsoleto 11/76 indicadores (B1/EV-045) — regenerado, 12.183 casos.
- Sentinela A14 porosa 22/23 (A2/EV-048) e cache de navegação privada no SW
  (A2b/EV-049).
- Auditoria engolindo evento com `\"` — P1 (EV-043); teto A15 fail-open
  (B3/EV-053); checagens decorativas do dossiê RG-09 (B3/EV-053);
  `BLOQUEADA_DRIFT` como beco sem saída (EV-054).
- Fixtures servidas como dado oficial + faltas de ciclo de vida
  (C2/C2b/C2d — EV-046/047/055).
- WCAG 2.2 AA: 7 violações corrigidas, 17 rotas limpas (D1/D1b — EV-051/052).
- Deriva de documentação: CLAUDE.md reescrito (commit 8389ad6) e README raiz
  corrigido em 24/08 (itens #29–35: "três partes"→quatro, 57/56/131 testes→151,
  40 migrações→47, A15 "no roadmap"→implementado, e o exemplo de `npm test`
  que apontava `DATABASE_URL` para o banco dev `itmt` — o erro que o
  CLAUDE.md proíbe — corrigido para o banco administrativo).
- **Não reproduzido em 24/08** (#41): "URL montada à mão fora de
  `web/lib/api.ts` em 9 páginas". Hoje só `lib/api.ts` define a base da API,
  12 páginas importam dele e o único `fetch` direto é asset estático local
  (`app/mapa/page.tsx:69`, geojson). Sinal encerrado sem ação.

## Dívida residual (interna, priorizada)

| # | Item | Categoria | I | R | E | Prioridade | Evidência de que ainda existe |
|---|---|---|---|---|---|---|---|
| D-01 | Regex de descoberta de migração exige **exatamente dois dígitos** (`^\d{2}-`): a migração `100-` não será descoberta e o `migrar.mjs` pulará silenciosamente | Código | 2 | 4 | 1 | **30** | `api/scripts/migrar.mjs:37` em 24/08 |
| D-02 | Banco dev **não reproduzível do zero**: `_Migracao` tem 49 registros para 47 arquivos (duas órfãs de 15/08, renumeradas à época) — qualquer forense futura precisa saber disso | Infra/dados | 2 | 4 | 2 | **24** | contagem em `_Migracao` no dev; regra "nunca renumere" já no CLAUDE.md |
| D-03 | Hook de **sabotagem no caminho de produção** do orquestrador, guardado só por `NODE_ENV !== 'production'` — pertence a injeção de teste, não ao código de produção | Código | 1 | 3 | 2 | **16** | `api/src/xingu/orquestrador.service.ts:181` em 24/08 |
| D-04 | **B2 — A01 sem avaliação adversarial fora do vocabulário**: o golden 100% mede cobertura de vocabulário (pergunta usa o nome do indicador verbatim); robustez a sinônimos/typos/regionalismos não é medida por nada | Teste | 3 | 3 | 4 | **12** | ressalva declarada em EV-045; sem corpus curado até hoje |
| D-05 | `golden:avaliar` **fora do CI** (exige API no ar): regressão do KR3.1 só roda à mão | Teste/infra | 2 | 2 | 3 | **12** | limitação (a) declarada em EV-045 |
| D-06 | Corpus de red-team A14 **escrito pelo autor das defesas** — 0/23 é regressão, não prova de completude; mesmo viés declarado na revisão de segurança (EV-050) | Teste | 2 | 3 | 4 | **10** | limite metodológico registrado em EV-048/050 |
| D-07 | 4 `catch {}` mudos no `web/` — todos guardas de `sessionStorage` (legítimos: lança em modo privado), mas sem comentário explicando o silêncio | Código | 1 | 1 | 1 | **10** | `app/biblioteca/curadoria/page.tsx:50,68`, `app/integracoes/page.tsx:41,54` |
| D-08 | Bancos `itmt_teste`/`itmt_ci` obsoletos na máquina dev (o runner cria o seu) — risco de alguém apontar teste para resquício | Infra local | 1 | 1 | 1 | **10** | nota no CLAUDE.md; não é dívida do repositório |

### Decisão registrada — A1b (catraca de grants)

Avaliado e **decidido em 24/08: o teste é o guard.** A allowlist de
`test/least-privilege.unit.mjs` roda em toda regressão e no CI (EV-044) e já
reprovou/forçou atualização consciente duas vezes (EV-044: 10 grants
retroativos; EV-055: `GRANT UPDATE` da migração 47, anotado na própria
migração). Um aviso adicional no `migrar.mjs` ao detectar `GRANT` duplicaria
o sinal sem reprovar nada — custo de manutenção sem ganho. A1b encerra sem
código novo.

## Dívida externa / fora do alcance do repositório

Não pontuada — não é corrigível por código daqui:

- **ADR-005** segue `Proposta` por decisão externa deliberada (EV-054).
- **WCAG com tecnologia assistiva real** (NVDA/VoiceOver, usuários de TA,
  foco em fluxo completo, zoom 200%/reflow) — automação cobre ~30% dos
  critérios (EV-051/052). `BLOCKED_EXTERNAL`.
- **Revisão independente** das mudanças da janela 22–24/08
  (`bc0b0ef..HEAD`) — `/code-review ultra` é disparo do usuário; revisor
  externo resolveria também D-06.
- Tudo que os gates F0–F7 já registram como `BLOCKED_EXTERNAL` (nuvem
  soberana/IdP/WAF/KMS, campanhas de campo, convênios, operação).

## Plano de remediação faseado

1. **Agora, junto de qualquer ciclo que tocar `api/scripts/`** — D-01: trocar
   o regex para `^\d{2,}-` (uma linha + caso no teste do migrador). Maior
   prioridade da lista pelo custo quase nulo.
2. **Próxima janela de manutenção** — D-03 (mover sabotagem para injeção de
   teste) e D-07 (comentar os 4 guardas). Nenhum muda comportamento.
3. **Quando houver material externo** — D-04/D-06 dependem de corpus/revisor
   de fora; D-05 é decisão de custo de CI (subir API no workflow) a tomar
   junto com D-04, pois só vale a pena com um golden que meça robustez.
4. **Contínuo** — D-02 não se corrige, se **contém**: a regra do CLAUDE.md
   ("nunca renumere/remova `.sql` aplicado") é a mitigação; recriar o dev do
   zero só com decisão do usuário (tem dados reais).

Próxima fotografia: após fechar D-01/D-03/D-07 ou quando um ciclo novo
revelar categoria nova — o que vier primeiro.
