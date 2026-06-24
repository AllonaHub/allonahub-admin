# 2026-06-24 inactive cleanup archive

Bu klasor aktif siteye bagli olmayan kopya kodlari ve sahipsiz eski modul gorsellerini gecici inceleme arsivinde tutar.

## Calismama kurali

- Kod dosyalari `.inactive.txt` uzantisina cevrildi.
- Gorsel dosyalari `.inactive` uzantisina cevrildi.
- Klasor icin `_headers` uzerinden `noindex`, `nosniff` ve CSP `sandbox` basliklari tanimlandi.
- Bu dosyalar aktif HTML, CSS, JS veya Supabase urun gorsel akisi tarafindan kullanilmamalidir.

## Pasif kopya kodlar

- `css/super-admin.entry1.css` -> `inactive-code/css/super-admin.entry1.css.inactive.txt`
- `css/super-admin.ui1.css` -> `inactive-code/css/super-admin.ui1.css.inactive.txt`
- `js/mfa.returnfix1.js` -> `inactive-code/js/mfa.returnfix1.js.inactive.txt`
- `js/security-challenge.cffix1.js` -> `inactive-code/js/security-challenge.cffix1.js.inactive.txt`
- `js/super-admin.accessfix1.js` -> `inactive-code/js/super-admin.accessfix1.js.inactive.txt`
- `sw-reset1.js` -> `inactive-code/root/sw-reset1.js.inactive.txt`

## Pasif eski modul gorselleri

- `images/modules/allona-market.png` -> `inactive-images/images/modules/allona-market.png.inactive`
- `images/modules/allona-taksi.png` -> `inactive-images/images/modules/allona-taksi.png.inactive`
- `images/modules/ashop.png` -> `inactive-images/images/modules/ashop.png.inactive`
- `images/modules/muhendislik.png` -> `inactive-images/images/modules/muhendislik.png.inactive`
- `images/modules/saglik.png` alternatif yazimli `saglık.png` -> `inactive-images/images/modules/saglık.png.inactive`
- `images/modules/trade.png` -> `inactive-images/images/modules/trade.png.inactive`

## Bilerek tasinmayanlar

- `images/modules/allona-yemek.png`: Supabase aktif yemek urunlerinde kullaniliyor.
- `images/modules/denizcilik.png`: Aktif ekosistem sayfasinda kullaniliyor.
- `sw-reset2.js`: Aktif PWA reset kaydi bu dosyayi kullaniyor.
