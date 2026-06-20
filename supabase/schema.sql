create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('customer', 'admin', 'partner', 'super_admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_status as enum ('active', 'draft', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'awaiting_payment', 'paid', 'failed', 'refunded');
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  country text,
  city text,
  birth_date date,
  bio text,
  sector_key text,
  sector_name text,
  profession_key text,
  profession_name text,
  profession_title text,
  module text,
  experience_year integer,
  profile_visible boolean not null default true,
  contact_locked boolean not null default true,
  avatar_url text,
  hp integer not null default 250,
  xp integer not null default 0,
  level integer not null default 1,
  streak integer not null default 0,
  cashout_balance numeric(12,2) not null default 0,
  hub_cash numeric(12,2) not null default 0,
  wallet_balance numeric(12,2) not null default 0,
  premium_level text not null default 'Basic',
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_partner_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('partner', 'admin', 'super_admin')
  );
$$;

create or replace function public.order_has_partner_item(target_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = target_order_id
    and p.partner_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = new.id and not public.is_admin() then
    new.role = old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_role_escalation();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  status public.product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  category text not null default 'Genel',
  status public.product_status not null default 'draft',
  slug text unique,
  meta_title text,
  meta_description text,
  brand text,
  sold_count integer not null default 0 check (sold_count >= 0),
  partner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_status_created_idx on public.products(status, created_at desc);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_partner_idx on public.products(partner_id);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.partner_ads (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.profiles(id) on delete set null default auth.uid(),
  product_id uuid references public.products(id) on delete set null,
  placement text not null default 'allonashop_hero',
  title text not null,
  subtitle text,
  campaign_text text,
  image_url text,
  cta_label text not null default 'İncele',
  link_url text,
  priority integer not null default 0,
  status public.product_status not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_ads_placement_status_idx
  on public.partner_ads(placement, status, priority desc, created_at desc);
create index if not exists partner_ads_partner_idx on public.partner_ads(partner_id);

drop trigger if exists partner_ads_set_updated_at on public.partner_ads;
create trigger partner_ads_set_updated_at
  before update on public.partner_ads
  for each row execute function public.set_updated_at();

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

drop trigger if exists addresses_set_updated_at on public.addresses;
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric(12,2) not null check (discount_value >= 0),
  minimum_subtotal numeric(12,2) not null default 0,
  usage_limit integer,
  used_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

create table if not exists public.user_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  code text not null,
  title text not null,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric(12,2) not null check (discount_value >= 0),
  source text not null default 'campaign' check (source in ('campaign', 'hp_conversion')),
  status text not null default 'active' check (status in ('active', 'used', 'expired', 'cancelled')),
  assigned_at timestamptz not null default now(),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists user_coupons_user_status_idx
  on public.user_coupons(user_id, status, assigned_at desc);

drop trigger if exists user_coupons_set_updated_at on public.user_coupons;
create trigger user_coupons_set_updated_at
  before update on public.user_coupons
  for each row execute function public.set_updated_at();

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default ('ALN-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  city text not null,
  address text not null,
  subtotal numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  order_status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(order_status, payment_status);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  price numeric(12,2) not null check (price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  company_name text not null,
  tax_number text,
  contact_name text not null,
  phone text,
  email text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists partner_applications_set_updated_at on public.partner_applications;
create trigger partner_applications_set_updated_at
  before update on public.partner_applications
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.partner_ads enable row level security;
alter table public.addresses enable row level security;
alter table public.favorites enable row level security;
alter table public.coupons enable row level security;
alter table public.user_coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.partner_applications enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own_customer" on public.profiles;
create policy "profiles_insert_own_customer"
  on public.profiles for insert
  with check (id = auth.uid() and role = 'customer');

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "categories_read_active" on public.categories;
create policy "categories_read_active"
  on public.categories for select
  using (status = 'active' or public.is_admin());

drop policy if exists "categories_admin_all" on public.categories;
create policy "categories_admin_all"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "products_read_active_or_owner" on public.products;
create policy "products_read_active_or_owner"
  on public.products for select
  using (status = 'active' or partner_id = auth.uid() or public.is_admin());

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "products_partner_insert" on public.products;
create policy "products_partner_insert"
  on public.products for insert
  with check (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()));

drop policy if exists "products_partner_update_own" on public.products;
create policy "products_partner_update_own"
  on public.products for update
  using (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()))
  with check (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()));

drop policy if exists "partner_ads_read_active" on public.partner_ads;
create policy "partner_ads_read_active"
  on public.partner_ads for select
  using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "partner_ads_admin_all" on public.partner_ads;
create policy "partner_ads_admin_all"
  on public.partner_ads for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "partner_ads_partner_insert" on public.partner_ads;
create policy "partner_ads_partner_insert"
  on public.partner_ads for insert
  with check (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()));

