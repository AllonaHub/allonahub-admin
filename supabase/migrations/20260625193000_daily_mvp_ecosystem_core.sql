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

create or replace function public.mvp_raise_if_not_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin authorization required';
  end if;
end;
$$;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  partner_name text,
  display_name text,
  email text,
  phone text,
  city text,
  country text,
  partner_type text default 'shop',
  status text not null default 'pending',
  score integer not null default 70,
  verification_status text not null default 'pending',
  onboarding_step text not null default 'application',
  business_type text,
  tax_number text,
  tax_office text,
  company_title text,
  iban text,
  authorized_person_name text,
  authorized_person_phone text,
  authorized_person_email text,
  commission_profile_id uuid,
  risk_level text not null default 'normal',
  admin_note text,
  preferred_cargo_company text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partners
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists partner_name text,
  add column if not exists display_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists partner_type text default 'shop',
  add column if not exists status text not null default 'pending',
  add column if not exists score integer not null default 70,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists onboarding_step text not null default 'application',
  add column if not exists business_type text,
  add column if not exists tax_number text,
  add column if not exists tax_office text,
  add column if not exists company_title text,
  add column if not exists iban text,
  add column if not exists authorized_person_name text,
  add column if not exists authorized_person_phone text,
  add column if not exists authorized_person_email text,
  add column if not exists commission_profile_id uuid,
  add column if not exists risk_level text not null default 'normal',
  add column if not exists admin_note text,
  add column if not exists preferred_cargo_company text,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists partners_email_key
  on public.partners(lower(email))
  where email is not null;
create unique index if not exists partners_email_raw_key
  on public.partners(email)
  where email is not null;
create index if not exists partners_owner_idx on public.partners(owner_id, status, created_at desc);
create index if not exists partners_verification_idx on public.partners(verification_status, risk_level, created_at desc);

drop trigger if exists partners_set_updated_at on public.partners;
create trigger partners_set_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

create table if not exists public.commission_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  module text not null default 'shop',
  commission_rate numeric(7,4) not null default 0,
  payment_fee_rate numeric(7,4) not null default 0,
  fixed_service_fee numeric(12,2) not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists commission_profiles_one_default_per_module
  on public.commission_profiles(module)
  where is_default and is_active;

insert into public.commission_profiles (name, module, commission_rate, payment_fee_rate, fixed_service_fee, is_default)
values
  ('Shop Standart', 'shop', 10, 0, 0, true),
  ('Yeni Partner Ilk 30 Gun', 'shop', 5, 0, 0, false),
  ('Premium Partner', 'shop', 8, 0, 0, false),
  ('Stratejik Partner Ozel Oran', 'shop', 0, 0, 0, false)
on conflict do nothing;

alter table public.partners
  drop constraint if exists partners_commission_profile_id_fkey;
alter table public.partners
  add constraint partners_commission_profile_id_fkey
  foreign key (commission_profile_id) references public.commission_profiles(id) on delete set null
  not valid;

create table if not exists public.partner_verification_logs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id) on delete cascade,
  action text not null,
  old_status text,
  new_status text,
  admin_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists partner_verification_logs_partner_idx
  on public.partner_verification_logs(partner_id, created_at desc);

create or replace function public.log_partner_verification_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.verification_status is distinct from old.verification_status then
    insert into public.partner_verification_logs(partner_id, action, old_status, new_status, admin_id, note)
    values (
      new.id,
      case
        when new.verification_status = 'info_required' then 'info_requested'
        when new.verification_status = 'approved' then 'approved'
        when new.verification_status = 'rejected' then 'rejected'
        when new.verification_status = 'suspended' then 'suspended'
        when old.verification_status = 'suspended' and new.verification_status in ('pending', 'under_review', 'approved') then 'reactivated'
        else 'status_changed'
      end,
      old.verification_status,
      new.verification_status,
      auth.uid(),
      new.admin_note
    );
  end if;
  return new;
end;
$$;

drop trigger if exists partners_log_verification_change on public.partners;
create trigger partners_log_verification_change
  after update of verification_status on public.partners
  for each row execute function public.log_partner_verification_change();

