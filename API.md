# API

Frontend doğrudan Supabase JavaScript SDK kullanır. Kritik ödeme adımları Supabase Edge Functions üzerinden ilerler.

## Supabase Client

Ortak istemci `js/config.js` ve `js/supabase-client.js` içinde tanımlıdır.

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

iyzico dönüşünde `token` alır, CF sorgulama isteğini yapar ve `orders.payment_status` alanını günceller.

## Güvenlik

- Kart verisi Allona tarafında toplanmaz.
- iyzico API key ve secret sadece Supabase Edge Function secret olarak tutulur.
- Supabase anon key frontend için kullanılır; service role key asla frontend'e konmaz.
- RLS kapatılmaz.
