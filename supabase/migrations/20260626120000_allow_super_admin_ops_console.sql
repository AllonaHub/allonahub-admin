create or replace function public.is_ops_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() in ('admin', 'super_admin') and public.has_mfa();
$$;

comment on function public.is_ops_admin() is
  'Strict Admin Panel role helper. Allows MFA-verified Admin and Super Admin users to use the limited operations console; Super Admin-only controls remain outside the Admin Panel.';
