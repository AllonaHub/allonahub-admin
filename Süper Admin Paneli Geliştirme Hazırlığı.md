# Süper Admin Paneli Geliştirme Hazırlığı

Tarih: 27 Haziran 2026

Bu doküman süper admin paneli için mevcut kod, API, migration, modül dokümanları ve operasyon ekranları incelenerek hazırlanmıştır. Amaç, commit öncesi net geliştirme paketini ve eksik kalan kritik işleri görünür yapmaktır.

## İncelenen Gerçek Yüzeyler

| Alan | Dosya/Uç | Durum |
| --- | --- | --- |
| Süper admin ekranı | `admin/super-admin.html` | Var |
| Süper admin davranışı | `js/super-admin.js` | Var |
| Süper admin tasarım dosyası | `css/super-admin.css` | Var |
| Backend kontrol merkezi | `backend/src/routes/index.js` | Var |
| Owner console dokümanı | `docs/super-admin-owner-console.md` | Var |
| Süper admin ayar/modül tabloları | `20260621143000_create_super_admin_controls.sql` | Var |
| Owner lock ve release approval | `20260623133000_create_super_admin_owner_release_controls.sql` | Var |
| Permission change matrisi | `20260623143000_create_super_admin_permission_matrix.sql` | Var |
| Admin ops panel | `admin/index.html`, `js/admin-ops.js`, admin ops migration'ları | Var |
| Partner panel | `pages/partner/partner-panel.html`, `js/partner-os.js` | Var |
| User panel | `user-panel/index.html`, `pages/account/user-panel.html` | Var |
| AVM modülü | `avm-dunyasi-modulu/` | Var |
| Taksi operasyon verisi | `20260623120000_create_allona_taxi_operations.sql` | Var |
| Sosyal medya command center | `20260622103000_create_social_media_command_center.sql`, `js/admin-ops.js` | Var |

## Mevcut Güçlü Taraflar

- Owner-only giriş mantığı var: oturum, MFA/AAL2, admin boundary ve owner allowlist birlikte çalışıyor.
- Fail-closed yaklaşımı var; owner tanımı yoksa kritik API açılmıyor.
- Release approval ve GitOps webhook modeli tasarlanmış.
- Yetki değişiklikleri için `super_admin_permission_changes` ve audit event kayıtları var.
- Super admin API ailesi üç alias ile çalışıyor: `/v1/super-admin`, `/v1/control-center`, `/v1/owner-console`.
- Dashboard, risk akışı, yayın onayları, erişim kilidi, yetki merkezi, modül haritası, kullanıcılar, partnerler, modüller, sistem ayarları, güvenlik ve audit log ekranları var.
- Backend `superAdminActionHealth` ile temel tablo/route sağlığı ölçüyor.
- Admin ops tarafında sosyal medya, destek, içerik önerisi, partner başvurusu ve operasyon notları için daha geniş yüzey var.

## En Önemli Eksikler

| Öncelik | Eksik | Neden Önemli |
| --- | --- | --- |
| Kritik | Birleşik Süper Admin İş Kuyruğu | AVM, yemek, taksi, sosyal medya, hukuk, destek ve yayın talepleri tek yerde önceliklenmiyor. |
| Kritik | Modül Bazlı Operasyon Detayı | Modül haritası var ama her modülün canlı sağlık, veri, açık risk, son hata ve yayın durumu tek detay ekranında yok. |
| Kritik | AVM/Yemek İçerik Onaylarının Süper Admin'e Bağlanması | Partner/admin onayları var, fakat süper admin karar merkezi içinde modül tipiyle birleşik görünmüyor. |
| Kritik | Taksi Sorunlu Yolculuk Kuyruğu | Taksi migration var; süper admin panelinde ödeme, iptal, güvenlik ve konum riski için ayrı kuyruk yok. |
| Yüksek | Sosyal Medya Connector Sağlık Görünümü | Admin ops içinde detay var; süper admin ekranında platform riskleri, eksik secret ve başarısız yayınlar özetlenmeli. |
| Yüksek | Veri Dışa Aktarma Kontrol Merkezi | Dışa aktarma işlemleri yetki, maskeleme ve audit standardıyla merkezi yönetilmeli. |
| Yüksek | SLA/Sahip Atama | Bekleyen onay ve destek işlerinde sorumlu kişi, son tarih ve gecikme göstergesi eksik. |
| Yüksek | Modül Yayın Hazırlık Skoru | Her modül için auth, RLS, audit, mobil, SEO, içerik, ödeme, bildirim ve destek kriterleri puanlanmalı. |
| Orta-Yüksek | Doküman Tutarlılığı | Bazı raporlar eski durumda kalmış ve "kod yok" diyor; karar süreçlerini yanıltıyor. |
| Orta-Yüksek | E2E/Mobil Test Paketi | Panel özelinde Playwright akışı ve yetki testi yok. |

## Admin Panelde Olması Gereken Ama Henüz Tam Olmayan Şeyler

### 1. Birleşik İş Kuyruğu

Tek ekran aşağıdaki işleri birleştirmeli:

- Partner başvuruları
- AVM/mağaza/kampanya/kupon/etkinlik onayları
- Yemek ürünü ve restoran onayları
- Sosyal medya taslak/yayın onayları
- Taksi sorunlu yolculuklar
- Güvenlik uyarıları
- Hukuk/KVKK/veri talepleri
- Release/deploy/migration onayları

Her kayıt için minimum alanlar:

- `source_module`
- `target_type`
- `target_id`
- `priority`
- `risk_level`
- `status`
- `owner_user_id`
- `due_at`
- `last_activity_at`
- `decision_required`
- `audit_event_id`

### 2. Modül Sağlık Matrisi

