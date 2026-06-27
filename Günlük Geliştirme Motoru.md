# Günlük Geliştirme Motoru

Bu doküman ALLONAHUB proje yönetimi kapsamında günlük geliştirme akışının nasıl başlatılacağını, önceliklendirileceğini, takip edileceğini, test edileceğini ve gün sonunda nasıl kapatılacağını tanımlar.

## Amaç

- Her gün geliştirme ekibinin net önceliklerle çalışmasını sağlamak.
- Açık işlerin, hataların, risklerin ve bağımlılıkların düzenli olarak görünür olmasını sağlamak.
- Günlük geliştirme çıktılarının test, güvenlik, mobil görünüm ve yayın kriterleriyle uyumlu ilerlemesini sağlamak.
- Proje sahibi, ürün, tasarım, geliştirme ve QA ekipleri arasında ortak bir günlük çalışma ritmi oluşturmak.

## Kapsam

- Günlük iş planı ve önceliklendirme
- Yeni özellik, hata düzeltme, içerik ve tasarım görevleri
- Kod inceleme, test, mobil kontrol ve güvenlik kontrolleri
- Gün içi durum takibi ve engel yönetimi
- Gün sonu raporlama, teslim kontrolü ve ertesi gün hazırlığı

## Temel İlkeler

- Her gün en kritik kullanıcı akışına değer katacak işlerle başlamalıdır.
- Geliştirme çıktısı yalnızca kod yazımı değil; test, doğrulama ve dokümantasyonla tamamlanmış kabul edilir.
- Kritik ve yüksek öncelikli hatalar yeni geliştirmelerden önce değerlendirilir.
- Gün içinde ortaya çıkan engeller bekletilmeden görünür hale getirilir.
- Küçük, izlenebilir ve test edilebilir teslimatlar büyük belirsiz teslimatlara tercih edilir.

## Günlük Akış

| Zaman | Aktivite | Amaç | Çıktı |
| --- | --- | --- | --- |
| Gün başlangıcı | Öncelik kontrolü | Günün odağını netleştirmek | Günlük iş listesi |
| Sabah | Teknik hazırlık | Branch, ortam, veri ve bağımlılıkları kontrol etmek | Çalışmaya hazır geliştirme ortamı |
| Gün içi | Geliştirme | Seçilen işleri küçük teslimatlar halinde ilerletmek | Kod, içerik veya tasarım çıktısı |
| Gün içi | Ara doğrulama | Hataları erken yakalamak | Lokal test ve ekran kontrolü sonucu |
| Öğleden sonra | Kod inceleme ve düzeltme | Kaliteyi artırmak ve riskleri azaltmak | Review notları ve düzeltmeler |
| Gün sonu | Kapanış kontrolü | Yapılan işin durumunu netleştirmek | Gün sonu raporu |
| Gün sonu | Ertesi gün hazırlığı | Devam eden işlerin bağlamını kaybetmemek | Açık iş, engel ve sonraki adım listesi |

## Gün Başlangıcı Kontrol Listesi

| Alan | Kontrol | Durum | Not |
| --- | --- | --- | --- |
| Öncelik | Kritik ve yüksek öncelikli işler gözden geçirildi mi? | Beklemede | Kullanıcı akışını durduran işler öne alınmalı |
| Kapsam | Bugün tamamlanacak işler net mi? | Beklemede | Belirsiz görevler parçalanmalı |
| Bağımlılık | Tasarım, içerik, API veya karar bekleyen iş var mı? | Beklemede | Engel erken paylaşılmalı |
| Ortam | Lokal geliştirme ortamı çalışıyor mu? | Beklemede | Kurulum hataları gün başında çözülmeli |
| Branch | Doğru branch üzerinde çalışılıyor mu? | Beklemede | Ana branch üzerinde doğrudan geliştirme yapılmamalı |
| Veri | Test verisi veya örnek içerik hazır mı? | Beklemede | Gerçek kullanıcı verisi kullanılmamalı |
| Güvenlik | Secret, erişim ve yetki gereksinimleri net mi? | Beklemede | Gizli bilgiler repoya yazılmamalı |

## İş Önceliklendirme

| Öncelik | Tanım | Örnek |
| --- | --- | --- |
| Kritik | Kullanıcı akışını, yayını veya güvenliği durduran iş | Login çalışmıyor, ödeme tamamlanmıyor, yönetici erişimi riskli |
| Yüksek | Kullanıcı deneyimini veya dönüşümü ciddi etkileyen iş | Mobilde CTA görünmüyor, hizmet kartları kırılıyor |
| Orta | Deneyimi iyileştiren ama akışı durdurmayan iş | Listeleme hizası, filtre davranışı, içerik netliği |
| Düşük | Kozmetik, düzenleme veya teknik borç niteliğindeki iş | Küçük boşluk farkı, isimlendirme düzeni |

