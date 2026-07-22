'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Ícones da navegação — traço 1.8, herdam currentColor. */
const I = {
  inicio: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" /></svg>,
  indicadores: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20V9M10 20V4M16 20v-7M21 20H3" /></svg>,
  xingu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 1 0-3.1 6.3L21 20l-1.2-3.6A7.9 7.9 0 0 0 20 12Z" /><path d="M8.5 11h7M8.5 14.5h4" /></svg>,
  ficha: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>,
  geoportal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>,
  mapa: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-6-5.1-6-10a6 6 0 1 1 12 0c0 4.9-6 10-6 10Z" /><circle cx="12" cy="11" r="2.2" /></svg>,
  acervo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m3.5 15 5-5 5 5 3-3 4 4" /><circle cx="9" cy="9.5" r="1.2" /></svg>,
  campo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-6.5-5.4-6.5-10a6.5 6.5 0 0 1 13 0c0 4.6-6.5 10-6.5 10Z" /><circle cx="12" cy="11" r="2.3" /></svg>,
  cobertura: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="4" width="7" height="7" rx="1.2" /><rect x="13" y="4" width="7" height="7" rx="1.2" /><rect x="4" y="13" width="7" height="7" rx="1.2" /><rect x="13" y="13" width="7" height="7" rx="1.2" /></svg>,
  transparencia: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4.5 6v5c0 4.6 3.2 8 7.5 10 4.3-2 7.5-5.4 7.5-10V6L12 3Z" /><path d="m9 12 2 2 4-4.5" /></svg>,
  direitos: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16M5 7h14M5 7 3 12a3.2 3.2 0 0 0 6.4 0L7 7M17 7l-2.4 5a3.2 3.2 0 0 0 6.4 0L19 7M8.5 20h7" /></svg>,
  fontes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" /></svg>,
};

const NAV: { grupo: string; itens: { href: string; rotulo: string; icone: keyof typeof I }[] }[] = [
  {
    grupo: 'Dados',
    itens: [
      { href: '/', rotulo: 'Início', icone: 'inicio' },
      { href: '/consulta', rotulo: 'Indicadores', icone: 'indicadores' },
      { href: '/mapa', rotulo: 'Mapa', icone: 'mapa' },
      { href: '/xingu', rotulo: 'IA Xingú', icone: 'xingu' },
      { href: '/municipio/5103403', rotulo: 'Fichas municipais', icone: 'ficha' },
      { href: '/fontes', rotulo: 'Agentes de fonte', icone: 'fontes' },
    ],
  },
  {
    grupo: 'Cidadania',
    itens: [{ href: '/direitos', rotulo: 'Mapa de Direitos', icone: 'direitos' }],
  },
  {
    grupo: 'Mapeamento próprio',
    itens: [
      { href: '/geoportal', rotulo: 'Geoportal', icone: 'geoportal' },
      { href: '/acervo', rotulo: 'Acervo', icone: 'acervo' },
      { href: '/campo', rotulo: 'Campo', icone: 'campo' },
    ],
  },
  {
    grupo: 'Governança',
    itens: [
      { href: '/cobertura', rotulo: 'Cobertura', icone: 'cobertura' },
      { href: '/transparencia', rotulo: 'Transparência', icone: 'transparencia' },
    ],
  },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [recolhida, setRecolhida] = useState(false);
  const [aberta, setAberta] = useState(false); // drawer mobile

  useEffect(() => {
    setRecolhida(localStorage.getItem('itmt.sidebar.recolhida') === '1');
  }, []);

  useEffect(() => {
    setAberta(false); // navegar fecha o drawer
  }, [pathname]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberta(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  function alternarRecolhida() {
    const v = !recolhida;
    setRecolhida(v);
    localStorage.setItem('itmt.sidebar.recolhida', v ? '1' : '0');
  }

  const ativo = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href.split('/').slice(0, 2).join('/'));

  return (
    <div className="shell" data-recolhida={recolhida ? '1' : '0'} data-aberta={aberta ? '1' : '0'}>
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="marca">
          <Link href="/" aria-label="Início — Plataforma itMT" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/itmt-icone.png" alt="" />
            <span className="nome">Plataforma itMT</span>
          </Link>
        </div>
        <nav>
          {NAV.map((g) => (
            <div key={g.grupo}>
              <div className="grupo">{g.grupo}</div>
              {g.itens.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`sidebar-item${ativo(it.href) ? ' ativo' : ''}`}
                  aria-current={ativo(it.href) ? 'page' : undefined}
                  title={recolhida ? it.rotulo : undefined}
                >
                  {I[it.icone]}
                  <span className="rotulo">{it.rotulo}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <button
          className="btn-recolher"
          onClick={alternarRecolhida}
          aria-expanded={!recolhida}
          title={recolhida ? 'Expandir menu' : 'Recolher menu'}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg>
          <span className="rotulo">Recolher menu</span>
        </button>
      </aside>

      <div className="sidebar-overlay" onClick={() => setAberta(false)} aria-hidden="true" />

      <div className="principal">
        <header className="topo">
          <button
            className="btn-hamburguer"
            onClick={() => setAberta(true)}
            aria-label="Abrir menu de navegação"
            aria-expanded={aberta}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link href="/" aria-label="Início — Plataforma itMT" style={{ display: 'flex', alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo-header" src="/itmt-icone.png" alt="Plataforma itMT" />
          </Link>
        </header>
        <main id="conteudo" style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
