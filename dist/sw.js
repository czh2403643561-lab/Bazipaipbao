const CACHE = 'bazi-preview-10';
const ASSETS = ['./', './index.html', './style.css', './app.js', './lunar.js', './apk-terms-data.js', './apk-terms.js', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => { if (event.request.method === 'GET' && new URL(event.request.url).origin === self.location.origin) event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request))); });
