# AllonaHub Incident Response & Auto-Defense

Bu mimari saldırı anında geçici ve geri alınabilir savunma aksiyonları üretir. Kalıcı firewall kuralı, production kod değişikliği, database migration, secret rotasyonu, ödeme sistemini tamamen kapatma ve büyük rollback insan onayı gerektirir.

## Auto-Defense Akışı

1. Request backend'e gelir.
2. Host allowlist, maintenance ve emergency switch kontrolleri çalışır.
3. Auto-defense sinyalleri okunur:
   - SQL injection kalıpları
   - XSS payload kalıpları
   - path traversal
   - WordPress/phpMyAdmin/.env probe pathleri
   - hassas endpointlerde auth olmadan istek
   - admin endpoint başarısızlığı
   - ödeme endpoint anormalliği
   - Cloudflare bot/threat score
   - static IP denylist
   - route bazlı kısa süreli yoğunluk
4. IP ve route davranışı skorlanır.
5. Skor eşik üstüne çıkarsa:
   - geçici IP blok
   - geçici admin kilidi
   - geçici strict rate limit
   - audit log
   - Telegram/e-posta alarmı
   - opsiyonel şüpheli session iptali
6. Olay raporu `security_audit_events` metadata alanına ve in-memory recent incidents listesine yazılır.

## Environment

```text
AUTO_DEFENSE_ENABLED=true
AUTO_DEFENSE_SCORE_THRESHOLD=12
AUTO_DEFENSE_WINDOW_MINUTES=10
AUTO_DEFENSE_IP_BLOCK_MINUTES=15
AUTO_DEFENSE_ADMIN_LOCK_MINUTES=10
AUTO_DEFENSE_STRICT_MODE_MINUTES=10
AUTO_DEFENSE_REVOKE_SESSIONS=false
AUTO_DEFENSE_IP_DENYLIST=
AUTO_DEFENSE_CF_BOT_SCORE_BLOCK_BELOW=10
AUTO_DEFENSE_CF_THREAT_SCORE_BLOCK_ABOVE=50
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SECURITY_ALERT_EMAIL_WEBHOOK_URL=
SECURITY_ALERT_EMAIL_WEBHOOK_SECRET=
```

`AUTO_DEFENSE_REVOKE_SESSIONS` varsayılan olarak kapalıdır. Açılırsa authorized ama forbidden görünen şüpheli sessionlar geçici olarak iptal edilmeye çalışılır.

## Otomatik Aksiyonlar

İnsan onayı olmadan yapılabilecek geçici aksiyonlar:

- IP engelleme
- rate limit sıkılaştırma
- admin panel kilidi
- şüpheli session iptali
- bakım modu
- alarm gönderme

Kod bu kapsamda yalnızca in-memory blok ve alarm üretir. Bakım modu veya API kapatma gibi büyük geçici anahtarlar operatör scriptiyle çalıştırılır.

## İnsan Onayı Gerektiren Aksiyonlar

- production kod değişikliği
- database migration
- ödeme sistemini tamamen kapatma
- secret/API key yenileme
- kalıcı firewall veya Cloudflare WAF değişikliği
- büyük rollback

## Olay Raporu Formatı

Her olay raporu şu alanları içerir:

- saldırı zamanı
- kaynak IP
- hedef endpoint
- saldırı tipi
- skor ve sinyaller
- otomatik önlemler
- önerilen kalıcı düzeltmeler
- manuel onay gerektiren işlemler
- request id

Admin API:

```http
GET /v1/admin/security/auto-defense
GET /v1/admin/security/audit-events
POST /v1/admin/legal/authority-requests
POST /v1/admin/legal/evidence-report
```

Bu endpointler admin/super_admin + MFA + admin host boundary gerektirir.

