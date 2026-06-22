create extension if not exists pgcrypto;

create table if not exists public.social_media_connector_secrets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.social_media_accounts(id) on delete set null,
  platform text not null
    check (platform in ('instagram', 'facebook', 'threads', 'x', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'nsosyal', 'telegram', 'whatsapp', 'google_business', 'other')),
  secret_key text not null check (secret_key ~ '^[A-Z0-9_:-]{2,90}$'),
  secret_label text not null default '',
  encrypted_value text not null,
  status text not null default 'active'
    check (status in ('active', 'needs_rotation', 'disabled')),
  expires_at timestamptz,
  last_verified_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists social_media_connector_secrets_unique_scope_idx
  on public.social_media_connector_secrets(platform, secret_key, coalesce(account_id::text, 'global'));

create index if not exists social_media_connector_secrets_status_idx
  on public.social_media_connector_secrets(platform, status, updated_at desc);

drop trigger if exists social_media_connector_secrets_set_updated_at on public.social_media_connector_secrets;
create trigger social_media_connector_secrets_set_updated_at
  before update on public.social_media_connector_secrets
  for each row execute function public.set_updated_at();

drop trigger if exists social_media_connector_secrets_no_delete on public.social_media_connector_secrets;
create trigger social_media_connector_secrets_no_delete
  before delete on public.social_media_connector_secrets
  for each row execute function public.block_admin_ops_delete();

alter table public.social_media_connector_secrets enable row level security;

drop policy if exists "social_media_connector_secrets_no_client_select" on public.social_media_connector_secrets;
create policy "social_media_connector_secrets_no_client_select"
  on public.social_media_connector_secrets for select
  to authenticated
  using (false);

drop policy if exists "social_media_connector_secrets_no_client_insert" on public.social_media_connector_secrets;
create policy "social_media_connector_secrets_no_client_insert"
  on public.social_media_connector_secrets for insert
  to authenticated
  with check (false);

drop policy if exists "social_media_connector_secrets_no_client_update" on public.social_media_connector_secrets;
create policy "social_media_connector_secrets_no_client_update"
  on public.social_media_connector_secrets for update
  to authenticated
  using (false)
  with check (false);

revoke all on public.social_media_connector_secrets from anon;
revoke all on public.social_media_connector_secrets from authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.social_media_connector_secrets to service_role;
  end if;
end $$;

comment on table public.social_media_connector_secrets is
  'Encrypted server-side social media connector secrets. Client roles cannot read, insert, update, or delete rows directly.';