create or replace function public.partner_owns(target_partner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin()
    or target_partner_id = auth.uid()
    or exists (
      select 1 from public.partners p
      where p.id = target_partner_id
        and (p.owner_id = auth.uid() or p.user_id = auth.uid())
    )
    or exists (
      select 1 from public.partner_businesses pb
      where pb.id = target_partner_id
        and pb.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.partner_staff ps
      where ps.partner_id = target_partner_id
        and ps.user_id = auth.uid()
        and ps.status = 'active'
    );
$$;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  module text not null default 'shop',
  icon text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.product_categories(name, slug, module, icon, sort_order)
values
  ('Elektronik', 'elektronik', 'shop', 'cpu', 10),
  ('Ev & Yasam', 'ev-yasam', 'shop', 'home', 20),
  ('Moda', 'moda', 'shop', 'shirt', 30),
  ('Kozmetik', 'kozmetik', 'shop', 'sparkles', 40),
  ('Anne & Bebek', 'anne-bebek', 'shop', 'baby', 50),
  ('Spor & Outdoor', 'spor-outdoor', 'shop', 'dumbbell', 60),
  ('Pet Shop', 'pet-shop', 'shop', 'paw', 70),
  ('Supermarket', 'supermarket', 'market', 'shopping-basket', 80),
  ('Kitap & Kirtasiye', 'kitap-kirtasiye', 'shop', 'book-open', 90),
  ('Otomotiv Aksesuar', 'otomotiv-aksesuar', 'automotive', 'car', 100)
on conflict (slug) do update
set name = excluded.name,
    module = excluded.module,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    is_active = true;

alter table public.products
  add column if not exists approval_status text not null default 'draft',
  add column if not exists quality_score integer not null default 0,
  add column if not exists rejection_reason text,
  add column if not exists revision_note text,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists is_featured boolean not null default false,
  add column if not exists is_sponsored boolean not null default false,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists search_keywords text[] not null default array[]::text[],
  add column if not exists product_badges text[] not null default array[]::text[],
  add column if not exists category_id uuid references public.product_categories(id) on delete set null,
  add column if not exists sku text,
  add column if not exists barcode text,
  add column if not exists shipping_info text,
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists view_count integer not null default 0,
  add column if not exists favorite_count integer not null default 0,
  add column if not exists order_count integer not null default 0,
  add column if not exists ranking_score numeric(12,4) not null default 0,
  add column if not exists admin_boost numeric(8,2) not null default 0;

update public.products
set approval_status = case
      when status::text = 'active' and approval_status in ('draft', '') then 'approved'
      else approval_status
    end,
    published_at = case when status::text = 'active' and published_at is null then coalesce(updated_at, created_at, now()) else published_at end,
    seo_title = coalesce(seo_title, meta_title, name),
    seo_description = coalesce(seo_description, meta_description, description);

create index if not exists products_approval_idx
  on public.products(approval_status, is_featured desc, is_sponsored desc, ranking_score desc, created_at desc);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_ranking_idx on public.products(module_key, approval_status, ranking_score desc);

create or replace function public.calculate_product_quality_score(
  p_name text,
  p_description text,
  p_image_url text,
  p_images jsonb,
  p_price numeric,
  p_category text,
  p_category_id uuid,
  p_stock integer,
  p_sku text,
  p_barcode text,
  p_shipping_info text,
  p_seo_description text
)
returns integer
language plpgsql
immutable
as $$
declare
  v_score integer := 0;
  v_images_count integer := 0;
begin
  if jsonb_typeof(coalesce(p_images, '[]'::jsonb)) = 'array' then
    v_images_count := jsonb_array_length(coalesce(p_images, '[]'::jsonb));
  end if;

  if length(trim(coalesce(p_name, ''))) > 10 then v_score := v_score + 10; end if;
  if length(trim(coalesce(p_description, ''))) > 100 then v_score := v_score + 15; end if;
  if nullif(trim(coalesce(p_image_url, '')), '') is not null or v_images_count > 0 then v_score := v_score + 20; end if;
  if coalesce(p_price, 0) > 0 then v_score := v_score + 15; end if;
  if p_category_id is not null or nullif(trim(coalesce(p_category, '')), '') is not null then v_score := v_score + 10; end if;
  if coalesce(p_stock, 0) >= 0 then v_score := v_score + 10; end if;
  if nullif(trim(coalesce(p_sku, '')), '') is not null or nullif(trim(coalesce(p_barcode, '')), '') is not null then v_score := v_score + 10; end if;
  if nullif(trim(coalesce(p_shipping_info, '')), '') is not null then v_score := v_score + 5; end if;
  if nullif(trim(coalesce(p_seo_description, '')), '') is not null then v_score := v_score + 5; end if;
  return least(100, v_score);
end;
$$;

create or replace function public.products_quality_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.quality_score := public.calculate_product_quality_score(
    new.name,
    new.description,
    new.image_url,
    new.images,
    new.price,
    new.category,
    new.category_id,
    new.stock,
    new.sku,
    new.barcode,
    new.shipping_info,
    new.seo_description
  );

  new.ranking_score := greatest(0,
    case when new.approval_status = 'approved' then 40 else 0 end
    + least(25, new.quality_score / 4.0)
    + case when coalesce(new.stock, 0) > 0 then 8 else -10 end
    + least(10, coalesce(new.favorite_count, 0) / 5.0)
    + least(8, coalesce(new.view_count, 0) / 20.0)
    + least(8, coalesce(new.order_count, 0) / 3.0)
    + case when new.is_sponsored then 8 else 0 end
    + coalesce(new.admin_boost, 0)
  );

  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.approval_status := 'draft';
      new.approved_by := null;
      new.approved_at := null;
      new.rejected_at := null;
      new.published_at := null;
      new.is_featured := false;
      new.is_sponsored := false;
      new.rejection_reason := null;
    elsif tg_op = 'UPDATE' then
      if new.approval_status is distinct from old.approval_status then
        if not (
          old.approval_status in ('draft', 'revision_required')
          and new.approval_status = 'pending_review'
          and new.quality_score >= 70
        ) then
          raise exception 'Product approval status is admin controlled';
        end if;
      end if;

      if new.approved_by is distinct from old.approved_by
        or new.approved_at is distinct from old.approved_at
        or new.rejected_at is distinct from old.rejected_at
        or new.published_at is distinct from old.published_at
        or new.is_featured is distinct from old.is_featured
        or new.is_sponsored is distinct from old.is_sponsored
        or new.rejection_reason is distinct from old.rejection_reason
      then
        raise exception 'Product review fields are admin controlled';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists products_quality_guard on public.products;
create trigger products_quality_guard
  before insert or update on public.products
  for each row execute function public.products_quality_guard();

create or replace function public.submit_product_for_review(p_product_id uuid)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and (partner_id = auth.uid() or public.is_admin())
  for update;

  if not found then raise exception 'Product not found'; end if;
  if v_product.quality_score < 70 then
    raise exception 'Quality score must be at least 70';
  end if;

  update public.products
  set approval_status = 'pending_review',
      revision_note = null,
      rejected_at = null,
      rejection_reason = null,
      updated_at = now()
  where id = p_product_id
  returning * into v_product;

  return v_product;
end;
$$;

create or replace function public.review_product_quality(
  p_product_id uuid,
  p_decision text,
  p_note text default null
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
begin
  perform public.mvp_raise_if_not_admin();

  if p_decision not in ('approved', 'revision_required', 'rejected', 'archived') then
    raise exception 'Invalid review decision';
  end if;

  update public.products
  set approval_status = p_decision,
      approved_by = case when p_decision = 'approved' then auth.uid() else approved_by end,
      approved_at = case when p_decision = 'approved' then now() else approved_at end,
      published_at = case when p_decision = 'approved' then now() else published_at end,
      rejected_at = case when p_decision = 'rejected' then now() else rejected_at end,
      revision_note = case when p_decision = 'revision_required' then p_note else revision_note end,
      rejection_reason = case when p_decision = 'rejected' then p_note else rejection_reason end,
      status = case when p_decision = 'approved' then 'active'::public.product_status else status end,
      updated_at = now()
  where id = p_product_id
  returning * into v_product;

  if not found then raise exception 'Product not found'; end if;
  return v_product;
end;
$$;

drop policy if exists "products_read_active_or_owner" on public.products;
create policy "products_read_active_or_owner"
  on public.products for select
  using (
    (status = 'active' and approval_status = 'approved')
    or partner_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "products_partner_update_own" on public.products;
create policy "products_partner_update_own"
  on public.products for update
  using (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()))
  with check (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()));

alter table public.addresses
  add column if not exists is_default boolean not null default false;

create unique index if not exists addresses_one_default_per_user
  on public.addresses(user_id)
  where is_default;

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

alter table public.orders
  add column if not exists risk_score integer not null default 0,
  add column if not exists risk_status text not null default 'normal',
  add column if not exists fraud_status text not null default 'normal',
  add column if not exists admin_note text,
  add column if not exists address_id uuid references public.addresses(id) on delete set null,
  add column if not exists hp_discount numeric(12,2) not null default 0,
  add column if not exists coupon_discount numeric(12,2) not null default 0,
  add column if not exists discount_total numeric(12,2) not null default 0,
  add column if not exists shipping_total numeric(12,2) not null default 0,
  add column if not exists grand_total numeric(12,2) not null default 0;

alter table public.hp_ledger
  add column if not exists status text not null default 'confirmed',
  add column if not exists expires_at timestamptz,
  add column if not exists reversed_at timestamptz,
  add column if not exists reverse_reason text;

alter table public.coupons
  add column if not exists module text not null default 'shop',
  add column if not exists partner_id uuid references public.partners(id) on delete set null,
  add column if not exists target_user_type text not null default 'all',
  add column if not exists premium_tier_required text,
  add column if not exists hp_required integer not null default 0,
  add column if not exists visibility text not null default 'public',
  add column if not exists badge_text text,
  add column if not exists priority integer not null default 0,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists min_order_total numeric(12,2) not null default 0,
  add column if not exists max_discount numeric(12,2),
  add column if not exists is_active boolean not null default true;

update public.coupons
set title = coalesce(nullif(title, ''), code),
    min_order_total = coalesce(nullif(min_order_total, 0), minimum_subtotal, 0),
    is_active = case when status::text = 'active' then true else is_active end;

create table if not exists public.home_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  section_type text not null,
  module text not null default 'all',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists home_sections_active_idx
  on public.home_sections(is_active, module, sort_order);
drop trigger if exists home_sections_set_updated_at on public.home_sections;
create trigger home_sections_set_updated_at
  before update on public.home_sections
  for each row execute function public.set_updated_at();

insert into public.home_sections(title, subtitle, section_type, module, sort_order, metadata)
values
  ('Premium Hero Alani', 'AllonaHub avantajlari ve guvenli alisveris vitrini', 'hero', 'all', 10, '{"variant":"premium"}'),
  ('Modul Kisayollari', 'AllonaHub ekosistemine hizli gecis', 'module_shortcuts', 'all', 20, '{}'),
  ('Bugunun Firsatlari', 'Onayli urunlerde gunluk secimler', 'daily_deals', 'shop', 30, '{}'),
  ('Sana Ozel Kuponlar', 'Kupon Merkezi ve indirim haklari', 'coupon_highlights', 'all', 40, '{}'),
  ('Populer Urunler', 'Yuksek kalite ve guven sinyali tasiyan urunler', 'recommended_products', 'shop', 50, '{}'),
  ('Yeni Eklenen Urunler', 'Onaydan gecen yeni katalog', 'new_arrivals', 'shop', 60, '{}'),
  ('Guvenilir Partnerler', 'Dogrulanmis partner vitrinleri', 'trusted_partners', 'all', 70, '{}'),
  ('HP/XP Gorevleri', 'Etik sadakat ve seviye ilerleme gorevleri', 'hp_tasks', 'all', 80, '{}'),
  ('Sponsorlu Vitrin', 'Etiketli sponsorlu urun ve partner alani', 'sponsored_products', 'all', 90, '{}'),
  ('Son Gezilenler / Favoriler', 'Kullanici ilgisine gore donus alani', 'recently_viewed', 'all', 100, '{}')
on conflict do nothing;

alter table public.platform_modules
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists icon text,
  add column if not exists status text not null default 'coming_soon';

update public.platform_modules
set slug = coalesce(nullif(slug, ''), module_key),
    status = case when is_active then 'active' else 'coming_soon' end,
    description = coalesce(description, name || ' modulu'),
    icon = coalesce(icon, module_key);

create unique index if not exists platform_modules_slug_key
  on public.platform_modules(slug)
  where slug is not null;

insert into public.platform_modules(module_key, slug, name, category, description, icon, status, is_visible, sort_order)
values
  ('shop', 'shop', 'Shop', 'commerce', 'Allona Shop urun pazaryeri', 'shopping-bag', 'active', true, 10),
  ('food', 'yemek', 'Yemek', 'commerce', 'Restoran ve hizli teslimat modulu', 'utensils', 'beta', true, 20),
  ('market', 'market', 'Market', 'commerce', 'Market ve gunluk ihtiyac vitrini', 'shopping-basket', 'beta', true, 30),
  ('taxi', 'taksi', 'Taksi', 'transport', 'Taksi ve ulasim talepleri', 'car', 'beta', true, 40),
  ('legal', 'hukuk', 'Hukuk', 'services', 'Hukuk hizmetleri ve danismanlik', 'scale', 'coming_soon', true, 50),
  ('health_beauty', 'saglik-guzellik', 'Saglik & Guzellik', 'services', 'Saglik, guzellik ve bakim hizmetleri', 'heart-pulse', 'coming_soon', true, 60),
  ('education', 'egitim', 'Egitim', 'services', 'Egitim, kurs ve akademi hizmetleri', 'graduation-cap', 'coming_soon', true, 70),
  ('career', 'is-kariyer', 'Is & Kariyer', 'career', 'Kariyer ve CV hizmetleri', 'briefcase', 'active', true, 80),
  ('real_estate', 'gayrimenkul', 'Gayrimenkul', 'marketplace', 'Gayrimenkul ilan ve hizmetleri', 'building-2', 'coming_soon', true, 90),
  ('automotive', 'otomotiv', 'Otomotiv', 'marketplace', 'Otomotiv urun ve hizmetleri', 'car-front', 'coming_soon', true, 100)
on conflict (module_key) do update
set slug = excluded.slug,
    name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    status = excluded.status,
    is_visible = true,
    sort_order = excluded.sort_order;

create table if not exists public.reward_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  task_type text not null,
  module text not null default 'all',
  hp_reward integer not null default 0,
  xp_reward integer not null default 0,
  limit_per_user integer not null default 1,
  reset_period text not null default 'once',
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists reward_tasks_task_type_module_key
  on public.reward_tasks(task_type, module);

insert into public.reward_tasks(title, description, task_type, module, hp_reward, xp_reward, reset_period)
values
  ('Profilini tamamla', 'Profil bilgilerini tamamlayarak avantaj sistemini ac.', 'complete_profile', 'all', 20, 20, 'once'),
  ('Ilk adresini ekle', 'Teslimat icin ilk adresini kaydet.', 'add_address', 'all', 15, 15, 'once'),
  ('Ilk favorini ekle', 'Begendigin ilk urunu favorilerine al.', 'add_favorite', 'shop', 5, 10, 'once'),
  ('Ilk siparisini tamamla', 'Teslim edilen ilk siparisten sonra HP/XP kazan.', 'first_order', 'shop', 100, 100, 'once'),
  ('Bir urunu yorumla', 'Dogrulanmis alisverisinden sonra yorum yaz.', 'review_product', 'shop', 20, 25, 'once'),
  ('Kupon Merkezi ziyaret et', 'Kupon Merkezi avantajlarini incele.', 'visit_coupon_center', 'all', 3, 5, 'daily')
on conflict (task_type, module) do update
set title = excluded.title,
    description = excluded.description,
    hp_reward = excluded.hp_reward,
    xp_reward = excluded.xp_reward,
    reset_period = excluded.reset_period,
    is_active = true;

create table if not exists public.user_task_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  task_id uuid not null references public.reward_tasks(id) on delete cascade,
  progress integer not null default 0,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, task_id)
);

