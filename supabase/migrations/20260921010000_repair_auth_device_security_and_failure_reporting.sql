begin;

-- Supabase installs pgcrypto in the extensions schema. The original maritime
-- identity functions used a restricted search_path and therefore could not
-- resolve digest(bytea, text), which blocked every new account registration.
create or replace function public.maritime_cv_person_fingerprint(p_profile_payload jsonb)
returns text
language plpgsql
immutable
set search_path = public, extensions
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
    extensions.digest(
      convert_to(concat_ws(chr(31), v_given, v_family, v_middle, v_birth_date), 'UTF8'),
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
set search_path = public, extensions
as $$
declare
  v_device_key text := lower(btrim(coalesce(p_device_key, '')));
begin
  if v_device_key !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'MARITIME_DEVICE_KEY_INVALID';
  end if;

  return encode(
    extensions.digest(convert_to('maritime-device-v1:' || v_device_key, 'UTF8'), 'sha256'),
    'hex'
  );
end;
$$;

create or replace function public.maritime_cv_identity_snapshot_hash_v1(p_profile_payload jsonb)
returns text
language plpgsql
immutable
set search_path = public, extensions
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
    extensions.digest(convert_to(concat_ws(chr(31), v_person, v_birth_place, v_nationality, v_gender), 'UTF8'), 'sha256'),
    'hex'
  );
end;
$$;

create or replace function public.maritime_cv_identity_snapshot_hash(p_profile_payload jsonb)
returns text
language plpgsql
immutable
set search_path = public, extensions
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
    extensions.digest(
      convert_to(
        concat_ws(chr(31), v_person, v_birth_place, v_nationality, v_gender, v_rank, v_marital, v_address, v_airport),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
end;
$$;

-- Keep the append-only audit chain operational when the optional hardened
-- audit RPC is installed. Older deployments use the backend's safe insert
-- fallback and therefore do not have this function yet.
do $$
declare
  v_signature text;
begin
  select p.oid::regprocedure::text
    into v_signature
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'append_security_audit_event'
  limit 1;

  if v_signature is not null then
    execute format('alter function %s set search_path = public, extensions', v_signature);
  end if;
end $$;

-- This index supports the owner-only 90-day authentication failure report.
-- The append-only audit ledger remains the source of truth; the API limits the
-- operational report to the latest 90 days and new auth failures receive a
-- matching retention_until value.
create index if not exists security_audit_events_auth_failure_report_idx
  on public.security_audit_events (action, created_at desc)
  where action in (
    'auth.login_failed',
    'auth.login_wrong_portal',
    'auth.register_failed',
    'auth.register_device_denied',
    'auth.register_device_binding_failed',
    'auth.turnstile_failed',
    'auth.turnstile_missing',
    'auth.password_reset_delivery_failed',
    'partner.password_reset_delivery_failed'
  );

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.maritime_cv_person_fingerprint(jsonb) to service_role;
    grant execute on function public.maritime_device_fingerprint(text) to service_role;
    grant execute on function public.maritime_cv_identity_snapshot_hash_v1(jsonb) to service_role;
    grant execute on function public.maritime_cv_identity_snapshot_hash(jsonb) to service_role;
  end if;
end $$;

commit;
