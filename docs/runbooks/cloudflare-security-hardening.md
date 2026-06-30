# Cloudflare Security Hardening Runbook

Son guncelleme: 30.06.2026

Bu runbook'un amaci Cloudflare guvenligini artirirken AllonaHub API, partner paneli ve Supabase media proxy akisini bozmamaktir.

## Temel prensip

- `api.allonahub.com/health`, `/ready` ve `/v1/*` JSON/media rotalari tarayici challenge HTML'i almamalidir.
- `GET /v1/media/product-images/*` mutlaka Cloudflare edge cache'e girmelidir; bu Supabase egress'i azaltir.
- Backend auth, JWT, MFA, cron secret ve uygulama rate limitleri Cloudflare challenge istisnasindan bagimsiz calisir.
- Cloudflare rate limit kurallari atlanmaz; sadece challenge uretebilen katmanlar API/media icin skip edilir.

## Kurulum modu

Site gelistirme/kurulum asamasindayken:

- Free planda Bot Fight Mode kapali kalabilir.
- WAF Managed Rules, security headers, redirect kurallari, cache rule ve API WAF guard kurallari uygulanir.
- API/media icin challenge beklenmez; media ikinci istekte `cf-cache-status: HIT` vermelidir.

Kurallar:

```bash
cd /opt/allonahub

set -a
. deploy/hetzner/.env.production
set +a

export CLOUDFLARE_ZONE_ID="a09a2178baf57febf29dc5585ec48cad"
export ALLONAHUB_SECURITY_PROFILE="setup"
export APPLY_SECURITY_GUARDS_ONLY=1
node deploy/cloudflare/apply-allonahub-rules.mjs
unset APPLY_SECURITY_GUARDS_ONLY

node deploy/cloudflare/verify-allonahub-security-guards.mjs
```

## Lansman modu

Halka acilis hazir oldugunda:

1. Once `node deploy/cloudflare/verify-allonahub-security-guards.mjs` calistir.
2. Cloudflare WAF Managed Rules ve rate limitleri ac.
3. Bot korumasinda Free Bot Fight Mode yerine mumkunse Super Bot Fight Mode/Bot Management kullan. Bu modda `http_request_sbfm` istisnasi API/media akisini korur.
4. Her sertlestirme degisikliginden sonra verify scriptini tekrar calistir.

```bash
export ALLONAHUB_SECURITY_PROFILE="launch"
export APPLY_SECURITY_GUARDS_ONLY=1
node deploy/cloudflare/apply-allonahub-rules.mjs
unset APPLY_SECURITY_GUARDS_ONLY

node deploy/cloudflare/verify-allonahub-security-guards.mjs
```

## Free Bot Fight Mode notu

Free plandaki Bot Fight Mode, WAF custom skip kuralindan bagimsiz challenge uretebilir. Bu yuzden `api.allonahub.com` ayni zone icindeyken Free Bot Fight Mode acilirse media/API tekrar `cf-mitigated: challenge` ile 403 donebilir.

Bu durumda uc guvenli yol var:

- Free Bot Fight Mode kapali, WAF + rate limit + backend auth aktif.
- Pro/Super Bot Fight Mode/Bot Management ile skip edilebilir bot korumasi.
- API/media icin ayri zone veya ayri domain mimarisi.

## Kabul testi

Beklenen sonuc:

```text
[ok] health status=200 cf-mitigated=- cf-cache-status=-
[ok] ready status=200 cf-mitigated=- cf-cache-status=-
[ok] product-media-first status=200 cf-mitigated=- cf-cache-status=MISS
[ok] product-media-second status=200 cf-mitigated=- cf-cache-status=HIT
AllonaHub security guards OK.
```

Media ilk istekte daha once cache'lendiyse birinci satir da `HIT` olabilir; sorun degildir.
