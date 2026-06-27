create extension if not exists pgcrypto;

create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'avm_admin',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  partner_type text not null default 'mall',
  status text not null default 'onboarding',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists partner_memberships (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'partner_editor',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (partner_id, user_id)
);

create table if not exists malls (
  id text primary key,
  partner_id uuid references partners(id) on delete set null,
  name text not null,
  city text not null,
  district text not null,
  country text not null default 'Türkiye',
  address text,
  phone text,
  website text,
  cover_image_url text,
  status text not null default 'active-directory',
  verification_status text not null default 'public-source-seed',
  partner_status text not null default 'not-onboarded',
  rating numeric(2,1) not null default 0,
  footfall integer not null default 0,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stores (
  id text primary key,
  mall_id text not null references malls(id) on delete cascade,
  partner_id uuid references partners(id) on delete set null,
  name text not null,
  type text not null check (type in ('store', 'restaurant', 'service')),
  category text not null,
  floor text not null,
  unit text not null,
  phone text,
  image text,
  status text not null default 'draft',
  approval_status text not null default 'pending',
  rating numeric(2,1) not null default 0,
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  mall_id text not null references malls(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  name text not null,
  category text not null,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'TRY',
  stock integer not null default 0 check (stock >= 0),
  rating numeric(2,1) not null default 0,
  review_count integer not null default 0,
  image text not null,
  badge text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id text primary key,
  mall_id text not null references malls(id) on delete cascade,
  title text not null,
  condition text not null,
  cta text not null default 'Detayları Gör',
  starts_at date not null,
  ends_at date not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);

create table if not exists coupons (
  id text primary key,
  mall_id text not null references malls(id) on delete cascade,
  store_id text references stores(id) on delete set null,
  code text not null,
  title text not null,
  limit_count integer not null default 0 check (limit_count >= 0),
  used integer not null default 0 check (used >= 0),
  status text not null default 'active',
  expires_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mall_id, code),
  check (used <= limit_count)
);

create table if not exists events (
  id text primary key,
  mall_id text not null references malls(id) on delete cascade,
  title text not null,
  location text not null,
  starts_at timestamptz not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reviews (
  id text primary key,
  mall_id text not null references malls(id) on delete cascade,
  target_id text not null,
  target_type text not null check (target_type in ('mall', 'store', 'restaurant', 'product')),
  author text not null,
  rating integer not null check (rating between 1 and 5),
  text text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  mall_id text not null references malls(id) on delete cascade,
  store_id text references stores(id) on delete set null,
  product_id text references products(id) on delete set null,
  customer_name text not null,
  amount numeric(12,2) not null,
  currency text not null default 'TRY',
  status text not null default 'reserved',
  created_at timestamptz not null default now()
);

create table if not exists content_approvals (
  id uuid primary key default gen_random_uuid(),
  mall_id text not null references malls(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  status text not null default 'pending',
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  mall_id text references malls(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  risk text not null default 'low',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from admin_users
    where user_id = auth.uid()
      and status = 'active'
      and role in ('super_admin', 'avm_admin')
  );
$$;

create or replace function is_partner_member(target_partner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from partner_memberships
    where partner_id = target_partner_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

alter table admin_users enable row level security;
alter table partners enable row level security;
alter table partner_memberships enable row level security;
alter table malls enable row level security;
alter table stores enable row level security;
alter table products enable row level security;
alter table campaigns enable row level security;
alter table coupons enable row level security;
alter table events enable row level security;
alter table reviews enable row level security;
alter table orders enable row level security;
alter table content_approvals enable row level security;
alter table audit_logs enable row level security;

create policy "public can read active malls" on malls
for select using (status like 'active%' or status = 'published');

create policy "public can read published stores" on stores
for select using (status = 'published' and approval_status = 'approved');

create policy "public can read published products" on products
for select using (status = 'published');

create policy "public can read published campaigns" on campaigns
for select using (status = 'published' and current_date between starts_at and ends_at);

create policy "public can read active coupons" on coupons
for select using (status = 'active' and current_date <= expires_at and used < limit_count);

create policy "public can read published events" on events
for select using (status = 'published');

create policy "public can read published reviews" on reviews
for select using (status = 'published');

create policy "admins manage all malls" on malls
for all using (is_admin()) with check (is_admin());

create policy "admins manage all stores" on stores
for all using (is_admin()) with check (is_admin());

create policy "admins manage all products" on products
for all using (is_admin()) with check (is_admin());

create policy "admins manage all campaigns" on campaigns
for all using (is_admin()) with check (is_admin());

create policy "admins manage all coupons" on coupons
for all using (is_admin()) with check (is_admin());

create policy "admins manage all events" on events
for all using (is_admin()) with check (is_admin());

create policy "admins manage all reviews" on reviews
for all using (is_admin()) with check (is_admin());

create policy "admins read all audit logs" on audit_logs
for select using (is_admin());

create policy "partners read own malls" on malls
for select using (partner_id is not null and is_partner_member(partner_id));

create policy "partners manage own stores" on stores
for all
using (partner_id is not null and is_partner_member(partner_id))
with check (partner_id is not null and is_partner_member(partner_id));

create policy "partners manage own products" on products
for all
using (
  exists (
    select 1 from stores
    where stores.id = products.store_id
      and stores.partner_id is not null
      and is_partner_member(stores.partner_id)
  )
)
with check (
  exists (
    select 1 from stores
    where stores.id = products.store_id
      and stores.partner_id is not null
      and is_partner_member(stores.partner_id)
  )
);

create index if not exists malls_city_idx on malls (city);
create index if not exists stores_mall_id_idx on stores (mall_id);
create index if not exists products_mall_id_idx on products (mall_id);
create index if not exists products_store_id_idx on products (store_id);
create index if not exists campaigns_mall_id_dates_idx on campaigns (mall_id, starts_at, ends_at);
create index if not exists coupons_mall_id_expires_idx on coupons (mall_id, expires_at);
create index if not exists events_mall_id_starts_idx on events (mall_id, starts_at);
create index if not exists audit_logs_mall_id_created_idx on audit_logs (mall_id, created_at desc);

insert into malls (id, name, city, district, partner_status, rating, footfall, source)
values
  ('istanbul-kanyon', 'Kanyon', 'İstanbul', 'Şişli', 'partner-ready', 4.7, 34800, 'seed'),
  ('istanbul-mall-of-istanbul', 'Mall of İstanbul', 'İstanbul', 'Başakşehir', 'partner-ready', 4.6, 51200, 'seed'),
  ('ankara-ankamall', 'Ankamall', 'Ankara', 'Yenimahalle', 'partner-ready', 4.5, 38100, 'seed')
on conflict (id) do nothing;

insert into stores (id, mall_id, name, type, category, floor, unit, phone, image, status, approval_status, rating, review_count)
values
  ('store-techline-kanyon', 'istanbul-kanyon', 'TechLine', 'store', 'Elektronik', 'L1', '112', '+90 212 000 11 12', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80', 'published', 'approved', 4.8, 642),
  ('restaurant-green-fork-kanyon', 'istanbul-kanyon', 'Green Fork', 'restaurant', 'Restoran', 'B1', 'F08', '+90 212 000 40 08', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80', 'published', 'approved', 4.5, 529)
on conflict (id) do nothing;

insert into products (id, mall_id, store_id, name, category, price, stock, rating, review_count, image, badge, status)
values
  ('product-techline-phone', 'istanbul-kanyon', 'store-techline-kanyon', 'Nova X Pro Akıllı Telefon', 'Elektronik', 38999, 18, 4.8, 214, 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80', 'Hızlı teslim', 'published'),
  ('product-green-fork-menu', 'istanbul-kanyon', 'restaurant-green-fork-kanyon', 'Green Bowl Menü', 'Restoran', 385, 120, 4.5, 199, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80', 'Hemen al', 'published')
on conflict (id) do nothing;
