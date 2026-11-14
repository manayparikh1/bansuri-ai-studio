// Offline-first service worker: every file the app needs is stored on install, then served from the device.
const VERSION = 'v1.0.1';
const CACHE = 'bansuri-studio-' + VERSION;
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/dom.js', './js/store.js', './js/audio.js', './js/pitch.js', './js/theory.js', './js/analysis.js',
  './js/raags.js', './js/raagid.js', './js/tanpura.js', './js/lessons.js',
  './js/views/home.js', './js/views/live.js', './js/views/raag.js', './js/views/tanpura.js', './js/views/tuner.js',
  './js/views/practice.js', './js/views/learn.js', './js/views/settings.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bansuri-studio-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // While developing on this computer, prefer fresh files; everywhere else serve the stored copy first.
  const dev = ['localhost', '127.0.0.1'].includes(location.hostname);
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = () => c.match(req, { ignoreSearch: true });
    if (dev) {
      try { const res = await fetch(req, { cache: 'no-store' }); if (res.ok) c.put(req, res.clone()); return res; }
      catch (err) { return (await hit()) || (req.mode === 'navigate' ? c.match('./index.html') : Promise.reject(err)); }
    }
    const cached = await hit();
    if (cached) return cached;
    try { return await fetch(req); }
    catch (err) { if (req.mode === 'navigate') return c.match('./index.html'); throw err; }
  }));
});
