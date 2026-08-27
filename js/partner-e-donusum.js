(function () {
  const App = window.Allona = window.Allona || {};
  const ui = App.eDonusum;
  const state = { view: "dashboard", currentUserId: "", context: { organizationId: "", legalEntityId: "", sellerId: "", channelAccountId: "" }, organizations: [], legalEntities: [], sellers: [], channelAccounts: [], providerAccounts: [], invoiceProfiles: [], invoiceSettings: [], catalog: {}, pages: {}, visibleInvoices: new Map() };
  let dialogAction = "";
  let loadGeneration = 0;
  let bootstrapGeneration = 0;
  const meta = {
    dashboard: ["e-Dönüşüm Dashboard", "Şirketinizin fatura, hata ve kanal görünümü."],
    invoices: ["Faturalar", "Bir siparişin farklı satıcı faturaları ayrı gösterilir."],
    failures: ["Fatura Hataları", "Resolver, provider ve kanal hataları request ID ile izlenir."],
    returns: ["İade Belgeleri", "Sipariş iadesinden ayrı belge iş akışı."],
    cancellations: ["Fatura İptalleri", "Sipariş iptali otomatik olarak fatura iptali sayılmaz."],
    commissions: ["Komisyon Faturaları", "AllonaHub komisyon faturaları satış faturalarından ayrıdır."],
    reconciliation: ["Mutabakat", "Satış, iade, kesinti ve payout karşılaştırması."],
    providers: ["e-Dönüşüm Entegratörüm", "Şirketiniz mevcut özel entegratörünü koruyabilir."],
    channels: ["Mağazalarım", "Her mağazanın capability ve bağlantı durumu."],
    profiles: ["Fatura Profilim", "Şirket senaryosu, para birimi ve varsayılan birim kodu."],
    settings: ["Fatura Ayarlarım", "Tetikleme ve e-Fatura/e-Arşiv fallback kararı şirket bazındadır."]
  };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const content = () => $("[data-partner-edoc-content]");

  function returnIdempotencyStorageKey(invoiceId) { return `allonahub.edoc.return.partner.${state.currentUserId || "signed-out"}.${invoiceId}`; }
  function returnIdempotencyKey(invoiceId) {
    const storageKey = returnIdempotencyStorageKey(invoiceId);
    const stored = readReturnRequest(invoiceId);
    let key = stored?.idempotencyKey || "";
    if (!key) {
      key = `partner-return:${crypto.randomUUID()}`;
      window.sessionStorage.setItem(storageKey, JSON.stringify({ idempotencyKey: key }));
    }
    return key;
  }
  function readReturnRequest(invoiceId) {
    const raw = window.sessionStorage.getItem(returnIdempotencyStorageKey(invoiceId));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || (parsed.userId && parsed.userId !== state.currentUserId)) return null;
      return parsed;
    } catch (_) { return { idempotencyKey: raw }; }
  }
  function storeReturnRequest(invoiceId, payload) { window.sessionStorage.setItem(returnIdempotencyStorageKey(invoiceId), JSON.stringify({ userId: state.currentUserId, idempotencyKey: payload.idempotencyKey, payload })); }
  function clearReturnIdempotencyKey(invoiceId) { window.sessionStorage.removeItem(returnIdempotencyStorageKey(invoiceId)); }
  async function createOrReconcileReturn(invoiceId, payload) {
    storeReturnRequest(invoiceId, payload);
    try {
      return await ui.request(`/v1/e-invoicing/invoices/${encodeURIComponent(invoiceId)}/returns`, { method: "POST", body: JSON.stringify(payload) });
    } catch (requestError) {
      try {
        const query = ui.query({ organizationId: payload.organizationId, idempotencyKey: payload.idempotencyKey });
        const reconciled = await ui.request(`/v1/e-invoicing/invoices/${encodeURIComponent(invoiceId)}/returns/by-idempotency?${query}`);
        if (reconciled?.found) return { ...reconciled, reconciled: true };
      } catch (_) {
        const preserveAmbiguous = !requestError.status || requestError.status >= 500 || [408, 425, 429].includes(requestError.status) || requestError.code === "RETURN_REQUEST_IN_PROGRESS";
        if (!preserveAmbiguous) {
          clearReturnIdempotencyKey(invoiceId);
        }
      }
      throw requestError;
    }
  }

  function notice(message) { const el = $("[data-partner-edoc-notice]"); el.hidden = !message; el.textContent = message || ""; }
  function optionize(el, items, label, empty) { const selected = el.value; el.innerHTML = `<option value="">${ui.escape(empty)}</option>${items.map((item) => `<option value="${ui.escape(item.id)}">${ui.escape(label(item))}</option>`).join("")}`; if (items.some((item) => item.id === selected)) el.value = selected; }
  function syncSelectors() {
    if (!state.organizations.some((item) => item.id === state.context.organizationId)) {
      state.context.organizationId = state.organizations[0]?.id || "";
      Object.assign(state.context, { legalEntityId: "", sellerId: "", channelAccountId: "" });
    }
    if (state.context.legalEntityId && !state.legalEntities.some((item) => item.id === state.context.legalEntityId && item.organization_id === state.context.organizationId)) Object.assign(state.context, { legalEntityId: "", sellerId: "", channelAccountId: "" });
    if (state.context.sellerId && !state.sellers.some((item) => item.id === state.context.sellerId && item.organization_id === state.context.organizationId && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId))) Object.assign(state.context, { sellerId: "", channelAccountId: "" });
    if (state.context.channelAccountId && !state.channelAccounts.some((item) => item.id === state.context.channelAccountId && item.organization_id === state.context.organizationId && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId) && (!state.context.sellerId || item.seller_id === state.context.sellerId))) state.context.channelAccountId = "";
    optionize($("[data-partner-edoc-context=organization]"), state.organizations, (item) => item.name, "Organizasyon seçin");
    $("[data-partner-edoc-context=organization]").value = state.context.organizationId;
    const legal = state.legalEntities.filter((item) => !state.context.organizationId || item.organization_id === state.context.organizationId);
    const sellers = state.sellers.filter((item) => (!state.context.organizationId || item.organization_id === state.context.organizationId) && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId));
    const accounts = state.channelAccounts.filter((item) =>
      (!state.context.organizationId || item.organization_id === state.context.organizationId)
      && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId)
      && (!state.context.sellerId || item.seller_id === state.context.sellerId));
    optionize($("[data-partner-edoc-context=legalEntity]"), legal, (item) => item.display_name || item.legal_name, "Tüm şirketler");
    optionize($("[data-partner-edoc-context=seller]"), sellers, (item) => item.display_name, "Tüm satıcılar");
    optionize($("[data-partner-edoc-context=channelAccount]"), accounts, (item) => item.account_name, "Tüm mağazalar");
    $("[data-partner-edoc-context=legalEntity]").value = state.context.legalEntityId;
    $("[data-partner-edoc-context=seller]").value = state.context.sellerId;
    $("[data-partner-edoc-context=channelAccount]").value = state.context.channelAccountId;
    $("[data-partner-edoc-context-state]").textContent = state.context.organizationId ? "Yetkili tenant bağlamı" : "Organizasyon seçin";
  }
  function params(extra = {}) { return ui.query({ organizationId: state.context.organizationId, legalEntityId: state.context.legalEntityId, sellerId: state.context.sellerId, channelAccountId: state.context.channelAccountId, ...extra }); }
  function panel(title, subtitle, body) { return `<section class="edoc-panel"><header class="edoc-panel-head"><div><h2>${ui.escape(title)}</h2><p>${ui.escape(subtitle)}</p></div></header>${body}</section>`; }
  function kpi(label, value, note = "") { return `<article class="edoc-kpi"><span>${ui.escape(label)}</span><strong>${ui.escape(value)}</strong><small>${ui.escape(note)}</small></article>`; }
  function pagination(payload) {
    const page = Math.max(1, Number(payload.page || 1));
    const pageSize = Math.max(1, Number(payload.pageSize || 25));
    const total = Math.max(0, Number(payload.total || 0));
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (pages <= 1) return "";
    return `<nav class="edoc-pagination" aria-label="Sayfalama"><button class="edoc-button" type="button" data-partner-edoc-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Önceki</button><span>Sayfa ${ui.escape(page)} / ${ui.escape(pages)}</span><button class="edoc-button" type="button" data-partner-edoc-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Sonraki</button></nav>`;
  }
  function scopedChannelAccounts() {
    return state.channelAccounts.filter((item) =>
      (!state.context.organizationId || item.organization_id === state.context.organizationId)
      && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId)
      && (!state.context.sellerId || item.seller_id === state.context.sellerId)
      && (!state.context.channelAccountId || item.id === state.context.channelAccountId));
  }
  function scopedProviderAccounts() {
    return state.providerAccounts.filter((item) =>
      (!state.context.organizationId || item.organization_id === state.context.organizationId)
      && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId));
  }
  function selectedLegalCanManage() { return state.legalEntities.some((item) => item.id === state.context.legalEntityId && item.can_manage === true); }
  function selectedSellerCanManage() { return state.sellers.some((item) => item.id === state.context.sellerId && item.can_manage === true); }
  function invoiceCanManage(invoice) {
    return state.legalEntities.some((item) => item.id === invoice.legal_entity_id && item.can_manage === true)
      || state.sellers.some((item) => item.id === invoice.seller_id && item.can_manage === true);
  }

  async function dashboard(generation) {
    if (!state.context.organizationId) { content().innerHTML = ui.empty("Şirket bağlantısı bekleniyor", "Partner hesabı organization/legal entity ile eşlenmeden fatura oluşturulmaz."); return; }
    const payload = await ui.request(`/v1/e-invoicing/dashboard?${params()}`);
    if (generation !== loadGeneration) return;
    const s = payload.summary || {};
    const total = Object.entries(s.totalAmount || {}).map(([currency, value]) => ui.exactMoney(value, currency)).join(" · ") || "0,00 TRY";
    const accounts = scopedChannelAccounts();
    content().innerHTML = `<section class="edoc-kpis">${kpi("Bugün", s.today || 0)}${kpi("Bu Ay", s.month || 0)}${kpi("Bu Ay Toplam", total, "Belge para biriminde")}${kpi("Başarılı", s.successful || 0)}${kpi("İnceleme", s.pending || 0)}</section><div class="edoc-grid edoc-grid--two">${panel("Bağlı mağazalar", "Capability görünümü", `<div class="edoc-panel-body">${ui.capabilityLegend()}<div class="edoc-channel-list">${accounts.length ? accounts.map((account) => ui.capabilityRow({ displayName: account.account_name, capabilities: { ...(account.sales_channels?.capabilities || {}), ...(account.capabilities || {}) } })).join("") : ui.empty("Mağaza bağlantısı yok", "Satış kanalı hesabı bağlandığında capability durumu burada görünür.")}</div></div>`)}${panel("Belge sağlığı", "Tenant kapsamındaki bu ay", `<div class="edoc-panel-body edoc-status-stack"><div class="edoc-status-row"><span>Başarılı</span><strong>${s.successful || 0}</strong></div><div class="edoc-status-row"><span>Hatalı</span><strong>${s.failed || 0}</strong></div><div class="edoc-status-row"><span>İptal</span><strong>${s.cancelled || 0}</strong></div><div class="edoc-status-row"><span>İade</span><strong>${s.returned || 0}</strong></div></div>`)}</div>`;
  }

  async function invoices(generation) {
    if (!state.context.organizationId) { content().innerHTML = ui.empty("Organizasyon seçin", "Faturalar tenant seçilmeden gösterilmez."); return; }
    const payload = await ui.request(`/v1/e-invoicing/invoices?${params({ page: state.pages.invoices || 1, pageSize: 25 })}`);
    if (generation !== loadGeneration) return;
    const lastPage = Math.max(1, Math.ceil(Number(payload.total || 0) / Math.max(1, Number(payload.pageSize || 25))));
    if ((state.pages.invoices || 1) > lastPage) { state.pages.invoices = lastPage; return invoices(generation); }
    state.visibleInvoices = new Map((payload.items || []).map((item) => [item.id, item]));
    const rows = (payload.items || []).map((item) => {
      const customerSaleDocument = item.document_scope === "CUSTOMER_SALE" && ["E_INVOICE", "E_ARCHIVE"].includes(item.document_type);
      const canManage = invoiceCanManage(item);
      return `<tr><td><strong>${ui.escape(item.invoice_number || "Numara bekleniyor")}</strong><br><small>${ui.escape(item.sales_channel_order_id || item.order_id)}</small></td><td>${ui.escape(item.sales_channel || "-")}</td><td>${ui.escape(item.document_type)}</td><td>${ui.exactMoney(item.grand_total, item.currency)}</td><td>${ui.badge(item.status)}</td><td><button class="edoc-button" data-partner-artifact="pdf" data-invoice-id="${ui.escape(item.id)}" ${item.has_pdf ? "" : "disabled title=\"PDF henüz hazır değil\""}>PDF</button> <button class="edoc-button" data-partner-artifact="xml" data-invoice-id="${ui.escape(item.id)}" ${item.has_xml ? "" : "disabled title=\"XML henüz hazır değil\""}>XML</button>${canManage && item.can_create_return === true ? ` <button class="edoc-button" data-partner-workflow="return" data-invoice-id="${ui.escape(item.id)}">İade</button>` : ""}${canManage && item.can_cancel === true ? ` <button class="edoc-button" data-partner-workflow="cancel" data-invoice-id="${ui.escape(item.id)}">İptal</button>` : ""}</td></tr>`;
    }).join("");
    content().innerHTML = panel("Faturalar", `${payload.total || 0} kayıt`, rows ? `<div class="edoc-table-wrap"><table class="edoc-table"><thead><tr><th>Fatura / Sipariş</th><th>Kanal</th><th>Belge</th><th>Tutar</th><th>Durum</th><th>Dosya</th></tr></thead><tbody>${rows}</tbody></table></div>${pagination(payload)}` : ui.empty("Fatura yok", "Seçili tenant bağlamında fatura kaydı bulunamadı."));
  }

  function resourceAmount(view, item) {
    if (!item.currency) return "-";
    const fields = {
      returns: [["İade", "grand_total"]],
      commissions: [["Komisyon", "commission_total"], ["Net", "net_payable"]],
      reconciliation: [["Net", "net_payable"], ["Fark", "variance"]]
    }[view] || [];
    const values = fields.filter(([, key]) => item[key] !== undefined && item[key] !== null);
    if (!values.length) return "-";
    return values.map(([label, key]) => `<span><small>${ui.escape(label)}:</small> ${ui.exactMoney(item[key], item.currency)}</span>`).join("<br>");
  }

  async function resource(view, generation) {
    if (!state.context.organizationId) { content().innerHTML = ui.empty("Organizasyon seçin", "Kayıtlar tenant seçilmeden gösterilmez."); return; }
    const payload = await ui.request(`/v1/e-invoicing/resources/${view}?${params({ page: state.pages[view] || 1, pageSize: 25 })}`);
    if (generation !== loadGeneration) return;
    const lastPage = Math.max(1, Math.ceil(Number(payload.total || 0) / Math.max(1, Number(payload.pageSize || 25))));
    if ((state.pages[view] || 1) > lastPage) { state.pages[view] = lastPage; return resource(view, generation); }
    const hasReturnActions = view === "returns";
    const rows = (payload.items || []).map((item) => {
      const action = hasReturnActions
        ? `<td>${item.can_reject === true && invoiceCanManage(item) ? `<button class="edoc-button" type="button" data-partner-return-reject="${ui.escape(item.id)}">Talebi Reddet</button>` : "-"}</td>`
        : "";
      return `<tr><td>${ui.escape(item.invoice_id || item.original_invoice_id || item.seller_id || item.id)}</td><td>${ui.escape(item.error_code || item.reason_code || item.action || item.period_start || "-")}</td><td>${resourceAmount(view, item)}</td><td>${ui.badge(item.status || item.processing_status || "-")}</td><td>${ui.escape(item.created_at || "-")}</td>${action}</tr>`;
    }).join("");
    content().innerHTML = panel(meta[view][0], meta[view][1], rows ? `<div class="edoc-table-wrap"><table class="edoc-table"><thead><tr><th>Kayıt</th><th>Açıklama</th><th>Tutar/Fark</th><th>Durum</th><th>Tarih</th>${hasReturnActions ? "<th>İşlem</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div>${pagination(payload)}` : ui.empty("Kayıt yok", "Bu bölümde henüz kayıt bulunmuyor."));
  }

  function configuration(view) {
    if (view === "channels") {
      const accounts = scopedChannelAccounts().map((account) => `<div class="edoc-config-row">${ui.capabilityRow({ displayName: `${account.account_name} · ${account.environment} · ${account.status}`, capabilities: { ...(account.sales_channels?.capabilities || {}), ...(account.capabilities || {}) } })}<div class="edoc-row-actions"><button class="edoc-button" type="button" data-partner-test-channel="${ui.escape(account.id)}" ${account.can_manage ? "" : "disabled title=\"Yönetim yetkisi gerekli\""}>Test Et</button>${account.can_manage && account.status === "connected" ? `<button class="edoc-button" type="button" data-partner-connection-status="paused" data-partner-connection-resource="sales-channel-accounts" data-partner-connection-id="${ui.escape(account.id)}">Duraklat</button><button class="edoc-button" type="button" data-partner-connection-status="disconnected" data-partner-connection-resource="sales-channel-accounts" data-partner-connection-id="${ui.escape(account.id)}">Yerel Olarak Kapat</button>` : ""}</div></div>`).join("");
      content().innerHTML = panel("Mağazalarım", "Sipariş, iade, fatura, stok ve fiyat capability durumu", `<div class="edoc-toolbar"><button class="edoc-button is-primary" type="button" data-partner-config="channel" ${state.context.sellerId && selectedSellerCanManage() ? "" : "disabled"}>Mağaza Bağla</button></div><div class="edoc-panel-body">${ui.capabilityLegend()}<div class="edoc-channel-list">${accounts || ui.empty("Mağaza yok", "Yetkili bir satış kanalı hesabı bulunamadı.")}</div></div>`);
      return;
    }
    if (view === "providers") {
      const providers = scopedProviderAccounts().map((item) => `<div class="edoc-status-row"><div><strong>${ui.escape(item.account_label)}</strong><br><small>${ui.escape(item.provider_key)} · ${ui.escape(item.environment)}</small></div><div class="edoc-row-actions">${ui.badge(item.status)}<button class="edoc-button" type="button" data-partner-test-provider="${ui.escape(item.id)}" ${item.can_manage ? "" : "disabled title=\"Yönetim yetkisi gerekli\""}>Test Et</button>${item.can_manage && item.status === "connected" ? `<button class="edoc-button" type="button" data-partner-connection-status="paused" data-partner-connection-resource="provider-accounts" data-partner-connection-id="${ui.escape(item.id)}">Duraklat</button><button class="edoc-button" type="button" data-partner-connection-status="disconnected" data-partner-connection-resource="provider-accounts" data-partner-connection-id="${ui.escape(item.id)}">Yerel Olarak Kapat</button>` : ""}</div></div>`).join("");
      content().innerHTML = panel("e-Dönüşüm Entegratörüm", "Provider hesabı legal entity seviyesindedir; secret değeri ekrana geri dönmez.", `<div class="edoc-toolbar"><button class="edoc-button is-primary" type="button" data-partner-config="provider" ${state.context.legalEntityId && selectedLegalCanManage() ? "" : "disabled"}>Entegratör Bağla</button></div><div class="edoc-panel-body">${providers || ui.empty("Entegratör hesabı yok", "Credential reference üzerinden sağlayıcı hesabınızı bağlayabilirsiniz. Mock provider production faturası üretmez.")}</div>`);
      return;
    }
    if (view === "profiles") {
      const profiles = state.invoiceProfiles.filter((item) => (!state.context.organizationId || item.organization_id === state.context.organizationId) && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId));
      content().innerHTML = panel(meta[view][0], meta[view][1], `<div class="edoc-toolbar"><button class="edoc-button is-primary" type="button" data-partner-config="profile" ${state.context.legalEntityId && selectedLegalCanManage() ? "" : "disabled"}>Profil Ekle</button></div><div class="edoc-panel-body">${profiles.length ? profiles.map((item) => `<div class="edoc-status-row"><div><strong>${ui.escape(item.profile_name)}</strong><br><small>${ui.escape(item.default_scenario)} · ${ui.escape(item.default_currency)}</small></div><div class="edoc-row-actions">${ui.badge(item.status)}${item.can_manage && item.status !== "active" ? `<button class="edoc-button" type="button" data-partner-activate-profile="${ui.escape(item.id)}">Aktifleştir</button>` : ""}</div></div>`).join("") : ui.empty("Fatura profili yok", "Aktif profil olmadan otomatik belge oluşturulmaz.")}</div>`);
      return;
    }
    const settings = state.invoiceSettings.filter((item) => (!state.context.organizationId || item.organization_id === state.context.organizationId) && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId));
    content().innerHTML = panel(meta[view][0], meta[view][1], `<div class="edoc-toolbar"><button class="edoc-button is-primary" type="button" data-partner-config="settings" ${state.context.legalEntityId && selectedLegalCanManage() ? "" : "disabled"}>Ayar Kaydet</button></div><div class="edoc-panel-body">${settings.length ? settings.map((item) => `<div class="edoc-status-row"><div><strong>${ui.escape(item.trigger_event)}</strong><br><small>${ui.escape(item.document_type_fallback)} · ${item.auto_upload_to_channel ? "Otomatik kanal aktarımı" : "Manuel kanal aktarımı"}</small></div>${ui.badge(item.is_active ? "active" : "paused")}</div>`).join("") : ui.empty("Ayar yok", "Güvenli başlangıç MANUAL ve MANUAL_REVIEW'dur.")}</div>`);
  }

  async function load(view) {
    const generation = ++loadGeneration;
    state.view = meta[view] ? view : "dashboard";
    $$('[data-partner-edoc-view]').forEach((button) => {
      const active = button.dataset.partnerEdocView === state.view;
      button.classList.toggle("is-active", active);
      active ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
    });
    $("[data-partner-edoc-title]").textContent = meta[state.view][0];
    $("[data-partner-edoc-subtitle]").textContent = meta[state.view][1];
    history.replaceState(null, "", `#${state.view}`);
    content().innerHTML = ui.loading(`${meta[state.view][0]} yükleniyor…`);
    notice("");
    try {
      if (state.view === "dashboard") await dashboard(generation);
      else if (state.view === "invoices") await invoices(generation);
      else if (["providers", "channels", "profiles", "settings"].includes(state.view)) configuration(state.view);
      else await resource(state.view, generation);
    } catch (error) {
      if (generation !== loadGeneration) return;
      notice(error.message || "Veriler yüklenemedi."); content().innerHTML = ui.empty("Veri alınamadı", "Tenant yetkisi, migration ve backend durumunu kontrol edin.");
    }
  }

  function optionHtml(items, key, label) { return items.map((item) => `<option value="${ui.escape(item[key])}">${ui.escape(label(item))}</option>`).join(""); }

  function showDialog(action) {
    const dialog = $("[data-partner-edoc-dialog]");
    const org = state.context.organizationId;
    const legal = state.context.legalEntityId;
    const profiles = state.invoiceProfiles.filter((item) => item.organization_id === org && item.legal_entity_id === legal && item.status === "active");
    const providers = state.providerAccounts.filter((item) => item.organization_id === org && item.legal_entity_id === legal && item.status === "connected");
    const accounts = state.channelAccounts.filter((item) => item.organization_id === org && item.legal_entity_id === legal);
    const definitions = {
      channel: ["Mağaza bağla", `<label>Kanal<select name="channelKey">${optionHtml(state.catalog.salesChannels || [], "providerKey", (item) => item.displayName)}</select></label><label>Ortam<select name="channelEnvironment"><option value="local">Local</option><option value="sandbox" selected>Sandbox</option><option value="production">Production</option></select></label><label>Hesap adı<input name="accountName" required maxlength="160"></label><label>Harici hesap ID<input name="externalAccountId" maxlength="180"></label><label>Credential reference<input name="credentialReference" maxlength="300" placeholder="vault:... veya secret:INVOICE_..."></label>`],
      provider: ["Entegratör bağla", `<label>Provider<select name="providerKey">${optionHtml(state.catalog.invoiceProviders || [], "providerKey", (item) => `${item.displayName} · ${item.implementation}`)}</select></label><label>Hesap etiketi<input name="accountLabel" required maxlength="120"></label><label>Ortam<select name="environment"><option value="mock">Mock</option><option value="sandbox">Sandbox</option><option value="production">Production</option></select></label><label>Credential reference<input name="credentialReference" maxlength="300"></label><label>Webhook secret reference<input name="webhookSecretReference" maxlength="300"></label>`],
      profile: ["Fatura profili ekle", `<label>Profil adı<input name="profileName" required maxlength="160"></label><label>Belge öneki<input name="documentPrefix" maxlength="20"></label><label>Senaryo<input name="defaultScenario" value="TEMELFATURA" required></label><label>Para birimi<input name="defaultCurrency" value="TRY" maxlength="3" required></label><label>Birim kodu<input name="defaultUnitCode" value="C62" required></label><label class="edoc-check-label"><input name="isDefault" type="checkbox"> Varsayılan profil</label>`],
      settings: ["Fatura ayarı", `<label>Fatura profili<select name="invoiceProfileId" required><option value="">Seçin</option>${optionHtml(profiles, "id", (item) => item.profile_name)}</select></label><label>Entegratör<select name="invoiceProviderAccountId" required><option value="">Seçin</option>${optionHtml(providers, "id", (item) => item.account_label)}</select></label><label>Mağaza<select name="salesChannelAccountId"><option value="">Şirket geneli</option>${optionHtml(accounts, "id", (item) => item.account_name)}</select></label><label>Tetikleme<select name="triggerEvent"><option>MANUAL</option><option>PAYMENT_COMPLETED</option><option>ORDER_CONFIRMED</option><option>READY_TO_SHIP</option><option>SHIPPED</option><option>DELIVERED</option></select></label><label>Belge tipi fallback<select name="documentTypeFallback"><option>MANUAL_REVIEW</option><option>E_INVOICE</option><option>E_ARCHIVE</option></select></label><label>Maksimum deneme<input name="maxRetryCount" type="number" min="1" max="20" value="4"></label><label class="edoc-check-label"><input name="autoUploadToChannel" type="checkbox"> Desteklenen kanala otomatik aktar</label>`]
    };
    const definition = definitions[action]; if (!definition) return;
    dialogAction = action;
    $("[data-partner-edoc-dialog-title]").textContent = definition[0];
    $("[data-partner-edoc-dialog-body]").innerHTML = `<div class="edoc-dialog-fields">${definition[1]}<p>Secret değeri değil, yalnız server-side credential reference girilir.</p></div>`;
    if (action === "channel") {
      const channel = dialog.querySelector("[name=channelKey]");
      const environment = dialog.querySelector("[name=channelEnvironment]");
      const syncEnvironment = () => {
        const local = ["allonahub", "allona_shop"].includes(channel?.value);
        if (local) environment.value = "local";
        else if (environment.value === "local") environment.value = "sandbox";
        const credential = dialog.querySelector("[name=credentialReference]");
        if (credential) { credential.required = !local; if (local) credential.value = ""; }
      };
      channel?.addEventListener("change", syncEnvironment);
      syncEnvironment();
    }
    if (action === "provider") {
      const provider = dialog.querySelector("[name=providerKey]");
      const environment = dialog.querySelector("[name=environment]");
      const syncProviderEnvironment = () => {
        const mock = provider?.value === "mock";
        if (mock) environment.value = "mock";
        else if (environment.value === "mock") environment.value = "sandbox";
        Array.from(environment.options).forEach((option) => { option.disabled = mock ? option.value !== "mock" : option.value === "mock"; });
        const credential = dialog.querySelector("[name=credentialReference]");
        if (credential) { credential.required = !mock; if (mock) credential.value = ""; }
      };
      provider?.addEventListener("change", syncProviderEnvironment);
      syncProviderEnvironment();
    }
    if (action === "settings") {
      const accountSelect = dialog.querySelector("[name=salesChannelAccountId]");
      const autoUpload = dialog.querySelector("[name=autoUploadToChannel]");
      const syncAutoUpload = () => {
        const account = accounts.find((item) => item.id === accountSelect?.value);
        const capabilities = account?.capabilities || {};
        const channelKey = account?.sales_channels?.channel_key;
        const local = ["allonahub", "allona_shop"].includes(channelKey);
        const supported = Boolean(account && account.status === "connected" && (capabilities.invoiceUpload || capabilities.invoiceMetadata) && (local || state.catalog.externalChannelCallsEnabled));
        autoUpload.disabled = !supported;
        if (!supported) autoUpload.checked = false;
        autoUpload.closest("label").title = supported ? "" : "Otomatik aktarım için bağlı ve bu yeteneği destekleyen belirli bir mağaza seçin.";
      };
      accountSelect?.addEventListener("change", syncAutoUpload);
      syncAutoUpload();
    }
    dialog.returnValue = ""; dialog.showModal();
  }

  async function submitDialog(action) {
    const dialog = $("[data-partner-edoc-dialog]");
    const value = (name) => String(dialog.querySelector(`[name=${name}]`)?.value || "").trim();
    const checked = (name) => dialog.querySelector(`[name=${name}]`)?.checked === true;
    const org = state.context.organizationId; const legal = state.context.legalEntityId;
    const requests = {
      channel: ["/v1/e-invoicing/sales-channel-accounts", "POST", { organizationId: org, legalEntityId: legal, sellerId: state.context.sellerId, channelKey: value("channelKey"), environment: value("channelEnvironment"), accountName: value("accountName"), externalAccountId: value("externalAccountId") || null, credentialReference: value("credentialReference") || null }],
      provider: ["/v1/e-invoicing/provider-accounts", "POST", { organizationId: org, legalEntityId: legal, providerKey: value("providerKey"), accountLabel: value("accountLabel"), environment: value("environment"), credentialReference: value("credentialReference") || null, webhookSecretReference: value("webhookSecretReference") || null }],
      profile: ["/v1/e-invoicing/invoice-profiles", "POST", { organizationId: org, legalEntityId: legal, profileName: value("profileName"), documentPrefix: value("documentPrefix") || null, defaultScenario: value("defaultScenario"), defaultCurrency: value("defaultCurrency").toUpperCase(), defaultUnitCode: value("defaultUnitCode"), taxConfiguration: {}, isDefault: checked("isDefault") }],
      settings: ["/v1/e-invoicing/settings", "PUT", { organizationId: org, legalEntityId: legal, salesChannelAccountId: value("salesChannelAccountId") || null, invoiceProfileId: value("invoiceProfileId"), invoiceProviderAccountId: value("invoiceProviderAccountId"), triggerEvent: value("triggerEvent"), documentTypeFallback: value("documentTypeFallback"), autoUploadToChannel: checked("autoUploadToChannel"), maxRetryCount: Number(value("maxRetryCount") || 4) }]
    };
    const [path, method, body] = requests[action] || []; if (!path) return;
    await ui.request(path, { method, body: JSON.stringify(body) });
    await bootstrap(); notice("Yapılandırma kaydedildi.");
  }

  async function showInvoiceWorkflow(action, invoiceId) {
    const dialog = $("[data-partner-edoc-dialog]");
    dialog.dataset.invoiceId = invoiceId;
    dialog.dataset.organizationId = state.visibleInvoices.get(invoiceId)?.organization_id || state.context.organizationId;
    if (action === "cancel") {
      dialogAction = "cancel-invoice";
      $("[data-partner-edoc-dialog-title]").textContent = "Fatura iptal akışı";
      $("[data-partner-edoc-dialog-body]").innerHTML = `<div class="edoc-dialog-fields"><p>Sipariş iptali ve fatura iptali ayrı iş akışlarıdır.</p><label>Neden kodu<input name="reasonCode" maxlength="80"></label><label>Açıklama<textarea name="reasonNote" maxlength="1000"></textarea></label></div>`;
    } else {
      const pending = readReturnRequest(invoiceId);
      const invoiceOrganizationId = state.visibleInvoices.get(invoiceId)?.organization_id || state.context.organizationId;
      if (pending?.payload && pending.payload.organizationId !== invoiceOrganizationId) clearReturnIdempotencyKey(invoiceId);
      else if (pending?.payload) {
        await createOrReconcileReturn(invoiceId, pending.payload);
        clearReturnIdempotencyKey(invoiceId);
        await load("invoices");
        notice("Önceki iade isteği aynı idempotency anahtarıyla uzlaştırıldı.");
        return;
      }
      const detail = await ui.request(`/v1/e-invoicing/invoices/${encodeURIComponent(invoiceId)}`);
      const returnableItems = (detail.items || []).filter((item) => Number(item.returnable_quantity ?? item.quantity) > 0);
      if (!returnableItems.length) throw new Error("İade edilebilir fatura kalemi bulunamadı.");
      dialogAction = "return-invoice";
      dialog.dataset.returnIdempotencyKey = returnIdempotencyKey(invoiceId);
      $("[data-partner-edoc-dialog-title]").textContent = "Kısmi / tam iade";
      $("[data-partner-edoc-dialog-body]").innerHTML = `<div class="edoc-dialog-fields"><p>İade edilecek adetleri girin; sistem orijinal vergi dağılımını korur.</p>${returnableItems.map((item) => {
        const remaining = item.returnable_quantity ?? item.quantity;
        return `<label>${ui.escape(item.description)} · Kalan ${ui.escape(remaining)}<input type="number" min="0" max="${ui.escape(remaining)}" step="0.0001" value="0" data-partner-return-item="${ui.escape(item.id)}"></label>`;
      }).join("")}<label>Neden kodu<input name="reasonCode" maxlength="80"></label><label>Açıklama<textarea name="reasonNote" maxlength="1000"></textarea></label></div>`;
    }
    dialog.returnValue = ""; dialog.showModal();
  }

  async function submitInvoiceWorkflow(action) {
    const dialog = $("[data-partner-edoc-dialog]");
    const invoiceId = dialog.dataset.invoiceId;
    const organizationId = dialog.dataset.organizationId;
    const reasonCode = String(dialog.querySelector("[name=reasonCode]")?.value || "").trim() || null;
    const reasonNote = String(dialog.querySelector("[name=reasonNote]")?.value || "").trim() || null;
    if (action === "cancel-invoice") {
      await ui.request(`/v1/e-invoicing/invoices/${encodeURIComponent(invoiceId)}/cancellations`, { method: "POST", body: JSON.stringify({ organizationId, reasonCode, reasonNote }) });
    } else {
      const items = $$('[data-partner-return-item]').map((input) => ({ originalInvoiceItemId: input.dataset.partnerReturnItem, quantity: String(input.value || "0") })).filter((item) => Number(item.quantity) > 0);
      if (!items.length) throw new Error("En az bir iade adedi girin.");
      const idempotencyKey = dialog.dataset.returnIdempotencyKey || returnIdempotencyKey(invoiceId);
      await createOrReconcileReturn(invoiceId, { organizationId, idempotencyKey, reasonCode, reasonNote, items });
      clearReturnIdempotencyKey(invoiceId);
      delete dialog.dataset.returnIdempotencyKey;
    }
    await load("invoices"); notice(action === "cancel-invoice" ? "Fatura iptal işi kuyruğa alındı." : "İade belgesi işi kuyruğa alındı.");
  }

  async function bootstrap() {
    const generation = ++bootstrapGeneration;
    try {
      if (!App.auth?.requireAuth) throw new Error("Oturum doğrulaması yüklenemedi.");
      const user = await App.auth.requireAuth();
      if (!user) return;
      state.currentUserId = user.id;
      const [catalog, context] = await Promise.all([ui.request("/v1/e-invoicing/catalog"), ui.request("/v1/e-invoicing/context")]);
      if (generation !== bootstrapGeneration) return;
      state.catalog = catalog; Object.assign(state, context);
      if (!state.context.organizationId && state.organizations.length) state.context.organizationId = state.organizations[0].id;
      syncSelectors();
      const env = $("[data-edoc-environment]"); env.querySelector("span:last-child").textContent = catalog.productionProviderCallsEnabled ? "Production provider açık" : "Güvenli mod · gerçek provider kapalı"; if (catalog.productionProviderCallsEnabled) env.classList.add("is-ready");
      await load(location.hash.slice(1) || "dashboard");
      if (generation !== bootstrapGeneration) return;
      if (Array.isArray(state.warnings) && state.warnings.length) notice(state.warnings.join(" "));
    } catch (error) { if (generation !== bootstrapGeneration) return; notice(error.message || "Merkez açılamadı."); content().innerHTML = ui.empty("e-Dönüşüm bağlantısı hazır değil", "Yetkili şirket eşlemesi veya backend migration'ı bekleniyor."); }
  }

  document.addEventListener("click", async (event) => {
    const nav = event.target.closest("[data-partner-edoc-view]"); if (nav) return load(nav.dataset.partnerEdocView);
    if (event.target.closest("[data-partner-edoc-refresh]")) return bootstrap();
    const pageButton = event.target.closest("[data-partner-edoc-page]");
    if (pageButton && !pageButton.disabled) { state.pages[state.view] = Math.max(1, Number(pageButton.dataset.partnerEdocPage || 1)); return load(state.view); }
    const configButton = event.target.closest("[data-partner-config]");
    if (configButton && !configButton.disabled) { showDialog(configButton.dataset.partnerConfig); return; }
    const channelTest = event.target.closest("[data-partner-test-channel]");
    if (channelTest) {
      try { await ui.request(`/v1/e-invoicing/sales-channel-accounts/${encodeURIComponent(channelTest.dataset.partnerTestChannel)}/test`, { method: "POST" }); await bootstrap(); notice("Mağaza bağlantısı doğrulandı."); }
      catch (error) { notice(error.message || "Mağaza bağlantısı doğrulanamadı."); }
      return;
    }
    const providerTest = event.target.closest("[data-partner-test-provider]");
    if (providerTest) {
      try { await ui.request(`/v1/e-invoicing/provider-accounts/${encodeURIComponent(providerTest.dataset.partnerTestProvider)}/test`, { method: "POST" }); await bootstrap(); notice("Entegratör bağlantısı doğrulandı."); }
      catch (error) { notice(error.message || "Entegratör bağlantısı doğrulanamadı."); }
      return;
    }
    const connection = event.target.closest("[data-partner-connection-status]");
    if (connection) {
      if (!window.confirm("Bu entegrasyon durumu güncellensin mi? Bekleyen işler dış çağrı yapmaz.")) return;
      try {
        await ui.request(`/v1/e-invoicing/${encodeURIComponent(connection.dataset.partnerConnectionResource)}/${encodeURIComponent(connection.dataset.partnerConnectionId)}/status`, {
          method: "PATCH",
          body: JSON.stringify({ organizationId: state.context.organizationId, status: connection.dataset.partnerConnectionStatus, confirmation: "BAGLANTI_DURUMUNU_GUNCELLE" })
        });
        await bootstrap(); notice("Entegrasyon durumu güncellendi.");
      } catch (error) { notice(error.message || "Entegrasyon durumu güncellenemedi."); }
      return;
    }
    const activateProfile = event.target.closest("[data-partner-activate-profile]");
    if (activateProfile) {
      try {
        await ui.request(`/v1/e-invoicing/config/invoice-profiles/${encodeURIComponent(activateProfile.dataset.partnerActivateProfile)}/status`, { method: "PATCH", body: JSON.stringify({ organizationId: state.context.organizationId, status: "active", confirmation: "DURUMU_GUNCELLE" }) });
        await bootstrap(); notice("Fatura profili aktifleştirildi.");
      } catch (error) { notice(error.message || "Profil aktifleştirilemedi."); }
      return;
    }
    const artifact = event.target.closest("[data-partner-artifact]");
    if (artifact) { try { const result = await ui.request(`/v1/e-invoicing/invoices/${encodeURIComponent(artifact.dataset.invoiceId)}/artifacts/${artifact.dataset.partnerArtifact}`); ui.openSignedUrl(result.signedUrl); } catch (error) { notice(error.message); } }
    const workflow = event.target.closest("[data-partner-workflow]");
    if (workflow) { try { await showInvoiceWorkflow(workflow.dataset.partnerWorkflow, workflow.dataset.invoiceId); } catch (error) { notice(error.message || "Belge iş akışı açılamadı."); } }
    const rejectReturn = event.target.closest("[data-partner-return-reject]");
    if (rejectReturn) {
      const reason = window.prompt("Provider çağrısı başlamamış bu iade talebini reddetme gerekçesini yazın:");
      if (reason === null) return;
      if (reason.trim().length < 3) { notice("En az 3 karakterlik reddetme gerekçesi gerekli."); return; }
      if (!window.confirm("İade talebi reddedilsin ve ayrılan miktar yeniden kullanılabilir olsun mu?")) return;
      try {
        await ui.request(`/v1/e-invoicing/returns/${encodeURIComponent(rejectReturn.dataset.partnerReturnReject)}/reject`, {
          method: "POST",
          body: JSON.stringify({ organizationId: state.context.organizationId, reason: reason.trim(), confirmation: "IADE_TALEBINI_REDDET" })
        });
        await load("returns");
        notice("İade talebi audit kaydıyla reddedildi.");
      } catch (error) { notice(error.message || "İade talebi reddedilemedi."); }
      return;
    }
  });
  document.addEventListener("change", async (event) => {
    const select = event.target.closest("[data-partner-edoc-context]"); if (!select) return;
    state.context[`${select.dataset.partnerEdocContext}Id`] = select.value;
    if (select.dataset.partnerEdocContext === "organization") Object.assign(state.context, { legalEntityId: "", sellerId: "", channelAccountId: "" });
    if (select.dataset.partnerEdocContext === "legalEntity") Object.assign(state.context, { sellerId: "", channelAccountId: "" });
    if (select.dataset.partnerEdocContext === "seller") state.context.channelAccountId = "";
    state.pages = {};
    syncSelectors(); await load(state.view);
  });
  $("[data-partner-edoc-dialog]")?.addEventListener("close", async (event) => {
    if (event.currentTarget.returnValue !== "confirm") return;
    try {
      if (["cancel-invoice", "return-invoice"].includes(dialogAction)) await submitInvoiceWorkflow(dialogAction);
      else await submitDialog(dialogAction);
    }
    catch (error) { notice(error.message || "Yapılandırma kaydedilemedi."); }
    finally { dialogAction = ""; }
  });
  document.addEventListener("DOMContentLoaded", bootstrap);
})();
