# AllonaHub ayrilan eski dosyalar

Bu klasor silme islemi degildir. Eski, birebir kopya veya aktif sayfalarda kullanilmayan dosyalar kontrol edilebilmesi icin buraya tasindi.

## Aktif olmayan eski JS/CSS surumleri

- `js/layout.js` ve `js/layout.v2.js`: Aktif sistem `js/layout.v3.js` kullaniyor.
- `js/account-page.js`, `js/account-page.v2.js`, `js/account-page.v3.js`: Aktif hesap sayfalari `js/account-page.v4.js` kullaniyor.
- `js/admin.js`: Aktif admin paneli `js/admin-ops.js` ve `js/super-admin.js` uzerinden ilerliyor.
- `js/partner.js`: Aktif partner paneli `js/partner-os.js` uzerinden ilerliyor.
- `css/styles.css`: Aktif sayfalarda `css/styles.v2.css` ve `css/platform.css` kullaniliyor.

## 2026-06-24 karantina paketi

`quarantine/2026-06-24-cleanup/` altina aktif referansi kalmayan kopya dosyalar tasindi. Bu paketteki kod dosyalari `.inactive.txt`, gorsel dosyalari `.inactive` uzantisi ile tutulur. Boylece dogrudan tarayicida JS/CSS/HTML veya gorsel olarak calismalari engellenir.

- Super Admin kopya CSS/JS dosyalari canonical `css/super-admin.css` ve `js/super-admin.js` disinda arsivlendi.
- `js/security-challenge.cffix1.js` canonical `js/security-challenge.js` kullanildigi icin arsivlendi.
- `js/mfa.returnfix1.js` canonical `js/mfa.js` kullanildigi icin arsivlendi.
- `sw-reset1.js` aktif olmayan ve `sw.js` ile birebir ayni eski reset dosyasi oldugu icin arsivlendi.
- Aktif HTML/CSS/JS ve Supabase urun gorsel akisi tarafindan kullanilmayan eski modul gorselleri arsivlendi.

Bilerek tasinmayan ornekler:

- `images/modules/allona-yemek.png`: Supabase aktif yemek urunleri kullaniyor.
- `images/modules/denizcilik.png`: Aktif ekosistem sayfasi kullaniyor.
- `sw-reset2.js`: Aktif PWA kaydi kullaniyor.

## 2026-06-30 legacy route stub paketi

`quarantine/2026-06-30-legacy-route-stubs/` altina aktif canonical sayfalara yonlenen eski HTML uyumluluk stub'lari tasindi. Eski URL'lerin kirilmamasi icin `_redirects` dosyasina dogrudan `/pages/...` 301 kurallari eklendi.

- `pages/career/kariyer.html` artik `_redirects` ile `pages/career/allonakariyer.html` adresine gider.
- `pages/commerce/kopunlar.html` ve `pages/commerce/ode.html` artik canonical kupon/odeme sayfalarina gider.
- Eski kisa ekosistem slug'lari artik `allona*` canonical sayfalarina gider.
- `pages/legal/mesafeli-satis-sozlesmesi.html` artik `pages/legal/mesafeli-satis.html` adresine gider.

Bilerek tasinmayanlar:

- `checkout.html`, `etbis.html`, `etbis-guven-damgasi.html`, `guven-damgasi.html`: Cloudflare/canli fallback icin fiziksel redirect dosyasi olarak tutuldu.
- Root ve subpath partner redirect dosyalari: partner subdomain ve Cloudflare redirect kural sirasi netlesene kadar fiziksel fallback olarak tutuldu.

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
