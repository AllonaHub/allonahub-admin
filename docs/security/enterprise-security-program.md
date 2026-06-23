# AllonaHub Enterprise Security Program

Bu doküman AllonaHub ekosisteminde devlet/kurumsal seviye güvenlik prensiplerini uygulamak için operasyonel yol haritasıdır. Bu bir sertifikasyon beyanı değildir; uygulanacak teknik kontrol listesidir.

## 1. Zero Trust

- Frontend, cihaz, IP, oturum ve API payload otomatik güvenilir kabul edilmez.
- Kritik isteklerde backend JWT doğrular, rol kontrolü yapar ve MFA seviyesini kontrol eder.
- Service role key sadece Hetzner backend ortamında tutulur.
- Supabase RLS, frontend manipülasyonuna karşı son savunma katmanı olarak kalır.

## 2. Least Privilege

Roller:

- `customer`: kendi profil, adres, sipariş, favori ve CV kayıtları.
- `partner`: sadece kendi ürün, reklam, sipariş kalemleri ve komisyon önizlemesi.
- `courier`: sadece teslimat için gerekli sipariş durumları.
- `admin`: operasyonel yönetim; MFA zorunlu.
- `super_admin`: rol atama, güvenlik ayarları ve incident kararları; MFA zorunlu.

Uygulama:

- Backend endpointleri `roles` ve `mfa` seçenekleriyle korunur.
- Supabase migration `20260619193000_enterprise_security_controls.sql`, admin/partner/kurye helper fonksiyonlarını MFA-aware hale getirir.
- Profil rol değişimi sadece MFA doğrulanmış `super_admin` tarafından yapılabilir.

## 3. Defense In Depth

Katmanlar:

- Cloudflare: WAF, bot koruması, rate limit, Access, cache bypass.
- Traefik/Coolify: host bazlı routing, TLS, sadece gerekli container yayını.
- Backend: Helmet, CORS allowlist, host allowlist, rate limit, Zod validation, audit log.
- Supabase: RLS, RPC, trigger, service role izolasyonu.
- Iyzico: callback backend doğrulaması olmadan sipariş ödenmiş sayılmaz.

## 4. MFA / 2FA

Zorunlu roller:

```text
MFA_REQUIRED_ROLES=partner,courier,admin,super_admin
ADMIN_MFA_ENFORCED=true
SUPER_ADMIN_MFA_ENFORCED=true
```

Admin, Super Admin, finans, partner ve kritik paneller için Supabase MFA etkinleştirilmeden enterprise migration production'a uygulanmamalıdır. Migration uygulandıktan sonra JWT `aal=aal2` olmayan admin/partner/kurye işlemleri reddedilir. Backend production default'u admin ve Super Admin için MFA enforcement'i açık kabul eder; kapatmak yalnızca kontrollü bakım senaryolarında geçici olarak yapılmalıdır.

## 5. Admin Hardening

Önerilen hedef:

```text
admin.allonahub.com
```

Cloudflare Access:

- `admin.allonahub.com/*` için e-posta veya identity provider zorunlu.
- Sadece şirket hesapları.
- Ek IP kısıtı mümkünse açık.

Backend:

```text
ADMIN_HOSTS=admin.allonahub.com,api.allonahub.com
ADMIN_IP_ALLOWLIST=
```

`ADMIN_IP_ALLOWLIST` boş bırakılırsa IP kısıtı uygulanmaz. Kurumsal statik IP olunca virgülle ayrılmış IP listesi girilir.

## 6. Payment Security

- Frontend ödeme başarılı dedi diye sipariş onaylanmaz.
- `/v1/payments/iyzico/callback` iyzico detail sorgusu ile doğrular.
- `PAYMENTS_DISABLED=true` acil durumda ödeme başlatma ve callback işlemlerini kapatır.
- Hatalı veya sahte callback `security_audit_events` tablosuna `critical` olarak düşer.

## 7. Audit Log

Tablo:

```text
public.security_audit_events
```

Kaydedilen alanlar:

- actor id ve rol
- action
- resource type/id
- severity
- IP, user-agent, request id
- metadata
- created_at

Kapsam:

- admin erişimi
- ödeme ve callback
- sipariş oluşturma
- CV ödeme
- HP/kupon ledger
- cron ve mutabakat
- yetki/MFA reddi

Admin endpoint:

```http
GET /v1/admin/security/audit-events
```

Bu endpoint admin/super_admin + MFA + admin host boundary gerektirir.

## 8. Legal Evidence & Public Authority

AllonaHub güvenlik kayıtları; resmi makam talebi, ödeme uyuşmazlığı, partner ihtilafı ve şüpheli işlem incelemelerinde delil bütünlüğü sağlayacak şekilde genişletilir.

Ek migration:

```text
supabase/migrations/20260621103000_create_legal_evidence_controls.sql
```

Ek tablolar:

```text
public.authority_disclosure_requests
public.authority_disclosure_exports
```

Admin API:

```http
POST /v1/admin/legal/authority-requests
POST /v1/admin/legal/evidence-report
```

