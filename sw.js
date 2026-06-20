const ALLONAHUB_CACHE = "allonahub-pwa-20260621-2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./manifest.webmanifest",
  "./css/allonahub-home.css?v=20260621-pwa1",
  "./css/platform.css?v=20260621-mobile1",
  "./js/core.js?v=20260619-sec1",
  "./js/layout.v3.js?v=20260620-account2",
  "./js/platform.js?v=20260620-brand2",
  "./js/allonahub-home.js?v=20260620-services2",
  "./js/pwa-install.js?v=20260621-pwa2",
  "./images/brand/allonahub-icon-180.png",
  "./images/brand/allonahub-icon-192.png",
  "./images/brand/allonahub-icon-512.png",
  "./images/brand/allona.logo.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(ALLONAHUB_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith("allonahub-pwa-") && key !== ALLONAHUB_CACHE)
        .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if(request.method !== "GET"){return}

  const requestUrl = new URL(request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;

  if(request.mode === "navigate"){
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(ALLONAHUB_CACHE).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  if(!sameOrigin){return}

  event.respondWith(
    caches.match(request).then(cached => {
      if(cached){return cached}
      return fetch(request).then(response => {
        if(response && response.ok){
          const copy = response.clone();
          caches.open(ALLONAHUB_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
