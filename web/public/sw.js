/* itMT PWA: app shell público. Dados de API e respostas autenticadas nunca entram no cache.
 *
 * POLÍTICA DE CACHE = ALLOWLIST (EV-20260822-049). Antes, a navegação era
 * cacheada por denylist (tudo da origem menos `/biblioteca/curadoria`), o que
 * punha `/o/<slug>` — o workspace privado do tenant — no cache do dispositivo;
 * o `PURGE_PRIVATE` lá embaixo só apagava DEPOIS, na troca de organização.
 * Agora vale o inverso: rota que não estiver declarada abaixo NÃO é cacheada.
 * Ao criar rota nova, o silêncio é seguro — só entra aqui o que for público.
 */
// v4: purga o CSS/JS de dev preso em navegadores (layout sem padding);
// o SW agora só opera em produção. Política de allowlist de EV-049 intacta.
const CACHE = 'itmt-shell-v4';
const APP_SHELL = ['/', '/campo', '/itmt-icone.png', '/itmt-horizontal.png'];

/** Navegações públicas que podem ficar offline. Prefixo exato ou início de rota. */
const NAVEGACAO_PUBLICA = [
  '/consulta', '/mapa', '/municipio/', '/painel', '/cenarios',
  '/xingu', '/geoportal', '/acervo', '/campo',
  '/direitos', '/participacao', '/ciencia', '/transparencia', '/cobertura',
  '/biblioteca',
];
/** Exceções privadas dentro de prefixos públicos (curadoria vive sob /biblioteca). */
const NAVEGACAO_PRIVADA = ['/biblioteca/curadoria'];

function podeCachearNavegacao(pathname) {
  if (pathname === '/') return true;
  if (NAVEGACAO_PRIVADA.some((p) => pathname.startsWith(p))) return false;
  return NAVEGACAO_PUBLICA.some((p) => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((chave) => chave !== CACHE).map((chave) => caches.delete(chave))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const requisicao = event.request;
  if (requisicao.method !== 'GET') return;

  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (requisicao.mode === 'navigate') {
    event.respondWith(
      fetch(requisicao)
        .then((resposta) => {
          if (resposta.ok && podeCachearNavegacao(url.pathname)) {
            const copia = resposta.clone();
            caches.open(CACHE).then((cache) => cache.put(requisicao, copia));
          }
          return resposta;
        })
        .catch(async () => (await caches.match(requisicao)) ?? (await caches.match('/campo')) ?? caches.match('/')),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(requisicao).then((armazenada) => armazenada ?? fetch(requisicao).then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put(requisicao, copia));
        }
        return resposta;
      })),
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.origin !== self.location.origin) return;
  if (event.data?.type !== 'PURGE_PRIVATE') return;
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    const chaves = await cache.keys();
    await Promise.all(chaves.filter((req) => new URL(req.url).pathname.startsWith('/o/')).map((req) => cache.delete(req)));
  }));
});
