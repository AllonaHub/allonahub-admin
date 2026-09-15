create sequence if not exists public.allona_user_public_id_seq
  as bigint
  start with 50001
  increment by 1
  minvalue 50001
  no cycle;

create or replace function public.next_allona_user_public_id()
returns text
language sql
security definer
set search_path = public
as $$
  select 'AL-' || nextval('public.allona_user_public_id_seq')::text;
$$;

alter table public.profiles
  add column if not exists public_id text;

with current_max as (
  select greatest(
    coalesce(max(substring(public_id from '^AL-([0-9]+)$')::bigint), 50000),
    50000
  ) as value
  from public.profiles
  where public_id ~ '^AL-[0-9]{5,}$'
), missing_profiles as (
  select
    profile.id,
    current_max.value + row_number() over (order by profile.created_at nulls last, profile.id) as sequence_number
  from public.profiles profile
  cross join current_max
  where profile.public_id is null
)
update public.profiles profile
set public_id = 'AL-' || missing.sequence_number::text
from missing_profiles missing
where profile.id = missing.id;

update public.profiles profile
set module = 'maritime'
where profile.role = 'customer'
  and coalesce(profile.module, '') <> 'maritime'
  and (
    exists (select 1 from public.maritime_cv_profiles cv where cv.seafarer_user_id = profile.id)
    or exists (select 1 from public.maritime_seafarer_workspaces workspace where workspace.user_id = profile.id)
    or exists (select 1 from public.maritime_document_intakes intake where intake.seafarer_user_id = profile.id)
  );

do $$
declare
  v_max_id bigint;
begin
  select max(substring(public_id from '^AL-([0-9]+)$')::bigint)
    into v_max_id
  from public.profiles
  where public_id ~ '^AL-[0-9]{5,}$';

  if v_max_id is not null then
    perform setval('public.allona_user_public_id_seq', greatest(v_max_id, 50001), true);
  end if;
end $$;

alter table public.profiles
  alter column public_id set not null;

create unique index if not exists profiles_public_id_unique
  on public.profiles(public_id);

alter table public.profiles
  drop constraint if exists profiles_public_id_format;
alter table public.profiles
  add constraint profiles_public_id_format
  check (public_id ~ '^AL-[0-9]{5,}$');

create or replace function public.assign_allona_user_public_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.public_id := public.next_allona_user_public_id();
  return new;
end;
$$;

drop trigger if exists profiles_assign_public_id on public.profiles;
create trigger profiles_assign_public_id
  before insert on public.profiles
  for each row execute function public.assign_allona_user_public_id();

create or replace function public.protect_allona_user_public_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.public_id is distinct from old.public_id then
    raise exception using errcode = '42501', message = 'ALLONA_PUBLIC_ID_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_public_id on public.profiles;
create trigger profiles_protect_public_id
  before update of public_id on public.profiles
  for each row execute function public.protect_allona_user_public_id();

create table if not exists public.maritime_super_admin_snapshots (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null
    check (action in ('cv_update', 'status_change', 'account_update', 'document_review', 'cv_reset', 'security_reset', 'full_maritime_reset')),
  reason text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '90 days')
);

create index if not exists maritime_super_admin_snapshots_target_idx
  on public.maritime_super_admin_snapshots(target_user_id, created_at desc);
create index if not exists maritime_super_admin_snapshots_actor_idx
  on public.maritime_super_admin_snapshots(actor_user_id, created_at desc);

alter table public.maritime_super_admin_snapshots enable row level security;
revoke all on public.maritime_super_admin_snapshots from public, anon, authenticated;

