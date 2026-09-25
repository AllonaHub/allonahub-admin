create table if not exists public.allonahub_welcome_guide_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  attempts integer not null default 0 check (attempts between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists allonahub_welcome_guide_due_idx
  on public.allonahub_welcome_guide_emails(next_attempt_at, created_at)
  where status in ('queued','failed','sending');
alter table public.allonahub_welcome_guide_emails enable row level security;
revoke all on public.allonahub_welcome_guide_emails from public, anon, authenticated;
grant select, insert, update on public.allonahub_welcome_guide_emails to service_role;

create or replace function public.queue_allonahub_welcome_guide()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, auth as $$
begin
  if new.email_confirmed_at is null or new.email is null then return new; end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then return new; end if;
  if new.email_confirmed_at is not null then
    insert into public.allonahub_welcome_guide_emails(user_id, next_attempt_at)
    values (new.id, now() + interval '2 minutes')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.queue_allonahub_welcome_guide() from public, anon, authenticated;
drop trigger if exists auth_user_allonahub_welcome_guide on auth.users;
create trigger auth_user_allonahub_welcome_guide
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.queue_allonahub_welcome_guide();

create or replace function public.claim_allonahub_welcome_guide(p_user_id uuid)
returns table (user_id uuid, recipient text)
language plpgsql security definer
set search_path = pg_catalog, public, auth as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'trusted backend required' using errcode = '42501';
  end if;
  return query
    update public.allonahub_welcome_guide_emails guide
    set status = 'sending', attempts = guide.attempts + 1,
        lease_until = now() + interval '2 minutes'
    from auth.users account
    where guide.user_id = p_user_id and account.id = guide.user_id
      and account.email_confirmed_at is not null and account.email is not null
      and guide.attempts < 8 and guide.next_attempt_at <= now()
      and (guide.status in ('queued','failed') or
           (guide.status = 'sending' and guide.lease_until < now()))
    returning guide.user_id, account.email::text;
end;
$$;
revoke all on function public.claim_allonahub_welcome_guide(uuid) from public, anon, authenticated;
grant execute on function public.claim_allonahub_welcome_guide(uuid) to service_role;