Legal endpointleri de aynı şekilde admin/super_admin + MFA + admin host boundary gerektirir. Şüpheli işlem, kullanıcı şikayeti veya resmi makam talebi olduğunda önce talep kaydı oluşturulur, sonra tarih/actor/resource/action filtresiyle hash özetli delil raporu üretilir.

## Saldırı Tiplerine Göre Müdahale

### Brute Force / Yetkisiz Admin Denemesi

Otomatik:

- admin endpoint başarısızlıkları skorlanır
- temporary admin lock
- audit event
- alarm

Manuel:

- Cloudflare Access logları kontrol edilir
- admin kullanıcı MFA durumu kontrol edilir
- gerekirse admin IP allowlist uygulanır

### SQL Injection / Endpoint Abuse

Otomatik:

- payload pattern tespiti
- temporary IP block
- strict mode
- audit event
- alarm

Manuel:

- hedef endpoint validasyonları gözden geçirilir
- WAF managed/custom rule insan onayıyla eklenir

### Ödeme Manipülasyonu

Otomatik:

- hatalı callback veya ödeme endpoint abuse auditlenir
- strict mode
- alarm

Manuel:

- Iyzico panelinde token/conversation doğrulanır
- ilgili sipariş/CV ödeme kaydı incelenir
- ödeme sistemini tamamen kapatma yalnızca onayla yapılır

### DDoS / Trafik Patlaması

Otomatik:

- route bazlı backend strict mode
- Traefik rate limit
- Cloudflare bot/threat score sinyali

Manuel:

- Cloudflare under attack mode
- ASN/country/rate rule
- kalıcı WAF kuralı

## Safe Mode Script

Sunucuda:

```bash
cd /opt/allonahub
deploy/hetzner/incident-safe-mode.sh status
deploy/hetzner/incident-safe-mode.sh maintenance-on
deploy/hetzner/incident-safe-mode.sh maintenance-off
deploy/hetzner/incident-safe-mode.sh api-off
deploy/hetzner/incident-safe-mode.sh api-on
deploy/hetzner/incident-safe-mode.sh payments-off
deploy/hetzner/incident-safe-mode.sh payments-on
```

Bu script secret rotate etmez, migration çalıştırmaz, kalıcı firewall yazmaz.

## Rollback Hazırlığı

Rollback otomatik çalıştırılmaz. Plan dosyası üretmek için:

```bash
cd /opt/allonahub
deploy/hetzner/prepare-rollback.sh
```

Üretilen dosya:

```text
/opt/allonahub/incident-reports/rollback-plan-*.txt
```

## Backup / Snapshot

Otomatik sistem snapshot üretmez. Operasyon listesi:

- Hetzner snapshot: insan onayıyla
- Supabase backup/PITR: Supabase panelinden doğrulanır
- Env secret backup: şifreli kasada tutulur
- Rollback planı: `prepare-rollback.sh`

## Cloudflare / Traefik

Cloudflare:

- WAF Managed Rules açık
- Bot Fight veya Bot Management açık
- `api.allonahub.com/*` cache bypass
- `admin.allonahub.com/*` Cloudflare Access arkasında
- Rate limit:
  - `/v1/admin/*`
  - `/v1/payments/*`
  - `/v1/orders`
  - `/v1/cv/checkout`
  - `/v1/cron/*`

Traefik:

- API container label'larında rate limit middleware aktiftir.
- HSTS, no-sniff, frame deny ve referrer policy proxy katmanında da uygulanır.

## Test Planı

Her değişiklikten sonra:

- `/health` 200
- normal protected endpoint auth olmadan 401
- injection denemesi auto-defense ile bloklanır
- backend syntax check
- npm audit 0 vulnerabilities
- Docker build

Tam iş akışı testleri için gerçek server env gerekir:

- user login
- partner login
- admin panel
- ürün ekleme
- sipariş
- ödeme hazırlık

Bu testler `SUPABASE_SERVICE_ROLE_KEY`, iyzico keyleri ve enterprise migration production'a uygulandıktan sonra çalıştırılır.