create or replace function public.assert_maritime_super_admin_actor(p_actor_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.profiles
  where id = p_actor_user_id;

  if v_role is distinct from 'super_admin' then
    raise exception using errcode = '42501', message = 'MARITIME_SUPER_ADMIN_REQUIRED';
  end if;
end;
$$;

create or replace function public.super_admin_update_maritime_cv(
  p_target_user_id uuid,
  p_actor_user_id uuid,
  p_profile_payload jsonb,
  p_profile_status text,
  p_completion_percent integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.maritime_cv_profiles%rowtype;
  v_after public.maritime_cv_profiles%rowtype;
  v_person_fingerprint text;
  v_identity_snapshot_hash text;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_target_role text;
begin
  perform public.assert_maritime_super_admin_actor(p_actor_user_id);

  if length(v_reason) < 6 then
    raise exception using errcode = '22023', message = 'MARITIME_ADMIN_REASON_REQUIRED';
  end if;
  if p_profile_payload is null or jsonb_typeof(p_profile_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'MARITIME_CV_PAYLOAD_INVALID';
  end if;
  if p_profile_status not in ('draft', 'user_confirmed', 'verification_pending', 'verified', 'stale', 'restricted') then
    raise exception using errcode = '22023', message = 'MARITIME_CV_STATUS_INVALID';
  end if;
  if p_completion_percent is null or p_completion_percent < 0 or p_completion_percent > 100 then
    raise exception using errcode = '22023', message = 'MARITIME_CV_COMPLETION_INVALID';
  end if;

  select role into v_target_role from public.profiles where id = p_target_user_id for update;
  if v_target_role is distinct from 'customer' then
    raise exception using errcode = '42501', message = 'MARITIME_CUSTOMER_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text, 0));
  select * into v_before
  from public.maritime_cv_profiles
  where seafarer_user_id = p_target_user_id
  for update;

  insert into public.maritime_super_admin_snapshots (
    target_user_id,
    actor_user_id,
    action,
    reason,
    snapshot
  ) values (
    p_target_user_id,
    p_actor_user_id,
    'cv_update',
    v_reason,
    jsonb_build_object(
      'cv_profile', case when v_before.id is null then null else to_jsonb(v_before) end,
      'identity_lock', (
        select to_jsonb(identity_lock)
        from public.maritime_cv_identity_locks identity_lock
        where identity_lock.user_id = p_target_user_id
      )
    )
  );

  v_person_fingerprint := public.maritime_cv_person_fingerprint(p_profile_payload);
  v_identity_snapshot_hash := public.maritime_cv_identity_snapshot_hash(p_profile_payload);

  if exists (select 1 from public.maritime_cv_identity_locks where user_id = p_target_user_id)
    and (v_person_fingerprint is null or v_identity_snapshot_hash is null) then
    raise exception using errcode = '22023', message = 'MARITIME_IDENTITY_REQUIRED';
  end if;

  if p_profile_status in ('user_confirmed', 'verification_pending', 'verified')
    and (v_person_fingerprint is null or v_identity_snapshot_hash is null) then
    raise exception using errcode = '22023', message = 'MARITIME_IDENTITY_REQUIRED';
  end if;

  if v_person_fingerprint is not null and v_identity_snapshot_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_person_fingerprint, 0));
    if exists (
      select 1
      from public.maritime_cv_identity_locks identity_lock
      where identity_lock.person_fingerprint = v_person_fingerprint
        and identity_lock.user_id <> p_target_user_id
    ) then
      raise exception using errcode = 'P0001', message = 'MARITIME_IDENTITY_ALREADY_REGISTERED';
    end if;

    insert into public.maritime_cv_identity_locks (
      user_id,
      person_fingerprint,
      identity_snapshot_hash,
      locked_at,
      updated_at
    ) values (
      p_target_user_id,
      v_person_fingerprint,
      v_identity_snapshot_hash,
      now(),
      now()
    )
    on conflict (user_id) do update
      set person_fingerprint = excluded.person_fingerprint,
          identity_snapshot_hash = excluded.identity_snapshot_hash,
          identity_version = 'maritime-identity-v1',
          locked_at = now(),
          updated_at = now();
  end if;

  perform set_config('app.maritime_identity_support_override', 'approved', true);
  insert into public.maritime_cv_profiles (
    seafarer_user_id,
    profile_status,
    profile_payload,
    source_document_ids,
    completion_percent,
    last_user_confirmed_at
  ) values (
    p_target_user_id,
    p_profile_status,
    p_profile_payload,
    coalesce(v_before.source_document_ids, '{}'::uuid[]),
    p_completion_percent,
    case when p_profile_status in ('user_confirmed', 'verification_pending', 'verified') then now() else null end
  )
  on conflict (seafarer_user_id) do update
    set profile_status = excluded.profile_status,
        profile_payload = excluded.profile_payload,
        completion_percent = excluded.completion_percent,
        last_user_confirmed_at = excluded.last_user_confirmed_at
  returning * into v_after;

  return jsonb_build_object(
    'updated', true,
    'profile_status', v_after.profile_status,
    'completion_percent', v_after.completion_percent,
    'identity_locked', exists (
      select 1 from public.maritime_cv_identity_locks where user_id = p_target_user_id
    ),
    'updated_at', v_after.updated_at
  );
end;
$$;

create or replace function public.super_admin_decide_maritime_user(
  p_target_user_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cv public.maritime_cv_profiles%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_target_role text;
begin
  perform public.assert_maritime_super_admin_actor(p_actor_user_id);
  if length(v_reason) < 6 then
    raise exception using errcode = '22023', message = 'MARITIME_ADMIN_REASON_REQUIRED';
  end if;
  if p_decision not in ('approve', 'return_to_review', 'restrict') then
    raise exception using errcode = '22023', message = 'MARITIME_ADMIN_DECISION_INVALID';
  end if;

  select role into v_target_role from public.profiles where id = p_target_user_id for update;
  if v_target_role is distinct from 'customer' then
    raise exception using errcode = '42501', message = 'MARITIME_CUSTOMER_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text, 0));
  select * into v_cv
  from public.maritime_cv_profiles
  where seafarer_user_id = p_target_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'MARITIME_CV_PROFILE_NOT_FOUND';
  end if;

  if p_decision = 'approve' and not exists (
    select 1 from public.maritime_cv_identity_locks where user_id = p_target_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'MARITIME_IDENTITY_LOCK_REQUIRED';
  end if;

  insert into public.maritime_super_admin_snapshots (
    target_user_id,
    actor_user_id,
    action,
    reason,
    snapshot
  ) values (
    p_target_user_id,
    p_actor_user_id,
    'status_change',
    v_reason,
    jsonb_build_object(
      'decision', p_decision,
      'cv_profile', to_jsonb(v_cv),
      'workspace', (select to_jsonb(workspace) from public.maritime_seafarer_workspaces workspace where workspace.user_id = p_target_user_id),
      'readiness', (select to_jsonb(readiness) from public.maritime_readiness_passports readiness where readiness.seafarer_user_id = p_target_user_id)
    )
  );

  perform set_config('app.maritime_identity_support_override', 'approved', true);
  update public.maritime_cv_profiles
  set profile_status = case p_decision
        when 'approve' then 'verified'
        when 'return_to_review' then 'user_confirmed'
        else 'restricted'
      end,
      last_user_confirmed_at = case when p_decision = 'restrict' then last_user_confirmed_at else coalesce(last_user_confirmed_at, now()) end
  where seafarer_user_id = p_target_user_id;

  update public.maritime_seafarer_workspaces
  set workspace_status = case p_decision when 'restrict' then 'restricted' else 'active' end,
      readiness_level = case p_decision when 'approve' then 'verified_ready' when 'restrict' then 'blocked' else 'ready_review' end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_super_admin_decision', p_decision,
        'last_super_admin_decision_at', now(),
        'last_super_admin_decision_by', p_actor_user_id
      )
  where user_id = p_target_user_id;

  update public.maritime_readiness_passports
  set passport_status = case p_decision when 'approve' then 'verified' when 'restrict' then 'suspended' else 'verification_pending' end,
      last_verified_at = case when p_decision = 'approve' then now() else last_verified_at end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_super_admin_decision', p_decision,
        'last_super_admin_decision_at', now(),
        'last_super_admin_decision_by', p_actor_user_id
      )
  where seafarer_user_id = p_target_user_id;

  if p_decision = 'restrict' then
    update public.maritime_smart_account_runs
      set status = 'revoked'
      where seafarer_user_id = p_target_user_id and status <> 'revoked';
    update public.maritime_application_permission_batches
      set status = 'revoked'
      where seafarer_user_id = p_target_user_id and status <> 'revoked';
    update public.maritime_match_results
      set hard_gate_status = 'stale', stale_after = now()
      where seafarer_user_id = p_target_user_id;
    update public.maritime_hiring_applications
      set status = 'withdrawn', withdrawn_at = now(), last_stage_changed_at = now()
      where seafarer_user_id = p_target_user_id
        and status in ('drafted', 'awaiting_candidate_approval', 'submitted');
  end if;

  return jsonb_build_object('updated', true, 'decision', p_decision);
end;
$$;

create or replace function public.super_admin_review_maritime_document(
  p_target_user_id uuid,
  p_actor_user_id uuid,
  p_document_id uuid,
  p_status text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.maritime_document_intakes%rowtype;
  v_updated public.maritime_document_intakes%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_target_role text;
  v_source_reference text;
begin
  perform public.assert_maritime_super_admin_actor(p_actor_user_id);
  if length(v_reason) < 6 then
    raise exception using errcode = '22023', message = 'MARITIME_ADMIN_REASON_REQUIRED';
  end if;
  if p_status not in ('verified', 'rejected', 'revoked') then
    raise exception using errcode = '22023', message = 'MARITIME_DOCUMENT_STATUS_INVALID';
  end if;

  select role into v_target_role from public.profiles where id = p_target_user_id for update;
  if v_target_role is distinct from 'customer' then
    raise exception using errcode = '42501', message = 'MARITIME_CUSTOMER_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text, 0));
  select * into v_document
  from public.maritime_document_intakes
  where id = p_document_id and seafarer_user_id = p_target_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'MARITIME_DOCUMENT_NOT_FOUND';
  end if;

  insert into public.maritime_super_admin_snapshots (
    target_user_id,
    actor_user_id,
    action,
    reason,
    snapshot
  ) values (
    p_target_user_id,
    p_actor_user_id,
    'document_review',
    v_reason,
    jsonb_build_object('document', to_jsonb(v_document))
  );

  update public.maritime_document_intakes
  set status = p_status,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'super_admin_review', jsonb_build_object(
          'decision', p_status,
          'reason', v_reason,
          'reviewed_by', p_actor_user_id,
          'reviewed_at', now()
        )
      )
  where id = p_document_id and seafarer_user_id = p_target_user_id
  returning * into v_updated;

  v_source_reference := coalesce(v_document.file_sha256, v_document.id::text);
  update public.maritime_readiness_items
  set trust_level = case p_status
        when 'verified' then 'reviewer_confirmed'
        when 'rejected' then 'disputed'
        else 'revoked'
      end,
      verification_status = case p_status
        when 'verified' then 'verified'
        when 'rejected' then 'rejected'
        else 'revoked'
      end,
      verified_at = case when p_status = 'verified' then now() else null end,
      revoked_at = case when p_status = 'revoked' then now() else null end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_super_admin_review_at', now(),
        'last_super_admin_review_by', p_actor_user_id,
        'last_super_admin_review_reason', v_reason
      )
  where seafarer_user_id = p_target_user_id
    and source_reference_hash = v_source_reference;

  update public.maritime_smart_account_runs
    set status = 'superseded'
    where seafarer_user_id = p_target_user_id and status in ('draft', 'user_confirmed');
  update public.maritime_application_permission_batches
    set status = 'revoked'
    where seafarer_user_id = p_target_user_id and status <> 'revoked';
  update public.maritime_match_results
    set hard_gate_status = 'stale', stale_after = now()
    where seafarer_user_id = p_target_user_id;

  return jsonb_build_object(
    'updated', true,
    'document_id', v_updated.id,
    'status', v_updated.status
  );
