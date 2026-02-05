// Service Worker for Push Notifications, Offline Support, and PWA
const CACHE_NAME = 'attendance-v2';
const RUNTIME_CACHE = 'runtime-v2';
const OFFLINE_QUEUE_DB = 'offline-checkins';
const OFFLINE_QUEUE_STORE = 'queue';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/login',
    '/manifest.json',
    '/app_icon_192.png',
    '/app_icon_512.png'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - cache-first strategy for static assets, network-first for API
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Cache-first for static assets
    if (STATIC_ASSETS.some(asset => url.pathname.includes(asset)) ||
        url.pathname.match(/\.(png|jpg|jpeg|svg|css|js)$/)) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then((response) => {
                    return caches.open(RUNTIME_CACHE).then((cache) => {
                        cache.put(request, response.clone());
                        return response;
                    });
                });
            }).catch(() => {
                // Return offline page if available
                return caches.match('/');
            })
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked');
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('localhost') || client.url.includes('ihgind.com')) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// Push event
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push received');
    const data = event.data ? event.data.json() : {};

    const title = data.title || 'New Check-in Request';
    const options = {
        body: data.body || 'A team member needs approval',
        icon: '/app_icon_192.png',
        badge: '/app_icon_192.png',
        tag: 'approval-notification',
        requireInteraction: false,
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Background Sync for offline queue
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync triggered:', event.tag);

    if (event.tag === 'sync-checkins') {
        event.waitUntil(syncOfflineCheckins());
    }
});

// Sync offline check-ins when connection returns
async function syncOfflineCheckins() {
    console.log('[Service Worker] Syncing offline check-ins...');

    try {
        const db = await openDB();
        const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readonly');
        const store = tx.objectStore(OFFLINE_QUEUE_STORE);
        const allCheckins = await getAllFromStore(store);

        if (allCheckins.length === 0) {
            console.log('[Service Worker] No offline check-ins to sync');
            return;
        }

        console.log(`[Service Worker] Found ${allCheckins.length} offline check-ins`);
        const deleteTx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
        const deleteStore = deleteTx.objectStore(OFFLINE_QUEUE_STORE);

        // Notify all clients about sync start
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_START',
                count: allCheckins.length
            });
        });

        for (const checkin of allCheckins) {
            try {
                // Send to server
                const response = await fetch('https://erp.ihgind.com/api/resource/Mobile Checkin', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'token 5a58f74d3a6048c:b76e8329ac883ff',
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify(checkin.data),
                });

                if (response.ok) {
                    // Delete from queue
                    await deleteStore.delete(checkin.id);
                    console.log('[Service Worker] Synced check-in:', checkin.id);
                }
            } catch (error) {
                console.error('[Service Worker] Failed to sync check-in:', error);
            }
        }

        // Notify clients about sync completion
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE'
            });
        });

    } catch (error) {
        console.error('[Service Worker] Sync failed:', error);
    }
}

// IndexedDB helper functions
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(OFFLINE_QUEUE_DB, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
                db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

function getAllFromStore(store) {
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
