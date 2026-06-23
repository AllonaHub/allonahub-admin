create or replace function public.is_ops_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin' and public.has_mfa();
$$;

comment on function public.is_ops_admin() is
  'Strict Admin Panel role helper. Super Admin is intentionally excluded so the Admin Panel remains a limited operations surface. Requires MFA2 via public.has_mfa().';
