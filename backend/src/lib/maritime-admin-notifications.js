import { config } from "../config.js";
import { renderAllonaHubEmail } from "./allonahub-email-template.js";

const TITLES = Object.freeze({
  "maritime.partner_application.created": "Yeni denizcilik partner başvurusu",
  "maritime.freight_request.created": "Yeni deniz taşımacılığı talebi",
  "maritime.freight_offer.submitted": "Yeni deniz taşımacılığı teklifi",
  "maritime.partner_listing.submitted": "Yeni denizcilik ilanı",
  "maritime.manual_application_submitted": "Yeni denizci başvurusu",
  "maritime.application_submitted_by_candidate": "Yeni denizci başvurusu",
  "maripartner.job_submitted": "Yeni personel ilanı",
  "maripartner.job_batch_submitted": "Toplu personel ilanı",
  "maripartner.urgent_crew_created": "Acil mürettebat talebi",
  "maripartner.evidence_requested": "Aday belge erişim talebi",
  "maripartner.refresh_created": "Aday bilgi güncelleme talebi",
  "maripartner.candidate_invited": "Adaya iş daveti",
  "maripartner.vessel_submitted": "Gemi kaydı başvurusu",
  "maripartner.trust_appeal_submitted": "Denizcilik itiraz başvurusu",
  "maripartner.employer_reference_submitted": "İşveren referansı",
  "maripartner.joining_created": "Yeni yerleştirme talebi",
  "maripartner.joining_updated": "Yerleştirme talebi güncellendi"
});

export function maritimeAdminNotificationForAudit({ action, resourceType, resourceId, actorId, metadata = {}, requestId }) {
  const title = TITLES[action];
  if (!title || !resourceId) return null;
  if (action.startsWith("maripartner.joining_") && !Array.isArray(metadata.requested_services)) return null;
  if (action.startsWith("maripartner.joining_") && metadata.requested_services.length === 0) return null;
  const lines = [
    title,
    `İşlem: ${action}`,
    `Kayıt: ${resourceType || "maritime"} / ${resourceId}`,
    actorId ? `İşlemi yapan hesap: ${actorId}` : ""
  ];
  if (Array.isArray(metadata.requested_services) && metadata.requested_services.length) {
    lines.push(`Talep edilen hizmetler: ${metadata.requested_services.filter((value) => ["flight", "hotel", "transfer"].includes(value)).join(", ")}`);
  }
  if (metadata.partner_id) lines.push(`Şirket kaydı: ${metadata.partner_id}`);
  lines.push("Detayları yetkili yönetim panelinden inceleyin. Bu e-posta onay veya rezervasyon anlamına gelmez.");
  return {
    event_key: [action, resourceId, requestId || "once"].join(":"),
    event_type: action,
    resource_type: resourceType || null,
    resource_id: resourceId,
    actor_id: actorId || null,
    recipient: config.maritimeAdminNotifications.recipient,
    subject: `[AllonaHub Denizcilik] ${title}`,
    body_text: lines.filter(Boolean).join("\n")
  };
}

async function deliverOne(supabase, id, send = fetch) {
  const settings = config.maritimeAdminNotifications;
  if (!settings.enabled || !settings.resendApiKey) return "queued";
  const { data: claimed, error: claimError } = await supabase.rpc("claim_maritime_admin_email", { p_id: id });
  if (claimError) throw claimError;
  const row = claimed?.[0];
  if (!row) return "skipped";
  let delivery;
  try {
    const response = await send(settings.resendApiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.resendApiKey}`, "Content-Type": "application/json", "Idempotency-Key": `maritime-admin/${row.id}` },
      body: JSON.stringify({
        from: settings.sender, to: [row.recipient], subject: row.subject, text: row.body_text,
        html: renderAllonaHubEmail({
          eyebrow: "DENİZCİLİK YÖNETİM BİLDİRİMİ",
          title: row.subject.replace(/^\[AllonaHub Denizcilik\]\s*/, ""),
          message: "Yeni bir işlem kaydedildi. Ayrıntıları yetkili yönetim panelinden inceleyin.",
          lines: row.body_text.split("\n").slice(1)
        })
      }),
      signal: AbortSignal.timeout(Math.max(1000, settings.timeoutMs))
    });
    const body = await response.json().catch(() => ({}));
    delivery = response.ok && body?.id ? { status: "sent", provider_message_id: String(body.id).slice(0,180) } : { status: "failed", last_error: `EMAIL_PROVIDER_HTTP_${response.status}` };
  } catch (error) {
    delivery = { status: "failed", last_error: error?.name === "TimeoutError" ? "EMAIL_PROVIDER_TIMEOUT" : "EMAIL_PROVIDER_UNAVAILABLE" };
  }
  const delayMinutes = Math.min(60, 2 ** Math.min(row.attempts, 6));
  const { error: updateError } = await supabase.from("maritime_admin_email_outbox").update({
    ...delivery, lease_until: null,
    next_attempt_at: new Date(Date.now() + delayMinutes * 60000).toISOString(),
    sent_at: delivery.status === "sent" ? new Date().toISOString() : null
  }).eq("id", id).eq("status", "sending");
  if (updateError) throw updateError;
  return delivery.status;
}

export async function queueMaritimeAdminNotification({ supabase, event, send = fetch }) {
  if (!event) return "skipped";
  const { data, error } = await supabase.from("maritime_admin_email_outbox")
    .upsert(event, { onConflict: "event_key", ignoreDuplicates: true }).select("id,status");
  if (error) throw error;
  let row = data?.[0];
  if (!row) {
    const lookup = await supabase.from("maritime_admin_email_outbox").select("id,status").eq("event_key", event.event_key).single();
    if (lookup.error) throw lookup.error;
    row = lookup.data;
  }
  if (row.status === "sent") return "sent";
  return deliverOne(supabase, row.id, send);
}

export async function deliverDueMaritimeAdminNotifications({ supabase, limit = 20, send = fetch }) {
  const { data, error } = await supabase.from("maritime_admin_email_outbox")
    .select("id").in("status", ["queued", "failed", "sending"])
    .lte("next_attempt_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(Math.max(1, Math.min(50, limit)));
  if (error) throw error;
  const results = [];
  for (const row of data || []) results.push(await deliverOne(supabase, row.id, send));
  return { checked: results.length, sent: results.filter((value) => value === "sent").length, queued: results.filter((value) => value === "queued").length, failed: results.filter((value) => value === "failed").length };
}
