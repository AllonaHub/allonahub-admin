alter table public.mall_centers alter column status set default 'draft';
alter table public.mall_directory_items alter column status set default 'draft';
alter table public.mall_floor_zones alter column status set default 'draft';
alter table public.mall_ad_slots alter column status set default 'draft';

with placeholders(public_id, title) as (
  values
    ('store-beymen', 'Beymen Select'),
    ('store-tech', 'Allona Tech Studio'),
    ('store-kids', 'MiniCity Kids'),
    ('store-sport', 'Urban Sport Lab'),
    ('store-home', 'Casa Living'),
    ('store-beauty', 'Glow Beauty Bar'),
    ('event-family', 'Hafta Sonu Aile Sahnesi'),
    ('event-fashion', 'Sezon Stil Buluşması'),
    ('event-tech', 'Akıllı Yaşam Günü'),
    ('event-art', 'Yerel Sanat Rotası'),
    ('deal-fashion', 'Stil Haftası Sepet Avantajı'),
    ('deal-dining', 'Food Court Akşam Menüsü'),
    ('deal-parking', 'Otopark + Alışveriş Paketi'),
    ('deal-gift', 'Hediye Kartı ve Marka Puanı'),
    ('dine-roof', 'Roof Garden Bistro'),
    ('dine-fast', 'Fast Street'),
    ('dine-coffee', 'Atrium Coffee'),
    ('dine-dessert', 'Sweet Lab')
)
update public.mall_directory_items as item
set status = 'archived', updated_at = now()
from placeholders
where item.public_id = placeholders.public_id
  and item.title = placeholders.title
  and item.status <> 'archived';

with placeholders(public_id, title) as (
  values
    ('zone-fashion', 'Moda Koridoru'),
    ('zone-atrium', 'Ana Atrium'),
    ('zone-dining', 'Yeme Katı'),
    ('zone-parking', 'Otopark Bağlantısı'),
    ('zone-services', 'Danışma ve Hizmetler')
)
update public.mall_floor_zones as zone
set status = 'archived', updated_at = now()
from placeholders
where zone.public_id = placeholders.public_id
  and zone.title = placeholders.title
  and zone.status <> 'archived';

with placeholders(public_id, title) as (
  values
    ('ad-sponsored-store', 'Sponsorlu Mağaza Kartı'),
    ('ad-atrium-event', 'Atrium Etkinlik Paketi'),
    ('ad-digital-screen', 'Dijital Ekran ve Banner'),
    ('ad-popup-lead', 'Kiralama ve Pop-up Lead')
)
update public.mall_ad_slots as slot
set status = 'archived', updated_at = now()
from placeholders
where slot.public_id = placeholders.public_id
  and slot.title = placeholders.title
  and slot.status <> 'archived';

with placeholders(public_id, title) as (
  values
    ('map-ground-floor', 'Zemin Kat Planı')
)
update public.mall_floor_maps as map
set status = 'archived', updated_at = now()
from placeholders
where map.public_id = placeholders.public_id
  and map.title = placeholders.title
  and map.status <> 'archived';

update public.mall_centers as center
set
  name = 'AVM Merkezi',
  district = null,
  address = null,
  phone = null,
  website_url = null,
  hero_image_url = null,
  status = 'draft',
  updated_at = now()
where center.slug = 'allona-avm-dunyasi'
  and center.name = 'Allona AVM Dünyası'
  and center.city = 'İstanbul'
  and center.district = 'Merkez'
  and center.address = 'AllonaHub AVM ağı'
  and center.phone = '+90 542 778 18 68'
  and center.website_url = 'https://allonahub.com/avm-dunyasi.html'
  and center.hero_image_url = 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=1400&q=80'
  and center.status = 'active'
  and not exists (
    select 1 from public.mall_directory_items item
    where item.mall_id = center.id and item.status = 'active'
  )
  and not exists (
    select 1 from public.mall_floor_zones zone
    where zone.mall_id = center.id and zone.status = 'active'
  )
  and not exists (
    select 1 from public.mall_floor_maps map
    where map.mall_id = center.id and map.status = 'active'
  )
  and not exists (
    select 1 from public.mall_services service
    where service.mall_id = center.id and service.status = 'active'
  )
  and not exists (
    select 1 from public.mall_ad_slots slot
    where slot.mall_id = center.id and slot.status = 'active'
  );
