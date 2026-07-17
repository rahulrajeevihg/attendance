// Development-safe no-op service worker.
// It unregisters itself and clears all caches so stale Next.js assets stop breaking local dev.

self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        await self.registration.unregister();

        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        clients.forEach((client) => client.navigate(client.url));
    })());
});
