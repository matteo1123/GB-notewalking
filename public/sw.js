const CACHE_NAME = 'gb-notewalking-v1';

// App shell — cache on install so the app works offline
const APP_SHELL = [
    '/',
    '/manifest.json',
    '/favicon.svg',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Remove old caches
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Don't cache Supabase API or Stripe calls
    if (
        url.hostname.includes('supabase.co') ||
        url.hostname.includes('stripe.com') ||
        request.method !== 'GET'
    ) {
        return;
    }

    // Network-first for navigation (HTML), cache-first for assets
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                    return res;
                })
                .catch(() => caches.match('/') )
        );
    } else {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(request, clone));
                    return res;
                });
            })
        );
    }
});

// Keep push notification support
self.addEventListener('push', (event) => {
    if (event.data) {
        try {
            const data = event.data.json();
            event.waitUntil(
                self.registration.showNotification(data.title, {
                    body: data.body,
                    icon: '/favicon.svg',
                    badge: '/favicon.svg',
                    data: { url: data.url || '/' },
                })
            );
        } catch (e) {
            console.error('Error parsing push data:', e);
        }
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            const targetUrl = event.notification.data.url;
            for (const client of windowClients) {
                if (client.url === targetUrl && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});
