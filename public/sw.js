/* Cache only the public app shell. Never cache profiles, credentials, APIs or photos. */
const CACHE = 'msf-shell-v4';
const SHELL = ['/', '/index.html', '/css/main.css', '/js/universities.js', '/js/network-model.js',
  '/js/network-view.js', '/js/avatars.js', '/js/account.js', '/js/photos.js', '/js/app.js', '/js/pwa.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-180.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('msf-shell-') && k !== CACHE)
    .map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => { if (event.data === 'ACTIVATE_UPDATE') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/.netlify/')) return;
  if (request.mode !== 'navigate' && !SHELL.includes(url.pathname)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && SHELL.includes(url.pathname)) {
        const cache = await caches.open(CACHE);
        await cache.put(url.pathname, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request.mode === 'navigate' ? '/' : url.pathname);
      return cached || new Response('You are offline. Reconnect and try again.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
