-- Private company/candidate chat reuses Maritime Connect and the consented candidate room.
create unique index if not exists maritime_connect_private_candidate_unique_idx
  on public.maritime_connect_threads(candidate_room_id)
  where thread_scope = 'private_candidate' and candidate_room_id is not null;

create table if not exists public.maritime_connect_read_cursors (
  thread_id uuid not null references public.maritime_connect_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists maritime_connect_messages_thread_recent_idx
  on public.maritime_connect_messages(thread_id, created_at desc, id desc);
create unique index if not exists maritime_connect_message_client_uidx
  on public.maritime_connect_messages(thread_id, sender_user_id, ((metadata ->> 'client_id')))
  where message_type = 'text' and metadata ? 'client_id';

alter table public.maritime_connect_read_cursors enable row level security;
revoke all on public.maritime_connect_read_cursors from public, anon, authenticated;
grant all on public.maritime_connect_read_cursors to service_role;

comment on table public.maritime_connect_read_cursors is
  'Server-managed per-user cursor for consented private company/candidate text conversations.';
