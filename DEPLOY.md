# DEPLOY

## 1. Supabase

1. Supabase projesinde SQL Editor aç.
2. `supabase/schema.sql` içeriğini çalıştır.
3. Auth URL ayarlarına canlı domaini ekle.
4. Storage bucketlarını oluştur:
   - `product-images`
   - `brand-assets`
   - `partner-documents`
5. Edge Function secretlarını ekle:

```bash
supabase secrets set IYZICO_API_KEY="..."
supabase secrets set IYZICO_SECRET_KEY="..."
supabase secrets set IYZICO_BASE_URL="https://sandbox-api.iyzipay.com"
supabase secrets set SITE_URL="https://allonahub.com"
```

Canlı geçişte `IYZICO_BASE_URL` iyzico üretim adresine alınmalıdır.

## 2. Edge Functions

```bash
supabase functions deploy create-iyzico-checkout
supabase functions deploy iyzico-callback
```

## 3. GitHub

1. Dosyaları GitHub reposuna yükle.
2. Varsayılan branch'i korumaya al.
3. Cloudflare Pages veya GitHub Pages yayını bağla.

## 4. Cloudflare

- SSL: Full
- Cache: HTML kısa, CSS/JS/assets uzun cache
- WAF: temel bot ve rate limit kuralları
- Redirect: `http` -> `https`
- Domain: canlı özel domain

## 5. Yayın Öncesi Kontrol

- Ürün listeleme Supabase'den geliyor.
- `status = active` dışındaki ürünler görünmüyor.
- Register, login, forgot password, profile akışı çalışıyor.
- Sepet toplamı doğru hesaplanıyor.
- Checkout sipariş oluşturuyor ve iyzico sayfasına yönlendiriyor.
- Admin rolü olmayan kullanıcı admin paneline erişemiyor.
- Mobil, tablet ve desktop görünüm kontrol edildi.
