(function () {
  const App = window.Allona = window.Allona || {};
  const STATUS = {
    DRAFT: ["Taslak", "warning"], QUEUED: ["Kuyrukta", "warning"], PROCESSING: ["İşleniyor", "warning"],
    ISSUED: ["Oluşturuldu", "success"], SENT: ["Kanala gönderildi", "success"], ACCEPTED: ["Kabul edildi", "success"],
    REJECTED: ["Reddedildi", "danger"], CANCEL_PENDING: ["İptal bekliyor", "warning"], CANCELLED: ["İptal edildi", "danger"],
    RETURNED: ["İade edildi", "warning"], FAILED: ["Hatalı", "danger"], NEEDS_REVIEW: ["İnceleme gerekli", "warning"],
    PENDING: ["Bekliyor", "warning"], RETRY_SCHEDULED: ["Yeniden denenecek", "warning"], SUCCEEDED: ["Başarılı", "success"],
    COMPLETED: ["Tamamlandı", "success"], OPEN: ["Açık", "warning"], MATCHED: ["Eşleşti", "success"], MISMATCH: ["Fark var", "danger"]
  };
  const CAPABILITIES = [
    ["orders", "SP", "Sipariş senkronizasyonu"], ["returns", "İA", "İade senkronizasyonu"],
    ["cancellations", "İP", "İptal senkronizasyonu"], ["invoiceUpload", "FY", "Fatura dosyası yükleme"],
    ["invoiceMetadata", "FM", "Fatura metadata gönderimi"], ["products", "ÜR", "Ürün senkronizasyonu"],
    ["inventory", "ST", "Stok senkronizasyonu"], ["prices", "Fİ", "Fiyat senkronizasyonu"]
  ];

  function escape(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }
  function apiBase() { return String(App.config?.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, ""); }
  async function token() {
    const session = App.auth?.getSession ? await App.auth.getSession() : null;
    if (!session?.access_token) throw new Error("Oturum doğrulanamadı.");
    return session.access_token;
  }
  async function request(path, options = {}) {
    const headers = { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}), Authorization: `Bearer ${await token()}` };
    const response = await fetch(`${apiBase()}${path}`, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || "İşlem tamamlanamadı.");
      error.status = response.status;
      error.code = payload.error || "REQUEST_FAILED";
      throw error;
    }
    return payload;
  }
  async function download(path, filename) {
    const response = await fetch(`${apiBase()}${path}`, { headers: { Authorization: `Bearer ${await token()}`, Accept: "text/csv" } });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || "Dosya indirilemedi.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function signedUrl(value) {
    let parsed;
    try { parsed = new URL(String(value || ""), window.location.href); } catch (_) { throw new Error("Güvenli belge bağlantısı geçersiz."); }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Güvenli belge bağlantısı geçersiz.");
    return parsed.href;
  }
  function openSignedUrl(value) {
    const anchor = document.createElement("a");
    anchor.href = signedUrl(value);
    anchor.rel = "noopener noreferrer";
    anchor.target = "_self";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
  async function downloadSignedUrl(value, filename) {
    const response = await fetch(signedUrl(value), { credentials: "omit" });
    if (!response.ok) throw new Error("Güvenli belge indirilemedi.");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = String(filename || "fatura-belgesi").replace(/[^A-Za-z0-9._-]+/g, "-");
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  function exactMoney(value, currency = "TRY") {
    const input = String(value ?? "0").trim();
    const match = input.match(/^(-?)(\d+)(?:\.(\d+))?$/);
    if (!match) return `${escape(input || "0")} ${escape(currency)}`;
    const grouped = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const fraction = (match[3] || "").padEnd(2, "0").slice(0, 4).replace(/0+$/, "").padEnd(2, "0");
    return `${match[1]}${grouped},${fraction} ${escape(currency)}`;
  }
  function badge(status) {
    const normalized = String(status || "-").toUpperCase();
    const [label, tone] = STATUS[normalized] || [normalized.replace(/_/g, " "), ""];
    return `<span class="edoc-badge ${tone ? `is-${tone}` : ""}">${escape(label)}</span>`;
  }
  function empty(title, message, action = "") {
    return `<div class="edoc-empty"><strong>${escape(title)}</strong><p>${escape(message)}</p>${action}</div>`;
  }
  function loading(label = "Veriler yükleniyor…") { return `<div class="edoc-loading"><span></span><span></span><span></span><p>${escape(label)}</p></div>`; }
  function capabilityLegend() { return `<div class="edoc-cap-legend"><span aria-hidden="true"></span>${CAPABILITIES.map(([, short, label]) => `<span title="${escape(label)}" aria-label="${escape(label)}">${escape(short)}</span>`).join("")}</div>`; }
  function capabilityRow(item) {
    const capabilities = item.capabilities || {};
    return `<div class="edoc-channel"><strong>${escape(item.displayName || item.account_name || item.providerKey)}</strong>${CAPABILITIES.map(([key, , label]) => {
      const supported = capabilities[key] === true;
      const accessible = `${label}: ${supported ? "destekleniyor" : "desteklenmiyor"}`;
      return `<span class="edoc-cap ${supported ? "is-on" : ""}" role="img" aria-label="${escape(accessible)}" title="${escape(accessible)}">${supported ? "✓" : "–"}</span>`;
    }).join("")}</div>`;
  }
  function query(params) {
    const result = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== "") result.set(key, value); });
    return result.toString();
  }

  App.eDonusum = { escape, request, download, openSignedUrl, downloadSignedUrl, exactMoney, badge, empty, loading, capabilityLegend, capabilityRow, query, statuses: STATUS, capabilities: CAPABILITIES };
})();