Kurallar:

- Resmi makam paylaşımı yalnızca hukuki gerekçe, referans no ve sınırlı kapsamla yapılır.
- Raporlar tarih aralığı, actor/resource/action filtreleri ve SHA-256 `export_hash` ile üretilir.
- Audit kayıtları `previous_hash` / `event_hash` zinciriyle append-only tasarlanır.
- Konum verisi gizli takip için kullanılmaz; sadece açık izinli veya işlem/hukuki gereklilik kapsamındaki kayıtlar raporlanır.
- Şifre, kart numarası, CVC/CVV, token, secret ve cookie audit metadata içine yazılmaz.

Detaylı mimari:

```text
docs/security/legal-evidence-architecture.md
```

## 9. Monitoring & Alert

İlk alarm kuralları:

- 5 dakikada 5+ `auth.denied` aynı IP.
- Herhangi bir `payment.callback_invalid`.
- Herhangi bir `admin.boundary_denied`.
- 10 dakikada 3+ ödeme checkout hatası.
- `cron.reconcile_denied`.

Coolify/Traefik logları, backend JSON logları ve Supabase audit tablosu birlikte izlenmelidir.

## 10. Backup & Disaster Recovery

Günlük:

- Supabase günlük backup ve point-in-time recovery planı.
- Hetzner snapshot.
- `/opt/allonahub/deploy/hetzner/.env.production` için şifreli secret backup.

Haftalık:

- Geri yükleme testi.
- Migration dry-run.
- Dependency audit.

Kurtarma önceliği:

1. Ödeme sistemi kapatılır.
2. Admin erişimi Cloudflare Access üzerinden kilitlenir.
3. Supabase service role rotate edilir.
4. Backend yeni secretlarla redeploy edilir.
5. Audit log üzerinden hasar analizi yapılır.

## 11. Incident Response

Acil environment switchleri:

```text
PAYMENTS_DISABLED=true
MAINTENANCE_MODE=true
EMERGENCY_API_DISABLED=true
```

Komut:

```bash
cd /opt/allonahub
nano deploy/hetzner/.env.production
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml up -d --build
```

Etkiler:

- `PAYMENTS_DISABLED`: ödeme başlatma/callback kapalı.
- `MAINTENANCE_MODE`: health/ready dışında API bakımda.
- `EMERGENCY_API_DISABLED`: health dışında tüm API kapalı.

Otomatik saldırı algılama, geçici IP bloklama, admin kilidi, strict mode, Telegram/e-posta alarmı, rollback hazırlığı ve safe mode komutları için:

```text
docs/security/incident-response-auto-defense.md
```

## 12. Secure Deployment

Her deploy öncesi:

```bash
git diff --check
node --check backend/src/server.js
node --check backend/src/app.js
node --check backend/src/config.js
node --check backend/src/lib/iyzico.js
node --check backend/src/lib/supabase.js
node --check backend/src/routes/index.js
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml config --quiet
docker compose -f deploy/compose/docker-compose.hetzner-traefik.yml build allonahub-api
```

Server build `npm ci --omit=dev` kullanır ve lockfile ile sabitlenir. Son buildde audit sonucu `0 vulnerabilities` olmalıdır.

## 13. Cloudflare Checklist

- SSL/TLS: Full Strict.
- WAF managed rules: on.
- Bot fight / bot management: on.
- Cache bypass: `api.allonahub.com/*`.
- Rate limit:
  - `/v1/payments/*`
  - `/v1/cv/checkout`
  - `/v1/orders`
  - `/v1/admin/*`
  - `/v1/cron/*`
- Cloudflare Access:
  - `admin.allonahub.com/*`
  - Coolify dashboard.
- Minimum TLS: 1.2.
- Security headers: enabled at backend and proxy.

## 14. Secret Management

Kod içine yazılmayacak:

- `SUPABASE_SERVICE_ROLE_KEY`
- `IYZICO_API_KEY`
- `IYZICO_SECRET_KEY`
- Cloudflare token
- GitHub token

Sadece sunucuda:

```text
/opt/allonahub/deploy/hetzner/.env.production
```

Dosya izni:

```bash
chmod 600 /opt/allonahub/deploy/hetzner/.env.production
```

## 15. Network Segmentation

Mantıksal ayrım:

- Public frontend: `allonahub.com`
- Backend API: `api.allonahub.com`
- Admin: `admin.allonahub.com`
- Coolify: Cloudflare Access arkasında.
- Payment callback: backend üzerinde, frontendden bağımsız.

## 16. Production Gate

Production'a alınmadan önce zorunlu geçiş kriterleri:

- Supabase MFA admin ve partner hesaplarında aktif.
- Enterprise security migration uygulanmış.
- `SUPABASE_SERVICE_ROLE_KEY`, iyzico keyleri ve cron secret gerçek değerlerle sunucuda.
- `/health` 200.
- `/ready` 200.
- Test siparişi başarılı.
- Iyzico sandbox ödeme callback doğrulanmış.
- Audit event oluştuğu doğrulanmış.
