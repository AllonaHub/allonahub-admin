# AVM Ön Görüşme Raporlama Arayüzü Yayın Devri

## Kaynak

- Geliştirme reposu: `AllonaHub/allonahub-site`
- Özellik commit'i: `c20a11274e98327027d9190d6b2945ef6058725d`
- Yayın devri commit'i: `c96feec6691fd24cd582db7e2e2b00721a7761ac`
- Paket: AVM kurumsal/partner ön görüşmelerinin sunucu filtreli operasyon özeti, sayfalama ve tam CSV arayüzü

## Dosya ve hunk kapsamı

- `js/avm-admin.js`: `get_mall_lead_report` RPC bağlantısı; durum, görüşme türü, metin araması ve İstanbul tarih aralığı filtreleri; 25/50/100 sayfalama; 200 satırlık partili tam CSV; yarışan istek koruması; durum güncellemesinden sonra filtreli kuyruğu yenileme.
- `css/styles.css`: lead filtrelerinin masaüstü dört kolon yerleşimi; ortak mobil kırılım korunur.
- `admin/avm.html`: yalnız CSS ve AVM admin JS cache-busting sürümü `20260711-avm-lead-reporting`. Önceki ortak layout cache-busting sürümü korunmuştur.
- `supabase/migrations/20260712014000_add_avm_lead_reporting.sql`: admin `origin/main` içinde daha önce yayımlanmış mevcut backward-compatible RPC sözleşmesi; bu pakette değiştirilmedi.

## Migration

Yeni migration yoktur. Canlı rapor ekranının çalışması için mevcut AVM migration zinciri ve özellikle `20260712014000_add_avm_lead_reporting.sql` onaylı production Supabase projesine uygulanmalıdır. `get_mall_lead_report` `security invoker` ve `public.is_admin()` kontrolüyle çalışır; ham lead iletişim verisi partner/tenant paneline açılmaz. Paket veri silmez, destructive DDL veya secret içermez.

## Doğrulama

- Baseline ve entegrasyon sonrası frontend/script ile backend JS syntax kontrolü
- Kritik AVM/admin/partner/kullanıcı/ödeme/CV/denizcilik HTML route, local asset ve duplicate-id kontrolü
- `git diff --check`
- Eklenen satırlarda production secret paterni taraması
- Chromium `1440x1000` ve `390x844` mock admin smoke:
  - 60 kayıtta 50/10 sayfalama
  - görüşme türü ve Türkçe metin araması
  - durum güncellemesi ve rapor metriklerinin yenilenmesi
  - filtreli CSV içeriği ve dosya adı
  - RPC `report_limit`, `report_offset`, arama ve tür parametreleri
  - yatay taşma, console ve pageerror kontrolü
- AVM erişilebilirlik formu desktop/mobile regresyon smoke'u

## Canlı smoke hedefleri

- `https://allonahub.com/admin/avm.html#leads`
- `https://allonahub.com/avm-partner.html#partner-form`
- `https://allonahub.com/partner/avm.html`
- `https://allonahub.com/avm-dunyasi.html`

Production migration sonrası gerçek admin hesabıyla durum/tür/arama/tarih filtrelerini, 25/50/100 sayfa boyutunu, ileri-geri sayfalamayı ve CSV satır sayısını doğrula. Gerçek lead iletişim verisini log veya yayın raporuna kopyalama.

## Geri dönüş

Frontend geri dönüşü bu entegrasyon commit'inin normal revert commit'iyle yapılır. Migration backward-compatible ve bu paketten önce `origin/main` içinde bulunduğu için SQL geri alma gerekmez. History rewrite veya force-push yapılmaz.
