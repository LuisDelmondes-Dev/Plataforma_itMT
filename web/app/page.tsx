import Link from 'next/link';
import Image from 'next/image';
import { apiGet, Resultado } from '@/lib/api';
import { REGIAO } from '@/lib/regiao';
import { PesquisaPrincipal } from '@/components/PesquisaPrincipal';
import { MiniMapaMunicipio } from '@/components/MiniMapaMunicipio';
import { ReguaProcedencia } from '@/components/ReguaProcedencia';
import { formatarNumero } from '@/lib/format';

interface Destaque { id: number; nome: string; unidade: string; tema: string }

/**
 * Home (Onda D): o portal se apresenta com um hero de verdade — um número
 * VIVO do estado, com a régua de procedência até na primeira dobra (a home
 * também prova de onde vem o que mostra), a silhueta soberana de MT e a
 * busca como protagonista. Sem o número (API fora do ar), o hero degrada
 * para a versão sem dado — nunca um zero de enfeite (RN-005).
 */
export default async function Home() {
  let destaque: { indicador: Destaque; resultado: Resultado } | null = null;
  try {
    const [ind] = await apiGet<Destaque[]>('/indicadores/destaque?limite=1&detalhe=1', {
      revalidate: 600,
    });
    if (ind) {
      const resultado = await apiGet<Resultado>(
        `/indicadores/${ind.id}/consulta?recorte=ESTADO&codigo=${REGIAO.codigoUfIbge}`,
      );
      destaque = { indicador: ind, resultado };
    }
  } catch {
    destaque = null; // hero sem número — a home continua inteira
  }

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-conteudo">
          <Image
            className="home-hero-logo"
            src="/itmt-horizontal.png"
            alt={`Plataforma itMT — inteligência territorial ${REGIAO.nome}`}
            width={720}
            height={272}
            priority
          />
          <h1 className="home-hero-titulo">
            Os dados oficiais de {REGIAO.nome}, com a fonte ao lado de cada número.
          </h1>
          <p className="home-hero-sub">
            {REGIAO.municipiosEsperados} municípios · consulta guiada, linguagem natural e
            mapa — tudo do mesmo motor determinístico, com procedência auditável.
          </p>
          {destaque && (
            <div className="home-hero-numero">
              <span className="overline">{destaque.indicador.nome} · {REGIAO.nome}</span>
              <strong>
                {formatarNumero(destaque.resultado.valor)}{' '}
                <small>{destaque.resultado.unidade}</small>
              </strong>
              <ReguaProcedencia procedencia={destaque.resultado.procedencia} />
            </div>
          )}
        </div>
        <div className="home-hero-mapa" aria-hidden="true">
          <MiniMapaMunicipio codigo="" aparencia="hero" />
        </div>
      </section>

      <div className="home-pesquisa">
        <PesquisaPrincipal />
      </div>

      <div className="home-cartoes">
        <Link href="/consulta" className="cartao-acesso">
          <span className="titulo">Consulta guiada</span>
          <span className="desc">Local → Tema → Subtema, com o valor e a fonte lado a lado.</span>
        </Link>
        <Link href="/xingu" className="cartao-acesso">
          <span className="titulo">Perguntar à Xingú</span>
          <span className="desc">Em linguagem natural — o plano da consulta aparece antes da resposta.</span>
        </Link>
        <Link href="/geoportal" className="cartao-acesso">
          <span className="titulo">Geoportal</span>
          <span className="desc">Ortomosaicos, modelos de terreno e a cobertura de imagem de rua.</span>
        </Link>
      </div>
    </div>
  );
}
