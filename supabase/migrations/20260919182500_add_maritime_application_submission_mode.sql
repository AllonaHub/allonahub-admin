alter table public.maritime_hiring_applications
  add column if not exists submission_mode text;

update public.maritime_hiring_applications
set submission_mode = case
  when metadata ->> 'application_mode' = 'automatic' then 'automatic'
  else 'manual'
end
where submission_mode is null
   or submission_mode not in ('manual', 'automatic');

alter table public.maritime_hiring_applications
  alter column submission_mode set default 'manual',
  alter column submission_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'maritime_hiring_applications_submission_mode_check'
      and conrelid = 'public.maritime_hiring_applications'::regclass
  ) then
    alter table public.maritime_hiring_applications
      add constraint maritime_hiring_applications_submission_mode_check
      check (submission_mode in ('manual', 'automatic'));
  end if;
end
$$;

create index if not exists maritime_hiring_applications_user_mode_created_idx
  on public.maritime_hiring_applications(seafarer_user_id, submission_mode, created_at desc);

drop trigger if exists maritime_application_match_firewall on public.maritime_hiring_applications;
create trigger maritime_application_match_firewall
  before insert or update of status, job_id, seafarer_user_id, metadata, submission_mode
  on public.maritime_hiring_applications
  for each row execute function public.enforce_maritime_application_match_firewall();

comment on column public.maritime_hiring_applications.submission_mode is
  'Identifies whether an application was submitted manually by the candidate or by the authorized automatic application flow.';

