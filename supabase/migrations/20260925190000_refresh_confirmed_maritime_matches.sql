-- Refresh matches from the saved Maritime CV without reopening an approved CV run.
drop policy if exists maritime_match_results_select_participant on public.maritime_match_results;
create policy maritime_match_results_select_participant
  on public.maritime_match_results for select to authenticated
  using (seafarer_user_id = auth.uid());

drop policy if exists maritime_applications_select_participant on public.maritime_hiring_applications;
create policy maritime_applications_select_participant
  on public.maritime_hiring_applications for select to authenticated
  using (seafarer_user_id = auth.uid() or (
    status = 'submitted' and public.maritime_can_access_partner(partner_id)
  ));

create or replace function public.refresh_confirmed_maritime_matches(
  p_user_id uuid,
  p_run_id uuid,
  p_input_snapshot_hash text,
  p_rule_version text,
  p_smart_snapshot jsonb,
  p_matches jsonb
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  match_value jsonb;
  job_row public.maritime_jobs%rowtype;
  matched_job_ids uuid[] := '{}'::uuid[];
  eligible_count integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'trusted backend required' using errcode = '42501';
  end if;
  if p_input_snapshot_hash !~ '^[a-f0-9]{64}$'
     or char_length(coalesce(p_rule_version, '')) not between 3 and 80
     or jsonb_typeof(p_smart_snapshot) <> 'object'
     or octet_length(p_smart_snapshot::text) > 524288
     or jsonb_typeof(p_matches) <> 'array'
     or jsonb_array_length(p_matches) > 100 then
    raise exception 'invalid smart match payload' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if not exists (
    select 1 from public.maritime_smart_account_runs
    where id = p_run_id and seafarer_user_id = p_user_id and status = 'user_confirmed'
  ) then
    raise exception 'confirmed candidate run required' using errcode = '42501';
  end if;

  for match_value in select value from jsonb_array_elements(p_matches) as item(value) loop
    if coalesce(match_value ->> 'job_id', '') !~ '^[0-9a-f-]{36}$' then
      raise exception 'invalid smart match job' using errcode = '22023';
    end if;
    select job.* into job_row from public.maritime_jobs job
    join public.partner_businesses partner on partner.id = job.partner_id
    where job.id = (match_value ->> 'job_id')::uuid and job.status = 'open'
      and partner.status = 'active' and partner.verification_status = 'verified'
      and partner.partner_type = 'maritime';
    if job_row.id is null or job_row.id = any(matched_job_ids) then
      raise exception 'unavailable or repeated maritime job' using errcode = '22023';
    end if;
    matched_job_ids := array_append(matched_job_ids, job_row.id);
    if coalesce((match_value ->> 'eligible')::boolean, false) then
      eligible_count := eligible_count + 1;
    end if;
    insert into public.maritime_match_results (
      job_id, partner_id, seafarer_user_id, hard_gate_status, hard_gate_reasons,
      preference_score, score_reasons, rule_version, score_version,
      input_snapshot_hash, input_snapshot, computed_at, stale_after,
      smart_account_run_id, metadata
    ) values (
      job_row.id, job_row.partner_id, p_user_id,
      coalesce(match_value ->> 'hard_gate_status', 'needs_data'),
      coalesce(match_value -> 'missing_requirements', '[]'::jsonb),
      greatest(0, least(100, coalesce((match_value ->> 'score')::numeric, 0))),
      coalesce(match_value -> 'components', '[]'::jsonb), p_rule_version, p_rule_version,
      p_input_snapshot_hash, match_value, now(), now() + interval '24 hours',
      p_run_id, jsonb_build_object('eligible', coalesce((match_value ->> 'eligible')::boolean, false), 'company_contact_visible', false)
    ) on conflict (smart_account_run_id, job_id) where smart_account_run_id is not null
    do update set hard_gate_status = excluded.hard_gate_status,
      hard_gate_reasons = excluded.hard_gate_reasons,
      preference_score = excluded.preference_score,
      score_reasons = excluded.score_reasons,
      rule_version = excluded.rule_version,
      score_version = excluded.score_version,
      input_snapshot_hash = excluded.input_snapshot_hash,
      input_snapshot = excluded.input_snapshot,
      computed_at = excluded.computed_at,
      stale_after = excluded.stale_after,
      metadata = excluded.metadata;
  end loop;

  update public.maritime_match_results
  set hard_gate_status = 'stale', stale_after = now()
  where smart_account_run_id = p_run_id and not (job_id = any(matched_job_ids));

  update public.maritime_smart_account_runs
  set input_snapshot_hash = p_input_snapshot_hash,
      rule_version = p_rule_version,
      smart_snapshot = p_smart_snapshot,
      match_count = cardinality(matched_job_ids),
      eligible_match_count = eligible_count
  where id = p_run_id and seafarer_user_id = p_user_id and status = 'user_confirmed';

  return jsonb_build_object('run_id', p_run_id, 'match_count', cardinality(matched_job_ids), 'eligible_match_count', eligible_count);
end;
$$;

revoke all on function public.refresh_confirmed_maritime_matches(uuid, uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.refresh_confirmed_maritime_matches(uuid, uuid, text, text, jsonb, jsonb) to service_role;
