'use client';

import { useEffect, useState } from 'react';

/**
 * Banner global de rede: o SW serve o HTML cacheado de 14 rotas, mas a API
 * (corretamente, EV-049) fica fora do cache — sem este aviso, o portal
 * offline parecia "quebrado e vazio" em vez de "sem conexão".
 */
export function BannerOffline() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const ligar = () => setOffline(false);
    const desligar = () => setOffline(true);
    window.addEventListener('online', ligar);
    window.addEventListener('offline', desligar);
    return () => {
      window.removeEventListener('online', ligar);
      window.removeEventListener('offline', desligar);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="banner-offline" role="status" aria-live="polite">
      Você está offline — os dados exibidos podem estar desatualizados e novas consultas não
      funcionarão até a conexão voltar.
    </div>
  );
}
