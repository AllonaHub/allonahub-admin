do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    execute $fn$
      create function public.is_admin()
      returns boolean
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        v_is_admin boolean := false;
        v_claim_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '');
      begin
        if v_claim_role in ('admin', 'super_admin') then
          return true;
        end if;

        if to_regclass('public.profiles') is null or auth.uid() is null then
          return false;
        end if;

        execute 'select exists (select 1 from public.profiles where id::text = $1::text and role::text in (''admin'', ''super_admin''))'
          into v_is_admin
          using auth.uid();

        return coalesce(v_is_admin, false);
      end;
      $body$;
    $fn$;
  end if;
end $$;

create or replace function public.order_has_partner_item(target_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.order_items oi
    where oi.order_id = target_order_id
      and oi.partner_id::text = auth.uid()::text
  );
$$;

select
  '05_order_helpers' as step,
  to_regprocedure('public.is_admin()') is not null as is_admin_exists,
  to_regprocedure('public.order_has_partner_item(uuid)') is not null as order_partner_helper_exists;
