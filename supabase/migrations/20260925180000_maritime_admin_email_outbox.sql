create table if not exists public.maritime_admin_email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  resource_type text,
  resource_id text,
  actor_id uuid,
  recipient text not null,
  subject text not null,
  body_text text not null,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists maritime_admin_email_outbox_due_idx
  on public.maritime_admin_email_outbox (next_attempt_at, created_at)
  where status in ('queued', 'sending', 'failed');

alter table public.maritime_admin_email_outbox enable row level security;
revoke all on public.maritime_admin_email_outbox from public, anon, authenticated;
grant select, insert, update on public.maritime_admin_email_outbox to service_role;

create or replace function public.claim_maritime_admin_email(p_id uuid)
returns setof public.maritime_admin_email_outbox
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  return query update public.maritime_admin_email_outbox o
    set status = 'sending', attempts = o.attempts + 1,
        lease_until = now() + interval '2 minutes'
    where o.id = p_id and o.attempts < 8
      and o.next_attempt_at <= now()
      and (o.status in ('queued', 'failed') or (o.status = 'sending' and o.lease_until < now()))
    returning o.*;
end;
$$;
revoke all on function public.claim_maritime_admin_email(uuid) from public, anon, authenticated;
grant execute on function public.claim_maritime_admin_email(uuid) to service_role;

comment on table public.maritime_admin_email_outbox is
  'Internal maritime request notifications. Holds limited metadata, no document bodies or credentials.';
