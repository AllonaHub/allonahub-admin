# API

Frontend doğrudan Supabase JavaScript SDK kullanır. Kritik ödeme adımları Supabase Edge Functions üzerinden ilerler.
Production backend devreye alındığında kritik işlemler `https://api.allonahub.com` altındaki Hetzner API üzerinden yürütülür; Supabase veritabanı ve Auth kullanılmaya devam eder.

## Supabase Client

Ortak istemci `/js/config.js` ve `/js/supabase-client.js` içinde tanımlıdır.

Ana işlemler:

- `products`: aktif ürün listeleme, ürün detayı, admin ürün CRUD
- `favorites`: kullanıcı favorileri
- `orders`: sipariş ve sipariş kalemleri
- `profiles`: rol ve profil bilgisi

## iyzico CheckoutForm Akışı

iyzico dokümantasyonuna göre CheckoutForm iki ana adımdan oluşur: başlatma ve sorgulama. Başlatma isteği `paymentPageUrl` döndürür; müşteri kart bilgisini iyzico ekranında girer. Dönüşte gelen `token` ile ödeme sonucu sorgulanır.

Resmi dokümanlar:

- https://docs.iyzico.com/odeme-metotlari/odeme-formu/cf-entegrasyonu
- https://docs.iyzico.com/odeme-metotlari/odeme-formu/cf-entegrasyonu/cf-baslatma
- https://docs.iyzico.com/odeme-metotlari/odeme-formu/cf-entegrasyonu/cf-sorgulama
- https://docs.iyzico.com/on-hazirliklar/kimlik-dogrulama/hmacsha256-kimlik-dogrulama

### create-iyzico-checkout

Konum: `supabase/functions/create-iyzico-checkout/index.ts`

İstek:

```json
{
  "orderId": "uuid",
  "buyer": {
    "email": "musteri@ornek.com",
    "phone": "+905300000000"
  }
}
```

Frontend kart numarası, son kullanma tarihi, CVC veya service-role/iyzico secret göndermez. Edge Function gerçek istemci IP bilgisini Cloudflare/Supabase request headerlarından alır; iyzico zorunlu CheckoutForm alanları sunucu tarafında hazırlanır.

Yanıt:

```json
{
  "paymentPageUrl": "https://sandbox-cpp.iyzipay.com?token=...",
  "token": "checkout-token"
}
```

### iyzico-callback

Konum: `supabase/functions/iyzico-callback/index.ts`

iyzico dönüşünde `token` alır, CF sorgulama isteğini yapar ve `orders.payment_status` alanını günceller.

## Güvenlik

- Kart verisi Allona tarafında toplanmaz.
- iyzico API key ve secret sadece Supabase Edge Function secret olarak tutulur.
- Hetzner backend kullanımında iyzico API key, iyzico secret ve Supabase service role key sadece sunucu environment içinde tutulur.
- Supabase anon key frontend için kullanılır; service role key asla frontend'e konmaz.
- RLS kapatılmaz.

## Hetzner Backend API

Base URL:

```text
https://api.allonahub.com
```

Endpointler:

- `GET /health`: API sağlık kontrolü.
- `GET /ready`: Supabase bağlantı hazırlık kontrolü.
- `POST /v1/orders`: Auth zorunlu, güvenli sipariş oluşturma RPC'sini çağırır.
- `POST /v1/payments/iyzico/checkout`: Auth zorunlu, sipariş için iyzico ödeme oturumu başlatır.
- `GET|POST /v1/payments/iyzico/callback`: iyzico dönüşünü işler.
- `POST /v1/cv/checkout`: Auth zorunlu, CV ödeme oturumu başlatır.
- `GET /v1/partner/commission/preview`: Partner/admin komisyon önizleme.
- `POST /v1/hp-wallet/ledger`: HP Wallet işlem kayıt taslağı.
- `POST /v1/cron/reconcile-payments`: `x-cron-secret` ile cron ödeme kontrolü.

Detaylı deploy: `docs/deploy/hetzner-cpx31-backend.md`.
