import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ maxWidth: 760, margin: '48px auto', textAlign: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="hero-logo"
        src="/itmt-horizontal.png"
        alt="Plataforma itMT — inteligência territorial Mato Grosso"
      />

      <form
        action="/consulta"
        style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <input
          className="campo"
          style={{ maxWidth: 420, flex: '1 1 260px' }}
          name="q"
          placeholder="Indique o local de sua pesquisa"
          aria-label="Indique o local de sua pesquisa"
        />
        <button className="btn primaria" type="submit">
          Consultar
        </button>
      </form>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginTop: 32,
        }}
      >
        <Link href="/consulta" className="cartao-acesso">
          <span className="titulo">Consulta guiada</span>
          <span className="desc">
            Local → Tema → Subtema, com o valor e a fonte lado a lado.
          </span>
        </Link>
        <Link href="/xingu" className="cartao-acesso">
          <span className="titulo">Perguntar à Xingú</span>
          <span className="desc">
            Em linguagem natural — o plano da consulta aparece antes da resposta.
          </span>
        </Link>
        <Link href="/geoportal" className="cartao-acesso">
          <span className="titulo">Geoportal</span>
          <span className="desc">
            Ortomosaicos, modelos de terreno e a cobertura de imagem de rua.
          </span>
        </Link>
      </div>
    </div>
  );
}
