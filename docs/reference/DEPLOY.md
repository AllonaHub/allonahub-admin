# DEPLOY

## 1. Supabase

Secret girisleri ve security-first canliya cikis sirasi icin once su checklist'i takip et:

```text
docs/security/secret-entry-checklist-2026-06-21.md
```

1. Supabase projesinde SQL Editor aç.
2. `supabase/schema.sql` içeriğini çalıştır.
3. Ardından `supabase/migrations/20260619110000_security_hardening.sql` migration'ını çalıştır.
4. Admin, partner, kurye ve finans rolleri için Supabase MFA ayarlarını etkinleştir.
5. MFA aktif olduktan sonra `supabase/migrations/20260619193000_enterprise_security_controls.sql` migration'ını çalıştır.
6. Admin operasyon, legal evidence ve global security-first migrationlarını sırayla çalıştır:
   - `supabase/migrations/20260621103000_create_legal_evidence_controls.sql`
   - `supabase/migrations/20260621143000_create_admin_ops_panel.sql`
   - `supabase/migrations/20260621170000_global_security_first_controls.sql`
7. Auth URL ayarlarına canlı domaini ekle.
8. Storage bucketlarını oluştur veya migration ile doğrula:
   - `product-images`
   - `brand-assets`
   - `partner-documents`
9. Edge Function secretlarını ekle:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
supabase secrets set IYZICO_API_KEY="..."
supabase secrets set IYZICO_SECRET_KEY="..."
supabase secrets set IYZICO_BASE_URL="https://sandbox-api.iyzipay.com"
supabase secrets set SITE_URL="https://allonahub.com"
supabase secrets set ALLOWED_ORIGINS="https://allonahub.com"
supabase secrets set CV_PRICE_TRY="149.99"
```

Canlı geçişte `IYZICO_BASE_URL` iyzico üretim adresine alınmalıdır.

## 2. Edge Functions

```bash
supabase functions deploy create-iyzico-checkout
supabase functions deploy create-cv-checkout
supabase functions deploy iyzico-callback
```

CV ödeme akışı için `iyzico-callback` fonksiyonu hem ürün siparişi `orderId` callback'ini hem de CV ödeme `cvPaymentId` callback'ini işler. `create-cv-checkout` başarılı ödeme başlatır, callback başarılı dönerse kullanıcıya 1 ücretli CV üretim kredisi eklenir.

Kart bilgileri AllonaHub frontendinde alınmaz. Checkout, CV ödeme ve partner ödeme akışları sipariş/ödeme kaydını backend tarafında oluşturur ve müşteriyi iyzico'nun PCI uyumlu ödeme ekranına yönlendirir.

## 3. GitHub

1. Dosyaları GitHub reposuna yükle.
2. Varsayılan branch'i korumaya al.
3. Cloudflare Pages veya GitHub Pages yayını bağla.

## 3.1 Hetzner Backend API

Frontend GitHub Pages/Cloudflare tarafında kalır. Backend API Hetzner CPX31 üzerinde `api.allonahub.com` olarak çalıştırılır.

Detaylı kurulum:

```text
docs/deploy/hetzner-cpx31-backend.md
```

Ana deploy komutları:

```bash
cp deploy/hetzner/.env.production.example deploy/hetzner/.env.production
nano deploy/hetzner/.env.production
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml up -d --build
curl https://api.allonahub.com/health
```

Cloudflare Turnstile için production env içinde şu alanlar zorunludur:

```bash
TURNSTILE_SITE_KEY="..."
TURNSTILE_SECRET_KEY="..."
TURNSTILE_REQUIRED_IN_PRODUCTION=true
TURNSTILE_BYPASS_IN_DEVELOPMENT=false
```

Coolify olmayan Nginx sunucularında alternatif config:

```bash
cp deploy/hetzner/nginx/api.allonahub.com.conf /etc/nginx/sites-available/api.allonahub.com
ln -sf /etc/nginx/sites-available/api.allonahub.com /etc/nginx/sites-enabled/api.allonahub.com
nginx -t
systemctl reload nginx
```

## 4. Cloudflare

- SSL: Full Strict
- Cache: HTML kısa, CSS/JS/assets uzun cache
- WAF: temel bot ve rate limit kuralları
- Rate limit: kayıt, giriş, partner başvuru, checkout, CV ödeme, admin ve cron URL'leri
- Cloudflare Access: `admin.allonahub.com` ve Coolify dashboard için zorunlu
- Security Headers: HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Bot koruması: şüpheli form POST ve hızlı checkout denemelerine challenge
- Turnstile: login, register, forgot password, checkout, CV ödeme, partner başvuru ve public partner ödeme linki
- Redirect: `http` -> `https`
- Domain: canlı özel domain

## 5. Yayın Öncesi Kontrol

- Ürün listeleme Supabase'den geliyor.
- `status = active` dışındaki ürünler görünmüyor.
- Register, login, forgot password, profile akışı çalışıyor.
- Sepet toplamı doğru hesaplanıyor.
- Checkout sipariş oluşturuyor ve iyzico sayfasına yönlendiriyor.
- CV formunda ilk hesap için 2 ücretsiz CV/PDF üretim hakkı çalışıyor.
- Aynı cihazdan ikinci veya sonraki hesap CV hakkı talep ederse admin bildiriminde riskli profil görünüyor.
- Ücretsiz CV hakları bitince kullanıcı `/pages/career/cv-payment.html` sayfasına yönleniyor.
- Admin rolü olmayan kullanıcı admin paneline erişemiyor.
- Admin, partner, kurye ve finans kritik işlemleri MFA olmadan reddediliyor.
- `public.security_audit_events` tablosunda sipariş, ödeme, callback, admin ve yetki reddi eventleri oluşuyor.
- Mobil, tablet ve desktop görünüm kontrol edildi.
