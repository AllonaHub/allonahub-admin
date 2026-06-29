# Supabase Egress Mitigation

Son guncelleme: 29.06.2026

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

- Public medya dosyalarini Supabase Storage yerine Cloudflare R2/Images tarafina tasimak.
- Urun ve sosyal medya gorsellerini WebP/JPEG olarak 1200px civarina sikistirip yuklemek.
- Buyuk video veya taslak dosyalarini Supabase public bucket'ta tutmamak.
- Bot taramasini Cloudflare WAF/cache/rate limit ile kisitlamak.
- Frontend listelerinde gereksiz buyuk gorsel URL'lerini tekrar tekrar yuklememek.

## Not

Free plan icin gecici cozum kotayi dusurmektir; trafik/medya gercekten artarsa Pro plan ya da R2/CDN tasimasi kalici cozum olur.
