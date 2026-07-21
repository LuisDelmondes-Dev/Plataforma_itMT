import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Plataforma itMT — Inteligência Territorial de Mato Grosso',
  description:
    'Dados socioeconômicos, geográficos e institucionais dos 142 municípios de Mato Grosso, com procedência auditável.',
  icons: { icon: '/itmt-icone.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a href="#conteudo" className="btn skip-link">
          Ir para o conteúdo
        </a>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
