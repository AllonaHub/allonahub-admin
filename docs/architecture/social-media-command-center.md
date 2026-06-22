# AllonaHub Social Media Command Center

Bu altyapi AllonaHub sosyal medya buyumesi icin merkezi taslak, onay ve dagitim akisini kurar. Sistem silme yapmaz; sosyal medya kayitlari append/audit mantigiyla tutulur.

## Akis

1. Admin Panel > Sosyal Medya ekraninda hesap envanteri, gunluk plan ve taslak hazirlanir.
2. Backend taslagi `content_hash`, `semantic_hash` ve `visual_hash` ile kontrol eder.
3. Ayni metin, ayni anlamdaki metin veya ayni gorsel parmak izi tekrar kullanilamaz.
4. Taslak platform varyasyonlarina ayrilir: Instagram, Facebook, Threads, X, LinkedIn, TikTok, YouTube, Pinterest, Nsosyal ve diger hesaplar.
5. Admin taslagi onaylar. Onay olmadan post `queued`, `scheduled` veya `published` durumuna gecmez.
6. `/v1/cron/social-media-dispatch` zamani gelen postlari server-side dispatcher'a gonderir.
7. Connector hazir degilse veya `SOCIAL_MEDIA_DRY_RUN=true` ise dis platforma paylasim yapilmaz, deneme kaydi olusur.

## Tablolar

- `social_media_accounts`: Platform hesap envanteri. Token veya sifre saklamaz.
- `social_media_campaigns`: Kampanya/hedef gruplari.
- `social_media_drafts`: Ana icerik taslaklari ve tekrar engelleme hashleri.
- `social_media_platform_posts`: Her platforma ozel caption, format, schedule ve yayin durumu.
- `social_media_dispatch_attempts`: Dry-run, skipped, sent veya failed dispatch denemeleri.
- `social_media_daily_plans`: Gunluk buyume planlari.
- `social_media_rules`: Zorunlu sosyal medya kurallari.

## Zorunlu Kurallar

- `no_exact_text_repeat`: Birebir ayni metin tekrar yayinlanamaz.
- `no_semantic_repeat`: Ayni anlamdaki metin yeni kelimelerle tekrar paketlenemez.
- `no_visual_repeat`: Ayni gorsel veya ayni gorsel prompt/parmak izi tekrar kullanilamaz.
- `approval_required`: Her platform postu Admin onayi ister.
- `server_only_tokens`: OAuth tokenlari frontend HTML/JS icine yazilmaz.

## Server Env

```bash
SOCIAL_MEDIA_DISPATCH_ENABLED=false
SOCIAL_MEDIA_DRY_RUN=true
SOCIAL_MEDIA_DISPATCH_WEBHOOK_URL=
SOCIAL_MEDIA_DISPATCH_WEBHOOK_SECRET=
SOCIAL_MEDIA_SECRET_ENCRYPTION_KEY=
SOCIAL_MEDIA_SEND_TIMEOUT_MS=12000
SOCIAL_MEDIA_MAX_DISPATCH_BATCH=20
SOCIAL_MEDIA_DEFAULT_TIMEZONE=Europe/Istanbul
```

`SOCIAL_MEDIA_SECRET_ENCRYPTION_KEY` Admin Panel uzerinden girilen platform secretlerini server-side AES-256-GCM ile sifrelemek icindir. Bu deger frontend'e yazilmaz ve panelde geri gosterilmez.

Gercek yayin icin once sosyal platform OAuth/token islemleri Admin Panel > Sosyal Medya > Baglanti Secretleri alanindan veya server/vault tarafindan tamamlanir. Sonra:

```bash
SOCIAL_MEDIA_DISPATCH_ENABLED=true
SOCIAL_MEDIA_DRY_RUN=false
SOCIAL_MEDIA_DISPATCH_WEBHOOK_URL=https://YOUR-DISPATCHER/social/publish
SOCIAL_MEDIA_DISPATCH_WEBHOOK_SECRET=replace-with-long-random-secret
```

