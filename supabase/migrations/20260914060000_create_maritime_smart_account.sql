create table if not exists public.maritime_smart_account_runs (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'user_confirmed', 'superseded', 'revoked')),
  rule_version text not null,
  input_snapshot_hash text not null,
  smart_snapshot jsonb not null default '{}'::jsonb,
  match_count integer not null default 0 check (match_count between 0 and 100),
  eligible_match_count integer not null default 0 check (eligible_match_count between 0 and match_count),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_smart_account_confirmed_check
    check (status <> 'user_confirmed' or confirmed_at is not null)
);

create table if not exists public.maritime_application_permission_batches (
  id uuid primary key default gen_random_uuid(),
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  smart_account_run_id uuid not null references public.maritime_smart_account_runs(id) on delete cascade,
  status text not null default 'drafts_prepared'
    check (status in ('drafts_prepared', 'partially_submitted', 'submitted', 'revoked')),
  job_ids uuid[] not null default '{}'::uuid[],
  permission_scope text not null default 'prepare_application_drafts_only'
    check (permission_scope = 'prepare_application_drafts_only'),
  consent_version text not null default 'maritime-application-draft-v1',
  consent_snapshot jsonb not null default '{}'::jsonb,
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seafarer_user_id, smart_account_run_id)
);

alter table public.maritime_match_results
  add column if not exists smart_account_run_id uuid references public.maritime_smart_account_runs(id) on delete set null;

alter table public.maritime_jobs
  add column if not exists public_listing_id uuid references public.maritime_public_listings(id) on delete set null;

alter table public.maritime_public_listings
  add column if not exists matching_requirements jsonb not null default '{}'::jsonb;

create index if not exists maritime_smart_account_runs_user_idx
  on public.maritime_smart_account_runs(seafarer_user_id, created_at desc);
create unique index if not exists maritime_smart_account_runs_active_hash_unique
  on public.maritime_smart_account_runs(seafarer_user_id, input_snapshot_hash)
  where status in ('draft', 'user_confirmed');
create index if not exists maritime_application_permission_batches_user_idx
  on public.maritime_application_permission_batches(seafarer_user_id, created_at desc);
create unique index if not exists maritime_match_results_run_job_unique
  on public.maritime_match_results(smart_account_run_id, job_id)
  where smart_account_run_id is not null;
create unique index if not exists maritime_jobs_public_listing_unique
  on public.maritime_jobs(public_listing_id)
  where public_listing_id is not null;

drop trigger if exists maritime_smart_account_runs_set_updated_at on public.maritime_smart_account_runs;
create trigger maritime_smart_account_runs_set_updated_at
  before update on public.maritime_smart_account_runs
  for each row execute function public.set_updated_at();

drop trigger if exists maritime_application_permission_batches_set_updated_at on public.maritime_application_permission_batches;
create trigger maritime_application_permission_batches_set_updated_at
  before update on public.maritime_application_permission_batches
  for each row execute function public.set_updated_at();

alter table public.maritime_smart_account_runs enable row level security;
alter table public.maritime_application_permission_batches enable row level security;

create or replace function public.sync_maritime_public_listing_job_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.listing_type = 'crew_position' and new.status is distinct from old.status then
    update public.maritime_jobs
    set status = case new.status
          when 'active' then 'open'
          when 'paused' then 'paused'
          when 'rejected' then 'cancelled'
          when 'archived' then 'closed'
          else status
        end,
        opened_at = case when new.status = 'active' then coalesce(opened_at, now()) else opened_at end,
        closed_at = case when new.status in ('rejected', 'archived') then now() else closed_at end,
        metadata = metadata || jsonb_build_object('public_listing_status', new.status)
    where public_listing_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists maritime_public_listing_sync_smart_job on public.maritime_public_listings;
create trigger maritime_public_listing_sync_smart_job
  after update of status on public.maritime_public_listings
  for each row execute function public.sync_maritime_public_listing_job_status();

