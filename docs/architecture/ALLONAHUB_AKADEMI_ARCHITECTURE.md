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
