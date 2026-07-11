# AllonaHub Security Audit - 2026-06-19

## Kapatılan Riskler

- Supabase RLS politikaları ana tablolar için yeniden sertleştirildi: `profiles`, `products`, `partner_ads`, `addresses`, `favorites`, `coupons`, `orders`, `order_items`, `partner_applications`, CV erişim tabloları ve `admin_notifications`.
- `courier` rolü eklendi ve kurye/admin rol kontrol helper'ı hazırlandı.
- `addresses`, `favorites`, `orders` için `user_id default auth.uid()` sözleşmesi eklendi; frontend artık adres insert sırasında `user_id` göndermez.
- Partner başvuruları için DB tarafında e-posta/telefon bazlı 24 saatlik spam kontrolü ve shape/length constraintleri eklendi.
- Sipariş oluşturma için `create_secure_order` RPC eklendi; ürün fiyatı, stok, kupon ve toplamlar veritabanında hesaplanır.
- Admin/partner olmayan kullanıcıların panel işlemleri role guard ve RLS ile sınırlandırıldı.
- Edge Functions authentication zorunlu çalışır; ödeme/CV ödeme fonksiyonları request size, origin, rate limit ve güvenli hata mesajlarıyla sertleştirildi.
- Frontend formlara ortak validasyon, local rate limit ve güvenli hata mesajı katmanı eklendi.
- Kart bilgileri veritabanına yazılmaz; sadece format kontrolü yapılır ve ödeme oturumu Edge Function üzerinden açılır.
- Partner ürün görseli yüklemesinde JPG/PNG/WEBP ve 5 MB sınırı eklendi.
- Kullanıcıya Supabase/Sağlayıcı teknik hata detaylarını basan kritik yerler güvenli genel mesajlara çevrildi.

## Secret Taraması

- Repo içinde `service_role`, banka ödeme secret veya private key commit'i bulunmadı.
- Frontend'de sadece Supabase publishable/anon key bulunur; bu gizli anahtar değildir ve RLS ile sınırlandırılmalıdır.
- `.env.example` eklendi; gerçek secretlar yalnızca Supabase Edge Function secrets veya hosting environment variables üzerinden girilmelidir.

## Supabase Deploy Notu

Canlı veritabanında güvenlik değişikliklerinin aktif olması için şu migration çalıştırılmalıdır:

```text
supabase/migrations/20260619110000_security_hardening.sql
```

Edge Functions tekrar deploy edilmelidir:

```bash
supabase functions deploy create-bank-checkout
supabase functions deploy create-cv-checkout
supabase functions deploy bank-payment-callback
```

## Cloudflare Önerileri

- WAF Managed Rules aktif olsun.
- Bot Fight Mode veya Super Bot Fight Mode aktif olsun.
- `/functions/`, `/checkout`, `/cv-payment`, `/partner`, `/admin` yollarına rate limiting uygulanmalı.
- Challenge veya JS Challenge: kısa sürede yüksek POST/başvuru denemelerinde devreye alınmalı.
- Security Headers eklenmeli: `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- HTML cache kısa, CSS/JS/assets uzun ve versiyonlu cache ile devam edilmeli.
- Cloudflare Turnstile partner başvuru ve kayıt formlarına ikinci aşamada eklenmeli.
