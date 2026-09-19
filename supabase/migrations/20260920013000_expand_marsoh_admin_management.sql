begin;

alter table public.marsoh_topic_cards
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.marsoh_admin_remove_published_messages(
  p_actor_user_id uuid,
  p_reason text,
  p_channel_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_removed integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'MARSOH_SERVICE_ROLE_REQUIRED';
  end if;

  select role::text into v_role
  from public.profiles
  where id = p_actor_user_id;

  if v_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'MARSOH_MODERATOR_REQUIRED';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'MARSOH_REASON_REQUIRED';
  end if;

  update public.marsoh_moderation_decisions decision
  set decision = 'rejected',
      decided_by = p_actor_user_id,
      decided_at = now(),
      administrator_explanation = left(btrim(p_reason), 500),
      updated_at = now()
  where decision.message_id in (
    select published.message_id
    from public.marsoh_published_messages published
    where p_channel_id is null or published.channel_id = p_channel_id
  );

  delete from public.marsoh_published_messages published
  where p_channel_id is null or published.channel_id = p_channel_id;
  get diagnostics v_removed = row_count;

  insert into public.marsoh_audit_events (
    actor_user_id, action, resource_type, resource_id, metadata
  ) values (
    p_actor_user_id,
    'marsoh.management.bulk_removed',
    'marsoh_channel',
    p_channel_id,
    jsonb_build_object(
      'reason', left(btrim(p_reason), 500),
      'removed_count', v_removed,
      'scope', case when p_channel_id is null then 'all_channels' else 'channel' end
    )
  );

  return v_removed;
end;
$$;

revoke all on function public.marsoh_admin_remove_published_messages(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.marsoh_admin_remove_published_messages(uuid,text,uuid) to service_role;

update public.marsoh_channels
set name_i18n = jsonb_set(
      jsonb_set(name_i18n, '{tr}', to_jsonb(U&'T\00FCrkiye Odas\0131'::text), true),
      '{az}', to_jsonb(U&'T\00FCrkiy\0259 ota\011F\0131'::text), true
    ),
    pinned_notice_i18n = jsonb_set(
      jsonb_set(
        pinned_notice_i18n,
        '{tr}',
        to_jsonb(U&'Sayg\0131l\0131, g\00FCvenli ve denizcilik odakl\0131 sohbet edin.'::text),
        true
      ),
      '{az}',
      to_jsonb(U&'H\00F6rm\0259tli, t\0259hl\00FCk\0259siz v\0259 d\0259niz\00E7ilik y\00F6n\00FCml\00FC s\00F6hb\0259t edin.'::text),
      true
    ),
    updated_at = now()
where slug = 'country-tr';

update public.marsoh_channels
set name_i18n = jsonb_set(
      jsonb_set(name_i18n, '{tr}', to_jsonb(U&'Azerbaycan Odas\0131'::text), true),
      '{az}', to_jsonb(U&'Az\0259rbaycan ota\011F\0131'::text), true
    ),
    pinned_notice_i18n = jsonb_set(
      jsonb_set(
        pinned_notice_i18n,
        '{tr}',
        to_jsonb(U&'Sayg\0131l\0131, g\00FCvenli ve denizcilik odakl\0131 sohbet edin.'::text),
        true
      ),
      '{az}',
      to_jsonb(U&'H\00F6rm\0259tli, t\0259hl\00FCk\0259siz v\0259 d\0259niz\00E7ilik y\00F6n\00FCml\00FC s\00F6hb\0259t edin.'::text),
      true
    ),
    updated_at = now()
where slug = 'country-az';

update public.marsoh_topic_cards
set title_i18n = jsonb_set(
      jsonb_set(title_i18n, '{tr}', to_jsonb(U&'Bug\00FCn\00FCn deniz konusu'::text), true),
      '{az}', to_jsonb(U&'G\00FCn\00FCn d\0259niz m\00F6vzusu'::text), true
    ),
    body_i18n = jsonb_set(
      jsonb_set(
        body_i18n,
        '{tr}',
        to_jsonb(U&'Uzun vardiyalarda ekip i\00E7i ileti\015Fimi g\00FC\00E7lendiren en iyi al\0131\015Fkanl\0131k nedir?'::text),
        true
      ),
      '{az}',
      to_jsonb(U&'Uzun n\00F6vb\0259l\0259rd\0259 ekip \00FCnsiyy\0259tini g\00FCcl\0259ndir\0259n \0259n yax\015F\0131 v\0259rdi\015F n\0259dir?'::text),
      true
    ),
    updated_at = now()
where status = 'active';

comment on function public.marsoh_admin_remove_published_messages(uuid,text,uuid)
  is 'Removes public MarSoh projections while preserving accepted messages, reports, and audit evidence.';

commit;
