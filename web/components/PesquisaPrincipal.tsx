'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export function PesquisaPrincipal() {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [ouvindo, setOuvindo] = useState(false);
  const [avisoVoz, setAvisoVoz] = useState('');

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const termo = texto.trim();
    router.push(termo ? `/consulta?q=${encodeURIComponent(termo)}` : '/consulta');
  }

  function abrirXingu() {
    const rascunho = texto.trim();
    router.push(rascunho ? `/xingu?q=${encodeURIComponent(rascunho)}` : '/xingu');
  }

  /** Voz na busca (RF-CHAT-002): STT pt-BR do navegador preenche o campo —
      a pessoa confirma antes de pesquisar, nada executa sozinho. */
  function ouvir() {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setAvisoVoz('Este navegador não oferece reconhecimento de voz — digite a pesquisa.');
      return;
    }
    setAvisoVoz('');
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.onstart = () => setOuvindo(true);
    rec.onend = () => setOuvindo(false);
    rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript;
      if (t) setTexto(t);
    };
    rec.start();
  }

  return (
    <section className="pesquisa-principal" aria-label="Pesquisa na Plataforma itMT">
      <form action="/consulta" method="get" onSubmit={enviar}>
        <label className="sr-only" htmlFor="pesquisa-principal-campo">
          Local da pesquisa
        </label>
        <div className="barra-xingu barra-pesquisa-integrada" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto auto' }}>
          <button type="submit" className="barra-xingu-icone" aria-label="Pesquisar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></svg>
          </button>
          <input id="pesquisa-principal-campo" name="q" value={texto} onChange={(event) => setTexto(event.target.value)} placeholder="Indique o município da pesquisa…" autoComplete="off" />
          <button
            type="button"
            className={`barra-xingu-icone${ouvindo ? ' ativo' : ''}`}
            onClick={ouvir}
            aria-pressed={ouvindo}
            aria-label="Pesquisar por voz"
            title="Pesquisar por voz"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" /></svg>
          </button>
          <button type="button" className="barra-xingu-marca" aria-label="Abrir modo Xingú IA" onClick={abrirXingu}>
            <Image src="/xingu-ia.png" alt="" width={460} height={147} sizes="(max-width: 560px) 96px, 116px" />
          </button>
        </div>
        <p className="pesquisa-principal-ajuda" aria-live="polite">
          {ouvindo
            ? 'Ouvindo… fale o nome do município.'
            : avisoVoz || 'Resultados oficiais organizados por local, tema e indicador.'}
        </p>
      </form>
    </section>
  );
}