drop policy if exists "partner_ads_partner_update_own" on public.partner_ads;
create policy "partner_ads_partner_update_own"
  on public.partner_ads for update
  using (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()))
  with check (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()));

drop policy if exists "addresses_own" on public.addresses;
create policy "addresses_own"
  on public.addresses for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own"
  on public.favorites for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "coupons_read_active" on public.coupons;
create policy "coupons_read_active"
  on public.coupons for select
  using (status = 'active' or public.is_admin());

drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all"
  on public.coupons for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "user_coupons_select_own_or_admin" on public.user_coupons;
create policy "user_coupons_select_own_or_admin"
  on public.user_coupons for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_coupons_insert_own_or_admin" on public.user_coupons;
create policy "user_coupons_insert_own_or_admin"
  on public.user_coupons for insert
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_coupons_update_own_or_admin" on public.user_coupons;
create policy "user_coupons_update_own_or_admin"
  on public.user_coupons for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin"
  on public.orders for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.order_has_partner_item(orders.id)
  );

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  with check (user_id = auth.uid());

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "order_items_select_own_or_admin" on public.order_items;
create policy "order_items_select_own_or_admin"
  on public.order_items for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.products
      where products.id = order_items.product_id
      and products.partner_id = auth.uid()
    )
    or exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_insert_own"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

drop policy if exists "order_items_admin_update" on public.order_items;
create policy "order_items_admin_update"
  on public.order_items for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "partner_applications_insert_public" on public.partner_applications;
create policy "partner_applications_insert_public"
  on public.partner_applications for insert
  with check (true);

drop policy if exists "partner_applications_select_admin_or_own" on public.partner_applications;
create policy "partner_applications_select_admin_or_own"
  on public.partner_applications for select
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists "partner_applications_admin_update" on public.partner_applications;
create policy "partner_applications_admin_update"
  on public.partner_applications for update
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.cv_device_accounts (
  device_key text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (device_key, user_id)
);

create index if not exists cv_device_accounts_user_idx
  on public.cv_device_accounts(user_id, first_seen_at);

create table if not exists public.cv_access_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  device_key text,
  free_limit integer not null default 2 check (free_limit >= 0),
  free_used integer not null default 0 check (free_used >= 0),
  paid_credits integer not null default 0 check (paid_credits >= 0),
  is_risky boolean not null default false,
  risk_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cv_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  device_key text,
  generation_type text not null check (generation_type in ('free', 'paid_credit')),
  cv_title text,
  created_at timestamptz not null default now()
);

create table if not exists public.cv_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  amount numeric(12,2) not null default 149.99 check (amount >= 0),
  currency text not null default 'TRY',
  status public.payment_status not null default 'pending',
  iyzico_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  severity text not null default 'info',
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_kind_created_idx
  on public.admin_notifications(kind, created_at desc);
create index if not exists cv_payments_user_status_idx
  on public.cv_payments(user_id, status, created_at desc);
create index if not exists cv_generations_user_created_idx
  on public.cv_generations(user_id, created_at desc);

drop trigger if exists cv_access_accounts_set_updated_at on public.cv_access_accounts;
create trigger cv_access_accounts_set_updated_at
  before update on public.cv_access_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists cv_payments_set_updated_at on public.cv_payments;
create trigger cv_payments_set_updated_at
  before update on public.cv_payments
  for each row execute function public.set_updated_at();

