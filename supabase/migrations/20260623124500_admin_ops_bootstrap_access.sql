create or replace function public.is_ops_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin';
$$;

comment on function public.is_ops_admin() is
  'Admin Panel role helper. Super Admin is intentionally excluded; MFA enforcement is controlled by backend ADMIN_MFA_ENFORCED while launch MFA onboarding is being completed.';