create or replace function public.invalidate_maritime_smart_account_after_document_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmed' and old.status is distinct from new.status then
    update public.maritime_smart_account_runs
    set status = 'superseded'
    where seafarer_user_id = new.seafarer_user_id
      and status in ('draft', 'user_confirmed');

    update public.maritime_match_results
    set hard_gate_status = 'stale', stale_after = now()
    where seafarer_user_id = new.seafarer_user_id
      and smart_account_run_id is not null
      and hard_gate_status <> 'stale';
  end if;
  return new;
end;
$$;

drop trigger if exists maritime_document_confirmation_invalidates_smart_account on public.maritime_document_extractions;
create trigger maritime_document_confirmation_invalidates_smart_account
  after update of status on public.maritime_document_extractions
  for each row execute function public.invalidate_maritime_smart_account_after_document_change();

create or replace function public.invalidate_maritime_smart_account_after_readiness_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_user_id uuid;
begin
  affected_user_id := case when tg_op = 'DELETE' then old.seafarer_user_id else new.seafarer_user_id end;

  update public.maritime_smart_account_runs
  set status = 'superseded'
  where seafarer_user_id = affected_user_id
    and status in ('draft', 'user_confirmed');

  update public.maritime_match_results
  set hard_gate_status = 'stale', stale_after = now()
  where seafarer_user_id = affected_user_id
    and smart_account_run_id is not null
    and hard_gate_status <> 'stale';

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists maritime_readiness_insert_delete_invalidates_smart_account on public.maritime_readiness_items;
create trigger maritime_readiness_insert_delete_invalidates_smart_account
  after insert or delete on public.maritime_readiness_items
  for each row execute function public.invalidate_maritime_smart_account_after_readiness_change();

drop trigger if exists maritime_readiness_update_invalidates_smart_account on public.maritime_readiness_items;
create trigger maritime_readiness_update_invalidates_smart_account
  after update of trust_level, verification_status, value_payload, expires_at on public.maritime_readiness_items
  for each row execute function public.invalidate_maritime_smart_account_after_readiness_change();

create or replace function public.invalidate_maritime_smart_account_after_availability_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.maritime_smart_account_runs
  set status = 'superseded'
  where seafarer_user_id = new.user_id
    and status in ('draft', 'user_confirmed');

  update public.maritime_match_results
  set hard_gate_status = 'stale', stale_after = now()
  where seafarer_user_id = new.user_id
    and smart_account_run_id is not null
    and hard_gate_status <> 'stale';

  return new;
end;
$$;

drop trigger if exists maritime_availability_invalidates_smart_account on public.maritime_seafarer_workspaces;
create trigger maritime_availability_invalidates_smart_account
  after update of current_work_status, availability_status, availability_confirmed_at, availability_stale_after
  on public.maritime_seafarer_workspaces
  for each row execute function public.invalidate_maritime_smart_account_after_availability_change();

create or replace function public.invalidate_maritime_matches_after_job_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     or old.rank_code is distinct from new.rank_code
     or old.job_title is distinct from new.job_title
     or old.contract_start is distinct from new.contract_start
     or old.contract_end is distinct from new.contract_end
     or old.hard_gates is distinct from new.hard_gates
     or old.structured_requirements is distinct from new.structured_requirements then
    new.job_version := old.job_version + 1;
    update public.maritime_match_results
    set hard_gate_status = 'stale', stale_after = now()
    where job_id = old.id and hard_gate_status <> 'stale';
  end if;
  return new;
end;
$$;

drop trigger if exists maritime_job_change_invalidates_matches on public.maritime_jobs;
create trigger maritime_job_change_invalidates_matches
  before update of status, rank_code, job_title, contract_start, contract_end, hard_gates, structured_requirements
  on public.maritime_jobs
  for each row execute function public.invalidate_maritime_matches_after_job_change();

insert into public.maritime_jobs (
  partner_id, public_listing_id, created_by, status, rank_code, job_title,
  hard_gates, structured_requirements, source_free_text, submitted_at, opened_at,
  metadata
)
select
  partner.id,
  listing.id,
  listing.partner_user_id,
  case listing.status when 'active' then 'open' when 'paused' then 'paused' else 'pending_review' end,
  null,
  listing.title,
  jsonb_build_object('requirements_complete', false),
  '{}'::jsonb,
  listing.summary,
  listing.submitted_at,
  case when listing.status = 'active' then listing.published_at else null end,
  jsonb_build_object(
    'source', 'maritime_public_listing_backfill',
    'location_label', listing.location_label,
    'detail_label', listing.detail_label,
    'requirements_complete', false,
    'company_contact_visible', false
  )
