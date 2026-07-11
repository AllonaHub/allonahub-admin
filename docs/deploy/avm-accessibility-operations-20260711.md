# AVM Erişilebilirlik Saat ve Operasyon Notu Yayını

## Kaynak ve kapsam

- Kaynak repo: `AllonaHub/allonahub-site`
- Kaynak commitler: `eef29cb400d6dae8327e4ce6fa87c128b1fc1324`, `2deefcc6a325ea48171846ef3e7e684552b8f814`
- Hedef baseline: `AllonaHub/allonahub-admin` `origin/main` `1ce8e36a8dc8b029cd5fe79e577952d129e17273`
- Paket 1: erişilebilirlik formunun tarayıcı saat diliminden bağımsız İstanbul min/max ve UTC payload dönüşümü.
- Paket 2: admin erişilebilirlik kuyruğunda mevcut `admin_note` değerini görme, 2-1000 karakterle kaydetme ve boş değerle temizleme.

## Dosya ve hunk listesi

- `avm-dunyasi.html`: ziyaretçi CSS/JS cache sürümü.
- `js/avm-page.js`: İstanbul `datetime-local` formatlama ve UTC dönüşüm hunk'ları.
- `admin/avm.html`: operasyon açıklaması, CSS ve admin JS cache sürümü; mevcut `layout.js` cache sürümü korunur.
- `js/avm-admin.js`: operasyon notu kolonu, editörü ve update aksiyonu.
- `css/styles.css`: operasyon notu editörü responsive stili.

## Migration ve bağımlılıklar

Yeni migration gerekmez. Canlı ortamda daha önce yayın devri yapılan `mall_accessibility_requests.visit_at`, `admin_note` ve admin RLS sözleşmesi gerekir. Paket veri silmez, secret içermez ve partner/tenant veri sözleşmesini genişletmez.

## Doğrulama

- Baseline ve entegrasyon sonrası `git diff --check`
- Değişen AVM JavaScript dosyalarında syntax kontrolü
- AVM ziyaretçi/admin/partner HTML duplicate-id ve yerel `href`/`src` kontrolü
- Chromium desktop/mobile timezone payload ve admin operasyon notu mock Supabase smoke
- Partner yüzeyinde erişilebilirlik `admin_note` alanının bulunmadığı statik kontrol
- Production secret paterni taraması

## Canlı smoke URL'leri

- `https://allonahub.com/avm-dunyasi.html#avm-assistance`
- `https://allonahub.com/admin/avm.html#accessibility-requests`
- `https://allonahub.com/partner/index.html#reports`
- `https://allonahub.com/partner/index.html#avm-submissions`

Admin smoke gerçek yetkili oturum gerektirir. Production'a test kişisel verisi bırakılmamalı; kaydedilen test operasyon notu smoke sonunda temizlenmelidir.

## Geri dönüş

Entegrasyon commit'i history rewrite olmadan normal revert commit'iyle geri alınır. Veritabanı geri dönüşü gerekmez.
