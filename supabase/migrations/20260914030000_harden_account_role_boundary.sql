-- Keep customer and partner identities separate at the database boundary.

create or replace function public.partner_member_has_access(target_partner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_businesses business
    join public.profiles profile on profile.id = auth.uid()
    where business.id = target_partner_id
      and business.owner_id = auth.uid()
      and business.status = 'active'
      and profile.role = 'partner'
  )
  or exists (
    select 1
    from public.partner_staff staff
    join public.partner_businesses business on business.id = staff.partner_id
    join public.profiles profile on profile.id = auth.uid()
    where staff.partner_id = target_partner_id
      and staff.user_id = auth.uid()
      and staff.status = 'active'
      and business.status = 'active'
      and profile.role = 'partner'
  )
  or public.is_admin();
$$;

drop policy if exists "partner_businesses_owner_or_admin" on public.partner_businesses;
drop policy if exists "partner_businesses_owner_or_admin_select" on public.partner_businesses;
drop policy if exists "partner_businesses_admin_insert" on public.partner_businesses;
drop policy if exists "partner_businesses_admin_update" on public.partner_businesses;
drop policy if exists "partner_businesses_admin_delete" on public.partner_businesses;

create policy "partner_businesses_owner_or_admin_select"
  on public.partner_businesses for select
  to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy "partner_businesses_admin_insert"
  on public.partner_businesses for insert
  to authenticated
  with check (public.is_admin());

create policy "partner_businesses_admin_update"
  on public.partner_businesses for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "partner_businesses_admin_delete"
  on public.partner_businesses for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "partner_staff_owner_or_admin_write" on public.partner_staff;
create policy "partner_staff_owner_or_admin_write"
  on public.partner_staff for all
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.partner_businesses business
      join public.profiles profile on profile.id = auth.uid()
      where business.id = partner_staff.partner_id
        and business.owner_id = auth.uid()
        and business.status = 'active'
        and profile.role = 'partner'
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.partner_businesses business
      join public.profiles profile on profile.id = auth.uid()
      where business.id = partner_staff.partner_id
        and business.owner_id = auth.uid()
        and business.status = 'active'
        and profile.role = 'partner'
    )
  );

create or replace function public.maritime_partner_member_without_admin(p_partner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select p_partner_id is not null and (
    exists (
      select 1
      from public.partner_businesses business
      join public.profiles profile on profile.id = auth.uid()
      where business.id = p_partner_id
        and business.owner_id = auth.uid()
        and business.status = 'active'
        and profile.role = 'partner'
    )
    or exists (
      select 1
      from public.partner_staff staff
      join public.partner_businesses business on business.id = staff.partner_id
      join public.profiles profile on profile.id = auth.uid()
      where staff.partner_id = p_partner_id
        and staff.user_id = auth.uid()
        and staff.status = 'active'
        and business.status = 'active'
        and profile.role = 'partner'
    )
  );
$$;

revoke all on function public.partner_member_has_access(uuid) from public;
grant execute on function public.partner_member_has_access(uuid) to authenticated, service_role;
revoke all on function public.maritime_partner_member_without_admin(uuid) from public;
grant execute on function public.maritime_partner_member_without_admin(uuid) to authenticated, service_role;