## Geliştirme Standartları

- Her iş açık bir hedef, beklenen davranış ve kabul kriteriyle başlamalıdır.
- Değişiklikler mümkün olduğunca küçük ve izlenebilir olmalıdır.
- Yeni özelliklerde boş durum, hata durumu, yükleniyor durumu ve mobil görünüm düşünülmelidir.
- Kullanıcıya görünen metinlerde marka dili, yazım ve tutarlılık kontrol edilmelidir.
- API, form, yetki veya veri işleyen alanlarda güvenlik kontrolü ayrıca yapılmalıdır.
- Değiştirilen alanın mevcut kritik akışları bozmadığı doğrulanmalıdır.

## Mobil Yatay Modül Kontrolü

Günlük geliştirme sırasında her modül için uzun dikey alanlar ayrıca kontrol edilmelidir. Mobilde aşağıdaki yapılar dikey yığılma yerine yatay kaydırmalı şerit olarak planlanmalıdır:

| Alan | Mobil Düzen | Kontrol |
| --- | --- | --- |
| Günlük iş listesi | Yatay görev kartları | Kritik iş ilk kartta görünmeli |
| Günlük akış adımları | Yatay süreç şeridi | Gün başlangıcı, geliştirme, test ve kapanış adımları tek uzun blok olmamalı |
| Kontrol listeleri | Yatay checklist kartları veya tablo sarmalayıcı | Durum ve not alanları taşmamalı |
| Açık hatalar | Yatay hata kartları | Öncelik, etki ve önerilen aksiyon ilk görünümde olmalı |
| Mobil bulgular | Yatay ekran genişliği kartları | 320px, 375px, 390px, 414px ve tablet sonuçları ayrı kartlarda takip edilmeli |
| Gün sonu raporu | Yatay rapor bölümleri | Tamamlanan, test, mobil kontrol ve engel alanları ayrı kartlar olmalı |

Günlük kabul notları:

- Her iş kapatılmadan önce uzun dikey mobil alan olup olmadığı kontrol edilmelidir.
- Tespit edilen uzun liste, tablo, kart veya durum akışı yatay modül şeridi kuralına göre yeniden düzenlenmelidir.
- Sayfa genelinde istemsiz yatay taşma oluşursa iş tamamlanmış sayılmamalıdır.
- Yatay şeritler dokunmatik, klavye odağı ve ekran okuyucu sırasıyla kullanılabilir olmalıdır.

## Kod İnceleme Kontrol Listesi

| Alan | Kontrol | Durum | Not |
| --- | --- | --- | --- |
| Kapsam | Değişiklik görevle sınırlı mı? | Beklemede | Gereksiz refactor ayrı planlanmalı |
| Okunabilirlik | Kod anlaşılır ve mevcut yapıyla uyumlu mu? | Beklemede | Yerel standartlar korunmalı |
| Hata yönetimi | Hata ve boş durumlar ele alındı mı? | Beklemede | Kullanıcıya gereksiz teknik detay gösterilmemeli |
| Güvenlik | Yetki, input ve secret kontrolleri uygun mu? | Beklemede | Sunucu tarafı kontroller ihmal edilmemeli |
| Mobil | Değişiklik dar ekranlarda kontrol edildi mi? | Beklemede | 320px genişlik dahil edilmeli |
| Performans | Gereksiz yük, tekrar render veya büyük asset eklendi mi? | Beklemede | Mobil performans öncelikli |
| Test | İlgili test veya manuel doğrulama yapıldı mı? | Beklemede | Sonuç gün sonu notuna eklenmeli |

## Test ve Doğrulama

Günlük geliştirme çıktıları aşağıdaki alanlarda doğrulanmalıdır:

- İlgili kullanıcı akışı masaüstünde çalışıyor mu?
- İlgili kullanıcı akışı mobil kırılımlarda çalışıyor mu?
- Ana CTA, form, menü ve yönlendirmeler doğru hedefe gidiyor mu?
- Yeni hata, konsol hatası veya görsel taşma oluştu mu?
- Yetki gerektiren alanlarda kullanıcı rolü doğru kontrol ediliyor mu?
- Görseller, metinler ve bileşenler yükleniyor durumunda anlamını koruyor mu?
- Değişiklik SEO, erişilebilirlik veya performans açısından risk yaratıyor mu?

## Gün İçi Engel Yönetimi

