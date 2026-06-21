-- Critical hotfix: public.orders must never be readable through anon/public.
-- Fully self-contained, production-safe version for schema drift.

alter table if exists public.orders enable row level security;
alter table if exists public.orders force row level security;

revoke all on table public.orders from anon;
revoke select, insert, update, delete on table public.orders from public;
revoke insert, delete on table public.orders from authenticated;
grant select, update on table public.orders to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on table public.orders to service_role;
  end if;
end $$;

create or replace function public.current_auth_aal()
returns text
language sql
stable
as $$
  select coalesce(nullif(auth.jwt() ->> 'aal', ''), 'aal1');
$$;

create or replace function public.has_mfa()
returns boolean
language sql
stable
as $$
  select public.current_auth_aal() = 'aal2';
$$;

create or replace function public.current_app_role()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return 'anonymous';
  end if;

  if to_regclass('public.profiles') is null then
    return 'authenticated';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    execute 'select role::text from public.profiles where id = $1 limit 1'
      into v_role
      using auth.uid();
  end if;

  return coalesce(v_role, 'authenticated');
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin', 'super_admin') and public.has_mfa();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() = 'super_admin' and public.has_mfa();
$$;

create or replace function public.partner_member_has_access_text(target_partner_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match boolean := false;
begin
  if v_user_id is null or target_partner_id is null or btrim(target_partner_id) = '' then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'partner_businesses'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'partner_businesses' and column_name = 'id'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'partner_businesses' and column_name = 'owner_id'
  ) then
    execute
      'select exists (
        select 1 from public.partner_businesses
        where id::text = $1 and owner_id::text = $2
      )'
    into v_match
    using target_partner_id, v_user_id::text;

    if v_match then
      return true;
    end if;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'partner_staff'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'partner_staff' and column_name = 'partner_id'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'partner_staff' and column_name = 'user_id'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'partner_staff' and column_name = 'status'
    ) then
      execute
        'select exists (
          select 1 from public.partner_staff
          where partner_id::text = $1 and user_id::text = $2 and status = ''active''
        )'
      into v_match
      using target_partner_id, v_user_id::text;
    else
      execute
        'select exists (
          select 1 from public.partner_staff
          where partner_id::text = $1 and user_id::text = $2
        )'
      into v_match
      using target_partner_id, v_user_id::text;
    end if;

    if v_match then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.partner_member_has_access(target_partner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.partner_member_has_access_text(target_partner_id::text);
$$;

create or replace function public.order_is_owner(target_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_column text;
  v_match boolean := false;
begin
  if v_user_id is null then
    return false;
  end if;

  foreach v_column in array array['user_id', 'customer_id', 'profile_id', 'owner_id']
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = v_column
    ) then
      execute format(
        'select exists (select 1 from public.orders where id::text = $1::text and %I::text = $2::text)',
        v_column
      )
      into v_match
      using target_order_id, v_user_id;

      if v_match then
        return true;
      end if;
    end if;
  end loop;

  if v_email <> ''
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'customer_email'
    )
  then
    execute
      'select exists (
        select 1 from public.orders
        where id::text = $1::text
          and lower(coalesce(customer_email::text, '''')) = $2
      )'
    into v_match
    using target_order_id, v_email;

    if v_match then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.order_has_partner_item(target_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_column text;
  v_match boolean := false;
begin
  if v_user_id is null then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  foreach v_column in array array['partner_id', 'partner_business_id', 'business_id', 'store_id']
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = v_column
    ) then
      execute format(
        'select exists (
          select 1 from public.orders
          where id::text = $1::text
            and (
              %I::text = $2::text
              or public.partner_member_has_access_text(%I::text)
            )
        )',
        v_column,
        v_column
      )
      into v_match
      using target_order_id, v_user_id;

      if v_match then
        return true;
      end if;
    end if;
  end loop;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'order_items'
  )
  and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'order_id'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'product_id'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'id'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'partner_id'
  )
  then
    execute
      'select exists (
        select 1
        from public.order_items oi
        join public.products p on p.id::text = oi.product_id::text
        where oi.order_id::text = $1::text
          and (
            p.partner_id::text = $2::text
            or public.partner_member_has_access_text(p.partner_id::text)
          )
      )'
    into v_match
    using target_order_id, v_user_id;

    if v_match then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.order_is_assigned_courier(target_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_column text;
  v_match boolean := false;
begin
  if v_user_id is null then
    return false;
  end if;

  if public.current_app_role() <> 'courier' then
    return false;
  end if;

  if not public.has_mfa() then
    return false;
  end if;

  foreach v_column in array array['courier_id', 'assigned_courier_id', 'delivery_courier_id']
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = v_column
    ) then
      execute format(
        'select exists (select 1 from public.orders where id::text = $1::text and %I::text = $2::text)',
        v_column
      )
      into v_match
      using target_order_id, v_user_id;

      if v_match then
        return true;
      end if;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.current_auth_aal() from public, anon;
revoke all on function public.has_mfa() from public, anon;
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.partner_member_has_access_text(text) from public, anon;
revoke all on function public.partner_member_has_access(uuid) from public, anon;
revoke all on function public.order_is_owner(uuid) from public, anon;
revoke all on function public.order_has_partner_item(uuid) from public, anon;
revoke all on function public.order_is_assigned_courier(uuid) from public, anon;

grant execute on function public.current_auth_aal() to authenticated;
grant execute on function public.has_mfa() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.partner_member_has_access_text(text) to authenticated;
grant execute on function public.partner_member_has_access(uuid) to authenticated;
grant execute on function public.order_is_owner(uuid) to authenticated;
grant execute on function public.order_has_partner_item(uuid) to authenticated;
grant execute on function public.order_is_assigned_courier(uuid) to authenticated;

create or replace function public.protect_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_field text;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.order_has_partner_item(old.id)
    or public.order_is_assigned_courier(old.id)
  ) then
    raise exception 'Forbidden order update';
  end if;

  foreach v_field in array array[
    'id',
    'order_no',
    'user_id',
    'customer_id',
    'profile_id',
    'owner_id',
    'customer_name',
    'customer_email',
    'customer_phone',
    'city',
    'address',
    'address_id',
    'subtotal',
    'shipping',
    'discount',
    'total',
    'payment_status'
  ]
  loop
    if (v_new -> v_field) is distinct from (v_old -> v_field) then
      raise exception 'Only delivery status and tracking fields can be updated';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists orders_protect_non_admin_update on public.orders;
create trigger orders_protect_non_admin_update
  before update on public.orders
  for each row execute function public.protect_order_update();

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
  loop
    execute format('drop policy if exists %I on public.orders', v_policy.policyname);
  end loop;
end $$;

create policy "orders_select_owner_partner_courier_admin"
  on public.orders for select
  to authenticated
  using (
    auth.uid() is not null
    and (
      public.order_is_owner(orders.id)
      or public.order_has_partner_item(orders.id)
      or public.order_is_assigned_courier(orders.id)
      or public.is_admin()
    )
  );

create policy "orders_insert_via_secure_rpc_only"
  on public.orders for insert
  to authenticated
  with check (false);

create policy "orders_update_admin"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "orders_update_partner_courier_limited"
  on public.orders for update
  to authenticated
  using (
    public.order_has_partner_item(orders.id)
    or public.order_is_assigned_courier(orders.id)
  )
  with check (
    public.order_has_partner_item(orders.id)
    or public.order_is_assigned_courier(orders.id)
  );

comment on table public.orders is
  'Security critical: public/anon access revoked. RLS allows owner, related partner, assigned courier, and MFA-verified admin/super_admin only. This policy set is self-contained and production-safe for schema drift.';
