insert into public.food_module_setups (id, setup_key, title, status, settings)
values (
  '10000000-0000-4000-8000-000000000900',
  'default_sale_ready_marketplace',
  'Satışa Hazır Yemek Pazaryeri Kurulumu',
  'active',
  '{
    "requires_admin_approval": true,
    "requires_image_name_match": true,
    "requires_allergen_fields": true,
    "default_currency": "TRY",
    "delivery_handoff_schema": "food-courier-handoff.v1",
    "storage_bucket": "food-product-images"
  }'::jsonb
)
on conflict (setup_key) do update
set title = excluded.title,
    status = excluded.status,
    settings = excluded.settings,
    updated_at = now();

insert into public.food_partners (
  id,
  name,
  slug,
  legal_name,
  status,
  cuisine_tags,
  service_modes,
  opening_hours,
  pickup_location,
  delivery_radius_meters,
  min_order_amount,
  contact_phone
)
values (
  '10000000-0000-4000-8000-000000000001',
  'ALLONAHUB Demo Lezzet Mutfağı',
  'allonahub-demo-lezzet-mutfagi',
  'ALLONAHUB Demo Lezzet Mutfağı',
  'active',
  array['Türk mutfağı', 'hızlı servis', 'tatlı'],
  array['delivery', 'pickup'],
  '{
    "timezone": "Europe/Istanbul",
    "weekly": {
      "monday": [["10:00", "22:00"]],
      "tuesday": [["10:00", "22:00"]],
      "wednesday": [["10:00", "22:00"]],
      "thursday": [["10:00", "22:00"]],
      "friday": [["10:00", "23:00"]],
      "saturday": [["10:00", "23:00"]],
      "sunday": [["11:00", "22:00"]]
    }
  }'::jsonb,
  '{
    "address": "Demo restoran teslim alma noktası",
    "lat": 41.015,
    "lng": 28.979
  }'::jsonb,
  6000,
  100,
  '+90 555 000 00 00'
)
on conflict (slug) do update
set name = excluded.name,
    legal_name = excluded.legal_name,
    status = excluded.status,
    cuisine_tags = excluded.cuisine_tags,
    service_modes = excluded.service_modes,
    opening_hours = excluded.opening_hours,
    pickup_location = excluded.pickup_location,
    delivery_radius_meters = excluded.delivery_radius_meters,
    min_order_amount = excluded.min_order_amount,
    contact_phone = excluded.contact_phone,
    updated_at = now();

insert into public.food_categories (id, name, slug, sort_order, is_active)
values
  ('10000000-0000-4000-8000-000000000011', 'Dürüm', 'durum', 10, true),
  ('10000000-0000-4000-8000-000000000012', 'Fırın', 'firin', 20, true),
  ('10000000-0000-4000-8000-000000000013', 'Çorba', 'corba', 30, true),
  ('10000000-0000-4000-8000-000000000014', 'Tatlı', 'tatli', 40, true)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.food_products (
  id,
  partner_id,
  category_id,
  name,
  slug,
  description,
  price,
  currency,
  status,
  stock_status,
  prep_time_minutes,
  image_url,
  image_alt,
  image_match_status,
  ingredients,
  allergens,
  tags,
  is_featured,
  courier_required,
  pickup_only,
  max_delivery_distance_meters,
  approved_at,
  published_at
)
values
  (
    '10000000-0000-4000-8000-000000000101',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000011',
    'Tavuk Döner Dürüm',
    'tavuk-doner-durum',
    'Izgara tavuk döner, marul, domates ve özel sosla sarılmış sıcak lavaş dürüm.',
    185,
    'TRY',
    'active',
    'in_stock',
    18,
    'yemek-modulu/assets/img/tavuk-doner-durum.png',
    'Tavuk döner dürüm, turşu eşliğinde beyaz tabakta',
    'approved',
    array['tavuk döner', 'lavaş', 'marul', 'domates', 'sos'],
    array['gluten', 'süt ürünü içerebilir'],
    array['dürüm', 'tavuk', 'hızlı servis'],
    true,
    true,
    false,
    6000,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000102',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000012',
    'Lahmacun',
    'lahmacun',
    'İnce hamur üzerinde baharatlı kıyma harcı, limon, maydanoz ve soğan eşliğiyle.',
    110,
    'TRY',
    'active',
    'in_stock',
    15,
    'yemek-modulu/assets/img/lahmacun.png',
    'Limon, maydanoz ve soğanla servis edilen lahmacun',
    'approved',
    array['ince hamur', 'kıyma', 'domates', 'biber', 'maydanoz'],
    array['gluten'],
    array['lahmacun', 'fırın', 'klasik'],
    true,
    true,
    false,
    6000,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000103',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000013',
    'Mercimek Çorbası',
    'mercimek-corbasi',
    'Kırmızı mercimekle hazırlanmış sıcak çorba, tereyağlı pul biber ve limonla servis edilir.',
    95,
    'TRY',
    'active',
    'in_stock',
    10,
    'yemek-modulu/assets/img/mercimek-corbasi.png',
    'Limon ve ekmekle servis edilen mercimek çorbası',
    'approved',
    array['kırmızı mercimek', 'tereyağı', 'pul biber', 'limon'],
    array['süt ürünü'],
    array['çorba', 'sıcak', 'vejetaryen'],
    false,
    true,
    false,
    6000,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000104',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000014',
    'Fıstıklı Baklava',
    'fistikli-baklava',
    'Şerbetli, çıtır katmanlı, bol Antep fıstıklı klasik baklava porsiyonu.',
    165,
    'TRY',
    'active',
    'in_stock',
    5,
    'yemek-modulu/assets/img/fistikli-baklava.png',
    'Antep fıstıklı baklava dilimleri beyaz tabakta',
    'approved',
    array['yufka', 'Antep fıstığı', 'şerbet', 'tereyağı'],
    array['gluten', 'ağaç yemişi', 'süt ürünü'],
    array['tatlı', 'baklava', 'fıstık'],
    false,
    true,
    false,
    6000,
    now(),
    now()
  )
on conflict (partner_id, slug) do update
set category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    currency = excluded.currency,
    status = excluded.status,
    stock_status = excluded.stock_status,
    prep_time_minutes = excluded.prep_time_minutes,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    image_match_status = excluded.image_match_status,
    ingredients = excluded.ingredients,
    allergens = excluded.allergens,
    tags = excluded.tags,
    is_featured = excluded.is_featured,
    courier_required = excluded.courier_required,
    pickup_only = excluded.pickup_only,
    max_delivery_distance_meters = excluded.max_delivery_distance_meters,
    approved_at = excluded.approved_at,
    published_at = excluded.published_at,
    updated_at = now();

insert into public.food_product_media (
  product_id,
  url,
  storage_path,
  kind,
  alt_text,
  image_match_status,
  sort_order
)
select
  product.id,
  product.image_url,
  product.image_url,
  'image',
  product.image_alt,
  'approved',
  0
from public.food_products product
where product.partner_id = '10000000-0000-4000-8000-000000000001'
on conflict do nothing;

