'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const registrar = () => {
      navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      }).catch((erro) => {
        console.error('[pwa] não foi possível registrar o service worker', erro);
      });
    };

    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });

    return () => window.removeEventListener('load', registrar);
  }, []);

  return null;
}
