# Partner Integration Core

AllonaHub Partner Integration Core, partner ürünlerini dış kaynaklardan AllonaHub kataloğuna almak ve ileride AllonaHub ürünlerini dış platformlara yayınlamak için kurulan ücretsiz başlangıç altyapısıdır.

## Başlangıç Kapsamı

- Ürün çekme ücretsiz açık: `generic_feed`, `woocommerce`, `shopify`, `trendyol`, `hepsiburada`, `n11`, `custom_api`
- Premium: tam entegrasyon / outbound yayın
- Planlı: `ciceksepeti`, `pazarama`
- Güvenli varsayılan: dışarıdan çekilen ürünler `draft` durumunda bekletilir
- Panel: Partner OS > Entegrasyonlar
- Cron: `POST /v1/cron/integrations/sync`
- API secretleri: server-side AES-256-GCM vault ile saklanır, frontend'e geri dönmez

## Veritabanı

Migration:

```text
supabase/migrations/20260628120000_create_partner_integration_core.sql
supabase/migrations/20260629103000_partner_integration_mvp_hardening.sql
```

Ana tablolar:

- `partner_integration_connectors`: Connector kataloğu ve free/premium bayrakları
- `partner_integrations`: Partner bağlantıları
- `partner_integration_secrets`: Şifreli API/feed bilgileri
- `partner_integration_runs`: Test/senkron çalışma logları
- `partner_integration_product_links`: Dış ürün ID ile AllonaHub ürün ID eşleşmesi
- `partner_integration_field_mappings`: Gelecek kategori/alan eşleme kuralları
- `partner_integration_publish_jobs`: Gelecek outbound yayın kuyruğu

Migration uygulama:

```bash
SUPABASE_DB_URL="postgresql://..." bash deploy/integrations/apply-partner-integration-migrations.sh
```

## Backend Bayrakları

```text
PARTNER_INTEGRATIONS_ENABLED=true
PARTNER_INTEGRATIONS_PREMIUM_ENABLED=false
PARTNER_INTEGRATIONS_OUTBOUND_ENABLED=false
PARTNER_INTEGRATIONS_APPLY_ENABLED=true
PARTNER_INTEGRATIONS_SCHEDULED_APPLY_ENABLED=false
PARTNER_INTEGRATIONS_REQUIRE_APPLY_CONFIRMATION=true
PARTNER_INTEGRATIONS_APPLY_CONFIRMATION_TEXT=KATALOGA_AKTAR
PARTNER_INTEGRATIONS_FORCE_DRAFT_ON_APPLY=true
PARTNER_INTEGRATIONS_REMOTE_FETCH_ENABLED=true
PARTNER_INTEGRATIONS_BLOCK_PRIVATE_FETCH_TARGETS=true
PARTNER_INTEGRATIONS_ALLOWED_FETCH_HOSTS=
PARTNER_INTEGRATIONS_MAX_PREVIEW_ROWS=50
PARTNER_INTEGRATIONS_MAX_APPLY_ROWS=100
PARTNER_INTEGRATIONS_MAX_TEST_ROWS=3
PARTNER_INTEGRATIONS_FETCH_TIMEOUT_MS=12000
```

Planlı connectorları production'da ücretsiz ürün çekmeye açmak gerekirse:

```sql
update public.partner_integration_connectors
set premium_ready = true,
    stage = 'premium_ready',
    updated_at = now()
where provider in ('ciceksepeti', 'pazarama');
```

Tam entegrasyon / outbound yayın katmanını açmak için backend env:

```text
PARTNER_INTEGRATIONS_PREMIUM_ENABLED=true
PARTNER_INTEGRATIONS_OUTBOUND_ENABLED=true
```

## API

- `GET /v1/partner/integrations`
- `POST /v1/partner/integrations`
- `POST /v1/partner/integrations/:integrationId/test`
- `POST /v1/partner/integrations/:integrationId/sync`
- `POST /v1/partner/integrations/:integrationId/publish-jobs`
- `GET /v1/admin/ops/integrations`
- `POST /v1/cron/integrations/sync`
- `POST /v1/cron/integrations/publish`

`sync` endpointi iki mod taşır:

- `preview`: Dış kaynaktan ürünleri okur, ürün tablosuna yazmaz
- `apply`: Ürünleri `products` tablosuna işler ve `partner_integration_product_links` eşleşmesini yazar

Partner paneli başlangıçta `preview` ve kontrollü `apply` çalıştırır. `apply` için varsayılan onay metni `KATALOGA_AKTAR` değeridir. Ürünler `PARTNER_INTEGRATIONS_FORCE_DRAFT_ON_APPLY=true` iken her zaman taslak/compliance kontrol durumunda açılır.

## Ücretsiz MVP Kontrol Listesi

- Migrationlar uygulanır.
- Production env bayrakları ücretsiz başlangıç değerleriyle set edilir.
- Partner panelinde CSV/JSON feed, WooCommerce, Shopify, Trendyol, Hepsiburada, n11 veya özel API bağlantısı kaydedilir.
- `Test` gerçek remote probe çalıştırır.
- `Önizle` ürünleri parse eder, compliance uyarı/hatalarını gösterir.
- `Kataloğa Aktar` onay metniyle çalışır ve ürünleri taslak olarak kataloğa işler.
- `POST /v1/cron/integrations/sync` zamanlı önizleme için açıktır.
- `GET /v1/admin/ops/integrations` ile admin izleme yapılır.
- Tam entegrasyon / outbound publish queue hazırdır; canlı gönderim premium üyelik ve `PARTNER_INTEGRATIONS_OUTBOUND_ENABLED=true` olmadan çalışmaz.

Smoke test:

```bash
PARTNER_JWT="..." \
PARTNER_INTEGRATION_FEED_URL="https://example.com/products.sample.json" \
node scripts/partner-integration-smoke-test.mjs
```

## Ücretlendirme Yolu

Bugünkü teklif ücretsiz partner kazanımı içindir. İleride paketleme:

- Free: Dış platformlardan AllonaHub'a ürün çekme, preview, manuel senkron ve kontrollü kataloğa aktarma
- Premium: Tam entegrasyon; AllonaHub ürünlerini bağlı platformlara yayınlama, zamanlı outbound, yüksek limit
- Enterprise: Özel API, outbound yayın kuyruğu, özel field mapping, SLA destek

Bu ayrım `partner_integration_connectors.availability`, `free_enabled`, backend env bayrakları ve partner plan kontrolleriyle yönetilir.
