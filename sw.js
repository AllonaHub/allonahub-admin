const ALLONAHUB_CACHE = "allonahub-pwa-20260626-hero-customads1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json?v=20260622-icon1",
  "./manifest.webmanifest?v=20260622-icon1",
  "./css/allonahub-home.css?v=20260626-hero-customads1",
  "./css/platform.css?v=20260626-mobile-std5",
  "./js/config.js?v=20260621-homeauth1",
  "./js/core.js?v=20260623-mfa2",
  "./js/supabase-client.js?v=20260623-reset1",
  "./js/auth.js?v=20260623-mfa2",
  "./js/layout.v3.js?v=20260626-mobile-std5",
  "./js/platform.js?v=20260626-mobile-std5",
  "./js/allonahub-home.js?v=20260626-hero-customads1",
  "./js/pwa-install.js?v=20260626-hero-customads1",
  "./images/brand/allonahub-icon-180.png?v=20260622-icon1",
  "./images/brand/allonahub-icon-192.png?v=20260622-icon1",
  "./images/brand/allonahub-icon-512.png?v=20260622-icon1",
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
