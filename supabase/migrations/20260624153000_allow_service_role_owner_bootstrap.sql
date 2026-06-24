create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'Profile id cannot be changed';
    end if;

    if new.role is distinct from old.role
      and coalesce(auth.role(), '') <> 'service_role'
      and not public.is_super_admin() then
      raise exception 'Only MFA verified super admin or backend service role can change roles';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.protect_profile_security_fields() is
  'Protects role/security profile fields. Client role changes require MFA verified super admin; backend service_role is allowed for audited owner bootstrap and admin APIs.';
