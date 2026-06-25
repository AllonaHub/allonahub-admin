alter table public.products
  add column if not exists module_key text not null default 'shop';

update public.products
set module_key = 'shop'
where module_key is null
   or module_key not in ('shop', 'market', 'food', 'taxi', 'service');

alter table public.products
  alter column module_key set default 'shop',
  alter column module_key set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_module_key_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_module_key_check
      check (module_key in ('shop', 'market', 'food', 'taxi', 'service'));
  end if;
end $$;

create index if not exists products_module_status_idx
  on public.products(module_key, status, created_at desc);

update public.products
set module_key = 'market'
where module_key <> 'market'
  and (
    lower(coalesce(brand, '')) like '%allona market%'
    or lower(coalesce(category, '')) like 'market /%'
    or lower(coalesce(category, '')) in (
      'süpermarket',
      'supermarket',
      'gıda',
      'gida',
      'içecek',
      'icecek',
      'temizlik',
      'kahvaltı',
      'kahvalti'
    )
  );

update public.products
set module_key = 'food'
where module_key = 'shop'
  and (
    lower(coalesce(brand, '')) like '%allona yemek%'
    or lower(coalesce(category, '')) like 'yemek /%'
    or lower(coalesce(category, '')) like '%restoran%'
    or lower(coalesce(category, '')) like '%menü%'
    or lower(coalesce(category, '')) like '%menu%'
  );

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'sku'
  ) then
    update public.products
    set module_key = 'market'
    where module_key <> 'market'
      and upper(coalesce(sku, '')) like 'ALM-%';

    update public.products
    set module_key = 'food'
    where module_key = 'shop'
      and upper(coalesce(sku, '')) like 'ALY-%';
  end if;
end $$;

do $$
declare
  name_column text;
  has_old_price boolean;
  has_sku boolean;
  has_barcode boolean;
  has_coupon_status boolean;
  has_hp_status boolean;
  has_slug boolean;
  has_meta_title boolean;
  has_meta_description boolean;
  row_exists boolean;
  product record;
  columns_sql text;
  values_sql text;
