(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core || {};
  const state = {
    access: null,
    business: null,
    product: null,
    productId: ""
  };

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function escape(value) {
    return core.escapeHTML ? core.escapeHTML(value ?? "") : String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  }

  function money(value) {
    if (core.money) return core.money(value);
    return Number(value || 0).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
  }

  function apiBaseUrl() {
    const configured = String(App.config?.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  async function authHeaders() {
    const session = await App.auth.getSession();
    if (!session?.access_token) throw new Error("API için oturum doğrulanamadı.");
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    };
  }

  async function apiFetch(path, options) {
    const settings = options || {};
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...settings,
      headers: {
        ...(await authHeaders()),
        ...(settings.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || payload.error || "Partner ürün API isteği tamamlanamadı.");
    }
    return payload;
  }

  function toast(message, type) {
    if (core.toast) core.toast(message, type);
    else if (message) window.alert(message);
  }

  function showAlert(message, type) {
    const target = $("[data-product-detail-alert]");
    if (!target) return;
    if (!message) {
      target.hidden = true;
      target.textContent = "";
      target.className = "partner-products-alert";
      return;
    }
    target.hidden = false;
    target.className = `partner-products-alert${type === "error" ? " is-error" : ""}`;
    target.textContent = message;
  }

  function productName(product) {
    return product?.name || product?.product_name || "Ürün";
  }

  function normalizeProduct(raw) {
    return core.normalizeProduct ? core.normalizeProduct(raw || {}) : {
      ...(raw || {}),
      name: productName(raw || {}),
      price: Number(raw?.price || 0),
      stock: Number(raw?.stock || 0),
      category: raw?.category || "Genel",
      image_url: raw?.image_url || ""
    };
  }

  function parseGallery(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
    const raw = String(value || "").trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || "").trim()).filter(Boolean);
    } catch (error) {
      // CSV imports may store gallery URLs as comma/newline separated strings.
    }
    return raw.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  }

  function uniqueUrls(items) {
    const seen = new Set();
    return items.filter((url) => {
      const key = String(url || "").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function productGallery(product) {
    return uniqueUrls([
      product.image_url,
      ...parseGallery(product.media_gallery)
    ]).slice(0, 8);
  }

  function statusLabel(value) {
    const labels = {
      active: "Yayında",
      approved: "Onaylandı",
      draft: "Taslak",
      pending: "Onay bekliyor",
      review: "İncelemede",
      in_review: "İncelemede",
      needs_review: "Revizyon",
      rejected: "Reddedildi",
      archived: "Arşiv",
      hidden: "Gizli"
    };
    return labels[normalize(value)] || value || "Taslak";
  }

  function isApproved(product) {
    return normalize(product?.compliance_review_status || product?.review_status || product?.approval_status) === "approved";
  }

  function isActive(product) {
    return normalize(product?.status) === "active";
  }

  function canPublish(product) {
    return isApproved(product) && !isActive(product) && normalize(product?.status) !== "archived";
  }

  function variantInfo(product) {
    return product.variant_automation || {
      label: "Standart",
      group_size: 1,
      group_stock: Number(product.stock || 0),
      siblings: []
    };
  }

  function renderVariantFamily(product) {
    const info = variantInfo(product);
    const siblings = info.siblings || [];
    if (!siblings.length) {
      return `
        <div class="partner-product-variant-family">
          <strong>Varyant ailesi</strong>
          <span>Bu ürün şu an tekil görünüyor. Aynı barkod, model veya görsel sinyali geldikçe otomasyon burada gruplayacak.</span>
        </div>
      `;
    }
    return `
      <div class="partner-product-variant-family">
        <strong>Varyant ailesi · ${escape(info.group_size || siblings.length + 1)} ürün</strong>
        <div class="partner-product-variant-family-list">
          ${siblings.map((item) => `
            <a href="/pages/partner/partner-product-detail.html?id=${encodeURIComponent(item.id)}" title="${escape(item.name || item.label || "Varyantı aç")}">
              ${item.image_url ? `<img src="${escape(item.image_url)}" alt="" loading="lazy" onerror="this.hidden=true">` : `<i class="fa-solid fa-image"></i>`}
              <span>
                <b>${escape(item.label || item.color || item.sku || "Varyant")}</b>
                <small>${escape(item.stock)} stok · ${money(item.price)}</small>
              </span>
            </a>
          `).join("")}
        </div>
      </div>
    `;
  }

  function setButtonBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.dataset.busy = busy ? "true" : "";
  }

  function productIdFromUrl() {
    return new URLSearchParams(window.location.search).get("id") || "";
  }

  function fillForm(product) {
    const form = $("[data-product-detail-form]");
    if (!form) return;
    const set = (name, value) => {
      if (form.elements[name]) form.elements[name].value = value ?? "";
    };
    set("id", product.id);
    set("name", product.name);
    set("sku", product.sku || "");
    set("catalog_scope", product.catalog_scope || product.module_key || "shop");
    set("category", product.category || "");
    set("brand", product.brand || "");
    set("price", Number(product.price || 0));
    set("stock", Number(product.stock || 0));
    set("image_url", product.image_url || "");
    set("media_gallery", Array.isArray(product.media_gallery) ? JSON.stringify(product.media_gallery.slice(0, 8)) : product.media_gallery || "");
    set("video_url", product.video_url || "");
    set("description", product.description || "");
    set("seller_public_name", product.seller_public_name || "");
    set("seller_city", product.seller_city || "");
    set("seller_legal_name", product.seller_legal_name || "");
    set("seller_contact", product.seller_contact || "");
    set("seller_tax_number_masked", product.seller_tax_number_masked || "");
    set("invoice_responsibility", product.invoice_responsibility || "");
    set("seller_disclosure", product.seller_disclosure || "");
    set("meta_title", product.meta_title || product.name || "");
    set("meta_description", product.meta_description || product.description || "");
  }

  function renderPreview() {
    const raw = state.product || {};
    const product = normalizeProduct(raw);
    const form = $("[data-product-detail-form]");
    const preview = $("[data-product-detail-preview]");
    const variantTarget = $("[data-product-detail-variants]");
    const title = $("[data-product-detail-title]");
    const summary = $("[data-product-detail-summary]");
    const status = $("[data-product-detail-status]");
    const publish = $("[data-publish-product-detail]");
    if (!preview || !form) return;
    const current = {
      ...product,
      name: form.elements.name?.value || product.name,
      price: Number(form.elements.price?.value || product.price || 0),
      stock: Number(form.elements.stock?.value || product.stock || 0),
      category: form.elements.category?.value || product.category,
      brand: form.elements.brand?.value || product.brand,
      image_url: form.elements.image_url?.value || product.image_url,
      media_gallery: form.elements.media_gallery?.value || product.media_gallery,
      video_url: form.elements.video_url?.value || product.video_url,
      description: form.elements.description?.value || product.description
    };
    const gallery = productGallery(current);
    if (title) title.textContent = current.name || "Ürün detayı";
    if (summary) summary.textContent = `${current.category || "Genel"} · ${money(current.price)} · Stok ${current.stock}`;
    if (status) status.textContent = statusLabel(current.compliance_review_status || current.status || "draft");
    if (publish) publish.hidden = !canPublish(current);
    preview.innerHTML = `
      <div class="partner-product-detail-hero">
        ${gallery[0] ? `<img src="${escape(gallery[0])}" alt="${escape(current.name)}" loading="lazy" onerror="this.hidden=true">` : `<div class="partner-product-thumb"><i class="fa-solid fa-image"></i></div>`}
        <div>
          <strong>${escape(current.name || "Ürün")}</strong>
          <span>${escape(current.category || "Genel")} · ${money(current.price)} · Stok ${escape(current.stock)}</span>
          <small>${escape(current.sku || current.brand || "SKU yok")}</small>
        </div>
      </div>
      <div class="partner-product-detail-media-grid">
        ${gallery.map((url) => `<img src="${escape(url)}" alt="${escape(current.name)} görseli" loading="lazy" onerror="this.remove()">`).join("")}
      </div>
      ${current.video_url ? `
        <video controls src="${escape(current.video_url)}"></video>
      ` : ""}
      <p>${escape(current.description || "Açıklama girilmedi.")}</p>
    `;
    if (variantTarget) variantTarget.innerHTML = renderVariantFamily(current);
  }

  function payloadFromForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    return {
      name: String(data.name || "").trim(),
      sku: String(data.sku || "").trim(),
      catalog_scope: data.catalog_scope || "shop",
      module_key: data.catalog_scope || "shop",
      category: String(data.category || "").trim(),
      brand: String(data.brand || "").trim(),
      price: Number(data.price || 0),
      stock: Number(data.stock || 0),
      image_url: String(data.image_url || "").trim(),
      media_gallery: parseGallery(data.media_gallery).slice(0, 8),
      video_url: String(data.video_url || "").trim(),
      description: String(data.description || "").trim(),
      seller_public_name: String(data.seller_public_name || "").trim(),
      seller_city: String(data.seller_city || "").trim(),
      seller_legal_name: String(data.seller_legal_name || "").trim(),
      seller_contact: String(data.seller_contact || "").trim(),
      seller_tax_number_masked: String(data.seller_tax_number_masked || "").trim(),
      invoice_responsibility: String(data.invoice_responsibility || "").trim(),
      seller_disclosure: String(data.seller_disclosure || "").trim(),
      meta_title: String(data.meta_title || "").trim(),
      meta_description: String(data.meta_description || "").trim()
    };
  }

  async function loadProduct() {
    showAlert("Ürün yükleniyor.");
    try {
      state.productId = productIdFromUrl();
      if (!state.productId) throw new Error("Ürün bağlantısı eksik.");
      state.access = await App.auth.requireRole(["partner", "admin", "super_admin"]);
      if (!state.access) return;
      if (App.auth.redirectToMfaIfNeeded && await App.auth.redirectToMfaIfNeeded(`/pages/partner/partner-product-detail.html?id=${encodeURIComponent(state.productId)}`)) return;
      const payload = await apiFetch(`/v1/partner/products/${encodeURIComponent(state.productId)}`);
      state.business = payload.business || null;
      state.product = payload.product || null;
      if (!state.product) throw new Error("Ürün bulunamadı.");
      fillForm(normalizeProduct(state.product));
      showAlert("");
      renderPreview();
    } catch (error) {
      showAlert(error.message || "Ürün yüklenemedi.", "error");
    }
  }

  async function submitProduct(form) {
    const button = form.querySelector("button[type='submit']");
    setButtonBusy(button, true);
    try {
      const payload = payloadFromForm(form);
      if (!payload.name || payload.name.length < 2) throw new Error("Ürün adını kontrol edin.");
      const result = await apiFetch(`/v1/partner/products/${encodeURIComponent(state.productId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      state.product = result.product || state.product;
      fillForm(normalizeProduct(state.product));
      renderPreview();
      toast(result.message || "Ürün revizyonu admin onayına gönderildi.", "success");
    } catch (error) {
      toast(error.message || "Ürün kaydedilemedi.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function publishProduct(button) {
    setButtonBusy(button, true);
    try {
      const result = await apiFetch(`/v1/partner/products/${encodeURIComponent(state.productId)}/publish`, {
        method: "POST",
        body: JSON.stringify({})
      });
      state.product = result.product || state.product;
      fillForm(normalizeProduct(state.product));
      renderPreview();
      toast(result.message || "Ürün yayına alındı.", "success");
    } catch (error) {
      toast(error.message || "Ürün yayına alınamadı.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function archiveProduct(button) {
    const product = normalizeProduct(state.product || {});
    if (!window.confirm(`${product.name || "Bu ürün"} yayından kaldırılıp arşivlenecek. Devam edilsin mi?`)) return;
    setButtonBusy(button, true);
    try {
      const result = await apiFetch(`/v1/partner/products/${encodeURIComponent(state.productId)}`, {
        method: "DELETE"
      });
      state.product = result.product || state.product;
      fillForm(normalizeProduct(state.product));
      renderPreview();
      toast(result.message || "Ürün arşivlendi.", "success");
    } catch (error) {
      toast(error.message || "Ürün arşivlenemedi.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const refresh = event.target.closest("[data-refresh-product-detail]");
      const publish = event.target.closest("[data-publish-product-detail]");
      const archive = event.target.closest("[data-archive-product-detail]");
      if (refresh) loadProduct();
      if (publish) publishProduct(publish);
      if (archive) archiveProduct(archive);
    });

    document.addEventListener("input", (event) => {
      if (event.target.closest("[data-product-detail-form]")) renderPreview();
    });

    document.addEventListener("change", (event) => {
      if (event.target.closest("[data-product-detail-form]")) renderPreview();
    });

    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-product-detail-form]");
      if (!form) return;
      event.preventDefault();
      submitProduct(form);
    });
  }

  function init() {
    bindEvents();
    loadProduct();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
