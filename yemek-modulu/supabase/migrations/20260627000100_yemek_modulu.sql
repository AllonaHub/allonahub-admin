create extension if not exists pgcrypto;

do $$
begin
  create type public.food_partner_status as enum ('pending', 'active', 'suspended', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.food_product_status as enum (
    'draft',
    'pending_review',
    'rejected',
    'approved',
    'active',
    'paused',
    'sold_out',
    'archived'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.food_stock_status as enum ('in_stock', 'low_stock', 'sold_out', 'hidden');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.food_image_match_status as enum ('unchecked', 'approved', 'needs_review', 'rejected');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.food_order_status as enum (
    'draft',
    'pending_payment',
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'awaiting_courier',
    'courier_assigned',
    'picked_up',
    'delivered',
    'canceled',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.food_delivery_handoff_status as enum (
    'pending',
    'quote_requested',
    'ready_for_assignment',
    'assigned',
    'picked_up',
    'delivered',
    'canceled',
    'failed'
  );
exception when duplicate_object then null;
end $$;

create or replace function public.food_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.food_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin', 'ops'),
    false
  );
$$;

create table if not exists public.food_module_setups (
  id uuid primary key default gen_random_uuid(),
  setup_key text not null unique,
  title text not null,
  status text not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_module_setups_status_check check (status in ('draft', 'active', 'archived'))
);

create table if not exists public.food_partners (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  slug text not null unique,
  legal_name text,
  status public.food_partner_status not null default 'pending',
  cuisine_tags text[] not null default '{}'::text[],
  service_modes text[] not null default array['delivery']::text[],
  opening_hours jsonb not null default '{}'::jsonb,
  pickup_location jsonb not null default '{}'::jsonb,
  delivery_radius_meters integer not null default 5000,
  min_order_amount numeric(12, 2) not null default 0,
  commission_rate numeric(5, 2) not null default 0,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_partners_delivery_radius_check check (delivery_radius_meters >= 0),
  constraint food_partners_min_order_check check (min_order_amount >= 0)
);

create table if not exists public.food_partner_memberships (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.food_partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'partner_editor',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, user_id),
  constraint food_partner_memberships_role_check check (
    role in ('partner_owner', 'partner_admin', 'partner_editor', 'report_viewer', 'readonly')
  ),
  constraint food_partner_memberships_status_check check (status in ('invited', 'active', 'suspended', 'removed'))
);

create or replace function public.food_is_partner_member(target_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.food_partner_memberships member
    where member.partner_id = target_partner_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  );
$$;

create table if not exists public.food_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_menus (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.food_partners(id) on delete cascade,
  title text not null,
  status text not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_menus_status_check check (status in ('draft', 'active', 'paused', 'archived'))
);

create table if not exists public.food_menu_sections (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.food_menus(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_products (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.food_partners(id) on delete cascade,
  category_id uuid references public.food_categories(id) on delete set null,
  menu_section_id uuid references public.food_menu_sections(id) on delete set null,
  name text not null,
  slug text not null,
  description text not null,
  price numeric(12, 2) not null,
  compare_at_price numeric(12, 2),
  currency char(3) not null default 'TRY',
  vat_rate numeric(5, 2) not null default 10,
  status public.food_product_status not null default 'draft',
  stock_status public.food_stock_status not null default 'in_stock',
  stock_quantity integer,
  prep_time_minutes integer not null default 20,
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  image_url text,
  image_alt text,
  image_match_status public.food_image_match_status not null default 'unchecked',
  image_review_note text,
  ingredients text[] not null default '{}'::text[],
  allergens text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  nutrition jsonb not null default '{}'::jsonb,
  is_featured boolean not null default false,
  courier_required boolean not null default true,
  pickup_only boolean not null default false,
  max_delivery_distance_meters integer,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, slug),
  constraint food_products_price_check check (price >= 0),
  constraint food_products_compare_price_check check (compare_at_price is null or compare_at_price >= price),
  constraint food_products_stock_quantity_check check (stock_quantity is null or stock_quantity >= 0),
  constraint food_products_prep_time_check check (prep_time_minutes > 0),
  constraint food_products_delivery_mode_check check (courier_required or pickup_only)
);

create table if not exists public.food_product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.food_products(id) on delete cascade,
  url text not null,
  storage_path text,
  kind text not null default 'image',
  alt_text text not null,
  image_match_status public.food_image_match_status not null default 'unchecked',
  review_note text,
  sort_order integer not null default 0,
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_product_media_kind_check check (kind in ('image', 'gallery', 'thumbnail'))
);

create table if not exists public.food_user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.food_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.food_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.food_products(id) on delete cascade,
  name text not null,
  price_delta numeric(12, 2) not null default 0,
  stock_status public.food_stock_status not null default 'in_stock',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.food_products(id) on delete cascade,
  title text not null,
  min_select integer not null default 0,
  max_select integer not null default 1,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_option_group_select_check check (min_select >= 0 and max_select >= min_select)
);

