// Service worker for Circuit Defense — makes the game installable + offline-cacheable
// when HOSTED over http/https (e.g. GitHub Pages). It does NOTHING on file:// (service
// workers can't register there), so double-click-from-Explorer play is unaffected, and
// it never runs in the headless test harness (also file://). No build step — this is a
// plain classic script the deploy workflow copies verbatim alongside the game files.
//
// Strategy: cache-first for the app shell so a return visit (or an offline launch of the
// installed PWA) loads instantly from cache; network responses for same-origin GETs are
// folded back into the cache so newly-deployed files become available offline next time.
// Bump CACHE on each release so the activate step evicts the previous version.
const CACHE = 'circuit-defense-v2.34.0';
const ASSETS = [
  './',
  'index.html',
  'tower-defense.html',
  'tower-defense.css',
  'cd-core.js', 'cd-maps.js', 'cd-defs.js', 'cd-state.js',
  'cd-game.js', 'cd-update.js', 'cd-endgame.js', 'cd-render.js',
  'manifest.webmanifest',
  'icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
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
      // Cache same-origin successful GETs so new/updated files become offline-available.
      if (res && res.ok && new URL(e.request.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('tower-defense.html')))   // offline fallback to the game shell
  );
});
