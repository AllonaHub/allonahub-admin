(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core || {};
  const config = App.config || {};

  const state = {
    products: [],
    summary: {},
    warnings: [],
    selected: new Set(),
    searchTimer: null
  };

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return [...(root || document).querySelectorAll(selector)];
  }

  function escape(value) {
    return core.escapeHTML ? core.escapeHTML(value ?? "") : String(value ?? "");
  }

  function money(value) {
    if (core.money) return core.money(Number(value || 0));
    return Number(value || 0).toLocaleString(config.locale || "tr-TR", { style: "currency", currency: config.currency || "TRY" });
  }

  function normalizeProduct(raw) {
    return core.normalizeProduct ? core.normalizeProduct(raw || {}) : (raw || {});
  }

  function shortText(value, max) {
    const text = String(value || "").trim();
    if (text.length <= max) return text || "-";
    return `${text.slice(0, Math.max(0, max - 1))}…`;
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  }

  function dateTime(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString(config.locale || "tr-TR");
    } catch {
      return "-";
    }
  }

  function loginUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    return core.url ? core.url(`/admin/admin-login.html?returnTo=${returnTo}`) : `/admin/admin-login.html?returnTo=${returnTo}`;
  }

  function mfaUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    return core.url ? core.url(`/pages/account/mfa.html?returnTo=${returnTo}`) : `/pages/account/mfa.html?returnTo=${returnTo}`;
  }

  function showToast(message, type) {
    let wrap = $(".admin-toast");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "admin-toast";
      document.body.appendChild(wrap);
    }
    const item = document.createElement("div");
    item.className = `admin-toast__item ${type === "error" ? "admin-toast__item--error" : ""}`;
    item.textContent = message;
    wrap.appendChild(item);
    setTimeout(() => item.remove(), 3800);
  }

  function showAlert(message, type) {
    const target = $("[data-product-review-alert]");
    if (!target) return;
    const text = String(message || "").trim();
    target.hidden = !text;
    target.classList.toggle("is-error", type === "error");
    target.textContent = text;
  }

  function readableError(error) {
    const message = String(error?.message || "").trim();
    if (/load failed|failed to fetch|networkerror|network request failed|cancelled/i.test(message)) {
      return "API bağlantısı kurulamadı. Lütfen Cloudflare/API erişimini ve oturum tokenını kontrol edip sayfayı yenileyin.";
    }
    return message || "Ürün onay verisi yüklenemedi.";
  }

  async function sessionToken() {
    if (!App.auth || !App.auth.getSession) throw new Error("Oturum sistemi yüklenemedi.");
    const session = await App.auth.getSession();
    if (!session?.access_token) {
      window.location.href = loginUrl();
      return "";
    }
    return session.access_token;
  }

  async function refreshSessionToken() {
    if (!App.supabase?.auth?.refreshSession) return "";
    try {
      const { data, error } = await App.supabase.auth.refreshSession();
      if (error || !data?.session?.access_token) return "";
      return data.session.access_token;
    } catch {
      return "";
    }
  }

  function redirectToLoginSoon() {
    window.setTimeout(() => {
      window.location.href = loginUrl();
    }, 500);
  }

  async function fetchApi(path, options, token) {
    return fetch(`${config.apiBaseUrl}${path}`, {
      method: options?.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      credentials: "omit"
    });
  }

  async function api(path, options) {
    const token = await sessionToken();
    if (!token) return null;
    let response;
    try {
      response = await fetchApi(path, options, token);
      if (response.status === 401) {
        const refreshedToken = await refreshSessionToken();
        if (refreshedToken && refreshedToken !== token) {
          response = await fetchApi(path, options, refreshedToken);
        }
      }
    } catch (error) {
      console.error("[AdminProductReviews] API fetch failed", path, error);
      const wrapped = new Error(readableError(error));
      wrapped.network = true;
      wrapped.apiPath = path;
      wrapped.cause = error;
      throw wrapped;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.message || payload.error || `API isteği tamamlanamadı. HTTP ${response.status}`;
      if (response.status === 401) {
        redirectToLoginSoon();
        throw new Error("Oturum süresi doldu veya doğrulanamadı. Giriş sayfasına yönlendiriliyorsunuz.");
      }
      if (response.status === 403 && /mfa|iki aşamalı|2fa|aal2/i.test(message)) {
        window.location.href = mfaUrl();
        throw new Error("İki aşamalı doğrulama gerekli.");
      }
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      error.apiPath = path;
      throw error;
    }
    return payload;
  }

  function automation(product) {
    return product.review_automation || {
      lane: "ready",
      risk_level: "clear",
      score: 0,
      auto_approvable: true,
      revision_required: false,
      reasons: []
    };
  }

  function productById(productId) {
    return state.products.find((product) => String(product.id) === String(productId));
  }

  function reviewStatusLabel(value) {
    const labels = {
      active: "Yayında",
      draft: "Taslak",
      pending: "Onay bekliyor",
      review: "İncelemede",
      in_review: "İncelemede",
      approved: "Onaylandı",
      rejected: "Reddedildi",
      needs_review: "Revizyon istendi",
      archived: "Arşiv"
    };
    return labels[normalizeStatus(value)] || value || "Onay bekliyor";
  }

  function laneLabel(value) {
    const labels = {
      ready: "Onaya hazır",
      watch: "Kontrol et",
      needs_revision: "Revizyon riski"
    };
    return labels[normalizeStatus(value)] || value || "Onaya hazır";
  }

  function riskTone(auto) {
    if (auto.revision_required || auto.risk_level === "critical" || auto.lane === "needs_revision") return "risk";
    if (auto.risk_level === "warning" || auto.lane === "watch") return "watch";
    return "ready";
  }

  function isRevisedProduct(raw) {
    const review = normalizeStatus(raw.compliance_review_status || raw.review_status || raw.approval_status);
    const notes = String(raw.compliance_notes || "").toLocaleLowerCase("tr-TR");
    return review === "pending" && /revizyon|revision|düzelt|duzelt/.test(notes);
  }

  function metricMarkup(label, value, tone) {
    return `
      <article class="admin-product-review-metric" ${tone ? `data-tone="${escape(tone)}"` : ""}>
        <span>${escape(label)}</span>
        <strong>${escape(value ?? 0)}</strong>
      </article>
    `;
  }

  function renderSummary() {
    const summary = state.summary || {};
    const rows = [
      ["Toplam Kuyruk", summary.total || state.products.length, ""],
      ["Onaya Hazır", summary.ready || 0, "ready"],
      ["Kontrol Edilecek", summary.watch || 0, "watch"],
      ["Revizyon Riski", summary.needs_revision || 0, "risk"],
      ["Kritik Risk", summary.critical || 0, "risk"],
      ["Revizeden Gelen", summary.revised || 0, "watch"]
    ];
    const target = $("[data-product-review-summary]");
    if (target) target.innerHTML = rows.map(([label, value, tone]) => metricMarkup(label, value, tone)).join("");
  }

  function renderSelectedState() {
    const label = $("[data-selected-count]");
    if (label) label.textContent = `${state.selected.size} ürün seçildi`;
    $all("[data-product-select]").forEach((input) => {
      input.checked = state.selected.has(String(input.value));
    });
  }

  function reasonMarkup(reason) {
    return `
      <div class="admin-product-review-reason" data-severity="${escape(reason.severity || "info")}">
        <strong>${escape(reason.field_label || reason.field || "Alan")} · ${escape(reason.title || "Kontrol")}</strong>
        <span>${escape(reason.message || "")}</span>
        <small>${escape(reason.suggestion || "")}</small>
      </div>
    `;
  }

  function reasonsMarkup(auto) {
    const reasons = auto.reasons || [];
    if (!reasons.length) {
      return `
        <div class="admin-product-review-reason" data-severity="info">
          <strong>Risk bulunmadı</strong>
          <span>Otomasyon ürün içeriğinde revizyon gerektiren politika/hukuk riski görmedi.</span>
        </div>
      `;
    }
    return reasons.map(reasonMarkup).join("");
  }

  function detailsMarkup(raw, product) {
    const rows = [
      ["Ürün ID", product.id],
      ["Kategori", product.category],
      ["Modül", product.module_key || raw.catalog_scope || "shop"],
      ["Marka/SKU", [product.brand, product.sku].filter(Boolean).join(" / ") || "-"],
      ["Satıcı", product.seller_public_name || product.seller_name || "-"],
      ["Ticari unvan", product.seller_legal_name || "-"],
      ["Şehir", product.seller_city || "-"],
      ["Satıcı iletişim", product.seller_contact || "-"],
      ["Fatura sorumluluğu", product.invoice_responsibility || "-"],
      ["Satıcı bilgilendirme", product.seller_disclosure || "-"],
      ["SEO başlığı", raw.meta_title || "-"],
      ["SEO açıklaması", raw.meta_description || "-"],
      ["Son not", raw.compliance_notes || "-"],
      ["Güncelleme", dateTime(raw.updated_at || raw.created_at)]
    ];
    return `
      <details class="admin-product-review-details">
        <summary>Tüm ürün bilgileri</summary>
        <dl>
          ${rows.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}
        </dl>
      </details>
    `;
  }

  function productCard(raw) {
    const product = normalizeProduct(raw);
    const auto = automation(raw);
    const tone = riskTone(auto);
    const image = product.image_url || raw.image_url || "";
    const reviewStatus = raw.compliance_review_status || raw.review_status || raw.approval_status || "pending";
    const seller = product.seller_public_name || product.seller_name || "-";
    const revised = isRevisedProduct(raw);

    return `
      <article class="admin-product-review-card" data-product-card="${escape(product.id)}">
        <label class="admin-product-review-select" title="Ürünü toplu aksiyon için seç">
          <input type="checkbox" value="${escape(product.id)}" data-product-select aria-label="${escape(product.name)} seç">
        </label>
        <div class="admin-product-review-media">
          ${image ? `<img src="${escape(image)}" alt="${escape(product.name)}" loading="lazy" onerror="this.closest('.admin-product-review-media').textContent='Görsel yok'">` : "Görsel yok"}
        </div>
        <div class="admin-product-review-main">
          <div class="admin-product-review-title">
            <h3>${escape(product.name)}</h3>
            <span>${escape(product.category || "Genel")} · ${escape(seller)} · ${escape(dateTime(raw.created_at))}</span>
          </div>
          <div class="admin-product-review-meta">
            <span class="admin-product-review-chip" data-tone="${escape(tone)}">${escape(laneLabel(auto.lane))}</span>
            <span class="admin-product-review-chip">${escape(reviewStatusLabel(product.status || "draft"))}</span>
            <span class="admin-product-review-chip">${escape(reviewStatusLabel(reviewStatus))}</span>
            ${revised ? `<span class="admin-product-review-chip" data-tone="watch">Revizeden geldi</span>` : ""}
            <span class="admin-product-review-chip">${escape(money(product.price))}</span>
            <span class="admin-product-review-chip">Stok ${escape(product.stock)}</span>
          </div>
          <p class="admin-product-review-description">${escape(shortText(product.description || raw.meta_description || "-", 360))}</p>
          ${detailsMarkup(raw, product)}
          <div class="admin-product-review-card-actions">
            <button class="admin-btn admin-btn--gold" type="button" data-product-action="approved" data-id="${escape(product.id)}">Yayına Al</button>
            <button class="admin-btn" type="button" data-product-action="needs_review" data-id="${escape(product.id)}">Revizyon İste</button>
            <button class="admin-btn admin-btn--danger" type="button" data-product-action="rejected" data-id="${escape(product.id)}">Reddet</button>
          </div>
        </div>
        <aside class="admin-product-review-risk">
          <div class="admin-product-review-risk__top">
            <strong>${escape(auto.revision_required ? "Revizyon gerektirir" : "Yayına alınabilir")}</strong>
            <span>Risk ${escape(auto.score || 0)}/100</span>
          </div>
          <div class="admin-product-review-reasons">${reasonsMarkup(auto)}</div>
        </aside>
      </article>
    `;
  }

  function groupProducts() {
    const groups = [
      { key: "revised", title: "Revizeden Gelenler", subtitle: "Partner düzeltti ve tekrar onaya gönderdi", items: [] },
      { key: "ready", title: "Otomasyon Onaya Hazır", subtitle: "Revizyon riski görünmeyen ürünler", items: [] },
      { key: "watch", title: "Kontrol Et, Yayına Alınabilir", subtitle: "Operasyonel uyarı var; zorunlu revizyon değil", items: [] },
      { key: "needs_revision", title: "Riskli / Revizyon Gerekenler", subtitle: "Politika veya hukuki risk gerekçesi bulunan ürünler", items: [] }
    ];
    const byKey = new Map(groups.map((group) => [group.key, group]));

    for (const raw of state.products) {
      const auto = automation(raw);
      if (isRevisedProduct(raw)) {
        byKey.get("revised").items.push(raw);
      } else if (auto.lane === "needs_revision") {
        byKey.get("needs_revision").items.push(raw);
      } else if (auto.lane === "watch") {
        byKey.get("watch").items.push(raw);
      } else {
        byKey.get("ready").items.push(raw);
      }
    }
    return groups.filter((group) => group.items.length);
  }

  function renderBoard() {
    const target = $("[data-product-review-board]");
    if (!target) return;
    if (!state.products.length) {
      target.innerHTML = `<div class="admin-product-review-empty">Onay bekleyen ürün bulunamadı.</div>`;
      renderSelectedState();
      return;
    }
    target.innerHTML = groupProducts().map((group) => `
      <section class="admin-product-review-group" data-review-group="${escape(group.key)}">
        <div class="admin-product-review-group__head">
          <div>
            <h2>${escape(group.title)}</h2>
            <span>${escape(group.subtitle)}</span>
          </div>
          <span>${escape(group.items.length)} ürün</span>
        </div>
        <div class="admin-product-review-list">
          ${group.items.map(productCard).join("")}
        </div>
      </section>
    `).join("");
    renderSelectedState();
  }

  function renderAll() {
    renderSummary();
    renderBoard();
    const warnings = [...new Set(state.warnings || [])].filter(Boolean);
    showAlert(warnings.join(" "));
  }

  async function loadProducts() {
    const params = new URLSearchParams();
    const search = $("[data-product-review-search]")?.value?.trim() || "";
    const status = $("[data-product-review-status]")?.value || "";
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    params.set("limit", "200");
    const board = $("[data-product-review-board]");
    if (board) board.innerHTML = `<div class="admin-status">Ürün onay kuyruğu yükleniyor...</div>`;
    const data = await api(`/v1/ops-console/product-reviews?${params.toString()}`);
    state.products = data.products || [];
    state.summary = data.summary || {};
    state.warnings = data.warnings || [];
    state.selected = new Set([...state.selected].filter((id) => state.products.some((product) => String(product.id) === String(id))));
    renderAll();
  }

  function selectedProducts() {
    return [...state.selected].map(productById).filter(Boolean);
  }

  function revisionReasonFor(products) {
    const rows = products.flatMap((raw) => {
      const product = normalizeProduct(raw);
      const required = (automation(raw).reasons || []).filter((reason) => reason.requires_revision);
      if (!required.length) {
        return [`- ${product.name}: Admin incelemesi sonrası revizyon gerekli görüldü.`];
      }
      return required.map((reason) => `- ${product.name} / ${reason.field_label || reason.field}: ${reason.title}. ${reason.suggestion}`);
    });
    return `Ürün revizyonu gereklidir.\n${rows.join("\n")}`.slice(0, 1200);
  }

  function decisionLabel(decision) {
    const labels = {
      approved: "Yayına Al",
      needs_review: "Revizyon İste",
      rejected: "Reddet"
    };
    return labels[decision] || decision;
  }

  function defaultReason(decision, products) {
    if (decision === "approved") {
      return "Admin ürün kontrolü tamamlandı. Politika/hukuk açısından yayına alınması uygun görüldü.";
    }
    if (decision === "rejected") {
      return "Ürün, platform politika ve uygunluk kontrolleri nedeniyle reddedildi.";
    }
    return revisionReasonFor(products);
  }

  function openDecisionModal({ decision, products, message }) {
    const modal = $("#productReviewModal");
    const form = $("[data-product-review-modal-form]");
    const confirm = $("[data-product-review-modal-confirm]");
    const title = $("[data-product-review-modal-title]");
    const body = $("[data-product-review-modal-message]");
    const reason = $("[data-product-review-modal-reason]");
    if (!modal || !form || !confirm || !title || !body || !reason) return Promise.resolve(null);

    title.textContent = `Ürün Kararı: ${decisionLabel(decision)}`;
    body.textContent = message;
    reason.value = defaultReason(decision, products);
    confirm.textContent = decisionLabel(decision);
    confirm.classList.toggle("admin-btn--danger", decision === "rejected");
    confirm.classList.toggle("admin-btn--primary", decision !== "rejected");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    window.setTimeout(() => reason.focus(), 60);

    return new Promise((resolve) => {
      const cleanup = () => {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        form.onsubmit = null;
        $("[data-product-review-modal-cancel]").onclick = null;
      };
      $("[data-product-review-modal-cancel]").onclick = () => {
        cleanup();
        resolve(null);
      };
      form.onsubmit = (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        cleanup();
        resolve(data);
      };
    });
  }

  async function decideProduct(productId, decision) {
    const raw = productById(productId);
    if (!raw) return;
    const product = normalizeProduct(raw);
    const modalData = await openDecisionModal({
      decision,
      products: [raw],
      message: `${product.name} için karar kaydedilecek. Admin uygun görürse risk uyarısı olsa bile yayına alma kararı verebilir.`
    });
    if (!modalData) return;
    const result = await api(`/v1/ops-console/product-reviews/${encodeURIComponent(productId)}/decision`, {
      method: "POST",
      body: {
        decision,
        reason: modalData.reason || ""
      }
    });
    if (result?.warnings?.length) showAlert(result.warnings.join(" "));
    showToast(decision === "approved" ? "Ürün yayına alındı." : decision === "rejected" ? "Ürün reddedildi." : "Ürün revizyona gönderildi.");
    state.selected.delete(String(productId));
    await loadProducts();
  }

  async function bulkDecision(decision) {
    const products = selectedProducts();
    if (!products.length) {
      showToast("Toplu aksiyon için en az bir ürün seçin.", "error");
      return;
    }
    const riskyCount = products.filter((product) => automation(product).revision_required).length;
    const modalData = await openDecisionModal({
      decision,
      products,
      message: `${products.length} ürün için toplu karar kaydedilecek.${decision === "approved" && riskyCount ? ` Seçimde ${riskyCount} riskli ürün var; admin kararıyla yine de yayına alınabilir.` : ""}`
    });
    if (!modalData) return;

    const result = await api("/v1/ops-console/product-reviews/bulk-decision", {
      method: "POST",
      body: {
        product_ids: products.map((product) => product.id),
        decision,
        reason: modalData.reason || "",
        only_auto_approvable: false
      }
    });
    const updated = result?.products?.length || 0;
    const skipped = result?.skipped?.length || 0;
    if (result?.warnings?.length || skipped) {
      showAlert([...new Set([...(result.warnings || []), skipped ? `${skipped} ürün atlandı.` : ""])].filter(Boolean).join(" "));
    }
    showToast(`${updated} ürün için karar kaydedildi${skipped ? `, ${skipped} ürün atlandı` : ""}.`);
    state.selected.clear();
    await loadProducts();
  }

  function selectReadyProducts() {
    const readyIds = state.products
      .filter((raw) => {
        const auto = automation(raw);
        return auto.auto_approvable && auto.lane === "ready" && auto.risk_level === "clear" && !auto.revision_required;
      })
      .map((product) => String(product.id));
    state.selected = new Set(readyIds);
    renderSelectedState();
    showToast(`${readyIds.length} güvenli ürün seçildi.`);
  }

  function bindEvents() {
    document.addEventListener("click", async (event) => {
      if (event.target.closest("[data-product-review-refresh]")) {
        await loadProducts().catch((error) => showAlert(readableError(error), "error"));
        return;
      }
      if (event.target.closest("[data-select-ready]")) {
        selectReadyProducts();
        return;
      }
      if (event.target.closest("[data-bulk-approve]")) {
        await bulkDecision("approved").catch((error) => {
          showAlert(readableError(error), "error");
          showToast(readableError(error), "error");
        });
        return;
      }
      if (event.target.closest("[data-bulk-revision]")) {
        await bulkDecision("needs_review").catch((error) => {
          showAlert(readableError(error), "error");
          showToast(readableError(error), "error");
        });
        return;
      }
      const action = event.target.closest("[data-product-action]");
      if (action) {
        await decideProduct(action.dataset.id, action.dataset.productAction).catch((error) => {
          showAlert(readableError(error), "error");
          showToast(readableError(error), "error");
        });
      }
    });

    document.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-product-select]");
      if (checkbox) {
        if (checkbox.checked) state.selected.add(String(checkbox.value));
        else state.selected.delete(String(checkbox.value));
        renderSelectedState();
        return;
      }
      if (event.target.closest("[data-product-review-status]")) {
        loadProducts().catch((error) => showAlert(readableError(error), "error"));
      }
    });

    document.addEventListener("input", (event) => {
      if (!event.target.closest("[data-product-review-search]")) return;
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(() => {
        loadProducts().catch((error) => showAlert(readableError(error), "error"));
      }, 350);
    });
  }

  async function init() {
    try {
      if (App.auth?.redirectToMfaIfNeeded && await App.auth.redirectToMfaIfNeeded("/admin/product-reviews.html")) return;
      bindEvents();
      await loadProducts();
    } catch (error) {
      showAlert(readableError(error), "error");
      const board = $("[data-product-review-board]");
      if (board) board.innerHTML = `<div class="admin-status admin-status--error">${escape(readableError(error))}</div>`;
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
