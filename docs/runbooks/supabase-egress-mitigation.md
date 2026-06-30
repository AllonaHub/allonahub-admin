# Supabase Egress Mitigation

Son guncelleme: 30.06.2026

Supabase uyarisi "cached egress bandwidth" icin geldiyse ana supheli alan Storage/CDN uzerinden indirilen public dosyalardir. Bu, az kullanici olsa bile buyuk gorsel/video dosyalari, bot taramasi veya admin/social media asset uretimi ile hizli artabilir.

## Hemen yapilacaklar

1. Supabase Dashboard > Usage / Usage Control ekraninda hangi metrik asiliyor kontrol et.
2. Storage > Buckets alaninda buyuk bucketlari kontrol et.
3. `social-media-assets` bucket'i varsa eski/gereksiz assetleri temizle.
4. Yeni yuklemeler icin `SOCIAL_MEDIA_MAX_MEDIA_BYTES=8388608` kullan.
5. Sosyal medya asset retention kuralini 2 gun olarak tut:

```bash
SOCIAL_MEDIA_ASSET_RETENTION_DAYS=2
```

6. Sosyal medya asset uretimi aciksa gecici olarak kapat:

```bash
SOCIAL_MEDIA_ASSET_GENERATION_ENABLED=false
SOCIAL_MEDIA_DAILY_DRAFTS_ENABLED=false
```

## Otomatik 2 gunluk temizlik cron'u

Backend endpoint:

```text
POST /v1/cron/social-media-assets-cleanup
```

Bu endpoint sadece `SOCIAL_MEDIA_ASSET_STORAGE_BUCKET` ve `SOCIAL_MEDIA_ASSET_STORAGE_PREFIX` altindaki sosyal medya assetlerini siler. Urun gorselleri, musteri dosyalari veya diger bucketlar hedeflenmez.

Gunluk cron ornegi:

```bash
30 3 * * * curl -fsS -X POST https://api.allonahub.com/v1/cron/social-media-assets-cleanup \
  -H "content-type: application/json" \
  -H "x-cron-secret: GERCEK_CRON_SECRET" \
  --data '{"retention_days":2,"limit":500}' >/dev/null
```

Once dry-run:

```bash
curl -fsS -X POST https://api.allonahub.com/v1/cron/social-media-assets-cleanup \
  -H "content-type: application/json" \
  -H "x-cron-secret: GERCEK_CRON_SECRET" \
  --data '{"retention_days":2,"limit":500,"dry_run":true}'
```

## Oncelikli cozum: local cleanup cron

Cloudflare challenge'a takilmamak icin sosyal medya asset temizligini public API endpointi yerine prod sunucuda lokal script olarak calistirmak daha saglamdir. Bu yontemde Cloudflare, WAF ve `x-cron-secret` devreye girmez; script sadece server-side `SUPABASE_SERVICE_ROLE_KEY` ile Supabase Storage'a baglanir.

Gunluk cron:

```bash
30 3 * * * cd /opt/allonahub && node backend/scripts/supabase-storage-usage.mjs --bucket=social-media-assets --prefix=social-media --retention-days=2 --dry-run=0 >/var/log/allonahub-social-assets-cleanup.log 2>&1
```

Manuel dry-run:

```bash
cd /opt/allonahub
node backend/scripts/supabase-storage-usage.mjs --bucket=social-media-assets --prefix=social-media --retention-days=2
```

Gercek silme:

```bash
node backend/scripts/supabase-storage-usage.mjs --bucket=social-media-assets --prefix=social-media --retention-days=2 --dry-run=0
```

## Storage kullanimini listeleme

Prod sunucuda servis role key bulunan ortamda:

```bash
cd /opt/allonahub
node backend/scripts/supabase-storage-usage.mjs
```

Sadece sosyal medya bucket'i:

```bash
node backend/scripts/supabase-storage-usage.mjs --bucket=social-media-assets
```

Eski dosyalari once dry-run kontrol et:

```bash
node backend/scripts/supabase-storage-usage.mjs --bucket=social-media-assets --delete-older-than=2026-06-01
```

Gercek silme:

```bash
node backend/scripts/supabase-storage-usage.mjs --bucket=social-media-assets --delete-older-than=2026-06-01 --dry-run=0
```

## Kalici azaltma secenekleri

- Urun gorsellerini `https://api.allonahub.com/v1/media/product-images/...` proxy'si uzerinden servis etmek. Bu endpoint Supabase `product-images` bucket'indan okur, 1 yil immutable cache header'i dondurur ve Cloudflare cache rule ile edge cache'e alinabilir.
- Urun ve sosyal medya gorsellerini WebP/JPEG olarak 1200px civarina sikistirip yuklemek.
- Buyuk video veya taslak dosyalarini Supabase public bucket'ta tutmamak.
- Bot taramasini Cloudflare WAF/cache/rate limit ile kisitlamak.
- Frontend listelerinde gereksiz buyuk gorsel URL'lerini tekrar tekrar yuklememek.
- Cloudflare sertlestirmesinden sonra `node deploy/cloudflare/verify-allonahub-security-guards.mjs` ile media route'unun 200 dondugunu ve ikinci istekte Cloudflare cache'e dustugunu kontrol etmek.

## Urun gorseli cache proxy ve optimizasyon

Backend route:

```text
GET /v1/media/product-images/products/.../file.webp
```

Frontend `product-images` Supabase public URL'lerini otomatik olarak bu route'a cevirir. Boylece yeni/var olan urun datasinda dogrudan Supabase URL'si kalsa bile tarayici `api.allonahub.com` uzerindeki cache'li proxy'yi kullanir.

Cloudflare cache rule `deploy/cloudflare/apply-allonahub-rules.mjs` icindedir:

```text
http.host eq "api.allonahub.com"
and http.request.method eq "GET"
and starts_with(http.request.uri.path, "/v1/media/product-images/")
```

Mevcut agir PNG/JPEG urun gorsellerini WebP'ye cevirip yeni URL'leri `products.image_url` ve `partner_ads.image_url` alanlarina yazmak icin prod sunucuda once dry-run:

```bash
cd /opt/allonahub
sh deploy/hetzner/optimize-product-images.sh --dry-run=1
```

Script varsayilan olarak `product-images/products` altindaki storage objelerini de tarar. Boylece DB'de artik referans edilmeyen eski PNG/JPEG dosyalari da dry-run'da gorunur. Sadece DB referansli gorselleri islemek icin `--include-storage=0` kullanin.

Gercek uygulama:

```bash
sh deploy/hetzner/optimize-product-images.sh --dry-run=0
```

Eski orijinalleri hemen silme. Trafik sorunu yeni proxy URL'lerine gecisle cozulur; eski dosyalar sadece 26 MB civari depolama tutar. Eski linklerin kullanilmadigi dogrulandiktan sonra `--delete-originals=1` ile ayrica temizlenebilir.

## Not

Free plan icin gecici cozum kotayi dusurmektir; trafik/medya gercekten artarsa Pro plan ya da R2/CDN tasimasi kalici cozum olur.