from public.maritime_public_listings listing
join lateral (
  select business.id
  from public.partner_businesses business
  where business.owner_id = listing.partner_user_id
    and business.partner_type = 'maritime'
    and business.status = 'active'
    and business.verification_status = 'verified'
  order by business.created_at desc
  limit 1
) partner on true
where listing.listing_type = 'crew_position'
  and listing.partner_user_id is not null
  and listing.status in ('pending_review', 'active', 'paused')
on conflict (public_listing_id) do nothing;

drop policy if exists maritime_smart_account_runs_select_own_or_admin on public.maritime_smart_account_runs;
create policy maritime_smart_account_runs_select_own_or_admin
  on public.maritime_smart_account_runs for select to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

drop policy if exists maritime_application_permission_batches_select_own_or_admin on public.maritime_application_permission_batches;
create policy maritime_application_permission_batches_select_own_or_admin
  on public.maritime_application_permission_batches for select to authenticated
  using (seafarer_user_id = auth.uid() or public.is_admin());

revoke all on public.maritime_smart_account_runs from anon, authenticated;
revoke all on public.maritime_application_permission_batches from anon, authenticated;
grant select on public.maritime_smart_account_runs to authenticated;
grant select on public.maritime_application_permission_batches to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.maritime_smart_account_runs to service_role;
    grant all on public.maritime_application_permission_batches to service_role;
  end if;
end $$;

