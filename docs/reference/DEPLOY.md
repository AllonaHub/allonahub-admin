# DEPLOY

## 1. Supabase

1. Supabase projesinde SQL Editor aç.
2. `supabase/schema.sql` içeriğini çalıştır.
3. Ardından `supabase/migrations/20260619110000_security_hardening.sql` migration'ını çalıştır.
4. Admin, partner, kurye ve finans rolleri için Supabase MFA ayarlarını etkinleştir.
5. MFA aktif olduktan sonra `supabase/migrations/20260619193000_enterprise_security_controls.sql` migration'ını çalıştır.
6. Auth URL ayarlarına canlı domaini ekle.
7. Storage bucketlarını oluştur:
   - `product-images`
   - `brand-assets`
   - `partner-documents`
6. Edge Function secretlarını ekle:

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

Kartlı ödeme akışında AllonaHub e-posta, telefon, teslimat ve yasal onay bilgilerini toplar; kart numarası, son kullanma tarihi veya CVC alanı açmaz. Sipariş kaydı sonrası kullanıcı iyzico CheckoutForm `paymentPageUrl` adresine yönlendirilir; kart verisi yalnızca iyzico güvenli ödeme ekranında girilir ve dönüş `iyzico-callback` token sorgulamasıyla doğrulanır.

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

Coolify olmayan Nginx sunucularında alternatif config:

```bash
cp deploy/hetzner/nginx/api.allonahub.com.conf /etc/nginx/sites-available/api.allonahub.com
ln -sf /etc/nginx/sites-available/api.allonahub.com /etc/nginx/sites-enabled/api.allonahub.com
nginx -t
systemctl reload nginx
```

## 3.2 Hetzner Kurumsal E-posta Yönlendirme

`allonahub.com` için kurumsal inbound e-posta adresleri Hetzner sunucusunda Postfix virtual alias forwarding ile hazırlanır. Tüm gelen postalar `allonahub@gmail.com` adresine yönlendirilir.

Detaylı kurulum ve DNS kayıtları:

```text
docs/deploy/hetzner-email-forwarding.md
deploy/hetzner/mail-forwarding/dns-records.txt
```

Ana kurulum komutları:

```bash
cd /opt/allonahub
git pull --ff-only origin main
sudo bash deploy/hetzner/setup-mail-forwarding.sh
bash deploy/hetzner/check-mail-forwarding.sh
```

Cloudflare/Domain DNS tarafında `mail.allonahub.com` A kaydı ve `allonahub.com` MX kaydı tanımlanmadan canlı teslimat tamamlanmış sayılmaz. Hetzner Cloud tarafında outbound TCP 25 kapalıysa Gmail'e forward teslimatı için Hetzner port açma talebi veya harici SMTP/mail relay gerekir.

## 4. Cloudflare

- SSL: Full Strict
- Cache: HTML kısa, CSS/JS/assets uzun cache
- WAF: temel bot ve rate limit kuralları
- Rate limit: kayıt, giriş, partner başvuru, checkout, CV ödeme, admin ve cron URL'leri
- Cloudflare Access: `admin.allonahub.com` ve Coolify dashboard için zorunlu
- Security Headers: HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Bot koruması: şüpheli form POST ve hızlı checkout denemelerine challenge
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
