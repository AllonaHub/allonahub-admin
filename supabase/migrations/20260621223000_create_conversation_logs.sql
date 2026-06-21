-- Central assistant conversation log for webchat, Telegram, panels and future channels.

create table if not exists public.conversation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  channel text not null
    check (channel in ('telegram', 'webchat', 'partner_panel', 'admin_panel', 'whatsapp', 'instagram')),
  sender_type text not null
    check (sender_type in ('user', 'assistant', 'system', 'admin', 'partner', 'bot')),
  message text not null check (length(trim(message)) between 1 and 4000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversation_logs_user_created_idx
  on public.conversation_logs(user_id, created_at desc);

create index if not exists conversation_logs_channel_created_idx
  on public.conversation_logs(channel, created_at desc);

create index if not exists conversation_logs_metadata_gin_idx
  on public.conversation_logs using gin(metadata);

alter table public.conversation_logs enable row level security;
alter table public.conversation_logs force row level security;

drop policy if exists "conversation_logs_owner_or_admin_select" on public.conversation_logs;
create policy "conversation_logs_owner_or_admin_select"
  on public.conversation_logs for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "conversation_logs_owner_insert" on public.conversation_logs;
create policy "conversation_logs_owner_insert"
  on public.conversation_logs for insert
  to authenticated
  with check (user_id = auth.uid());

revoke all on public.conversation_logs from anon;
revoke all on public.conversation_logs from public;
grant select, insert on public.conversation_logs to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.conversation_logs to service_role;
  end if;
end $$;

comment on table public.conversation_logs is
  'Central AllonaHub assistant logs for channel-independent support conversations. Public channels must write through the backend service, not direct anon table access.';
