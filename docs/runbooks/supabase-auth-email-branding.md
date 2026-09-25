# Supabase Auth Email Branding

Son guncelleme: 25.09.2026

Bu runbook, Supabase Auth tarafindan gonderilen kayit dogrulama, davet, giris baglantisi, yeniden dogrulama, e-posta degisikligi, sifre yenileme ve guvenlik bildirimlerinin AllonaHub adiyla cikmasi icindir.

Bu ayar denizcilik dahil Supabase Auth kullanan tum mevcut ve yeni AllonaHub modullerine ortaktir. Canli projede SMTP kapaliysa yalnizca sablon degisikligi gonderici adresini degistirmez. `scripts/apply-supabase-auth-email-branding.mjs` bu nedenle SMTP bilgileri olmadan canli ayar degisikligini reddeder. Partner davet/erisim e-postalari da Supabase Auth uzerinden gittigi icin ayni gondericiyi kullanir.

## Hedef ayar

- Sender name: `AllonaHub`
- From address: `destek@allonahub.com` veya SMTP servisinde dogrulanmis `no-reply@allonahub.com`
- Confirmation subject: `AllonaHub ekosistemine hoş geldiniz - e-postanızı doğrulayın`
- Reset subject: `AllonaHub şifre yenileme bağlantın`
- Password changed subject: `AllonaHub şifren güncellendi`
- Invite, magic link, email change ve reauthentication sablonlari: `supabase/auth-email-templates/`
- Reset redirect: `https://allonahub.com/pages/account/reset-password.html`

Supabase'in varsayilan SMTP servisi uretim icin tasarlanmamistir ve gonderen kimligi Supabase olarak gorunebilir. Bu nedenle canli ortamda custom SMTP kullanilmalidir.

## Management API ile uygulama

1. Supabase Dashboard > Account > Access Tokens alanindan token al.
2. Proje ref degeri: `xqvikrysciguzholdjeb`.
3. SMTP servisinde `allonahub.com` icin SPF, DKIM ve DMARC kayitlarinin dogrulandigindan emin ol. AllonaShop'un Resend hesabinda `allonashop.com` dogrulanmis olsa bile bu, `allonahub.com` icin gonderim yetkisi vermez.
4. Asagidaki komutu yerel terminalde calistir:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."
export SUPABASE_PROJECT_REF="xqvikrysciguzholdjeb"
export SUPABASE_AUTH_SENDER_NAME="AllonaHub"
export SUPABASE_AUTH_SMTP_ADMIN_EMAIL="destek@allonahub.com"
export SUPABASE_AUTH_SMTP_HOST="smtp.example.com"
export SUPABASE_AUTH_SMTP_PORT="587"
export SUPABASE_AUTH_SMTP_USER="smtp-user"
export SUPABASE_AUTH_SMTP_PASS="smtp-password"