## Dispatcher Contract

Backend dispatcher'a su event'i gonderir:

```json
{
  "event": "allonahub.social_media.publish",
  "request_id": "aln-...",
  "dry_run": false,
  "post": {
    "id": "...",
    "platform": "instagram",
    "post_type": "reel",
    "caption": "...",
    "hashtags": ["#AllonaHub"],
    "media_asset_ids": []
  },
  "draft": {
    "id": "...",
    "title": "...",
    "landing_url": "https://allonahub.com"
  },
  "account": {
    "platform": "instagram",
    "handle": "allonahub",
    "connector_mode": "server_webhook"
  }
}
```

`SOCIAL_MEDIA_DISPATCH_WEBHOOK_SECRET` varsa `X-AllonaHub-Signature` header'i `sha256=...` seklinde HMAC imzasi tasir.

Basarili dispatcher yaniti:

```json
{
  "external_post_id": "platform-post-id",
  "external_url": "https://platform.example/post/..."
}
```

## Cron

Hetzner veya baska bir scheduler:

```bash
curl -fsS -X POST https://api.allonahub.com/v1/cron/social-media-dispatch \
  -H "x-cron-secret: GERCEK_CRON_SECRET"
```

Baslangicta `SOCIAL_MEDIA_DRY_RUN=true` kalmali. Platform hesaplari ve dispatcher canli dogrulandiktan sonra dry-run kapatilmalidir.

## Self-Service Secret Girisi

Bu modelde gelistiriciye sunucu, IP, token veya sifre verilmez.

1. Kod GitHub'a pushlanir ve hosting/Coolify/Hetzner tarafinda deploy edilir.
2. Ortam degiskenlerine sadece `SOCIAL_MEDIA_SECRET_ENCRYPTION_KEY` ve gerekiyorsa `CRON_SECRET` girilir.
3. Admin Panel > Sosyal Medya ekraninda `Baglanti Secretleri` tablosu eksik anahtarlari gosterir.
4. Yetkili admin platformu, secret anahtarini ve degeri girer.
5. Backend secreti sifreler, `social_media_connector_secrets` tablosuna kaydeder ve degeri response'ta dondurmez.
6. Panel bundan sonra yalniz `ready`, `missing`, `active` gibi durumlari gosterir.

Zorunlu secret anahtarlari panelde listelenir. Ornekler:

- Instagram: `IG_USER_ID`, `ACCESS_TOKEN`
- Facebook: `PAGE_ID`, `PAGE_ACCESS_TOKEN`
- Threads: `THREADS_USER_ID`, `ACCESS_TOKEN`
- X: `ACCESS_TOKEN`
- LinkedIn: `ORGANIZATION_URN`, `ACCESS_TOKEN`
- TikTok: `OPEN_ID`, `ACCESS_TOKEN`
- YouTube: `CHANNEL_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`
- Pinterest: `BOARD_ID`, `ACCESS_TOKEN`

## Native Publish Kapsami

Backend `connector_mode = native_api` olan hesaplarda server-side secret vault'tan gerekli degerleri okur ve yayin denemesi yapar.

- X: text post desteklenir.
- Facebook Page: feed post ve opsiyonel link desteklenir.
- Threads: text container + publish akisi desteklenir.
- Instagram: `platform_payload.image_url` varsa image publish desteklenir.
- LinkedIn: organization post desteklenir.
- Pinterest: `platform_payload.image_url` varsa pin desteklenir.
- Telegram: channel/chat mesaj gonderimi desteklenir.
- TikTok ve YouTube: video upload/creator audit akislari gerektirdigi icin dedicated adapter ile baglanmalidir.
- WhatsApp Business ve Google Business: platform policy ve template/location akislari nedeniyle dedicated adapter ile baglanmalidir.

Dedicated adapter gereken platformlarda Admin Panel taslak/onay/kuyruk ayni kalir; sadece dispatcher tarafinda ilgili platform adapter'i canliya alinir.
