'use client';

import { useState, type FormEvent, type ReactNode } from 'react';

/**
 * Tela única de "entrar com token" das áreas de operação — antes eram 5
 * formulários diferentes (campo, fontes, integrações, curadoria,
 * organizações), cada um com layout e mensagens próprias.
 */
export function CampoToken({
  titulo,
  descricao,
  rotulo = 'Token de acesso',
  dica,
  ocupado = false,
  erro,
  aoEnviar,
}: {
  titulo: string;
  descricao?: ReactNode;
  rotulo?: string;
  dica?: string;
  ocupado?: boolean;
  erro?: string;
  aoEnviar: (token: string) => void;
}) {
  const [token, setToken] = useState('');
  const [revelar, setRevelar] = useState(false);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (token.trim()) aoEnviar(token.trim());
  }

  return (
    <section className="card campo-token">
      <h2 className="title-md">{titulo}</h2>
      {descricao && <p className="campo-token-descricao">{descricao}</p>}
      <form onSubmit={enviar}>
        <label>
          <span className="overline">{rotulo}</span>
          <div className="campo-token-linha">
            <input
              className="campo"
              type={revelar ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              required
            />
            <button
              type="button"
              className="btn"
              onClick={() => setRevelar((v) => !v)}
              aria-pressed={revelar}
            >
              {revelar ? 'Ocultar' : 'Revelar'}
            </button>
          </div>
        </label>
        {dica && <small className="campo-token-dica">{dica}</small>}
        {erro && (
          <p className="aviso" role="alert">
            {erro}
          </p>
        )}
        <button type="submit" className="btn primaria" disabled={ocupado || !token.trim()}>
          {ocupado ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </section>
  );
}
