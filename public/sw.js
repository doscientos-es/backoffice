// Minimal service worker — satisfies PWA installability requirements.
// No aggressive caching: backoffice data must always be fresh.
const CACHE_NAME = "doscientos-bo-v1";

// Only pre-cache the app shell assets listed by Next.js
self.addEventListener("install", (_event) => {
  // Skip waiting so the SW activates immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim all clients so the SW controls existing tabs
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// Network-first strategy: always try the network; fall back to cache for
// static assets only. API/auth routes are never cached.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept non-GET requests or cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Never cache auth or API routes
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  // For everything else: network-first, cache static assets as fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache only successful responses for static assets (_next/static)
        if (response.ok && url.pathname.startsWith("/_next/static/")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
