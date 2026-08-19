# GAUNTLET-20260815-F2-RAG-EVAL

**Ciclo:** 1  
**Fase:** F2  
**Requisitos:** F2-R043–F2-R047  
**Objetivo:** impedir que qualidade de recuperação mascare resposta alucinada ou
citação incorreta.

## Referência e contrato

Cada consulta homologada passa a anotar `afirmacoes[]` com texto,
`suportada`, `fontes_suporte[]` e `citacoes[]`. O avaliador mede separadamente:

- recall@5, precision@5 e nDCG@5 da recuperação;
- faithfulness das afirmações;
- groundedness contra o contexto recuperado;
- correção das citações contra as fontes de suporte.

## TDD e ataque

O teste foi escrito primeiro e falhou porque as métricas não existiam. O caso
adversarial usa afirmação não suportada, fonte fora do contexto e citação errada;
o avaliador antigo aprovava pelo ranking. Após a implementação, o caso recebe zero
nas três métricas e o corpus é rejeitado.

## Regressão

`node --test test/f2-gates.unit.mjs`: 4/4 PASS.

**SOFTWARE_GATE:** PASS.  
**OPERATIONAL_GATE:** BLOCKED_EXTERNAL até corpus real homologado com 20 documentos,
30 consultas e anotações humanas completas.

