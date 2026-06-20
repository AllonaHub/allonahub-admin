create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

do $$ begin
  create type public.order_status as enum ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'awaiting_payment', 'paid', 'failed', 'refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.order_status add value if not exists 'awaiting_payment';
exception when undefined_object then null;
end $$;

do $$ begin
  alter type public.order_status add value if not exists 'paid';
exception when undefined_object then null;
end $$;

do $$ begin
  alter type public.payment_status add value if not exists 'unpaid';
exception when undefined_object then null;
end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default ('ALN-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  customer_name text not null default '',
  customer_email text not null default '',
  customer_phone text,
  city text not null default '',
  address text not null default '',
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

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null default '',
  quantity integer not null default 1 check (quantity > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null default 'fixed' check (discount_type in ('fixed', 'percent')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  minimum_subtotal numeric(12,2) not null default 0,
  usage_limit integer,
  used_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

alter table public.addresses
  add column if not exists is_default boolean not null default false;

with ranked as (
  select id, row_number() over (partition by user_id order by is_default desc, created_at desc, id desc) as rn
  from public.addresses
)
update public.addresses a
set is_default = ranked.rn = 1
from ranked
where ranked.id = a.id;

create index if not exists addresses_user_created_idx on public.addresses(user_id, created_at desc);
create unique index if not exists addresses_one_default_per_user on public.addresses(user_id) where is_default;

create or replace function public.normalize_address_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if auth.uid() is not null and new.user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Address user mismatch';
  end if;

  if tg_op = 'INSERT' and not exists (select 1 from public.addresses where user_id = new.user_id) then
    new.is_default := true;
  end if;

  if coalesce(new.is_default, false) then
    update public.addresses
    set is_default = false
    where user_id = new.user_id
      and id is distinct from new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists addresses_normalize_default on public.addresses;
create trigger addresses_normalize_default
  before insert or update of user_id, is_default on public.addresses
  for each row execute function public.normalize_address_default();

alter table public.addresses enable row level security;

drop policy if exists "addresses_own" on public.addresses;
drop policy if exists "addresses_select_own" on public.addresses;
drop policy if exists "addresses_insert_own" on public.addresses;
drop policy if exists "addresses_update_own" on public.addresses;
drop policy if exists "addresses_delete_own" on public.addresses;

create policy "addresses_select_own" on public.addresses
  for select to authenticated
  using (user_id = auth.uid());

create policy "addresses_insert_own" on public.addresses
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "addresses_update_own" on public.addresses
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "addresses_delete_own" on public.addresses
  for delete to authenticated
  using (user_id = auth.uid());

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists carts_one_active_per_user on public.carts(user_id) where status = 'active';
create index if not exists carts_user_status_idx on public.carts(user_id, status, created_at desc);

drop trigger if exists carts_set_updated_at on public.carts;
create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  partner_id uuid references public.profiles(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 99),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total_price numeric(12,2) not null default 0 check (total_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create index if not exists cart_items_cart_idx on public.cart_items(cart_id, created_at desc);
create index if not exists cart_items_product_idx on public.cart_items(product_id);

drop trigger if exists cart_items_set_updated_at on public.cart_items;
create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

drop policy if exists "carts_select_own_or_admin" on public.carts;
create policy "carts_select_own_or_admin" on public.carts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "carts_insert_own" on public.carts;
create policy "carts_insert_own" on public.carts
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "carts_update_own_or_admin" on public.carts;
create policy "carts_update_own_or_admin" on public.carts
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "cart_items_select_own_or_admin" on public.cart_items;
create policy "cart_items_select_own_or_admin" on public.cart_items
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = auth.uid())
  );

drop policy if exists "cart_items_insert_own" on public.cart_items;
create policy "cart_items_insert_own" on public.cart_items
  for insert to authenticated
  with check (exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = auth.uid()));

drop policy if exists "cart_items_update_own_or_admin" on public.cart_items;
create policy "cart_items_update_own_or_admin" on public.cart_items
  for update to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = auth.uid())
  );

drop policy if exists "cart_items_delete_own_or_admin" on public.cart_items;
create policy "cart_items_delete_own_or_admin" on public.cart_items
  for delete to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = auth.uid())
  );

