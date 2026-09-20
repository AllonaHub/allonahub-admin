-- Keep a verified partner's account role aligned with its approved business
-- membership. This is intentionally one-way: deactivation does not demote a
-- user who may still own or staff another verified business.

create or replace function public.sync_verified_partner_business_roles()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'active' and new.verification_status = 'verified' then
    update public.profiles
       set role = 'partner'
     where id = new.owner_id
       and role not in ('admin', 'super_admin');

    update public.profiles profile
       set role = 'partner'
      from public.partner_staff staff
     where staff.partner_id = new.id
       and staff.user_id = profile.id
       and staff.status = 'active'
       and profile.role not in ('admin', 'super_admin');
  end if;
  return new;
end;
$$;

create or replace function public.sync_verified_partner_staff_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'active'
     and new.user_id is not null
     and exists (
       select 1
         from public.partner_businesses business
        where business.id = new.partner_id
          and business.status = 'active'
          and business.verification_status = 'verified'
     ) then
    update public.profiles
       set role = 'partner'
     where id = new.user_id
       and role not in ('admin', 'super_admin');
  end if;
  return new;
end;
$$;

revoke all on function public.sync_verified_partner_business_roles() from public, anon, authenticated;
revoke all on function public.sync_verified_partner_staff_role() from public, anon, authenticated;
grant execute on function public.sync_verified_partner_business_roles() to service_role;
grant execute on function public.sync_verified_partner_staff_role() to service_role;

drop trigger if exists partner_businesses_sync_verified_roles on public.partner_businesses;
create trigger partner_businesses_sync_verified_roles
  after insert or update of owner_id, status, verification_status
  on public.partner_businesses
  for each row execute function public.sync_verified_partner_business_roles();

drop trigger if exists partner_staff_sync_verified_role on public.partner_staff;
create trigger partner_staff_sync_verified_role
  after insert or update of partner_id, user_id, status
  on public.partner_staff
  for each row execute function public.sync_verified_partner_staff_role();

update public.profiles profile
   set role = 'partner'
 where profile.role not in ('admin', 'super_admin')
   and exists (
     select 1
       from public.partner_businesses business
      where business.owner_id = profile.id
        and business.status = 'active'
        and business.verification_status = 'verified'
   );

update public.profiles profile
   set role = 'partner'
 where profile.role not in ('admin', 'super_admin')
   and exists (
     select 1
       from public.partner_staff staff
       join public.partner_businesses business on business.id = staff.partner_id
      where staff.user_id = profile.id
        and staff.status = 'active'
        and business.status = 'active'
        and business.verification_status = 'verified'
   );
