# AVM Erişilebilirlik Operasyon Raporu Yayın Devri

## Kaynak

- Geliştirme reposu: `AllonaHub/allonahub-site`
- Kaynak commit: `8482e6a911065a0926915346111a5ddac936d85f`
- Paket: erişilebilirlik destek talepleri için sunucu filtreli operasyon özeti, sayfalama ve tam CSV raporu

## Dosya ve hunk kapsamı

- `js/avm-admin.js`: durum, destek türü, arama ve ziyaret tarihi filtreleri; 25/50/100 satırlık sayfalama; window toplamları; 200 satırlık partilerle tam CSV aktarımı; mevcut durum güncellemesinin filtreli kuyruğu yenilemesi.
- `admin/avm.html`: admin JS ve ortak layout için cache-busting sürümü `20260711-avm-accessibility-reporting`.
- `js/layout.js`: admin reponun root-route çözümleyicisiyle uyumlu logo asset yolu; `/admin/images/...` 404'ünü önleyen iki dar hunk.
- `supabase/migrations/20260712019000_add_avm_accessibility_reporting.sql`: `mall_accessibility_requests_reporting_idx` ve admin RLS kapsamında `get_mall_accessibility_request_report` RPC'si.
- `supabase/schema.sql`: migration ile aynı raporlama sözleşmesi.
- `DATABASE.md`, `DEPLOY.md`, `TASKS.md`, `docs/architecture/ALLONA_AVM_DUNYASI.md`, `docs/deploy-avm-dunyasi-20260711.md`: veri modeli, migration sırası, operasyon kabul kriteri ve tamamlanan iş.

## Migration

Canlı rapor ekranının çalışması için önce `20260712018000_add_avm_accessibility_requests.sql`, ardından `20260712019000_add_avm_accessibility_reporting.sql` onaylı production Supabase projesine uygulanmalıdır. Yeni migration indeks ve `security invoker` rapor fonksiyonu ekler; veri silmez, mevcut satırı değiştirmez ve secret içermez. Ham ziyaretçi iletişim satırları partner/tenant politikasına açılmaz.

Admin `origin/main` mimarisinde kök `DATABASE.md`, `DEPLOY.md`, `TASKS.md`, AVM mimari dokümanı ve AVM genel deploy dokümanı bulunmadığı için bu kaynak dosyalar yeniden oluşturulmadı. Yalnız production HTML/JS hunkları, yeni migration, admin entegrasyon notu ve bu yayın devri aktarıldı; admin reposundaki geniş `supabase/schema.sql` toplu kaynak şemasıyla değiştirilmedi.

## Doğrulama

- `git diff --check`
- 19 `js/*.js` dosyası için Node `vm.Script` parse kontrolü
- AVM ziyaretçi/admin/partner HTML duplicate-id ve yerel `href`/`src` kontrolü
- Migration ile `supabase/schema.sql` raporlama bloğu birebir sözleşme kontrolü
- Değişen satırlarda production secret paterni taraması
- Mock Supabase ile Chromium `1440x1000` ve `390x844`: filtre formu, operasyon metrikleri, kayıt satırı, cache-busting sürümü, yatay taşma, console, pageerror ve network smoke
- Chromium akış testi: destek türü ve arama parametrelerinin RPC'ye aktarımı; filtre kapsamını koruyan 200 satırlık CSV sorgusu ve `avm-erisilebilirlik-talepleri-YYYY-MM-DD.csv` indirmesi

## Canlı smoke hedefleri

- `https://allonahub.com/admin/avm.html#accessibility-requests`
- `https://allonahub.com/avm-dunyasi.html#avm-assistance`
- Production migration sonrası gerçek admin hesabıyla durum/tür/arama/tarih filtrelerini, 25/50/100 sayfa boyutunu, ileri-geri sayfalama ve CSV satır sayısını doğrula.
- `https://allonahub.com/partner/avm.html#avm-submissions` yüzeyinde ziyaretçi adı, telefon, e-posta veya ihtiyaç notunun görünmediğini doğrula.

## Geri dönüş

Frontend geri dönüşü admin entegrasyon commit'inin normal revert commit'iyle yapılır. Migration backward-compatible olduğu için frontend geri alınsa indeks ve RPC'yi yerinde bırakmak güvenlidir; production fonksiyon veya indeks kaldırma işlemi ayrı açık onay gerektirir.
