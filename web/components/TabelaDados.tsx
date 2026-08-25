import type { ReactNode } from 'react';

/**
 * Tabela padrão do portal: rolagem horizontal interna (a página nunca rola
 * de lado por causa de uma tabela), caption em .sr-only (a `display:none`
 * antiga sumia também do leitor de tela) e zebra via CSS.
 * O conteúdo (thead/tbody) continua por conta da página — este componente
 * padroniza a casca, não o dado.
 */
export function TabelaDados({
  legenda,
  children,
}: {
  /** Descrição da tabela para leitores de tela (vira <caption>). */
  legenda: string;
  children: ReactNode;
}) {
  return (
    <div className="tabela-rolagem" tabIndex={0} role="region" aria-label={legenda}>
      <table className="dados">
        <caption className="sr-only">{legenda}</caption>
        {children}
      </table>
    </div>
  );
}
