import type { MetadataRoute } from 'next';
import { REGIAO } from '@/lib/regiao';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: `itMT — Inteligência Territorial de ${REGIAO.nome}`,
    short_name: 'itMT',
    description: `Dados territoriais de ${REGIAO.nome} com procedência auditável e coleta de campo offline.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f7fb',
    theme_color: '#071b5f',
    lang: 'pt-BR',
    orientation: 'any',
    categories: ['government', 'productivity', 'utilities'],
    icons: [
      { src: '/itmt-icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/itmt-icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Maskable: arte com zona de segurança sobre o navy institucional.
      { src: '/itmt-icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
