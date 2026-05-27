const CACHE_NAME = 'gleeye-pwa-cache-v2016'; // bust per fix voice memo
const urlsToCache = [
    '/',
    '/index.html',
    '/logo_gleeye.png',
    '/logo_gleeye_new.png'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Force active immediately
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip unsupported schemes (like chrome-extension:// or other protocols)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return; // Let the browser handle it normally
    }

    // 1. BYPASS CACHE FOR LOCAL DEVELOPMENT
    // If we are on localhost or a local IP, we want to see changes immediately without SW interference
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.startsWith('192.168.') || url.hostname.includes('supabase.co')) {
        return; // Let the browser handle it normally (bypass SW)
    }

    // 2. NETWORK FIRST strategy for Logic and Styles
    const isLogicOrStyle =
        event.request.mode === 'navigate' ||
        event.request.destination === 'style' ||
        event.request.destination === 'script' ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css');

    if (isLogicOrStyle && event.request.method === 'GET') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Only cache successful responses (and ignore opaque/chrome-extension)
                    if (!response || response.status !== 200) {
                        return response;
                    }

                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        try {
                            const cacheUrl = new URL(event.request.url);
                            if (cacheUrl.protocol === 'http:' || cacheUrl.protocol === 'https:') {
                                cache.put(event.request, responseClone);
                            }
                        } catch (e) {
                            // Silently fail if put fails (e.g. extension scripts)
                        }
                    }).catch(() => {});
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 3. Default Cache Strategy for assets (images, etc)
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response;
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ]).then(() => {
            // Forza reload di tutti i client dopo aggiornamento SW
            // Garantisce che iOS PWA carichi i file aggiornati senza reinstallare
            return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
                clients.forEach(client => {
                    client.navigate(client.url);
                });
            });
        })
    );
});

// Listener per le notifiche push esterne
self.addEventListener('push', function (event) {
    let data = { title: 'Gleeye ERP', body: 'Nuova Notifica' };
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }
    const options = {
        body: data.body,
        icon: data.icon || '/logo_gleeye.png',
        badge: data.badge || '/logo_gleeye.png',
        data: data.url || '/'
    };
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Gestione del click sulla notifica
self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            return clients.openWindow(event.notification.data || '/');
        })
    );
});
