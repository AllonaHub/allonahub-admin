create extension if not exists pgcrypto;

create table if not exists public.marsoh_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  channel_type text not null check (channel_type in ('world', 'country')),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  name_i18n jsonb not null default '{}'::jsonb,
  pinned_notice_i18n jsonb not null default '{}'::jsonb,
  slow_mode_seconds integer not null default 3 check (slow_mode_seconds between 0 and 300),
  created_by_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marsoh_channels_country_scope check (
    (channel_type = 'world' and country_code is null)
    or (channel_type = 'country' and country_code is not null)
  )
);

create unique index if not exists marsoh_channels_country_unique
  on public.marsoh_channels(country_code)
  where channel_type = 'country';

create table if not exists public.marsoh_channel_memberships (
  channel_id uuid not null references public.marsoh_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_type text not null default 'seafarer'
    check (actor_type in ('seafarer', 'company', 'moderator', 'system')),
  member_status text not null default 'active'
    check (member_status in ('active', 'muted', 'left', 'banned')),
  notification_preference text not null default 'all'
    check (notification_preference in ('all', 'mentions', 'muted')),
  last_read_published_at timestamptz,
  last_message_at timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table if not exists public.marsoh_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.marsoh_channels(id) on delete restrict,
  sender_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_type text not null default 'seafarer'
    check (actor_type in ('seafarer', 'company', 'moderator', 'system')),
  idempotency_key uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  normalized_hash text not null check (normalized_hash ~ '^[a-f0-9]{64}$'),
  language text not null default 'und' check (language ~ '^[a-z]{2,3}$' or language = 'und'),
  sender_display_name text not null,
  sender_badge text check (sender_badge is null or sender_badge in ('verified_seafarer', 'verified_company', 'moderator')),
  sender_country_code text check (sender_country_code is null or sender_country_code ~ '^[A-Z]{2}$'),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (sender_user_id, idempotency_key)
);

create table if not exists public.marsoh_moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.marsoh_messages(id) on delete cascade,
  category text not null,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  rule_code text not null,
  language text not null default 'und',
  administrator_explanation text not null,
  recommended_action text not null check (recommended_action in ('publish', 'reject', 'quarantine')),
  decision text not null check (decision in ('published', 'rejected', 'quarantined')),
  classifier_version text not null,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Realtime is attached only to this physical publication projection. Hidden