create table if not exists public.food_product_options (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.food_product_option_groups(id) on delete cascade,
  title text not null,
  price_delta numeric(12, 2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  partner_id uuid not null references public.food_partners(id) on delete restrict,
  status public.food_order_status not null default 'draft',
  payment_status text not null default 'unpaid',
  currency char(3) not null default 'TRY',
  subtotal numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  service_fee numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  delivery_address jsonb not null default '{}'::jsonb,
  pickup_location jsonb not null default '{}'::jsonb,
  dropoff_location jsonb not null default '{}'::jsonb,
  delivery_note text,
  requested_delivery_at timestamptz,
  ready_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_orders_amounts_check check (
    subtotal >= 0 and discount_total >= 0 and delivery_fee >= 0 and service_fee >= 0 and total >= 0
  ),
  constraint food_orders_payment_status_check check (
    payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'cash_on_delivery')
  )
);

create table if not exists public.food_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.food_orders(id) on delete cascade,
  product_id uuid references public.food_products(id) on delete set null,
  product_name text not null,
  product_snapshot jsonb not null default '{}'::jsonb,
  quantity integer not null,
  unit_price numeric(12, 2) not null,
  total_price numeric(12, 2) not null,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint food_order_items_quantity_check check (quantity > 0),
  constraint food_order_items_price_check check (unit_price >= 0 and total_price >= 0)
);

create table if not exists public.food_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.food_orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  from_status public.food_order_status,
  to_status public.food_order_status,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.food_delivery_handoffs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.food_orders(id) on delete cascade,
  partner_id uuid not null references public.food_partners(id) on delete restrict,
  status public.food_delivery_handoff_status not null default 'pending',
  provider text,
  courier_module_ref text,
  pickup_location jsonb not null default '{}'::jsonb,
  dropoff_location jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  quote_amount numeric(12, 2),
  currency char(3) not null default 'TRY',
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_delivery_events (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references public.food_delivery_handoffs(id) on delete cascade,
  event_name text not null,
  from_status public.food_delivery_handoff_status,
  to_status public.food_delivery_handoff_status,
  provider_event_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.food_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  partner_id uuid references public.food_partners(id) on delete set null,
  entity_table text not null,
  entity_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now(),
  constraint food_audit_logs_entity_check check (entity_table like 'food_%')
);

create index if not exists food_products_partner_status_idx on public.food_products(partner_id, status);
create index if not exists food_products_category_status_idx on public.food_products(category_id, status);
create index if not exists food_products_slug_idx on public.food_products(slug);
create unique index if not exists food_product_media_product_url_idx on public.food_product_media(product_id, url);
create index if not exists food_user_favorites_user_idx on public.food_user_favorites(user_id, created_at desc);
create index if not exists food_orders_user_idx on public.food_orders(user_id, created_at desc);
create index if not exists food_orders_partner_status_idx on public.food_orders(partner_id, status, created_at desc);
create index if not exists food_delivery_handoffs_partner_status_idx on public.food_delivery_handoffs(partner_id, status);

