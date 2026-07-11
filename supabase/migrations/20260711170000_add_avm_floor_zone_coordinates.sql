alter table public.mall_floor_zones
  add column if not exists map_x_percent numeric(5,2) not null default 10 check (map_x_percent >= 0 and map_x_percent <= 95),
  add column if not exists map_y_percent numeric(5,2) not null default 25 check (map_y_percent >= 0 and map_y_percent <= 95),
  add column if not exists map_width_percent numeric(5,2) not null default 25 check (map_width_percent >= 10 and map_width_percent <= 90),
  add column if not exists map_height_px integer not null default 58 check (map_height_px >= 44 and map_height_px <= 180);