begin
  select case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'products' and column_name = 'name'
    ) then 'name'
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'products' and column_name = 'product_name'
    ) then 'product_name'
    else null
  end into name_column;

  if name_column is null then
    raise notice 'Allona Market seed skipped: products table has no name/product_name column.';
    return;
  end if;

  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'old_price') into has_old_price;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'sku') into has_sku;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'barcode') into has_barcode;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'coupon_status') into has_coupon_status;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'hp_status') into has_hp_status;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'slug') into has_slug;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'meta_title') into has_meta_title;
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'products' and column_name = 'meta_description') into has_meta_description;

  for product in
    select * from (values
      ('ALM-SEBZE-001', '8690000001001', 'Allona Market Taze Sebze Paketi', 'Market / Meyve Sebze', 429.90, 349.90, 42, '/images/modules/market-light-v5.jpg', 'Günlük seçilmiş domates, salatalık, biber, yeşillik ve mevsim sebzeleriyle hızlı teslimata uygun market paketi.'),
      ('ALM-SUT-001', '8690000001002', 'Günlük Süt 1 L', 'Market / Kahvaltı', 49.90, 39.90, 80, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=80', 'Kahvaltı ve günlük kullanım için soğuk zincire uygun, taze içimlik süt.'),
      ('ALM-YUMURTA-001', '8690000001003', 'Gezen Tavuk Yumurtası 15''li', 'Market / Kahvaltı', 159.90, 129.90, 64, 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?auto=format&fit=crop&w=900&q=80', 'Kahvaltı, hamur işi ve günlük mutfak kullanımı için 15''li ekonomik yumurta paketi.'),
      ('ALM-MEYVE-001', '8690000001004', 'Mevsim Meyve Sepeti', 'Market / Meyve Sebze', 389.90, 319.90, 38, 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=900&q=80', 'Elma, muz, portakal ve mevsim meyvelerinden oluşan sunuma hazır taze paket.'),
      ('ALM-KAHVE-001', '8690000001005', 'Allona Türk Kahvesi 250 g', 'Market / Kahvaltı', 149.90, 119.90, 55, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80', 'Yoğun aromalı, taze çekilmiş kahve keyfi için ekonomik paket.'),
      ('ALM-ZEYTINYAGI-001', '8690000001006', 'Natürel Sızma Zeytinyağı 1 L', 'Market / Temel Gıda', 469.90, 399.90, 34, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=80', 'Salata, kahvaltı ve günlük yemekler için natürel sızma zeytinyağı.'),
      ('ALM-MAKARNA-001', '8690000001007', 'Makarna ve Domates Sos Paketi', 'Market / Temel Gıda', 149.90, 119.90, 90, 'https://images.unsplash.com/photo-1556761223-4c4282c73f77?auto=format&fit=crop&w=900&q=80', 'Hızlı akşam yemeği için makarna ve sos ikili avantaj paketi.'),
      ('ALM-SU-001', '8690000001008', 'Doğal Kaynak Suyu 6 x 1.5 L', 'Market / İçecek', 99.90, 79.90, 120, '/images/modules/market-water-pack.png', 'Ev ve ofis kullanımı için altılı doğal kaynak suyu paketi.'),
      ('ALM-TEMIZLIK-001', '8690000001009', 'Ev Temizlik Başlangıç Paketi', 'Market / Temizlik', 349.90, 279.90, 36, 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?auto=format&fit=crop&w=900&q=80', 'Mutfak, banyo ve yüzey temizliği için çoklu ekonomik temizlik paketi.'),
      ('ALM-KAGIT-001', '8690000001010', 'Kağıt Havlu 12''li Ekonomik Paket', 'Market / Ev İhtiyaçları', 229.90, 189.90, 52, '/images/modules/market-paper-towels.png', 'Mutfak ve günlük temizlik kullanımı için yüksek emici kağıt havlu paketi.'),
      ('ALM-BEBEK-001', '8690000001011', 'Bebek Islak Mendil 6''lı', 'Market / Bebek', 199.90, 169.90, 48, '/images/modules/market-baby-wipes.png', 'Hassas ciltler için günlük kullanıma uygun çoklu ıslak mendil paketi.'),
      ('ALM-ATISTIRMALIK-001', '8690000001012', 'Aile Boyu Atıştırmalık Kutusu', 'Market / Atıştırmalık', 259.90, 219.90, 44, '/images/modules/market-snack-box.png', 'Film, ofis ve aile kullanımı için tatlı-tuzlu atıştırmalık seçkisi.')
    ) as seed(sku, barcode, product_name, category, old_price, price, stock, image_url, description)
  loop
    if has_sku then
      execute 'select exists(select 1 from public.products where sku = $1)' into row_exists using product.sku;
    else
      execute format('select exists(select 1 from public.products where %I = $1)', name_column) into row_exists using product.product_name;
    end if;

    if not row_exists then
      columns_sql = format('%I, description, price, stock, image_url, category, status, brand, module_key', name_column);
      values_sql = '$1, $2, $3, $4, $5, $6, ''active'', ''Allona Market'', ''market''';

      if has_old_price then
        columns_sql = columns_sql || ', old_price';
        values_sql = values_sql || ', $7';
      end if;
      if has_sku then
        columns_sql = columns_sql || ', sku';
        values_sql = values_sql || ', $8';
      end if;
      if has_barcode then
        columns_sql = columns_sql || ', barcode';
        values_sql = values_sql || ', $9';
      end if;
      if has_coupon_status then
        columns_sql = columns_sql || ', coupon_status';
        values_sql = values_sql || ', ''true''';
      end if;
      if has_hp_status then
        columns_sql = columns_sql || ', hp_status';
        values_sql = values_sql || ', ''true''';
      end if;
      if has_slug then
        columns_sql = columns_sql || ', slug';
        values_sql = values_sql || ', lower(regexp_replace($1 || ''-'' || $8, ''[^a-zA-Z0-9]+'', ''-'', ''g''))';
      end if;
      if has_meta_title then
        columns_sql = columns_sql || ', meta_title';
        values_sql = values_sql || ', $1';
      end if;
      if has_meta_description then
        columns_sql = columns_sql || ', meta_description';
        values_sql = values_sql || ', $2';
      end if;

      execute format('insert into public.products (%s) values (%s)', columns_sql, values_sql)
      using product.product_name, product.description, product.price, product.stock, product.image_url, product.category, product.old_price, product.sku, product.barcode;
    end if;
  end loop;
end $$;
