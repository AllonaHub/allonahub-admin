# Denizcilik Modulu Mobil Gorunum Notu

Bu not, `denizcilik-modulu/` altindaki calisan HTML/CSS/JS ekranlari eklendikten sonra guncellenmistir. Denizcilik HTML sayfalari merkezi mobil gorunum cekirdegine baglanmistir.

## Merkezi Baglanti

Denizcilik modulu sayfalari asagidaki ortak dosyalari kullanir:

- `../shared/mobile/mobile-core.css`
- `../shared/mobile/mobile-core.js`

## Baglanan Sayfalar

| Sayfa | Mobil Etki |
| --- | --- |
| `index.html` | Hero, KPI, navlun, partner paylasimi ve firma/danisman seritleri merkezi cekirdege bagli |
| `navlun.html` | Filtreler, navlun kayitlari ve tablo/listeler merkezi yatay davranis alir |
| `paylasimlar.html` | Partner paylasim kartlari yatay serit standardina bagli |
| `firmalar.html` | Firma kartlari yatay serit davranisi alir |
| `danismanlar.html` | Danisman kartlari ve aksiyon alanlari mobil cekirdege bagli |
| `partner-panel.html` | Partner panel kart, form ve tablo alanlari merkezi mobil kurallari kullanir |
| `destek.html` | Destek formu ve durum alanlari mobil cekirdege bagli |
| `teklif.html` | Teklif formu mobil form ve aksiyon kurallarini kullanir |
| `404.html` | Yardim baglantilari mobil dokunma kurallarini kullanir |

## Uygulanan Mobil Kararlar

| Alan | Uygulama | Sonuc |
| --- | --- | --- |
| Header | 1060px altinda acilir menü | Nav linkleri dar ekranda tasmaz |
| Hero | Tek kolona duser, gorsel 16:10 oranla korunur | Gemi/liman gorseli bos veya kirpik gorunmez |
| Navlun kartlari | `horizontal-strip` ile yatay kayar | Uzun dikey liste etkisi azalir |
| Tablolar | `table-wrap` icinde yatay kayar | 920px tablo mobilde sayfayi bozmaz |
| Firma/danisman kartlari | 1060px altinda 2 kolon, 680px altinda tek kolon | Metinler butonlara binmez |
| Evrak kontrol listesi | Yatay checklist | Uzun surec adimlari ekrani uzatmaz |
| Formlar | 680px altinda tek kolon | Input ve butonlar dokunmatik kullanima uygun |

## Kontrol Edilecek Kirilimlar

- 320px
- 375px
- 390px
- 414px
- 768px
- 1024px
- 1440px

## Kabul Kriterleri

- Ana CTA'lar dar ekranda gorunur ve 44px minimum dokunma alanini korur.
- Header icerigin ustune binmez.
- Navlun tablosu kendi kapsayicisinda yatay kayar.
- Kartlar icindeki uzun metinler butonlari iterek tasma olusturmaz.
- Yerel hero gorseli `assets/img/port-operations-hero.png` ile dolu acilir.
- Bos sayfa, bos gorsel ve calismayan ana buton kalmaz.
