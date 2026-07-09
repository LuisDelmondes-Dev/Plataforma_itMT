import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'ITMT — Inteligência Territorial de Mato Grosso',
  description:
    'Dados socioeconômicos, geográficos e institucionais dos 142 municípios de Mato Grosso, com procedência auditável.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Superfamília técnica do Meridiano (§15.2): Sans, Mono e Serif do mesmo desenho */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a href="#conteudo" style={{ position: 'absolute', left: -9999, top: 0 }} className="btn">
          Ir para o conteúdo
        </a>
        <header
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            padding: '0 24px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Link href="/" style={{ fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            ITMT
          </Link>
          <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
            <Link href="/consulta" style={{ color: 'var(--ink-2)' }}>
              Indicadores
            </Link>
            <Link href="/municipio/5103403" style={{ color: 'var(--ink-2)' }}>
              Fichas municipais
            </Link>
            <Link href="/cobertura" style={{ color: 'var(--ink-2)' }}>
              Cobertura
            </Link>
            <Link href="/transparencia" style={{ color: 'var(--ink-2)' }}>
              Transparência
            </Link>
          </nav>
        </header>
        <main id="conteudo" style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
