# AllonaHub Legal Evidence & Public Authority Architecture

Bu mimari AllonaHub ekosisteminde şüpheli işlem, ödeme uyuşmazlığı, kullanıcı/partner ihtilafı ve resmi makam taleplerinde delil bütünlüğü sağlamak için tasarlanmıştır. Amaç gizli takip yapmak değil; hukuka uygun, sınırlı, izlenebilir ve bütünlüğü doğrulanabilir kayıt üretmektir.

## İlkeler

- Veri minimizasyonu: Sadece güvenlik, işlem doğrulama, uyuşmazlık ve yasal yükümlülük için gerekli alanlar kaydedilir.
- Şeffaflık: KVKK, Gizlilik Politikası ve Güvenlik Politikası kullanıcıya güvenlik kayıtlarını ve konum şartlarını açıklar.
- Açık izinli konum: Tarayıcı/cihaz izni olmadan konum güvenlik kaydına eklenmez.
- Hassas veri yasağı: Şifre, kart numarası, CVC/CVV, access token, secret ve ham cookie audit metadata içine yazılmaz.
- Append-only kayıt: `security_audit_events` hash zinciriyle genişletilir ve update/delete trigger ile değiştirilemez hale getirilir.
- Sınırlı paylaşım: Resmi makamlara yalnızca hukuki gerekçe, referans no, tarih aralığı ve kapsam filtresiyle rapor üretilir.

## Veritabanı

Ana tablo:

```text
public.security_audit_events
```

Yeni bütünlük alanları:

```text
source
purpose
location_basis
geo_country / geo_region / geo_city
geo_latitude / geo_longitude / geo_accuracy_m
previous_hash
event_hash
retention_until
evidence_tags
```

Resmi talep kayıtları:

```text
public.authority_disclosure_requests
public.authority_disclosure_exports
```

Migration:

```text
supabase/migrations/20260621103000_create_legal_evidence_controls.sql
```

## Backend API

Kullanıcı/istemci güvenlik olayı:

```http
POST /v1/security/events
Authorization: Bearer <supabase_jwt>
```

Bu endpoint frontendden gelen kritik olay özetlerini kaydeder. Konum ancak `location_consent=true` ve kullanıcı izniyle gelen konum payloadı varsa işlenir.

Admin audit görüntüleme:

```http
GET /v1/admin/security/audit-events
```

Filtreler:

```text
limit, severity, actorId, action, resourceType, resourceId, from, to
```

Resmi makam talebi kaydı:

```http
POST /v1/admin/legal/authority-requests
```

Delil raporu üretimi:

```http
POST /v1/admin/legal/evidence-report
```

Zorunlu alanlar:

```text
case_reference
legal_basis
purpose
from
to
```

İsteğe bağlı filtreler:

```text
request_id
actor_id
resource_type
resource_id
action
severity
request_id_filter
limit
```

Tüm admin/legal endpointleri admin veya super_admin rolü, MFA ve admin boundary gerektirir.

## Rapor Formatı

Delil raporu şu bilgileri döner:

- generated_at
- generated_by
- case_reference
- legal_basis
- purpose
- filters
- events
- chain_of_custody
- export_hash

`event_hash`, veritabanındaki append-only hash zincirinden gelir. `export_hash`, rapor gövdesinin SHA-256 özetidir.

## Konum Kullanımı

Konum verisi şu haller dışında istenmez:

- Kullanıcı işlem güvenliği için açık izin verirse
- Teslimat, partner operasyonu veya saha hizmeti için kullanıcı/partner işlem akışı bunu gerektirirse
- Hukuki uyuşmazlık veya resmi makam talebi kapsamında mevcut izinli kayıtların raporlanması gerekirse

Konum izni verilmezse audit kaydı IP, cihaz, request id ve işlem özetiyle devam eder.

## Operasyon Akışı

1. Resmi yazı, mahkeme kararı veya yetkili makam talebi alınır.
2. Talep `authority_disclosure_requests` tablosuna kaydedilir.
3. Hukuki gerekçe ve kapsam kontrol edilir.
4. Gerekli kişi/işlem/tarih filtreleriyle `evidence-report` üretilir.
5. Raporun `export_hash` değeri ve event hash aralığı talep dosyasına eklenir.
6. Paylaşım yapıldıysa teslim kanalı, tarih ve referans no kurum içi dosyada saklanır.

## Saklama ve Silme

Varsayılan audit saklama süresi 365 gündür. Hukuki yükümlülük, aktif uyuşmazlık veya resmi makam talebi varsa kayıtlar daha uzun süre korunabilir. Silme talepleri KVKK kapsamında değerlendirilirken kanuni saklama ve delil yükümlülükleri ayrıca kontrol edilir.
