# Live Access Environment Setup

Son guncelleme: 29.06.2026

Bu belge AllonaHub ETBIS hazirliklari icin Cloudflare kurallarini ve Supabase migration'ini terminalden calistirirken gereken gecici environment degerlerini anlatir. Gercek token ve DB URL repo icine yazilmaz.

## Cloudflare degerleri

### Zone ID

1. Cloudflare Dashboard'a gir.
2. `Websites` alanindan `allonahub.com` zone'unu ac.
3. `Overview` sayfasinda API/zone bilgileri bolumunden `Zone ID` degerini kopyala.

### API Token

1. Cloudflare Dashboard'da sag ust profil menusunden `My Profile` / `API Tokens` alanina gir.
2. `Create Token` sec.
3. Custom token olustur.
4. Token'i sadece `allonahub.com` zone'u ile sinirla.
5. Gerekli izinler:
   - `Zone` / `Zone` / `Read`
   - `Zone` / `Transform Rules` / `Edit` veya `Write`
   - `Zone` / `Dynamic URL Redirects` / `Edit` veya `Write`
   - Challenge/WAF istisnasi gerekecekse ayrica `Zone` / `WAF` / `Edit` veya `Write`

Terminalde calistirma:

```bash
export CLOUDFLARE_API_TOKEN="cloudflare-token-buraya"
export CLOUDFLARE_ZONE_ID="zone-id-buraya"
/Users/allonabusiness/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node deploy/cloudflare/apply-allonahub-rules.mjs
```

## Supabase DB URL

1. Supabase Dashboard'a gir.
2. AllonaHub projesini ac.
3. `Project Settings` > `Database` alanina gir.
4. `Connection string` bolumunden `Direct connection` veya `Session pooler` URI'sini kopyala.
5. Sifre placeholder'i varsa database password ile doldur.
6. URL sonuna `?sslmode=require` ekli oldugundan emin ol.

Terminalde calistirma:

```bash
export SUPABASE_DB_URL="postgresql://..."
deploy/hetzner/apply-supabase-migration.sh
```

Bu makinede su an `psql` bulunmuyor. `psql` kurulamazsa ayni migration SQL'i Supabase Dashboard > SQL Editor uzerinden calistirilabilir:

```text
supabase/migrations/20260629090000_add_product_seller_disclosure_fields.sql
```

## Tek komutla gecici env

Degerleri shell history'ye yazmak istemezsen ayni terminalde once gizli oku, sonra komutu calistir:

```bash
read -rsp "Cloudflare API token: " CLOUDFLARE_API_TOKEN; echo
read -rp "Cloudflare Zone ID: " CLOUDFLARE_ZONE_ID
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ZONE_ID
/Users/allonabusiness/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node deploy/cloudflare/apply-allonahub-rules.mjs
```

```bash
read -rsp "Supabase DB URL: " SUPABASE_DB_URL; echo
export SUPABASE_DB_URL
deploy/hetzner/apply-supabase-migration.sh
```

## Kaynaklar

- Cloudflare API token olusturma: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
- Cloudflare API token izinleri: https://developers.cloudflare.com/fundamentals/api/reference/permissions/
- Cloudflare Response Header Transform API: https://developers.cloudflare.com/rules/transform/response-header-modification/create-api/
- Cloudflare Dynamic Redirect API: https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-api/
- Supabase Postgres connection: https://supabase.com/docs/guides/database/connecting-to-postgres
