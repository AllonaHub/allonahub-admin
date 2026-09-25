begin;

-- A saved Maritime CV is the source for Global CV. Uploaded documents are
-- optional evidence; a separate confirmed intake must not block creation.
do $migration$
declare
  definition text := pg_get_functiondef('public.prepare_maritime_smart_account(uuid,text,text,jsonb,jsonb)'::regprocedure);
  old_guard text := $old$if not exists (
    select 1 from public.maritime_document_intakes
    where seafarer_user_id = p_seafarer_user_id
      and status in ('user_confirmed', 'verification_pending', 'verified')
  ) then
    raise exception 'confirmed maritime documents required' using errcode = 'P0001';
  end if;$old$;
  new_guard text := $new$if not exists (
    select 1 from public.maritime_cv_profiles
    where seafarer_user_id = p_seafarer_user_id
      and profile_payload ->> 'data_origin' = 'user_entered_maritime_cv'
      and profile_status not in ('restricted', 'stale')
  ) then
    raise exception 'saved Maritime CV required' using errcode = 'P0001';
  end if;$new$;
begin
  -- Production already accepts a saved Maritime CV or confirmed documents.
  if strpos(definition, 'confirmed maritime CV or documents required') > 0 then return; end if;
  if strpos(definition, new_guard) > 0 then return; end if;
  if strpos(definition, old_guard) = 0 then
    raise exception 'Unexpected Global CV source guard; review before applying migration';
  end if;
  execute replace(definition, old_guard, new_guard);
end;
$migration$;

notify pgrst, 'reload schema';
commit;
