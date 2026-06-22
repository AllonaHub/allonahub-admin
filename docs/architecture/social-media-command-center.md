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
SOCIAL_MEDIA_SEND_TIMEOUT_MS=12000
SOCIAL_MEDIA_MAX_DISPATCH_BATCH=20
SOCIAL_MEDIA_DEFAULT_TIMEZONE=Europe/Istanbul
```

Gercek yayin icin once sosyal platform OAuth/token islemleri server veya vault tarafinda tamamlanir. Sonra:

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
