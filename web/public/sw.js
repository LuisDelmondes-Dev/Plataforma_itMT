/* itMT PWA: app shell público. Dados de API e respostas autenticadas nunca entram no cache. */
const CACHE = 'itmt-shell-v1';
const APP_SHELL = ['/', '/campo', '/itmt-icone.png', '/itmt-horizontal.png'];

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
          if (resposta.ok && !url.pathname.startsWith('/biblioteca/curadoria')) {
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
  if (event.data?.type !== 'PURGE_PRIVATE') return;
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    const chaves = await cache.keys();
    await Promise.all(chaves.filter((req) => new URL(req.url).pathname.startsWith('/o/')).map((req) => cache.delete(req)));
  }));
});