| Engel Türü | Örnek | Aksiyon |
| --- | --- | --- |
| Ürün kararı | Akış veya kabul kriteri belirsiz | Ürün ekibinden net karar istenir |
| Tasarım kararı | Mobil davranış tanımsız | Tasarım ekibiyle kırılım ve bileşen davranışı netleştirilir |
| Teknik bağımlılık | API, servis veya veri hazır değil | Geçici çözüm ve kalıcı ihtiyaç ayrı yazılır |
| Erişim sorunu | Panel, repo veya ortam erişimi yok | Teknik lider veya proje sahibi bilgilendirilir |
| Güvenlik riski | Yetki, secret veya veri sızıntısı şüphesi | Öncelik yükseltilir ve güvenlik kontrolü başlatılır |

## Gün Sonu Raporu

Gün sonunda kısa ve net bir rapor hazırlanmalıdır:

| Alan | İçerik |
| --- | --- |
| Tamamlanan işler | Bitirilen geliştirme, düzeltme veya içerik işleri |
| Devam eden işler | Bir sonraki güne kalan işler ve mevcut durum |
| Test sonucu | Yapılan otomatik veya manuel doğrulamalar |
| Mobil kontrol | Kontrol edilen ekran genişlikleri ve bulgular |
| Açık hatalar | Öncelik, etki ve önerilen aksiyon |
| Engeller | Karar, erişim, tasarım, API veya veri bekleyen noktalar |
| Ertesi gün odağı | İlk ele alınacak iş veya risk |

## Kabul Kriterleri

- Günlük iş listesi öncelik sırasına göre belirlenmiştir.
- Kritik ve yüksek öncelikli açık hatalar değerlendirilmiştir.
- Geliştirilen işler kabul kriterleriyle karşılaştırılmıştır.
- İlgili ekranlarda masaüstü ve mobil kontroller yapılmıştır.
- Güvenlik, erişilebilirlik ve performans açısından bariz riskler kontrol edilmiştir.
- Gün sonunda tamamlanan, devam eden ve engellenen işler raporlanmıştır.
- Ertesi gün için ilk aksiyon netleştirilmiştir.

## Periyodik Kontroller

| Sıklık | Kontrol |
| --- | --- |
| Her gün | Gün başlangıcı öncelik kontrolü yapılır |
| Her gün | Gün sonu raporu hazırlanır |
| Haftalık | Açık hata, teknik borç ve risk listesi gözden geçirilir |
| Haftalık | Mobil, güvenlik ve performans bulguları önceliklendirilir |
| Sprint sonunda | Tamamlanan işlerin kabul kriterleri ve regresyon etkisi kontrol edilir |
| Yayın öncesi | Kritik akışlar, güvenlik kontrolleri ve mobil uygunluk tekrar doğrulanır |

## Sorumluluk Matrisi

| Rol | Sorumluluk |
| --- | --- |
| Proje sahibi | Günlük önceliklerin iş hedefleriyle uyumunu onaylar |
| Ürün ekibi | Görev kapsamı, kabul kriteri ve kullanıcı değerini netleştirir |
| Tasarım ekibi | Görsel kararları, mobil davranışları ve bileşen durumlarını tanımlar |
| Geliştirme ekibi | Günlük işleri uygular, test eder ve teknik riskleri paylaşır |
| QA ekibi | Test senaryolarını çalıştırır, bulguları önceliklendirir |
| Teknik lider | Kod kalitesi, mimari uygunluk, güvenlik ve yayın risklerini takip eder |

## Açık Riskler

| Risk | Etki | Olasılık | Öncelik | Aksiyon |
| --- | --- | --- | --- | --- |
| Günlük önceliğin belirsiz kalması | Yüksek | Orta | Yüksek | Gün başlangıcında en fazla 3 ana hedef belirlenmeli |
| Test edilmeden iş kapatılması | Yüksek | Orta | Yüksek | Gün sonu raporunda test sonucu zorunlu olmalı |
| Mobil kontrolün atlanması | Orta | Orta | Orta | Mobil görünüm sorumlusu kontrol listesiyle bağlanmalı |
| Güvenlik risklerinin geç fark edilmesi | Yüksek | Düşük | Yüksek | Yetki, secret ve input kontrolleri review adımına eklenmeli |
| Açık engellerin görünmez kalması | Orta | Orta | Orta | Engeller aynı gün proje ekibiyle paylaşılmalı |

## Teslim Çıktıları

- Günlük öncelik listesi
- Tamamlanan iş ve değişiklik özeti
- Test ve mobil kontrol notları
- Açık hata ve risk listesi
- Engel ve karar bekleyen konular
- Ertesi gün geliştirme odağı
