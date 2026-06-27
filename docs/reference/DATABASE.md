# DATABASE

AllonaHub Supabase üzerinde PostgreSQL kullanır. Temel kural: müşteri tarafı sadece güvenli RLS politikalarıyla izin verilen veriye erişir; ödeme ve kritik sipariş onayı Edge Functions üzerinden yapılır.

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
- `module_key`: `shop`, `market`, `food`, `taxi` veya `service`
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

Kural: vitrinde yalnızca `status = active` ürünler gösterilir. Modüllerin birbirine karışmaması için Allona Shop ürünleri `module_key = shop`, Allona Market ürünleri `module_key = market`, Allona Yemek ürünleri `module_key = food` kapsamıyla ayrılır. Eski canlı ürün tablolarında frontend `brand`, `category` ve `sku` alanlarından aynı ayrımı geriye uyumlu şekilde algılar.

### profiles

Supabase Auth kullanıcılarının halka açık olmayan profil verilerini tutar.

- `id`: auth user id
- `full_name`
- `phone`
- `role`: `customer`, `admin`, `partner`
- `created_at`
- `updated_at`

### addresses

Kullanıcının teslimat ve fatura adresleri. MVP Transaction Core modelinde checkout, seçili veya varsayılan adresi `orders.address_id` ile ilişkilendirir ve teslimat özetini ayrıca `orders.address` alanına yazar.

Canlı sitede `Could not find the table 'public.addresses' in the schema cache` hatası görülürse Supabase SQL Editor'da `supabase/migrations/20260621015000_transaction_core_mvp.sql` dosyasının tamamı çalıştırılmalıdır. Frontend bu tablo hazır olana kadar adresleri kullanıcı cihazında geçici olarak saklar; tablo oluşturulduktan sonra kayıtlar Supabase'e kalıcı yazılır.

```sql
create extension if not exists pgcrypto;

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Adres',
  full_name text,
  phone text,
  address text not null,
  district text,
  city text not null,
  zip_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists addresses_set_updated_at on public.addresses;
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

alter table public.addresses enable row level security;

drop policy if exists "addresses_select_own" on public.addresses;
create policy "addresses_select_own"
  on public.addresses for select
  using (user_id = auth.uid());

drop policy if exists "addresses_insert_own" on public.addresses;
create policy "addresses_insert_own"
  on public.addresses for insert
  with check (user_id = auth.uid());

drop policy if exists "addresses_update_own" on public.addresses;
create policy "addresses_update_own"
  on public.addresses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "addresses_delete_own" on public.addresses;
create policy "addresses_delete_own"
  on public.addresses for delete
  using (user_id = auth.uid());

create index if not exists addresses_user_created_idx
  on public.addresses(user_id, created_at desc);

create unique index if not exists addresses_one_default_per_user
  on public.addresses(user_id)
  where is_default;
```

### favorites

Giriş yapan kullanıcıların favorileri Supabase'de saklanır. Misafir favorileri tarayıcı localStorage'da geçici tutulur.

### carts / cart_items

Gerçek sepet sistemi. Giriş yapan kullanıcının tek aktif sepeti vardır. Aynı ürün tekrar eklenirse quantity artar; quantity `1` altına düşerse ürün sepetten çıkarılır. Ürün pasifse veya stok yetmiyorsa sepet RPC'si hata verir.

RPC'ler:

- `get_or_create_active_cart()`
- `get_active_cart()`
- `add_cart_item(p_product_id uuid, p_quantity integer)`
- `set_cart_item_quantity(p_product_id uuid, p_quantity integer)`
- `clear_active_cart()`

### orders / order_items

Sipariş ve sipariş kalemleri Transaction Core RPC ile oluşturulur. Frontend doğrudan `orders.insert` yapmaz; fiyat, stok, kupon, HP ve kargo hesapları server-side doğrulanır. Checkout seçili veya varsayılan adresi `orders.address_id` ile ilişkilendirir ve teslimat özetini `orders.address` alanına da yazar.

- `orders.id`
- `orders.order_no`
- `orders.order_number`
- `orders.user_id`
- `orders.address_id`
- `orders.customer_name`
- `orders.customer_email`
- `orders.customer_phone`
- `orders.city`
- `orders.address`
- `orders.subtotal`
- `orders.shipping`
- `orders.discount`
- `orders.total`
- `orders.discount_total`
- `orders.hp_discount`
- `orders.coupon_discount`
- `orders.shipping_total`
- `orders.grand_total`
- `orders.status`: `pending`, `awaiting_payment`, `paid`, `preparing`, `shipped`, `delivered`, `cancelled`, `refunded`
- `orders.order_status`: `pending`, `awaiting_payment`, `paid`, `preparing`, `shipped`, `delivered`, `cancelled`, `refunded`
- `orders.payment_status`: `unpaid`, `pending`, `awaiting_payment`, `paid`, `failed`, `refunded`
- `orders.fraud_status`: `normal`, `review`, `blocked`
- `orders.partner_status`: `new`, `preparing`, `shipped`, `delivered`
- `tracking_number`
- `cargo_company`
- `admin_note`

