const CACHE = 'cinerule-camera-v3';
const ROOT = new URL('./', self.location.href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const page = await fetch(new URL('index.html', ROOT), {cache: 'reload'});
    if (!page.ok) throw new Error('App shell unavailable');
    const html = await page.clone().text();
    await cache.put(new URL('index.html', ROOT), page);
    const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
      .map(match => new URL(match[1], ROOT)).filter(url => url.origin === ROOT.origin);
    await cache.addAll([...new Set([...assets.map(url => url.href),
      ...['manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'].map(p => new URL(p, ROOT).href)])]);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('cinerule-camera-') && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (!response.ok) throw new Error('Page unavailable');
      return response;
    }).catch(() => caches.match(new URL('index.html', ROOT))));
  } else {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
  }
});
