create extension if not exists pgcrypto;

create table if not exists public.maritime_cv_identity_locks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  person_fingerprint text not null unique,
  identity_snapshot_hash text not null,
  identity_version text not null default 'maritime-identity-v1',
  locked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maritime_cv_identity_person_fingerprint_format
    check (person_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint maritime_cv_identity_snapshot_hash_format
    check (identity_snapshot_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.maritime_cv_device_bindings (
  device_fingerprint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  binding_source text not null default 'maritime_cv_save'
    check (binding_source in ('account_registration', 'oauth_registration', 'account_access', 'maritime_cv_save', 'support_recovery')),
  user_agent text,
  first_bound_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint maritime_cv_device_fingerprint_format
    check (device_fingerprint ~ '^[0-9a-f]{64}$')
);

create index if not exists maritime_cv_device_bindings_user_idx
  on public.maritime_cv_device_bindings(user_id, first_bound_at);

alter table public.maritime_cv_identity_locks enable row level security;
alter table public.maritime_cv_device_bindings enable row level security;

revoke all on public.maritime_cv_identity_locks from public, anon, authenticated;
revoke all on public.maritime_cv_device_bindings from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.maritime_cv_identity_locks to service_role;
    grant all on public.maritime_cv_device_bindings to service_role;
  end if;
end $$;

create or replace function public.maritime_normalize_identity_value(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    regexp_replace(
      regexp_replace(lower(btrim(coalesce(p_value, ''))), '[[:space:]]+', ' ', 'g'),
      '[[:punct:]]+', '', 'g'
    ),
    ''
  );
$$;

create or replace function public.maritime_cv_person_fingerprint(p_profile_payload jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_given text := public.maritime_normalize_identity_value(p_profile_payload ->> 'given_names');
  v_family text := public.maritime_normalize_identity_value(p_profile_payload ->> 'family_name');
  v_middle text := public.maritime_normalize_identity_value(p_profile_payload ->> 'middle_name');
  v_birth_date text := nullif(btrim(coalesce(p_profile_payload ->> 'date_of_birth', '')), '');
  v_birth_date_value date;
begin
  if v_given is null
    or v_family is null
    or v_middle is null
    or v_birth_date is null
    or v_birth_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return null;
  end if;

  begin
    v_birth_date_value := v_birth_date::date;
  exception when others then
    return null;
  end;

  if to_char(v_birth_date_value, 'YYYY-MM-DD') <> v_birth_date then
    return null;
  end if;

  return encode(
    digest(convert_to(concat_ws(chr(31), v_given, v_family, v_middle, v_birth_date), 'UTF8'), 'sha256'),
    'hex'
  );
end;
$$;

create or replace function public.maritime_cv_identity_snapshot_hash(p_profile_payload jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_person text := public.maritime_cv_person_fingerprint(p_profile_payload);
  v_birth_place text := public.maritime_normalize_identity_value(p_profile_payload ->> 'place_of_birth');
  v_nationality text := public.maritime_normalize_identity_value(p_profile_payload ->> 'nationality');
  v_gender text := public.maritime_normalize_identity_value(p_profile_payload ->> 'gender');
begin
  if v_person is null or v_birth_place is null or v_nationality is null or v_gender is null then
    return null;
  end if;

  return encode(
    digest(
      convert_to(
        concat_ws(
          chr(31),
          v_person,
          v_birth_place,
          v_nationality,
          v_gender
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
end;
$$;

create or replace function public.maritime_device_fingerprint(p_device_key text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_device_key text := lower(btrim(coalesce(p_device_key, '')));
begin
  if v_device_key !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'MARITIME_DEVICE_KEY_INVALID';
  end if;

  return encode(digest(convert_to('maritime-device-v1:' || v_device_key, 'UTF8'), 'sha256'), 'hex');
end;
$$;

create or replace function public.maritime_device_registration_allowed(p_device_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_fingerprint text := public.maritime_device_fingerprint(p_device_key);
  v_bound boolean;
begin
  select exists (
    select 1
    from public.maritime_cv_device_bindings binding
    where binding.device_fingerprint = v_device_fingerprint
  ) into v_bound;

  return jsonb_build_object(
    'allowed', not v_bound,
    'code', case when v_bound then 'MARITIME_DEVICE_ALREADY_BOUND' else null end
  );
end;
$$;

create or replace function public.maritime_check_device_access(
  p_user_id uuid,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_fingerprint text := public.maritime_device_fingerprint(p_device_key);
  v_bound_user_id uuid;
begin
  select binding.user_id
    into v_bound_user_id
  from public.maritime_cv_device_bindings binding
  where binding.device_fingerprint = v_device_fingerprint;

  return jsonb_build_object(
    'allowed', v_bound_user_id is null or v_bound_user_id = p_user_id,
    'bound_to_current_user', v_bound_user_id = p_user_id,
    'code', case
      when v_bound_user_id is not null and v_bound_user_id <> p_user_id then 'MARITIME_DEVICE_ALREADY_BOUND'
      else null
    end
  );
end;
$$;

create or replace function public.maritime_bind_device_to_user(
  p_user_id uuid,
  p_device_key text,
  p_binding_source text default 'maritime_cv_save',
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_fingerprint text := public.maritime_device_fingerprint(p_device_key);
  v_bound_user_id uuid;
  v_role text;
  v_source text := lower(btrim(coalesce(p_binding_source, 'maritime_cv_save')));
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'MARITIME_DEVICE_USER_REQUIRED';
  end if;

  if v_source not in ('account_registration', 'oauth_registration', 'account_access', 'maritime_cv_save', 'support_recovery') then
    raise exception using errcode = '22023', message = 'MARITIME_DEVICE_SOURCE_INVALID';
  end if;

  select profile.role into v_role
  from public.profiles profile
  where profile.id = p_user_id;

  if v_role is distinct from 'customer' then
    raise exception using errcode = '42501', message = 'CUSTOMER_ACCOUNT_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_device_fingerprint, 0));

  select binding.user_id
    into v_bound_user_id
  from public.maritime_cv_device_bindings binding
  where binding.device_fingerprint = v_device_fingerprint
  for update;

  if v_bound_user_id is not null and v_bound_user_id <> p_user_id then
    raise exception using errcode = 'P0001', message = 'MARITIME_DEVICE_ALREADY_BOUND';
  end if;

  insert into public.maritime_cv_device_bindings (
    device_fingerprint,
    user_id,
    binding_source,
    user_agent,
    last_seen_at
  ) values (
    v_device_fingerprint,
    p_user_id,
    v_source,
    left(nullif(btrim(coalesce(p_user_agent, '')), ''), 500),
    now()
  )
  on conflict (device_fingerprint) do update
    set last_seen_at = now(),
        user_agent = coalesce(excluded.user_agent, public.maritime_cv_device_bindings.user_agent);

  return jsonb_build_object('allowed', true, 'bound_to_current_user', true);
end;
$$;

create or replace function public.enforce_maritime_cv_identity_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_fingerprint text := public.maritime_cv_person_fingerprint(new.profile_payload);
  v_identity_snapshot_hash text := public.maritime_cv_identity_snapshot_hash(new.profile_payload);
  v_lock public.maritime_cv_identity_locks%rowtype;
  v_should_lock boolean := new.last_user_confirmed_at is not null
    or new.profile_status in ('user_confirmed', 'verification_pending', 'verified');
  v_support_override boolean := current_setting('app.maritime_identity_support_override', true) = 'approved';
begin
  if tg_op = 'UPDATE' and new.seafarer_user_id is distinct from old.seafarer_user_id then
    raise exception using errcode = '42501', message = 'MARITIME_IDENTITY_OWNER_LOCKED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.seafarer_user_id::text, 0));

  select identity_lock.*
    into v_lock
  from public.maritime_cv_identity_locks identity_lock
  where identity_lock.user_id = new.seafarer_user_id
  for update;

  if found and not v_support_override then
    if v_person_fingerprint is null
      or v_person_fingerprint <> v_lock.person_fingerprint
      or v_identity_snapshot_hash is distinct from v_lock.identity_snapshot_hash then
      raise exception using errcode = 'P0001', message = 'MARITIME_IDENTITY_LOCKED';
    end if;
  elsif v_should_lock and not found then
    if v_person_fingerprint is null or v_identity_snapshot_hash is null then
      raise exception using errcode = '22023', message = 'MARITIME_IDENTITY_REQUIRED';
    end if;

    if not v_support_override and not exists (
      select 1
      from public.maritime_cv_device_bindings binding
      where binding.user_id = new.seafarer_user_id
    ) then
      raise exception using errcode = '42501', message = 'MARITIME_DEVICE_BINDING_REQUIRED';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_person_fingerprint, 0));

    begin
      insert into public.maritime_cv_identity_locks (
        user_id,
        person_fingerprint,
        identity_snapshot_hash
      ) values (
        new.seafarer_user_id,
        v_person_fingerprint,
        v_identity_snapshot_hash
      );
    exception when unique_violation then
      raise exception using errcode = 'P0001', message = 'MARITIME_IDENTITY_ALREADY_REGISTERED';
    end;
  end if;

  return new;
end;
$$;

insert into public.maritime_cv_identity_locks (
  user_id,
  person_fingerprint,
  identity_snapshot_hash,
  locked_at,
  updated_at
)
select
  profile.seafarer_user_id,
  public.maritime_cv_person_fingerprint(profile.profile_payload),
  public.maritime_cv_identity_snapshot_hash(profile.profile_payload),
  coalesce(profile.last_user_confirmed_at, profile.updated_at, now()),
  coalesce(profile.updated_at, now())
from public.maritime_cv_profiles profile
where profile.last_user_confirmed_at is not null
  and public.maritime_cv_person_fingerprint(profile.profile_payload) is not null
  and public.maritime_cv_identity_snapshot_hash(profile.profile_payload) is not null
order by profile.created_at asc
on conflict do nothing;

insert into public.admin_notifications (user_id, kind, severity, title, message, metadata)
select
  profile.seafarer_user_id,
  'maritime_identity_security_review_required',
  'critical',
  'Maritime CV kimlik doğrulaması gerekiyor',
  'Mevcut Maritime CV kaydı yeni tek kişi güvenlik kuralında otomatik olarak kilitlenemedi. Kayıt silinmedi; yeniden onay veya destek incelemesi gerekiyor.',
  jsonb_build_object(
    'reason', case
      when public.maritime_cv_person_fingerprint(profile.profile_payload) is null
        or public.maritime_cv_identity_snapshot_hash(profile.profile_payload) is null
        then 'incomplete_identity'
      else 'duplicate_identity'
    end,
    'migration', '20260915211500_lock_maritime_cv_identity'
  )
from public.maritime_cv_profiles profile
where profile.last_user_confirmed_at is not null
  and not exists (
    select 1
    from public.maritime_cv_identity_locks identity_lock
    where identity_lock.user_id = profile.seafarer_user_id
  );

update public.maritime_cv_profiles profile
set profile_status = 'draft',
    last_user_confirmed_at = null,
    profile_payload = profile.profile_payload || jsonb_build_object(
      'identity_security_hold', case
        when public.maritime_cv_person_fingerprint(profile.profile_payload) is null
          or public.maritime_cv_identity_snapshot_hash(profile.profile_payload) is null
          then 'incomplete_identity'
        else 'duplicate_identity'
      end
    )
where profile.last_user_confirmed_at is not null
  and not exists (
    select 1
    from public.maritime_cv_identity_locks identity_lock
    where identity_lock.user_id = profile.seafarer_user_id
  );

drop trigger if exists maritime_cv_profiles_identity_lock on public.maritime_cv_profiles;
create trigger maritime_cv_profiles_identity_lock
  before insert or update of seafarer_user_id, profile_status, profile_payload, last_user_confirmed_at
  on public.maritime_cv_profiles
  for each row execute function public.enforce_maritime_cv_identity_lock();

create or replace function public.save_locked_maritime_cv_profile(
  p_user_id uuid,
  p_profile_payload jsonb,
  p_completion_percent integer,
  p_device_key text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.maritime_cv_profiles%rowtype;
begin
  if p_profile_payload is null or jsonb_typeof(p_profile_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'MARITIME_CV_PAYLOAD_INVALID';
  end if;

  if p_completion_percent is null or p_completion_percent < 0 or p_completion_percent > 100 then
    raise exception using errcode = '22023', message = 'MARITIME_CV_COMPLETION_INVALID';
  end if;

  perform public.maritime_bind_device_to_user(
    p_user_id,
    p_device_key,
    'maritime_cv_save',
    p_user_agent
  );

  insert into public.maritime_cv_profiles (
    seafarer_user_id,
    profile_status,
    profile_payload,
    source_document_ids,
    completion_percent,
    last_user_confirmed_at
  ) values (
    p_user_id,
    'user_confirmed',
    p_profile_payload,
    '{}'::uuid[],
    p_completion_percent,
    now()
  )
  on conflict (seafarer_user_id) do update
    set profile_status = 'user_confirmed',
        profile_payload = excluded.profile_payload,
        source_document_ids = '{}'::uuid[],
        completion_percent = excluded.completion_percent,
        last_user_confirmed_at = excluded.last_user_confirmed_at
  returning * into v_profile;

  return jsonb_build_object(
    'profile_status', v_profile.profile_status,
    'completion_percent', v_profile.completion_percent,
    'last_user_confirmed_at', v_profile.last_user_confirmed_at,
    'updated_at', v_profile.updated_at,
    'identity_locked', true
  );
end;
$$;

create or replace function public.support_replace_maritime_cv_identity(
  p_user_id uuid,
  p_new_identity jsonb,
  p_ticket_id uuid,
  p_approved_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.maritime_cv_profiles%rowtype;
  v_ticket public.support_tickets%rowtype;
  v_admin_role text;
  v_payload jsonb;
  v_fields jsonb;
  v_person_fingerprint text;
  v_identity_snapshot_hash text;
begin
  select profile.role into v_admin_role
  from public.profiles profile
  where profile.id = p_approved_by;

  if v_admin_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'MARITIME_IDENTITY_ADMIN_APPROVAL_REQUIRED';
  end if;

  select ticket.* into v_ticket
  from public.support_tickets ticket
  where ticket.id = p_ticket_id
    and ticket.user_id = p_user_id
    and ticket.category = 'maritime_identity_change'
    and ticket.status = 'in_progress'
    and ticket.assigned_admin_id = p_approved_by
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'MARITIME_IDENTITY_SUPPORT_CASE_REQUIRED';
  end if;

  select profile.* into v_profile
  from public.maritime_cv_profiles profile
  where profile.seafarer_user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'MARITIME_CV_PROFILE_NOT_FOUND';
  end if;

  v_payload := v_profile.profile_payload
    || jsonb_build_object(
      'given_names', nullif(btrim(coalesce(p_new_identity ->> 'given_names', '')), ''),
      'family_name', nullif(btrim(coalesce(p_new_identity ->> 'family_name', '')), ''),
      'middle_name', nullif(btrim(coalesce(p_new_identity ->> 'middle_name', '')), ''),
      'date_of_birth', nullif(btrim(coalesce(p_new_identity ->> 'date_of_birth', '')), ''),
      'place_of_birth', nullif(btrim(coalesce(p_new_identity ->> 'place_of_birth', '')), ''),
      'nationality', nullif(btrim(coalesce(p_new_identity ->> 'nationality', '')), ''),
      'gender', nullif(btrim(coalesce(p_new_identity ->> 'gender', '')), '')
    );

  v_fields := coalesce(v_payload #> '{manual_cv,fields}', '{}'::jsonb)
    || jsonb_build_object(
      'firstName', coalesce(v_payload ->> 'given_names', ''),
      'familyName', coalesce(v_payload ->> 'family_name', ''),
      'fatherName', coalesce(v_payload ->> 'middle_name', ''),
      'birthDate', coalesce(v_payload ->> 'date_of_birth', ''),
      'birthPlace', coalesce(v_payload ->> 'place_of_birth', ''),
      'nationality', coalesce(v_payload ->> 'nationality', ''),
      'gender', coalesce(v_payload ->> 'gender', '')
    );
  v_payload := jsonb_set(v_payload, '{manual_cv,fields}', v_fields, true);
  v_payload := jsonb_set(
    v_payload,
    '{holder_name}',
    to_jsonb(concat_ws(' ', v_payload ->> 'given_names', v_payload ->> 'middle_name', v_payload ->> 'family_name')),
    true
  );

  v_person_fingerprint := public.maritime_cv_person_fingerprint(v_payload);
  v_identity_snapshot_hash := public.maritime_cv_identity_snapshot_hash(v_payload);
  if v_person_fingerprint is null or v_identity_snapshot_hash is null then
    raise exception using errcode = '22023', message = 'MARITIME_IDENTITY_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_person_fingerprint, 0));
  if exists (
    select 1
    from public.maritime_cv_identity_locks identity_lock
    where identity_lock.person_fingerprint = v_person_fingerprint
      and identity_lock.user_id <> p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'MARITIME_IDENTITY_ALREADY_REGISTERED';
  end if;

  perform set_config('app.maritime_identity_support_override', 'approved', true);

  insert into public.maritime_cv_identity_locks (
    user_id,
    person_fingerprint,
    identity_snapshot_hash,
    locked_at,
    updated_at
  ) values (
    p_user_id,
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

  update public.maritime_cv_profiles
  set profile_payload = v_payload,
      profile_status = 'user_confirmed',
      last_user_confirmed_at = now()
  where seafarer_user_id = p_user_id;

  update public.support_tickets
  set status = 'resolved',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'identity_change_approved_by', p_approved_by,
        'identity_change_approved_at', now(),
        'identity_lock_version', 'maritime-identity-v1'
      )
  where id = p_ticket_id;

  insert into public.admin_notifications (user_id, kind, severity, title, message, metadata)
  values (
    p_user_id,
    'maritime_identity_changed_by_support',
    'warning',
    'Maritime CV kimlik bilgileri güncellendi',
    'Kimlik bilgileriniz doğrulanmış destek talebiniz kapsamında güncellendi ve yeniden kilitlendi.',
    jsonb_build_object('ticket_id', p_ticket_id, 'approved_by', p_approved_by)
  );

  return jsonb_build_object('updated', true, 'identity_locked', true, 'ticket_id', p_ticket_id);
end;
$$;

revoke all on function public.maritime_normalize_identity_value(text) from public, anon, authenticated;
revoke all on function public.maritime_cv_person_fingerprint(jsonb) from public, anon, authenticated;
revoke all on function public.maritime_cv_identity_snapshot_hash(jsonb) from public, anon, authenticated;
revoke all on function public.maritime_device_fingerprint(text) from public, anon, authenticated;
revoke all on function public.maritime_device_registration_allowed(text) from public, anon, authenticated;
revoke all on function public.maritime_check_device_access(uuid, text) from public, anon, authenticated;
revoke all on function public.maritime_bind_device_to_user(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.enforce_maritime_cv_identity_lock() from public, anon, authenticated;
revoke all on function public.save_locked_maritime_cv_profile(uuid, jsonb, integer, text, text) from public, anon, authenticated;
revoke all on function public.support_replace_maritime_cv_identity(uuid, jsonb, uuid, uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.maritime_device_registration_allowed(text) to service_role;
    grant execute on function public.maritime_check_device_access(uuid, text) to service_role;
    grant execute on function public.maritime_bind_device_to_user(uuid, text, text, text) to service_role;
    grant execute on function public.save_locked_maritime_cv_profile(uuid, jsonb, integer, text, text) to service_role;
    grant execute on function public.support_replace_maritime_cv_identity(uuid, jsonb, uuid, uuid) to service_role;
  end if;
end $$;

comment on table public.maritime_cv_identity_locks is
  'Private one-person-one-account Maritime CV identity lock. Stores only irreversible fingerprints; clients receive no direct access.';
comment on table public.maritime_cv_device_bindings is
  'Private one-device-one-account binding for anti-broker and impersonation controls.';
comment on function public.save_locked_maritime_cv_profile(uuid, jsonb, integer, text, text) is
  'Atomically binds a device, reserves a unique person fingerprint, and saves a confirmed Maritime CV.';
comment on function public.support_replace_maritime_cv_identity(uuid, jsonb, uuid, uuid) is
  'Support-only identity correction requiring an assigned in-progress ticket and an admin or super-admin approver.';
