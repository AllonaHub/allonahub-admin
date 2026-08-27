const ALLONAHUB_CACHE = "allonahub-pwa-20260828-cards1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./pages/premium.html",
  "./pages/ecosystem/yakında.html",
  "./pages/ecosystem/turkic-world.html",
  "./manifest.json?v=20260622-icon1",
  "./manifest.webmanifest?v=20260622-icon1",
  "./css/allonahub-home.css?v=20260828-cards1",
  "./css/turkic-world.css?v=20260827-country1",
  "./css/platform.css?v=20260712-theme-overflow1",
  "./css/home-module-labels.std32.css?v=20260826-active-modules1",
  "./js/config.js?v=20260621-homeauth1",
  "./js/core.js?v=20260827-country1",
  "./js/supabase-client.js?v=20260629-partnerhost1",
  "./js/auth.js?v=20260629-partnerhost1",
  "./js/layout.v3.js?v=20260712-premium-page1",
  "./js/subdomain-router.js?v=20260629-subdomains1",
  "./js/platform.js?v=20260827-country1",
  "./js/turkic-world.js?v=20260827-country1",
  "./js/sw-refresh.heading2.js?v=20260712-theme-overflow1",
  "./js/privacy-consent.js?v=20260826-active-modules1",
  "./js/allonahub-home.js?v=20260827-country1",
  "./js/pwa-install.js?v=20260712-theme-overflow1",
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
  const partnerAuthPath = sameOrigin && (
    requestUrl.pathname === "/partner" ||
    requestUrl.pathname.startsWith("/partner/") ||
    requestUrl.pathname === "/partner-panel" ||
    requestUrl.pathname.startsWith("/admin/") ||
    requestUrl.pathname.startsWith("/pages/partner/") ||
    requestUrl.pathname.startsWith("/pages/account/") ||
    requestUrl.pathname === "/css/admin-ops.css" ||
    requestUrl.pathname === "/css/super-admin.css" ||
    requestUrl.pathname === "/css/partner-os.css" ||
    requestUrl.pathname === "/css/partner-products.css" ||
    requestUrl.pathname === "/js/admin-ops.js" ||
    requestUrl.pathname === "/js/super-admin.js" ||
    requestUrl.pathname === "/js/admin-alarm.js" ||
    requestUrl.pathname === "/js/auth.js" ||
    requestUrl.pathname === "/js/mfa.js" ||
    requestUrl.pathname === "/js/partner-os.js" ||
    requestUrl.pathname === "/js/partner-products.js" ||
    requestUrl.pathname === "/js/supabase-client.js"
  );

  if(partnerAuthPath){
    event.respondWith(
      fetch(request)
        .then(response => {
          if(response && response.ok){
            const copy = response.clone();
            caches.open(ALLONAHUB_CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if(request.mode === "navigate"){
    event.respondWith(
      fetch(request)
        .then(response => {
          if(response && response.ok){
            const copy = response.clone();
            caches.open(ALLONAHUB_CACHE).then(cache => cache.put(request, copy));
          }
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
