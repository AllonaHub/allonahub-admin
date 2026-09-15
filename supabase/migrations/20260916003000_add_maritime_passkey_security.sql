create extension if not exists pgcrypto;

create table if not exists public.maritime_passkey_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0 check (counter >= 0),
  transports text[] not null default '{}'::text[],
  credential_device_type text not null check (credential_device_type in ('singleDevice', 'multiDevice')),
  credential_backed_up boolean not null default false,
  authenticator_attachment text not null default 'platform' check (authenticator_attachment = 'platform'),
  aaguid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.maritime_passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ceremony text not null check (ceremony in ('registration', 'authentication')),
  challenge text not null unique,
  origin text not null,
  rp_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists maritime_passkey_challenges_user_idx
  on public.maritime_passkey_challenges(user_id, ceremony, created_at desc);
create index if not exists maritime_passkey_challenges_expiry_idx
  on public.maritime_passkey_challenges(expires_at)
  where consumed_at is null;

create table if not exists public.maritime_passkey_proofs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  proof_hash text not null unique,
  scope text not null default 'maritime_sensitive' check (scope = 'maritime_sensitive'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint maritime_passkey_proof_hash_format check (proof_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists maritime_passkey_proofs_user_idx
  on public.maritime_passkey_proofs(user_id, created_at desc);
create index if not exists maritime_passkey_proofs_expiry_idx
  on public.maritime_passkey_proofs(expires_at)
  where consumed_at is null;

alter table public.maritime_passkey_credentials enable row level security;
alter table public.maritime_passkey_challenges enable row level security;
alter table public.maritime_passkey_proofs enable row level security;

revoke all on public.maritime_passkey_credentials from public, anon, authenticated;
revoke all on public.maritime_passkey_challenges from public, anon, authenticated;
revoke all on public.maritime_passkey_proofs from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.maritime_passkey_credentials to service_role;
    grant all on public.maritime_passkey_challenges to service_role;
    grant all on public.maritime_passkey_proofs to service_role;
  end if;
end $$;

create or replace function public.maritime_consume_passkey_proof(
  p_user_id uuid,
  p_proof_hash text,
  p_scope text default 'maritime_sensitive'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proof_id uuid;
begin
  if p_user_id is null
    or coalesce(p_proof_hash, '') !~ '^[0-9a-f]{64}$'
    or p_scope <> 'maritime_sensitive' then
    return false;
  end if;

  update public.maritime_passkey_proofs proof
  set consumed_at = now()
  where proof.user_id = p_user_id
    and proof.proof_hash = p_proof_hash
    and proof.scope = p_scope
    and proof.consumed_at is null
    and proof.expires_at > now()
  returning proof.id into v_proof_id;

  return v_proof_id is not null;
end;
$$;

revoke all on function public.maritime_consume_passkey_proof(uuid, text, text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.maritime_consume_passkey_proof(uuid, text, text) to service_role;
  end if;
end $$;

comment on table public.maritime_passkey_credentials is
  'Private WebAuthn platform credentials for high-risk Maritime CV and application actions. One active credential per customer account.';
comment on table public.maritime_passkey_challenges is
  'Short-lived, single-use WebAuthn ceremony challenges bound to an account, RP ID and origin.';
comment on table public.maritime_passkey_proofs is
  'Short-lived, single-use proof tokens issued only after verified WebAuthn user verification.';
comment on function public.maritime_consume_passkey_proof(uuid, text, text) is
  'Atomically consumes a valid, unexpired Maritime WebAuthn proof. Direct client execution is denied.';
