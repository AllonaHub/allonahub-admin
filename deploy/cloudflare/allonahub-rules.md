# AllonaHub Cloudflare Rules

Son kontrol: 29.06.2026

Canli kontrolde `https://allonahub.com/_headers` dosyasinin normal statik dosya olarak servis edildigi goruldu. Bu, mevcut hosting'in Netlify/Cloudflare Pages `_headers` formatini yorumlamadigini gosterir. Bu nedenle ana domain guvenlik header'lari Cloudflare Response Header Transform Rule veya origin sunucu ayari ile uygulanmalidir.

## Uygulanacak Response Header Kurallari

Expression:

```text
((http.host eq "allonahub.com" or http.host eq "www.allonahub.com") or http.host eq "partner.allonahub.com")
```

Set edilecek header'lar:

- `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `SAMEORIGIN`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=(self), payment=(self)`

## Uygulanacak Redirect Kurallari

Expression:

```text
(http.host eq "allonahub.com" or http.host eq "www.allonahub.com") and http.request.uri.path eq "/checkout.html"
```

Action: Static redirect, 301, target:

```text
https://allonahub.com/pages/commerce/guvenli-odeme.html
```

Expression:

```text
(http.host eq "allonahub.com" or http.host eq "www.allonahub.com") and http.request.uri.path in {"/etbis.html" "/guven-damgasi.html" "/etbis-guven-damgasi.html"}
```

Action: Static redirect, 301, target:

```text
https://allonahub.com/pages/legal/etbis-guven-damgasi.html
```

Eski yasal metin kopyalari icin ek 301 yonlendirmeleri:

| Eski URL | Kanonik URL |
| --- | --- |
| `/pages/legal/mesafeli-satis-sozlesmesi.html` | `/pages/legal/mesafeli-satis.html` |
| `/pages/legal/cerez.html` | `/pages/legal/cerez-politikasi.html` |
| `/pages/legal/iptal-iade.html` | `/pages/legal/iade-politikasi.html` |

Partner kisa yollarinda canli origin `_redirects` dosyasini yorumlamadigi icin Cloudflare 301 kurali da uygulanir:

| Kisa URL | Kanonik URL |
| --- | --- |
| `/partner`, `/partner/`, `/partner.html`, `/partner-login.html`, `/partner-giris.html`, `/partner/login`, `/partner/giris` | `/pages/partner/partner.html` |
| `/partner-panel`, `/partner-panel/`, `/partner-panel.html`, `/partner/panel`, `/partner/os`, `/partner/partner-panel.html` | `/pages/partner/partner-panel.html` |

## Partner Subdomain

Trendyol benzeri partner portal yapisi icin `partner.allonahub.com` subdomain'i kullanilir.

DNS:

```text
CNAME partner -> allonahub.com
Proxy: on
```

Ana domain partner kisa yollari partner subdomain'e tasinir:

| Eski URL | Yeni URL |
| --- | --- |
| `https://allonahub.com/partner` | `https://partner.allonahub.com/` |
| `https://allonahub.com/pages/partner/partner.html` | `https://partner.allonahub.com/` |
| `https://allonahub.com/partner-panel` | `https://partner.allonahub.com/panel` |
| `https://allonahub.com/pages/partner/partner-panel.html` | `https://partner.allonahub.com/panel` |

Partner subdomain kisa yollari:

| Kisa URL | Kanonik URL |
| --- | --- |
| `https://partner.allonahub.com/` | `/pages/partner/partner.html` |
| `https://partner.allonahub.com/login` | `/pages/partner/partner.html` |
| `https://partner.allonahub.com/panel` | `/pages/partner/partner-panel.html` |

API ile DNS dahil uygulamak icin token'da Zone DNS Edit ve Zone Rulesets Edit yetkileri olmalidir:

```bash
APPLY_PARTNER_DNS=1 node deploy/cloudflare/apply-allonahub-rules.mjs
```

## WAF Notu

`/checkout.html` istegi canlida `cf-mitigated: challenge` ile kesiliyor. Redirect rule uygulaninca istek origin'e ve eski checkout path'ine dusmeden guvenli odeme sayfasina aktarilmalidir. Challenge devam ederse WAF Custom Rule icinde bu path'i challenge aksiyonundan haric tutan kural sirasi duzenlenmelidir.

API cron endpointleri icin ek WAF skip kurali uygulanir:

```text
http.host eq "api.allonahub.com"
and http.request.method eq "POST"
and starts_with(http.request.uri.path, "/v1/cron/")
```

Bu kural sadece Cloudflare challenge/security katmanini atlatir. Rate limit atlanmaz. Backend yine `x-cron-secret` degerini dogrular; secret yanlis ise istek reddedilir.

## API Urun Gorseli Cache Kurali

Supabase `product-images` bucket'indaki urun gorselleri backend proxy uzerinden servis edilir:

```text
https://api.allonahub.com/v1/media/product-images/products/...
```

Cloudflare Cache Rule:

```text
http.host eq "api.allonahub.com"
and http.request.method eq "GET"
and starts_with(http.request.uri.path, "/v1/media/product-images/")
```

Action: Cache eligible requests, edge TTL 1 yil, browser TTL 1 yil.

Bu kural Supabase cached egress'i azaltir: kullanici istekleri tekrarlandikca Supabase yerine Cloudflare edge cache cevap verir. Backend route'u yine `product-images/products/...` path dogrulamasi yapar ve yalnizca gorsel uzantilarini servis eder.

## API ile Uygulama

Gereken environment:

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ZONE_ID="..."
```

Ardindan:

```bash
node deploy/cloudflare/apply-allonahub-rules.mjs
```
