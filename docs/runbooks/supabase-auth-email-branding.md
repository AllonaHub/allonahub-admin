# Supabase Auth Email Branding

Son guncelleme: 20.09.2026

Bu runbook, Supabase Auth tarafindan gonderilen kayit dogrulama, sifre yenileme ve sifre degisti bildirimlerinin AllonaHub adiyla cikmasi icindir.

## Hedef ayar

- Sender name: `AllonaHub`
- From address: `destek@allonahub.com` veya SMTP servisinde dogrulanmis `no-reply@allonahub.com`
- Confirmation subject: `AllonaHub ekosistemine hoş geldiniz - e-postanızı doğrulayın`
- Reset subject: `AllonaHub şifre yenileme bağlantın`
- Password changed subject: `AllonaHub şifren güncellendi`
- Reset redirect: `https://allonahub.com/pages/account/reset-password.html`

Supabase'in varsayilan SMTP servisi uretim icin tasarlanmamistir ve gonderen kimligi Supabase olarak gorunebilir. Bu nedenle canli ortamda custom SMTP kullanilmalidir.

## Management API ile uygulama

1. Supabase Dashboard > Account > Access Tokens alanindan token al.
2. Proje ref degeri: `xqvikrysciguzholdjeb`.
3. SMTP servisinde `allonahub.com` icin SPF, DKIM ve DMARC kayitlarinin dogrulandigindan emin ol.
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

## Dogrulama

1. `https://allonahub.com/pages/account/user.html?tab=forgot` adresinden test kullanicisi icin sifre yenileme iste.
2. Gelen e-postada `From` adinin `AllonaHub` oldugunu kontrol et.
3. Linkin `https://allonahub.com/pages/account/reset-password.html` sayfasinda acildigini kontrol et.
4. Sifreyi degistirdikten sonra sifre degisti bildiriminin yine `AllonaHub` adiyla geldigini kontrol et.

## Kaynaklar

- Supabase Email Templates: https://supabase.com/docs/guides/auth/auth-email-templates
- Supabase Custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase Management API: https://supabase.com/docs/reference/api/introduction
