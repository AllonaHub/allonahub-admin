# Denizcilik Modulu Sorumlusu

Bu dosya, 27 Haziran 2026 tarihinde denizcilik modulu icin yapilan yerel calisma ve teslim notlarini ozetler.

## Mevcut Durum Bulgusu

| Alan | Durum | Not |
| --- | --- | --- |
| Uygulama kodu | Yeni eklendi | `denizcilik-modulu/` altinda calisan statik modul olusturuldu. |
| 404/kirik buton riski | Giderildi | Nav, CTA, footer ve form aksiyonlari mevcut HTML sayfalarina baglandi. |
| Bos gorsel riski | Giderildi | Yerel liman operasyon gorseli `assets/img/port-operations-hero.png` olarak eklendi. |
| Navlun verisi | Eklendi | Rota, firma, fiyat, kapasite, transit sure ve gecerlilik bilgileri var. |
| Partner akisi | Eklendi | Partner navlun ekleyebilir, paylasim yapabilir, talebe yanit verebilir. |
| Supabase | Hazirlandi | `schema.sql`, `seed.sql` ve JS istemci katmani eklendi. |

## Eklenen Ekranlar

| Sayfa | Amac |
| --- | --- |
| `index.html` | Modulu dolu dashboard olarak acmak |
| `navlun.html` | Rota, mod, konteyner ve fiyat filtreli navlun panosu |
| `paylasimlar.html` | Partner duyurulari ve paylasim formu |
| `firmalar.html` | Dogrulanmis denizcilik firmalari |
| `danismanlar.html` | Danisman randevu ve iletisim aksiyonlari |
| `partner-panel.html` | Navlun girisi, teklif talepleri ve evrak kontrolu |
| `teklif.html` | Musteri teklif talebi formu |
| `destek.html` | Operasyon destek kaydi |
| `404.html` | Bos 404 yerine calisan sayfa haritasi |

## Veri Kapsami

- 10 navlun teklifi
- 6 denizcilik/lojistik firmasi
- 4 uzman danisman
- 5 partner paylasimi
- 3 acik teklif talebi
- 3 destek kaydi

## Tasarim ve UX Kararlari

- Uzayan kart listeleri yatay kaydirma ile verildi.
- Tablo alanlari mobilde yatay kayar yapida tutuldu.
- Kart radius degeri 8px seviyesinde tutuldu.
- Butonlar net aksiyonlara baglandi: teklif al, detay incele, randevu, destek, navlun ekle.
- Bos veri durumuna dusmemek icin Supabase bagli degilken demo veri ve localStorage kullanildi.

## Supabase Notu

Gercek Supabase projesi baglaninca:

1. `denizcilik-modulu/supabase/schema.sql` calistirilir.
2. `denizcilik-modulu/supabase/seed.sql` calistirilir.
3. `denizcilik-modulu/assets/js/supabase-config.js` icinde `enabled`, `url`, `anonKey` doldurulur.

MVP seviyesinde anon okuma/yazma politikalari aciktir. Yayina cikmadan once partner auth, rol bazli yetki ve sahiplik kontrolleri eklenmelidir.

## Kontrol Listesi

| Kontrol | Sonuc |
| --- | --- |
| Sayfa dosyalari mevcut mu? | Tamam |
| Buton href hedefleri mevcut mu? | Tamam |
| Navlun fiyatlari gorunuyor mu? | Tamam |
| Paylasim formu calisiyor mu? | Tamam |
| Teklif formu calisiyor mu? | Tamam |
| Destek formu calisiyor mu? | Tamam |
| Supabase schema/seed var mi? | Tamam |
| Gorsel bosluk var mi? | Yok |
