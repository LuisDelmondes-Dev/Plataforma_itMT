'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Em DEV o service worker não opera: os chunks do next dev têm nomes
    // estáveis e o cache-first servia CSS/JS velhos com HTML novo (layout
    // quebrado até limpar o cache à mão). Além de não registrar, remove
    // qualquer SW herdado de sessões antigas. Produção não muda (EV-049).
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then((rs) => Promise.all(rs.map((r) => r.unregister())))
        .then(() => caches?.keys?.())
        .then((ks) => ks && Promise.all(ks.map((k) => caches.delete(k))))
        .catch(() => {});
      return;
    }

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
