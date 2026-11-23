// Service worker: keeps the app working offline, but always prefers fresh files when online.
// Bump CACHE whenever any file changes (it also names the offline copy).
// - install: fetches every file with cache:'reload' so the browser's HTTP cache (GitHub Pages allows
//   10 min) can never hand it a stale file to store.
// - fetch: network first (revalidated, 4 s timeout), falling back to the stored copy when offline.
const CACHE = 'chill-radio-v0.6.2';
const ASSETS = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/app.js', './js/mediasession.js',
  './js/engine/music.js', './js/engine/instruments.js', './js/engine/audio.js',
  './js/engine/parts.js', './js/engine/song.js', './js/engine/radio.js', './js/engine/sequencer.js',
  './js/styles/index.js', './js/styles/chillwave.js', './js/styles/synthwave.js', './js/styles/darksynth.js', './js/styles/scenes.js', './js/styles/lofi.js', './js/styles/electro.js', './js/styles/complextro.js', './js/styles/electrohouse.js',
  './app-icons/app-icon-192.png', './app-icons/app-icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || location.hostname === 'localhost' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    Promise.race([
      fetch(r, { cache: 'no-cache' }),
      new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 4000)),
    ])
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
        return res;
      })
      .catch(() => caches.match(r).then(hit => hit || caches.match('./index.html')))
  );
});
