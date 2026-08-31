# F2-R049 — Dois modos de resposta: Pesquisa vs IA Xingú

## Requisito

Toda pergunta territorial respondida pela borda conversacional aceita dois
contratos de saída selecionáveis pelo usuário (`modo=pesquisa|xingu`), sobre o
MESMO motor determinístico, e toda execução — em qualquer modo — é persistida
de forma normalizada e reabrível sem reexecutar motor ou LLM (PRD RF023/RN16;
`docs/spec/ARCHITECTURE.md` §3.7).

## Contrato

- modo `pesquisa` (default; retrocompatível): envelope da Xingú +
  `ranking_top` (top-5, média e total estaduais, ausentes), sem dossiê;
- modo `xingu`: envelope + `dossie` — ranking completo com posição e delta,
  série histórica, comparação territorial (recorte municipal), decomposição
  por causa (quando a fonte cobre; senão lacuna declarada), sugestões com
  FK obrigatória para o dado-origem e prática de gestão com norma VIGENTE
  citada ("dossiê, não decisão");
- invariantes iguais nos dois modos: numeral só do motor (A06 audita inclusive
  o texto das sugestões), ausência é resposta (`SEM_DADO` idêntico nos dois),
  fonte e data em tudo, degradação sem LLM (léxico determinístico é o caminho
  primário);
- persistência é parte da execução: falha na gravação ⇒ pesquisa não concluída;
  tabelas `Pesquisa*` (db/48) com hash canônico recomputado e conferido na
  reabertura (`hash_confere`);
- correlação de trilha: `EventoAuditoria` (`CONSULTA_CHAT`/`PESQUISA_EXECUTADA`)
  carrega `pesquisa_id`; `PesquisaExecucaoAgente` guarda as etapas A01/A04/
  A05/A06/A16 da pesquisa;
- ranking exclui município sem dado (listado em `ausentes`), pareia parcelas de
  RECALCULO na MESMA referência (dado de evento nunca herda parcela de outro
  ano) e materializa zeros de evento documentados na cobertura tabulada;
- catálogo de práticas (`PraticaGestao`, db/51–52) é curado por migração com
  catraca anti-norma-revogada; sem prática aplicável, o dossiê declara o motivo.

## Aceite

Gate técnico: migração limpa desde a 01; mesma pergunta nos dois modos gera os
dois contratos com números idênticos aos endpoints diretos do motor; pesquisa
reaberta do banco bate com a resposta original (hash verificado); sugestão
órfã é impossível por CHECK; suíte integral verde com cadeia de auditoria
íntegra. Evidência do gauntlet: `docs/gauntlet/STATUS.md` e
`docs/evidence/gauntlets/GAUNTLET-20260826-PESQUISA-VS-XINGU.md`.
