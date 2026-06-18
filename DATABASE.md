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

Canlı sitede `Could not find the table 'public.addresses' in the schema cache` hatası görülürse Supabase SQL Editor'da aşağıdaki SQL çalıştırılmalıdır. Frontend bu tablo hazır olana kadar adresleri kullanıcı cihazında geçici olarak saklar; tablo oluşturulduktan sonra kayıtlar Supabase'e kalıcı yazılır.

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
```

### favorites

Giriş yapan kullanıcıların favorileri Supabase'de saklanır. Misafir favorileri tarayıcı localStorage'da geçici tutulur.

### orders / order_items

Sipariş ve sipariş kalemleri. Mevcut üretim modeli `addresses` tablosuna bağlı checkout kullanmaz; teslimat ve fatura detayları doğrudan sipariş kaydındaki `city` ve `address` alanlarında saklanır. Bu nedenle frontend `orders.address_id` göndermez.

- `orders.id`
- `orders.order_no`
- `orders.customer_name`
- `orders.customer_email`
- `orders.customer_phone`
- `orders.city`
- `orders.address`
- `orders.subtotal`
- `orders.shipping`
- `orders.discount`
- `orders.total`
- `order_status`: `pending`, `confirmed`, `preparing`, `shipped`, `delivered`, `cancelled`, `refunded`
- `payment_status`: `pending`, `awaiting_payment`, `paid`, `failed`, `refunded`
- `tracking_number`

`order_items` temel alanları:

- `id`
- `order_id`
- `product_id`
- `product_name`
- `quantity`
- `price`

### coupons

Checkout sırasında uygulanacak kampanya kodları.

## SQL

Canlı Supabase projesi için checkout ile uyumlu doğrudan adres modeli aşağıdaki SQL'dir. Bu SQL `orders.address_id` eklemez; checkout teslimat bilgisini `orders.city` ve `orders.address` alanlarına yazar.

```sql
create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists order_no text,
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists subtotal numeric(12,2) default 0,
  add column if not exists shipping numeric(12,2) default 0,
  add column if not exists discount numeric(12,2) default 0,
  add column if not exists total numeric(12,2) default 0,
  add column if not exists order_status text default 'pending',
  add column if not exists payment_status text default 'pending',
  add column if not exists tracking_number text,
  add column if not exists created_at timestamptz default now();

alter table public.orders
  alter column order_no set default ('ALN-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  alter column subtotal set default 0,
  alter column shipping set default 0,
  alter column discount set default 0,
  alter column total set default 0,
  alter column order_status set default 'pending',
  alter column payment_status set default 'pending',
  alter column created_at set default now();

update public.orders
set order_no = 'ALN-' || to_char(coalesce(created_at, now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8))
where order_no is null or order_no = '';

create unique index if not exists orders_order_no_key on public.orders(order_no);
create index if not exists orders_status_idx on public.orders(order_status, payment_status);

alter table public.order_items
  add column if not exists order_id uuid references public.orders(id) on delete cascade,
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists product_name text,
  add column if not exists quantity integer default 1,
  add column if not exists price numeric(12,2) default 0,
  add column if not exists created_at timestamptz default now();

alter table public.order_items
  alter column quantity set default 1,
  alter column price set default 0,
  alter column created_at set default now();

create index if not exists order_items_order_idx on public.order_items(order_id);
```

Yeni kurulumlar için tam şema `supabase/schema.sql` dosyasındadır. SQL çalıştırıldıktan sonra Auth, Storage ve Edge Function ayarları `DEPLOY.md` sırasıyla tamamlanmalıdır.
