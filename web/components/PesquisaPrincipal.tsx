'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export function PesquisaPrincipal() {
  const router = useRouter();
  const [texto, setTexto] = useState('');

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const termo = texto.trim();
    router.push(termo ? `/consulta?q=${encodeURIComponent(termo)}` : '/consulta');
  }

  function abrirXingu() {
    const rascunho = texto.trim();
    router.push(rascunho ? `/xingu?q=${encodeURIComponent(rascunho)}` : '/xingu');
  }

  return (
    <section className="pesquisa-principal" aria-label="Pesquisa na Plataforma itMT">
      <form action="/consulta" method="get" onSubmit={enviar}>
        <label className="sr-only" htmlFor="pesquisa-principal-campo">
          Local da pesquisa
        </label>
        <div className="barra-xingu barra-pesquisa-integrada">
          <button type="submit" className="barra-xingu-icone" aria-label="Pesquisar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></svg>
          </button>
          <input id="pesquisa-principal-campo" name="q" value={texto} onChange={(event) => setTexto(event.target.value)} placeholder="Indique o município da pesquisa…" autoComplete="off" />
          <button type="button" className="barra-xingu-marca" aria-label="Abrir modo Xingú IA" onClick={abrirXingu}>
            <Image src="/xingu-ia.png" alt="" width={460} height={147} sizes="(max-width: 560px) 96px, 116px" />
          </button>
        </div>
        <p className="pesquisa-principal-ajuda" aria-live="polite">
          Resultados oficiais organizados por local, tema e indicador.
        </p>
      </form>
    </section>
  );
}
