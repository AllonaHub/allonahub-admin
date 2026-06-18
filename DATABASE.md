# DATABASE

Allona Shop Supabase üzerinde PostgreSQL kullanır. Temel kural: müşteri tarafı sadece güvenli RLS politikalarıyla izin verilen veriye erişir; ödeme ve kritik sipariş onayı Edge Functions üzerinden yapılır.

## Ana Tablolar

### products

Zorunlu alanlar:

- `id`
- `name`
- `description`
- `price`
- `stock`
- `image_url`
- `category`
- `status`
- `created_at`

Üretim için önerilen ek alanlar:

- `slug`
- `meta_title`
- `meta_description`
- `brand`
- `sold_count`
- `partner_id`
- `updated_at`

Kural: vitrinde yalnızca `status = active` ürünler gösterilir.

### profiles

Supabase Auth kullanıcılarının halka açık olmayan profil verilerini tutar.

- `id`: auth user id
- `full_name`
- `phone`
- `role`: `customer`, `admin`, `partner`
- `created_at`
- `updated_at`

### addresses

Kullanıcının teslimat ve fatura adresleri.

### favorites

Giriş yapan kullanıcıların favorileri Supabase'de saklanır. Misafir favorileri tarayıcı localStorage'da geçici tutulur.

### orders / order_items

Sipariş ve sipariş kalemleri.

- `orders.id`
- `orders.user_id`
- `orders.total_amount`
- `orders.shipping_fee`
- `orders.discount_amount`
- `orders.status`
- `order_status`: `pending`, `confirmed`, `preparing`, `shipped`, `delivered`, `cancelled`, `refunded`
- `payment_status`: `pending`, `awaiting_payment`, `paid`, `failed`, `refunded`
- `address_id`
- `legal_acceptances`
- `tracking_number`
- `iyzico_token`
- `iyzico_payment_id`

Geçiş uyumluluğu için şemada `total`, `shipping_total`, `discount_total` ve `order_status` alanları da korunur. Yeni kod `total_amount`, `shipping_fee`, `discount_amount` ve `status` alanlarını ana sözleşme olarak kullanır.

`order_items` temel alanları:

- `id`
- `order_id`
- `product_id`
- `quantity`
- `unit_price`
- `total_price`

### coupons

Checkout sırasında uygulanacak kampanya kodları.

## SQL

Canlı Supabase projesine uygulanacak şema `supabase/schema.sql` dosyasındadır. SQL çalıştırıldıktan sonra Auth, Storage ve Edge Function ayarları `DEPLOY.md` sırasıyla tamamlanmalıdır.
