# GAUNTLET-20260815-F1-WCAG

**Ciclo:** 1  
**Fase:** F1  
**Requisito:** F1-R046 — WCAG AA  
**Referência:** estrutura semântica, nomes acessíveis e bypass por teclado.

## Inspeção real

Playwright abriu o portal local em Chromium. O baseline comprovou:

- `lang=pt-BR`;
- zero imagens sem `alt`;
- zero botões e inputs sem nome acessível;
- zero IDs duplicados;
- zero erros de console;
- skip link como primeiro item focalizável.

## Gaps e correções

1. página inicial sem `<h1>`: adicionada heading visível;
2. skip link navegava, mas o foco permanecia no `body`: `<main>` recebeu
   `tabIndex={-1}`;
3. imagens nativas foram substituídas por `next/image`, com dimensões e `sizes`.

## Ataque e regressão

Após `Tab` + `Enter`, `document.activeElement` passou a ser
`MAIN#conteudo`. A árvore acessível contém um heading nível 1 e o console segue
sem erros. O build Next.js passou com TypeScript e 13 páginas.

**Evidência visual:** `output/playwright/f1-home-wcag.png`.  
**SOFTWARE_GATE:** PASS para os itens auditados.  
**Risco residual:** auditoria completa de contraste, zoom, leitor de tela e todas
as rotas ainda deve ser executada antes de declarar conformidade WCAG AA integral.

