const CACHE_NAME = 'gleeye-pwa-cache-v18'; // Fix date sync and profile fetch
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

    // 1. BYPASS CACHE FOR LOCAL DEVELOPMENT
    // If we are on localhost or a local IP, we want to see changes immediately without SW interference
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.startsWith('192.168.')) {
        return; // Let the browser handle it normally (bypass SW)
    }

    // 2. NETWORK FIRST strategy for Logic and Styles
    const isLogicOrStyle =
        event.request.mode === 'navigate' ||
        event.request.destination === 'style' ||
        event.request.destination === 'script' ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css');

    if (isLogicOrStyle) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
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
            self.clients.claim(), // Take control immediately
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
        ])
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
