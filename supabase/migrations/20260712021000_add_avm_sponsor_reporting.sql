create table if not exists public.mall_ad_slot_interactions (
  id uuid primary key default gen_random_uuid(),
  mall_id uuid not null references public.mall_centers(id) on delete cascade,
  ad_slot_id uuid not null references public.mall_ad_slots(id) on delete cascade,
  ad_slot_public_id text not null,
  visitor_session_id uuid not null,
  interaction_type text not null check (interaction_type in ('impression', 'click')),
  source_page text not null default 'avm-dunyasi' check (source_page = 'avm-dunyasi'),
  interaction_date date not null default ((now() at time zone 'Europe/Istanbul')::date),
  created_at timestamptz not null default now(),
  check (length(trim(ad_slot_public_id)) between 1 and 180)
);

create index if not exists mall_ad_slot_interactions_mall_date_idx
  on public.mall_ad_slot_interactions(mall_id, interaction_date desc, created_at desc);

create index if not exists mall_ad_slot_interactions_slot_type_idx
  on public.mall_ad_slot_interactions(ad_slot_id, interaction_type, created_at desc);

create unique index if not exists mall_ad_slot_interactions_daily_unique
  on public.mall_ad_slot_interactions(ad_slot_id, visitor_session_id, interaction_type, interaction_date);

create or replace function public.normalize_mall_ad_slot_interaction()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target public.mall_ad_slots%rowtype;
begin
  select *
  into target
  from public.mall_ad_slots slot
  where slot.id = new.ad_slot_id
    and slot.mall_id = new.mall_id
    and slot.status = 'active'
    and slot.creative_image_url is not null
    and char_length(btrim(slot.creative_image_alt)) >= 3
    and char_length(btrim(slot.cta_label)) >= 2
    and slot.cta_url ~* '^https?://[^[:space:]]+$'
    and slot.starts_at <= now()
    and slot.ends_at >= now()
    and exists (
      select 1
      from public.mall_centers center
      where center.id = new.mall_id
        and center.status = 'active'
    );

  if not found then
    raise exception 'Aktif ve güncel AVM sponsor hedefi bulunamadı.';
  end if;

  new.ad_slot_public_id := target.public_id;
  new.interaction_date := (now() at time zone 'Europe/Istanbul')::date;
  return new;
end;
$$;

drop trigger if exists mall_ad_slot_interactions_normalize on public.mall_ad_slot_interactions;
create trigger mall_ad_slot_interactions_normalize
  before insert on public.mall_ad_slot_interactions
  for each row execute function public.normalize_mall_ad_slot_interaction();

alter table public.mall_ad_slot_interactions enable row level security;

drop policy if exists "mall_ad_slot_interactions_insert_public" on public.mall_ad_slot_interactions;
create policy "mall_ad_slot_interactions_insert_public"
  on public.mall_ad_slot_interactions for insert
  with check (
    source_page = 'avm-dunyasi'
    and exists (
      select 1
      from public.mall_ad_slots slot
      where slot.id = mall_ad_slot_interactions.ad_slot_id
        and slot.mall_id = mall_ad_slot_interactions.mall_id
        and slot.status = 'active'
        and slot.creative_image_url is not null
        and char_length(btrim(slot.creative_image_alt)) >= 3
        and char_length(btrim(slot.cta_label)) >= 2
        and slot.cta_url ~* '^https?://[^[:space:]]+$'
        and slot.starts_at <= now()
        and slot.ends_at >= now()
        and exists (
          select 1
          from public.mall_centers center
          where center.id = mall_ad_slot_interactions.mall_id
            and center.status = 'active'
        )
    )
  );

drop policy if exists "mall_ad_slot_interactions_admin_read" on public.mall_ad_slot_interactions;
create policy "mall_ad_slot_interactions_admin_read"
  on public.mall_ad_slot_interactions for select
  using (public.is_admin());

drop policy if exists "mall_ad_slot_interactions_partner_read_own" on public.mall_ad_slot_interactions;
create policy "mall_ad_slot_interactions_partner_read_own"
  on public.mall_ad_slot_interactions for select
  using (
    public.is_partner_or_admin()
    and exists (
      select 1
      from public.mall_partner_submissions submission
      where submission.published_ad_slot_id = mall_ad_slot_interactions.ad_slot_id
        and submission.submitted_by = auth.uid()
        and submission.module_key = 'mall'
        and submission.request_type = 'advertising'
        and submission.visibility_status = 'published'
    )
  );

create or replace function public.get_mall_ad_slot_interaction_summary(
  report_ad_slot_ids uuid[]
)
returns table (
  ad_slot_id uuid,
  impression_count bigint,
  click_count bigint,
  click_rate numeric,
  recent_impression_count bigint,
  recent_click_count bigint,
  last_interaction_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    interaction.ad_slot_id,
    count(*) filter (where interaction.interaction_type = 'impression') as impression_count,
    count(*) filter (where interaction.interaction_type = 'click') as click_count,
    round(
      100.0 * count(*) filter (where interaction.interaction_type = 'click')
      / nullif(count(*) filter (where interaction.interaction_type = 'impression'), 0),
      2
    ) as click_rate,
    count(*) filter (
      where interaction.interaction_type = 'impression'
        and interaction.interaction_date >= ((now() at time zone 'Europe/Istanbul')::date - 29)
    ) as recent_impression_count,
    count(*) filter (
      where interaction.interaction_type = 'click'
        and interaction.interaction_date >= ((now() at time zone 'Europe/Istanbul')::date - 29)
    ) as recent_click_count,
    max(interaction.created_at) as last_interaction_at
  from public.mall_ad_slot_interactions interaction
  where (select public.is_partner_or_admin())
    and cardinality(coalesce(report_ad_slot_ids, '{}'::uuid[])) > 0
    and interaction.ad_slot_id = any(report_ad_slot_ids)
  group by interaction.ad_slot_id
  order by count(*) filter (where interaction.interaction_type = 'impression') desc, interaction.ad_slot_id;
$$;

comment on table public.mall_ad_slot_interactions is 'Daily unique anonymous sponsor impressions and clicks for active AVM placements.';
comment on function public.get_mall_ad_slot_interaction_summary(uuid[]) is 'RLS-scoped sponsor performance totals for partner and admin reporting.';
