# Allona Fair Commerce Algorithm

## Amac

Allona Shop siralama sistemi uc hedefi birlikte dengeler:

- Alicinin aradigi urune hizli ulasmasi ve satin almaya uygun, guvenilir urunleri gormesi.
- Partner ve saticilarin tek bir buyuk satici veya populer urun tarafindan ezilmeden makul gorunurluk almasi.
- AllonaHub'in katalog, lojistik, kampanya, toptan-perakende ve gelecekteki entegrasyon akisini olceklenebilir tutmasi.

Bu belge ticari sir formulu aciklamaz. Frontend'deki `js/shop-algorithm.js` yalnizca guvenli istemci tarafi V1 iskeletidir. Uretimde gizli agirliklar, uzun donem ogrenme modeli ve platforma ozel karar parametreleri sunucu/edge katmaninda tutulmalidir.

## Kaynaklardan Cikan Ilkeler

- Pazaryeri satici kalitesi sadece satisa bakmamalidir; iptal, iade, kargoya zamaninda teslim, musteri sorularina donus ve eksik/hatalı/hasarli urun gondermeme gibi operasyon sinyalleri satici guveninin parcasidir.
- Urun verisi fiyat, stok, gorsel, kategori ve aciklama acisindan dogru ve guncel olmalidir. Eksik fiyat veya stok, gercek satis vaadi gibi one itilmemelidir.
- Iki tarafli pazaryerlerinde yalnizca populer urunleri one cikarmak, kucuk saticilari ve yeni urunleri gorunmez hale getirir. Satici adaleti ve alici memnuniyeti birlikte optimize edilmelidir.
- Cerez ve davranis temelli kisisellestirme, acik ve yonetilebilir izinle calismalidir. Kullanici reddettiginde zorunlu olmayan izleme yapilmamalidir.
- Tavsiye sisteminin ana mantigi kullaniciya anlasilir seviyede anlatilabilir olmalidir; kesin agirliklar ve ticari sirlar kamuya acilmak zorunda degildir, fakat kullanici aldatilmamalidir.

## V1 Akis

1. Katalog on elemesi
   - Aktif olmayan, kimligi belirsiz veya Shop kapsami disindaki urunler siralamaya alinmaz.
   - Fiyat veya stok eksikse urun bilgi amacli gosterilebilir, ancak satin alma icin one itilmez.
   - Gorsel, kategori, marka, aciklama ve satici bilgisi kalite sinyaline katilir.

2. Ana skor
   - Ilgi ve alaka: arama, secili kategori, hizli filtre ve urun metni eslesmesi.
   - Ticari hazirlik: pozitif fiyat, stok, indirim, sepete eklenebilirlik.
   - Veri kalitesi: baslik, aciklama, kategori, gorsel, marka, fiyat, stok.
   - Satici guveni: satici puani veya partner/platform saticisi icin guvenli varsayilan.
   - Lojistik: stok derinligi, hizli teslimat, ucretsiz kargo sinyali.
   - Talep: satis, favori, sepette, yorum ve puan sinyalleri.
   - Kisisellestirme: yalniz pazarlama cerez izni varsa yerel ilgi profili.
   - Kesif: yeni, az gorunmus ama hazir ve kaliteli urunlere kontrollu firsat.

3. Adil yeniden siralama
   - Ilk gorunen alanda ayni saticinin asiri baskin olmasi sinirlanir.
   - Marka ve satici cesitliligi korunur.
   - Duyarsiz veya satin alinmaya hazir olmayan urunler sirf adalet icin ust siraya zorlanmaz.

4. Sinyal toplama
   - Izlenim defteri yalniz analitik veya pazarlama izniyle yerel olarak tutulur.
   - Kisisel ilgi profili yalniz pazarlama izniyle tutulur.
   - Saglik, ilac, hijyen, ic giyim gibi hassas kabul edilebilecek alanlar kisisel profil terimi olarak saklanmaz.

## Gelecek Entegrasyon Katmani

Urun ve satici verisi buyudugunde V2 sunucu tarafinda calismalidir:

- `shop_product_quality_score`: baslik, gorsel, kategori, varyant, fiyat, stok ve iade kosulu tamligi.
- `shop_seller_health_score`: teslimat, iptal, iade, fatura, musteri sorusu, destek hizlari.
- `shop_logistics_score`: kargo firmasi, teslimat SLA, bolge kapsami, stok lokasyonu.
- `shop_wholesale_retail_gate`: toptan urunun perakende yayina acilma izni, minimum satis adedi, perakende fiyat, stok rezervi.
- `shop_exposure_ledger`: satici, urun, kategori ve slot bazli gorunurluk kaydi.
- `shop_recommendation_events`: gorunum, tiklama, favori, sepete ekleme, satin alma, iade ve memnuniyet olaylari.

V3 asamasinda bandit/ogrenen model eklenebilir. Model; tek hedef olarak sadece GMV degil, donusum, musteri memnuniyeti, satici gorunurlugu, iade riski ve lojistik basariyi birlikte optimize etmelidir.

## Satici ve Alici Deneyimi

- Satici icin: kaliteli veri giren, stogu ve teslimati guclu olan, musteriye iyi donen partner duzenli gorunurluk alir. Yeni saticiya kontrollu deneme trafigi verilir.
- Alici icin: aradigi kategori, fiyat araligi, hizli teslimat, favori/sepet davranisi ve izin verdigi ilgi sinyalleri daha alakali urunleri one cikarir.
- Platform icin: eksik fiyat/stokla satis vaadi verilmez; reklam, kampanya ve organik siralama birbirinden ayirt edilebilir tutulur.

## Guvenlik Sinirlari

- Kesin ticari agirliklar frontend dosyasina konulmamalidir; tarayiciya giden her kod gorulebilir.
- Cerez izni reddedildiginde davranis temelli kisisellestirme kapali kalmalidir.
- Satici adaleti, dusuk kaliteli veya satis hazirligi olmayan urunu ust siraya tasimak anlamina gelmez.
- Sponsorlu veya ucretli yerlestirme ileride eklendiginde kullaniciya ayri etiketlenmelidir.
