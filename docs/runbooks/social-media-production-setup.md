# Social Media Production Setup

Bu runbook, AllonaHub sosyal medya yayin altyapisini canli sunucuda secret degerlerini chat'e yazmadan tamamlamak icindir.

## 1. Server env

SSH ile backend deploy klasorune gir:

```bash
cd /opt/allonahub/backend
```

Klasor farkliysa backend `.env` veya `.env.production` dosyasinin oldugu dizine gec. Degerleri dosyaya yazmadan once kendi dosya adini kontrol et:

```bash
ls -la .env .env.production 2>/dev/null
```

Ilk kurulumda guvenli secret uret:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Ilk ciktiyi `SOCIAL_MEDIA_SECRET_ENCRYPTION_KEY`, ikinci ciktiyi `CRON_SECRET` icin kullan.

`.env.production` kullanan deploy icin:

```bash
nano .env.production
```

Ekle veya guncelle:

```bash
SOCIAL_MEDIA_SECRET_ENCRYPTION_KEY=BURAYA_ILK_OPENSSL_CIKTISI
CRON_SECRET=BURAYA_IKINCI_OPENSSL_CIKTISI
SOCIAL_MEDIA_DISPATCH_ENABLED=true
SOCIAL_MEDIA_DRY_RUN=true
SOCIAL_MEDIA_SEND_TIMEOUT_MS=12000
SOCIAL_MEDIA_MAX_DISPATCH_BATCH=20
SOCIAL_MEDIA_MAX_MEDIA_BYTES=8388608
SOCIAL_MEDIA_DAILY_DRAFTS_ENABLED=false
SOCIAL_MEDIA_ASSET_WEBHOOK_URL=
SOCIAL_MEDIA_ASSET_WEBHOOK_SECRET=
SOCIAL_MEDIA_ASSET_RETENTION_DAYS=2
SOCIAL_MEDIA_DEFAULT_TIMEZONE=Europe/Istanbul
```

`SOCIAL_MEDIA_DRY_RUN=true` ilk testte kalmali. Platform testleri ve dry-run dispatch basarili olunca `false` yap.

Gorsel/video dosyalarinin otomatik URL almasi icin `SOCIAL_MEDIA_ASSET_WEBHOOK_URL` bir asset hazirlama servisine baglanabilir. Bu webhook yoksa sistem yine taslak, caption, hashtag, saat, gorsel prompt ve asset kaydi olusturur; medya URL'si Admin Panel'deki `Medya` butonundan eklenir.

## 2. Supabase migrations

Su migration dosyalari uygulanmali:

```text
supabase/migrations/20260622103000_create_social_media_command_center.sql
supabase/migrations/20260622123000_create_social_media_secret_vault.sql
supabase/migrations/20260623154500_seed_social_media_connector_accounts.sql
```

Supabase CLI kullaniliyorsa:

```bash
supabase db push --project-ref YOUR_PROJECT_REF
```

CLI kullanilmiyorsa Supabase SQL Editor'da dosyalari yukaridaki sirayla calistir.

## 3. Deploy restart

Systemd kullanan sunucuda:

```bash
sudo systemctl restart allonahub-backend
sudo systemctl status allonahub-backend --no-pager
```

Docker Compose kullanan sunucuda:

```bash
docker compose up -d --build backend
docker compose logs -f backend
```

Coolify kullaniyorsan Environment Variables alanina ayni env degerlerini girip redeploy et.

## 4. Admin Panel secret girisi

Admin Panel > Sosyal Medya > Baglanti Secretleri alaninda secret degerlerini tek tek gir.

Zorunlu anahtarlar:

```text
instagram: IG_USER_ID, ACCESS_TOKEN
facebook: PAGE_ID, PAGE_ACCESS_TOKEN
threads: THREADS_USER_ID, ACCESS_TOKEN
x: ACCESS_TOKEN
linkedin: ORGANIZATION_URN, ACCESS_TOKEN
tiktok: ACCESS_TOKEN
youtube: CHANNEL_ID, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN
pinterest: BOARD_ID, ACCESS_TOKEN
telegram: BOT_TOKEN, CHANNEL_ID
whatsapp: PHONE_NUMBER_ID, ACCESS_TOKEN
google_business: ACCOUNT_ID, LOCATION_ID, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN
nsosyal: DISPATCH_WEBHOOK_URL
```

Secret degerleri panelde geri gosterilmez. Backend `social_media_connector_secrets` tablosuna sifreli kaydeder.

## 5. Test ve yayin

1. Hesap Envanteri'nde platformu `native_api` yap.
2. Baglanti Secretleri tablosunda platform `ready` olunca `Test` butonuna bas.
3. `Otomatik Gunluk Paket` alanindan `Gunluk Paketi Olustur` butonuna bas.
4. Sistem taslagi `ready_for_review` olarak olusturur; `Taslaklar` alaninda gorunur.
5. Gerekirse `Platform Kuyrugu > Medya` butonuyla gerekli medya alanlarini doldur:
   - Instagram/Pinterest: `Gorsel URL`
   - TikTok/YouTube: `Video URL`
   - WhatsApp: `WhatsApp hedefi` veya `DEFAULT_RECIPIENT_PHONE`
6. `Planli Onayla`; saat girmezsen platform bazli paket saatleri korunur.
7. Dispatch cron calistiginda `SOCIAL_MEDIA_DRY_RUN=true` iken sonuc `dry_run` olmalidir. Anlik test icin panelde `Simdi Kuyruga Al` kullanilabilir.
8. Her sey dogruysa env dosyasinda:

```bash
SOCIAL_MEDIA_DRY_RUN=false
```

Sonra backend'i restart et ve ayni akisi gercek yayin icin calistir.

## 6. Cron

Gunluk taslak paketini otomatik olusturmak icin env'de:

```bash
SOCIAL_MEDIA_DAILY_DRAFTS_ENABLED=true
```

Sonra scheduler'a ekle:

```bash
curl -fsS -X POST https://api.allonahub.com/v1/cron/social-media-daily-drafts \
  -H "content-type: application/json" \
  -H "x-cron-secret: GERCEK_CRON_SECRET" \
  -d '{"objective":"growth","landing_url":"https://allonahub.com/"}'
```

Planli/onayli postlari dagitmak icin:

```bash
curl -fsS -X POST https://api.allonahub.com/v1/cron/social-media-dispatch \
  -H "x-cron-secret: GERCEK_CRON_SECRET"
```

Sosyal medya assetlerinin Supabase Storage'i doldurmamasi icin gunluk temizlik cron'u:

```bash
curl -fsS -X POST https://api.allonahub.com/v1/cron/social-media-assets-cleanup \
  -H "content-type: application/json" \
  -H "x-cron-secret: GERCEK_CRON_SECRET" \
  --data '{"retention_days":2,"limit":500}'
```

Onerilen siralama:

```text
09:00 social-media-daily-drafts
10:00, 12:30, 15:00, 18:30, 21:30 social-media-dispatch
```