node scripts/apply-supabase-auth-email-branding.mjs
```

AllonaShop'un mevcut saglayicisi Resend'dir. Ayni hesapta `allonahub.com` ayrica dogrulanirsa Supabase Auth icin Resend SMTP kullanilabilir: host `smtp.resend.com`, port `465`, kullanici `resend`, parola ise bu is icin olusturulmus Resend API anahtaridir. Magazanin mevcut API anahtarini koddan veya loglardan cikarmaya calisma; yeni, AllonaHub'a ozel anahtar uret ve yalniz guvenli ayar ekranina gir. Resend panelinin `Domains` sayfasinda gonderim durumu verified olmadan `destek@allonahub.com` gondericisini acma. Resend SMTP'yi AllonaHub backend bildirim kuyrugunun HTTP API anahtarindan ayri yapilandir.

Degisiklikleri once gormek icin:

```bash
node scripts/apply-supabase-auth-email-branding.mjs --dry-run
```

## Dashboard ile manuel uygulama

1. Supabase Dashboard > Authentication > Settings > SMTP Settings alanina gir.
2. Custom SMTP'yi etkinlestir.
3. Sender name alanina `AllonaHub` yaz.
4. Sender email alanina SMTP servisinde dogrulanmis adresi yaz.
5. Authentication > Email Templates > Confirm sign up sablonuna `supabase/auth-email-templates/confirmation.html` icerigini yapistir.
6. Confirmation subject alanini `AllonaHub ekosistemine hoş geldiniz - e-postanızı doğrulayın` olarak ayarla.
7. Authentication > Email Templates > Reset password sablonuna `supabase/auth-email-templates/recovery.html` icerigini yapistir.
8. Reset subject alanini `AllonaHub şifre yenileme bağlantın` olarak ayarla.
9. Security notification > Password changed sablonuna `supabase/auth-email-templates/password-changed.html` icerigini yapistir.
10. Subject alanini `AllonaHub şifren güncellendi` olarak ayarla ve bildirimi etkinlestir.
11. Invite, Magic link, Change email address, Reauthentication ve Email address changed alanlarini ilgili `supabase/auth-email-templates/` dosyalariyla guncelle. Sonuncu guvenlik bildirimini etkinlestir.

Parolayi sohbet, commit veya komut gecmisine koyma. SMTP saglayicisinin kimlik bilgilerini yalnizca Supabase'in guvenli SMTP ayarlari ekranina gir. `destek@allonahub.com` gondericisinin alan adi SMTP saglayicisinda dogrulanmadiysa canli Auth ayarlarini degistirme. Mail sunucusu/portu ulasilabilir, SPF ve DKIM dogru, deneme mesaji gercek gelen kutusunda gorunur olmadan kurulum bitmis sayilmaz.

Kayit veya islem hatalarini her denemede otomatik e-postalamak kotuye kullanima ve gereksiz maliyete yol acar. Hata nedeni kullaniciya sitedeki AllonaHub bildirimiyle sunulur; hesap islemleri, talep alindi makbuzu ve yonetim uyarisinin e-postalari ayri, dogrulanmis sunucu akislariyla gonderilir. Bir formun yalnizca ekranda basarili gorunmesi e-posta teslimini kanitlamaz.

## Dogrulama

1. `https://allonahub.com/pages/account/user.html?tab=forgot` adresinden test kullanicisi icin sifre yenileme iste.
2. Gelen e-postada `From` adinin `AllonaHub` oldugunu kontrol et.
3. Linkin `https://allonahub.com/pages/account/reset-password.html` sayfasinda acildigini kontrol et.
4. Sifreyi degistirdikten sonra sifre degisti bildiriminin yine `AllonaHub` adiyla geldigini kontrol et.

Denizcilik kullanici/partner formlarindan yonetime giden bildirimler ayri bir akistir: `maritime_admin_email_outbox` tablosunda kuyruklanir, `RESEND_API_KEY` (veya `MARITIME_REFERENCE_RESEND_API_KEY`) ayarliysa `allonahub@gmail.com` adresine gonderilir. `sent` durumu e-posta saglayicisinin kabul ettigini gosterir, Gmail gelen kutusuna teslimi kanitlamaz. Gercek teslim icin saglayici logu ve Gmail gelen kutusu beraber kontrol edilmelidir. Bu bildirimler CV, pasaport, belge icerigi veya sifreyi e-postaya eklemez. Yeni bir modulun ayri transactional e-posta servisi olursa `ALLONAHUB_EMAIL_FROM` sozlesmesini kullanmali ve alan adinin o saglayicida dogrulandigini kontrol etmelidir.

Canliya alma sirasi: `20260925180000_maritime_admin_email_outbox.sql` migration'ini uygula; sunucuda dogrulanmis `destek@allonahub.com` gondericisi ve `RESEND_API_KEY` ayarla; backend'i yayinla. Gelen kutusuna teslimi test etmek icin bir deneme denizcilik talebi olustur, outbox `provider_message_id` alanini ve Gmail gelen kutusunu kontrol et. SMTP ayari ayri olarak Supabase Auth panelinde etkinlestirilmeden kayit/sifre e-postalarinin gondericisi degismez. Mevcut sikayet formu EmailJS uzerinden gonderilir; bu ayri hizmetin alici/gonderici ayari ve gercek teslimi de ayri test edilmelidir.

## Kaynaklar

- Supabase Email Templates: https://supabase.com/docs/guides/auth/auth-email-templates
- Supabase Custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase Management API: https://supabase.com/docs/reference/api/introduction