create or replace function public.get_or_create_active_cart()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select id into v_cart_id
  from public.carts
  where user_id = v_user_id and status = 'active'
  order by created_at desc
  limit 1;

  if v_cart_id is not null then return v_cart_id; end if;

  begin
    insert into public.carts(user_id, status) values (v_user_id, 'active')
    returning id into v_cart_id;
  exception when unique_violation then
    select id into v_cart_id
    from public.carts
    where user_id = v_user_id and status = 'active'
    order by created_at desc
    limit 1;
  end;

  return v_cart_id;
end;
$$;

create or replace function public.get_active_cart()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart public.carts%rowtype;
  v_items jsonb := '[]'::jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_cart
  from public.carts
  where user_id = v_user_id and status = 'active'
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('id', null, 'status', 'empty', 'items', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ci.id,
    'product_id', ci.product_id,
    'partner_id', ci.partner_id,
    'qty', ci.quantity,
    'quantity', ci.quantity,
    'unit_price', ci.unit_price,
    'total_price', ci.total_price,
    'product', to_jsonb(p)
  ) order by ci.created_at desc), '[]'::jsonb)
  into v_items
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart.id;

  return jsonb_build_object('id', v_cart.id, 'status', v_cart.status, 'items', v_items);
end;
$$;

create or replace function public.add_cart_item(p_product_id uuid, p_quantity integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart_id uuid;
  v_product public.products%rowtype;
  v_existing_quantity integer := 0;
  v_target_quantity integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_product_id is null or coalesce(p_quantity, 0) < 1 or p_quantity > 99 then raise exception 'Invalid cart item'; end if;

  select * into v_product
  from public.products
  where id = p_product_id and status = 'active'
  limit 1;
  if not found then raise exception 'Product is not available'; end if;

  v_cart_id := public.get_or_create_active_cart();

  select quantity into v_existing_quantity
  from public.cart_items
  where cart_id = v_cart_id and product_id = p_product_id;

  v_target_quantity := coalesce(v_existing_quantity, 0) + p_quantity;
  if v_product.stock < v_target_quantity then raise exception 'Insufficient stock'; end if;

  insert into public.cart_items(cart_id, product_id, partner_id, quantity, unit_price, total_price)
  values (v_cart_id, v_product.id, v_product.partner_id, p_quantity, v_product.price, v_product.price * p_quantity)
  on conflict (cart_id, product_id)
  do update set
    partner_id = excluded.partner_id,
    quantity = public.cart_items.quantity + excluded.quantity,
    unit_price = excluded.unit_price,
    total_price = (public.cart_items.quantity + excluded.quantity) * excluded.unit_price,
    updated_at = now();

  return public.get_active_cart();
end;
$$;

create or replace function public.set_cart_item_quantity(p_product_id uuid, p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
  v_product public.products%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select id into v_cart_id
  from public.carts
  where user_id = v_user_id and status = 'active'
  order by created_at desc
  limit 1;

  if v_cart_id is null then return public.get_active_cart(); end if;

  if coalesce(p_quantity, 0) <= 0 then
    delete from public.cart_items where cart_id = v_cart_id and product_id = p_product_id;
    return public.get_active_cart();
  end if;

  if p_quantity > 99 then raise exception 'Invalid quantity'; end if;

  select * into v_product
  from public.products
  where id = p_product_id and status = 'active'
  limit 1;
  if not found then raise exception 'Product is not available'; end if;
  if v_product.stock < p_quantity then raise exception 'Insufficient stock'; end if;

  update public.cart_items
  set quantity = p_quantity,
      partner_id = v_product.partner_id,
      unit_price = v_product.price,
      total_price = v_product.price * p_quantity,
      updated_at = now()
  where cart_id = v_cart_id and product_id = p_product_id;

  return public.get_active_cart();
end;
$$;

create or replace function public.clear_active_cart()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select id into v_cart_id from public.carts where user_id = v_user_id and status = 'active' order by created_at desc limit 1;
  if v_cart_id is not null then delete from public.cart_items where cart_id = v_cart_id; end if;
  return public.get_active_cart();
end;
$$;

alter table public.orders
  add column if not exists order_number text,
  add column if not exists address_id uuid references public.addresses(id) on delete set null,
  add column if not exists status text not null default 'pending',
  add column if not exists discount_total numeric(12,2) not null default 0,
  add column if not exists hp_discount numeric(12,2) not null default 0,
  add column if not exists coupon_discount numeric(12,2) not null default 0,
  add column if not exists shipping_total numeric(12,2) not null default 0,
  add column if not exists grand_total numeric(12,2) not null default 0,
  add column if not exists partner_status text not null default 'new',
  add column if not exists cargo_company text,
  add column if not exists admin_note text,
  add column if not exists fraud_status text not null default 'normal';

update public.orders
set order_number = coalesce(nullif(order_number, ''), order_no, 'ALN-' || to_char(coalesce(created_at, now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8))),
    status = coalesce(nullif(status, ''), order_status::text, 'pending'),
    discount_total = coalesce(nullif(discount_total, 0), discount, 0),
    coupon_discount = coalesce(nullif(coupon_discount, 0), discount, 0),
    shipping_total = coalesce(nullif(shipping_total, 0), shipping, 0),
    grand_total = coalesce(nullif(grand_total, 0), total, 0);

create unique index if not exists orders_order_number_key on public.orders(order_number) where order_number is not null;
create index if not exists orders_status_created_idx on public.orders(status, payment_status, created_at desc);
create index if not exists orders_fraud_status_idx on public.orders(fraud_status, created_at desc);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_status_allowed' and conrelid = 'public.orders'::regclass) then
    alter table public.orders
      add constraint orders_status_allowed
      check (status in ('pending', 'awaiting_payment', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'))
      not valid;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_fraud_status_allowed' and conrelid = 'public.orders'::regclass) then
    alter table public.orders
      add constraint orders_fraud_status_allowed
      check (fraud_status in ('normal', 'review', 'blocked'))
      not valid;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_partner_status_allowed' and conrelid = 'public.orders'::regclass) then
    alter table public.orders
      add constraint orders_partner_status_allowed
      check (partner_status in ('new', 'preparing', 'shipped', 'delivered'))
      not valid;
  end if;
end $$;

alter table public.order_items
  add column if not exists partner_id uuid references public.profiles(id) on delete set null,
  add column if not exists unit_price numeric(12,2) not null default 0,
  add column if not exists total_price numeric(12,2) not null default 0,
  add column if not exists partner_commission_rate numeric(5,2) not null default 0,
  add column if not exists platform_commission numeric(12,2) not null default 0,
  add column if not exists partner_net_earning numeric(12,2) not null default 0;

update public.order_items oi
set partner_id = coalesce(oi.partner_id, p.partner_id),
    unit_price = case when oi.unit_price = 0 then oi.price else oi.unit_price end,
    total_price = case when oi.total_price = 0 then oi.price * oi.quantity else oi.total_price end,
    partner_net_earning = case when oi.partner_net_earning = 0 then greatest(0, oi.price * oi.quantity - oi.platform_commission) else oi.partner_net_earning end
from public.products p
where p.id = oi.product_id;

create index if not exists order_items_partner_idx on public.order_items(partner_id, created_at desc);

create table if not exists public.hp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  type text not null check (type in ('earn', 'spend', 'adjust', 'expire')),
  amount integer not null,
  reason text,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists hp_ledger_user_created_idx on public.hp_ledger(user_id, created_at desc);

create table if not exists public.user_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique default auth.uid(),
  hp_balance integer not null default 0 check (hp_balance >= 0),
  xp_balance integer not null default 0 check (xp_balance >= 0),
  level_name text not null default 'New Member',
  premium_tier text not null default 'free' check (premium_tier in ('free', 'blue', 'silver', 'gold', 'platinum', 'elite_black')),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_rewards_set_updated_at on public.user_rewards;
create trigger user_rewards_set_updated_at
  before update on public.user_rewards
  for each row execute function public.set_updated_at();

alter table public.coupons
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists min_order_total numeric(12,2) not null default 0,
  add column if not exists max_discount numeric(12,2),
  add column if not exists is_active boolean not null default true;

update public.coupons
set title = coalesce(nullif(title, ''), code),
    min_order_total = coalesce(nullif(min_order_total, 0), minimum_subtotal, 0),
    is_active = case when status::text = 'active' then true else is_active end;

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  order_id uuid references public.orders(id) on delete set null,
  discount_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (coupon_id, user_id)
);

create index if not exists coupon_redemptions_user_created_idx on public.coupon_redemptions(user_id, created_at desc);
create index if not exists coupon_redemptions_order_idx on public.coupon_redemptions(order_id);

alter table public.hp_ledger enable row level security;
alter table public.user_rewards enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "hp_ledger_select_own_or_admin" on public.hp_ledger;
create policy "hp_ledger_select_own_or_admin" on public.hp_ledger
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "hp_ledger_admin_all" on public.hp_ledger;
create policy "hp_ledger_admin_all" on public.hp_ledger
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "user_rewards_select_own_or_admin" on public.user_rewards;
create policy "user_rewards_select_own_or_admin" on public.user_rewards
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_rewards_admin_all" on public.user_rewards;
create policy "user_rewards_admin_all" on public.user_rewards
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "coupon_redemptions_select_own_or_admin" on public.coupon_redemptions;
create policy "coupon_redemptions_select_own_or_admin" on public.coupon_redemptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "coupon_redemptions_insert_own" on public.coupon_redemptions;
drop policy if exists "coupon_redemptions_insert_via_rpc_only" on public.coupon_redemptions;
create policy "coupon_redemptions_insert_via_rpc_only" on public.coupon_redemptions
  for insert to authenticated
  with check (false);

drop policy if exists "coupon_redemptions_admin_all" on public.coupon_redemptions;
create policy "coupon_redemptions_admin_all" on public.coupon_redemptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "coupons_read_active" on public.coupons;
create policy "coupons_read_active" on public.coupons
  for select
  using ((coalesce(is_active, false) = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())) or public.is_admin());

create or replace function public.order_has_partner_item(target_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.order_items oi
    left join public.products p on p.id = oi.product_id
    where oi.order_id = target_order_id
      and coalesce(oi.partner_id, p.partner_id) = auth.uid()
  );
$$;

drop policy if exists "order_items_select_own_or_admin" on public.order_items;
create policy "order_items_select_own_or_admin"
  on public.order_items for select
  to authenticated
  using (
    public.is_admin()
    or coalesce(order_items.partner_id, '00000000-0000-0000-0000-000000000000'::uuid) = auth.uid()
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
    or public.is_courier_or_admin()
  );

drop policy if exists "order_items_insert_own" on public.order_items;
drop policy if exists "order_items_insert_via_rpc_only" on public.order_items;
drop policy if exists "order_items_insert_via_secure_rpc_only" on public.order_items;
create policy "order_items_insert_via_rpc_only" on public.order_items
  for insert to authenticated
  with check (false);

create or replace function public.protect_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (public.order_has_partner_item(old.id) or public.is_courier_or_admin()) then
    raise exception 'Forbidden order update';
  end if;

  if new.id is distinct from old.id
    or new.order_no is distinct from old.order_no
    or new.order_number is distinct from old.order_number
    or new.user_id is distinct from old.user_id
    or new.address_id is distinct from old.address_id
    or new.customer_name is distinct from old.customer_name
    or new.customer_email is distinct from old.customer_email
    or new.customer_phone is distinct from old.customer_phone
    or new.city is distinct from old.city
    or new.address is distinct from old.address
    or new.subtotal is distinct from old.subtotal
    or new.shipping is distinct from old.shipping
    or new.discount is distinct from old.discount
    or new.total is distinct from old.total
    or new.discount_total is distinct from old.discount_total
    or new.hp_discount is distinct from old.hp_discount
    or new.coupon_discount is distinct from old.coupon_discount
    or new.shipping_total is distinct from old.shipping_total
    or new.grand_total is distinct from old.grand_total
    or new.payment_status is distinct from old.payment_status
    or new.admin_note is distinct from old.admin_note
    or new.fraud_status is distinct from old.fraud_status
  then
    raise exception 'Only delivery status and tracking fields can be updated';
  end if;

  if new.status is distinct from old.status
    and new.status not in ('preparing', 'shipped', 'delivered')
  then
    raise exception 'Partner status update is not allowed';
  end if;

  if new.order_status is distinct from old.order_status
    and new.order_status not in ('preparing', 'shipped', 'delivered')
  then
    raise exception 'Partner order status update is not allowed';
  end if;

  if new.partner_status is distinct from old.partner_status
    and coalesce(new.partner_status, '') not in ('preparing', 'shipped', 'delivered')
  then
    raise exception 'Partner shipment status update is not allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_protect_non_admin_update on public.orders;
create trigger orders_protect_non_admin_update
  before update on public.orders
  for each row execute function public.protect_order_update();

create or replace function public.create_transaction_order(
  p_address_id uuid default null,
  p_coupon_code text default null,
  p_hp_to_use integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart public.carts%rowtype;
  v_address public.addresses%rowtype;
  v_profile record;
  v_coupon public.coupons%rowtype;
  v_order public.orders%rowtype;
  v_item record;
  v_subtotal numeric(12,2) := 0;
  v_coupon_discount numeric(12,2) := 0;
  v_hp_discount numeric(12,2) := 0;
  v_discount_total numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_grand_total numeric(12,2) := 0;
  v_hp_balance integer := 0;
  v_hp_requested integer := greatest(0, coalesce(p_hp_to_use, 0));
  v_hp_daily_used integer := 0;
  v_order_number text := 'ALN-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8));
  v_address_text text;
  v_items_count integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  if (
    select count(*) from public.orders
    where user_id = v_user_id and created_at > now() - interval '10 minutes'
  ) >= 10 then
    raise exception 'Rate limit exceeded';
  end if;

  select * into v_cart
  from public.carts
  where user_id = v_user_id and status = 'active'
  order by created_at desc
  limit 1;
  if not found then raise exception 'Cart is empty'; end if;

  select * into v_address
  from public.addresses
  where user_id = v_user_id
    and ((p_address_id is not null and id = p_address_id) or (p_address_id is null and is_default))
  order by is_default desc, created_at desc
  limit 1;
  if not found then raise exception 'Delivery address is required'; end if;

  select
    coalesce(nullif(p.full_name, ''), nullif(u.raw_user_meta_data ->> 'full_name', ''), v_address.full_name, 'AllonaHub Kullanıcısı') as full_name,
    coalesce(nullif(p.phone, ''), nullif(u.raw_user_meta_data ->> 'phone', ''), v_address.phone, '') as phone,
    coalesce(nullif(p.email, ''), u.email, '') as email,
    coalesce(p.hp, 0) as profile_hp,
    coalesce(p.xp, 0) as profile_xp,
    coalesce(nullif(lower(p.premium_level), ''), 'free') as premium_level
  into v_profile
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_user_id
  limit 1;

  for v_item in
    select ci.product_id, ci.quantity, p.name, p.price, p.stock, p.partner_id, p.status
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.cart_id = v_cart.id
  loop
    if v_item.status <> 'active' then raise exception 'Product is not available'; end if;
    if v_item.stock < v_item.quantity then raise exception 'Insufficient stock'; end if;
    v_subtotal := v_subtotal + (v_item.price * v_item.quantity);
    v_items_count := v_items_count + 1;
  end loop;

  if v_items_count = 0 or v_subtotal <= 0 then raise exception 'Cart is empty'; end if;

  insert into public.user_rewards(user_id, hp_balance, xp_balance, level_name, premium_tier)
  values (
    v_user_id,
    coalesce(v_profile.profile_hp, 0),
    coalesce(v_profile.profile_xp, 0),
    'New Member',
    case
      when v_profile.premium_level in ('free', 'blue', 'silver', 'gold', 'platinum', 'elite_black') then v_profile.premium_level
      when v_profile.premium_level = 'basic' then 'free'
      else 'free'
    end
  )
  on conflict (user_id) do nothing;

  select hp_balance into v_hp_balance
  from public.user_rewards
  where user_id = v_user_id
  for update;

  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select * into v_coupon
    from public.coupons
    where upper(code) = upper(trim(p_coupon_code))
      and coalesce(is_active, status::text = 'active') = true
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
      and coalesce(min_order_total, minimum_subtotal, 0) <= v_subtotal
      and (usage_limit is null or used_count < usage_limit)
    limit 1;

    if not found then raise exception 'Coupon is not valid'; end if;
    if exists (select 1 from public.coupon_redemptions where coupon_id = v_coupon.id and user_id = v_user_id) then
      raise exception 'Coupon already used';
    end if;

    if v_coupon.discount_type = 'percent' then
      v_coupon_discount := round(v_subtotal * (v_coupon.discount_value / 100), 2);
    else
      v_coupon_discount := v_coupon.discount_value;
    end if;
    if v_coupon.max_discount is not null then v_coupon_discount := least(v_coupon_discount, v_coupon.max_discount); end if;
    v_coupon_discount := least(v_subtotal, greatest(0, v_coupon_discount));
  end if;

  select coalesce(abs(sum(amount)), 0)::integer into v_hp_daily_used
  from public.hp_ledger
  where user_id = v_user_id and type = 'spend' and created_at >= date_trunc('day', now());

  v_hp_discount := least(
    v_hp_requested,
    v_hp_balance,
    greatest(0, 300 - v_hp_daily_used),
    100,
    floor(v_subtotal * 0.20)::integer
  );

  v_hp_discount := greatest(0, v_hp_discount);
  v_discount_total := least(v_subtotal, v_coupon_discount + v_hp_discount);
  v_shipping := case when (v_subtotal - v_discount_total) >= 1500 then 0 else 89.90 end;
  v_grand_total := greatest(0, v_subtotal + v_shipping - v_discount_total);
  v_address_text := concat_ws(E'\n', nullif(v_address.address, ''), nullif(concat_ws(' / ', nullif(v_address.district, ''), nullif(v_address.city, ''), nullif(v_address.zip_code, '')), ''));

  insert into public.orders(
    order_no, order_number, user_id, address_id, customer_name, customer_email, customer_phone,
    city, address, subtotal, shipping, discount, total, status, payment_status, order_status,
    discount_total, hp_discount, coupon_discount, shipping_total, grand_total, partner_status,
    tracking_number, cargo_company, fraud_status
  )
  values (
    v_order_number, v_order_number, v_user_id, v_address.id,
    left(coalesce(v_address.full_name, v_profile.full_name, 'AllonaHub Kullanıcısı'), 160),
    left(coalesce(v_profile.email, ''), 180),
    left(coalesce(v_address.phone, v_profile.phone, ''), 40),
    left(coalesce(v_address.city, ''), 90),
    left(coalesce(v_address_text, ''), 1200),
    v_subtotal, v_shipping, v_discount_total, v_grand_total,
    'pending', 'unpaid', 'pending',
    v_discount_total, v_hp_discount, v_coupon_discount, v_shipping, v_grand_total,
    'new', '', '', 'normal'
  )
  returning * into v_order;

  for v_item in
    select ci.product_id, ci.quantity, p.name, p.price, p.stock, p.partner_id, p.status
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.cart_id = v_cart.id
  loop
    if v_item.status <> 'active' or v_item.stock < v_item.quantity then raise exception 'Product stock changed'; end if;

    insert into public.order_items(
      order_id, product_id, partner_id, product_name, quantity, price, unit_price,
      total_price, partner_commission_rate, platform_commission, partner_net_earning
    )
    values (
      v_order.id, v_item.product_id, v_item.partner_id, v_item.name, v_item.quantity, v_item.price, v_item.price,
      v_item.price * v_item.quantity, 0, 0, v_item.price * v_item.quantity
    );
  end loop;

  if v_coupon.id is not null then
    insert into public.coupon_redemptions(coupon_id, user_id, order_id, discount_amount)
    values (v_coupon.id, v_user_id, v_order.id, v_coupon_discount);
    update public.coupons set used_count = coalesce(used_count, 0) + 1 where id = v_coupon.id;
  end if;

  if v_hp_discount > 0 then
    update public.user_rewards
    set hp_balance = greatest(0, hp_balance - v_hp_discount::integer), updated_at = now()
    where user_id = v_user_id;

    update public.profiles
    set hp = greatest(0, hp - v_hp_discount::integer), updated_at = now()
    where id = v_user_id;

    insert into public.hp_ledger(user_id, type, amount, reason, reference_type, reference_id)
    values (v_user_id, 'spend', -v_hp_discount::integer, 'Sipariş HP indirim hakkı', 'order', v_order.id);
  end if;

  update public.carts set status = 'completed', updated_at = now() where id = v_cart.id;

  return jsonb_build_object(
    'id', v_order.id,
    'order_no', v_order.order_no,
    'order_number', v_order.order_number,
    'subtotal', v_subtotal,
    'coupon_discount', v_coupon_discount,
    'hp_discount', v_hp_discount,
    'discount_total', v_discount_total,
    'shipping_total', v_shipping,
    'grand_total', v_grand_total,
    'total', v_grand_total,
    'payment_status', v_order.payment_status,
    'order_status', v_order.order_status,
    'status', v_order.status
  );
end;
$$;

grant execute on function public.get_or_create_active_cart() to authenticated;
grant execute on function public.get_active_cart() to authenticated;
grant execute on function public.add_cart_item(uuid, integer) to authenticated;
grant execute on function public.set_cart_item_quantity(uuid, integer) to authenticated;
grant execute on function public.clear_active_cart() to authenticated;
grant execute on function public.create_transaction_order(uuid, text, integer) to authenticated;
