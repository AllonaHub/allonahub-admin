begin;

-- A preliminary save must not undo an unchanged, already reviewed CV.
do $migration$
declare
  definition text := pg_get_functiondef('public.save_maritime_cv_draft(uuid,jsonb,integer,text,text)'::regprocedure);
  old_status text := $old$set profile_status = 'draft',
        profile_payload = excluded.profile_payload,
        source_document_ids = maritime_cv_profiles.source_document_ids,
        completion_percent = excluded.completion_percent,
        last_user_confirmed_at = null$old$;
  new_status text := $new$set profile_status = case
          when maritime_cv_profiles.profile_payload = excluded.profile_payload
            then maritime_cv_profiles.profile_status
          else 'draft'
        end,
        profile_payload = excluded.profile_payload,
        source_document_ids = maritime_cv_profiles.source_document_ids,
        completion_percent = excluded.completion_percent,
        last_user_confirmed_at = case
          when maritime_cv_profiles.profile_payload = excluded.profile_payload
            then maritime_cv_profiles.last_user_confirmed_at
          else null
        end$new$;
begin
  if strpos(definition, new_status) > 0 then return; end if;
  if strpos(definition, old_status) = 0 then
    raise exception 'Unexpected draft CV writer; review before applying migration';
  end if;
  execute replace(definition, old_status, new_status);
end;
$migration$;

-- A final save of identical content must not erase a super-admin verification.
do $migration$
declare
  definition text := pg_get_functiondef('public.save_locked_maritime_cv_profile(uuid,jsonb,integer,text,text)'::regprocedure);
  old_status text := $old$set profile_status = 'user_confirmed',
        profile_payload = excluded.profile_payload,
        source_document_ids = maritime_cv_profiles.source_document_ids,
        completion_percent = excluded.completion_percent,
        last_user_confirmed_at = excluded.last_user_confirmed_at$old$;
  new_status text := $new$set profile_status = case
          when maritime_cv_profiles.profile_status = 'verified'
            and maritime_cv_profiles.profile_payload = excluded.profile_payload then 'verified'
          else 'user_confirmed'
        end,
        profile_payload = excluded.profile_payload,
        source_document_ids = maritime_cv_profiles.source_document_ids,
        completion_percent = excluded.completion_percent,
        last_user_confirmed_at = excluded.last_user_confirmed_at$new$;
begin
  if strpos(definition, new_status) > 0 then return; end if;
  if strpos(definition, old_status) = 0 then
    raise exception 'Unexpected final CV writer; review before applying migration';
  end if;
  execute replace(definition, old_status, new_status);
end;
$migration$;

-- Draft is an editing state, not proof of missing qualifications. The trusted
-- backend still validates photo, identity, STCW records and matching gates.
do $migration$
declare
  definition text := pg_get_functiondef('public.prepare_maritime_smart_account(uuid,text,text,jsonb,jsonb)'::regprocedure);
  old_guard text := $old$      and cv.profile_status in ('user_confirmed', 'verification_pending', 'verified')
      and cv.last_user_confirmed_at is not null$old$;
  new_guard text := $new$      and cv.profile_status in ('draft', 'user_confirmed', 'verification_pending', 'verified')$new$;
begin
  if strpos(definition, new_guard) > 0 then return; end if;
  if strpos(definition, old_guard) = 0 then
    raise exception 'Unexpected Global CV source guard; review before applying migration';
  end if;
  execute replace(definition, old_guard, new_guard);
end;
$migration$;

notify pgrst, 'reload schema';
commit;
