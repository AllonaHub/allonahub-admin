import { config } from "../config.js";
import { renderAllonaHubEmail } from "./allonahub-email-template.js";

const settings = config.maritimeReferenceNotifications;
const jobUrl = (id) => `https://allonahub.com/pages/ecosystem/maritime-jobs.html?job=${encodeURIComponent(id)}`;

export async function deliverMaritimeJobEmailAlert({ supabase, id, send = fetch }) {
  if (!settings.enabled || !settings.resendApiKey) return "unconfigured";
  const { data, error } = await supabase.rpc("claim_maritime_job_email_alert", { p_id: id });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return "skipped";
  const url = jobUrl(row.job_id);
  let result;
  try {
    const response = await send(settings.resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `maritime-job-alert/${row.id}`
      },
      body: JSON.stringify({
        from: settings.sender,
        to: [row.recipient],
        subject: `AllonaHub Denizcilik: ${row.title}`,
        text: `Rütbenize uygun yeni bir ilan yayımlandı.\n\n${row.title}\n${row.summary}\n\nİlanı görüntüleyin: ${url}\n\nYeni ilan e-postalarını hesabınızda Müsaitlik durumunuzu değiştirerek durdurabilirsiniz.`,
        html: renderAllonaHubEmail({
          title: "Rütbenize uygun yeni ilan",
          eyebrow: "ALLONAHUB DENİZCİLİK",
          message: row.title,
          lines: [row.summary, "Başvurmadan önce ilanın koşullarını inceleyin."],
          action: "İlanı Gör ve Başvur",
          actionUrl: url
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
  const { error: updateError } = await supabase.from("maritime_job_email_alerts")
    .update({ ...result, lease_until: null, next_attempt_at: new Date(Date.now() + 2 * 60000).toISOString() })
    .eq("id", id).eq("status", "sending");
  if (updateError) throw updateError;
  return result.status;
}

export async function deliverDueMaritimeJobEmailAlerts({ supabase, limit = 20, send = fetch }) {
  if (!settings.enabled || !settings.resendApiKey) return { checked: 0, unconfigured: true };
  const { data, error } = await supabase.from("maritime_job_email_alerts")
    .select("id").in("status", ["queued", "failed", "sending"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true }).limit(Math.max(1, Math.min(50, limit)));
  if (error) throw error;
  const results = [];
  for (const row of data || []) results.push(await deliverMaritimeJobEmailAlert({ supabase, id: row.id, send }));
  return { checked: results.length, sent: results.filter((item) => item === "sent").length };
}
