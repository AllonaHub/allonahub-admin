alter table public.mall_directory_interactions
  drop constraint if exists mall_directory_interactions_interaction_type_check;

alter table public.mall_directory_interactions
  add constraint mall_directory_interactions_interaction_type_check
  check (
    interaction_type in ('detail_view', 'route_open', 'plan_add', 'favorite_save', 'cta_open', 'website_open', 'phone_open', 'share')
  );
