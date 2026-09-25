import { config } from "../config.js";
import { renderAllonaHubEmail } from "./allonahub-email-template.js";

const settings = config.maritimeReferenceNotifications;
const accountUrl = "https://allonahub.com/pages/account/user.html";

export const welcomeGuide = Object.freeze({
  subject: "AllonaHub'a Başlangıç Rehberi: Hesabınızı Tamamlayın",
  title: "AllonaHub'a nasıl başlarsınız?",
  introduction: "Hesabınız doğrulandı. Aşağıdaki kısa adımlarla profilinizi hazırlayabilir ve size uygun fırsatları takip edebilirsiniz.",
  steps: [
    "1. Hesabınıza giriş yapın ve adınızı, iletişim bilgilerinizi kontrol edin. Güvenlik için şifrenizi ve doğrulama kodunuzu kimseyle paylaşmayın.",
    "2. Denizcilikte çalışıyorsanız Maritime CV alanını açın. Rütbenizi, deniz hizmetinizi, sertifikalarınızı ve geçerlilik tarihlerini belgelerinizdeki gibi doğru yazın; kaydedip tekrar kontrol edin.",
    "3. Belgelerim alanına ilgili evrakları ekleyin. Güncel ve okunaklı belgeler, firmaların başvurunuzu değerlendirmesini kolaylaştırır. Belgelerinizi değiştirdiğinizde CV'nizi de güncelleyin.",
    "4. İş arıyorsanız müsaitlik durumunuzu 'Şimdi İşe Hazırım' olarak seçin. Kayıtlı CV rütbenize uygun yeni ilanları e-postayla bildirebiliriz. Gemideyim veya Müsait değilim seçimi bu e-postaları durdurur.",
    "5. İş ilanının koşullarını inceleyin. Başvururken bilgilerinizin ve belgelerinizin ilgili firmayla paylaşılmasına ayrıca onay verip vermeyeceğinizi seçin. Başvurunuzun durumunu hesabınızdan takip edin."
  ],
  closing: "Doğru ve güncel bilgiler sizi doğru ilanlarla buluşturur; işe kabul veya öncelik garantisi vermez. Yardım gerektiğinde AllonaHub destek ekibine ulaşın."
});

export async function deliverAllonaHubWelcomeGuide({ supabase, userId, send = fetch }) {
  if (!settings.enabled || !settings.resendApiKey) return "unconfigured";
  const { data, error } = await supabase.rpc("claim_allonahub_welcome_guide", { p_user_id: userId });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return "skipped";
  let result;
  try {
    const response = await send(settings.resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `allonahub-welcome-guide/${row.user_id}`
      },
      body: JSON.stringify({
        from: settings.sender,
        to: [row.recipient],
        subject: welcomeGuide.subject,
        text: [welcomeGuide.introduction, ...welcomeGuide.steps, welcomeGuide.closing, `Hesabımı aç: ${accountUrl}`].join("\n\n"),
        html: renderAllonaHubEmail({
          variant: "welcome",
          eyebrow: "HESABINIZ İÇİN BAŞLANGIÇ REHBERİ",
          title: welcomeGuide.title,
          message: welcomeGuide.introduction,
          lines: [...welcomeGuide.steps, welcomeGuide.closing],
          action: "Hesabımı Aç",
          actionUrl: accountUrl
        })
      }),
      signal: AbortSignal.timeout(Math.max(1000, settings.timeoutMs))
    });
    const body = await response.json().catch(() => ({}));
    result = response.ok && body?.id
      ? { status: "sent", provider_message_id: String(body.id).slice(0, 180), sent_at: new Date().toISOString(), last_error: null }
      : { status: "failed", last_error: `EMAIL_PROVIDER_HTTP_${response.status}` };
  } catch (error) {
    result = { status: "failed", last_error: error?.name === "TimeoutError" ? "EMAIL_PROVIDER_TIMEOUT" : "EMAIL_PROVIDER_UNAVAILABLE" };
  }
  const { error: updateError } = await supabase.from("allonahub_welcome_guide_emails")
    .update({ ...result, lease_until: null, next_attempt_at: new Date(Date.now() + 2 * 60000).toISOString() })
    .eq("user_id", userId).eq("status", "sending");
  if (updateError) throw updateError;
  return result.status;
}

export async function deliverDueAllonaHubWelcomeGuides({ supabase, limit = 20, send = fetch }) {
  if (!settings.enabled || !settings.resendApiKey) return { checked: 0, unconfigured: true };
  const { data, error } = await supabase.from("allonahub_welcome_guide_emails")
    .select("user_id").in("status", ["queued", "failed", "sending"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true }).limit(Math.max(1, Math.min(50, limit)));
  if (error) throw error;
  const results = [];
  for (const row of data || []) results.push(await deliverAllonaHubWelcomeGuide({ supabase, userId: row.user_id, send }));
  return { checked: results.length, sent: results.filter((item) => item === "sent").length };
}
