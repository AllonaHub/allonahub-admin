# AllonaHub Subdomain Routing

Son guncelleme: 29.06.2026

Bu dokuman AllonaHub modullerinin `*.allonahub.com` altinda calismasi icin gereken uygulama ve Cloudflare adimlarini ozetler.

## Mimari

- Ana domain: `allonahub.com`
- Wildcard DNS: `*.allonahub.com`
- Frontend router: `js/subdomain-router.js`
- Cloudflare script: `deploy/cloudflare/apply-allonahub-rules.mjs`
- Eski yollar korunur: `/pages/...` linkleri calismaya devam eder.

Subdomain kok istekleri kanonik sayfaya tasinir:

```text
shop.allonahub.com/   -> /pages/commerce/allonashop.html
yemek.allonahub.com/  -> /pages/commerce/allonayemek.html
market.allonahub.com/ -> /pages/commerce/allonamarket.html
taksi.allonahub.com/  -> /pages/ecosystem/allonataksi.html
```

## Cloudflare DNS

Cloudflare panelinde manuel kayit:

```text
Type: CNAME
Name: *
Target: allonahub.com
Proxy: Proxied
TTL: Auto
```

API ile uygulama:

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ZONE_ID="..."
APPLY_WILDCARD_DNS=1 node deploy/cloudflare/apply-allonahub-rules.mjs
```

Partner kaydi da ayni anda acilacaksa:

```bash
APPLY_PARTNER_DNS=1 APPLY_WILDCARD_DNS=1 node deploy/cloudflare/apply-allonahub-rules.mjs
```

## SSL

Cloudflare proxy aktifse Universal SSL wildcard hostlari karsilar. Origin sunucuda dogrudan wildcard SSL kullanilacaksa `*.allonahub.com` sertifikasi gerekir.

## Auth ve API Notlari

- Supabase Auth redirect allowlist'ine kullanilacak subdomainler eklenmelidir.
- Backend API `api.allonahub.com` olarak kalir.
- Frontend CORS/callback kullanan entegrasyonlarda `https://*.allonahub.com` kapsamli izinler kontrol edilmelidir.
- Tarayici localStorage subdomain bazlidir. Tek oturum deneyimi istenirse sonraki fazda merkezi auth/SSO veya server cookie mimarisi kurulmalidir.

## Canli Kontrol

DNS ve rules uygulandiktan sonra:

```bash
curl -I https://shop.allonahub.com/
curl -I https://yemek.allonahub.com/
curl -I https://market.allonahub.com/
curl -I https://taksi.allonahub.com/
curl -I https://partner.allonahub.com/panel
```

Beklenen davranis:

- Kisa kok istekleri 301 ile kanonik `/pages/...` yoluna gider.
- Kanonik sayfa 200 doner.
- Eski ana domain linkleri calismaya devam eder.

## Cloudflare Rule Kotasi Notu

Cloudflare planinda dynamic redirect rule kotasi dusukse tum moduller icin server-side 301 kurallari uygulanamayabilir. Bu durumda `js/subdomain-router.js` frontend fallback olarak calisir; tam server-side yonlendirme icin bir sonraki adim Cloudflare Worker ile tek harita uzerinden routing kurmaktir.