create or replace function public.prepare_maritime_smart_account(
  p_seafarer_user_id uuid,
  p_input_snapshot_hash text,
  p_rule_version text,
  p_smart_snapshot jsonb,
  p_matches jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id uuid;
  match_value jsonb;
  job_row public.maritime_jobs%rowtype;
  score_value numeric(5,2);
  hard_gate_value text;
  match_count_value integer := 0;
  eligible_count_value integer := 0;
  readiness_score_value integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'trusted backend required' using errcode = '42501';
  end if;
  if p_seafarer_user_id is null
     or not exists (select 1 from public.profiles where id = p_seafarer_user_id and role = 'customer') then
    raise exception 'customer account required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.maritime_document_intakes
    where seafarer_user_id = p_seafarer_user_id
      and status in ('user_confirmed', 'verification_pending', 'verified')
  ) then
    raise exception 'confirmed maritime documents required' using errcode = 'P0001';
  end if;
  if p_input_snapshot_hash !~ '^[a-f0-9]{64}$'
     or char_length(coalesce(p_rule_version, '')) not between 3 and 80
     or jsonb_typeof(p_smart_snapshot) <> 'object'
     or octet_length(p_smart_snapshot::text) > 524288
     or jsonb_typeof(p_matches) <> 'array'
     or jsonb_array_length(p_matches) > 100 then
    raise exception 'invalid smart account payload' using errcode = '22023';
  end if;

  readiness_score_value := coalesce((p_smart_snapshot #>> '{readiness,score}')::integer, 0);
  if readiness_score_value not between 0 and 100 then
    raise exception 'invalid readiness score' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_seafarer_user_id::text, 0));

  select id into run_id
  from public.maritime_smart_account_runs
  where seafarer_user_id = p_seafarer_user_id
    and input_snapshot_hash = p_input_snapshot_hash
    and status in ('draft', 'user_confirmed')
    and not exists (
      select 1 from public.maritime_match_results existing_match
      where existing_match.smart_account_run_id = maritime_smart_account_runs.id
        and existing_match.stale_after <= now()
    )
  order by created_at desc
  limit 1;

  if run_id is not null then
    return jsonb_build_object('run_id', run_id, 'idempotent', true);
  end if;

  update public.maritime_smart_account_runs
  set status = 'superseded'
  where seafarer_user_id = p_seafarer_user_id
    and status in ('draft', 'user_confirmed')
    and (status = 'draft' or input_snapshot_hash = p_input_snapshot_hash);

  insert into public.maritime_smart_account_runs (
    seafarer_user_id, status, rule_version, input_snapshot_hash, smart_snapshot,
    match_count, eligible_match_count
  ) values (
    p_seafarer_user_id, 'draft', p_rule_version, p_input_snapshot_hash, p_smart_snapshot,
    jsonb_array_length(p_matches),
    (select count(*) from jsonb_array_elements(p_matches) as item(value) where coalesce((item.value ->> 'eligible')::boolean, false))
  ) returning id, match_count, eligible_match_count into run_id, match_count_value, eligible_count_value;

  insert into public.maritime_seafarer_workspaces (
    user_id, workspace_status, readiness_score, readiness_level, metadata
  ) values (
    p_seafarer_user_id, 'active', readiness_score_value,
    case when coalesce((p_smart_snapshot #>> '{readiness,ready_to_apply}')::boolean, false) then 'ready_review' else 'draft' end,
    jsonb_build_object('latest_smart_account_run_id', run_id, 'smart_rule_version', p_rule_version)
  )
  on conflict (user_id) do update
  set readiness_score = excluded.readiness_score,
      readiness_level = case
        when maritime_seafarer_workspaces.readiness_level = 'verified_ready' then 'verified_ready'
        else excluded.readiness_level
      end,
      metadata = maritime_seafarer_workspaces.metadata || excluded.metadata;

  update public.maritime_readiness_passports
  set readiness_score = readiness_score_value,
      metadata = metadata || jsonb_build_object('latest_smart_account_run_id', run_id, 'smart_rule_version', p_rule_version)
  where seafarer_user_id = p_seafarer_user_id;

  insert into public.maritime_cv_generations (
    seafarer_user_id, passport_id, status, template_version, input_snapshot_hash, metadata
  ) values (
    p_seafarer_user_id,
    (select id from public.maritime_readiness_passports where seafarer_user_id = p_seafarer_user_id),
    'pending_user_approval',
    coalesce(p_smart_snapshot #>> '{cv_draft,template_version}', 'allonahub-maritime-cv-v4'),
    p_input_snapshot_hash,
    jsonb_build_object('smart_account_run_id', run_id, 'cv_draft', p_smart_snapshot -> 'cv_draft')
  );

  for match_value in select value from jsonb_array_elements(p_matches)
  loop
    if coalesce(match_value ->> 'job_id', '') !~ '^[0-9a-f-]{36}$' then
      raise exception 'invalid smart match job' using errcode = '22023';
    end if;
    select job.* into job_row
    from public.maritime_jobs job
    join public.partner_businesses partner on partner.id = job.partner_id
    where job.id = (match_value ->> 'job_id')::uuid
      and job.status = 'open'
      and partner.status = 'active'
      and partner.verification_status = 'verified'
      and partner.partner_type = 'maritime';
    if job_row.id is null then
      raise exception 'unverified or unavailable maritime job' using errcode = 'P0001';
    end if;
    score_value := greatest(0, least(100, coalesce((match_value ->> 'score')::numeric, 0)));
    hard_gate_value := coalesce(match_value ->> 'hard_gate_status', 'needs_data');
    if hard_gate_value not in ('passed', 'failed', 'needs_data', 'stale') then
      raise exception 'invalid hard gate status' using errcode = '22023';
    end if;
    insert into public.maritime_match_results (
      job_id, partner_id, seafarer_user_id, hard_gate_status, hard_gate_reasons,
      preference_score, score_reasons, rule_version, score_version,
      input_snapshot_hash, input_snapshot, computed_at, stale_after,
      smart_account_run_id, metadata
    ) values (
      job_row.id, job_row.partner_id, p_seafarer_user_id, hard_gate_value,
      coalesce(match_value -> 'missing_requirements', '[]'::jsonb), score_value,
      coalesce(match_value -> 'components', '[]'::jsonb), p_rule_version, p_rule_version,
      p_input_snapshot_hash, match_value, now(), now() + interval '24 hours', run_id,
      jsonb_build_object('eligible', coalesce((match_value ->> 'eligible')::boolean, false), 'company_contact_visible', false)
    );
  end loop;

  return jsonb_build_object(
    'run_id', run_id,
    'status', 'draft',
    'match_count', match_count_value,
    'eligible_match_count', eligible_count_value,
    'idempotent', false
  );
end;
$$;

create or replace function public.confirm_maritime_smart_account(p_run_id uuid, p_confirmation boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row public.maritime_smart_account_runs%rowtype;
  now_value timestamptz := now();
begin
  if auth.uid() is null or p_confirmation is not true then
    raise exception 'explicit confirmation required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'customer account required' using errcode = '42501';
  end if;
  select * into run_row from public.maritime_smart_account_runs
  where id = p_run_id and seafarer_user_id = auth.uid() for update;
  if run_row.id is null then
    raise exception 'smart account run not found' using errcode = 'P0002';
  end if;
  if run_row.status = 'user_confirmed' then
    return jsonb_build_object('run_id', run_row.id, 'status', run_row.status, 'idempotent', true);
  end if;
  if run_row.status <> 'draft' then
    raise exception 'smart account state conflict' using errcode = 'P0001';
  end if;
  update public.maritime_smart_account_runs set status = 'user_confirmed', confirmed_at = now_value where id = run_row.id;
  update public.maritime_cv_generations
  set status = 'approved_by_user', user_approved_at = now_value
  where seafarer_user_id = auth.uid()
    and input_snapshot_hash = run_row.input_snapshot_hash
    and status = 'pending_user_approval';
  return jsonb_build_object('run_id', run_row.id, 'status', 'user_confirmed', 'idempotent', false);
end;
$$;

create or replace function public.create_maritime_application_drafts(
  p_run_id uuid,
  p_job_ids uuid[],
  p_confirmation boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row public.maritime_smart_account_runs%rowtype;
  job_id_value uuid;
  job_row public.maritime_jobs%rowtype;
  created_ids uuid[] := '{}'::uuid[];
  application_id_value uuid;
  batch_id_value uuid;
begin
  if auth.uid() is null or p_confirmation is not true then
    raise exception 'explicit draft permission required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'customer account required' using errcode = '42501';
  end if;
  if coalesce(array_length(p_job_ids, 1), 0) not between 1 and 50
     or coalesce(array_length(p_job_ids, 1), 0) <> (select count(distinct selected.job_id) from unnest(p_job_ids) as selected(job_id)) then
    raise exception 'select between 1 and 50 jobs' using errcode = '22023';
  end if;
  select * into run_row from public.maritime_smart_account_runs
  where id = p_run_id and seafarer_user_id = auth.uid() and status = 'user_confirmed';
  if run_row.id is null then
    raise exception 'confirmed smart account required' using errcode = 'P0001';
  end if;

  foreach job_id_value in array p_job_ids
  loop
    if not exists (
      select 1 from public.maritime_match_results match
      where match.smart_account_run_id = run_row.id
        and match.seafarer_user_id = auth.uid()
        and match.job_id = job_id_value
        and match.hard_gate_status = 'passed'
        and match.stale_after > now()
        and coalesce((match.metadata ->> 'eligible')::boolean, false)
    ) then
      raise exception 'job is not an eligible confirmed match' using errcode = 'P0001';
    end if;
    select job.* into job_row
    from public.maritime_jobs job
    join public.partner_businesses partner on partner.id = job.partner_id
    where job.id = job_id_value
      and job.status = 'open'
      and partner.status = 'active'
      and partner.verification_status = 'verified'
      and partner.partner_type = 'maritime';
    if job_row.id is null then
      raise exception 'job is no longer available' using errcode = 'P0001';
    end if;
    insert into public.maritime_hiring_applications (
      job_id, partner_id, seafarer_user_id, status, candidate_consent_snapshot, metadata
    ) values (
      job_row.id, job_row.partner_id, auth.uid(), 'awaiting_candidate_approval',
      jsonb_build_object(
        'permission', 'prepare_application_draft_only',
        'confirmed_at', now(),
        'smart_account_run_id', run_row.id,
        'final_submission_requires_new_confirmation', true
      ),
      jsonb_build_object(
        'smart_account_run_id', run_row.id,
        'job_title', job_row.job_title,
        'job_reference', job_row.job_reference,
        'location_label', coalesce(job_row.metadata ->> 'location_label', ''),
        'company_contact_visible', false
      )
    )
    on conflict (job_id, seafarer_user_id) do nothing
    returning id into application_id_value;
    if application_id_value is not null then
      created_ids := array_append(created_ids, application_id_value);
    end if;
    application_id_value := null;
  end loop;

  insert into public.maritime_application_permission_batches (
    seafarer_user_id, smart_account_run_id, status, job_ids, permission_scope,
    consent_snapshot, approved_at
  ) values (
    auth.uid(), run_row.id, 'drafts_prepared', (select array_agg(distinct selected.job_id) from unnest(p_job_ids) as selected(job_id)),
    'prepare_application_drafts_only',
    jsonb_build_object('final_submission_requires_new_confirmation', true, 'selected_job_count', array_length(p_job_ids, 1)),
    now()
  )
  on conflict (seafarer_user_id, smart_account_run_id) do update
  set job_ids = (select array_agg(distinct selected.job_id) from unnest(maritime_application_permission_batches.job_ids || excluded.job_ids) as selected(job_id)),
      consent_snapshot = excluded.consent_snapshot,
      approved_at = excluded.approved_at
  returning id into batch_id_value;

  return jsonb_build_object(
    'permission_batch_id', batch_id_value,
    'created_application_ids', to_jsonb(created_ids),
    'prepared_count', coalesce(array_length(created_ids, 1), 0),
    'submission_status', 'awaiting_candidate_approval'
  );
end;
$$;

create or replace function public.submit_maritime_application(p_application_id uuid, p_confirmation boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  application_row public.maritime_hiring_applications%rowtype;
  now_value timestamptz := now();
begin
  if auth.uid() is null or p_confirmation is not true then
    raise exception 'explicit submission confirmation required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'customer account required' using errcode = '42501';
  end if;
  select application.* into application_row
  from public.maritime_hiring_applications application
  join public.maritime_jobs job on job.id = application.job_id and job.status = 'open'
  join public.partner_businesses partner on partner.id = application.partner_id
    and partner.status = 'active' and partner.verification_status = 'verified' and partner.partner_type = 'maritime'
  where application.id = p_application_id
    and application.seafarer_user_id = auth.uid()
  for update of application;
  if application_row.id is null then
    raise exception 'application is unavailable' using errcode = 'P0002';
  end if;
  if application_row.status = 'submitted' then
    return jsonb_build_object('application_id', application_row.id, 'status', 'submitted', 'idempotent', true);
  end if;
  if application_row.status not in ('drafted', 'awaiting_candidate_approval') then
    raise exception 'application state conflict' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from public.maritime_smart_account_runs run
    join public.maritime_match_results match
      on match.smart_account_run_id = run.id
     and match.seafarer_user_id = run.seafarer_user_id
    where run.id::text = coalesce(application_row.metadata ->> 'smart_account_run_id', '')
      and run.seafarer_user_id = auth.uid()
      and run.status = 'user_confirmed'
      and match.job_id = application_row.job_id
      and match.hard_gate_status = 'passed'
      and match.stale_after > now()
      and coalesce((match.metadata ->> 'eligible')::boolean, false)
  ) then
    raise exception 'fresh confirmed smart match required' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.maritime_readiness_items item
    where item.seafarer_user_id = auth.uid()
      and item.item_type in ('medical', 'passport', 'seaman_book')
      and item.trust_level in ('user_confirmed', 'employer_confirmed', 'registry_confirmed', 'reviewer_confirmed')
      and item.expires_at is not null
      and item.expires_at <= now()
  ) then
    raise exception 'critical maritime document expired' using errcode = 'P0001';
  end if;
  update public.maritime_hiring_applications
  set status = 'submitted', submitted_at = now_value,
      candidate_consent_snapshot = candidate_consent_snapshot || jsonb_build_object(
        'final_submission_confirmed', true,
        'final_submission_confirmed_at', now_value,
        'consent_version', 'maritime-application-submit-v1'
      )
  where id = application_row.id;
  return jsonb_build_object('application_id', application_row.id, 'status', 'submitted', 'idempotent', false);
end;
$$;

create or replace function public.set_maritime_availability(
  p_work_status text,
  p_available_from date,
  p_confirmation boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_value timestamptz := now();
  stale_value timestamptz := now() + interval '30 days';
begin
  if auth.uid() is null or p_confirmation is not true then
    raise exception 'explicit availability confirmation required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'customer account required' using errcode = '42501';
  end if;
  if p_work_status not in ('available_now', 'available_from_date', 'onboard', 'on_leave', 'not_available') then
    raise exception 'invalid work status' using errcode = '22023';
  end if;
  if p_work_status = 'available_from_date' and (p_available_from is null or p_available_from < current_date) then
    raise exception 'valid available date required' using errcode = '22023';
  end if;
  insert into public.maritime_seafarer_workspaces (
    user_id, workspace_status, current_work_status, availability_status,
    availability_confirmed_at, availability_stale_after, metadata
  ) values (
    auth.uid(), 'active', p_work_status, 'fresh', now_value, stale_value,
    jsonb_strip_nulls(jsonb_build_object('available_from', p_available_from, 'availability_source', 'customer_one_click'))
  )
  on conflict (user_id) do update
  set current_work_status = excluded.current_work_status,
      availability_status = 'fresh',
      availability_confirmed_at = now_value,
      availability_stale_after = stale_value,
      metadata = maritime_seafarer_workspaces.metadata || excluded.metadata;

  insert into public.maritime_work_status_events (
    seafarer_user_id, work_status, availability_status, source_type,
    signal_at, stale_after, created_by, metadata
  ) values (
    auth.uid(), p_work_status, 'fresh', 'user_confirmation',
    now_value, stale_value, auth.uid(), jsonb_strip_nulls(jsonb_build_object('available_from', p_available_from))
  );

  update public.maritime_readiness_passports
  set current_work_status = p_work_status,
      availability_status = 'fresh',
      metadata = metadata || jsonb_strip_nulls(jsonb_build_object('available_from', p_available_from))
  where seafarer_user_id = auth.uid();

  return jsonb_build_object(
    'work_status', p_work_status,
    'available_from', p_available_from,
    'availability_status', 'fresh',
    'confirmed_at', now_value,
    'stale_after', stale_value
  );
end;
$$;

revoke all on function public.prepare_maritime_smart_account(uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.confirm_maritime_smart_account(uuid, boolean) from public, anon;
revoke all on function public.create_maritime_application_drafts(uuid, uuid[], boolean) from public, anon;
revoke all on function public.submit_maritime_application(uuid, boolean) from public, anon;
revoke all on function public.set_maritime_availability(text, date, boolean) from public, anon;
revoke all on function public.sync_maritime_public_listing_job_status() from public, anon, authenticated;
revoke all on function public.invalidate_maritime_smart_account_after_document_change() from public, anon, authenticated;
revoke all on function public.invalidate_maritime_smart_account_after_readiness_change() from public, anon, authenticated;
revoke all on function public.invalidate_maritime_smart_account_after_availability_change() from public, anon, authenticated;
revoke all on function public.invalidate_maritime_matches_after_job_change() from public, anon, authenticated;
grant execute on function public.prepare_maritime_smart_account(uuid, text, text, jsonb, jsonb) to service_role;
grant execute on function public.confirm_maritime_smart_account(uuid, boolean) to authenticated;
grant execute on function public.create_maritime_application_drafts(uuid, uuid[], boolean) to authenticated;
grant execute on function public.submit_maritime_application(uuid, boolean) to authenticated;
grant execute on function public.set_maritime_availability(text, date, boolean) to authenticated;

comment on table public.maritime_smart_account_runs is 'User-reviewable smart profile, CV, readiness, expiry, and verified-job matching snapshots.';
comment on table public.maritime_application_permission_batches is 'Explicit customer consent for preparing application drafts; final submission always requires a separate confirmation.';
comment on function public.prepare_maritime_smart_account(uuid, text, text, jsonb, jsonb) is 'Trusted-backend-only writer for an explainable smart-account run and verified-company job matches.';
comment on function public.create_maritime_application_drafts(uuid, uuid[], boolean) is 'Prepares matched application drafts only; it never submits them.';
comment on function public.submit_maritime_application(uuid, boolean) is 'Submits one owned maritime application only after explicit final user confirmation.';
