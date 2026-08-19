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
      {
        src: '/itmt-icone.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
