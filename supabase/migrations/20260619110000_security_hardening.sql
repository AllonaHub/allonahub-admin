create extension if not exists pgcrypto;

do $$ begin
  alter type public.app_role add value if not exists 'courier';
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create or replace function public.current_app_role()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select role::text
    from public.profiles
    where id = auth.uid()
    limit 1
  ), 'anonymous');
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin', 'super_admin');
$$;

create or replace function public.is_partner_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() in ('partner', 'admin', 'super_admin');
$$;

create or replace function public.is_courier_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() in ('courier', 'admin', 'super_admin');
$$;

alter table if exists public.addresses alter column user_id set default auth.uid();
alter table if exists public.favorites alter column user_id set default auth.uid();
alter table if exists public.orders alter column user_id set default auth.uid();

alter table if exists public.profiles enable row level security;
alter table if exists public.categories enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.partner_ads enable row level security;
alter table if exists public.addresses enable row level security;
alter table if exists public.favorites enable row level security;
alter table if exists public.coupons enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.partner_applications enable row level security;
alter table if exists public.cv_device_accounts enable row level security;
alter table if exists public.cv_access_accounts enable row level security;
alter table if exists public.cv_generations enable row level security;
alter table if exists public.cv_payments enable row level security;
alter table if exists public.admin_notifications enable row level security;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partner_applications_email_shape') then
    alter table public.partner_applications
      add constraint partner_applications_email_shape
      check (length(email) <= 180 and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'partner_applications_text_lengths') then
    alter table public.partner_applications
      add constraint partner_applications_text_lengths
      check (
        length(company_name) between 2 and 160
        and length(contact_name) between 2 and 140
        and coalesce(length(phone), 0) <= 40
        and coalesce(length(tax_number), 0) <= 60
        and status in ('pending', 'review', 'approved', 'rejected')
      )
      not valid;
  end if;
end $$;

create or replace function public.can_submit_partner_application(
  p_email text,
  p_phone text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_recent_count integer := 0;
begin
  if v_email = '' or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    return false;
  end if;

  select count(*)
    into v_recent_count
  from public.partner_applications
  where created_at > now() - interval '24 hours'
    and (
      lower(email) = v_email
      or (v_phone <> '' and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone)
    );

  return v_recent_count < 2;
end;
$$;

create or replace function public.protect_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
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
    or new.user_id is distinct from old.user_id
    or new.customer_name is distinct from old.customer_name
    or new.customer_email is distinct from old.customer_email
    or new.customer_phone is distinct from old.customer_phone
    or new.city is distinct from old.city
    or new.address is distinct from old.address
    or new.subtotal is distinct from old.subtotal
    or new.shipping is distinct from old.shipping
    or new.discount is distinct from old.discount
    or new.total is distinct from old.total
    or new.payment_status is distinct from old.payment_status
  then
    raise exception 'Only delivery status and tracking fields can be updated';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_protect_non_admin_update on public.orders;
create trigger orders_protect_non_admin_update
  before update on public.orders
  for each row execute function public.protect_order_update();

create or replace function public.create_secure_order(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_city text,
  p_address text,
  p_items jsonb,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item record;
  v_product public.products%rowtype;
  v_coupon public.coupons%rowtype;
  v_order public.orders%rowtype;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_items_count integer := 0;
  v_clean_email text := lower(trim(coalesce(p_customer_email, '')));
  v_clean_phone text := left(trim(coalesce(p_customer_phone, '')), 40);
  v_clean_name text := left(trim(coalesce(p_customer_name, '')), 160);
  v_clean_city text := left(trim(coalesce(p_city, '')), 90);
  v_clean_address text := left(trim(coalesce(p_address, '')), 1200);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if length(v_clean_name) < 2
    or v_clean_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    or length(v_clean_city) < 2
    or length(v_clean_address) < 10
  then
    raise exception 'Invalid order payload';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Invalid order items';
  end if;

  if (
    select count(*)
    from public.orders
    where user_id = v_user_id
      and created_at > now() - interval '10 minutes'
  ) >= 10 then
    raise exception 'Rate limit exceeded';
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
  loop
    if v_item.product_id is null or coalesce(v_item.quantity, 0) < 1 or v_item.quantity > 99 then
      raise exception 'Invalid order item';
    end if;

    select *
      into v_product
    from public.products
    where id = v_item.product_id
      and status = 'active'
    limit 1;

    if not found then
      raise exception 'Product is not available';
    end if;

    if v_product.stock < v_item.quantity then
      raise exception 'Insufficient stock';
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_item.quantity);
    v_items_count := v_items_count + 1;
  end loop;

  if v_items_count = 0 or v_subtotal <= 0 then
    raise exception 'Invalid order total';
  end if;

  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select *
      into v_coupon
    from public.coupons
    where upper(code) = upper(trim(p_coupon_code))
      and status = 'active'
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
      and minimum_subtotal <= v_subtotal
      and (usage_limit is null or used_count < usage_limit)
    limit 1;

    if found then
      if v_coupon.discount_type = 'percent' then
        v_discount := round(v_subtotal * (v_coupon.discount_value / 100), 2);
      else
        v_discount := v_coupon.discount_value;
      end if;
      v_discount := least(v_subtotal, greatest(0, v_discount));
    end if;
  end if;

  v_shipping := case when v_subtotal >= 1500 then 0 else 89.90 end;
  v_total := greatest(0, v_subtotal + v_shipping - v_discount);

  insert into public.orders (
    user_id,
    customer_name,
    customer_email,
    customer_phone,
    city,
    address,
    subtotal,
    shipping,
    discount,
    total,
    payment_status,
    order_status
  )
  values (
    v_user_id,
    v_clean_name,
    v_clean_email,
    v_clean_phone,
    v_clean_city,
    v_clean_address,
    v_subtotal,
    v_shipping,
    v_discount,
    v_total,
    'pending',
    'pending'
  )
  returning * into v_order;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
  loop
    select *
      into v_product
    from public.products
    where id = v_item.product_id
      and status = 'active'
    limit 1;

    if not found or v_product.stock < v_item.quantity then
      raise exception 'Product stock changed';
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      price
    )
    values (
      v_order.id,
      v_product.id,
      v_product.name,
      v_item.quantity,
      v_product.price
    );
  end loop;

  return to_jsonb(v_order);
