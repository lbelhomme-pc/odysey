const CACHE_NAME = "odysey-pwa-v1";
const APP_SHELL_URLS = [
  "./",
  "./index.html",
  "./index-web.html",
  "./manifest.webmanifest",
  "./src/index.html",
  "./src/styles.css",
  "./src/print.css",
  "./src/app.mjs",
  "./src/profiles.mjs",
  "./src/pdf-processing.mjs",
  "./src/assets/odysey-brand.png",
  "./src/assets/odysey-icon.png",
  "./src/assets/pwa-icon-192.png",
  "./src/assets/pwa-icon-512.png",
  "./src/assets/pwa-icon-maskable-512.png",
  "./src/core/document/bookmark-store.mjs",
  "./src/core/document/annotation-store.mjs",
  "./src/core/document/document-report.mjs",
  "./src/core/document/document-model.mjs",
  "./src/core/export/print-manifest.mjs",
  "./src/core/reading/decoding-engine.mjs",
  "./src/core/reading/syllabify-french.mjs",
  "./src/core/reading/math-support.mjs",
  "./src/core/reading/reading-guide.mjs",
  "./src/core/reading/audio-engine.mjs",
  "./src/core/ocr/ocr-engine.mjs",
  "./src/core/accessibility/keyboard-nav.mjs",
  "./src/core/accessibility/aria-manager.mjs",
  "./src/core/pwa/pwa-manager.mjs",
  "./src/core/support/support-links.mjs",
  "./src/core/lexicon/french-lexicon.mjs",
  "./src/core/lexicon/french-lexicon.generated.mjs"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === "opaque") {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => caches.match("./src/index.html"));
    })
  );
});
