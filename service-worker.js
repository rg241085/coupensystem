const CACHE_NAME = 'dryfu-cache-v1';

// Install event
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installed');
    self.skipWaiting();
});

// Fetch event (Bypass for now, just to trigger Install Prompt)
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request).catch(() => {
        return new Response('Offline mode not fully configured yet.');
    }));
});