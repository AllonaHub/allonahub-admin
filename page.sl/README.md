# AllonaHub ayrilan eski dosyalar

Bu klasor silme islemi degildir. Eski, birebir kopya veya aktif sayfalarda kullanilmayan dosyalar kontrol edilebilmesi icin buraya tasindi.

## Aktif olmayan eski JS/CSS surumleri

- `js/layout.js` ve `js/layout.v2.js`: Aktif sistem `js/layout.v3.js` kullaniyor.
- `js/account-page.js`, `js/account-page.v2.js`, `js/account-page.v3.js`: Aktif hesap sayfalari `js/account-page.v4.js` kullaniyor.
- `js/admin.js`: Aktif admin paneli `js/admin-ops.js` ve `js/super-admin.js` uzerinden ilerliyor.
- `js/partner.js`: Aktif partner paneli `js/partner-os.js` uzerinden ilerliyor.
- `css/styles.css`: Aktif sayfalarda `css/styles.v2.css` ve `css/platform.css` kullaniliyor.

## Eski/alias HTML kopyalari

Bu dosyalar birebir ayni veya typo/eski URL dosyalaridir. Eski yollarin kirilmamasi icin asil konumlarinda canonical sayfaya yonlendiren kucuk HTML dosyasi birakildi.

- `pages/career/kariyer.html` -> `pages/career/allonakariyer.html`
- `pages/commerce/ode.html` -> `pages/commerce/odeme.html`
- `pages/commerce/kopunlar.html` -> `pages/commerce/kuponlar.html`
- `pages/ecosystem/danismanlik.html` -> `pages/ecosystem/allonadanismanlik.html`
- `pages/ecosystem/eglence.html` -> `pages/ecosystem/allonaeglence.html`
- `pages/ecosystem/allonapet.html` -> `pages/ecosystem/allonaevcilhayvan.html`
- `pages/ecosystem/evhizmetleri.html` -> `pages/ecosystem/allonaevhizmetleri.html`
- `pages/ecosystem/finans.html` -> `pages/ecosystem/allonafinans.html`
- `pages/ecosystem/gayrimenkul.html` -> `pages/ecosystem/allonagayrimenkul.html`
- `pages/ecosystem/guzellik.html` -> `pages/ecosystem/allonaguzellik.html`
- `pages/ecosystem/hukuk.html` -> `pages/ecosystem/allonahukuk.html`
- `pages/ecosystem/insaat.html` -> `pages/ecosystem/allonainsaat.html`
- `pages/ecosystem/kurye.html` -> `pages/ecosystem/allonakurye.html`
- `pages/ecosystem/kargolojistik.html` -> `pages/ecosystem/allonalojistik.html`
- `pages/ecosystem/nakliye.html` -> `pages/ecosystem/allonanakliye.html`
- `pages/ecosystem/organizasyondugun.html` -> `pages/ecosystem/allonaorganizasyon.html`
- `pages/ecosystem/otomotiv.html` -> `pages/ecosystem/allonaotomotiv.html`
- `pages/ecosystem/sigorta.html` -> `pages/ecosystem/allonasigorta.html`
- `pages/ecosystem/sportiv.html` -> `pages/ecosystem/allonasporfitness.html`
- `pages/ecosystem/tarim.html` -> `pages/ecosystem/allonatarim.html`
- `pages/ecosystem/teknoloji.html` -> `pages/ecosystem/allonateknoloji.html`
- `pages/legal/mesafeli-satis-sozlesmesi.html` -> `pages/legal/mesafeli-satis.html`

## Bilerek dokunulmayanlar

- `js/core.js` ve `_redirects`: Eski linklerin kirilmamasi icin aktif uyumluluk katmani.
- `docs/archive/*`: Zaten arsiv amacli tutuluyor.
- `pages/wallet/hubwallet.html`: Eski linkleri `pages/account/rewards.html` sayfasina yonlendiren uyumluluk dosyasi.