create table if not exists public.maritime_auto_apply_preferences (
  seafarer_user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  consent_version text not null default 'maritime-auto-apply-v1',
  consent_snapshot jsonb not null default '{}'::jsonb,
  enabled_at timestamptz,
  disabled_at timestamptz,
  last_processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maritime_auto_apply_preferences enable row level security;

drop policy if exists maritime_auto_apply_preferences_select_own_or_admin on public.maritime_auto_apply_preferences;
create policy maritime_auto_apply_preferences_select_own_or_admin
  on public.maritime_auto_apply_preferences
  for select
  to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

revoke all on table public.maritime_auto_apply_preferences from public, anon, authenticated;
grant select on table public.maritime_auto_apply_preferences to authenticated;
grant all on table public.maritime_auto_apply_preferences to service_role;

create or replace function public.apply_maritime_automatic_applications(
  p_user_id uuid,
  p_run_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if not exists (
    select 1
    from public.maritime_auto_apply_preferences preference
    where preference.seafarer_user_id = p_user_id
      and preference.enabled
  ) then
    return 0;
  end if;
  if p_run_id is null or not exists (
    select 1
    from public.maritime_smart_account_runs run
    where run.id = p_run_id
      and run.seafarer_user_id = p_user_id
      and run.status = 'user_confirmed'
      and run.rule_version = 'maritime-smart-account-v6'
      and coalesce((run.smart_snapshot #>> '{readiness,ready_to_apply}')::boolean, false)
  ) then
    return 0;
  end if;

  insert into public.maritime_hiring_applications (
    job_id,
    partner_id,
    seafarer_user_id,
    status,
    submission_mode,
    submitted_at,
    candidate_consent_snapshot,
    metadata
  )
  select
    job.id,
    job.partner_id,
    run.seafarer_user_id,
    'submitted',
    'automatic',
    now(),
    jsonb_build_object(
      'permission', 'automatic_application',
      'automatic_apply_opt_in', true,
      'automatic_apply_consent_version', 'maritime-auto-apply-v1',
      'smart_account_run_id', run.id,
      'final_submission_confirmed', true,
      'final_submission_confirmed_at', now()
    ),
    jsonb_build_object(
      'smart_account_run_id', run.id,
      'application_mode', 'automatic',
      'job_title', job.job_title,
      'job_reference', job.job_reference,
      'location_label', coalesce(job.metadata ->> 'location_label', ''),
      'detail_label', coalesce(job.metadata ->> 'detail_label', ''),
      'company_contact_visible', false
    )
  from public.maritime_smart_account_runs run
  join public.maritime_match_results match
    on match.smart_account_run_id = run.id
   and match.seafarer_user_id = run.seafarer_user_id
  join public.maritime_jobs job
    on job.id = match.job_id
   and job.status = 'open'
  join public.partner_businesses partner
    on partner.id = job.partner_id
   and partner.status = 'active'
   and partner.verification_status = 'verified'
   and partner.partner_type = 'maritime'
  where run.id = p_run_id
    and run.seafarer_user_id = p_user_id
    and run.status = 'user_confirmed'
    and run.rule_version = 'maritime-smart-account-v6'
    and coalesce((run.smart_snapshot #>> '{readiness,ready_to_apply}')::boolean, false)
    and match.hard_gate_status = 'passed'
    and match.stale_after > now()
    and coalesce((match.metadata ->> 'eligible')::boolean, false)
  on conflict (job_id, seafarer_user_id) do nothing;

  get diagnostics inserted_count = row_count;
  update public.maritime_auto_apply_preferences
  set last_processed_at = now(), updated_at = now()
  where seafarer_user_id = p_user_id;
  return inserted_count;
end;
$$;

create or replace function public.set_maritime_auto_apply_preference(
  p_enabled boolean,
  p_confirmation boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row public.maritime_smart_account_runs%rowtype;
  submitted_count integer := 0;
begin
  if auth.uid() is null or p_confirmation is not true then
    raise exception 'explicit automatic application consent required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'customer account required' using errcode = '42501';
  end if;

  if p_enabled then
    select run.* into run_row
    from public.maritime_smart_account_runs run
    where run.seafarer_user_id = auth.uid()
      and run.status = 'user_confirmed'
      and run.rule_version = 'maritime-smart-account-v6'
      and coalesce((run.smart_snapshot #>> '{readiness,ready_to_apply}')::boolean, false)
    order by run.created_at desc
    limit 1;
    if run_row.id is null then
      raise exception 'confirmed eligible Global CV required' using errcode = 'P0001';
    end if;
  end if;

  insert into public.maritime_auto_apply_preferences (
    seafarer_user_id,
    enabled,
    consent_version,
    consent_snapshot,
    enabled_at,
    disabled_at
  ) values (
    auth.uid(),
    p_enabled,
    'maritime-auto-apply-v1',
    jsonb_build_object('confirmed_at', now(), 'enabled', p_enabled),
    case when p_enabled then now() else null end,
    case when p_enabled then null else now() end
  )
  on conflict (seafarer_user_id) do update
  set enabled = excluded.enabled,
      consent_version = excluded.consent_version,
      consent_snapshot = excluded.consent_snapshot,
      enabled_at = case when excluded.enabled then now() else maritime_auto_apply_preferences.enabled_at end,
      disabled_at = case when excluded.enabled then null else now() end,
      updated_at = now();

  if p_enabled then
    submitted_count := public.apply_maritime_automatic_applications(auth.uid(), run_row.id);
  end if;

  return jsonb_build_object(
    'enabled', p_enabled,
    'submitted_count', submitted_count,
    'updated_at', now()
  );
end;
$$;

create or replace function public.maritime_auto_apply_after_run_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'user_confirmed' and old.status is distinct from new.status then
    perform public.apply_maritime_automatic_applications(new.seafarer_user_id, new.id);
  end if;
  return new;
end;
$$;

create or replace function public.maritime_auto_apply_after_match_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.hard_gate_status = 'passed'
    and new.stale_after > now()
    and coalesce((new.metadata ->> 'eligible')::boolean, false) then
    perform public.apply_maritime_automatic_applications(new.seafarer_user_id, new.smart_account_run_id);
  end if;
  return new;
end;
$$;

drop trigger if exists maritime_auto_apply_run_confirmation on public.maritime_smart_account_runs;
create trigger maritime_auto_apply_run_confirmation
  after update of status on public.maritime_smart_account_runs
  for each row execute function public.maritime_auto_apply_after_run_confirmation();

drop trigger if exists maritime_auto_apply_match_change on public.maritime_match_results;
create trigger maritime_auto_apply_match_change
  after insert or update of hard_gate_status, stale_after, metadata on public.maritime_match_results
  for each row execute function public.maritime_auto_apply_after_match_change();

revoke all on function public.apply_maritime_automatic_applications(uuid,uuid) from public, anon, authenticated;
revoke all on function public.set_maritime_auto_apply_preference(boolean,boolean) from public, anon;
revoke all on function public.maritime_auto_apply_after_run_confirmation() from public, anon, authenticated;
revoke all on function public.maritime_auto_apply_after_match_change() from public, anon, authenticated;
grant execute on function public.apply_maritime_automatic_applications(uuid,uuid) to service_role;
grant execute on function public.set_maritime_auto_apply_preference(boolean,boolean) to authenticated, service_role;
grant execute on function public.maritime_auto_apply_after_run_confirmation() to service_role;
grant execute on function public.maritime_auto_apply_after_match_change() to service_role;

comment on table public.maritime_auto_apply_preferences is
  'Stores explicit, revocable seafarer consent for automatic applications to fresh hard-gate-passed matches.';
comment on function public.apply_maritime_automatic_applications(uuid,uuid) is
  'Submits only current eligible matches for a user with active automatic-application consent.';
