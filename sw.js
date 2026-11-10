// Bump this whenever any file changes, so phones download the new version as one set.
const CACHE = 'brave-heart-v15';
const SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './fonts/inter-latin.woff2'];

self.addEventListener('install', (e) => {
  // Bypass the HTTP cache so a new version is never filled with old files.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
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

// The app shell comes only from the versioned cache, so every file in a launch is from the same version.
// Anything else from this site goes to the network and is never cached.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      if (req.mode === 'navigate') {
        return (await cache.match('./index.html')) || fetch(req);
      }
      return (await cache.match(req, { ignoreSearch: true })) || fetch(req);
    })
  );
});
