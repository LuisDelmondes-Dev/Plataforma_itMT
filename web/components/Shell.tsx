'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';

/** Ícones dos seis caminhos principais — traço institucional, herdam currentColor. */
const I = {
  inicio: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" /></svg>,
  explorar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20V9M10 20V4M16 20v-7M21 20H3" /></svg>,
  analisar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 1 0-3.1 6.3L21 20l-1.2-3.6A7.9 7.9 0 0 0 20 12Z" /><path d="M8.5 11h7M8.5 14.5h4" /></svg>,
  territorio: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>,
  cidadania: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16M5 7h14M5 7 3 12a3.2 3.2 0 0 0 6.4 0L7 7M17 7l-2.4 5a3.2 3.2 0 0 0 6.4 0L19 7M8.5 20h7" /></svg>,
  mais: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.25" fill="currentColor" stroke="none" /></svg>,
  operacao: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" /></svg>,
};

type ItemNavegacao = { href: string; rotulo: string };
type SecaoNavegacao = {
  id: string;
  rotulo: string;
  icone: keyof typeof I;
  href?: string;
  itens?: ItemNavegacao[];
};

// Onda D: o menu separa o PORTAL público da área de OPERAÇÃO (restrita
// por token). As rotas antes órfãs — /fontes, /biblioteca/curadoria e
// /direitos/descubra — ganharam entrada, e "Fichas municipais" aponta
// para o índice /municipio (antes era um município hardcoded).
const NAV: SecaoNavegacao[] = [
  { id: 'inicio', rotulo: 'Início', icone: 'inicio', href: '/' },
  {
    id: 'explorar', rotulo: 'Explorar dados', icone: 'explorar',
    itens: [
      { href: '/consulta', rotulo: 'Indicadores' },
      { href: '/mapa', rotulo: 'Mapa territorial' },
      { href: '/municipio', rotulo: 'Fichas municipais' },
      { href: '/painel', rotulo: 'Painel de síntese' },
    ],
  },
  {
    id: 'analisar', rotulo: 'Analisar', icone: 'analisar',
    itens: [
      { href: '/xingu', rotulo: 'Perguntar à Xingú' },
      { href: '/cenarios', rotulo: 'Cenários' },
    ],
  },
  {
    id: 'territorio', rotulo: 'Território', icone: 'territorio',
    itens: [
      { href: '/geoportal', rotulo: 'Geoportal' },
      { href: '/acervo', rotulo: 'Acervo territorial' },
    ],
  },
  {
    id: 'cidadania', rotulo: 'Cidadania', icone: 'cidadania',
    itens: [
      { href: '/direitos', rotulo: 'Mapa de Direitos' },
      { href: '/direitos/descubra', rotulo: 'Descubra os seus direitos' },
      { href: '/participacao', rotulo: 'Participação social' },
      { href: '/biblioteca', rotulo: 'Biblioteca' },
    ],
  },
  {
    id: 'mais', rotulo: 'Mais recursos', icone: 'mais',
    itens: [
      { href: '/ciencia', rotulo: 'Ciência aberta' },
      { href: '/transparencia', rotulo: 'Transparência' },
      { href: '/cobertura', rotulo: 'Cobertura de dados' },
    ],
  },
  {
    id: 'operacao', rotulo: 'Operação', icone: 'operacao',
    itens: [
      { href: '/campo', rotulo: 'Operação de campo' },
      { href: '/fontes', rotulo: 'Agentes de fonte' },
      { href: '/biblioteca/curadoria', rotulo: 'Curadoria documental' },
      { href: '/integracoes', rotulo: 'Integrações e API' },
      { href: '/organizacoes', rotulo: 'Organizações' },
    ],
  },
];

const TODOS_HREFS = NAV.flatMap((s) => (s.href ? [s.href] : (s.itens ?? []).map((i) => i.href)));

