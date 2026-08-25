import type { ReactNode } from 'react';

/**
 * Cabeçalho padrão de página: overline + h1 + descrição (+ ações à direita).
 * Substitui os dois sistemas que conviviam — o markup inline copiado em ~15
 * páginas e as classes headline-lg de outras 3 (fotografia de 24/08).
 */
export function CabecalhoPagina({
  overline,
  titulo,
  descricao,
  acoes,
}: {
  overline?: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="cabecalho-pagina">
      <div>
        {overline && <p className="overline">{overline}</p>}
        <h1 className="headline-lg">{titulo}</h1>
        {descricao && <p className="cabecalho-pagina-descricao">{descricao}</p>}
      </div>
      {acoes && <div className="cabecalho-pagina-acoes">{acoes}</div>}
    </header>
  );
}
