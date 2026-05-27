const CACHE_NAME = 'dryfu-cache-v3';

// Dono HTML pages aur dono manifest files cache hongi
const urlsToCache = [
    './',
    './index.html',
    './code.html',
    './style.css',
    './script.js',
    './manifest.json',
    './manifest-verify.json'
];

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching app shell');
            return cache.addAll(urlsToCache);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    if (url.includes('firebasedatabase') || url.includes('firebaseio') ||
        url.includes('gstatic.com') || url.includes('qrserver.com') ||
        url.includes('wa.me') || url.includes('cdnjs')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    return new Response('<h2 style="font-family:sans-serif;text-align:center;padding:40px">⚠️ Offline Mode<br><small>Internet connect karein</small></h2>', {
                        headers: { 'Content-Type': 'text/html' }
                    });
                });
            })
    );
});