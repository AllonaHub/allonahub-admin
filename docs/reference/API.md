# API

Frontend doğrudan Supabase JavaScript SDK kullanır. Kritik ödeme adımları Supabase Edge Functions üzerinden ilerler.
Production backend devreye alındığında kritik işlemler `https://api.allonahub.com` altındaki Hetzner API üzerinden yürütülür; Supabase veritabanı ve Auth kullanılmaya devam eder.

## Supabase Client

Ortak istemci `/js/config.js` ve `/js/supabase-client.js` içinde tanımlıdır.

Ana işlemler:

- `products`: aktif ürün listeleme, ürün detayı, admin ürün CRUD
- `cart`: aktif sepet RPC'leri
- `favorites`: kullanıcı favorileri
- `orders`: `create_transaction_order(...)` RPC ile server-side sipariş oluşturma, sipariş ve sipariş kalemleri
- `rewards`: HP/XP ve kupon merkezi kayıtları
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

Bu fonksiyon ödeme oturumu başladığında `orders.payment_status = awaiting_payment` ve yeni Transaction Core alanı `orders.status = awaiting_payment` yazar. Kart bilgisi AllonaHub tarafında toplanmaz.

İstek:

```json
{
  "orderId": "uuid",
  "buyer": {
    "identityNumber": "11111111111",
    "ip": "127.0.0.1"
  }
}
```

Yanıt:

```json
{
  "paymentPageUrl": "https://sandbox-cpp.iyzipay.com?token=...",
  "token": "checkout-token"
}
```

### iyzico-callback

Konum: `supabase/functions/iyzico-callback/index.ts`

iyzico dönüşünde `token` alır, CF sorgulama isteğini yapar ve `orders.payment_status`, `orders.order_status`, `orders.status` alanlarını günceller. Ödeme başarılıysa sipariş `paid`, başarısızsa `failed/pending` durumuna alınır.

## Transaction Core RPC

Frontend checkout doğrudan `orders.insert` yapmaz. Sipariş oluşturma RPC üzerinden çalışır:

```sql
select public.create_transaction_order(
  p_address_id := 'uuid',
  p_coupon_code := 'KUPON',
  p_hp_to_use := 50
);
```

RPC server-side olarak aktif sepeti, stokları, ürün fiyatlarını, default/seçili adresi, kupon limitlerini, HP limitlerini, kargoyu ve toplamları doğrular. Sipariş oluşunca sepet `completed` yapılır.

Sepet RPC'leri:

- `get_active_cart()`
- `add_cart_item(p_product_id, p_quantity)`
- `set_cart_item_quantity(p_product_id, p_quantity)`
- `clear_active_cart()`

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
- `POST /v1/rewards/ledger`: Admin/süper admin HP/XP/Kupon Merkezi işlem kayıt notu.
- `POST /v1/hp-wallet/ledger`: Eski rota; geriye dönük uyumluluk alias'ı. Yeni geliştirmede kullanılmaz.
- `POST /v1/cron/reconcile-payments`: `x-cron-secret` ile cron ödeme kontrolü.

Detaylı deploy: `docs/deploy/hetzner-cpx31-backend.md`.