end;
$$;

create or replace function public.super_admin_reset_maritime_user(
  p_target_user_id uuid,
  p_actor_user_id uuid,
  p_scope text,
  p_confirmation_public_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_cv public.maritime_cv_profiles%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_action text;
begin
  perform public.assert_maritime_super_admin_actor(p_actor_user_id);
  if length(v_reason) < 10 then
    raise exception using errcode = '22023', message = 'MARITIME_ADMIN_RESET_REASON_REQUIRED';
  end if;
  if p_scope not in ('cv', 'security', 'full_maritime') then
    raise exception using errcode = '22023', message = 'MARITIME_ADMIN_RESET_SCOPE_INVALID';
  end if;

  select * into v_profile from public.profiles where id = p_target_user_id for update;
  if not found or v_profile.role is distinct from 'customer' then
    raise exception using errcode = 'P0002', message = 'MARITIME_CUSTOMER_NOT_FOUND';
  end if;
  if upper(btrim(coalesce(p_confirmation_public_id, ''))) is distinct from v_profile.public_id then
    raise exception using errcode = '22023', message = 'MARITIME_ADMIN_PUBLIC_ID_CONFIRMATION_FAILED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text, 0));
  select * into v_cv from public.maritime_cv_profiles where seafarer_user_id = p_target_user_id for update;
  v_action := case p_scope
    when 'cv' then 'cv_reset'
    when 'security' then 'security_reset'
    else 'full_maritime_reset'
  end;

  insert into public.maritime_super_admin_snapshots (
    target_user_id,
    actor_user_id,
    action,
    reason,
    snapshot
  ) values (
    p_target_user_id,
    p_actor_user_id,
    v_action,
    v_reason,
    jsonb_build_object(
      'profile', to_jsonb(v_profile) - 'last_admin_note',
      'cv_profile', case when v_cv.id is null then null else to_jsonb(v_cv) end,
      'identity_lock', (select to_jsonb(identity_lock) from public.maritime_cv_identity_locks identity_lock where identity_lock.user_id = p_target_user_id),
      'document_count', (select count(*) from public.maritime_document_intakes where seafarer_user_id = p_target_user_id),
      'application_count', (select count(*) from public.maritime_hiring_applications where seafarer_user_id = p_target_user_id),
      'passkey_registered', exists (select 1 from public.maritime_passkey_credentials where user_id = p_target_user_id),
      'device_binding_count', (select count(*) from public.maritime_cv_device_bindings where user_id = p_target_user_id)
    )
  );

  if p_scope in ('cv', 'full_maritime') then
    perform set_config('app.maritime_identity_support_override', 'approved', true);
    update public.maritime_cv_profiles
    set profile_status = 'draft',
        profile_payload = '{}'::jsonb,
        source_document_ids = '{}'::uuid[],
        completion_percent = 0,
        last_user_confirmed_at = null
    where seafarer_user_id = p_target_user_id;

    delete from public.maritime_cv_identity_locks where user_id = p_target_user_id;
    update public.maritime_smart_account_runs set status = 'revoked' where seafarer_user_id = p_target_user_id and status <> 'revoked';
    update public.maritime_application_permission_batches set status = 'revoked' where seafarer_user_id = p_target_user_id and status <> 'revoked';
    update public.maritime_match_results set hard_gate_status = 'stale', stale_after = now() where seafarer_user_id = p_target_user_id;
    update public.maritime_hiring_applications
      set status = 'withdrawn', withdrawn_at = now(), last_stage_changed_at = now()
      where seafarer_user_id = p_target_user_id
        and status in ('drafted', 'awaiting_candidate_approval', 'submitted');
  end if;

  if p_scope in ('security', 'full_maritime') then
    delete from public.maritime_passkey_proofs where user_id = p_target_user_id;
    delete from public.maritime_passkey_challenges where user_id = p_target_user_id;
    delete from public.maritime_passkey_credentials where user_id = p_target_user_id;
    delete from public.maritime_cv_device_bindings where user_id = p_target_user_id;
  end if;

  if p_scope = 'full_maritime' then
    update public.maritime_document_intakes set status = 'revoked' where seafarer_user_id = p_target_user_id and status <> 'revoked';
    update public.maritime_document_extractions set status = 'superseded' where seafarer_user_id = p_target_user_id and status <> 'superseded';
    update public.maritime_smart_portrait_reviews set status = 'withdrawn' where seafarer_user_id = p_target_user_id and status <> 'withdrawn';
    update public.maritime_cv_generations set status = 'revoked' where seafarer_user_id = p_target_user_id and status <> 'revoked';
    update public.maritime_readiness_items set verification_status = 'revoked', trust_level = 'revoked', revoked_at = now()
      where seafarer_user_id = p_target_user_id and verification_status <> 'revoked';
    update public.maritime_readiness_passports
      set passport_status = 'archived', readiness_score = 0, availability_status = 'blocked'
      where seafarer_user_id = p_target_user_id;
    update public.maritime_seafarer_workspaces
      set workspace_status = 'draft', readiness_score = 0, readiness_level = 'unverified', availability_status = 'blocked'
      where user_id = p_target_user_id;
  end if;

  return jsonb_build_object(
    'reset', true,
    'scope', p_scope,
    'public_id', v_profile.public_id,
    'snapshot_retained_days', 90
  );
end;
$$;

revoke all on function public.next_allona_user_public_id() from public, anon, authenticated;
revoke all on function public.assign_allona_user_public_id() from public, anon, authenticated;
revoke all on function public.protect_allona_user_public_id() from public, anon, authenticated;
revoke all on function public.assert_maritime_super_admin_actor(uuid) from public, anon, authenticated;
revoke all on function public.super_admin_update_maritime_cv(uuid, uuid, jsonb, text, integer, text) from public, anon, authenticated;
revoke all on function public.super_admin_decide_maritime_user(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.super_admin_review_maritime_document(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.super_admin_reset_maritime_user(uuid, uuid, text, text, text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage, select on sequence public.allona_user_public_id_seq to service_role;
    grant execute on function public.next_allona_user_public_id() to service_role;
    grant all on public.maritime_super_admin_snapshots to service_role;
    grant execute on function public.super_admin_update_maritime_cv(uuid, uuid, jsonb, text, integer, text) to service_role;
    grant execute on function public.super_admin_decide_maritime_user(uuid, uuid, text, text) to service_role;
    grant execute on function public.super_admin_review_maritime_document(uuid, uuid, uuid, text, text) to service_role;
    grant execute on function public.super_admin_reset_maritime_user(uuid, uuid, text, text, text) to service_role;
  end if;
end $$;

comment on column public.profiles.public_id is
  'Immutable human-searchable Allona ID allocated from AL-50001 upward.';
comment on table public.maritime_super_admin_snapshots is
  'Private 90-day before-change snapshots for audited Maritime Super Admin interventions.';
