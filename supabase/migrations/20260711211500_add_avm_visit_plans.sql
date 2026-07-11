create table if not exists public.mall_visit_plans (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid references public.mall_centers(id) on delete cascade,
  contact_email text,
  visitor_note text,
  selected_item_ids text[] not null default '{}',
  selected_item_titles text[] not null default '{}',
  total_stops integer not null default 0 check (total_stops >= 0),
  total_minutes integer not null default 0 check (total_minutes >= 0),
  total_touch_score integer not null default 0 check (total_touch_score >= 0),
  source_page text not null default 'avm-dunyasi',
  status text not null default 'new' check (status in ('new', 'reviewed', 'actioned', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mall_visit_plans_mall_status_idx
  on public.mall_visit_plans(mall_id, status, created_at desc);

drop trigger if exists mall_visit_plans_set_updated_at on public.mall_visit_plans;
create trigger mall_visit_plans_set_updated_at
  before update on public.mall_visit_plans
  for each row execute function public.set_updated_at();

alter table public.mall_visit_plans enable row level security;

drop policy if exists "mall_visit_plans_insert_public" on public.mall_visit_plans;
create policy "mall_visit_plans_insert_public"
  on public.mall_visit_plans for insert
  with check (status = 'new' and total_stops > 0);

drop policy if exists "mall_visit_plans_admin_read" on public.mall_visit_plans;
create policy "mall_visit_plans_admin_read"
  on public.mall_visit_plans for select
  using (public.is_admin());

drop policy if exists "mall_visit_plans_admin_update" on public.mall_visit_plans;
create policy "mall_visit_plans_admin_update"
  on public.mall_visit_plans for update
  using (public.is_admin())
  with check (public.is_admin());
