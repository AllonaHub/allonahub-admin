# Hukuk-Politika Uyum ve Footer Geliştirme Raporu

Bu rapor 27 Haziran 2026 tarihinde ALLONAHUB proje klasöründeki mevcut statik uygulama dosyaları incelenerek hazırlanmıştır.

## Yapılan Geliştirmeler

| Alan | Yapılan işlem | Durum |
| --- | --- | --- |
| Yasal merkez | `legal/index.html` altında gizlilik, KVKK, çerez, kullanım, üyelik, partner, ticari iletişim, iade/iptal, mesafeli satış ve veri saklama bölümleri oluşturuldu | Tamamlandı |
| Ortak yasal stil | `legal/assets/legal.css` eklendi | Tamamlandı |
| Footer standardı | Denizcilik, AVM, Shop ve User Panel ekranları yasal merkeze bağlandı | Tamamlandı |
| KVKK ayrımı | Aydınlatma metni ile ticari ileti izni ayrı tutuldu | Tamamlandı |
| Şirket bilgisi kontrolü | MERSİS/VKN/resmi adres bilgisi mevcut `pages/company/iletisim.html` ve `pages/legal/*` içeriklerinde bulundu | Yasal merkeze işlendi |
| Form metinleri | Teklif, destek, partner navlun, partner paylaşım ve kullanıcı destek/profil alanlarına yasal bilgilendirme eklendi | Tamamlandı |

## Güncellenen Uygulama Dosyaları

| Dosya/Alan | Özet |
| --- | --- |
| `denizcilik-modulu/*.html` | Tüm mevcut footerlar yasal merkez bağlantıları ve modül bazlı hukuki notlarla genişletildi |
| `avm-dunyasi-modulu/index.html` | AVM rehberi footerına gizlilik, KVKK, çerez, kullanım, iade/iptal, ticari ileti ve iletişim bağlantıları eklendi |
| `avm-dunyasi-modulu/partner.html` | Partner koşulları ve içerik sorumluluğu footerı eklendi |
| `avm-dunyasi-modulu/admin.html` | Admin yasal denetim, KVKK, veri saklama ve audit notlu footer eklendi |
| `avm-dunyasi-modulu/shop.html` | Shop için iade/iptal, mesafeli satış ve ticari ileti bağlantılı footer eklendi |
| `user-panel/index.html` | Kullanıcı hakları, KVKK, üyelik, veri saklama ve ticari ileti bağlantılı footer eklendi |
| `shared/mobile/mobile-core.css` | Ortak yasal footer ve form bilgilendirme sınıfları eklendi |
| `avm-dunyasi-modulu/assets/js/partner.js` | Partner sözleşme, KVKK, ticari ileti ve yanıltıcı reklam kontrolleri güçlendirildi |
| `user-panel/assets/js/app.js` | Kampanya bildirimi tercihi ticari ileti izni mantığına göre yeniden adlandırıldı |

## Şirket Bilgisi Bulgusu

İlk lokal taramada ana çalışma ağacında `hakkimizda.html` ve canlı `pages/company` dosyaları görünmediği için şirket bilgileri eksik raporlandı. Remote `origin/main` üzerinden açılan güncel çalışma ağacında bilgiler `pages/company/iletisim.html`, `pages/legal/kvkk.html`, `pages/legal/iade-politikasi.html` ve diğer yasal sayfalarda bulundu.

Yasal merkeze işlenen bilgiler:

| Alan | Bilgi |
| --- | --- |
| Şirket unvanı | Allworksin Business Danışmanlık Ticaret Limited Şirketi |
| MERSİS no | 055194568800001 |
| Vergi dairesi | Halkalı Vergi Dairesi |
| Vergi no | 0551945688 |
| Adres | Atatürk Mahallesi Güner Sokak 1/1B Blok B1 Daire No:203 Küçükçekmece / İstanbul / Türkiye |
| Telefon | +90 542 778 18 68 |
| Genel e-posta | info@allonahub.com |
| Destek e-posta | destek@allonahub.com |
| Yasal başvuru | legal@allonahub.com |

Kalan eksik: KEP adresi ve ticaret sicil numarası taranan dosyalarda ayrıca bulunmadı.

## Mevzuat ve Politika Yaklaşımı

| Konu | Uygulanan yaklaşım |
| --- | --- |
| KVKK | Kişisel veri işleme amaçları, veri kategorileri, hukuki dayanak yaklaşımı ve ilgili kişi hakları ayrı açıklandı |
| Açık rıza | Zorunlu aydınlatma metninden ayrıldı; pazarlama ve ticari ileti için ayrı izin yaklaşımı benimsendi |
| Çerezler | Zorunlu, tercih, analitik ve reklam çerezleri ayrı kategorilere bölündü |
| E-ticaret | Satış/ödeme açılmadan önce ön bilgilendirme, mesafeli satış, iade ve iptal metinlerinin nihai hale getirilmesi şartı yazıldı |
| Partner içerikleri | Partnerin fiyat, stok, kampanya, kupon, marka, lokasyon ve yayın sorumluluğu netleştirildi |
| Global açılım | GDPR ve ülke bazlı tüketici/veri koruma kontrolleri için hazırlık notu eklendi |

## Resmi Kaynak Kontrolü

Çalışmada kontrol dayanağı olarak aşağıdaki resmi kaynak alanları esas alınmıştır:

- KVKK Kurumu: `https://www.kvkk.gov.tr/`
- Ticaret Bakanlığı: `https://www.ticaret.gov.tr/`
- Elektronik Ticaret Bilgi Sistemi: `https://www.eticaret.gov.tr/`
- İleti Yönetim Sistemi: `https://iys.org.tr/`
- Gelir İdaresi Başkanlığı: `https://www.gib.gov.tr/`
- European Commission Data Protection: `https://commission.europa.eu/law/law-topic/data-protection/data-protection-eu_en`

## Yayın Öncesi Zorunlu Tamamlanacaklar

1. KEP adresi ve ticaret sicil numarası resmi şirket kayıtlarından doğrulanıp yasal merkeze eklenmeli.
2. Gerçek çerez envanteri teknik ekip tarafından çıkarılmalı.
3. Canlı ödeme/satış açılacaksa ürün veya hizmet türüne göre mesafeli satış ve ön bilgilendirme metni hukuk/mali müşavir kontrolünden geçmeli.
4. Ticari elektronik ileti izni İYS süreciyle uyumlu hale getirilmeli.
5. KVKK başvuru kanalı ve veri saklama süreleri operasyon kararlarıyla netleştirilmeli.
