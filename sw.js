// Quête — cache hors ligne robuste
const CACHE = 'quete-v10';
const OPTIONAL_SHELL = ['manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const indexURL = new URL('index.html', self.registration.scope);
    const homeURL = new URL('./', self.registration.scope);

    // La page principale est indispensable : si elle ne peut pas être mise
    // en cache, l'installation échoue et l'ancien service worker reste actif.
    const response = await fetch(new Request(indexURL.href, { cache: 'reload' }));
    if (!response.ok) throw new Error('Impossible de mettre index.html en cache');
    await cache.put(indexURL.href, response.clone());
    await cache.put(homeURL.href, response.clone());

    // Les ressources secondaires ne doivent pas bloquer le mode hors ligne.
    await Promise.allSettled(OPTIONAL_SHELL.map(async path => {
      const url = new URL(path, self.registration.scope);
      const asset = await fetch(new Request(url.href, { cache: 'reload' }));
      if (!asset.ok) throw new Error('Ressource indisponible : ' + path);
      await cache.put(url.href, asset);
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    try {
      return await fetch(request);
    } catch {
      if (request.mode === 'navigate') {
        const offlinePage = await caches.match(new URL('index.html', self.registration.scope).href);
        if (offlinePage) return offlinePage;
      }
      return Response.error();
    }
  })());
});