drop trigger if exists food_module_setups_touch_updated_at on public.food_module_setups;
create trigger food_module_setups_touch_updated_at
before update on public.food_module_setups
for each row execute function public.food_touch_updated_at();

drop trigger if exists food_partners_touch_updated_at on public.food_partners;
create trigger food_partners_touch_updated_at
before update on public.food_partners
for each row execute function public.food_touch_updated_at();

drop trigger if exists food_partner_memberships_touch_updated_at on public.food_partner_memberships;
create trigger food_partner_memberships_touch_updated_at
before update on public.food_partner_memberships
for each row execute function public.food_touch_updated_at();

drop trigger if exists food_categories_touch_updated_at on public.food_categories;
create trigger food_categories_touch_updated_at
before update on public.food_categories
for each row execute function public.food_touch_updated_at();

drop trigger if exists food_menus_touch_updated_at on public.food_menus;
create trigger food_menus_touch_updated_at
before update on public.food_menus
for each row execute function public.food_touch_updated_at();

drop trigger if exists food_menu_sections_touch_updated_at on public.food_menu_sections;
create trigger food_menu_sections_touch_updated_at
before update on public.food_menu_sections
for each row execute function public.food_touch_updated_at();

drop trigger if exists food_products_touch_updated_at on public.food_products;
create trigger food_products_touch_updated_at
before update on public.food_products
for each row execute function public.food_touch_updated_at();

drop trigger if exists food_product_media_touch_updated_at on public.food_product_media;
create trigger food_product_media_touch_updated_at
before update on public.food_product_media
for each row execute function public.food_touch_updated_at();

drop trigger if exists food_orders_touch_updated_at on public.food_orders;
create trigger food_orders_touch_updated_at
before update on public.food_orders
for each row execute function public.food_touch_updated_at();

drop trigger if exists food_delivery_handoffs_touch_updated_at on public.food_delivery_handoffs;
create trigger food_delivery_handoffs_touch_updated_at
before update on public.food_delivery_handoffs
for each row execute function public.food_touch_updated_at();

create or replace function public.food_product_missing_sale_fields(target_product_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_remove(array[
    case when p.partner_id is null then 'partner_id' end,
    case when p.category_id is null then 'category_id' end,
    case when nullif(trim(p.name), '') is null then 'name' end,
    case when nullif(trim(p.slug), '') is null then 'slug' end,
    case when length(trim(p.description)) < 20 then 'description' end,
    case when p.price <= 0 then 'price' end,
    case when p.currency is null then 'currency' end,
    case when p.stock_status in ('sold_out', 'hidden') then 'sellable_stock' end,
    case when p.prep_time_minutes <= 0 then 'prep_time_minutes' end,
    case when coalesce(array_length(p.ingredients, 1), 0) = 0 then 'ingredients' end,
    case when p.allergens is null then 'allergens' end,
    case when p.image_match_status <> 'approved' then 'image_match_status' end,
    case when p.image_url is null and not exists (
      select 1 from public.food_product_media media
      where media.product_id = p.id
        and media.image_match_status = 'approved'
    ) then 'image' end,
    case when p.status not in ('approved', 'active') then 'approval_status' end
  ], null), '{}'::text[])
  from public.food_products p
  where p.id = target_product_id;
$$;

create or replace function public.food_activate_product(target_product_id uuid)
returns public.food_products
language plpgsql
security definer
set search_path = public
as $$
declare
  missing_fields text[];
  activated_product public.food_products;
