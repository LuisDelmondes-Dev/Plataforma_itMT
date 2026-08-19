# ADR-001 — Xingú como orquestrador sobre provedores substituíveis

**Status:** Aceita tecnicamente  
**Data:** 15/08/2026

## Contexto

Treinar um modelo fundacional não é requisito nem uso eficiente dos recursos do
programa. Números precisam permanecer sob controle do motor determinístico.

## Decisão

A Xingú é uma orquestradora. Provedores de LLM atuam apenas nas bordas de
interpretação e narrativa, atrás de contrato substituível, orçamento e fallback
léxico determinístico. Publicação e cálculo não são delegados ao modelo.

## Alternativas

- modelo próprio treinado do zero: rejeitado por custo, risco e falta de benefício;
- dependência direta de um fornecedor: rejeitada por lock-in e indisponibilidade.

## Consequências e riscos

Exige testes de contrato por provedor, avaliação contínua, controle de custos e
proteção contra injeção. A abstração não prova que múltiplos provedores estejam
operacionais.

