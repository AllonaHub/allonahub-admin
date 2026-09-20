# MariPartner Personel Merkezi

Durum: Onaylandı ve mevcut worktree'de uygulandı. Production migration/deploy bu değişiklik kapsamında yapılmadı.

## Ürün sınırı

MariPartner, genel ticaret Partner OS panelinden ayrıdır. `partner_type = maritime`, aktif şirket durumu, doğrulanmış şirket kaydı, partner rolü ve MFA birlikte doğrulanmadan açılmaz. Şirket kimliği istek gövdesinden güvenilir kabul edilmez; oturum sahibinin `partner_businesses` veya aktif `partner_staff` üyeliğinden sunucuda çözülür.

Kullanıcıya ana panelde tek giriş `Personel Merkezi` olarak görünür. Masaüstünde sağ drawer, mobilde tam ekran sheet açılır. Merkez menüsünün içinde yalnız şu beş işlem vardır; bir işlem açıldığında diğer düğmeler gizlenir ve üstte geri düğmesi görünür:

1. Havuzu Güncelle
2. Kanıt Kontrolü
3. Süreç Süreleri
4. Dosya Devri
5. Güvenli İnceleme

## Veri ve güvenlik

- Mevcut `maritime_jobs`, `maritime_match_results`, `maritime_hiring_rooms`, `maritime_private_candidate_rooms`, `maritime_sensitive_access_requests` ve audit altyapısı yeniden kullanılır.
- Yeni tablolar doğrudan `anon` ve `authenticated` yazımına kapalıdır. İşlemler kimlik doğrulamalı backend üzerinden yürür.
- Aday havuzu yalnız aktif ve görünür özel aday odalarından oluşur. Liste başka şirketlere açılmaz.
- Ana ve alt sayaçlar `refresh_requests`, kanıt talepleri ve sunucu zamanlı SLA durumundan hesaplanır; sıfır değer için rozet üretilmez.
- Havuz filtreleri rütbe, gemi tipi, müsaitlik, belge hazırlığı, katılım tarihi ve mevcut izinli ilişki kapsamını taşır; kullanıcıdan serbest hassas veri sorusu alınmaz.
- Kanıt isteği işe alım aşamasına ve minimum gerekli alanlara bağlanır. Hassas gereksinim otomatik olarak süreli hassas erişim talebi açar; indirme varsayılan kapalıdır.
- Kanıt özeti mevcut `maritime_readiness_items` kaynağından yalnız metadata olarak oluşturulur; belge kopyası üretilmez.
- SLA durumu tarayıcı sayacından değil sunucu zaman damgalarından hesaplanır.
- Dosya devri tek veritabanı fonksiyonu içinde sahiplik güncellemesi ve append-only devir kaydı oluşturur.
- İnceleme geçişi ham token ve kod saklamaz; SHA-256 hash, süre, kullanım sınırı, aday ilişkisi, ilan durumu ve alan allowlist'i ile doğrulanır.
- İnceleyene bağlantı gönderildiği iddia edilmez. E-posta sağlayıcısı yoksa panel açıkça `link_generated_not_sent` sonucu verir.

## Yüzeyler

- Şirket: `/pages/partner/maripartner.html`
- Harici inceleyen: `/pages/partner/maritime-review.html`
- Denizci yanıtları: `/pages/ecosystem/maritime-company-requests.html`
- Yönetim: Super Admin > MariPartner Yönetimi

## Production kapısı

Önce `20260920153000_create_maripartner_personnel_center.sql` migration'ı uygulanmalı, sonra backend ve statik uygulama aynı release içinde yayınlanmalıdır. Migration uygulanmadan panel API'si açılmamalıdır.
