'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { GLOSSARIO } from '@/lib/glossario';

/**
 * Termo com explicação no lugar (Onda B) — zero dependências: um botão
 * com sublinhado pontilhado abre um popover posicionado por CSS. Fecha
 * com Esc e clique fora; alvo ≥24px (WCAG 2.5.8). O texto do popover vem
 * do glossário central (lib/glossario.ts).
 */
export function TermoExplicado({
  id,
  children,
}: {
  /** Chave em GLOSSARIO (ex.: 'rgi', 'hash', 'rn-005'). */
  id: string;
  /** Texto exibido; sem children, usa o nome do termo do glossário. */
  children?: ReactNode;
}) {
  const termo = GLOSSARIO[id];
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  const idPopover = useId();

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    const aoClicar = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    window.addEventListener('keydown', aoTeclar);
    window.addEventListener('mousedown', aoClicar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('mousedown', aoClicar);
    };
  }, [aberto]);

  // Chave desconhecida degrada para o texto puro — nunca quebra a frase.
  if (!termo) return <>{children ?? id}</>;

  return (
    <span className="termo" ref={raiz}>
      <button
        type="button"
        className="termo-gatilho"
        aria-expanded={aberto}
        aria-controls={idPopover}
        onClick={() => setAberto((v) => !v)}
      >
        {children ?? termo.termo}
      </button>
      {aberto && (
        <span className="termo-popover" role="note" id={idPopover}>
          <strong>{termo.termo}</strong>
          <span>{termo.curta}</span>
          {termo.longa && <span className="termo-longa">{termo.longa}</span>}
        </span>
      )}
    </span>
  );
}
