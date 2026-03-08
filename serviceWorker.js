const CACHE_NAME = "salonpro-v1";
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./icon-192.svg",
  "./icon-512.svg",
  "https://cdn.jsdelivr.net/npm/chart.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // return cached version or fetch from network
      return response || fetch(event.request);
    })
  );
});
