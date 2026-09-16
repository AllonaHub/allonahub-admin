import { createHash } from "node:crypto";
import { config } from "../config.js";

function clean(value, maxLength = 300) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function escapeHtml(value) {
  return clean(value, 2000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeCodes(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => clean(item, 40).toUpperCase())
    .filter(Boolean))].slice(0, 30);
}

function stableReferencePayload({ publicId, candidateName, experience, cvSummary }) {
  return {
    public_id: clean(publicId, 40),
    candidate_name: clean(candidateName, 240),
    experience: {
      row_id: clean(experience?.rowId, 80),
      vessel: clean(experience?.vessel, 180),
      imo: clean(experience?.imo, 20),
      company: clean(experience?.company, 240),
      vessel_type: clean(experience?.type, 160),
      flag: clean(experience?.flag, 120),
      mmsi: clean(experience?.mmsi, 30),
      dwt: clean(experience?.dwt, 40),
      grt: clean(experience?.grt, 40),
      rank: clean(experience?.rank, 160),
      sign_on: clean(experience?.signon, 20),
      sign_off: clean(experience?.signoff, 20),
      reference_name: clean(experience?.referenceName, 200),
      reference_company_email: clean(experience?.referenceCompanyEmail, 320),
      reference_company_phone: clean(experience?.referenceCompanyPhone, 80),
      reference_phone: clean(experience?.referencePhone, 80),
      service_document_id: clean(experience?.serviceDocumentId, 80)
    },
    cv_summary: {
      current_position: clean(cvSummary?.current_position, 160),
      competency_class: clean(cvSummary?.competency_class, 160),
      competency_certificate: clean(cvSummary?.competency_certificate, 160),
      medical_expiry: clean(cvSummary?.medical_expiry, 20),
      certificate_codes: normalizeCodes(cvSummary?.certificate_codes)
    }
  };
}

export function maritimeReferenceFingerprint(input) {
  return createHash("sha256").update(JSON.stringify(stableReferencePayload(input))).digest("hex");
}

function row(label, value) {
  const content = clean(value, 1000) || "Belirtilmedi";
  return `<tr><th style="padding:8px 10px;text-align:left;border-bottom:1px solid #dbe7ef;color:#264653;width:38%">${escapeHtml(label)}</th><td style="padding:8px 10px;border-bottom:1px solid #dbe7ef;color:#102a43">${escapeHtml(content)}</td></tr>`;
}

export function buildMaritimeReferenceNotification(input) {
  const payload = stableReferencePayload(input);
  const exp = payload.experience;
  const summary = payload.cv_summary;
  const subject = `Referans doğrulaması gerekiyor · ${payload.public_id} · ${exp.vessel || exp.company || "Deniz hizmeti"}`.slice(0, 240);
  const rows = [
    row("Aday", payload.candidate_name),
    row("Allona ID", payload.public_id),
    row("Güncel pozisyon", summary.current_position),
    row("Gemi", exp.vessel),
    row("IMO", exp.imo),
    row("Şirket", exp.company),
    row("Gemi tipi / bayrak", [exp.vessel_type, exp.flag].filter(Boolean).join(" / ")),
    row("DWT / GRT", [exp.dwt && `DWT ${exp.dwt}`, exp.grt && `GRT ${exp.grt}`].filter(Boolean).join(" / ")),
    row("Görev", exp.rank),
    row("Hizmet tarihleri", [exp.sign_on, exp.sign_off].filter(Boolean).join(" - ")),
    row("Referans yetkilisi", exp.reference_name),
    row("Şirket e-postası", exp.reference_company_email),
    row("Şirket telefonu", exp.reference_company_phone),
    row("Yetkili telefonu", exp.reference_phone),
    row("Hizmet belgesi kaydı", exp.service_document_id),
    row("Yeterlilik", [summary.competency_class, summary.competency_certificate].filter(Boolean).join(" / ")),
    row("Temel sertifikalar", summary.certificate_codes.join(", ")),
    row("Sağlık belgesi bitişi", summary.medical_expiry)
  ].join("");
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f4f8fb;font-family:Arial,sans-serif;color:#102a43"><div style="max-width:720px;margin:0 auto;padding:24px"><div style="background:#062b3a;color:#fff;padding:20px;border-top:4px solid #00d9ff"><h1 style="margin:0 0 8px;font-size:22px">Referans doğrulaması gerekiyor</h1><p style="margin:0;color:#cdeffc">Bir denizci yeni deniz hizmeti ve referans kaydı oluşturdu.</p></div><div style="background:#fff;padding:18px"><table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table><p style="margin:18px 0 0;color:#526d7a;font-size:12px">Bu bildirim yalnız referans doğrulaması için gerekli sınırlı CV özetini içerir. Kimlik belgesi numarası, doğum tarihi ve adres gibi hassas alanlar e-postaya eklenmemiştir.</p></div></div></body></html>`;
  const text = [
    "REFERANS DOĞRULAMASI GEREKİYOR",
    `Aday: ${payload.candidate_name}`,
    `Allona ID: ${payload.public_id}`,
    `Güncel pozisyon: ${summary.current_position || "Belirtilmedi"}`,
    `Gemi: ${exp.vessel || "Belirtilmedi"}`,
    `IMO: ${exp.imo || "Belirtilmedi"}`,
    `Şirket: ${exp.company || "Belirtilmedi"}`,
    `Görev: ${exp.rank || "Belirtilmedi"}`,
    `Hizmet: ${exp.sign_on || "?"} - ${exp.sign_off || "?"}`,
    `Referans: ${exp.reference_name || "Belirtilmedi"}`,
    `Şirket e-postası: ${exp.reference_company_email || "Belirtilmedi"}`,
    `Şirket telefonu: ${exp.reference_company_phone || "Belirtilmedi"}`,
    `Yetkili telefonu: ${exp.reference_phone || "Belirtilmedi"}`,
    `Hizmet belgesi: ${exp.service_document_id || "Belirtilmedi"}`,
    `Sertifikalar: ${summary.certificate_codes.join(", ") || "Belirtilmedi"}`
  ].join("\n");
  return { payload, subject, html, text, fingerprint: maritimeReferenceFingerprint(input) };
}

