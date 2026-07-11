# 2026-06-30 legacy route stub archive

Bu klasor, aktif canonical sayfalara yonlenen eski HTML uyumluluk stub'larini tutar.

## Calismama kurali

- Dosyalar orijinal path yapisi korunarak `.inactive.txt` uzantisina cevrildi.
- Eski URL'ler `_redirects` uzerinden dogrudan canonical sayfalara 301 yonlenir.
- Bu dosyalar aktif sayfa, sitemap veya navigasyon kaynagi olarak kullanilmamalidir.

## Tasinan eski route stub'lari

- `pages/career/kariyer.html` -> `pages/career/allonakariyer.html`
- `pages/commerce/kopunlar.html` -> `pages/commerce/kuponlar.html`
- `pages/commerce/ode.html` -> `pages/commerce/odeme.html`
- `pages/ecosystem/allonapet.html` -> `pages/ecosystem/allonaevcilhayvan.html`
- `pages/ecosystem/danismanlik.html` -> `pages/ecosystem/allonadanismanlik.html`
- `pages/ecosystem/eglence.html` -> `pages/ecosystem/allonaeglence.html`
- `pages/ecosystem/evhizmetleri.html` -> `pages/ecosystem/allonaevhizmetleri.html`
- `pages/ecosystem/finans.html` -> `pages/ecosystem/allonafinans.html`
- `pages/ecosystem/gayrimenkul.html` -> `pages/ecosystem/allonagayrimenkul.html`
- `pages/ecosystem/guzellik.html` -> `pages/ecosystem/allonaguzellik.html`
- `pages/ecosystem/hukuk.html` -> `pages/ecosystem/allonahukuk.html`
- `pages/ecosystem/insaat.html` -> `pages/ecosystem/allonainsaat.html`
- `pages/ecosystem/kargolojistik.html` -> `pages/ecosystem/allonalojistik.html`
- `pages/ecosystem/kurye.html` -> `pages/ecosystem/allonakurye.html`
- `pages/ecosystem/nakliye.html` -> `pages/ecosystem/allonanakliye.html`
- `pages/ecosystem/organizasyondugun.html` -> `pages/ecosystem/allonaorganizasyon.html`
- `pages/ecosystem/otomotiv.html` -> `pages/ecosystem/allonaotomotiv.html`
- `pages/ecosystem/sigorta.html` -> `pages/ecosystem/allonasigorta.html`
- `pages/ecosystem/sportiv.html` -> `pages/ecosystem/allonasporfitness.html`
- `pages/ecosystem/tarim.html` -> `pages/ecosystem/allonatarim.html`
- `pages/ecosystem/teknoloji.html` -> `pages/ecosystem/allonateknoloji.html`
- `pages/legal/mesafeli-satis-sozlesmesi.html` -> `pages/legal/mesafeli-satis.html`

## Bilerek tasinmayan uyumluluk dosyalari

- `checkout.html`, `etbis.html`, `etbis-guven-damgasi.html`, `guven-damgasi.html`: Cloudflare/canli fallback icin fiziksel redirect dosyasi olarak tutuldu.
- Root ve subpath partner redirect dosyalari: partner subdomain ve Cloudflare redirect kural sirasi netlesene kadar fiziksel fallback olarak tutuldu.
