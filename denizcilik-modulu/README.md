# ALLONAHUB Denizcilik Modulu

Calisan statik denizcilik modulu. Navlun panosu, firma/danisman listeleri, partner paylasimlari, teklif talebi ve destek kaydi ekranlari dolu veriyle acilir.

## Calistirma

Proje kok klasorunden basit bir lokal sunucu acin:

```bash
python3 -m http.server 4180
```

Sonra tarayicida:

```text
http://localhost:4180/denizcilik-modulu/index.html
```

Not: Denizcilik sayfalari `../shared/mobile/mobile-core.css` ve `../shared/mobile/mobile-core.js` ortak mobil cekirdegini kullandigi icin sunucu `denizcilik-modulu/` icinden degil proje kokunden baslatilmalidir.

## Supabase Baglantisi

1. Supabase SQL editor icinde once `supabase/schema.sql`, sonra `supabase/seed.sql` dosyasini calistirin.
2. `assets/js/supabase-config.js` icindeki degerleri doldurun:

```js
window.MARITIME_SUPABASE = {
  enabled: true,
  url: "https://PROJECT_REF.supabase.co",
  anonKey: "SUPABASE_ANON_KEY"
};
```

3. Sayfayi yenileyin. Ust barda `Supabase bagli` gorunur.

Gercek projede public insert politikalari partner auth/RBAC kuralina daraltilmalidir. Bu MVP, modulu hemen calistirmak ve veri akislarini gostermek icin anon okuma/yazma ile hazirlandi.

## Sayfalar

- `index.html`: Denizcilik paneli
- `navlun.html`: Navlun filtreleme ve fiyat panosu
- `paylasimlar.html`: Partner duyurulari ve yeni paylasim formu
- `firmalar.html`: Dogrulanmis denizcilik firmalari
- `danismanlar.html`: Danisman listesi ve randevu aksiyonlari
- `partner-panel.html`: Navlun ekleme ve talep havuzu
- `teklif.html`: Musteri teklif talebi
- `destek.html`: Destek kaydi
- `404.html`: Calisan sayfa haritasi
