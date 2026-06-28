# AllonaHub Cloudflare Rules

Son kontrol: 29.06.2026

Canli kontrolde `https://allonahub.com/_headers` dosyasinin normal statik dosya olarak servis edildigi goruldu. Bu, mevcut hosting'in Netlify/Cloudflare Pages `_headers` formatini yorumlamadigini gosterir. Bu nedenle ana domain guvenlik header'lari Cloudflare Response Header Transform Rule veya origin sunucu ayari ile uygulanmalidir.

## Uygulanacak Response Header Kurallari

Expression:

```text
(http.host eq "allonahub.com" or http.host eq "www.allonahub.com")
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

## WAF Notu

`/checkout.html` istegi canlida `cf-mitigated: challenge` ile kesiliyor. Redirect rule uygulaninca istek origin'e ve eski checkout path'ine dusmeden guvenli odeme sayfasina aktarilmalidir. Challenge devam ederse WAF Custom Rule icinde bu path'i challenge aksiyonundan haric tutan kural sirasi duzenlenmelidir.

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
