# AllonaHub Secret Entry Checklist - 2026-06-21

Bu dosya production'a cikmadan once secret ve guvenlik ayarlarinin nereye girilecegini netlestirir. Secret degerlerini GitHub'a, frontend dosyalarina veya sohbet mesajlarina yazma.

## 1. Public frontend degerleri

Bu degerler public olabilir:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` veya `SUPABASE_ANON_KEY`
- `SITE_URL`
- `API_URL`
- `TURNSTILE_SITE_KEY`

Frontend Turnstile site key'i su dosyadaki `turnstileSiteKey` alanina girilecek:

```text
js/config.js
```

Not: `TURNSTILE_SITE_KEY` public degerdir. `TURNSTILE_SECRET_KEY` public degildir.

## 2. Hetzner backend server-only secrets

Bu degerler yalnizca server ortam degiskenlerine girilecek:

```text
deploy/hetzner/.env.production
```

Girilmesi gereken alanlar:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `IYZICO_API_KEY`
- `IYZICO_SECRET_KEY`
- `IYZICO_BASE_URL`
- `TURNSTILE_SECRET_KEY`
- `CRON_SECRET`

Production guvenlik ayarlari:

- `NODE_ENV=production`
- `TURNSTILE_REQUIRED_IN_PRODUCTION=true`
- `TURNSTILE_BYPASS_IN_DEVELOPMENT=false`
- `AUDIT_LOG_ENABLED=true`
- `AUTO_DEFENSE_ENABLED=true`
- `PAYMENTS_DISABLED=false`

Opsiyonel alarm secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SECURITY_ALERT_EMAIL_WEBHOOK_URL`
- `SECURITY_ALERT_EMAIL_WEBHOOK_SECRET`

## 3. Supabase Edge Function secrets

Supabase Dashboard > Edge Functions > Secrets veya Supabase CLI ile girilecek:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
supabase secrets set IYZICO_API_KEY="..."
supabase secrets set IYZICO_SECRET_KEY="..."
supabase secrets set IYZICO_BASE_URL="..."
supabase secrets set SITE_URL="https://allonahub.com"
supabase secrets set ALLOWED_ORIGINS="https://allonahub.com,https://www.allonahub.com"
supabase secrets set CV_PRICE_TRY="149.99"
```

Canli iyzico gecisinde `IYZICO_BASE_URL` sandbox yerine production endpoint olmalidir.

## 4. Cloudflare ayarlari

Cloudflare Dashboard'da hazirlanacak:

- SSL/TLS mode: Full Strict
- Turnstile widget domainleri: `allonahub.com`, `www.allonahub.com`, `admin.allonahub.com`
- WAF managed rules: enabled
- Bot protection: enabled
- Rate limiting:
  - `/v1/public/partner-applications`
  - `/v1/public/partner-payment-intents/checkout`
  - `/v1/payments/iyzico/checkout`
  - `/v1/cv/checkout`
  - `/pages/account/login.html`
  - `/pages/account/register.html`
  - `/pages/account/forgot-password.html`
- Challenge policy: suspicious country, high bot score, repeated POST failures
- Cloudflare Access: `admin.allonahub.com` ve server dashboardlari icin zorunlu

## 5. Supabase SQL sirasi

Production database icin SQL Editor veya migration araci ile sirayla:

```text
supabase/schema.sql
supabase/migrations/20260619110000_security_hardening.sql
supabase/migrations/20260619193000_enterprise_security_controls.sql
supabase/migrations/20260621103000_create_legal_evidence_controls.sql
supabase/migrations/20260621143000_create_super_admin_controls.sql
supabase/migrations/20260621153000_create_admin_ops_panel.sql
supabase/migrations/20260621170000_global_security_first_controls.sql
```

## 6. Deploy sirasi

1. Secret degerlerini gir.
2. Supabase SQL migrationlarini uygula.
3. Supabase Edge Functions deploy et.
4. Backend API deploy et.
5. Frontend public config'te Turnstile site key'i yayinla.
6. Cloudflare kurallarini aktif et.
7. Smoke testleri calistir.

Backend deploy:

```bash
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml up -d --build
curl https://api.allonahub.com/health
curl https://api.allonahub.com/ready
```

Edge Function deploy:

```bash
supabase functions deploy create-iyzico-checkout
supabase functions deploy create-cv-checkout
supabase functions deploy iyzico-callback
```

## 7. Smoke test listesi

- Register, login ve forgot password Turnstile ile calisiyor.
- Partner basvurusu `/v1/public/partner-applications` endpointine gidiyor.
- Checkout siparis kaydini backend/RPC ile olusturuyor.
- AllonaHub sayfalarinda kart numarasi veya CVC inputu yok.
- iyzico sayfasina redirect oluyor.
- Basarili callback order/CV/partner payment status'u tek kez guncelliyor.
- Duplicate callback ekstra partner transaction olusturmuyor.
- Token mismatch callback `400` donuyor ve audit event yaziyor.
- Admin olmayan kullanici admin/super-admin endpointlerinden `403` aliyor.
- `security_audit_events` tablosunda yetki reddi, payment callback ve admin eventleri gorunuyor.

## 8. Git'e yazilmayacaklar

- `SUPABASE_SERVICE_ROLE_KEY`
- `IYZICO_SECRET_KEY`
- `IYZICO_API_KEY`
- `TURNSTILE_SECRET_KEY`
- `CRON_SECRET`
- Cloudflare API tokenlari
- GitHub tokenlari
- Hetzner API tokenlari