Süper admin modül haritası şu an modül adı, kategori, faz, maturity, aktiflik ve görünürlük veriyor. Buna ek olarak her modül için şu sinyaller gerekli:

- Frontend sayfası var mı?
- Backend API var mı?
- Supabase migration var mı?
- RLS ve sahiplik testi var mı?
- Audit log var mı?
- Mobil 320px kontrolü var mı?
- Destek/şikayet akışı var mı?
- Bildirim akışı var mı?
- Ödeme/komisyon varsa güvenli mi?
- Son 24 saat hata sayısı
- Son release approval durumu

### 3. Taksi Operasyon Bağlantısı

Taksi tarafında olması gereken süper admin ekranları:

- Sorunlu yolculuk kuyruğu
- Ödeme başarısızlığı kuyruğu
- İptal/no-show analizi
- Sürücü eşleşme başarısı
- Canlı riskli yolculuk uyarısı
- Destek/şikayet bağlantısı
- Konum ve ücret uyuşmazlığı inceleme

### 4. AVM ve Yemek İçerik Yönetimi

Süper admin düzeyinde olması gerekenler:

- Tüm modüllerden gelen içerik onayları tek listede görünmeli.
- AVM kampanya/kupon tarih kontrolleri otomatik risk üretmeli.
- Yemek ürünlerinde görsel, alerjen, fiyat, stok ve satışa hazırlık validasyonu süper admin kararına düşmeli.
- İçerik reddi/revizyon nedeni standartlaştırılmalı.

### 5. Sosyal Medya Yönetim Üst Kontrolü

Admin ops sosyal medya ekranı var; süper admin tarafında üst kontrol eksik:

- Platform bazlı secret durumu
- Eksik connector listesi
- Başarısız yayınlar
- Günlük plan gerçekleşme oranı
- Yüksek riskli otomatik paylaşım engelleri
- Marka/hukuk onayı gerektiren içerikler

### 6. Dışa Aktarma ve Veri Güvenliği

Süper admin panelinde rapor görmek yeterli değil; dışa aktarma ayrı kontrol edilmeli:

- Export talebi oluşturma
- Hassas veri maskeleme seviyesi
- Export nedeni
- Süreli indirme linki
- Kim indirdi, ne zaman indirdi
- Export hash kaydı
- KVKK/hukuk bayrağı

## Önerilen Teknik Geliştirme Paketi

### Paket A: Süper Admin İş Kuyruğu

Yeni backend uçları:

- `GET /v1/control-center/work-queue`
- `PATCH /v1/control-center/work-queue/:itemId`
- `POST /v1/control-center/work-queue/:itemId/decision`

Yeni Supabase tablosu:

- `super_admin_work_queue`

Frontend:

- `admin/super-admin.html` içine `İş Kuyruğu` nav öğesi
- `js/super-admin.js` içine `loadOwnerWorkQueue`

### Paket B: Modül Sağlık Matrisi

Yeni backend ucu:

- `GET /v1/control-center/module-health`

Veri kaynakları:

- `platform_modules`
- `security_audit_events`
- `admin_approval_requests`
- `content_change_proposals`
- `social_media_*`
- `allona_taxi_*`
- modül doküman/route varlık kontrolleri

Frontend:

- `Modül Haritası` detay drawer'ına sağlık skoru eklenmeli.

### Paket C: Kritik Modül Kuyrukları

Taksi:

- `GET /v1/control-center/taxi/incidents`
- `GET /v1/control-center/taxi/metrics`

AVM/Yemek:

- `GET /v1/control-center/content-approvals`
- `PATCH /v1/control-center/content-approvals/:id`

Sosyal:

- `GET /v1/control-center/social-health`

### Paket D: Export Governance

Yeni tablo:

- `super_admin_export_requests`

Yeni backend uçları:

- `POST /v1/control-center/export-requests`
- `GET /v1/control-center/export-requests`
- `PATCH /v1/control-center/export-requests/:id`

Güvenlik kuralları:

- Reason zorunlu
- MFA zorunlu
- Owner lock zorunlu
- Audit log zorunlu
- Hassas alan maskeleme varsayılan

## Öncelikli Commit Paketi Önerisi

Bu tur için güvenli commit kapsamı:

1. Süper admin araştırma raporunu gerçek kod durumuna göre düzelt.
2. Bu geliştirme hazırlığı dokümanını ekle.
3. Eski "kod yok" notlarını sonraki commit için işaretle.
4. Backend ve frontend koduna dokunmadan, ürün/teknik karar paketini hazırla.

Önerilen commit mesajı:

```text
docs: update super admin control center audit and roadmap
```

## Onay Sonrası İlk Uygulama Commit'i

Onaydan sonra ilk gerçek geliştirme için önerilen kapsam:

1. `super_admin_work_queue` migration'ı ekle.
2. `/v1/control-center/work-queue` listeleme endpoint'i ekle.
3. Süper admin nav'a `İş Kuyruğu` sekmesi ekle.
4. `js/super-admin.js` içine work queue render ve karar aksiyonlarını ekle.
5. Backend `npm run check` çalıştır.

Bu paket küçük, izlenebilir ve süper admin panelini gerçek operasyon merkezi yapmaya başlayan en doğru ilk adımdır.

## Kabul Kriterleri

- Süper admin panelinin mevcut gerçek kod durumu dokümante edilmiştir.
- Eksikler "panel yok" diye değil, "hangi operasyon bağlantısı eksik" diye sınıflandırılmıştır.
- Modül bazlı kritik eksikler listelenmiştir.
- Onay sonrası commit/push öncesi uygulanacak ilk teknik paket netleşmiştir.
- Kullanıcının onayı olmadan commit veya push yapılmamıştır.

