const CACHE_NAME = 'firstlook-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/logo.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Limit maximum cached static asset items to keep memory footprint low
const MAX_CACHE_ITEMS = 50;

function trimCache(cacheName, maxItems) {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(() => trimCache(cacheName, maxItems));
      }
    });
  });
}

self.addEventListener('fetch', (event) => {
  // Only intercept HTTP/HTTPS queries
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Parse path to check if it represents a backend API request
  const requestUrl = new URL(event.request.url);

  // CRITICAL: NEVER cache API endpoints or real-time web socket proxies. 
  // Dynamic JSON (like candle data in charts or watchlist changes) updates frequently and is too massive for static caches.
  if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname.includes('/api')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background to update cache for static assets (Stale-While-Revalidate)
        fetch(event.request).then((freshResponse) => {
          if (freshResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, freshResponse);
              trimCache(CACHE_NAME, MAX_CACHE_ITEMS);
            });
          }
        }).catch(() => {/* Ignore network errors of background fetches */});
        
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // If it's a valid static asset response, cache it!
        if (response.status === 200 && event.request.method === 'GET') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
            trimCache(CACHE_NAME, MAX_CACHE_ITEMS);
          });
        }
        return response;
      }).catch(() => {
        // Fallback to offline index for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
