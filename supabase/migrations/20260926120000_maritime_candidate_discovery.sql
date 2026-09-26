create table if not exists public.maritime_candidate_discovery (
  seafarer_user_id uuid primary key references public.profiles(id) on delete cascade,
  visible_to_verified_partners boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.maritime_candidate_intro_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_businesses(id) on delete cascade,
  job_id uuid not null references public.maritime_jobs(id) on delete cascade,
  seafarer_user_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique (partner_id, job_id, seafarer_user_id)
);

create index if not exists maritime_candidate_intro_requests_candidate_idx
  on public.maritime_candidate_intro_requests (seafarer_user_id, status, created_at desc);

alter table public.maritime_candidate_discovery enable row level security;
alter table public.maritime_candidate_intro_requests enable row level security;
revoke all on public.maritime_candidate_discovery from anon, authenticated;
revoke all on public.maritime_candidate_intro_requests from anon, authenticated;
grant all on public.maritime_candidate_discovery to service_role;
grant all on public.maritime_candidate_intro_requests to service_role;

create or replace function public.maritime_intro_room_visible(p_room_id uuid)
returns boolean language sql security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.maritime_private_candidate_rooms room
    where room.id = p_room_id
      and (
        room.application_id is not null
        or room.seafarer_user_id = auth.uid()
        or (
          room.status in ('active', 'offer', 'hired')
          and room.candidate_visible = true
          and (room.expires_at is null or room.expires_at > now())
          and exists (
            select 1 from public.maritime_candidate_intro_requests intro
            where intro.partner_id = room.partner_id
              and intro.job_id = room.job_id
              and intro.seafarer_user_id = room.seafarer_user_id
              and intro.status = 'accepted'
          )
          and exists (
            select 1 from public.maritime_candidate_document_grants grant_row
            where grant_row.candidate_room_id = room.id
              and grant_row.status = 'accepted'
              and grant_row.expires_at > now()
          )
        )
      )
  );
$$;
revoke all on function public.maritime_intro_room_visible(uuid) from public, anon;
grant execute on function public.maritime_intro_room_visible(uuid) to authenticated, service_role;

create or replace function public.maritime_intro_thread_visible(p_thread_id uuid)
returns boolean language sql security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.maritime_connect_threads thread
    where thread.id = p_thread_id
      and (
        thread.candidate_room_id is null
        or public.maritime_intro_room_visible(thread.candidate_room_id)
      )
  );
$$;
revoke all on function public.maritime_intro_thread_visible(uuid) from public, anon;
grant execute on function public.maritime_intro_thread_visible(uuid) to authenticated, service_role;

create policy maritime_intro_room_consent_select
  on public.maritime_private_candidate_rooms as restrictive for select to authenticated
  using (public.maritime_intro_room_visible(id));

create policy maritime_intro_thread_consent_select
  on public.maritime_connect_threads as restrictive for select to authenticated
  using (candidate_room_id is null or public.maritime_intro_room_visible(candidate_room_id));

create policy maritime_intro_messages_consent_select
  on public.maritime_connect_messages as restrictive for select to authenticated
  using (public.maritime_intro_thread_visible(thread_id));
