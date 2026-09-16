create table if not exists public.maritime_reference_verification_requests (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  experience_id uuid not null,
  public_id text not null,
  candidate_name text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed')),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  email_to text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  provider text,
  provider_message_id text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seafarer_user_id, experience_id, fingerprint)
);

create index if not exists maritime_reference_verification_status_idx
  on public.maritime_reference_verification_requests(status, created_at);

create index if not exists maritime_reference_verification_user_idx
  on public.maritime_reference_verification_requests(seafarer_user_id, experience_id, created_at desc);

drop trigger if exists maritime_reference_verification_set_updated_at
  on public.maritime_reference_verification_requests;
create trigger maritime_reference_verification_set_updated_at
  before update on public.maritime_reference_verification_requests
  for each row execute function public.set_updated_at();

alter table public.maritime_reference_verification_requests enable row level security;
revoke all on public.maritime_reference_verification_requests from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.maritime_reference_verification_requests to service_role;
  end if;
end
$$;

comment on table public.maritime_reference_verification_requests is
  'Private, idempotent outbox and delivery record for maritime employment-reference verification notices.';

comment on column public.maritime_reference_verification_requests.payload is
  'Minimal verification payload only. Passport numbers, birth dates, addresses and emergency contacts must not be stored here.';

-- User-owned maritime documents remain available until the user deletes or replaces them.
update public.maritime_document_intakes
set retention_until = null
where retention_until is not null;