function rotaAtiva(pathname: string, href: string) {
  const casa = (h: string) => (h === '/' ? pathname === '/' : pathname === h || pathname.startsWith(`${h}/`));
  if (!casa(href)) return false;
  // O href mais específico vence: /biblioteca/curadoria não acende /biblioteca.
  return !TODOS_HREFS.some((h) => h !== href && h.length > href.length && casa(h));
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [recolhida, setRecolhida] = useState(false);
  const [aberta, setAberta] = useState(false);
  const secaoDaRota = NAV.find((secao) =>
    secao.href ? rotaAtiva(pathname, secao.href) : secao.itens?.some((item) => rotaAtiva(pathname, item.href)),
  );
  const itemDaRota = secaoDaRota?.itens?.find((item) => rotaAtiva(pathname, item.href));
  const [secoesAbertas, setSecoesAbertas] = useState<string[]>(() =>
    secaoDaRota?.itens ? [secaoDaRota.id] : [],
  );

  useEffect(() => {
    setRecolhida(localStorage.getItem('itmt.sidebar.recolhida') === '1');
  }, []);

  useEffect(() => {
    setAberta(false);
    if (secaoDaRota?.itens) {
      setSecoesAbertas((atuais) => atuais.includes(secaoDaRota.id) ? atuais : [...atuais, secaoDaRota.id]);
    }
  }, [pathname, secaoDaRota]);

  useEffect(() => {
    const esc = (event: KeyboardEvent) => event.key === 'Escape' && setAberta(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  function alternarRecolhida() {
    const valor = !recolhida;
    setRecolhida(valor);
    localStorage.setItem('itmt.sidebar.recolhida', valor ? '1' : '0');
  }

  function alternarSecao(id: string) {
    if (recolhida) {
      setRecolhida(false);
      localStorage.setItem('itmt.sidebar.recolhida', '0');
    }
    setSecoesAbertas((atuais) =>
      atuais.includes(id) ? atuais.filter((abertaId) => abertaId !== id) : [...atuais, id],
    );
  }

  return (
    <div className="shell" data-recolhida={recolhida ? '1' : '0'} data-aberta={aberta ? '1' : '0'}>
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="marca">
          <Link href="/" aria-label="Início — Plataforma itMT">
            <Image src="/itmt-icone.png" alt="" width={36} height={37} />
            <span className="nome">Plataforma itMT</span>
          </Link>
        </div>
        <nav>
          <div className="nav-contexto">Navegação</div>
          {NAV.map((secao) => {
            const secaoAtiva = secao.href
              ? rotaAtiva(pathname, secao.href)
              : Boolean(secao.itens?.some((item) => rotaAtiva(pathname, item.href)));
            if (secao.href) {
              return (
                <Link
                  key={secao.id}
                  href={secao.href}
                  className={`sidebar-item sidebar-raiz${secaoAtiva ? ' ativo' : ''}`}
                  aria-current={secaoAtiva ? 'page' : undefined}
                  title={recolhida ? secao.rotulo : undefined}
                >
                  {I[secao.icone]}
                  <span className="rotulo">{secao.rotulo}</span>
                </Link>
              );
            }

            const expandida = secoesAbertas.includes(secao.id);
            return (
              <Fragment key={secao.id}>
              {secao.id === 'operacao' && (
                <div className="nav-contexto" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.14)' }}>
                  Acesso restrito
                </div>
              )}
              <div className="sidebar-secao" data-ativa={secaoAtiva ? '1' : '0'}>
                <button
                  type="button"
                  className="sidebar-item sidebar-raiz sidebar-disclosure"
                  onClick={() => alternarSecao(secao.id)}
                  aria-expanded={expandida}
                  aria-controls={`submenu-${secao.id}`}
                  title={recolhida ? secao.rotulo : undefined}
                >
                  {I[secao.icone]}
                  <span className="rotulo">{secao.rotulo}</span>
                  <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
                </button>
                {expandida && (
                  <div className="sidebar-submenu" id={`submenu-${secao.id}`}>
                    {secao.itens?.map((item) => {
                      const ativo = rotaAtiva(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`sidebar-subitem${ativo ? ' ativo' : ''}`}
                          aria-current={ativo ? 'page' : undefined}
                        >
                          <span className="subitem-marca" aria-hidden="true" />
                          <span>{item.rotulo}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
              </Fragment>
            );
          })}
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
          <Link className="marca-mobile" href="/" aria-label="Início — Plataforma itMT">
            <Image className="logo-header" src="/itmt-icone.png" alt="Plataforma itMT" width={36} height={37} />
          </Link>
          <div className="contexto-pagina" aria-live="polite">
            <span>{secaoDaRota?.rotulo ?? 'Plataforma itMT'}</span>
            <strong>{itemDaRota?.rotulo ?? secaoDaRota?.rotulo ?? 'Inteligência territorial'}</strong>
          </div>
        </header>
        <main id="conteudo" tabIndex={-1} style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