`order_items` temel alanları:

- `id`
- `order_id`
- `product_id`
- `partner_id`
- `product_name`
- `quantity`
- `price`
- `unit_price`
- `total_price`
- `partner_commission_rate`
- `platform_commission`
- `partner_net_earning`

### coupons

Checkout sırasında uygulanacak kampanya kodları.

### HP/XP ve Kupon Merkezi

MVP'de gerçek para cüzdanı yoktur. HP yalnızca indirim hakkı, kupon avantajı ve kampanya hakkı olarak çalışır; nakit çekim ve gerçek para bakiyesi gösterimi kapalıdır.

Tablolar:

- `hp_ledger`
- `user_rewards`
- `coupons`
- `coupon_redemptions`

Kurallar:

- Kupon süresi, kullanım limiti, minimum sepet tutarı ve tekil kullanıcı kullanımı server-side kontrol edilir.
- HP kullanımı günlük ve sipariş başı limitlidir.
- Kupon + HP indirimi sipariş toplamını sıfırın altına düşüremez.
- Nakit çekim MVP'de kapalıdır.

### CV hak, ödeme ve risk tabloları

Akıllı CV üretiminde kullanıcı formu doldurabilir; kısıtlama sadece CV/PDF üretim anında uygulanır.

- `cv_device_accounts`: cihaz anahtarı ile kullanıcı eşleşmesini tutar.
- `cv_access_accounts`: kullanıcı başına ücretsiz hak, kullanılan hak, ücretli kredi ve risk durumunu tutar.
- `cv_generations`: her başarılı CV/PDF üretimini kayıt altına alır.
- `cv_payments`: CV üretim kredisi için iyzico ödeme kayıtlarını tutar.
- `admin_notifications`: admin paneline düşen riskli profil ve cihaz bildirimlerini tutar.

İş kuralı:

- İlk cihaz hesabına 2 ücretsiz CV/PDF üretim hakkı tanımlanır.
- Aynı cihazdan ikinci veya sonraki hesap açılırsa/denenirse admin bildirimi oluşur.
- Aynı cihazdaki ikinci ve sonraki hesaplara ücretsiz CV hakkı verilmez.
- Ücretsiz hak bittikten sonra kullanıcı `/pages/career/cv-payment.html` üzerinden ücretli CV üretim kredisi alır.
- Bu CV hak kuralı dışında kullanıcıya başka kısıtlama uygulanmaz.

## SQL

Canlı Supabase projesi için Transaction Core MVP'nin exact SQL kaynağı:

```text
supabase/migrations/20260621015000_transaction_core_mvp.sql
```

Supabase SQL Editor'da bu dosyanın içeriği eksiksiz çalıştırılmalıdır. Bu migration aşağıdakileri tek seferde hazırlar:

- `addresses` default adres kuralları ve RLS
- `carts` / `cart_items` tabloları, RLS ve sepet RPC'leri
- `orders` / `order_items` Transaction Core alanları
- `create_transaction_order(...)` RPC'si
- `hp_ledger`, `user_rewards`, `coupon_redemptions`
- kupon alanları ve RLS
- partner/admin sipariş görünürlüğü ve sınırlı durum güncelleme güvenliği

Önceki doğrudan `orders.insert` SQL'i kullanılmamalıdır. MVP checkout, yalnızca `create_transaction_order(...)` RPC'siyle sipariş oluşturur.

Canlı admin dashboard'da `orders: Supabase migration veya policy production veritabaninda eksik gorunuyor.` uyarısı görülürse production veritabanında orders şeması, RLS policy'leri veya PostgREST schema cache geride kalmış demektir. Veri silmeden onarım için aşağıdaki repair migration tek parça çalıştırılmalıdır:

```text
supabase/migrations/20260627183000_repair_orders_live_schema.sql
```

Supabase SQL Editor kullanılıyorsa yalnızca `.sql` dosyasının içeriği yapıştırılır. `MIGRATION_FILE=...`, `SUPABASE_DB_URL=...` veya `bash ...` satırları SQL değildir; bunlar sadece terminalde çalışan alternatif komutlardır.

```sql
-- Supabase SQL Editor:
-- 1. supabase/migrations/20260621015000_transaction_core_mvp.sql dosyasını aç.
-- 2. İçeriğin tamamını kopyala.
-- 3. Tek parça olarak çalıştır.
-- 4. Ardından Edge Functions secrets ve deploy adımlarını DEPLOY.md üzerinden tamamla.
```

Yeni kurulumlar için tam şema `supabase/schema.sql` dosyasındadır. SQL çalıştırıldıktan sonra Auth, Storage ve Edge Function ayarları `docs/reference/DEPLOY.md` sırasıyla tamamlanmalıdır.
