(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core || {};
  const state = {
    access: null,
    business: null,
    products: [],
    selected: new Set(),
    currentProductId: "",
    pageSize: 50,
    filters: {
      search: "",
      status: "all",
      sort: "updated_desc"
    }
  };

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
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

  function escapeSelector(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value || ""));
    return String(value || "").replace(/["\\]/g, "\\$&");
  }

  function money(value) {
    if (core.money) return core.money(value);
    return Number(value || 0).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
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

  function showAlert(message, type) {
    const target = $("[data-product-alert]");
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

  function toast(message, type) {
    if (core.toast) core.toast(message, type);
    else if (message) window.alert(message);
  }

  function productName(product) {
    return product.name || product.product_name || "Ürün";
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

  function productGallery(product, raw) {
    return uniqueUrls([
      product.image_url,
      raw?.image_url,
      ...parseGallery(raw?.media_gallery || product.media_gallery)
    ]).slice(0, 8);
  }

  function variantInfo(product) {
    return product.variant_automation || {
      group_key: "",
      match_key: "",
      label: "Standart",
      color: "",
      size: "",
      group_size: 1,
      group_stock: Number(product.stock || 0),
      confidence: 0,
      siblings: [],
      reasons: []
    };
  }

  function confidenceLabel(confidence) {
    const value = Number(confidence || 0);
    if (value >= 0.9) return "Kesin eşleşme";
    if (value >= 0.72) return "Güçlü eşleşme";
    if (value >= 0.6) return "Muhtemel eşleşme";
    return "Tekil ürün";
  }

  function sourceLabel(source) {
    const labels = {
      external_group: "Grup kodu",
      barcode: "Barkod",
      product_code: "Ürün kodu",
      model_image: "Model + görsel",
      model_name: "Model adı",
      single_product: "Tekil"
    };
    return labels[source] || "Otomasyon";
  }

  function renderVariantMiniStrip(product, raw) {
    const info = variantInfo(product);
    const gallery = productGallery(product, raw);
    const siblingImages = (info.siblings || []).map((item) => item.image_url).filter(Boolean);
    const urls = uniqueUrls([...gallery, ...siblingImages]).slice(0, 5);
    if (!urls.length && Number(info.group_size || 0) <= 1) return "";
    return `
      <span class="partner-product-variant-strip" aria-label="Ürün görselleri ve varyantları">
        ${urls.map((url, index) => `
          <span class="partner-product-variant-mini" title="${index === 0 ? "Ana görsel" : "Varyant görseli"}">
            <img src="${escape(url)}" alt="" loading="lazy" onerror="this.closest('.partner-product-variant-mini')?.remove()">
          </span>
        `).join("")}
        ${Number(info.group_size || 0) > 1 ? `<span class="partner-product-variant-count">+${escape(Number(info.group_size || 0) - 1)}</span>` : ""}
      </span>
    `;
  }

  function renderVariantSummary(product) {
    const info = variantInfo(product);
    const groupSize = Number(info.group_size || 1);
    const label = info.label || [info.color, info.size].filter(Boolean).join(" / ") || "Standart";
    const confidence = confidenceLabel(info.confidence);
    const source = sourceLabel(info.source);
    const priceRange = info.price_range || {};
    const priceText = Number(priceRange.max || 0) > Number(priceRange.min || 0)
      ? `${money(priceRange.min)} - ${money(priceRange.max)}`
      : "";
    return `
      <span class="partner-product-variant-meta">
        <span class="partner-product-variant-chip">
          <i class="fa-solid fa-layer-group"></i>
          ${escape(groupSize > 1 ? `${groupSize} varyant` : label)}
        </span>
        ${info.color ? `<span class="partner-product-variant-chip">${escape(info.color)}</span>` : ""}
        ${info.size ? `<span class="partner-product-variant-chip">${escape(info.size)}</span>` : ""}
        <small>${escape(source)} · ${escape(confidence)}${priceText ? ` · ${escape(priceText)}` : ""}</small>
      </span>
    `;
  }

  function renderVariantFamily(product) {
    const info = variantInfo(product);
    const siblings = info.siblings || [];
    if (!siblings.length) {
      return `
        <div class="partner-product-variant-family">
          <strong>Varyant ailesi</strong>
          <span>Bu ürün şu an tekil görünüyor. Aynı barkod/model/görsel sinyali geldikçe otomasyon burada gruplayacak.</span>
        </div>
      `;
    }
    return `
      <div class="partner-product-variant-family">
        <strong>Varyant ailesi · ${escape(info.group_size || siblings.length + 1)} ürün</strong>
        <div class="partner-product-variant-family-list">
          ${siblings.map((item) => `
            <button type="button" data-edit-product="${escape(item.id)}" title="${escape(item.name || item.label || "Varyantı aç")}">
              ${item.image_url ? `<img src="${escape(item.image_url)}" alt="" loading="lazy" onerror="this.hidden=true">` : `<i class="fa-solid fa-image"></i>`}
              <span>
                <b>${escape(item.label || item.color || item.sku || "Varyant")}</b>
                <small>${escape(item.stock)} stok · ${money(item.price)}</small>
              </span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
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

  function formatDate(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      return "-";
    }
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

  function badgeClass(product) {
    const status = normalize(product.status);
    const review = normalize(product.compliance_review_status || product.review_status || product.approval_status);
    if (["rejected", "archived", "hidden"].includes(status) || review === "rejected") return "is-danger";
    if (review === "needs_review" || status === "needs_review") return "is-review";
    if (["pending", "review", "in_review", "draft", "submitted", "awaiting_review", "waiting_review"].includes(review) || ["pending", "review", "in_review", "draft", "submitted", "awaiting_review", "waiting_review"].includes(status)) return "is-pending";
    if (status === "active" || review === "approved") return "is-active";
    return "";
  }

  function statusBadges(product) {
    const status = normalize(product.status || "draft");
    const review = normalize(product.compliance_review_status || product.review_status || product.approval_status || "");
    const reviewText = review && review !== status ? `<span class="partner-products-badge ${badgeClass(product)}">${escape(statusLabel(review))}</span>` : "";
    return `
      <span class="partner-products-badge ${badgeClass(product)}">${escape(statusLabel(status))}</span>
      ${reviewText}
    `;
  }

  function isApproved(product) {
    return normalize(product.compliance_review_status || product.review_status || product.approval_status) === "approved";
  }

  function isActive(product) {
    return normalize(product.status) === "active";
  }

  function canPublish(product) {
    return isApproved(product) && !isActive(product) && normalize(product.status) !== "archived";
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

  function isRiskProduct(product) {
    const auto = automation(product);
    return Boolean(
      auto.revision_required
      || auto.lane === "needs_revision"
      || auto.lane === "watch"
      || ["critical", "warning"].includes(auto.risk_level)
      || productMatchesStatus(product, "needs_review")
      || productMatchesStatus(product, "rejected")
    );
  }

  function isReadyProduct(product) {
    const auto = automation(product);
    return Boolean(
      !isRiskProduct(product)
      && (
        canPublish(product)
        || normalize(product.compliance_review_status || product.review_status || product.approval_status) === "approved"
        || (auto.auto_approvable && auto.lane === "ready" && auto.risk_level === "clear" && !auto.revision_required)
      )
    );
  }

  function isMissingPriceProduct(product) {
    return Number(product.price || 0) <= 0;
  }

  function isMissingStockProduct(product) {
    return Number(product.stock || 0) <= 0;
  }

  function isCriticalStockProduct(product) {
    const stock = Number(product.stock || 0);
    return stock > 0 && stock < 5;
  }

  function productMatchesSearch(product, search) {
    const term = String(search || "").trim().toLocaleLowerCase("tr-TR");
    if (!term) return true;
    return [
      product.name,
      product.product_name,
      product.description,
      product.category,
      product.brand,
      product.sku,
      product.variant_automation?.label,
      product.variant_automation?.color,
      product.variant_automation?.size,
      product.variant_automation?.group_key,
      product.seller_public_name,
      product.seller_legal_name,
      product.integration_source,
      product.integration_external_id
    ].some((value) => String(value || "").toLocaleLowerCase("tr-TR").includes(term));
  }

  function productMatchesStatus(product, statusFilter) {
    const filter = normalize(statusFilter);
    if (!filter || filter === "all") return true;
    const status = normalize(product.status);
    const review = normalize(product.compliance_review_status || product.review_status || product.approval_status);
    const stock = Number(product.stock || 0);
    if (filter === "low_stock") return stock > 0 && stock <= 5;
    if (filter === "out_of_stock") return stock <= 0;
    if (filter === "pending") return ["pending", "review", "in_review", "submitted", "awaiting_review", "waiting_review", "needs_review"].includes(review) || ["pending", "review", "in_review", "submitted", "awaiting_review", "waiting_review", "needs_review"].includes(status);
    if (filter === "needs_review") return review === "needs_review" || status === "needs_review";
    if (filter === "rejected") return review === "rejected" || status === "rejected" || status === "archived";
    return status === filter || review === filter;
  }

  function filteredProducts() {
    const rows = state.products
      .map((raw) => ({ raw, product: normalizeProduct(raw) }))
      .filter(({ product }) => productMatchesSearch(product, state.filters.search))
      .filter(({ product }) => productMatchesStatus(product, state.filters.status));

    rows.sort((left, right) => {
      const a = left.product;
      const b = right.product;
      if (state.filters.sort === "name_asc") return String(a.name || "").localeCompare(String(b.name || ""), "tr");
      if (state.filters.sort === "stock_asc") return Number(a.stock || 0) - Number(b.stock || 0);
      if (state.filters.sort === "price_desc") return Number(b.price || 0) - Number(a.price || 0);
      if (state.filters.sort === "price_asc") return Number(a.price || 0) - Number(b.price || 0);
      return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""));
    });

    return rows.map(({ raw }) => raw);
  }

  function visibleProducts() {
    return filteredProducts().slice(0, state.pageSize);
  }

  function summaryFromProducts(products) {
    const normalized = products.map(normalizeProduct);
    const variantGroups = new Set(normalized
      .filter((item) => Number(item.variant_automation?.group_size || 0) > 1)
      .map((item) => item.variant_automation?.group_key)
      .filter(Boolean));
    return {
      total: normalized.length,
      active: normalized.filter((item) => normalize(item.status) === "active").length,
      pending: normalized.filter((item) => productMatchesStatus(item, "pending")).length,
      low_stock: normalized.filter((item) => Number(item.stock || 0) > 0 && Number(item.stock || 0) <= 5).length,
      out_of_stock: normalized.filter((item) => Number(item.stock || 0) <= 0).length,
      rejected: normalized.filter((item) => productMatchesStatus(item, "rejected")).length,
      variant_groups: variantGroups.size,
      variant_products: normalized.filter((item) => Number(item.variant_automation?.group_size || 0) > 1).length
    };
  }

  function renderKpis() {
    const target = $("[data-product-kpis]");
    if (!target) return;
    const summary = summaryFromProducts(state.products);
    const rows = [
      ["Toplam", summary.total, "fa-boxes-stacked"],
      ["Yayında", summary.active, "fa-circle-check"],
      ["Onay", summary.pending, "fa-hourglass-half"],
      ["Kritik stok", summary.low_stock, "fa-triangle-exclamation"],
      ["Stok yok", summary.out_of_stock, "fa-box-open"],
      ["Reddedilen", summary.rejected, "fa-ban"],
      ["Varyant grubu", summary.variant_groups, "fa-layer-group"]
    ];
    target.innerHTML = rows.map(([label, value, icon]) => `
      <article class="partner-products-kpi">
        <span>${escape(label)}</span>
        <strong>${escape(value)}</strong>
        <i class="fa-solid ${escape(icon)}"></i>
      </article>
    `).join("");
  }

  function renderSummary() {
    const target = $("[data-product-manager-summary]");
    const filtered = filteredProducts().length;
    const visible = Math.min(state.pageSize, filtered);
    const total = state.products.length;
    const businessName = state.business?.display_name || state.business?.legal_name || "Partner";
    if (target) target.textContent = `${businessName} kataloğu · ${visible}/${filtered}/${total} ürün gösteriliyor.`;
    const windowTarget = $("[data-product-window-summary]");
    if (windowTarget) {
      const start = filtered ? 1 : 0;
      windowTarget.textContent = `${start}-${visible} arası gösteriliyor · ${filtered} filtre sonucu`;
    }
  }

  function renderSelectedState() {
    const count = state.selected.size;
    const target = $("[data-selected-count]");
    if (target) target.textContent = `${count} ürün seçildi`;
    $all("[data-product-row]").forEach((row) => {
      row.classList.toggle("is-selected", state.selected.has(String(row.dataset.productRow || "")));
    });
    const form = $("[data-bulk-product-form]");
    if (form) {
      $all("input, button", form).forEach((node) => {
        node.disabled = count === 0;
      });
    }
    const master = $("[data-select-all-products]");
    if (master) {
      const rows = visibleProducts();
      master.checked = rows.length > 0 && rows.every((product) => state.selected.has(String(product.id)));
      master.indeterminate = rows.some((product) => state.selected.has(String(product.id))) && !master.checked;
    }
  }

  function renderRows() {
    const target = $("[data-product-rows]");
    if (!target) return;
    const rows = visibleProducts();
    if (!rows.length) {
      target.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="partner-products-empty">
              <strong>Ürün bulunamadı.</strong>
              <span>Filtreleri temizleyip tekrar kontrol edebilirsiniz.</span>
            </div>
          </td>
        </tr>
      `;
      renderSelectedState();
      renderSummary();
      return;
    }

    target.innerHTML = rows.map((raw) => {
      const product = normalizeProduct(raw);
      const image = product.image_url || raw.image_url || "";
      const variant = variantInfo(product);
      const stockClass = Number(product.stock || 0) <= 0 ? "is-empty" : Number(product.stock || 0) <= 5 ? "is-low" : "";
      const approvedForPublish = canPublish(product);
      const archived = normalize(product.status) === "archived";
      return `
        <tr data-product-row="${escape(product.id)}" class="${state.selected.has(String(product.id)) ? "is-selected" : ""}">
          <td class="partner-products-select">
            <input type="checkbox" data-select-product="${escape(product.id)}" aria-label="${escape(product.name)} seç" ${state.selected.has(String(product.id)) ? "checked" : ""}>
          </td>
          <td>
            <div class="partner-product-cell">
              <span class="partner-product-media-cluster">
                <span class="partner-product-thumb">
                  ${image ? `<img src="${escape(image)}" alt="${escape(product.name)}" loading="lazy" onerror="this.remove()">` : `<i class="fa-solid fa-image"></i>`}
                </span>
                ${renderVariantMiniStrip(product, raw)}
              </span>
              <span>
                <strong>${escape(product.name)}</strong>
                <small>${escape(product.sku || product.brand || product.seller_public_name || "SKU yok")}</small>
                ${renderVariantSummary(product)}
              </span>
            </div>
          </td>
          <td>${escape(product.category || "-")}<small>${escape(product.brand || "")}${variant.group_size > 1 ? ` · Grup stok ${escape(variant.group_stock || 0)}` : ""}</small></td>
          <td class="partner-products-money">
            <input class="partner-products-quick-input" type="number" min="0" step="0.01" value="${escape(Number(product.price || 0))}" data-quick-price="${escape(product.id)}" aria-label="${escape(product.name)} fiyat">
            <small>${money(product.price)}</small>
          </td>
          <td>
            <input class="partner-products-quick-input ${stockClass}" type="number" min="0" step="1" value="${escape(Number(product.stock || 0))}" data-quick-stock="${escape(product.id)}" aria-label="${escape(product.name)} stok">
          </td>
          <td>${statusBadges(product)}</td>
          <td>${escape(formatDate(product.updated_at || product.created_at))}</td>
          <td class="partner-products-row-actions">
            <button type="button" data-save-quick-product="${escape(product.id)}" title="Fiyat ve stoku kaydet">
              <i class="fa-solid fa-floppy-disk"></i>
              <span>Kaydet</span>
            </button>
            <button type="button" data-edit-product="${escape(product.id)}" title="Ürün içeriğini düzenle">
              <i class="fa-solid fa-pen-to-square"></i>
              <span>Düzenle</span>
            </button>
            ${approvedForPublish ? `
              <button type="button" data-publish-product="${escape(product.id)}" title="Onaylı ürünü yayına al">
                <i class="fa-solid fa-bullhorn"></i>
                <span>Yayına Al</span>
              </button>
            ` : ""}
            <button type="button" class="is-danger" data-archive-product="${escape(product.id)}" ${archived ? "disabled" : ""} title="Ürünü yayından kaldır ve arşivle">
              <i class="fa-solid fa-box-archive"></i>
              <span>${archived ? "Arşiv" : "Sil"}</span>
            </button>
          </td>
        </tr>
      `;
    }).join("");
    renderSelectedState();
    renderSummary();
  }

  function renderAll() {
    renderKpis();
    renderRows();
  }

  function setButtonBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.dataset.busy = busy ? "true" : "";
  }

  async function loadProducts() {
    showAlert("Ürünler yükleniyor.");
    try {
      state.access = await App.auth.requireRole(["partner", "admin", "super_admin"]);
      if (!state.access) return;
      if (App.auth.redirectToMfaIfNeeded && await App.auth.redirectToMfaIfNeeded("/pages/partner/partner-products.html")) return;
      const params = new URLSearchParams({ limit: "1000" });
      const payload = await apiFetch(`/v1/partner/products?${params.toString()}`);
      state.business = payload.business || state.access.partnerBusiness || null;
      state.products = payload.products || [];
      state.selected.clear();
      showAlert("");
      renderAll();
    } catch (error) {
      showAlert(error.message || "Ürünler yüklenemedi.", "error");
      renderAll();
    }
  }

  function productById(productId) {
    return state.products.find((product) => String(product.id) === String(productId)) || null;
  }

  function fillForm(form, rawProduct) {
    const product = normalizeProduct(rawProduct);
    const set = (name, value) => {
      if (form.elements[name]) form.elements[name].value = value ?? "";
    };
    set("id", product.id);
    set("name", product.name);
    set("sku", rawProduct.sku || "");
    set("catalog_scope", rawProduct.catalog_scope || rawProduct.module_key || product.module_key || "shop");
    set("category", product.category || "");
    set("brand", rawProduct.brand || "");
    set("price", Number(product.price || 0));
    set("stock", Number(product.stock || 0));
    set("image_url", rawProduct.image_url || product.image_url || "");
    set("media_gallery", Array.isArray(rawProduct.media_gallery) ? JSON.stringify(rawProduct.media_gallery.slice(0, 8)) : rawProduct.media_gallery || "");
    set("video_url", rawProduct.video_url || product.video_url || "");
    set("description", product.description || "");
    set("seller_public_name", rawProduct.seller_public_name || product.seller_public_name || "");
    set("seller_city", rawProduct.seller_city || product.seller_city || "");
    set("seller_legal_name", rawProduct.seller_legal_name || product.seller_legal_name || "");
    set("seller_contact", rawProduct.seller_contact || product.seller_contact || "");
    set("seller_tax_number_masked", rawProduct.seller_tax_number_masked || product.seller_tax_number_masked || "");
    set("invoice_responsibility", rawProduct.invoice_responsibility || product.invoice_responsibility || "");
    set("seller_disclosure", rawProduct.seller_disclosure || product.seller_disclosure || "");
    set("meta_title", rawProduct.meta_title || product.meta_title || product.name);
    set("meta_description", rawProduct.meta_description || product.meta_description || product.description || "");
    renderEditorPreview(product);
  }

  function renderEditorPreview(product) {
    const target = $("[data-product-edit-preview]");
    if (!target) return;
    const form = $("[data-product-edit-form]");
    const image = form?.elements.image_url?.value || product.image_url || "";
    const name = form?.elements.name?.value || product.name || "Ürün";
    const category = form?.elements.category?.value || product.category || "";
    const price = form?.elements.price?.value || product.price || 0;
    const stock = form?.elements.stock?.value || product.stock || 0;
    target.innerHTML = `
      ${image ? `<img src="${escape(image)}" alt="${escape(name)}" loading="lazy" onerror="this.hidden=true">` : `<div class="partner-product-thumb"><i class="fa-solid fa-image"></i></div>`}
      <div>
        <strong>${escape(name)}</strong>
        <span>${escape(category || "Genel")} · ${money(price)} · Stok ${escape(stock)}</span>
        ${renderVariantSummary(product)}
      </div>
      <div class="partner-product-preview-variants">
        ${renderVariantMiniStrip(product, product)}
      </div>
    `;
  }

  function openEditor(productId) {
    const rawProduct = productById(productId);
    if (!rawProduct) return;
    const product = normalizeProduct(rawProduct);
    state.currentProductId = String(product.id);
    const drawer = $("[data-product-drawer]");
    const form = $("[data-product-edit-form]");
    if (!drawer || !form) return;
    fillForm(form, rawProduct);
    const title = $("[data-drawer-title]");
    const status = $("[data-drawer-status]");
    const subtitle = $("[data-drawer-subtitle]");
    if (title) title.textContent = product.name;
    if (status) status.textContent = statusLabel(product.compliance_review_status || product.status || "draft");
    if (subtitle) subtitle.textContent = `${product.sku || product.category || "Ürün"} · ${money(product.price)} · Stok ${product.stock}`;
    const variantTarget = $("[data-product-edit-variants]");
    if (variantTarget) variantTarget.innerHTML = renderVariantFamily(product);
    drawer.hidden = false;
    drawer.setAttribute("aria-hidden", "false");
    window.setTimeout(() => form.elements.name?.focus(), 60);
  }

  function closeEditor() {
    const drawer = $("[data-product-drawer]");
    if (!drawer) return;
    drawer.hidden = true;
    drawer.setAttribute("aria-hidden", "true");
    state.currentProductId = "";
  }

  function payloadFromForm(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const mediaGallery = parseMediaGallery(data.media_gallery);
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
      media_gallery: mediaGallery,
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

  function parseMediaGallery(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8);
    const raw = String(value || "").trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8);
    } catch (error) {
      // Plain comma or newline separated gallery URLs are accepted for Excel/import compatibility.
    }
    return raw.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  }

  async function updateProduct(productId, payload, options) {
    const result = await apiFetch(`/v1/partner/products/${encodeURIComponent(productId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    if (result.product) {
      state.products = state.products.map((product) => String(product.id) === String(productId) ? result.product : product);
    }
    if (!options?.silent) {
      if (result.warnings?.length) showAlert(result.warnings.join(" "));
      else showAlert("");
      toast(result.message || "Ürün revizyonu admin onayına gönderildi.", "success");
    }
    return result.product;
  }

  function toggleSelection(productId, force) {
    const id = String(productId || "");
    if (!id) return;
    const checked = typeof force === "boolean" ? force : !state.selected.has(id);
    if (checked) state.selected.add(id);
    else state.selected.delete(id);
    const input = $(`[data-select-product="${escapeSelector(id)}"]`);
    if (input) input.checked = checked;
    renderSelectedState();
  }

  function selectExact(products, label) {
    const ids = products.map((product) => String(product.id || "")).filter(Boolean);
    state.selected = new Set(ids);
    renderRows();
    toast(`${ids.length} ${label} seçildi.`);
  }

  function markQuickDirty(productId) {
    const rawProduct = productById(productId);
    const row = $(`[data-product-row="${escapeSelector(String(productId))}"]`);
    if (!rawProduct || !row) return;
    const product = normalizeProduct(rawProduct);
    const priceInput = $(`[data-quick-price="${escapeSelector(String(productId))}"]`);
    const stockInput = $(`[data-quick-stock="${escapeSelector(String(productId))}"]`);
    const priceChanged = Number(priceInput?.value || 0) !== Number(product.price || 0);
    const stockChanged = Number(stockInput?.value || 0) !== Number(product.stock || 0);
    row.classList.toggle("has-unsaved-change", priceChanged || stockChanged);
  }

  function quickPayload(productId) {
    const priceInput = $(`[data-quick-price="${escapeSelector(String(productId))}"]`);
    const stockInput = $(`[data-quick-stock="${escapeSelector(String(productId))}"]`);
    const price = Number(priceInput?.value || 0);
    const stock = Number(stockInput?.value || 0);
    if (!Number.isFinite(price) || price < 0) throw new Error("Fiyat değerini kontrol edin.");
    if (!Number.isInteger(stock) || stock < 0) throw new Error("Stok tam sayı olmalı.");
    return { price, stock };
  }

  async function saveQuickProduct(productId, button) {
    setButtonBusy(button, true);
    try {
      await updateProduct(productId, quickPayload(productId));
      renderAll();
    } catch (error) {
      toast(error.message || "Fiyat/stok güncellenemedi.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function publishProduct(productId, button) {
    setButtonBusy(button, true);
    try {
      const result = await apiFetch(`/v1/partner/products/${encodeURIComponent(productId)}/publish`, {
        method: "POST",
        body: JSON.stringify({})
      });
      if (result.product) {
        state.products = state.products.map((product) => String(product.id) === String(productId) ? result.product : product);
      }
      renderAll();
      toast(result.message || "Ürün yayına alındı.", "success");
    } catch (error) {
      toast(error.message || "Ürün yayına alınamadı.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function archiveProduct(productId, button) {
    const product = normalizeProduct(productById(productId) || {});
    const confirmed = window.confirm(`${product.name || "Bu ürün"} yayından kaldırılıp arşivlenecek. Devam edilsin mi?`);
    if (!confirmed) return;
    setButtonBusy(button, true);
    try {
      const result = await apiFetch(`/v1/partner/products/${encodeURIComponent(productId)}`, {
        method: "DELETE"
      });
      if (result.product) {
        state.products = state.products.map((row) => String(row.id) === String(productId) ? result.product : row);
      }
      state.selected.delete(String(productId));
      renderAll();
      toast(result.message || "Ürün arşivlendi.", "success");
    } catch (error) {
      toast(error.message || "Ürün arşivlenemedi.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function submitEditor(form) {
    const productId = form.elements.id?.value || state.currentProductId;
    if (!productId) return;
    const button = form.querySelector("button[type='submit']");
    setButtonBusy(button, true);
    try {
      const payload = payloadFromForm(form);
      if (!payload.name || payload.name.length < 2) throw new Error("Ürün adını kontrol edin.");
      await updateProduct(productId, payload);
      renderAll();
      closeEditor();
    } catch (error) {
      toast(error.message || "Ürün güncellenemedi.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  }

  function bulkPayload(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = {};
    if (String(data.price || "").trim() !== "") payload.price = Number(data.price || 0);
    if (String(data.stock || "").trim() !== "") payload.stock = Number(data.stock || 0);
    if (String(data.category || "").trim()) payload.category = String(data.category || "").trim();
    if (String(data.brand || "").trim()) payload.brand = String(data.brand || "").trim();
    return payload;
  }

  async function submitBulk(form) {
    const ids = [...state.selected];
    if (!ids.length) return;
    const payload = bulkPayload(form);
    if (!Object.keys(payload).length) {
      toast("Toplu revizyon için en az bir alan girin.", "warning");
      return;
    }
    const button = form.querySelector("button[type='submit']");
    setButtonBusy(button, true);
    try {
      for (const productId of ids) {
        await updateProduct(productId, payload, { silent: true });
      }
      state.selected.clear();
      form.reset();
      renderAll();
      toast(`${ids.length} ürün revizyonu admin onayına gönderildi.`, "success");
    } catch (error) {
      toast(error.message || "Toplu revizyon tamamlanamadı.", "error");
    } finally {
      setButtonBusy(button, false);
      renderSelectedState();
    }
  }

  function bindEvents() {
    const debouncedRender = core.debounce ? core.debounce(renderRows, 180) : renderRows;
    document.addEventListener("click", (event) => {
      const refresh = event.target.closest("[data-refresh-products]");
      const edit = event.target.closest("[data-edit-product]");
      const quickSave = event.target.closest("[data-save-quick-product]");
      const publish = event.target.closest("[data-publish-product]");
      const archive = event.target.closest("[data-archive-product]");
      const close = event.target.closest("[data-close-product-drawer]");
      const clear = event.target.closest("[data-clear-product-filters]");
      const selectAllAction = event.target.closest("[data-select-all-products-action]");
      const selectVisible = event.target.closest("[data-select-visible-products]");
      const selectActive = event.target.closest("[data-select-active-products]");
      const selectReady = event.target.closest("[data-select-ready-products]");
      const selectRisk = event.target.closest("[data-select-risk-products]");
      const selectMissingPrice = event.target.closest("[data-select-missing-price-products]");
      const selectMissingStock = event.target.closest("[data-select-missing-stock-products]");
      const selectLowStock = event.target.closest("[data-select-low-stock-products]");
      const clearSelected = event.target.closest("[data-clear-selected-products]");
      const row = event.target.closest("[data-product-row]");
      if (refresh) loadProducts();
      if (edit) openEditor(edit.dataset.editProduct);
      if (quickSave) saveQuickProduct(quickSave.dataset.saveQuickProduct, quickSave);
      if (publish) publishProduct(publish.dataset.publishProduct, publish);
      if (archive) archiveProduct(archive.dataset.archiveProduct, archive);
      if (close) closeEditor();
      if (clear) {
        state.filters = { search: "", status: "all", sort: "updated_desc" };
        const search = $("[data-product-search]");
        const status = $("[data-product-status-filter]");
        const sort = $("[data-product-sort]");
        if (search) search.value = "";
        if (status) status.value = "all";
        if (sort) sort.value = "updated_desc";
        renderRows();
      }
      if (selectVisible) {
        selectExact(visibleProducts().map(normalizeProduct), "görünen ürün");
      }
      if (selectAllAction) {
        selectExact(state.products.map(normalizeProduct), "ürün");
      }
      if (selectReady) {
        selectExact(visibleProducts().map(normalizeProduct).filter(isReadyProduct), "onaya hazır ürün");
      }
      if (selectRisk) {
        selectExact(visibleProducts().map(normalizeProduct).filter(isRiskProduct), "riskli ürün");
      }
      if (selectActive) {
        selectExact(visibleProducts().map(normalizeProduct).filter(isActive), "yayındaki ürün");
      }
      if (selectMissingPrice) {
        selectExact(visibleProducts().map(normalizeProduct).filter(isMissingPriceProduct), "fiyatı olmayan ürün");
      }
      if (selectMissingStock) {
        selectExact(visibleProducts().map(normalizeProduct).filter(isMissingStockProduct), "stoku olmayan ürün");
      }
      if (selectLowStock) {
        selectExact(visibleProducts().map(normalizeProduct).filter(isCriticalStockProduct), "stoku az kalan ürün");
      }
      if (clearSelected) {
        state.selected.clear();
        renderRows();
      }
      if (row && !event.target.closest("button,a,input,select,textarea,label")) {
        toggleSelection(row.dataset.productRow);
      }
    });

    document.addEventListener("input", (event) => {
      if (event.target.matches("[data-product-search]")) {
        state.filters.search = event.target.value || "";
        debouncedRender();
      }
      if (event.target.closest("[data-product-edit-form]")) {
        const rawProduct = productById(state.currentProductId) || {};
        renderEditorPreview(normalizeProduct(rawProduct));
      }
      if (event.target.matches("[data-quick-price], [data-quick-stock]")) {
        markQuickDirty(event.target.dataset.quickPrice || event.target.dataset.quickStock);
      }
    });

    document.addEventListener("change", (event) => {
      if (event.target.matches("[data-product-status-filter]")) {
        state.filters.status = event.target.value || "all";
        renderRows();
      }
      if (event.target.matches("[data-product-sort]")) {
        state.filters.sort = event.target.value || "updated_desc";
        renderRows();
      }
      if (event.target.matches("[data-product-page-size]")) {
        state.pageSize = Number(event.target.value || 50) || 50;
        renderRows();
      }
      if (event.target.matches("[data-select-product]")) {
        const id = String(event.target.dataset.selectProduct || "");
        toggleSelection(id, event.target.checked);
      }
      if (event.target.matches("[data-select-all-products]")) {
        const ids = visibleProducts().map((product) => String(product.id));
        if (event.target.checked) ids.forEach((id) => state.selected.add(id));
        else ids.forEach((id) => state.selected.delete(id));
        renderRows();
      }
    });

    document.addEventListener("submit", (event) => {
      const editForm = event.target.closest("[data-product-edit-form]");
      const bulkForm = event.target.closest("[data-bulk-product-form]");
      if (editForm) {
        event.preventDefault();
        submitEditor(editForm);
      }
      if (bulkForm) {
        event.preventDefault();
        submitBulk(bulkForm);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeEditor();
    });
  }

  function init() {
    bindEvents();
    loadProducts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
