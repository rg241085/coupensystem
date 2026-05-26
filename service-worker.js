const CACHE_NAME = 'dryfu-cache-v2';

// ✅ FIX: Ab ye files cache hongi — app offline bhi basic kaam karega
const urlsToCache = [
    './',
    './index.html',
    './admin.html',
    './style.css',
    './script.js',
    './manifest.json'
];

// Install: files cache karo
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

// Activate: purana cache hato
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

// Fetch: pehle network try karo, fail ho to cache se lo
self.addEventListener('fetch', (event) => {
    // Firebase aur external requests ko bypass karo (hamesha network chahiye)
    const url = event.request.url;
    if (url.includes('firebasedatabase') || url.includes('firebaseio') ||
        url.includes('gstatic.com') || url.includes('qrserver.com') ||
        url.includes('wa.me') || url.includes('cdnjs')) {
        return; // browser default behavior
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Network se mila to cache update karo
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Offline hai to cache se do
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    return new Response('<h2 style="font-family:sans-serif;text-align:center;padding:40px">⚠️ Offline Mode<br><small>Internet connect karein</small></h2>', {
                        headers: { 'Content-Type': 'text/html' }
                    });
                });
            })
    );
});