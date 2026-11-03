// Offline support for the web/PWA version. Bump CACHE when you ship changes.
const CACHE = 'bloopdrop-v1';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'fonts/nunito-latin.woff2', 'manifest.webmanifest',
  'js/main.js', 'js/game.js', 'js/bloop.js', 'js/audio.js', 'js/save.js', 'js/economy.js', 'js/config.js',
  'js/monetization/store.js', 'js/monetization/ads.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
