# ALLONAHUB Central Mobile Core

Bu klasör tüm modülleri tek yerden etkileyen mobil görünüm çekirdeğidir.

## Dosyalar

- `mobile-core.css`: Tüm modüller için ortak mobil layout, yatay kaydırmalı kart şeritleri, tablo sarmalayıcıları, filtre chipleri, hero görsel davranışı ve dokunmatik kurallar.
- `mobile-core.js`: Sayfadaki bilinen modül listelerini yatay kaydırılabilir alan olarak işaretler, tabloları otomatik sarmalar ve erişilebilir odak davranışı ekler.

## Kullanım

Her modül HTML dosyasında kendi stil dosyasından sonra:

```html
<link rel="stylesheet" href="../shared/mobile/mobile-core.css">
```

Sayfanın kapanışından önce veya `defer` ile:

```html
<script defer src="../shared/mobile/mobile-core.js"></script>
```

## Kural

Mobilde uzun dikey liste, tablo, kart, rapor, geçmiş ve durum alanları tek tek modül CSS'lerinde çözülmez. Ana davranış bu çekirdekten yönetilir.

Modül özelinde farklı davranış gerekiyorsa ilgili kapsayıcıya `mobile-core-no-rail` sınıfı verilir.
