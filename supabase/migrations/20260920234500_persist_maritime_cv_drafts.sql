begin;

create or replace function public.save_maritime_cv_draft(
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
  v_person_fingerprint text;
  v_identity_snapshot_hash text;
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
    'draft',
    p_profile_payload,
    '{}'::uuid[],
    p_completion_percent,
    null
  )
  on conflict (seafarer_user_id) do update
    set profile_status = 'draft',
        profile_payload = excluded.profile_payload,
        source_document_ids = maritime_cv_profiles.source_document_ids,
        completion_percent = excluded.completion_percent,
        last_user_confirmed_at = null
  returning * into v_profile;

  v_person_fingerprint := public.maritime_cv_person_fingerprint(p_profile_payload);
  v_identity_snapshot_hash := public.maritime_cv_identity_snapshot_hash(p_profile_payload);
  if v_person_fingerprint is not null
    and v_identity_snapshot_hash is not null
    and public.maritime_normalize_identity_value(p_profile_payload ->> 'rank') is not null
    and public.maritime_normalize_identity_value(p_profile_payload ->> 'marital_status') is not null
    and public.maritime_normalize_identity_value(p_profile_payload #>> '{contact,permanent_address}') is not null
    and public.maritime_normalize_identity_value(p_profile_payload #>> '{contact,nearest_airport}') is not null
  then
    begin
      insert into public.maritime_cv_identity_locks (
        user_id,
        person_fingerprint,
        identity_snapshot_hash,
        identity_version
      ) values (
        p_user_id,
        v_person_fingerprint,
        v_identity_snapshot_hash,
        'maritime-personal-v2'
      )
      on conflict (user_id) do nothing;
    exception when unique_violation then
      raise exception using errcode = 'P0001', message = 'MARITIME_IDENTITY_ALREADY_REGISTERED';
    end;
  end if;

  return jsonb_build_object(
    'profile_status', v_profile.profile_status,
    'completion_percent', v_profile.completion_percent,
    'last_user_confirmed_at', v_profile.last_user_confirmed_at,
    'updated_at', v_profile.updated_at,
    'identity_locked', exists (
      select 1 from public.maritime_cv_identity_locks identity_lock
      where identity_lock.user_id = p_user_id
    )
  );
end;
$$;

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
        source_document_ids = maritime_cv_profiles.source_document_ids,
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

revoke all on function public.save_maritime_cv_draft(uuid, jsonb, integer, text, text) from public, anon, authenticated;
revoke all on function public.save_locked_maritime_cv_profile(uuid, jsonb, integer, text, text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.save_maritime_cv_draft(uuid, jsonb, integer, text, text) to service_role;
    grant execute on function public.save_locked_maritime_cv_profile(uuid, jsonb, integer, text, text) to service_role;
  end if;
end
$$;

comment on function public.save_maritime_cv_draft(uuid, jsonb, integer, text, text) is
  'Persists the authenticated seafarer Maritime CV draft without publishing it or weakening an existing immutable identity lock.';

comment on function public.save_locked_maritime_cv_profile(uuid, jsonb, integer, text, text) is
  'Finalizes a complete Maritime CV while preserving document links and enforcing immutable personal details.';

commit;