end;
$$;

grant execute on function public.create_secure_order(text, text, text, text, text, jsonb, text) to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own_customer" on public.profiles;
create policy "profiles_insert_own_customer"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and role::text = 'customer');

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "categories_read_active" on public.categories;
create policy "categories_read_active"
  on public.categories for select
  using (status = 'active' or public.is_admin());

drop policy if exists "categories_admin_all" on public.categories;
create policy "categories_admin_all"
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "products_read_active_or_owner" on public.products;
create policy "products_read_active_or_owner"
  on public.products for select
  using (status = 'active' or partner_id = auth.uid() or public.is_admin());

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "products_partner_insert" on public.products;
create policy "products_partner_insert"
  on public.products for insert
  to authenticated
  with check (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()));

drop policy if exists "products_partner_update_own" on public.products;
create policy "products_partner_update_own"
  on public.products for update
  to authenticated
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
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "partner_ads_partner_insert" on public.partner_ads;
create policy "partner_ads_partner_insert"
  on public.partner_ads for insert
  to authenticated
  with check (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()));

drop policy if exists "partner_ads_partner_update_own" on public.partner_ads;
create policy "partner_ads_partner_update_own"
  on public.partner_ads for update
  to authenticated
  using (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()))
  with check (public.is_partner_or_admin() and (partner_id = auth.uid() or public.is_admin()));

drop policy if exists "addresses_own" on public.addresses;
drop policy if exists "addresses_select_own" on public.addresses;
drop policy if exists "addresses_insert_own" on public.addresses;
drop policy if exists "addresses_update_own" on public.addresses;
drop policy if exists "addresses_delete_own" on public.addresses;

create policy "addresses_select_own"
  on public.addresses for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "addresses_insert_own"
  on public.addresses for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy "addresses_update_own"
  on public.addresses for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "addresses_delete_own"
  on public.addresses for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own"
  on public.favorites for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "coupons_read_active" on public.coupons;
create policy "coupons_read_active"
  on public.coupons for select
  using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    or public.is_admin()
  );

drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all"
  on public.coupons for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin"
  on public.orders for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.order_has_partner_item(orders.id)
    or (public.is_courier_or_admin() and order_status in ('confirmed', 'preparing', 'shipped', 'delivered'))
  );

drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_insert_via_secure_rpc_only" on public.orders;
create policy "orders_insert_via_secure_rpc_only"
  on public.orders for insert
  to authenticated
  with check (false);

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "orders_update_partner_courier_limited" on public.orders;
create policy "orders_update_partner_courier_limited"
  on public.orders for update
  to authenticated
  using (
    public.order_has_partner_item(orders.id)
    or (public.is_courier_or_admin() and order_status in ('confirmed', 'preparing', 'shipped'))
  )
  with check (
    public.order_has_partner_item(orders.id)
    or (public.is_courier_or_admin() and order_status in ('confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'))
  );

drop policy if exists "order_items_select_own_or_admin" on public.order_items;
create policy "order_items_select_own_or_admin"
  on public.order_items for select
  to authenticated
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
    or public.is_courier_or_admin()
  );

drop policy if exists "order_items_insert_own" on public.order_items;
drop policy if exists "order_items_insert_via_secure_rpc_only" on public.order_items;
create policy "order_items_insert_via_secure_rpc_only"
  on public.order_items for insert
  to authenticated
  with check (false);

drop policy if exists "order_items_admin_update" on public.order_items;
create policy "order_items_admin_update"
  on public.order_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "partner_applications_insert_public" on public.partner_applications;
create policy "partner_applications_insert_public"
  on public.partner_applications for insert
  with check (
    status = 'pending'
    and public.can_submit_partner_application(email, phone)
  );

drop policy if exists "partner_applications_select_admin_or_own" on public.partner_applications;
create policy "partner_applications_select_admin_or_own"
  on public.partner_applications for select
  to authenticated
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists "partner_applications_admin_update" on public.partner_applications;
create policy "partner_applications_admin_update"
  on public.partner_applications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cv_device_accounts_select_own_or_admin" on public.cv_device_accounts;
create policy "cv_device_accounts_select_own_or_admin"
  on public.cv_device_accounts for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_device_accounts_admin_all" on public.cv_device_accounts;
create policy "cv_device_accounts_admin_all"
  on public.cv_device_accounts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cv_access_select_own_or_admin" on public.cv_access_accounts;
create policy "cv_access_select_own_or_admin"
  on public.cv_access_accounts for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_access_admin_all" on public.cv_access_accounts;
create policy "cv_access_admin_all"
  on public.cv_access_accounts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cv_generations_select_own_or_admin" on public.cv_generations;
create policy "cv_generations_select_own_or_admin"
  on public.cv_generations for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_generations_admin_all" on public.cv_generations;
create policy "cv_generations_admin_all"
  on public.cv_generations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cv_payments_select_own_or_admin" on public.cv_payments;
create policy "cv_payments_select_own_or_admin"
  on public.cv_payments for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "cv_payments_admin_all" on public.cv_payments;
create policy "cv_payments_admin_all"
  on public.cv_payments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin_notifications_select_admin" on public.admin_notifications;
create policy "admin_notifications_select_admin"
  on public.admin_notifications for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admin_notifications_admin_all" on public.admin_notifications;
create policy "admin_notifications_admin_all"
  on public.admin_notifications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "product_images_public_read" on storage.objects';
    execute 'create policy "product_images_public_read"
      on storage.objects for select
      using (bucket_id = ''product-images'')';

    execute 'drop policy if exists "product_images_partner_upload" on storage.objects';
    execute 'create policy "product_images_partner_upload"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = ''product-images''
        and public.is_partner_or_admin()
        and lower(name) ~ ''\.(jpg|jpeg|png|webp)$''
      )';

    execute 'drop policy if exists "product_images_partner_update_own" on storage.objects';
    execute 'create policy "product_images_partner_update_own"
      on storage.objects for update
      to authenticated
      using (bucket_id = ''product-images'' and public.is_partner_or_admin() and owner = auth.uid())
      with check (bucket_id = ''product-images'' and public.is_partner_or_admin() and owner = auth.uid())';
  end if;
end $$;
