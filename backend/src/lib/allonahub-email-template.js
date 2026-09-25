const BRAND = "AllonaHub";
const SOCIAL_LINKS = [
  ["WhatsApp", "whatsapp", "https://wa.me/905427781868"],
  ["Instagram", "instagram", "https://www.instagram.com/allonahub"],
  ["X", "x", "https://x.com/allonahub"],
  ["YouTube", "youtube", "https://www.youtube.com/@allonahub"],
  ["Nsosyal", "nsosyal", "https://nsosyal.com/allonahub"],
  ["TikTok", "tiktok", "https://www.tiktok.com/@allonahub"]
];

export function renderAllonaHubSocialFooter() {
  return `<div style="border-top:2px solid #10bde8;padding-top:15px;margin-top:24px;text-align:center"><p style="margin:0 0 12px;color:#496176;font-size:12px">AllonaHub sosyal hesapları</p>${SOCIAL_LINKS.map(([label, asset, url]) => `<a href="${url}" aria-label="${label}" title="${label}" style="display:inline-block;margin:0 3px 7px;text-decoration:none"><img src="https://allonahub.com/images/email/social/${asset}.png" alt="${label}" width="32" height="32" style="display:block;width:32px;height:32px;border:0;border-radius:6px"></a>`).join("")}</div>`;
}

export function escapeEmailHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

export function renderAllonaHubEmail({ variant = "notification", eyebrow, title, message, lines = [], details = [], action, actionUrl }) {
  const safeVariant = ["welcome", "security", "notification"].includes(variant) ? variant : "notification";
  const motion = `https://allonahub.com/images/email/allonahub-${safeVariant}.gif`;
  const safeUrl = typeof actionUrl === "string" && /^https:\/\//i.test(actionUrl) ? escapeEmailHtml(actionUrl) : "";
  const lineHtml = lines.filter(Boolean).map((line) => `<p style="margin:0 0 8px;color:#29475d;font-size:14px;line-height:1.6">${escapeEmailHtml(line)}</p>`).join("");
  const detailHtml = details.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">${details.map(([label, value]) => `<tr><th style="padding:8px 10px;text-align:left;border-bottom:1px solid #dbe7ef;color:#264653;width:38%">${escapeEmailHtml(label)}</th><td style="padding:8px 10px;border-bottom:1px solid #dbe7ef;color:#102a43">${escapeEmailHtml(value || "Belirtilmedi")}</td></tr>`).join("")}</table>` : "";
  const actionHtml = safeUrl && action ? `<p style="margin:24px 0 0"><a href="${safeUrl}" style="display:inline-block;background:#087cf0;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:6px">${escapeEmailHtml(action)}</a></p>` : "";
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeEmailHtml(title || BRAND)}</title></head><body style="margin:0;background:#edf5f9;color:#102d43;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeEmailHtml(message || title)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#edf5f9"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #bfdce8"><tr><td style="background:#08243d;border-bottom:3px solid #3fd6f7"><img src="${motion}" alt="" width="600" height="200" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr><tr><td style="background:#08243d;padding:16px 30px 22px;color:#ffffff"><p style="margin:0 0 12px;color:#e8c26b;font-size:13px;font-weight:700">${BRAND}</p><p style="margin:0 0 8px;color:#a5eaff;font-size:12px;font-weight:700">${escapeEmailHtml(eyebrow || "ALLONAHUB BİLDİRİMİ")}</p><h1 style="margin:0;color:#ffffff;font-size:26px;line-height:1.25">${escapeEmailHtml(title || BRAND)}</h1></td></tr><tr><td style="padding:26px 30px 30px"><p style="margin:0 0 20px;color:#29475d;font-size:16px;line-height:1.65">${escapeEmailHtml(message)}</p>${detailHtml}${lineHtml}${actionHtml}${renderAllonaHubSocialFooter()}</td></tr><tr><td style="padding:16px 30px;background:#f5fafc;border-top:1px solid #d8e7ee;color:#557084;font-size:12px;line-height:1.5">${BRAND} ekosistemi · Bu e-postaya şifre veya doğrulama kodu yanıtlamayın.</td></tr></table></td></tr></table></body></html>`;
}
