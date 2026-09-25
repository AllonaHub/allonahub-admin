-- Job alerts are private, server-delivered and gated by the candidate's current availability.
create table if not exists public.maritime_job_alert_settings (
  singleton boolean primary key default true check (singleton),
  premium_only boolean not null default false
);
insert into public.maritime_job_alert_settings(singleton) values (true)
on conflict (singleton) do nothing;
alter table public.maritime_job_alert_settings enable row level security;
revoke all on public.maritime_job_alert_settings from public, anon, authenticated;
grant select, update on public.maritime_job_alert_settings to service_role;

alter table public.maritime_seafarer_workspaces
  add column if not exists job_email_opted_in_at timestamptz;

create or replace function public.sync_maritime_job_email_opt_in()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.current_work_status = 'available_now' then
    if tg_op = 'INSERT' then
      new.job_email_opted_in_at := now();
    else
      new.job_email_opted_in_at := coalesce(old.job_email_opted_in_at, now());
    end if;
  else
    new.job_email_opted_in_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists maritime_job_email_opt_in_on_availability on public.maritime_seafarer_workspaces;
create trigger maritime_job_email_opt_in_on_availability
  before insert or update of current_work_status on public.maritime_seafarer_workspaces
  for each row execute function public.sync_maritime_job_email_opt_in();

create table if not exists public.maritime_job_email_alerts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.maritime_jobs(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','suppressed')),
  attempts integer not null default 0 check (attempts between 0 and 12),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, seafarer_user_id)
);
create index if not exists maritime_job_email_alerts_due_idx
  on public.maritime_job_email_alerts (next_attempt_at, created_at)
  where status in ('queued','failed','sending');
create index if not exists maritime_workspaces_available_email_idx
  on public.maritime_seafarer_workspaces (user_id)
  where current_work_status = 'available_now';
alter table public.maritime_job_email_alerts enable row level security;
revoke all on public.maritime_job_email_alerts from public, anon, authenticated;
grant select, insert, update on public.maritime_job_email_alerts to service_role;

create or replace function public.maritime_job_alert_eligible(p_job_id uuid, p_user_id uuid)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
declare v_premium_only boolean;
declare v_has_membership boolean;
begin
  select premium_only into v_premium_only from public.maritime_job_alert_settings where singleton = true;
  if v_premium_only is distinct from false then
    if to_regclass('public.maritime_premium_memberships') is null then return false; end if;
    execute 'select exists (select 1 from public.maritime_premium_memberships where user_id = $1 and plan_key = ''premium'' and status in (''active'',''trialing'') and (expires_at is null or expires_at > now()))'
      into v_has_membership using p_user_id;
    if not coalesce(v_has_membership, false) then return false; end if;
  end if;
  return exists (
    select 1 from public.maritime_jobs job
    join public.maritime_public_listings listing on listing.id = job.public_listing_id
    join public.partner_businesses partner on partner.id = job.partner_id
    join public.maritime_cv_profiles cv on cv.seafarer_user_id = p_user_id
    join public.maritime_seafarer_workspaces workspace on workspace.user_id = p_user_id
    join auth.users account on account.id = p_user_id
    where job.id = p_job_id and job.status = 'open'
      and listing.status = 'active' and (listing.expires_at is null or listing.expires_at > now())
      and partner.status = 'active' and partner.verification_status = 'verified'
      and partner.partner_type = 'maritime'
      and cv.profile_payload ->> 'data_origin' = 'user_entered_maritime_cv'
      and cv.profile_status not in ('restricted','stale')
      and public.maritime_manual_application_rank(cv.profile_payload ->> 'rank')
        = public.maritime_manual_application_rank(job.rank_code)
      and workspace.current_work_status = 'available_now'
      and workspace.job_email_opted_in_at is not null
      and account.email_confirmed_at is not null and account.email is not null
      and coalesce(account.banned_until, '-infinity'::timestamptz) < now()
  );
end;
$$;
revoke all on function public.maritime_job_alert_eligible(uuid,uuid) from public, anon, authenticated;
grant execute on function public.maritime_job_alert_eligible(uuid,uuid) to service_role;

create or replace function public.queue_maritime_job_email_alerts()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'open' then return new; end if;
  elsif new.status <> 'open' or old.status = 'open' then
    return new;
  end if;
  if new.status = 'open' then
    insert into public.maritime_job_email_alerts (job_id, seafarer_user_id)
    select new.id, workspace.user_id
    from public.maritime_seafarer_workspaces workspace
    where workspace.current_work_status = 'available_now'
      and public.maritime_job_alert_eligible(new.id, workspace.user_id)
    on conflict (job_id, seafarer_user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.queue_maritime_job_email_alerts() from public, anon, authenticated;
drop trigger if exists maritime_job_email_alerts_queue on public.maritime_jobs;
create trigger maritime_job_email_alerts_queue
  after insert or update of status on public.maritime_jobs
  for each row execute function public.queue_maritime_job_email_alerts();

create or replace function public.queue_maritime_listing_email_alerts()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare v_job public.maritime_jobs%rowtype;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    for v_job in select * from public.maritime_jobs where public_listing_id = new.id and status = 'open' loop
      insert into public.maritime_job_email_alerts (job_id, seafarer_user_id)
      select v_job.id, workspace.user_id
      from public.maritime_seafarer_workspaces workspace
      where workspace.current_work_status = 'available_now'
        and public.maritime_job_alert_eligible(v_job.id, workspace.user_id)
      on conflict (job_id, seafarer_user_id) do nothing;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.queue_maritime_listing_email_alerts() from public, anon, authenticated;
drop trigger if exists maritime_listing_email_alerts_queue on public.maritime_public_listings;
create trigger maritime_listing_email_alerts_queue
  after update of status on public.maritime_public_listings
  for each row execute function public.queue_maritime_listing_email_alerts();

create or replace function public.claim_maritime_job_email_alert(p_id uuid)
returns table (id uuid, recipient text, job_id uuid, title text, summary text, rank_code text)
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare v_row public.maritime_job_email_alerts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'trusted backend required' using errcode = '42501';
  end if;
  select * into v_row from public.maritime_job_email_alerts alert
  where alert.id = p_id and alert.attempts < 12
    and alert.status in ('queued','failed','sending')
    and alert.next_attempt_at <= now()
    and (alert.status <> 'sending' or alert.lease_until < now())
  for update skip locked;
  if not found then return; end if;
  if not public.maritime_job_alert_eligible(v_row.job_id, v_row.seafarer_user_id) then
    update public.maritime_job_email_alerts set status = 'suppressed', lease_until = null where maritime_job_email_alerts.id = v_row.id;
    return;
  end if;
  update public.maritime_job_email_alerts set status = 'sending', attempts = attempts + 1,
    lease_until = now() + interval '2 minutes' where maritime_job_email_alerts.id = v_row.id;
  return query select v_row.id, account.email::text, job.id,
    listing.title::text, listing.summary::text, job.rank_code::text
    from public.maritime_jobs job
    join public.maritime_public_listings listing on listing.id = job.public_listing_id
    join auth.users account on account.id = v_row.seafarer_user_id
    where job.id = v_row.job_id;
end;
$$;
revoke all on function public.claim_maritime_job_email_alert(uuid) from public, anon, authenticated;
grant execute on function public.claim_maritime_job_email_alert(uuid) to service_role;