function assertResult(result, message) {
  if (result?.error) throw new Error(message);
  return result?.data;
}

async function upsertEmploymentReferenceClaim({ supabase, record, userId, notification }) {
  const exp = notification.payload.experience;
  const imo = clean(exp.imo, 20).replace(/\D/g, "");
  const superseded = await supabase.from("maritime_employment_reference_claims").update({
    status: "withdrawn",
    metadata: {
      source: "maritime_cv_reference",
      limited_partner_disclosure: true,
      superseded_by_fingerprint: notification.fingerprint
    }
  })
    .eq("seafarer_user_id", userId)
    .eq("experience_id", exp.row_id)
    .neq("fingerprint", notification.fingerprint)
    .neq("status", "withdrawn");
  assertResult(superseded, "Superseded employment reference claims could not be closed");
  const claim = await supabase.from("maritime_employment_reference_claims").upsert({
    reference_request_id: record.id,
    seafarer_user_id: userId,
    experience_id: exp.row_id,
    fingerprint: notification.fingerprint,
    imo_number: imo,
    candidate_public_id: notification.payload.public_id,
    candidate_name: notification.payload.candidate_name,
    vessel_name: exp.vessel,
    source_company_name: exp.company || null,
    rank_name: exp.rank || null,
    service_start: exp.sign_on || null,
    service_end: exp.sign_off || null,
    service_document_id: exp.service_document_id || null,
    metadata: {
      source: "maritime_cv_reference",
      limited_partner_disclosure: true
    }
  }, { onConflict: "seafarer_user_id,experience_id,fingerprint" }).select("id,status").single();
  return assertResult(claim, "Employment reference claim could not be stored");
}

async function sendWithResend(record, notification) {
  const settings = config.maritimeReferenceNotifications;
  if (!settings.enabled) return { status: "queued", error: "NOTIFICATIONS_DISABLED" };
  if (!settings.resendApiKey) return { status: "queued", error: "RESEND_NOT_CONFIGURED" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, settings.timeoutMs));
  try {
    const response = await fetch(settings.resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `maritime-reference/${record.id}`
      },
      body: JSON.stringify({
        from: settings.sender,
        to: [settings.recipient],
        subject: notification.subject,
        html: notification.html,
        text: notification.text
      }),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.id) {
      return { status: "failed", error: clean(body?.message || `RESEND_HTTP_${response.status}`, 500) };
    }
    return { status: "sent", providerMessageId: clean(body.id, 180) };
  } catch (error) {
    return { status: "failed", error: clean(error?.name === "AbortError" ? "RESEND_TIMEOUT" : error?.message, 500) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function queueMaritimeReferenceNotification({ supabase, userId, publicId, candidateName, experience, cvSummary }) {
  const notification = buildMaritimeReferenceNotification({ publicId, candidateName, experience, cvSummary });
  const recipient = clean(config.maritimeReferenceNotifications.recipient, 320);
  const match = await supabase
    .from("maritime_reference_verification_requests")
    .select("id,status,attempts,provider_message_id")
    .eq("seafarer_user_id", userId)
    .eq("experience_id", experience.rowId)
    .eq("fingerprint", notification.fingerprint)
    .maybeSingle();
  const existing = assertResult(match, "Reference notification lookup failed");

  let record = existing;
  if (!record) {
    const inserted = await supabase.from("maritime_reference_verification_requests").insert({
      seafarer_user_id: userId,
      experience_id: experience.rowId,
      public_id: clean(publicId, 40),
      candidate_name: clean(candidateName, 240),
      status: "queued",
      fingerprint: notification.fingerprint,
      email_to: recipient,
      subject: notification.subject,
      payload: notification.payload,
      provider: "resend"
    }).select("id,status,attempts,provider_message_id").single();
    if (inserted.error?.code === "23505") {
      const concurrent = await supabase
        .from("maritime_reference_verification_requests")
        .select("id,status,attempts,provider_message_id")
        .eq("seafarer_user_id", userId)
        .eq("experience_id", experience.rowId)
        .eq("fingerprint", notification.fingerprint)
        .single();
      record = assertResult(concurrent, "Concurrent reference notification could not be read");
    } else {
      record = assertResult(inserted, "Reference notification could not be queued");
    }
  }

  const claim = await upsertEmploymentReferenceClaim({ supabase, record, userId, notification });
  if (record?.status === "sent") {
    return { request_id: record.id, claim_id: claim.id, status: "sent", idempotent: true };
  }

  const attempts = Number(record.attempts || 0) + 1;
  assertResult(await supabase.from("maritime_reference_verification_requests").update({
    status: "sending",
    attempts,
    last_attempt_at: new Date().toISOString(),
    last_error: null
  }).eq("id", record.id), "Reference notification state could not be updated");

  const delivery = await sendWithResend(record, notification);
  const update = {
    status: delivery.status,
    provider_message_id: delivery.providerMessageId || null,
    last_error: delivery.error || null,
    sent_at: delivery.status === "sent" ? new Date().toISOString() : null
  };
  assertResult(await supabase.from("maritime_reference_verification_requests").update(update).eq("id", record.id), "Reference notification result could not be saved");
  return {
    request_id: record.id,
    claim_id: claim.id,
    status: delivery.status,
    idempotent: false,
    configured: Boolean(config.maritimeReferenceNotifications.resendApiKey)
  };
}
