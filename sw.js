// Pawsage service worker. Bump VERSION on every release.
const VERSION = 'pawsage-v2';
const COVERS = 'pawsage-covers-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/tokens.css', 'css/base.css', 'css/app.css',
  'js/main.js', 'js/config.js', 'js/db.js', 'js/actions.js', 'js/store.js', 'js/router.js', 'js/html.js', 'js/ui.js', 'js/sound.js',
  'js/streaks.js', 'js/covers.js', 'js/guard.js', 'js/timer.js', 'js/openlibrary.js', 'js/vendor/supabase.js',
  'js/views/onboarding.js', 'js/views/home.js', 'js/views/library.js', 'js/views/add.js', 'js/views/book.js', 'js/views/log.js',
  'js/views/stats.js', 'js/views/celebrate.js', 'js/views/recap.js', 'js/views/more.js', 'js/views/shared.js',
  'fonts/nunito-latin-600-normal.woff2', 'fonts/nunito-latin-700-normal.woff2', 'fonts/nunito-latin-800-normal.woff2', 'fonts/nunito-latin-900-normal.woff2',
  'assets/logo/mark.svg', 'assets/logo/wordmark.svg',
  'assets/mochi/mochi-happy.svg', 'assets/mochi/mochi-curious.svg', 'assets/mochi/mochi-sleepy.svg', 'assets/mochi/mochi-cheering.svg',
  'assets/mochi/mochi-miss-you.svg', 'assets/mochi/mochi-reading.svg', 'assets/mochi/mochi-full.svg', 'assets/mochi/mochi-full-cheering.svg', 'assets/mochi/mochi-loaf.svg',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== COVERS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Supabase and Open Library search: always the network
  if (url.hostname.endsWith('supabase.co') || url.hostname === 'openlibrary.org' || url.hostname === 'www.googleapis.com') return;
  // covers: show the cached one at once, refresh in the background (capped)
  if (url.hostname === 'covers.openlibrary.org' || url.hostname.endsWith('archive.org') || url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) {
    e.respondWith(caches.open(COVERS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(async r => { if (r.ok) { await c.put(req, r.clone()); const keys = await c.keys(); if (keys.length > 200) await c.delete(keys[0]); } return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // pages: network first so a release shows up, falling back to the cached shell offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; })));
});
