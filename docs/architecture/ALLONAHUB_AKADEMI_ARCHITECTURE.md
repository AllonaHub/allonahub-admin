# AllonaHub Akademi Mimarisi

Bu belge AllonaHub Akademi icin guncel public, partner ve internal icerik kararlarini ozetler.

## Katmanlar

- Public Academy: Herkese acik, SEO uyumlu ve Google tarafindan indekslenebilir rehber makaleler.
- Partner Academy: Sadece partner girisi sonrasi erisilebilecek egitim ve operasyon rehberleri.
- Internal Academy: Sadece admin erisimli sirket ici operasyon, guvenlik ve surec dokumantasyonu.

## Ilk Asama

Ilk asamada yalnizca Public Academy yayina alinir. Partner Academy ve Internal Academy icin veri modeli ve erisim kurallari hazir birakilir, ancak public navigasyonda detay icerik acilmaz.

## Makale Modeli

Supabase icin hedef tablo: `academy_articles`

Alanlar:

- `title`
- `slug`
- `category`
- `excerpt`
- `content`
- `keywords`
- `meta_title`
- `meta_description`
- `author`
- `status`
- `published_at`
- `updated_at`

Status degerleri:

- `draft`
- `review`
- `published`
- `archived`

Public sitede yalnizca `status = published` icerikler gosterilmelidir.

## Video ve Ders Modeli

Akademi TV bolumu video, ders listesi, canli egitim ve sertifika akisina hazir olacak sekilde tasarlanir. Ilk public fazda ders verisi statik HTML ve `js/academy-page.js` uzerinden calisir; sonraki fazda Supabase tablosuna baglanabilir.

Supabase icin hedef tablo: `academy_lessons`

Alanlar:

- `title`
- `slug`
- `category`
- `summary`
- `video_url`
- `poster_url`
- `duration`
- `level`
- `visibility`
- `status`
- `sort_order`
- `published_at`
- `updated_at`

Video kaynak kurallari:

- `video_url` YouTube, Vimeo, MP4 veya WebM olabilir.
- Public sitede yalnizca `status = published` ve `visibility = public` dersler gosterilir.
- Partner dersleri `visibility = partner` olarak tutulur ve partner oturumu olmadan public listede oynatilmaz.
- Sertifika fazinda izleme durumu, test sonucu ve sertifika kaydi ayri kullanici iliskili tablolara tasinir.

Hedef ek tablolar:

- `academy_live_sessions`: Canli egitim tarihi, baslik, aciklama, kayit linki ve durum bilgisi.
- `academy_learning_paths`: Derslerin rota ve siralama yapisi.
- `academy_certificates`: Kullanici, rota, tamamlanma ve sertifika kaydi.

## SEO

`allonahub-akademi.html` sayfasi su SEO temelini icerir:

- Title ve meta description
- Canonical URL
- Open Graph ve Twitter Card
- JSON-LD WebPage ve BreadcrumbList
- Sitemap ve robots entegrasyonu

## Sadakat Dili

Bu asamada oncelik kupon sistemi, HP sadakati, kampanyalar, kurucu uye avantajlari ve partner avantajlaridir. Akademi iceriklerinde eski finansal urun odakli dil kullanilmaz.

## Route

Ana URL: `/allonahub-akademi.html`

Kisa route yonlendirmeleri:

- `/akademi`
- `/akademi/`
- `/academy`

## Layout Kurali

AllonaHub sayfalari ve modul/kart gridleri masaustu ekranda dar kutu gibi kalmamalidir. Platform yuzeylerinde 1720px civari genis container tercih edilir; moduller, kategori kartlari ve dashboard panelleri ekran genisligini verimli kullanacak sekilde yayilir. Sadece uzun metin okuma bloklari okunabilir satir uzunlugu icin daha dar tutulabilir.
