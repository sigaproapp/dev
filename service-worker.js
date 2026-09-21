const CACHE_NAME = 'siga-shell-v3';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        fetch(event.request)
            .then(response => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                return response;
            })
            .catch(() => caches.match(event.request).then(response => response || caches.match('./index.html')))
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = './';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            if (clientList.length > 0) {
                const firstClient = clientList[0];
                return firstClient.focus();
            }
            return clients.openWindow(url);
        })
    );
});