begin
  if not public.food_is_admin() then
    raise exception 'food_activate_product sadece admin rolüyle çalışır';
  end if;

  select public.food_product_missing_sale_fields(target_product_id) into missing_fields;

  if missing_fields is null then
    raise exception 'Ürün bulunamadı: %', target_product_id;
  end if;

  if coalesce(array_length(missing_fields, 1), 0) > 0 then
    raise exception 'Ürün satışa hazır değil'
      using detail = array_to_string(missing_fields, ', ');
  end if;

  update public.food_products
  set status = 'active',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = target_product_id
  returning * into activated_product;

  return activated_product;
end;
$$;

create or replace function public.food_log_product_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.food_audit_logs (
      actor_user_id,
      partner_id,
      entity_table,
      entity_id,
      action,
      old_data,
      new_data
    )
    values (
      auth.uid(),
      new.partner_id,
      'food_products',
      new.id,
      'status_changed',
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists food_products_log_status_change on public.food_products;
create trigger food_products_log_status_change
after update on public.food_products
for each row execute function public.food_log_product_status_change();

create or replace view public.food_public_products
with (security_invoker = true)
as
select
  p.id,
  p.partner_id,
  partner.name as partner_name,
  p.category_id,
  category.name as category_name,
  category.slug as category_slug,
  p.name,
  p.slug,
  p.description,
  p.price,
  p.currency,
  p.status,
  p.stock_status,
  p.prep_time_minutes,
  p.image_url,
  p.image_alt,
  p.ingredients,
  p.allergens,
  p.tags,
  p.is_featured,
  p.courier_required,
  p.pickup_only,
  p.max_delivery_distance_meters,
  p.updated_at
from public.food_products p
join public.food_partners partner on partner.id = p.partner_id
left join public.food_categories category on category.id = p.category_id
where p.status = 'active'
  and p.stock_status in ('in_stock', 'low_stock')
  and p.image_match_status = 'approved'
  and partner.status = 'active'
  and (p.sale_starts_at is null or p.sale_starts_at <= now())
  and (p.sale_ends_at is null or p.sale_ends_at > now());

alter table public.food_module_setups enable row level security;
alter table public.food_partners enable row level security;
alter table public.food_partner_memberships enable row level security;
alter table public.food_categories enable row level security;
alter table public.food_menus enable row level security;
alter table public.food_menu_sections enable row level security;
alter table public.food_products enable row level security;
alter table public.food_product_media enable row level security;
alter table public.food_user_favorites enable row level security;
alter table public.food_product_variants enable row level security;
alter table public.food_product_option_groups enable row level security;
alter table public.food_product_options enable row level security;
alter table public.food_orders enable row level security;
alter table public.food_order_items enable row level security;
alter table public.food_order_events enable row level security;
alter table public.food_delivery_handoffs enable row level security;
alter table public.food_delivery_events enable row level security;
alter table public.food_audit_logs enable row level security;

drop policy if exists "Food module setups admin read" on public.food_module_setups;
create policy "Food module setups admin read"
on public.food_module_setups for select
using (public.food_is_admin());

drop policy if exists "Food partners public active read" on public.food_partners;
create policy "Food partners public active read"
on public.food_partners for select
using (status = 'active' or public.food_is_admin() or public.food_is_partner_member(id));

drop policy if exists "Food partners admin write" on public.food_partners;
create policy "Food partners admin write"
on public.food_partners for all
using (public.food_is_admin())
with check (public.food_is_admin());

drop policy if exists "Food partner memberships scoped read" on public.food_partner_memberships;
create policy "Food partner memberships scoped read"
on public.food_partner_memberships for select
using (public.food_is_admin() or user_id = auth.uid() or public.food_is_partner_member(partner_id));

drop policy if exists "Food partner memberships admin write" on public.food_partner_memberships;
create policy "Food partner memberships admin write"
on public.food_partner_memberships for all
using (public.food_is_admin())
with check (public.food_is_admin());

drop policy if exists "Food categories public active read" on public.food_categories;
create policy "Food categories public active read"
on public.food_categories for select
using (is_active or public.food_is_admin());

drop policy if exists "Food categories admin write" on public.food_categories;
create policy "Food categories admin write"
on public.food_categories for all
using (public.food_is_admin())
with check (public.food_is_admin());

drop policy if exists "Food menus scoped read" on public.food_menus;
create policy "Food menus scoped read"
on public.food_menus for select
using (
  public.food_is_admin()
  or public.food_is_partner_member(partner_id)
  or status = 'active'
);

drop policy if exists "Food menus partner write" on public.food_menus;
create policy "Food menus partner write"
on public.food_menus for all
using (public.food_is_admin() or public.food_is_partner_member(partner_id))
with check (public.food_is_admin() or public.food_is_partner_member(partner_id));

drop policy if exists "Food menu sections scoped read" on public.food_menu_sections;
create policy "Food menu sections scoped read"
on public.food_menu_sections for select
using (
  public.food_is_admin()
  or exists (
    select 1
    from public.food_menus menu
    where menu.id = food_menu_sections.menu_id
      and (menu.status = 'active' or public.food_is_partner_member(menu.partner_id))
  )
);

drop policy if exists "Food menu sections partner write" on public.food_menu_sections;
create policy "Food menu sections partner write"
on public.food_menu_sections for all
using (
  public.food_is_admin()
  or exists (
    select 1
    from public.food_menus menu
    where menu.id = food_menu_sections.menu_id
      and public.food_is_partner_member(menu.partner_id)
  )
)
with check (
  public.food_is_admin()
  or exists (
    select 1
    from public.food_menus menu
    where menu.id = food_menu_sections.menu_id
      and public.food_is_partner_member(menu.partner_id)
  )
);

drop policy if exists "Food products scoped read" on public.food_products;
create policy "Food products scoped read"
on public.food_products for select
using (
  public.food_is_admin()
  or public.food_is_partner_member(partner_id)
  or (
    status = 'active'
    and stock_status in ('in_stock', 'low_stock')
    and image_match_status = 'approved'
    and (sale_starts_at is null or sale_starts_at <= now())
    and (sale_ends_at is null or sale_ends_at > now())
  )
);

drop policy if exists "Food products partner insert" on public.food_products;
create policy "Food products partner insert"
on public.food_products for insert
with check (
  public.food_is_admin()
  or (
    public.food_is_partner_member(partner_id)
    and status in ('draft', 'pending_review')
  )
);

drop policy if exists "Food products partner update" on public.food_products;
create policy "Food products partner update"
on public.food_products for update
using (public.food_is_admin() or public.food_is_partner_member(partner_id))
with check (
  public.food_is_admin()
  or (
    public.food_is_partner_member(partner_id)
    and status in ('draft', 'pending_review', 'paused', 'sold_out', 'archived')
  )
);

drop policy if exists "Food product media scoped read" on public.food_product_media;
create policy "Food product media scoped read"
on public.food_product_media for select
using (
  public.food_is_admin()
  or exists (
    select 1
    from public.food_products product
    where product.id = food_product_media.product_id
      and (
        public.food_is_partner_member(product.partner_id)
        or (
          product.status = 'active'
          and product.image_match_status = 'approved'
        )
      )
  )
);

drop policy if exists "Food product media partner write" on public.food_product_media;
create policy "Food product media partner write"
on public.food_product_media for all
using (
  public.food_is_admin()
  or exists (
    select 1
    from public.food_products product
    where product.id = food_product_media.product_id
      and public.food_is_partner_member(product.partner_id)
  )
)
with check (
  public.food_is_admin()
  or exists (
    select 1
    from public.food_products product
    where product.id = food_product_media.product_id
      and public.food_is_partner_member(product.partner_id)
  )
);

drop policy if exists "Food user favorites own read" on public.food_user_favorites;
create policy "Food user favorites own read"
on public.food_user_favorites for select
using (public.food_is_admin() or user_id = auth.uid());

drop policy if exists "Food user favorites own write" on public.food_user_favorites;
create policy "Food user favorites own write"
on public.food_user_favorites for all
using (public.food_is_admin() or user_id = auth.uid())
with check (public.food_is_admin() or user_id = auth.uid());

drop policy if exists "Food product child scoped read" on public.food_product_variants;
create policy "Food product child scoped read"
on public.food_product_variants for select
using (
  public.food_is_admin()
  or exists (
    select 1 from public.food_products product
    where product.id = food_product_variants.product_id
      and (public.food_is_partner_member(product.partner_id) or product.status = 'active')
  )
);

drop policy if exists "Food product variants partner write" on public.food_product_variants;
create policy "Food product variants partner write"
on public.food_product_variants for all
using (
  public.food_is_admin()
  or exists (
    select 1 from public.food_products product
    where product.id = food_product_variants.product_id
      and public.food_is_partner_member(product.partner_id)
  )
)
with check (
  public.food_is_admin()
  or exists (
    select 1 from public.food_products product
    where product.id = food_product_variants.product_id
      and public.food_is_partner_member(product.partner_id)
  )
);

drop policy if exists "Food option groups scoped read" on public.food_product_option_groups;
create policy "Food option groups scoped read"
on public.food_product_option_groups for select
using (
  public.food_is_admin()
  or exists (
    select 1 from public.food_products product
    where product.id = food_product_option_groups.product_id
      and (public.food_is_partner_member(product.partner_id) or product.status = 'active')
  )
);

drop policy if exists "Food option groups partner write" on public.food_product_option_groups;
create policy "Food option groups partner write"
on public.food_product_option_groups for all
using (
  public.food_is_admin()
  or exists (
    select 1 from public.food_products product
    where product.id = food_product_option_groups.product_id
      and public.food_is_partner_member(product.partner_id)
  )
)
with check (
  public.food_is_admin()
  or exists (
    select 1 from public.food_products product
    where product.id = food_product_option_groups.product_id
      and public.food_is_partner_member(product.partner_id)
  )
);

drop policy if exists "Food product options scoped read" on public.food_product_options;
create policy "Food product options scoped read"
on public.food_product_options for select
using (
  public.food_is_admin()
  or exists (
    select 1
    from public.food_product_option_groups option_group
    join public.food_products product on product.id = option_group.product_id
    where option_group.id = food_product_options.option_group_id
      and (public.food_is_partner_member(product.partner_id) or product.status = 'active')
  )
);

drop policy if exists "Food product options partner write" on public.food_product_options;
create policy "Food product options partner write"
on public.food_product_options for all
using (
  public.food_is_admin()
  or exists (
    select 1
    from public.food_product_option_groups option_group
    join public.food_products product on product.id = option_group.product_id
    where option_group.id = food_product_options.option_group_id
      and public.food_is_partner_member(product.partner_id)
  )
)
with check (
  public.food_is_admin()
  or exists (
    select 1
    from public.food_product_option_groups option_group
    join public.food_products product on product.id = option_group.product_id
    where option_group.id = food_product_options.option_group_id
      and public.food_is_partner_member(product.partner_id)
  )
);

drop policy if exists "Food orders scoped read" on public.food_orders;
create policy "Food orders scoped read"
on public.food_orders for select
using (public.food_is_admin() or user_id = auth.uid() or public.food_is_partner_member(partner_id));

drop policy if exists "Food orders user insert" on public.food_orders;
create policy "Food orders user insert"
on public.food_orders for insert
with check (public.food_is_admin() or user_id = auth.uid());

drop policy if exists "Food orders scoped update" on public.food_orders;
create policy "Food orders scoped update"
on public.food_orders for update
using (public.food_is_admin() or user_id = auth.uid() or public.food_is_partner_member(partner_id))
with check (public.food_is_admin() or user_id = auth.uid() or public.food_is_partner_member(partner_id));

drop policy if exists "Food order items scoped read" on public.food_order_items;
create policy "Food order items scoped read"
on public.food_order_items for select
using (
  public.food_is_admin()
  or exists (
    select 1 from public.food_orders food_order
    where food_order.id = food_order_items.order_id
      and (food_order.user_id = auth.uid() or public.food_is_partner_member(food_order.partner_id))
  )
);

drop policy if exists "Food order items user insert" on public.food_order_items;
create policy "Food order items user insert"
on public.food_order_items for insert
with check (
  public.food_is_admin()
  or exists (
    select 1 from public.food_orders food_order
    where food_order.id = food_order_items.order_id
      and food_order.user_id = auth.uid()
  )
);

drop policy if exists "Food order events scoped read" on public.food_order_events;
create policy "Food order events scoped read"
on public.food_order_events for select
using (
  public.food_is_admin()
  or exists (
    select 1 from public.food_orders food_order
    where food_order.id = food_order_events.order_id
      and (food_order.user_id = auth.uid() or public.food_is_partner_member(food_order.partner_id))
  )
);

drop policy if exists "Food order events scoped insert" on public.food_order_events;
create policy "Food order events scoped insert"
on public.food_order_events for insert
with check (
  public.food_is_admin()
  or exists (
    select 1 from public.food_orders food_order
    where food_order.id = food_order_events.order_id
      and (food_order.user_id = auth.uid() or public.food_is_partner_member(food_order.partner_id))
  )
);

drop policy if exists "Food delivery handoffs scoped read" on public.food_delivery_handoffs;
create policy "Food delivery handoffs scoped read"
on public.food_delivery_handoffs for select
using (
  public.food_is_admin()
  or public.food_is_partner_member(partner_id)
  or exists (
    select 1 from public.food_orders food_order
    where food_order.id = food_delivery_handoffs.order_id
      and food_order.user_id = auth.uid()
  )
);

drop policy if exists "Food delivery handoffs scoped write" on public.food_delivery_handoffs;
create policy "Food delivery handoffs scoped write"
on public.food_delivery_handoffs for all
using (public.food_is_admin() or public.food_is_partner_member(partner_id))
with check (public.food_is_admin() or public.food_is_partner_member(partner_id));

drop policy if exists "Food delivery events scoped read" on public.food_delivery_events;
create policy "Food delivery events scoped read"
on public.food_delivery_events for select
using (
  public.food_is_admin()
  or exists (
    select 1
    from public.food_delivery_handoffs handoff
    join public.food_orders food_order on food_order.id = handoff.order_id
    where handoff.id = food_delivery_events.handoff_id
      and (
        public.food_is_partner_member(handoff.partner_id)
        or food_order.user_id = auth.uid()
      )
  )
);

drop policy if exists "Food delivery events scoped insert" on public.food_delivery_events;
create policy "Food delivery events scoped insert"
on public.food_delivery_events for insert
with check (
  public.food_is_admin()
  or exists (
    select 1
    from public.food_delivery_handoffs handoff
    where handoff.id = food_delivery_events.handoff_id
      and public.food_is_partner_member(handoff.partner_id)
  )
);

drop policy if exists "Food audit logs scoped read" on public.food_audit_logs;
create policy "Food audit logs scoped read"
on public.food_audit_logs for select
using (public.food_is_admin() or public.food_is_partner_member(partner_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'food-product-images',
  'food-product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Food product images public read" on storage.objects;
create policy "Food product images public read"
on storage.objects for select
using (bucket_id = 'food-product-images');

drop policy if exists "Food product images authenticated upload" on storage.objects;
create policy "Food product images authenticated upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'food-product-images');

drop policy if exists "Food product images authenticated update" on storage.objects;
create policy "Food product images authenticated update"
on storage.objects for update
to authenticated
using (bucket_id = 'food-product-images')
with check (bucket_id = 'food-product-images');
