const CACHE_NAME = "trapstand-v3";
const BASE_URL = new URL(self.registration.scope).pathname;
const APP_SHELL = [BASE_URL, `${BASE_URL}manifest.webmanifest`, `${BASE_URL}icon.svg`, `${BASE_URL}assets/settings.json`, `${BASE_URL}bad-camberg-logo.jpg`];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  // Cross-origin requests (Cloud-Sync-Worker: /data, /sync, /live, /ping) niemals
  // ueber den Cache bedienen. Cache-First wuerde sonst eine einmalige Fehlantwort
  // (z. B. 401 vor korrektem Token) einfrieren und dauerhaft ausliefern.
  if (new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  // App-Shell (Navigation): Stale-While-Revalidate. Die gecachte Shell wird sofort
  // ausgeliefert, damit der Start am Stand ohne verlaesslichen Netz nicht auf einen
  // Netz-Timeout wartet. Parallel wird im Hintergrund eine frische Version geholt und
  // in den Cache gelegt, sodass der naechste Start das aktuelle Deployment bekommt.
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match(BASE_URL).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(BASE_URL, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(BASE_URL));
    })
  );
});
