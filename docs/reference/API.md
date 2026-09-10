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

Bu fonksiyon ödeme oturumu başladığında `orders.payment_status = awaiting_payment` ve yeni Transaction Core alanı `orders.status = awaiting_payment` yazar. Kart bilgisi AllonaHub tarafında toplanmaz; frontend yalnızca güvenilir `iyzipay.com` alan adına ait `paymentPageUrl` değerine yönlendirir.

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
  "checkoutFormContent": "<script>...</script>",
  "token": "checkout-token",
  "provider": "iyzico"
}
```

Frontend checkout başarılı yanıtı `sessionStorage` içinde kısa süreli ödeme handoff kaydı olarak saklar, `/pages/commerce/iyzico-pay.html` ara sayfasını açar ve müşteri kart bilgisini sadece iyzico CheckoutForm ekranında girer.

### iyzico-callback

Konum: `supabase/functions/iyzico-callback/index.ts`

iyzico dönüşünde `token` alır, CF sorgulama isteğini yapar ve `orders.payment_status`, `orders.order_status`, `orders.status` alanlarını günceller. Ödeme başarılıysa sipariş `paid`, başarısızsa `failed/pending` durumuna alınır. Ürün siparişi dönüşü kullanıcıyı `/pages/commerce/order-success.html?payment=...&id=...` sonucuna yönlendirir.

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
- `POST /v1/maritime/freight-requests`: Auth zorunlu; navlun ön talebini server-side doğrular, kullanıcı bazlı idempotency uygular ve audit kaydı oluşturur.
- `PATCH /v1/maritime/freight-requests/:requestId/cancel`: Auth ve sahiplik zorunlu; yalnızca `submitted` veya `in_review` taleplerini yarış durumuna dayanıklı biçimde iptal eder.
- `PATCH /v1/maritime/freight-requests/:requestId/offers/:offerId/accept`: Auth ve talep sahipliği zorunlu; yayınlanmış/süresi dolmamış teklifi service-role-only RPC ile atomik kabul eder, diğer açık teklifleri reddeder ve navlun talebini `accepted` yapar.
- `GET /v1/public/maritime/listings`: RLS üzerinden yalnızca yayındaki, süresi dolmamış `status = active` ve `module_key = maritime` crew/gemi özetlerini döndürür.
- `POST /v1/public/maritime/partner-applications`: Turnstile ve saatlik rate limit ile korunan denizcilik partner ön başvurusu; PII yalnızca backend üzerinden özel RLS tablosuna yazılır.
- `GET /v1/maritime/partner/listings`: Partner/admin rolü ve MFA zorunlu; kullanıcının kendi denizcilik ilanlarını, PII içermeyen uygunluk durumunu ve partner rolünün gönderebileceği ilan türlerini döndürür.
- `POST /v1/maritime/partner/listings`: MFA ve ilan türüne uygun onaylı denizcilik partner başvurusu zorunlu; girdiyi server-side doğrular, idempotency uygular ve ilanı yalnızca `pending_review` olarak oluşturur.
- `GET /v1/maritime/partner/freight-matches`: Partner rolü + MFA ve sahiplik filtresiyle kullanıcının kendi eşleşme/teklif geçmişini döndürür; güncel denizcilik onayı yeni teklif için zorunlu kalır, fakat onayı kaldırılan partner açık yükümlülüğünü görüp güvenli çıkış işlemlerini yapabilir.
- `POST /v1/maritime/partner/freight-matches/:matchId/offer`: Yalnız eşleşmenin sahibi MFA partner teklif gönderebilir; tutar/şartlar server-side doğrulanır ve service-role-only RPC teklifi, eşleşmeyi, talebi ve olayı atomik günceller.
- `PATCH /v1/maritime/partner/freight-matches/:matchId/decline`: Eşleşme sahibi MFA partner, henüz teklif üretmemiş daveti atomik olarak reddeder; aktif başka eşleşme veya teklif yoksa talep yeniden incelemeye alınır.
- `PATCH /v1/maritime/partner/freight-matches/:matchId/offer/withdraw`: Eşleşme sahibi MFA partner, sahibi kabul etmeden önce sunulmuş teklifini atomik geri çeker; teklif/eşleşme/talep durumları ve olay kaydı tek transaction içinde güncellenir.
- `GET /v1/admin/ops/maritime` (`/v1/ops-console/maritime` alias): Ops Admin RPC + MFA + admin host/IP sınırıyla denizcilik partner/ilan inceleme kuyruğunu, navlun taleplerini ve eşleşmeleri döndürür.
- `POST /v1/admin/ops/maritime-freight/:requestId/matches`: MFA Ops Admin seçilen onaylı navlun partnerini talebe service-role-only RPC ile atar; istemci durum veya atayan kullanıcı alanı göndermez.
- `PATCH /v1/admin/ops/maritime-partner-applications/:applicationId/review`: MFA Ops Admin kararıyla başvuruyu incelemeye alır, onaylar veya reddeder; kullanıcı rolünü otomatik yükseltmez.
- `PATCH /v1/admin/ops/maritime-listings/:listingId/review`: Yalnız `pending_review` ilanı yarış durumuna dayanıklı olarak `active` ya da `rejected` durumuna geçirir; süresi dolmuş ilanı yayınlamaz.
- `GET /v1/control-center/maritime-trust`: Kalıcı `super_admin` rolü + MFA + owner kilidi zorunlu; denizcilik trust case, fraud/şikayet sinyali, hassas erişim talebi, erişim olayı ve maritime audit özetlerini döndürür. Mesaj gövdesi, dosya içeriği/yolu, görüşme kaydı, ham sensitive access gerekçesi ve metadata değerleri bu endpointte dönmez.
- `POST /v1/payments/iyzico/checkout`: Auth zorunlu, sipariş için iyzico ödeme oturumu başlatır.
- `GET|POST /v1/payments/iyzico/callback`: iyzico dönüşünü işler.
- `POST /v1/cv/checkout`: Auth zorunlu, CV ödeme oturumu başlatır.
- `GET /v1/partner/commission/preview`: Partner/admin komisyon önizleme.
- `POST /v1/rewards/ledger`: Admin/süper admin HP/XP/Kupon Merkezi işlem kayıt notu.
- `POST /v1/hp-wallet/ledger`: Eski rota; geriye dönük uyumluluk alias'ı. Yeni geliştirmede kullanılmaz.
- `POST /v1/cron/reconcile-payments`: `x-cron-secret` ile cron ödeme kontrolü.
- `POST /v1/cron/reconcile-maritime`: Timing-safe doğrulanan `x-cron-secret` ile sınırlı bir batch çalıştırır; süresi dolan işleri ve terminal taleplerde kazanan dışı eşleşmeleri service-role-only, match-first RPC üzerinden atomik uzlaştırır.

Detaylı deploy: `docs/deploy/hetzner-cpx31-backend.md`.

## Allona Maritime Hiring Core API Notu

`supabase/migrations/20260910120000_create_maritime_hiring_core.sql` Seafarer Workspace, Company Maritime Workspace, Allona Connect, Private Candidate Room, Multi-Candidate Hiring Room, Crew Room ve Trust & Communication Oversight için veri/izin/audit temelini ekler. Bu çekirdek üzerine ilk Super Admin-only metadata endpointi `/v1/control-center/maritime-trust` olarak eklenmiştir; public veya partner-facing yeni hiring endpointi henüz açılmaz.

Bu çekirdek üzerine eklenecek endpointler, frontend doğrudan tablo yazmadan ve gerçek entegrasyon yokken özelliği çalışıyormuş gibi göstermeden tasarlanmalıdır. İlk backend sözleşmeleri şu yüzeyleri kapsamalıdır:

- Seafarer Workspace: Readiness Passport, belge onayı, müsaitlik tazeliği, eşleşme ve teklif durumu.
- Company Maritime Workspace: jobs, hiring rooms, smart matches, candidate rooms, urgent crew, crew matrix, offers/contracts ve billing eventleri.
- Allona Connect: thread/message/session provider abstraction; medya sağlayıcısı WebRTC tabanlı dış provider olmalı, Allona tarafı izin ve audit kontrolünü tutmalıdır.
- Trust Oversight: metadata/risk/sikayet görünümü; hassas içerik için vaka, amaç, gerekçe, süre ve çift onay zorunluluğu. Varsayılan kontrol merkezi özel konuşma içeriği okumaz.

Şema doğrulama: `deploy/maritime/check-maritime-hiring-core.sh`.
