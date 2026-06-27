# Yemek Modülü Kurulum

Bu kurulum, yemek modülünü Supabase ve uygulama katmanına kontrollü şekilde eklemek için hazırlanmıştır.

## 1. Supabase Migration

Supabase CLI olan projede:

```bash
supabase db push
```

Manuel uygulamada `supabase/migrations/20260627000100_yemek_modulu.sql` dosyasını Supabase SQL editor içinde çalıştırın.

## 2. Demo Seed

Satışa hazır örnek katalog için:

```bash
supabase db reset
```

veya SQL editor içinde `supabase/seed/20260627000100_yemek_modulu_seed.sql` dosyasını çalıştırın.

Seed edilen kurulum:

| Anahtar | Amaç |
| --- | --- |
| `default_sale_ready_marketplace` | Partner onaylı, görsel kontrollü, kurye handoff hazırlıklı standart satış kurulumu |

## 3. Env Değerleri

Uygulama tarafında beklenen değerler:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="SERVER_ONLY_SERVICE_ROLE_KEY"
```

Service role anahtarı istemci paketine girmemelidir.

## 4. Bağlantı Kontrolü

```bash
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="ANON_KEY" \
node yemek-modulu/src/supabase-health-check.mjs
```

Başarılı çıktı `food_products` tablosuna REST erişiminin açık olduğunu ve RLS altında sorgunun döndüğünü gösterir.

## 5. Partner Ürün Yükleme

Uygulama repository katmanında:

1. Partner kullanıcısının `food_partner_memberships` içinde aktif kaydı olmalıdır.
2. Ürün `draft` durumunda `food_products` tablosuna yazılır.
3. Görsel `food-product-images` bucketına yüklenir ve `food_product_media` kaydına bağlanır.
4. `validateFoodProductForSale` sonucu eksik alan yoksa ürün `pending_review` durumuna alınır.
5. Admin onayı sonrası ürün `approved` veya `active` olur.

## 6. Kurye Hazırlığı

Sipariş onaylandığında `buildCourierHandoffPayload(order)` çıktısı `food_delivery_handoffs.payload` alanına yazılır. Kurye modülü geldiğinde kendi assignment ID değerini `courier_module_ref` alanına bağlayabilir.

## 7. Lokal Test

```bash
node --test yemek-modulu/tests/food-module-contract.test.mjs
```

Bu testler Supabase'e bağlanmaz; modül sözleşmesini, ürün-görsel uyumunu, satışa hazırlığı ve kurye payload yapısını doğrular.

