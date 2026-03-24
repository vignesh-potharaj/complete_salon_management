const CACHE_NAME = "salonpro-v5"; // Resetting to stable state
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdn.jsdelivr.net/npm/chart.js"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  // EXCLUDE APK DOWNLOADS FROM SERVICE WORKER
  if (event.request.url.endsWith('.apk')) {
    return; // Pass through to browser
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