drop trigger if exists user_task_progress_set_updated_at on public.user_task_progress;
create trigger user_task_progress_set_updated_at
  before update on public.user_task_progress
  for each row execute function public.set_updated_at();

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  session_id text,
  event_type text not null,
  module text,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_events_type_created_idx on public.user_events(event_type, module, created_at desc);
create index if not exists user_events_user_created_idx on public.user_events(user_id, created_at desc);

create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  entity_type text not null,
  entity_id uuid not null,
  module text not null default 'shop',
  created_at timestamptz not null default now(),
  unique(user_id, entity_type, entity_id)
);

create table if not exists public.user_recent_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  entity_type text not null,
  entity_id uuid not null,
  module text not null default 'shop',
  viewed_at timestamptz not null default now(),
  unique(user_id, entity_type, entity_id)
);

create index if not exists user_recent_views_user_idx on public.user_recent_views(user_id, viewed_at desc);

create table if not exists public.financial_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  partner_id uuid references public.partners(id) on delete set null,
  order_id uuid references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  transaction_type text not null,
  direction text not null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'TRY',
  status text not null default 'pending',
  description text,
  reference_type text,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financial_ledger_order_idx on public.financial_ledger(order_id, created_at desc);
create index if not exists financial_ledger_partner_idx on public.financial_ledger(partner_id, status, created_at desc);
create index if not exists financial_ledger_user_idx on public.financial_ledger(user_id, created_at desc);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'iyzico',
  provider_payment_id text,
  status text not null default 'created',
  amount numeric(12,2) not null,
  currency text not null default 'TRY',
  error_code text,
  error_message text,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_attempts_order_idx on public.payment_attempts(order_id, created_at desc);
