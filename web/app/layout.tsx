import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './globals.css';
import { Shell } from '@/components/Shell';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { BannerOffline } from '@/components/BannerOffline';
import { REGIAO } from '@/lib/regiao';

// Self-host via next/font: os .woff2 são servidos do nosso domínio — o
// navegador do cidadão nunca fala com o Google (doutrina de soberania).
const inter = Inter({ subsets: ['latin'], variable: '--fonte-inter', display: 'swap' });

export const metadata: Metadata = {
  title: `Plataforma itMT — Inteligência Territorial de ${REGIAO.nome}`,
  description:
    `Dados socioeconômicos, geográficos e institucionais dos ${REGIAO.municipiosEsperados} municípios de ${REGIAO.nome}, com procedência auditável.`,
  icons: { icon: '/itmt-icone.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <ServiceWorkerRegistration />
        <BannerOffline />
        <a href="#conteudo" className="btn skip-link">
          Ir para o conteúdo
        </a>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
