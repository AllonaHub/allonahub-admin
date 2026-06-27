# Akilli Bot Gelisim Seviyeleri

Bu dokuman ALLONAHUB botunun ne kadar ileri tasinabilecegini ve mevcut seviyeyi aciklar.

## Seviye 1: Kural Tabanli Bot

- Sabit SSS cevaplari verir.
- Intent listesi dardir.
- Hafiza ve musteriye gore uyarlama yoktur.

Durum: Asildi.

## Seviye 2: Kaynakli Bilgi Botu

- Proje dokumanlarini bilgi tabani olarak okur.
- Cevaplara kaynak baglar.
- Riskli konularda insan destegine devreder.

Durum: Tamamlandi.

## Seviye 3: Akilli Operasyon Botu

- Musteri tonunu ve aciliyeti anlar.
- Ad, iletisim, yolculuk ID, konu tipi ve ihtiyac ozeti gibi slotlari toplar.
- Eksik bilgiyi tek tek sorar.
- Onceki niyeti surdurur.
- Ayni konusmada tekrar ticket acmaz.
- Next-best-action uretir.

Durum: Tamamlandi.

## Seviye 4: AI Destekli Danisman Bot

- LLM ile dogal, daha akici ve duruma ozel cevap uretir.
- Yalnizca onayli bilgi tabanini ve izinli tool'lari kullanir.
- Musteri gecmisi, panel kayitlari ve gercek modül verisiyle daha net karar verir.
- Evals ile cevap kalitesi olculur.

Gerekenler:

- Onayli model ve API anahtari.
- Vektor arama veya dosya arama altyapisi.
- CRM, destek paneli, user panel, partner panel ve admin panel entegrasyonu.
- Veri isleme, saklama ve KVKK politikasinin onayi.
- Maliyet ve rate limit sinirlari.

## Seviye 5: Agentic Operasyon Botu

- Yetkili tool'larla destek kaydi acar, panel kaydi gunceller, rapor hazirlar.
- Riskli islemleri insan onayina yollar.
- Basit operasyonlari kendi tamamlar.
- Cok kanalli calisir: web, WhatsApp, Telegram, Instagram DM, admin panel.
- Canli izleme, alarm ve insan geri bildirimiyle kendini gelistirir.

Gerekenler:

- Tool izin matrisi.
- Onay mekanizmasi.
- Audit log ve geri alma stratejisi.
- Gercek API sozlesmeleri.
- Guvenlik testleri ve LLM eval setleri.

## Ulasilabilecek Ust Sinir

Teknik olarak botu Seviye 5'e kadar cikarabiliriz. Bunun anlami:

- Musteriyi anlar.
- Konusma gecmisini hatirlar.
- Eksik bilgiyi toplar.
- Panel ve modüllerden veri okur.
- Riskli islemi otomatik yapmaz, onaya gonderir.
- Guvenli islemleri otomatik tamamlar.
- Her cevabi kaynak, log ve kalite metriğiyle izler.

Tam otonom finans, iade, iptal, hesap silme, yetki verme veya veri disari aktarma islemleri onerilmez. Bu alanlarda en ust seviye, "bot hazirlar ve insan onayiyla uygular" modeli olmalidir.
