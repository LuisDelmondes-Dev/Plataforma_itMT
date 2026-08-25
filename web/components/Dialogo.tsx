'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

/**
 * Diálogo modal sobre <dialog> nativo — substitui window.prompt/confirm
 * (não estilizáveis, inacessíveis, truncam texto e quebram em mobile).
 * showModal() já prende o foco e fecha com Esc; devolvemos o foco ao
 * gatilho por comportamento nativo do <dialog>.
 */
export function Dialogo({
  aberto,
  titulo,
  children,
  rotuloConfirmar = 'Confirmar',
  rotuloCancelar = 'Cancelar',
  destrutivo = false,
  aoConfirmar,
  aoFechar,
}: {
  aberto: boolean;
  titulo: string;
  children?: ReactNode;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  destrutivo?: boolean;
  aoConfirmar: () => void;
  aoFechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      className="dialogo"
      aria-labelledby="dialogo-titulo"
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === ref.current) aoFechar(); // clique no backdrop
      }}
    >
      <form
        method="dialog"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          aoConfirmar();
        }}
      >
        <h2 id="dialogo-titulo">{titulo}</h2>
        {children}
        <div className="dialogo-acoes">
          <button type="button" className="btn" onClick={aoFechar}>
            {rotuloCancelar}
          </button>
          <button type="submit" className={`btn ${destrutivo ? 'perigo' : 'primaria'}`}>
            {rotuloConfirmar}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** Variante com um campo de texto (substitui window.prompt). */
export function DialogoTexto({
  aberto,
  titulo,
  rotuloCampo,
  valorInicial = '',
  multilinha = false,
  obrigatorio = true,
  minimo,
  rotuloConfirmar = 'Confirmar',
  aoConfirmar,
  aoFechar,
}: {
  aberto: boolean;
  titulo: string;
  rotuloCampo: string;
  valorInicial?: string;
  multilinha?: boolean;
  obrigatorio?: boolean;
  /** Comprimento mínimo do texto para habilitar a confirmação. */
  minimo?: number;
  rotuloConfirmar?: string;
  aoConfirmar: (texto: string) => void;
  aoFechar: () => void;
}) {
  const [texto, setTexto] = useState(valorInicial);
  useEffect(() => {
    if (aberto) setTexto(valorInicial);
  }, [aberto, valorInicial]);

  return (
    <Dialogo
      aberto={aberto}
      titulo={titulo}
      rotuloConfirmar={rotuloConfirmar}
      aoConfirmar={() => {
        const limpo = texto.trim();
        if (obrigatorio && !limpo) return;
        if (minimo && limpo.length < minimo) return;
        aoConfirmar(limpo);
      }}
      aoFechar={aoFechar}
    >
      <label className="dialogo-campo">
        {rotuloCampo}
        {multilinha ? (
          <textarea
            className="campo"
            rows={6}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            required={obrigatorio}
            minLength={minimo}
          />
        ) : (
          <input
            className="campo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            required={obrigatorio}
            minLength={minimo}
          />
        )}
      </label>
    </Dialogo>
  );
}
