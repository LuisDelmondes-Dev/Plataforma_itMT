import Link from 'next/link';
import Image from 'next/image';
import { REGIAO } from '@/lib/regiao';
import { PesquisaPrincipal } from '@/components/PesquisaPrincipal';

export default function Home() {
  return (
    <div style={{ maxWidth: 760, margin: '48px auto', textAlign: 'center' }}>
      <Image
        className="hero-logo"
        src="/itmt-horizontal.png"
        alt={`Plataforma itMT — inteligência territorial ${REGIAO.nome}`}
        width={1434}
        height={542}
        sizes="(max-width: 760px) 90vw, 700px"
        priority
      />
      <h1 style={{ margin: '20px 0 0', fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}>
        Inteligência Territorial de {REGIAO.nome}
      </h1>

      <PesquisaPrincipal />

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