-- moderation state never enters the client subscription stream.
create table if not exists public.marsoh_published_messages (
  message_id uuid primary key references public.marsoh_messages(id) on delete cascade,
  channel_id uuid not null references public.marsoh_channels(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_type text not null check (actor_type in ('seafarer', 'company', 'moderator', 'system')),
  body text not null check (char_length(body) between 1 and 2000),
  language text not null default 'und',
  sender_display_name text not null,
  sender_badge text,
  sender_country_code text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.marsoh_translation_cache (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.marsoh_published_messages(message_id) on delete cascade,
  target_language text not null check (target_language ~ '^[a-z]{2,3}$'),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  translated_text text not null check (char_length(translated_text) between 1 and 6000),
  provider text not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (message_id, target_language, source_hash)
);

create table if not exists public.marsoh_message_reactions (
  message_id uuid not null references public.marsoh_published_messages(message_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '⚓', '👏', '❤️', '🌊')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.marsoh_user_blocks (
  blocker_user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create table if not exists public.marsoh_message_reports (
  id uuid primary key default gen_random_uuid(),
  -- Keep the report as moderation evidence even if the published projection is
  -- removed after an administrator rejects the message.
  message_id uuid not null references public.marsoh_messages(id) on delete restrict,
  reporter_user_id uuid not null references public.profiles(id) on delete restrict,
  reason_code text not null check (reason_code in ('spam', 'harassment', 'fraud', 'recruitment', 'contact_sharing', 'other')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, reporter_user_id)
);

create table if not exists public.marsoh_user_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sanction_type text not null check (sanction_type in ('temporary_mute', 'permanent_ban')),
  status text not null default 'active' check (status in ('active', 'lifted', 'expired')),
  reason text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  lifted_by uuid references public.profiles(id) on delete set null,
  lifted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marsoh_temporary_mute_expiry check (sanction_type <> 'temporary_mute' or expires_at is not null)
);

create table if not exists public.marsoh_rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.marsoh_channels(id) on delete cascade,
  session_hash text,
  ip_hash text,
  body_hash text,
  event_type text not null check (event_type in ('send_attempt', 'translation', 'report')),
  created_at timestamptz not null default now()
);

create table if not exists public.marsoh_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marsoh_topic_cards (
  id uuid primary key default gen_random_uuid(),
  topic_date date not null unique,
  title_i18n jsonb not null,
  body_i18n jsonb not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists marsoh_memberships_user_idx on public.marsoh_channel_memberships(user_id, member_status);
create index if not exists marsoh_messages_channel_cursor_idx on public.marsoh_messages(channel_id, accepted_at desc, id desc);
create index if not exists marsoh_published_channel_cursor_idx on public.marsoh_published_messages(channel_id, published_at desc, message_id desc);
create index if not exists marsoh_moderation_queue_idx on public.marsoh_moderation_decisions(decision, created_at desc);
create index if not exists marsoh_reports_queue_idx on public.marsoh_message_reports(status, created_at desc);
create index if not exists marsoh_sanctions_active_idx on public.marsoh_user_sanctions(user_id, status, expires_at);
create index if not exists marsoh_rate_user_window_idx on public.marsoh_rate_limit_events(user_id, event_type, created_at desc);
create index if not exists marsoh_rate_ip_window_idx on public.marsoh_rate_limit_events(ip_hash, event_type, created_at desc) where ip_hash is not null;

insert into public.marsoh_channels (slug, channel_type, country_code, name_i18n, pinned_notice_i18n)
values
  ('world', 'world', null,
    '{"tr":"Dünya Genel","az":"Dünya söhbəti","en":"World Chat"}'::jsonb,
    '{"tr":"Kişisel iletişim bilgisi, iş ilanı veya ücret talebi paylaşmayın.","az":"Şəxsi əlaqə məlumatı, iş elanı və ya ödəniş tələbi paylaşmayın.","en":"Do not share personal contact details, job ads, or payment requests."}'::jsonb),
  ('country-tr', 'country', 'TR',
    '{"tr":"Türkiye Odası","az":"Türkiyə otağı","en":"Türkiye Room"}'::jsonb,
    '{"tr":"Saygılı, güvenli ve denizcilik odaklı sohbet edin.","az":"Hörmətli, təhlükəsiz və dənizçilik yönümlü söhbət edin.","en":"Keep the conversation respectful, safe, and maritime-focused."}'::jsonb),
  ('country-az', 'country', 'AZ',
    '{"tr":"Azerbaycan Odası","az":"Azərbaycan otağı","en":"Azerbaijan Room"}'::jsonb,
    '{"tr":"Saygılı, güvenli ve denizcilik odaklı sohbet edin.","az":"Hörmətli, təhlükəsiz və dənizçilik yönümlü söhbət edin.","en":"Keep the conversation respectful, safe, and maritime-focused."}'::jsonb)
on conflict (slug) do update set
  name_i18n = excluded.name_i18n,
  pinned_notice_i18n = excluded.pinned_notice_i18n;

insert into public.marsoh_topic_cards (topic_date, title_i18n, body_i18n)
values (
  current_date,
  '{"tr":"Bugünün deniz konusu","az":"Günün dəniz mövzusu","en":"Today''s sea topic"}'::jsonb,
  '{"tr":"Uzun vardiyalarda ekip içi iletişimi güçlendiren en iyi alışkanlık nedir?","az":"Uzun növbələrdə ekip ünsiyyətini gücləndirən ən yaxşı vərdiş nədir?","en":"Which habit best strengthens crew communication during long watches?"}'::jsonb
)
on conflict (topic_date) do nothing;

create or replace function public.marsoh_can_read_channel(p_channel_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and coalesce(profile.account_status, 'active') = 'active'
    )
    and exists (
      select 1 from public.marsoh_channel_memberships membership
      where membership.channel_id = p_channel_id
        and membership.user_id = auth.uid()
        and membership.member_status = 'active'
    );
$$;

create or replace function public.marsoh_sender_is_blocked(p_sender_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.marsoh_user_blocks blocked
      where blocked.blocker_user_id = auth.uid()
        and blocked.blocked_user_id = p_sender_user_id
    );
$$;

create or replace function public.marsoh_visible_messages(
  p_channel_id uuid,
  p_before timestamptz default null,
  p_limit integer default 50
)
returns table (
  message_id uuid,
  channel_id uuid,
  sender_user_id uuid,
  actor_type text,
  body text,
  language text,
  sender_display_name text,
  sender_badge text,
  sender_country_code text,
  message_time timestamptz,
  own_message boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with allowed as (
    select public.marsoh_can_read_channel(p_channel_id) as ok
  ), visible as (
    select
      published.message_id,
      published.channel_id,
      published.sender_user_id,
      published.actor_type,
      published.body,
      published.language,
      published.sender_display_name,
      published.sender_badge,
      published.sender_country_code,
      published.published_at as message_time,
      false as own_message
    from public.marsoh_published_messages published, allowed
    where allowed.ok
      and published.channel_id = p_channel_id
      and published.sender_user_id <> auth.uid()
      and (p_before is null or published.published_at < p_before)
      and not public.marsoh_sender_is_blocked(published.sender_user_id)
    union all
    select
      message.id,
      message.channel_id,
      message.sender_user_id,
      message.actor_type,
      message.body,
      message.language,
      message.sender_display_name,
      message.sender_badge,
      message.sender_country_code,
      message.accepted_at,
      true
    from public.marsoh_messages message, allowed
    where allowed.ok
      and message.channel_id = p_channel_id
      and message.sender_user_id = auth.uid()
      and (p_before is null or message.accepted_at < p_before)
  )
  select * from visible
  order by message_time desc, message_id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

create or replace function public.marsoh_audit_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'MarSoh audit records are append-only';
end;
$$;

create or replace function public.marsoh_accept_text_message(
  p_message_id uuid,
  p_channel_id uuid,
  p_sender_user_id uuid,
  p_actor_type text,
  p_idempotency_key uuid,
  p_body text,
  p_normalized_hash text,
  p_language text,
  p_sender_display_name text,
  p_sender_badge text,
  p_sender_country_code text,
  p_category text,
  p_confidence numeric,
  p_rule_code text,
  p_administrator_explanation text,
  p_recommended_action text,
  p_decision text,
  p_classifier_version text
)
returns table (message_id uuid, inserted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
  v_inserted boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'MARSOH_SERVICE_ROLE_REQUIRED';
  end if;

  insert into public.marsoh_messages (
    id, channel_id, sender_user_id, actor_type, idempotency_key, body,
    normalized_hash, language, sender_display_name, sender_badge, sender_country_code
  ) values (
    p_message_id, p_channel_id, p_sender_user_id, p_actor_type, p_idempotency_key, p_body,
    p_normalized_hash, p_language, p_sender_display_name, p_sender_badge, p_sender_country_code
  )
  on conflict (sender_user_id, idempotency_key) do nothing
  returning id into v_message_id;

  if v_message_id is null then
    select message.id into v_message_id
    from public.marsoh_messages message
    where message.sender_user_id = p_sender_user_id
      and message.idempotency_key = p_idempotency_key;
  else
    v_inserted := true;
    insert into public.marsoh_moderation_decisions (
      message_id, category, confidence, rule_code, language,
      administrator_explanation, recommended_action, decision, classifier_version
    ) values (
      v_message_id, p_category, p_confidence, p_rule_code, p_language,
      p_administrator_explanation, p_recommended_action, p_decision, p_classifier_version
    );

    if p_decision = 'published' then
      insert into public.marsoh_published_messages (
        message_id, channel_id, sender_user_id, actor_type, body, language,
        sender_display_name, sender_badge, sender_country_code
      ) values (
        v_message_id, p_channel_id, p_sender_user_id, p_actor_type, p_body, p_language,
        p_sender_display_name, p_sender_badge, p_sender_country_code
      );
    end if;
  end if;

  return query select v_message_id, v_inserted;
end;
$$;

create or replace function public.marsoh_admin_decide_message(
  p_message_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.marsoh_messages%rowtype;
  v_role text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'MARSOH_SERVICE_ROLE_REQUIRED';
  end if;
  select role::text into v_role from public.profiles where id = p_actor_user_id;
  if v_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'MARSOH_MODERATOR_REQUIRED';
  end if;
  if p_decision not in ('published', 'rejected') or length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception using errcode = '22023', message = 'MARSOH_DECISION_INVALID';
  end if;

  select * into v_message from public.marsoh_messages where id = p_message_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'MARSOH_MESSAGE_NOT_FOUND'; end if;

  update public.marsoh_moderation_decisions
  set decision = p_decision,
      decided_by = p_actor_user_id,
      decided_at = now(),
      administrator_explanation = left(btrim(p_reason), 500),
      updated_at = now()
  where message_id = p_message_id;

  if p_decision = 'published' then
    insert into public.marsoh_published_messages (
      message_id, channel_id, sender_user_id, actor_type, body, language,
      sender_display_name, sender_badge, sender_country_code, published_at, created_at
    ) values (
      v_message.id, v_message.channel_id, v_message.sender_user_id, v_message.actor_type,
      v_message.body, v_message.language, v_message.sender_display_name,
      v_message.sender_badge, v_message.sender_country_code, now(), v_message.created_at
    ) on conflict (message_id) do update set published_at = now();
  else
    delete from public.marsoh_published_messages where message_id = p_message_id;
  end if;

  insert into public.marsoh_audit_events (
    actor_user_id, action, resource_type, resource_id, content_hash, metadata
  ) values (
    p_actor_user_id, 'marsoh.moderation.' || p_decision, 'marsoh_message', p_message_id,
    v_message.normalized_hash, jsonb_build_object('reason', left(btrim(p_reason), 500))
  );
end;
$$;

drop trigger if exists marsoh_audit_events_immutable on public.marsoh_audit_events;
create trigger marsoh_audit_events_immutable
  before update or delete on public.marsoh_audit_events
  for each row execute function public.marsoh_audit_append_only();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'marsoh_channels', 'marsoh_channel_memberships', 'marsoh_messages',
    'marsoh_moderation_decisions', 'marsoh_published_messages',
    'marsoh_translation_cache', 'marsoh_message_reactions',
    'marsoh_user_blocks', 'marsoh_message_reports', 'marsoh_user_sanctions',
    'marsoh_rate_limit_events', 'marsoh_audit_events', 'marsoh_topic_cards'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

drop policy if exists marsoh_channels_member_select on public.marsoh_channels;
create policy marsoh_channels_member_select on public.marsoh_channels
  for select to authenticated
  using (public.marsoh_can_read_channel(id));

drop policy if exists marsoh_memberships_own_select on public.marsoh_channel_memberships;
create policy marsoh_memberships_own_select on public.marsoh_channel_memberships
  for select to authenticated using (user_id = auth.uid());

drop policy if exists marsoh_published_member_select on public.marsoh_published_messages;
create policy marsoh_published_member_select on public.marsoh_published_messages
  for select to authenticated
  using (
    public.marsoh_can_read_channel(channel_id)
    and sender_user_id <> auth.uid()
    and not public.marsoh_sender_is_blocked(sender_user_id)
  );

revoke all on table public.marsoh_channels from public, anon, authenticated;
revoke all on table public.marsoh_channel_memberships from public, anon, authenticated;
revoke all on table public.marsoh_messages from public, anon, authenticated;
revoke all on table public.marsoh_moderation_decisions from public, anon, authenticated;
revoke all on table public.marsoh_published_messages from public, anon, authenticated;
revoke all on table public.marsoh_translation_cache from public, anon, authenticated;
revoke all on table public.marsoh_message_reactions from public, anon, authenticated;
revoke all on table public.marsoh_user_blocks from public, anon, authenticated;
revoke all on table public.marsoh_message_reports from public, anon, authenticated;
revoke all on table public.marsoh_user_sanctions from public, anon, authenticated;
revoke all on table public.marsoh_rate_limit_events from public, anon, authenticated;
revoke all on table public.marsoh_audit_events from public, anon, authenticated;
revoke all on table public.marsoh_topic_cards from public, anon, authenticated;

grant select on table public.marsoh_channels to authenticated;
grant select on table public.marsoh_channel_memberships to authenticated;
grant select on table public.marsoh_published_messages to authenticated;
revoke all on function public.marsoh_can_read_channel(uuid) from public, anon;
revoke all on function public.marsoh_sender_is_blocked(uuid) from public, anon;
revoke all on function public.marsoh_visible_messages(uuid,timestamptz,integer) from public, anon;
grant execute on function public.marsoh_can_read_channel(uuid) to authenticated;
grant execute on function public.marsoh_sender_is_blocked(uuid) to authenticated;
grant execute on function public.marsoh_visible_messages(uuid,timestamptz,integer) to authenticated;
revoke all on function public.marsoh_accept_text_message(uuid,uuid,uuid,text,uuid,text,text,text,text,text,text,text,numeric,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.marsoh_admin_decide_message(uuid,uuid,text,text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on table public.marsoh_channels to service_role;
    grant all on table public.marsoh_channel_memberships to service_role;
    grant all on table public.marsoh_messages to service_role;
    grant all on table public.marsoh_moderation_decisions to service_role;
    grant all on table public.marsoh_published_messages to service_role;
    grant all on table public.marsoh_translation_cache to service_role;
    grant all on table public.marsoh_message_reactions to service_role;
    grant all on table public.marsoh_user_blocks to service_role;
    grant all on table public.marsoh_message_reports to service_role;
    grant all on table public.marsoh_user_sanctions to service_role;
    grant all on table public.marsoh_rate_limit_events to service_role;
    grant all on table public.marsoh_audit_events to service_role;
    grant all on table public.marsoh_topic_cards to service_role;
    grant usage, select on sequence public.marsoh_rate_limit_events_id_seq to service_role;
    grant execute on function public.marsoh_accept_text_message(uuid,uuid,uuid,text,uuid,text,text,text,text,text,text,text,numeric,text,text,text,text,text) to service_role;
    grant execute on function public.marsoh_admin_decide_message(uuid,uuid,text,text) to service_role;
  end if;
end $$;

alter table public.marsoh_published_messages replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'marsoh_published_messages'
    ) then
    alter publication supabase_realtime add table public.marsoh_published_messages;
  end if;
end $$;

comment on table public.marsoh_messages is 'Accepted text-only MarSoh messages. No client grant and no moderation-state columns.';
comment on table public.marsoh_published_messages is 'The only MarSoh table exposed to Realtime; contains published text only.';
comment on table public.marsoh_moderation_decisions is 'Restricted moderation state. Never expose through sender responses or Realtime.';
comment on function public.marsoh_visible_messages(uuid,timestamptz,integer) is 'Masks the sender moderation state by returning every accepted own message with the same public shape.';
