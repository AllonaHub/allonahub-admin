# ALLONAHUB User Panel

Bu klasor, ALLONAHUB user panel MVP'sinin calisir frontend uygulamasini icerir.

## Kapsam

- Hesap ozeti dashboard'u
- Profil bilgisi duzenleme
- Merkezi bildirim tercihleri
- Kupon ve favori yonetimi
- Taksi yolculuk gecmisi
- Destek talebi olusturma ve kapatma
- MFA tercihi ve aktif oturum yonetimi
- Kullanici verisini JSON olarak indirme

## Calistirma

Statik dosya olarak acilabilir:

```text
user-panel/index.html
```

Yerel sunucu ile calistirmak icin:

```bash
python3 -m http.server 4173 --directory user-panel
```

Ardindan:

```text
http://127.0.0.1:4173
```

## Teknik Notlar

- Backend olmadigi icin veriler tarayicinin `localStorage` alaninda saklanir.
- Demo veri "Profili kaydet" ekranindaki "Demo veriyi sifirla" aksiyonuyla yenilenebilir.
- API, auth servisi ve veritabani baglandiginda `assets/js/app.js` icindeki durum yonetimi servis cagrisina donusturulmelidir.