drop trigger if exists payment_attempts_set_updated_at on public.payment_attempts;
create trigger payment_attempts_set_updated_at
  before update on public.payment_attempts
  for each row execute function public.set_updated_at();

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  partner_id uuid references public.partners(id) on delete set null,
  reason text not null,
  detail text,
  requested_amount numeric(12,2) not null default 0,
  approved_amount numeric(12,2) not null default 0,
  status text not null default 'requested',
  admin_note text,
  partner_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists refund_requests_order_idx on public.refund_requests(order_id, status, created_at desc);
drop trigger if exists refund_requests_set_updated_at on public.refund_requests;
create trigger refund_requests_set_updated_at
  before update on public.refund_requests
  for each row execute function public.set_updated_at();

create table if not exists public.order_cancellations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null default auth.uid(),
  requester_type text,
  reason text,
  status text not null default 'requested',
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete set null,
  event_type text not null,
  severity text not null default 'low',
  score integer not null default 0,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists risk_events_status_idx on public.risk_events(status, severity, created_at desc);
create index if not exists risk_events_user_idx on public.risk_events(user_id, created_at desc);

alter table public.partner_payouts
  add column if not exists gross_sales numeric(12,2) not null default 0,
  add column if not exists platform_commission numeric(12,2) not null default 0,
  add column if not exists payment_fees numeric(12,2) not null default 0,
  add column if not exists refunds numeric(12,2) not null default 0,
  add column if not exists adjustments numeric(12,2) not null default 0,
  add column if not exists net_payout numeric(12,2) not null default 0,
  add column if not exists admin_note text;

