const CACHE_NAME = "odysey-pwa-__ODYSEY_BUILD_ID__";
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
  "./src/core/document/document-storage-key.mjs",
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

function isNetworkFirstRequest(request) {
  if (request.mode === "navigate") {
    return true;
  }

  const requestUrl = new URL(request.url);
  return /\.(?:html|css|js|mjs|json|webmanifest)$/i.test(requestUrl.pathname);
}

async function updateCacheFromNetwork(request) {
  const networkResponse = await fetch(request);

  if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === "opaque") {
    return networkResponse;
  }

  const responseClone = networkResponse.clone();
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, responseClone);
  return networkResponse;
}

async function cacheFirstResponse(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    return await updateCacheFromNetwork(request);
  } catch {
    return caches.match("./src/index.html");
  }
}

async function networkFirstResponse(request) {
  try {
    return await updateCacheFromNetwork(request);
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return caches.match("./src/index.html");
  }
}

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

  if (isNetworkFirstRequest(event.request)) {
    event.respondWith(networkFirstResponse(event.request));
    return;
  }

  event.respondWith(cacheFirstResponse(event.request));
});
