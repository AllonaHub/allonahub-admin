begin;

create or replace function public.maritime_cv_identity_snapshot_hash_v1(p_profile_payload jsonb)
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
    digest(convert_to(concat_ws(chr(31), v_person, v_birth_place, v_nationality, v_gender), 'UTF8'), 'sha256'),
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
  v_rank text := coalesce(public.maritime_normalize_identity_value(p_profile_payload ->> 'rank'), '<empty>');
  v_marital text := coalesce(public.maritime_normalize_identity_value(p_profile_payload ->> 'marital_status'), '<empty>');
  v_address text := coalesce(public.maritime_normalize_identity_value(p_profile_payload #>> '{contact,permanent_address}'), '<empty>');
  v_airport text := coalesce(public.maritime_normalize_identity_value(p_profile_payload #>> '{contact,nearest_airport}'), '<empty>');
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
          v_gender,
          v_rank,
          v_marital,
          v_address,
          v_airport
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
end;
$$;

alter table public.maritime_cv_identity_locks
  alter column identity_version set default 'maritime-personal-v2';

create or replace function public.maritime_force_personal_lock_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.identity_version := 'maritime-personal-v2';
  return new;
end;
$$;

drop trigger if exists maritime_cv_identity_lock_version on public.maritime_cv_identity_locks;
create trigger maritime_cv_identity_lock_version
  before insert or update of identity_snapshot_hash, identity_version
  on public.maritime_cv_identity_locks
  for each row execute function public.maritime_force_personal_lock_version();

create or replace function public.enforce_maritime_cv_identity_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_fingerprint text := public.maritime_cv_person_fingerprint(new.profile_payload);
  v_identity_snapshot_hash text := public.maritime_cv_identity_snapshot_hash(new.profile_payload);
  v_identity_snapshot_hash_v1 text := public.maritime_cv_identity_snapshot_hash_v1(new.profile_payload);
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
    if v_person_fingerprint is null or v_person_fingerprint <> v_lock.person_fingerprint then
      raise exception using errcode = 'P0001', message = 'MARITIME_IDENTITY_LOCKED';
    end if;

    if v_lock.identity_version = 'maritime-identity-v1' then
      if v_identity_snapshot_hash_v1 is null or v_identity_snapshot_hash_v1 is distinct from v_lock.identity_snapshot_hash then
        raise exception using errcode = 'P0001', message = 'MARITIME_IDENTITY_LOCKED';
      end if;
      update public.maritime_cv_identity_locks
      set identity_snapshot_hash = v_identity_snapshot_hash,
          identity_version = 'maritime-personal-v2',
          updated_at = now()
      where user_id = new.seafarer_user_id;
    elsif v_identity_snapshot_hash is null or v_identity_snapshot_hash is distinct from v_lock.identity_snapshot_hash then
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
        identity_snapshot_hash,
        identity_version
      ) values (
        new.seafarer_user_id,
        v_person_fingerprint,
        v_identity_snapshot_hash,
        'maritime-personal-v2'
      );
    exception when unique_violation then
      raise exception using errcode = 'P0001', message = 'MARITIME_IDENTITY_ALREADY_REGISTERED';
    end;
  end if;

  return new;
end;
$$;

comment on function public.maritime_cv_identity_snapshot_hash(jsonb) is
  'Hashes immutable Maritime CV personal details: legal identity, rank, marital status, permanent address and nearest airport.';
comment on function public.maritime_cv_identity_snapshot_hash_v1(jsonb) is
  'Legacy Maritime CV identity hash used only for one-time upgrade of existing v1 locks.';

revoke all on function public.maritime_cv_identity_snapshot_hash_v1(jsonb) from public, anon, authenticated;
revoke all on function public.maritime_cv_identity_snapshot_hash(jsonb) from public, anon, authenticated;
revoke all on function public.maritime_force_personal_lock_version() from public, anon, authenticated;
revoke all on function public.enforce_maritime_cv_identity_lock() from public, anon, authenticated;

commit;