alter table public.support_tickets
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists partner_id uuid references public.partners(id) on delete set null,
  add column if not exists subject text,
  add column if not exists user_message text,
  add column if not exists admin_note text,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

update public.support_tickets
set subject = coalesce(subject, title),
    user_message = coalesce(user_message, message)
where subject is null or user_message is null;

create table if not exists public.user_level_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_level text,
  new_level text,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  placement_type text not null,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  price numeric(12,2) not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ad_placements_active_idx
  on public.ad_placements(status, placement_type, starts_at, ends_at);

create or replace function public.resolve_partner_record_id(p_profile_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id
  from public.partners
  where user_id = p_profile_id or owner_id = p_profile_id
  order by created_at desc
  limit 1;
$$;

create or replace function public.order_items_compute_finance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric(7,4) := 10;
begin
  if coalesce(new.unit_price, 0) = 0 then
    new.unit_price := coalesce(new.price, 0);
  end if;

  if coalesce(new.total_price, 0) = 0 then
    new.total_price := coalesce(new.unit_price, 0) * coalesce(new.quantity, 0);
  end if;

  select coalesce(cp.commission_rate, v_rate)
  into v_rate
  from public.partners p
  left join public.commission_profiles cp on cp.id = p.commission_profile_id
  where p.id = public.resolve_partner_record_id(new.partner_id)
  limit 1;

  v_rate := coalesce(v_rate, 10);
  new.partner_commission_rate := coalesce(nullif(new.partner_commission_rate, 0), v_rate);
  new.platform_commission := round(greatest(0, coalesce(new.total_price, 0)) * (new.partner_commission_rate / 100), 2);
  new.partner_net_earning := greatest(0, coalesce(new.total_price, 0) - new.platform_commission);
  return new;
end;
$$;

drop trigger if exists order_items_compute_finance on public.order_items;
create trigger order_items_compute_finance
  before insert or update of quantity, price, unit_price, total_price, partner_id, partner_commission_rate on public.order_items
  for each row execute function public.order_items_compute_finance();

create or replace function public.ledger_after_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.financial_ledger(user_id, order_id, transaction_type, direction, amount, status, description, reference_type, reference_id)
  values (new.user_id, new.id, 'user_payment', 'credit', coalesce(new.grand_total, new.total, 0), 'pending', 'Siparis odeme kaydi', 'order', new.id);

  if coalesce(new.coupon_discount, 0) > 0 then
    insert into public.financial_ledger(user_id, order_id, transaction_type, direction, amount, status, description, reference_type, reference_id)
    values (new.user_id, new.id, 'coupon_discount', 'debit', new.coupon_discount, 'completed', 'Kupon indirimi', 'order', new.id);
  end if;

  if coalesce(new.hp_discount, 0) > 0 then
    insert into public.financial_ledger(user_id, order_id, transaction_type, direction, amount, status, description, reference_type, reference_id)
    values (new.user_id, new.id, 'hp_discount', 'debit', new.hp_discount, 'completed', 'HP indirim hakki', 'order', new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists orders_ledger_after_insert on public.orders;
create trigger orders_ledger_after_insert
  after insert on public.orders
  for each row execute function public.ledger_after_order_insert();

create or replace function public.ledger_after_order_item_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_record uuid;
begin
  v_partner_record := public.resolve_partner_record_id(new.partner_id);

  if coalesce(new.platform_commission, 0) > 0 then
    insert into public.financial_ledger(partner_id, order_id, order_item_id, transaction_type, direction, amount, status, description, reference_type, reference_id)
    values (v_partner_record, new.order_id, new.id, 'platform_commission', 'credit', new.platform_commission, 'pending', 'Platform komisyonu', 'order_item', new.id);
  end if;

  if coalesce(new.partner_net_earning, 0) > 0 then
    insert into public.financial_ledger(partner_id, order_id, order_item_id, transaction_type, direction, amount, status, description, reference_type, reference_id)
    values (v_partner_record, new.order_id, new.id, 'partner_earning', 'credit', new.partner_net_earning, 'pending', 'Partner net kazanc', 'order_item', new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_ledger_after_insert on public.order_items;
create trigger order_items_ledger_after_insert
  after insert on public.order_items
  for each row execute function public.ledger_after_order_item_insert();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  notification_type text not null,
  module text not null default 'all',
  entity_type text,
  entity_id uuid,
  action_url text,
  priority text not null default 'normal',
  is_read boolean not null default false,
  read_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, is_read, created_at desc);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  push_enabled boolean not null default false,
  order_updates boolean not null default true,
  coupons boolean not null default true,
  hp_xp_updates boolean not null default true,
  partner_campaigns boolean not null default true,
  security_alerts boolean not null default true,
  weekly_summary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create table if not exists public.user_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  segment_key text not null unique,
  rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.user_segments(name, description, segment_key, rules)
values
  ('Yeni Kullanicilar', 'Yeni kayit olan kullanicilar', 'new_users', '{"kind":"manual"}'),
  ('Siparis Vermeyenler', 'Henuz siparis olusturmamis kullanicilar', 'no_order_yet', '{"orders":0}'),
  ('Ilk Siparis Tamamlandi', 'Ilk teslim edilmis siparisini tamamlayanlar', 'first_order_completed', '{"orders_min":1}'),
  ('Sepeti Terk Edenler', 'Aktif sepeti bekleyen kullanicilar', 'abandoned_cart_users', '{"cart":"abandoned"}'),
  ('Yuksek HP Kullanicilari', 'HP bakiyesi yuksek kullanicilar', 'high_hp_users', '{"hp_min":500}'),
  ('Kupon Sevenler', 'Kupon goruntuleme veya kullanimi yuksek kullanicilar', 'coupon_lovers', '{"coupon_events_min":3}'),
  ('Premium Adaylari', 'Seviye ilerlemesine yakin kullanicilar', 'premium_candidates', '{"xp_progress":"near_next"}'),
  ('7 Gun Pasif', 'Son 7 gundur donmeyen kullanicilar', 'inactive_7_days', '{"inactive_days":7}'),
  ('30 Gun Pasif', 'Son 30 gundur donmeyen kullanicilar', 'inactive_30_days', '{"inactive_days":30}'),
  ('Sik Alisveris Yapanlar', 'Tekrarlayan alisveris kullanicilari', 'frequent_buyers', '{"orders_min":3}'),
  ('Iade Risk Kullanicilari', 'Iade talebi yogun kullanicilar', 'refund_risk_users', '{"refunds_min":3}'),
  ('Elite Black Adaylari', 'En ust seviye adaylari', 'elite_black_candidates', '{"tier_candidate":"elite_black"}')
on conflict (segment_key) do update
set name = excluded.name,
    description = excluded.description,
    rules = excluded.rules,
    is_active = true;

create table if not exists public.user_segment_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  segment_id uuid not null references public.user_segments(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  unique(user_id, segment_id)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  campaign_type text not null,
  module text not null default 'all',
  partner_id uuid references public.partners(id) on delete set null,
  target_segment_id uuid references public.user_segments(id) on delete set null,
  coupon_id uuid references public.coupons(id) on delete set null,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer not null default 0,
  budget_limit numeric(12,2) not null default 0,
  send_limit integer not null default 0,
  sent_count integer not null default 0,
  is_paid_campaign boolean not null default false,
  campaign_fee numeric(12,2) not null default 0,
  placement_type text,
  billing_status text not null default 'not_billed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_status_idx on public.campaigns(status, priority desc, created_at desc);
drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

create table if not exists public.campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  status text not null default 'created',
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  converted_order_id uuid references public.orders(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(campaign_id, user_id)
);

create index if not exists campaign_deliveries_campaign_idx
  on public.campaign_deliveries(campaign_id, status, created_at desc);

create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.notifications(user_id, title, body, notification_type, module, entity_type, entity_id, action_url, priority)
    values (
      new.user_id,
      'Siparis durumun guncellendi',
      'Siparisin yeni durumu: ' || coalesce(new.status, new.order_status::text, 'pending'),
      'order_status',
      'shop',
      'order',
      new.id,
      '/pages/account/order-detail.html?id=' || new.id::text,
      'normal'
    );
    return new;
  end if;

  if new.status is distinct from old.status
    or new.order_status is distinct from old.order_status
  then
    insert into public.notifications(user_id, title, body, notification_type, module, entity_type, entity_id, action_url, priority)
    values (
      new.user_id,
      'Siparis durumun guncellendi',
      'Siparisin yeni durumu: ' || coalesce(new.status, new.order_status::text, 'pending'),
      'order_status',
      'shop',
      'order',
      new.id,
      '/pages/account/order-detail.html?id=' || new.id::text,
      'normal'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_notify_status_change on public.orders;
create trigger orders_notify_status_change
  after insert or update of status, order_status on public.orders
  for each row execute function public.notify_order_status_change();

create or replace function public.notify_hp_ledger_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null and coalesce(new.amount, 0) <> 0 then
    insert into public.notifications(user_id, title, body, notification_type, module, entity_type, entity_id, action_url, priority)
    values (
      new.user_id,
      case when new.amount > 0 then 'HP/XP avantaji kazandin' else 'HP indirim hakki kullanildi' end,
      case when new.amount > 0 then abs(new.amount)::text || ' HP kazandin.' else abs(new.amount)::text || ' HP indirim hakki kullanildi.' end,
      'hp_reward',
      'all',
      'hp_ledger',
      new.id,
      '/pages/account/rewards.html',
      'normal'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists hp_ledger_notify_insert on public.hp_ledger;
create trigger hp_ledger_notify_insert
  after insert on public.hp_ledger
  for each row execute function public.notify_hp_ledger_insert();

create or replace function public.create_risk_event(
  p_user_id uuid,
  p_order_id uuid,
  p_partner_id uuid,
  p_event_type text,
  p_severity text,
  p_score integer,
  p_message text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.risk_events(user_id, order_id, partner_id, event_type, severity, score, message, metadata)
  values (p_user_id, p_order_id, p_partner_id, p_event_type, coalesce(p_severity, 'low'), coalesce(p_score, 0), p_message, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  if p_order_id is not null and coalesce(p_score, 0) >= 50 then
    update public.orders
    set risk_score = greatest(coalesce(risk_score, 0), p_score),
        risk_status = case when p_score >= 85 then 'blocked' else 'review' end,
        fraud_status = case when p_score >= 85 then 'blocked' else 'review' end
    where id = p_order_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.reverse_hp_for_refunded_order(p_order_id uuid, p_reason text default 'refund')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mvp_raise_if_not_admin();

  update public.hp_ledger
  set status = 'reversed',
      reversed_at = now(),
      reverse_reason = p_reason
  where reference_type = 'order'
    and reference_id = p_order_id
    and status in ('pending', 'confirmed');
end;
$$;

alter table public.partners enable row level security;
alter table public.commission_profiles enable row level security;
alter table public.partner_verification_logs enable row level security;
alter table public.product_categories enable row level security;
alter table public.home_sections enable row level security;
alter table public.reward_tasks enable row level security;
alter table public.user_task_progress enable row level security;
alter table public.user_events enable row level security;
alter table public.user_favorites enable row level security;
alter table public.user_recent_views enable row level security;
alter table public.financial_ledger enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.refund_requests enable row level security;
alter table public.order_cancellations enable row level security;
alter table public.risk_events enable row level security;
alter table public.user_level_logs enable row level security;
alter table public.ad_placements enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.user_segments enable row level security;
alter table public.user_segment_memberships enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_deliveries enable row level security;

drop policy if exists "partners_select_own_or_admin" on public.partners;
create policy "partners_select_own_or_admin" on public.partners
  for select to authenticated
  using (
    public.is_admin()
    or owner_id = auth.uid()
    or user_id = auth.uid()
    or lower(email) = lower((select email from auth.users where id = auth.uid()))
  );

drop policy if exists "partners_insert_own" on public.partners;
create policy "partners_insert_own" on public.partners
  for insert to authenticated
  with check (public.is_admin() or owner_id = auth.uid() or user_id = auth.uid());

drop policy if exists "partners_update_own_or_admin" on public.partners;
create policy "partners_update_own_or_admin" on public.partners
  for update to authenticated
  using (public.is_admin() or owner_id = auth.uid() or user_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid() or user_id = auth.uid());

drop policy if exists "commission_profiles_select_partner_or_admin" on public.commission_profiles;
create policy "commission_profiles_select_partner_or_admin" on public.commission_profiles
  for select to authenticated
  using (is_active or public.is_admin());

drop policy if exists "commission_profiles_admin_all" on public.commission_profiles;
create policy "commission_profiles_admin_all" on public.commission_profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "partner_verification_logs_select_partner_or_admin" on public.partner_verification_logs;
create policy "partner_verification_logs_select_partner_or_admin" on public.partner_verification_logs
  for select to authenticated
  using (public.is_admin() or public.partner_owns(partner_id));

drop policy if exists "partner_verification_logs_admin_all" on public.partner_verification_logs;
create policy "partner_verification_logs_admin_all" on public.partner_verification_logs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "product_categories_read_active" on public.product_categories;
create policy "product_categories_read_active" on public.product_categories
  for select
  using (is_active or public.is_admin());

drop policy if exists "product_categories_admin_all" on public.product_categories;
create policy "product_categories_admin_all" on public.product_categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "home_sections_read_active" on public.home_sections;
create policy "home_sections_read_active" on public.home_sections
  for select
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    or public.is_admin()
  );

drop policy if exists "home_sections_admin_all" on public.home_sections;
create policy "home_sections_admin_all" on public.home_sections
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "platform_modules_select_visible" on public.platform_modules;
create policy "platform_modules_select_visible" on public.platform_modules
  for select
  using (is_visible and status <> 'hidden');

drop policy if exists "platform_modules_admin_all_mvp" on public.platform_modules;
create policy "platform_modules_admin_all_mvp" on public.platform_modules
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "reward_tasks_read_active" on public.reward_tasks;
create policy "reward_tasks_read_active" on public.reward_tasks
  for select
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    or public.is_admin()
  );

drop policy if exists "reward_tasks_admin_all" on public.reward_tasks;
create policy "reward_tasks_admin_all" on public.reward_tasks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "user_task_progress_own" on public.user_task_progress;
create policy "user_task_progress_own" on public.user_task_progress
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_events_insert_own" on public.user_events;
create policy "user_events_insert_own" on public.user_events
  for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

drop policy if exists "user_events_select_own_or_admin" on public.user_events;
create policy "user_events_select_own_or_admin" on public.user_events
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_favorites_own" on public.user_favorites;
create policy "user_favorites_own" on public.user_favorites
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_recent_views_own" on public.user_recent_views;
create policy "user_recent_views_own" on public.user_recent_views
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "financial_ledger_select_scoped" on public.financial_ledger;
create policy "financial_ledger_select_scoped" on public.financial_ledger
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid() or public.partner_owns(partner_id));

drop policy if exists "financial_ledger_admin_all" on public.financial_ledger;
create policy "financial_ledger_admin_all" on public.financial_ledger
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "payment_attempts_select_own_or_admin" on public.payment_attempts;
create policy "payment_attempts_select_own_or_admin" on public.payment_attempts
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists "payment_attempts_admin_all" on public.payment_attempts;
create policy "payment_attempts_admin_all" on public.payment_attempts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "refund_requests_select_scoped" on public.refund_requests;
create policy "refund_requests_select_scoped" on public.refund_requests
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid() or public.partner_owns(partner_id));

drop policy if exists "refund_requests_insert_own" on public.refund_requests;
create policy "refund_requests_insert_own" on public.refund_requests
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "refund_requests_admin_update" on public.refund_requests;
create policy "refund_requests_admin_update" on public.refund_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "order_cancellations_select_own_or_admin" on public.order_cancellations;
create policy "order_cancellations_select_own_or_admin" on public.order_cancellations
  for select to authenticated
  using (public.is_admin() or requested_by = auth.uid());

drop policy if exists "order_cancellations_insert_own" on public.order_cancellations;
create policy "order_cancellations_insert_own" on public.order_cancellations
  for insert to authenticated
  with check (requested_by = auth.uid() or public.is_admin());

drop policy if exists "order_cancellations_admin_update" on public.order_cancellations;
create policy "order_cancellations_admin_update" on public.order_cancellations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "risk_events_admin_only" on public.risk_events;
create policy "risk_events_admin_only" on public.risk_events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "user_level_logs_select_own_or_admin" on public.user_level_logs;
create policy "user_level_logs_select_own_or_admin" on public.user_level_logs
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_level_logs_admin_all" on public.user_level_logs;
create policy "user_level_logs_admin_all" on public.user_level_logs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "ad_placements_public_active" on public.ad_placements;
create policy "ad_placements_public_active" on public.ad_placements
  for select
  using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    or public.is_admin()
    or public.partner_owns(partner_id)
  );

drop policy if exists "ad_placements_admin_all" on public.ad_placements;
create policy "ad_placements_admin_all" on public.ad_placements
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "notifications_own_select_update" on public.notifications;
create policy "notifications_own_select_update" on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_own_update" on public.notifications;
create policy "notifications_own_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_admin_insert" on public.notifications;
create policy "notifications_admin_insert" on public.notifications
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "notification_preferences_own" on public.notification_preferences;
create policy "notification_preferences_own" on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_segments_select_active_or_admin" on public.user_segments;
create policy "user_segments_select_active_or_admin" on public.user_segments
  for select to authenticated
  using (is_active or public.is_admin());

drop policy if exists "user_segments_admin_all" on public.user_segments;
create policy "user_segments_admin_all" on public.user_segments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "user_segment_memberships_select_own_or_admin" on public.user_segment_memberships;
create policy "user_segment_memberships_select_own_or_admin" on public.user_segment_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_segment_memberships_admin_all" on public.user_segment_memberships;
create policy "user_segment_memberships_admin_all" on public.user_segment_memberships
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "campaigns_select_scoped" on public.campaigns;
create policy "campaigns_select_scoped" on public.campaigns
  for select to authenticated
  using (public.is_admin() or public.partner_owns(partner_id) or status = 'active');

drop policy if exists "campaigns_partner_insert_pending" on public.campaigns;
create policy "campaigns_partner_insert_pending" on public.campaigns
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.partner_owns(partner_id) and status in ('draft', 'pending_review'))
  );

drop policy if exists "campaigns_partner_update_own_draft" on public.campaigns;
create policy "campaigns_partner_update_own_draft" on public.campaigns
  for update to authenticated
  using (public.is_admin() or (public.partner_owns(partner_id) and status in ('draft', 'pending_review', 'rejected')))
  with check (public.is_admin() or (public.partner_owns(partner_id) and status in ('draft', 'pending_review')));

drop policy if exists "campaign_deliveries_select_scoped" on public.campaign_deliveries;
create policy "campaign_deliveries_select_scoped" on public.campaign_deliveries
  for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (select 1 from public.campaigns c where c.id = campaign_deliveries.campaign_id and public.partner_owns(c.partner_id))
  );

drop policy if exists "campaign_deliveries_admin_all" on public.campaign_deliveries;
create policy "campaign_deliveries_admin_all" on public.campaign_deliveries
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant execute on function public.submit_product_for_review(uuid) to authenticated;
grant execute on function public.review_product_quality(uuid, text, text) to authenticated;
grant execute on function public.create_risk_event(uuid, uuid, uuid, text, text, integer, text, jsonb) to authenticated;
grant execute on function public.reverse_hp_for_refunded_order(uuid, text) to authenticated;
