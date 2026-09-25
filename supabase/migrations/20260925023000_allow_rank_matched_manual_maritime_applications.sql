-- Manual applications rely on the saved Maritime CV rank; automatic applications
-- retain the confirmed smart-account match firewall below.
create or replace function public.maritime_manual_application_rank(p_rank text)
returns text language sql immutable
set search_path = pg_catalog, public
as $$
  with normalized as (
    select regexp_replace(
      translate(lower(btrim(coalesce(p_rank, ''))),
        'çğıöşüəä', 'cgiosuea'),
      '[^a-z0-9]+', ' ', 'g') as value
  )
  select case
    when value in ('master', 'captain', 'kaptan', 'kapitan', 'ship master', 'gemi kaptani') then 'master'
    when value in ('chief officer', 'chief mate', '1st officer', 'birinci zabit', 'bas zabit') then 'chief_officer'
    when value in ('second officer', '2nd officer', 'ikinci zabit') then 'second_officer'
    when value in ('third officer', '3rd officer', 'ucuncu zabit') then 'third_officer'
    when value in ('deck cadet', 'deck trainee', 'guverte kadeti', 'guverte stajyeri') then 'deck_cadet'
    when value in ('chief engineer', 'bas muhendis', 'bas mexanik', 'birinci mexanik') then 'chief_engineer'
    when value in ('second engineer', '2nd engineer', 'ikinci muhendis', 'ikinci mexanik') then 'second_engineer'
    when value in ('third engineer', '3rd engineer', 'ucuncu muhendis', 'ucuncu mexanik') then 'third_engineer'
    when value in ('fourth engineer', '4th engineer', 'dorduncu muhendis') then 'fourth_engineer'
    when value in ('engine cadet', 'engine trainee', 'makine kadeti', 'makine stajyeri') then 'engine_cadet'
    when value in ('electro technical officer', 'eto', 'elektrik zabiti') then 'eto'
    when value in ('electrician', 'elektrikci', 'gemi elektrikcisi') then 'electrician'
    when value in ('electro technical rating', 'etr', 'elektro teknik tayfa') then 'electro_technical_rating'
    when value in ('bosun', 'boatswain', 'lostromo', 'guverte lostromosu', 'reis') then 'bosun'
    when value in ('able seaman', 'ab', 'usta gemici') then 'able_seaman'
    when value in ('ordinary seaman', 'os', 'gemici', 'matros') then 'ordinary_seaman'
    when value in ('deck boy', 'micho', 'mico', 'guverte tayfasi') then 'deck_boy'
    when value in ('engine bosun', 'machine bosun', 'makine lostromosu') then 'engine_bosun'
    when value in ('able engine rating', 'able seafarer engine', 'usta makine tayfasi', 'usta yagci', 'stcw iii 5') then 'able_engine_rating'
    when value in ('motorman', 'motorcu') then 'motorman'
    when value in ('oiler', 'yagci') then 'oiler'
    when value in ('wiper', 'silici', 'makine tayfasi') then 'wiper'
    when value in ('fitter', 'welder', 'kaynakci') then value
    when value in ('pumpman', 'pompaman', 'pompaci', 'postman') then 'pumpman'
    when value in ('chief cook', 'bas asci') then 'chief_cook'
    when value in ('cook', 'asci') then 'cook'
    when value in ('steward', 'messman') then 'steward'
    else nullif(replace(value, ' ', '_'), '')
  end from normalized;
$$;

create or replace function public.enforce_maritime_application_match_firewall()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  run_id_value uuid;
  cv_rank text;
  job_rank text;
begin
  if new.status not in ('drafted', 'awaiting_candidate_approval', 'submitted') then
    return new;
  end if;

  if new.submission_mode = 'manual'
     and new.metadata ->> 'matching_source' = 'maritime_cv_rank' then
    if new.candidate_consent_snapshot ->> 'final_submission_confirmed' is distinct from 'true'
       or new.candidate_consent_snapshot ->> 'documents_share_confirmed' is distinct from 'true' then
      raise exception 'manual application consent required' using errcode = 'P0001';
    end if;
    select public.maritime_manual_application_rank(cv.profile_payload ->> 'rank')
      into cv_rank
    from public.maritime_cv_profiles cv
    where cv.seafarer_user_id = new.seafarer_user_id
      and cv.profile_payload ->> 'data_origin' = 'user_entered_maritime_cv'
      and cv.profile_status not in ('restricted', 'stale');
    select public.maritime_manual_application_rank(job.rank_code)
      into job_rank
    from public.maritime_jobs job
    join public.partner_businesses partner on partner.id = job.partner_id
    where job.id = new.job_id and job.partner_id = new.partner_id
      and job.status = 'open' and partner.status = 'active'
      and partner.verification_status = 'verified'
      and partner.partner_type = 'maritime';
    if cv_rank is null or job_rank is null or cv_rank <> job_rank then
      raise exception 'saved Maritime CV rank does not match the open job' using errcode = 'P0001';
    end if;
    return new;
  end if;

  begin
    run_id_value := nullif(new.metadata ->> 'smart_account_run_id', '')::uuid;
  exception when others then
    raise exception 'valid smart account run required' using errcode = 'P0001';
  end;
  if run_id_value is null or not exists (
    select 1 from public.maritime_smart_account_runs run
    join public.maritime_match_results match
      on match.smart_account_run_id = run.id
     and match.seafarer_user_id = run.seafarer_user_id
    where run.id = run_id_value and run.seafarer_user_id = new.seafarer_user_id
      and run.status = 'user_confirmed'
      and run.rule_version = 'maritime-smart-account-v6'
      and coalesce((run.smart_snapshot #>> '{readiness,ready_to_apply}')::boolean, false)
      and match.job_id = new.job_id and match.hard_gate_status = 'passed'
      and match.stale_after > now()
      and coalesce((match.metadata ->> 'eligible')::boolean, false)
  ) then
    raise exception 'current eligible CV match required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.maritime_manual_application_rank(text) from public, anon, authenticated;
grant execute on function public.maritime_manual_application_rank(text) to service_role;
revoke all on function public.enforce_maritime_application_match_firewall() from public, anon, authenticated;
grant execute on function public.enforce_maritime_application_match_firewall() to service_role;