create or replace function public.ensure_cv_access(
  p_device_key text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_key text := nullif(trim(coalesce(p_device_key, '')), '');
  v_first_user uuid;
  v_device_count integer := 0;
  v_is_risky boolean := false;
  v_access public.cv_access_accounts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_device_key is null then
    v_device_key := 'unknown:' || v_user_id::text;
  end if;

  insert into public.cv_device_accounts (device_key, user_id, user_agent, last_seen_at)
  values (v_device_key, v_user_id, left(coalesce(p_user_agent, ''), 500), now())
  on conflict (device_key, user_id) do update
    set last_seen_at = now(),
        user_agent = left(coalesce(excluded.user_agent, public.cv_device_accounts.user_agent, ''), 500);

  select user_id
    into v_first_user
  from public.cv_device_accounts
  where device_key = v_device_key
  order by first_seen_at asc
  limit 1;

  select count(distinct user_id)
    into v_device_count
  from public.cv_device_accounts
  where device_key = v_device_key;

  v_is_risky := v_first_user is not null and v_first_user <> v_user_id;

  insert into public.cv_access_accounts (
    user_id,
    device_key,
    free_limit,
    free_used,
    paid_credits,
    is_risky,
    risk_reason
  )
  values (
    v_user_id,
    v_device_key,
    case when v_is_risky then 0 else 2 end,
    0,
    0,
    v_is_risky,
    case when v_is_risky then 'same_device_multiple_accounts' else null end
  )
  on conflict (user_id) do update
    set device_key = coalesce(public.cv_access_accounts.device_key, excluded.device_key),
        is_risky = public.cv_access_accounts.is_risky or excluded.is_risky,
        risk_reason = case
          when public.cv_access_accounts.is_risky or excluded.is_risky
            then coalesce(public.cv_access_accounts.risk_reason, excluded.risk_reason)
          else null
        end,
        updated_at = now()
  returning * into v_access;

  if v_is_risky and not exists (
    select 1
    from public.admin_notifications
    where kind = 'cv_device_risk'
      and user_id = v_user_id
      and metadata ->> 'device_key' = v_device_key
  ) then
    insert into public.admin_notifications (user_id, kind, severity, title, message, metadata)
    values (
      v_user_id,
      'cv_device_risk',
      'risk',
      'Riskli CV profili',
      'Aynı cihaz üzerinden ikinci veya daha sonraki bir hesap CV hakkı talep etti. Bu hesaba ücretsiz CV hakkı tanımlanmadı.',
      jsonb_build_object(
        'device_key', v_device_key,
        'device_account_count', v_device_count,
        'first_user_id', v_first_user,
        'risk_reason', 'same_device_multiple_accounts'
      )
    );
  end if;

  return jsonb_build_object(
    'user_id', v_access.user_id,
    'free_limit', v_access.free_limit,
    'free_used', v_access.free_used,
    'remaining_free', greatest(v_access.free_limit - v_access.free_used, 0),
    'paid_credits', v_access.paid_credits,
    'is_risky', v_access.is_risky,
    'risk_reason', v_access.risk_reason,
    'device_account_count', v_device_count
  );
end;
$$;

create or replace function public.claim_cv_generation(
  p_device_key text,
  p_cv_title text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_key text := nullif(trim(coalesce(p_device_key, '')), '');
  v_access public.cv_access_accounts%rowtype;
  v_generation_type text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_cv_access(v_device_key, p_user_agent);

  select *
    into v_access
  from public.cv_access_accounts
  where user_id = v_user_id
  for update;

  if v_access.free_used < v_access.free_limit then
    update public.cv_access_accounts
      set free_used = free_used + 1,
          updated_at = now()
      where user_id = v_user_id
      returning * into v_access;
    v_generation_type := 'free';
  elsif v_access.paid_credits > 0 then
    update public.cv_access_accounts
      set paid_credits = paid_credits - 1,
          updated_at = now()
      where user_id = v_user_id
      returning * into v_access;
    v_generation_type := 'paid_credit';
  else
    return jsonb_build_object(
      'allowed', false,
      'payment_required', true,
      'payment_url', '/pages/career/cv-payment.html?reason=limit',
      'remaining_free', 0,
      'paid_credits', v_access.paid_credits,
      'is_risky', v_access.is_risky
    );
  end if;

  insert into public.cv_generations (user_id, device_key, generation_type, cv_title)
  values (v_user_id, v_device_key, v_generation_type, left(coalesce(p_cv_title, ''), 180));

  return jsonb_build_object(
    'allowed', true,
    'payment_required', false,
    'generation_type', v_generation_type,
    'remaining_free', greatest(v_access.free_limit - v_access.free_used, 0),
    'paid_credits', v_access.paid_credits,
    'is_risky', v_access.is_risky
  );
end;
$$;

create or replace function public.report_cv_device_signal(
  p_device_key text,
  p_email text default null,
  p_context text default 'register_attempt',
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_key text := nullif(trim(coalesce(p_device_key, '')), '');
  v_known_count integer := 0;
begin
  if v_device_key is null then
    return jsonb_build_object('reported', false, 'reason', 'missing_device_key');
  end if;

  select count(distinct user_id)
    into v_known_count
  from public.cv_device_accounts
  where device_key = v_device_key;

  if v_known_count = 0 then
    return jsonb_build_object('reported', false, 'known_accounts', 0);
  end if;

  if not exists (
    select 1
    from public.admin_notifications
    where kind = 'cv_device_signup_attempt'
      and metadata ->> 'device_key' = v_device_key
      and metadata ->> 'email' = coalesce(p_email, '')
      and created_at > now() - interval '12 hours'
  ) then
    insert into public.admin_notifications (kind, severity, title, message, metadata)
    values (
      'cv_device_signup_attempt',
      'risk',
      'Aynı cihazdan yeni hesap denemesi',
      'Daha önce CV hakkı kullanılan bir cihazdan yeni hesap açma denemesi yapıldı.',
      jsonb_build_object(
        'device_key', v_device_key,
        'known_account_count', v_known_count,
        'email', coalesce(p_email, ''),
        'context', coalesce(p_context, 'register_attempt'),
        'user_agent', left(coalesce(p_user_agent, ''), 500)
      )
    );
  end if;

  return jsonb_build_object('reported', true, 'known_accounts', v_known_count);
end;
$$;

alter table public.cv_device_accounts enable row level security;
alter table public.cv_access_accounts enable row level security;
alter table public.cv_generations enable row level security;
alter table public.cv_payments enable row level security;
alter table public.admin_notifications enable row level security;

drop policy if exists "cv_device_accounts_select_own_or_admin" on public.cv_device_accounts;
create policy "cv_device_accounts_select_own_or_admin"
  on public.cv_device_accounts for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_device_accounts_admin_all" on public.cv_device_accounts;
create policy "cv_device_accounts_admin_all"
  on public.cv_device_accounts for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cv_access_select_own_or_admin" on public.cv_access_accounts;
create policy "cv_access_select_own_or_admin"
  on public.cv_access_accounts for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_access_admin_all" on public.cv_access_accounts;
create policy "cv_access_admin_all"
  on public.cv_access_accounts for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cv_generations_select_own_or_admin" on public.cv_generations;
create policy "cv_generations_select_own_or_admin"
  on public.cv_generations for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_generations_admin_all" on public.cv_generations;
create policy "cv_generations_admin_all"
  on public.cv_generations for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cv_payments_select_own_or_admin" on public.cv_payments;
create policy "cv_payments_select_own_or_admin"
  on public.cv_payments for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_payments_admin_all" on public.cv_payments;
create policy "cv_payments_admin_all"
  on public.cv_payments for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin_notifications_select_admin" on public.admin_notifications;
create policy "admin_notifications_select_admin"
  on public.admin_notifications for select
  using (public.is_admin());

drop policy if exists "admin_notifications_admin_all" on public.admin_notifications;
create policy "admin_notifications_admin_all"
  on public.admin_notifications for all
  using (public.is_admin())
  with check (public.is_admin());

grant execute on function public.ensure_cv_access(text, text) to authenticated;
grant execute on function public.claim_cv_generation(text, text, text) to authenticated;
grant execute on function public.report_cv_device_signal(text, text, text, text) to anon, authenticated;
