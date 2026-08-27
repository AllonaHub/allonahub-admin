(function () {
  const App = window.Allona = window.Allona || {};
  const ui = App.eDonusum;
  const state = {
    view: "dashboard",
    currentUserId: "",
    context: { organizationId: "", legalEntityId: "", sellerId: "", channelAccountId: "" },
    organizations: [], legalEntities: [], sellers: [], channelAccounts: [], providerAccounts: [], invoiceProfiles: [], invoiceSettings: [],
    catalog: { salesChannels: [], invoiceProviders: [] },
    selectedInvoices: new Set(),
    visibleInvoices: new Map(),
    pages: {},
    filters: { search: "", status: "", documentType: "", from: "", to: "" }
  };
  const viewMeta = {
    dashboard: ["e-Dönüşüm Dashboard", "Fatura hacmi, güvenli kuyruk ve kanal yetenekleri."],
    invoices: ["Faturalar", "Satıcı bazlı e-Fatura, e-Arşiv ve belge yaşam döngüsü."],
    jobs: ["Fatura Kuyruğu", "Belge oluşturma ile pazaryerine geri aktarım ayrı işlerdir."],
    failures: ["Hatalar", "Request ID ile provider ve kanal hatalarının izlenebilir zinciri."],
    returns: ["İade Belgeleri", "Tam, ürün bazlı ve kısmi adet iadesi."],
    cancellations: ["Fatura İptalleri", "Sipariş iptalinden bağımsız belge iptal akışı."],
    commissions: ["Komisyon Faturaları", "Partner komisyon ve ek hizmet faturaları ayrı domain olarak yönetilir."],
    reconciliation: ["Mutabakat", "Satış, iade, kesinti, komisyon ve payout farkları."],
    companies: ["Şirketler", "Organization ve legal entity hiyerarşisi."],
    profiles: ["Fatura Profilleri", "Şirket bazında senaryo, vergi ve belge profilleri."],
    providers: ["Entegratörler", "Credential değeri değil yalnız güvenli secret referansı tutulur."],
    channels: ["Satış Kanalları", "Kanal capability matrisi provider uygulamasından gelir."],
    settings: ["Fatura Ayarları", "Tetikleme ve belge tipi fallback’i hukuki tahmin olmadan yapılandırılır."],
    audit: ["Audit Logs", "Append-oriented finansal işlem ve durum geçmişi."]
  };
  const resourceViews = new Set(["jobs", "failures", "returns", "cancellations", "commissions", "reconciliation", "audit"]);
  let dialogAction = "";
  let loadGeneration = 0;
  let bootstrapGeneration = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const content = () => $("[data-edoc-content]");

  function returnIdempotencyStorageKey(invoiceId) {
    return `allonahub.edoc.return.admin.${state.currentUserId || "signed-out"}.${invoiceId}`;
  }

  function returnIdempotencyKey(invoiceId) {
    const storageKey = returnIdempotencyStorageKey(invoiceId);
    const stored = readReturnRequest(invoiceId);
    let key = stored?.idempotencyKey || "";
    if (!key) {
      key = `manual-return:${crypto.randomUUID()}`;
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
    } catch (_) {
      return { idempotencyKey: raw };
    }
  }

  function storeReturnRequest(invoiceId, payload) {
    window.sessionStorage.setItem(returnIdempotencyStorageKey(invoiceId), JSON.stringify({ userId: state.currentUserId, idempotencyKey: payload.idempotencyKey, payload }));
  }

  function clearReturnIdempotencyKey(invoiceId) {
    window.sessionStorage.removeItem(returnIdempotencyStorageKey(invoiceId));
  }

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

  function notice(message, tone = "error") {
    const element = $("[data-edoc-notice]");
    if (!element) return;
    element.hidden = !message;
    element.dataset.tone = tone;
    element.textContent = message || "";
  }

  function selectOptions(element, items, valueKey, label, emptyLabel) {
    if (!element) return;
    const selected = element.value;
    element.innerHTML = `<option value="">${ui.escape(emptyLabel)}</option>${items.map((item) => `<option value="${ui.escape(item[valueKey])}">${ui.escape(label(item))}</option>`).join("")}`;
    if (items.some((item) => item[valueKey] === selected)) element.value = selected;
  }

  function syncContextSelectors() {
    if (!state.organizations.some((item) => item.id === state.context.organizationId)) {
      state.context.organizationId = state.organizations[0]?.id || "";
      Object.assign(state.context, { legalEntityId: "", sellerId: "", channelAccountId: "" });
    }
    if (state.context.legalEntityId && !state.legalEntities.some((item) => item.id === state.context.legalEntityId && item.organization_id === state.context.organizationId)) {
      Object.assign(state.context, { legalEntityId: "", sellerId: "", channelAccountId: "" });
    }
    if (state.context.sellerId && !state.sellers.some((item) => item.id === state.context.sellerId && item.organization_id === state.context.organizationId && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId))) {
      Object.assign(state.context, { sellerId: "", channelAccountId: "" });
    }
    if (state.context.channelAccountId && !state.channelAccounts.some((item) => item.id === state.context.channelAccountId && item.organization_id === state.context.organizationId && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId) && (!state.context.sellerId || item.seller_id === state.context.sellerId))) {
      state.context.channelAccountId = "";
    }
    const organization = $("[data-edoc-context=organization]");
    selectOptions(organization, state.organizations, "id", (item) => item.name, "Organizasyon seçin");
    if (state.context.organizationId) organization.value = state.context.organizationId;
    const legal = state.legalEntities.filter((item) => !state.context.organizationId || item.organization_id === state.context.organizationId);
    const sellers = state.sellers.filter((item) => (!state.context.organizationId || item.organization_id === state.context.organizationId) && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId));
    const accounts = state.channelAccounts.filter((item) => (!state.context.organizationId || item.organization_id === state.context.organizationId) && (!state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId) && (!state.context.sellerId || item.seller_id === state.context.sellerId));
    selectOptions($("[data-edoc-context=legalEntity]"), legal, "id", (item) => item.display_name || item.legal_name, "Tüm şirketler");
    selectOptions($("[data-edoc-context=seller]"), sellers, "id", (item) => item.display_name, "Tüm satıcılar");
    selectOptions($("[data-edoc-context=channelAccount]"), accounts, "id", (item) => `${item.account_name} · ${item.sales_channels?.display_name || "Kanal"}`, "Tüm mağazalar");
    $("[data-edoc-context=legalEntity]").value = state.context.legalEntityId;
    $("[data-edoc-context=seller]").value = state.context.sellerId;
    $("[data-edoc-context=channelAccount]").value = state.context.channelAccountId;
    const contextState = $("[data-edoc-context-state]");
    contextState.textContent = state.context.organizationId ? "RLS tenant bağlamı etkin" : "Önce organizasyon seçin";
  }

  function queryParams(extra = {}) {
    return ui.query({
      organizationId: state.context.organizationId,
      legalEntityId: state.context.legalEntityId,
      sellerId: state.context.sellerId,
      channelAccountId: state.context.channelAccountId,
      ...state.filters,
      ...extra
    });
  }

  function panel(title, subtitle, body) {
    return `<section class="edoc-panel"><header class="edoc-panel-head"><div><h2>${ui.escape(title)}</h2><p>${ui.escape(subtitle || "")}</p></div></header>${body}</section>`;
  }

  function kpi(label, value, note = "") {
    return `<article class="edoc-kpi"><span>${ui.escape(label)}</span><strong>${ui.escape(value)}</strong><small>${ui.escape(note)}</small></article>`;
  }

  function pagination(payload) {
    const page = Math.max(1, Number(payload.page || 1));
    const pageSize = Math.max(1, Number(payload.pageSize || 25));
    const total = Math.max(0, Number(payload.total || 0));
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (pages <= 1) return "";
    return `<nav class="edoc-pagination" aria-label="Sayfalama"><button class="edoc-button" type="button" data-edoc-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Önceki</button><span>Sayfa ${ui.escape(page)} / ${ui.escape(pages)}</span><button class="edoc-button" type="button" data-edoc-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Sonraki</button></nav>`;
  }

  function channelCanReceiveInvoice(invoice) {
    return invoice.can_upload_to_channel === true;
  }

  async function renderDashboard(generation) {
    if (!state.context.organizationId) {
      content().innerHTML = ui.empty("Organization kurulumu bekleniyor", "Şirket, satıcı ve mağaza eşlemesi tamamlanmadan otomatik fatura oluşturulmaz.");
      return;
    }
    content().innerHTML = ui.loading("Dashboard verileri güvenli tenant bağlamında yükleniyor…");
    const payload = await ui.request(`/v1/e-invoicing/dashboard?${queryParams()}`);
    if (generation !== loadGeneration) return;
    const summary = payload.summary || {};
    const amount = Object.entries(summary.totalAmount || {}).map(([currency, value]) => ui.exactMoney(value, currency)).join(" · ") || "0,00 TRY";
    const channelCatalog = (state.catalog.salesChannels || []).map((channel) => ({
      ...channel,
      displayName: `${channel.displayName} · ${summary.byChannel?.[channel.providerKey] || 0} belge`
    }));
    content().innerHTML = `
      <section class="edoc-kpis">
        ${kpi("Bugünkü Faturalar", summary.today || 0, "Takvim günü")}
        ${kpi("Bu Ayki Faturalar", summary.month || 0, "Ay başından beri")}
        ${kpi("Bu Ay Toplam Tutar", amount, "Belge para biriminde")}
        ${kpi("Başarılı", summary.successful || 0, "Issued · Sent · Accepted")}
        ${kpi("İnceleme / Bekleyen", summary.pending || 0, "Tahmin yapılmaz")}
        ${kpi("e-Fatura", summary.eInvoice || 0)}
        ${kpi("e-Arşiv", summary.eArchive || 0)}
        ${kpi("Hatalı", summary.failed || 0)}
        ${kpi("İptal", summary.cancelled || 0)}
        ${kpi("İade", summary.returned || 0)}
      </section>
      <div class="edoc-grid edoc-grid--two">
        ${panel("Satış kanalı capability matrisi", "SP Sipariş · İA İade · İP İptal · FY Fatura yükleme · FM Metadata · ÜR Ürün · ST Stok · Fİ Fiyat", `<div class="edoc-panel-body">${ui.capabilityLegend()}<div class="edoc-channel-list">${channelCatalog.map(ui.capabilityRow).join("") || ui.empty("Kanal kataloğu yok", "Backend capability kataloğu henüz alınamadı.")}</div></div>`)}
        ${panel("Belge durumu", "Bu ayın kontrollü yaşam döngüsü", `<div class="edoc-panel-body edoc-status-stack">
          <div class="edoc-status-row"><span>Bekleyen / inceleme</span><strong>${summary.pending || 0}</strong></div>
          <div class="edoc-status-row"><span>Başarılı</span><strong>${summary.successful || 0}</strong></div>
          <div class="edoc-status-row"><span>Hatalı / reddedilen</span><strong>${summary.failed || 0}</strong></div>
          <div class="edoc-status-row"><span>İptal edilen</span><strong>${summary.cancelled || 0}</strong></div>
          <div class="edoc-status-row"><span>İade edilen</span><strong>${summary.returned || 0}</strong></div>
        </div>`)}
      </div>`;
  }

  function filters(view = "invoices") {
    const invoiceFilters = view === "invoices";
    const statusFilter = ["invoices", "jobs", "returns", "cancellations", "commissions", "reconciliation"].includes(view);
    return `<form class="edoc-filter" data-edoc-filter>
      ${invoiceFilters ? `<label>Arama<input name="search" type="search" value="${ui.escape(state.filters.search)}" placeholder="Fatura no, sipariş no, provider ID"></label>` : ""}
      ${statusFilter ? `<label>Durum<select name="status"><option value="">Tümü</option>${Object.keys(ui.statuses).map((key) => `<option value="${key}" ${state.filters.status === key ? "selected" : ""}>${ui.escape(ui.statuses[key][0])}</option>`).join("")}</select></label>` : ""}
      ${invoiceFilters ? `<label>Belge<select name="documentType"><option value="">Tümü</option><option value="E_INVOICE" ${state.filters.documentType === "E_INVOICE" ? "selected" : ""}>e-Fatura</option><option value="E_ARCHIVE" ${state.filters.documentType === "E_ARCHIVE" ? "selected" : ""}>e-Arşiv</option><option value="RETURN" ${state.filters.documentType === "RETURN" ? "selected" : ""}>İade</option><option value="COMMISSION" ${state.filters.documentType === "COMMISSION" ? "selected" : ""}>Komisyon</option></select></label>` : ""}
      <label>Başlangıç<input name="from" type="date" value="${ui.escape(state.filters.from)}"></label>
      <label>Bitiş<input name="to" type="date" value="${ui.escape(state.filters.to)}"></label>
      <button class="edoc-button is-primary" type="submit">Filtrele</button>
    </form>`;
  }

  function invoiceRows(items) {
    return items.map((item) => {
      const invoiceLabel = item.invoice_number || item.sales_channel_order_id || item.order_id || item.id;
      const customerSaleDocument = item.document_scope === "CUSTOMER_SALE" && ["E_INVOICE", "E_ARCHIVE"].includes(item.document_type);
      return `<tr>
      <td><input class="edoc-check" type="checkbox" data-invoice-select="${ui.escape(item.id)}" ${state.selectedInvoices.has(item.id) ? "checked" : ""} aria-label="${ui.escape(`Faturayı seç: ${invoiceLabel}`)}"></td>
      <td><strong>${ui.escape(item.invoice_number || "Henüz numara yok")}</strong><br><small>${ui.escape(item.sales_channel_order_id || item.order_id || "-")}</small></td>
      <td>${ui.escape(item.sales_channel || "-")}</td><td>${ui.escape(item.document_type || "-")}</td>
      <td>${ui.exactMoney(item.grand_total, item.currency)}</td><td>${ui.badge(item.status)}</td>
      <td>${ui.escape(item.provider || "-")}</td><td>${ui.escape(item.issue_date || "-")}</td>
      <td><button class="edoc-button" type="button" data-invoice-artifact="pdf" data-invoice-id="${ui.escape(item.id)}" ${item.has_pdf ? "" : "disabled title=\"PDF henüz hazır değil\""}>PDF</button> <button class="edoc-button" type="button" data-invoice-artifact="xml" data-invoice-id="${ui.escape(item.id)}" ${item.has_xml ? "" : "disabled title=\"XML henüz hazır değil\""}>XML</button>${item.can_create_return === true ? ` <button class="edoc-button" type="button" data-invoice-workflow="return" data-invoice-id="${ui.escape(item.id)}">İade</button>` : ""}${item.can_cancel === true ? ` <button class="edoc-button" type="button" data-invoice-workflow="cancel" data-invoice-id="${ui.escape(item.id)}">İptal</button>` : ""}</td>
    </tr>`;
    }).join("");
  }

  async function renderInvoices(generation) {
    if (!state.context.organizationId) { content().innerHTML = ui.empty("Organization seçin", "Fatura listesi tenant seçilmeden açılmaz."); return; }
    content().innerHTML = ui.loading("Faturalar yükleniyor…");
    const payload = await ui.request(`/v1/e-invoicing/invoices?${queryParams({ page: state.pages.invoices || 1, pageSize: 25 })}`);
    if (generation !== loadGeneration) return;
    const lastPage = Math.max(1, Math.ceil(Number(payload.total || 0) / Math.max(1, Number(payload.pageSize || 25))));
    if ((state.pages.invoices || 1) > lastPage) {
      state.pages.invoices = lastPage;
      return renderInvoices(generation);
    }
    state.visibleInvoices = new Map((payload.items || []).map((item) => [item.id, item]));
    content().innerHTML = panel("Faturalar", `${payload.total || 0} kayıt`, `${filters()}<div class="edoc-toolbar">
      <button class="edoc-button is-primary" type="button" data-bulk-action="RETRY" disabled>Retry</button>
      <button class="edoc-button" type="button" data-bulk-action="REFRESH_STATUS" disabled>Durum Sorgula</button>
      <button class="edoc-button" type="button" data-bulk-action="UPLOAD_TO_CHANNEL" disabled>Pazaryerine Gönder</button>
      <button class="edoc-button" type="button" data-bulk-action="PDF" disabled>PDF Al</button>
      <button class="edoc-button" type="button" data-bulk-action="XML" disabled>XML Al</button>
      <button class="edoc-button" type="button" data-invoice-export>CSV / Excel Aktar</button>
      <button class="edoc-button" type="button" data-bulk-plan ${state.context.organizationId && state.context.legalEntityId && state.context.sellerId ? "" : "disabled title=\"Organizasyon, şirket ve satıcı seçin\""}>Toplu Fatura Oluştur</button>
      <button class="edoc-button" type="button" data-manual-invoice ${state.context.organizationId && state.context.legalEntityId && state.context.sellerId ? "" : "disabled title=\"Organizasyon, şirket ve satıcı seçin\""}>Manuel Fatura</button>
    </div>${payload.items?.length ? `<div class="edoc-table-wrap"><table class="edoc-table"><thead><tr><th></th><th>Fatura / Sipariş</th><th>Kanal</th><th>Belge</th><th>Tutar</th><th>Durum</th><th>Provider</th><th>Tarih</th><th>Belge</th></tr></thead><tbody>${invoiceRows(payload.items)}</tbody></table></div>${pagination(payload)}` : ui.empty("Fatura bulunamadı", "Seçili filtrelerde kayıt yok. Legacy siparişler satıcı/vergi eşlemesi tamamlanmadan otomatik faturaya dönüşmez.")}`);
    updateBulkButtons();
  }

  function genericColumns(view) {
    return {
      jobs: [["job_type", "İş"], ["status", "Durum"], ["attempt_count", "Deneme"], ["next_attempt_at", "Sonraki"], ["request_id", "Request ID"]],
      failures: [["failure_stage", "Aşama"], ["error_code", "Kod"], ["error_message", "Hata"], ["attempt_number", "Deneme"], ["correlation_id", "Correlation"]],
      returns: [["original_invoice_id", "Orijinal Fatura"], ["reason_code", "Neden"], ["grand_total", "Tutar"], ["status", "Durum"], ["created_at", "Tarih"], ["__actions", "İşlem"]],
      cancellations: [["invoice_id", "Fatura"], ["order_id", "Sipariş"], ["reason_code", "Neden"], ["status", "Durum"], ["created_at", "Tarih"]],
      commissions: [["seller_id", "Satıcı"], ["settlement_period_start", "Dönem Başlangıç"], ["settlement_period_end", "Dönem Bitiş"], ["commission_total", "Komisyon"], ["net_payable", "Net"], ["status", "Durum"]],
      reconciliation: [["seller_id", "Satıcı"], ["period_start", "Dönem"], ["net_payable", "Net"], ["recorded_payout", "Payout"], ["variance", "Fark"], ["status", "Durum"]],
      audit: [["action", "Aksiyon"], ["actor_role", "Aktör"], ["invoice_id", "Fatura"], ["request_id", "Request ID"], ["correlation_id", "Correlation"], ["created_at", "Tarih"]]
    }[view] || [];
  }

  function resourceValue(item, key) {
    if (key === "__actions") {
      return item.can_reject === true
        ? `<button class="edoc-button" type="button" data-return-reject="${ui.escape(item.id)}">Talebi Reddet</button>`
        : "-";
    }
    if (key === "status") return ui.badge(item[key]);
    const moneyFields = new Set([
      "grand_total", "gross_sales", "returns_total", "commission_total", "service_fee_total",
      "net_payable", "recorded_payout", "variance", "service_fees", "shipping_deductions", "other_deductions"
    ]);
    if (moneyFields.has(key)) {
      return item[key] === undefined || item[key] === null || !item.currency
        ? "-"
        : ui.exactMoney(item[key], item.currency);
    }
    return ui.escape(item[key] ?? "-");
  }

  async function renderResource(view, generation) {
    if (!state.context.organizationId) { content().innerHTML = ui.empty("Organization seçin", "Finansal kayıtlar tenant seçilmeden açılmaz."); return; }
    content().innerHTML = ui.loading(`${viewMeta[view][0]} yükleniyor…`);
    const payload = await ui.request(`/v1/e-invoicing/resources/${view}?${queryParams({ page: state.pages[view] || 1, pageSize: 25 })}`);
    if (generation !== loadGeneration) return;
    const lastPage = Math.max(1, Math.ceil(Number(payload.total || 0) / Math.max(1, Number(payload.pageSize || 25))));
    if ((state.pages[view] || 1) > lastPage) {
      state.pages[view] = lastPage;
      return renderResource(view, generation);
    }
    const columns = genericColumns(view);
    const rows = (payload.items || []).map((item) => `<tr>${columns.map(([key]) => `<td>${resourceValue(item, key)}</td>`).join("")}</tr>`).join("");
    content().innerHTML = panel(viewMeta[view][0], `${payload.total || 0} kayıt`, `${filters(view)}${rows ? `<div class="edoc-table-wrap"><table class="edoc-table"><thead><tr>${columns.map(([, label]) => `<th>${ui.escape(label)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>${pagination(payload)}` : ui.empty("Kayıt bulunamadı", "Seçili filtrelerde kayıt yok.")}`);
  }

  function renderConfiguration(view) {
    const organizationMatches = (item) => !state.context.organizationId || item.organization_id === state.context.organizationId;
    const legalEntityMatches = (item) => !state.context.legalEntityId || item.legal_entity_id === state.context.legalEntityId;
    if (view === "channels") {
      const connected = state.channelAccounts
        .filter((item) => organizationMatches(item) && legalEntityMatches(item) && (!state.context.sellerId || item.seller_id === state.context.sellerId))
        .map((item) => `<div class="edoc-config-row">${ui.capabilityRow({
          displayName: `${item.account_name} · ${item.environment} · ${item.status}`,
          capabilities: { ...(item.sales_channels?.capabilities || {}), ...(item.capabilities || {}) }
        })}<div class="edoc-row-actions"><button class="edoc-button" type="button" data-config-test-channel="${ui.escape(item.id)}">Bağlantıyı Test Et</button>${item.status === "connected" ? `<button class="edoc-button" type="button" data-connection-status="paused" data-connection-resource="sales-channel-accounts" data-connection-id="${ui.escape(item.id)}">Duraklat</button><button class="edoc-button" type="button" data-connection-status="disconnected" data-connection-resource="sales-channel-accounts" data-connection-id="${ui.escape(item.id)}">Yerel Olarak Kapat</button>` : ""}</div></div>`)
        .join("");
      const available = (state.catalog.salesChannels || []).map(ui.capabilityRow).join("");
      content().innerHTML = panel("Satış kanalları", "Capability bilgisi UI'da uydurulmaz; provider registry tek kaynaktır.", `<div class="edoc-toolbar"><button class="edoc-button is-primary" type="button" data-config-create="channel" ${state.context.sellerId ? "" : "disabled"}>Mağaza Bağla</button></div><div class="edoc-panel-body">${ui.capabilityLegend()}<h3>Bağlı mağazalar</h3><div class="edoc-channel-list">${connected || ui.empty("Bağlı mağaza yok", "Mağaza hesabı bağlandığında gerçek capability durumu burada görünür.")}</div><h3>Kullanılabilir adapterlar</h3><div class="edoc-channel-list">${available || ui.empty("Adapter bulunamadı", "Satış kanalı registry'si alınamadı.")}</div></div>`);
      return;
    }
    if (view === "providers") {
      const connected = state.providerAccounts
        .filter((item) => organizationMatches(item) && legalEntityMatches(item))
        .map((item) => `<div class="edoc-status-row"><div><strong>${ui.escape(item.account_label)}</strong><br><small>${ui.escape(item.provider_key)} · ${ui.escape(item.environment)}</small></div><div class="edoc-row-actions">${ui.badge(item.status)}<button class="edoc-button" type="button" data-config-test-provider="${ui.escape(item.id)}">Test Et</button>${item.status === "connected" ? `<button class="edoc-button" type="button" data-connection-status="paused" data-connection-resource="provider-accounts" data-connection-id="${ui.escape(item.id)}">Duraklat</button><button class="edoc-button" type="button" data-connection-status="disconnected" data-connection-resource="provider-accounts" data-connection-id="${ui.escape(item.id)}">Yerel Olarak Kapat</button>` : ""}</div></div>`)
        .join("");
      const providers = (state.catalog.invoiceProviders || []).map((item) => `<div class="edoc-channel"><strong>${ui.escape(item.displayName)}</strong><span class="edoc-badge ${item.implementation === "mock" ? "is-warning" : ""}">${ui.escape(item.implementation)}</span><span>${item.productionReady ? "Production ready" : "Production kapalı"}</span></div>`).join("");
      content().innerHTML = panel("e-Dönüşüm entegratörleri", "Gerçek API dokümantasyonu ve credential referansı olmadan production bağlantısı açılmaz.", `<div class="edoc-toolbar"><button class="edoc-button is-primary" type="button" data-config-create="provider" ${state.context.legalEntityId ? "" : "disabled"}>Entegratör Bağla</button></div><div class="edoc-panel-body"><h3>Bağlı hesaplar</h3><div class="edoc-status-stack">${connected || ui.empty("Bağlı entegratör yok", "Provider hesabı legal entity seviyesinde bağlanır; secret değeri ekrana dönmez.")}</div><h3>Kullanılabilir adapterlar</h3><div class="edoc-provider-list">${providers || ui.empty("Provider yok", "Provider registry alınamadı.")}</div></div>`);
      return;
    }
    if (view === "companies") {
      const items = state.legalEntities.filter((item) => organizationMatches(item) && (!state.context.legalEntityId || item.id === state.context.legalEntityId));
      const sellers = state.sellers.filter((item) => organizationMatches(item) && legalEntityMatches(item));
      content().innerHTML = panel(viewMeta[view][0], viewMeta[view][1], `<div class="edoc-toolbar"><button class="edoc-button is-primary" type="button" data-config-create="organization">Yeni Organizasyon</button><button class="edoc-button" type="button" data-config-create="legal-entity" ${state.context.organizationId ? "" : "disabled"}>Yeni Şirket</button><button class="edoc-button" type="button" data-config-create="seller" ${state.context.legalEntityId ? "" : "disabled"}>Yeni Satıcı</button></div><div class="edoc-panel-body"><h3>Şirketler</h3>${items.length ? items.map((item) => `<div class="edoc-status-row"><strong>${ui.escape(item.display_name || item.legal_name)}</strong><div class="edoc-row-actions">${ui.badge(item.status)}${item.status !== "active" ? `<button class="edoc-button" type="button" data-config-activate="legal-entities" data-config-id="${ui.escape(item.id)}">Aktifleştir</button>` : ""}</div></div>`).join("") : ui.empty("Şirket kaydı yok", "Organization altında legal entity oluşturulmalı.")}<h3>Satıcılar</h3>${sellers.length ? sellers.map((item) => `<div class="edoc-status-row"><strong>${ui.escape(item.display_name)}</strong><div class="edoc-row-actions">${ui.badge(item.status)}${item.status !== "active" ? `<button class="edoc-button" type="button" data-config-activate="sellers" data-config-id="${ui.escape(item.id)}">Aktifleştir</button>` : ""}</div></div>`).join("") : ui.empty("Satıcı yok", "Şirket altında seller profili oluşturulmalı.")}</div>`);
      return;
    }
    if (view === "profiles") {
      const items = state.invoiceProfiles.filter((item) => organizationMatches(item) && legalEntityMatches(item));
      content().innerHTML = panel(viewMeta[view][0], viewMeta[view][1], `<div class="edoc-toolbar"><button class="edoc-button is-primary" type="button" data-config-create="profile" ${state.context.legalEntityId ? "" : "disabled"}>Fatura Profili Ekle</button></div><div class="edoc-panel-body">${items.length ? items.map((item) => `<div class="edoc-status-row"><div><strong>${ui.escape(item.profile_name)}</strong><br><small>${ui.escape(item.default_scenario)} · ${ui.escape(item.default_currency)} · ${ui.escape(item.default_unit_code)}${item.is_default ? " · Varsayılan" : ""}</small></div><div class="edoc-row-actions">${ui.badge(item.status)}${item.status !== "active" ? `<button class="edoc-button" type="button" data-config-activate="invoice-profiles" data-config-id="${ui.escape(item.id)}">Aktifleştir</button>` : ""}</div></div>`).join("") : ui.empty("Fatura profili kurulumu bekleniyor", "Şirket senaryosu, birim kodu ve vergi configuration'ı yetkili API üzerinden bağlanır.")}</div>`);
      return;
    }
    if (view === "settings") {
      const items = state.invoiceSettings.filter((item) => organizationMatches(item) && legalEntityMatches(item) && (!state.context.channelAccountId || item.sales_channel_account_id === state.context.channelAccountId));
      content().innerHTML = panel(viewMeta[view][0], viewMeta[view][1], `<div class="edoc-toolbar"><button class="edoc-button is-primary" type="button" data-config-create="settings" ${state.context.legalEntityId ? "" : "disabled"}>Ayar Kaydet</button></div><div class="edoc-panel-body">${items.length ? items.map((item) => `<div class="edoc-status-row"><div><strong>${ui.escape(item.trigger_event)}</strong><br><small>${ui.escape(item.document_type_fallback)} · ${item.auto_upload_to_channel ? "Otomatik kanal aktarımı" : "Manuel kanal aktarımı"} · En çok ${ui.escape(item.max_retry_count)} deneme</small></div>${ui.badge(item.is_active ? "active" : "paused")}</div>`).join("") : ui.empty("Güvenli varsayılan: MANUAL", "Tetikleme olayı ve e-Fatura/e-Arşiv fallback'i yetkili admin tarafından açıkça seçilmelidir.")}</div>`);
      return;
    }
    content().innerHTML = panel(viewMeta[view][0], viewMeta[view][1], `<div class="edoc-panel-body">${ui.empty("Kayıt yok", "Bu bölüm henüz yapılandırılmadı.")}</div>`);
  }

  async function loadView(view) {
    const generation = ++loadGeneration;
    state.view = viewMeta[view] ? view : "dashboard";
    $$("[data-edoc-view]").forEach((button) => {
      const active = button.dataset.edocView === state.view;
      button.classList.toggle("is-active", active);
      active ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
    });
    const [title, subtitle] = viewMeta[state.view];
    $("[data-edoc-title]").textContent = title;
    $("[data-edoc-subtitle]").textContent = subtitle;
    window.history.replaceState(null, "", `#${state.view}`);
    notice("");
    try {
      if (state.view === "dashboard") await renderDashboard(generation);
      else if (state.view === "invoices") await renderInvoices(generation);
      else if (resourceViews.has(state.view)) await renderResource(state.view, generation);
      else renderConfiguration(state.view);
    } catch (error) {
      if (generation !== loadGeneration) return;
      notice(error.message || "Görünüm yüklenemedi.");
      content().innerHTML = ui.empty("Veri alınamadı", "Migration, tenant yetkisi ve backend bağlantısını kontrol edin.");
    }
  }

  function updateBulkButtons() {
    const selected = [...state.selectedInvoices].map((id) => state.visibleInvoices.get(id)).filter(Boolean);
    $$('[data-bulk-action]').forEach((button) => {
      const uploadSupported = button.dataset.bulkAction !== "UPLOAD_TO_CHANNEL"
        || (selected.length === state.selectedInvoices.size && selected.every(channelCanReceiveInvoice));
      const refreshSupported = button.dataset.bulkAction !== "REFRESH_STATUS"
        || (selected.length === state.selectedInvoices.size && selected.every((invoice) => invoice.can_refresh_status === true));
      const artifactField = button.dataset.bulkAction === "PDF" ? "has_pdf" : button.dataset.bulkAction === "XML" ? "has_xml" : null;
      const artifactSupported = !artifactField
        || (selected.length === state.selectedInvoices.size && selected.every((invoice) => invoice[artifactField] === true));
      button.disabled = state.selectedInvoices.size === 0 || !uploadSupported || !refreshSupported || !artifactSupported;
      if (button.dataset.bulkAction === "UPLOAD_TO_CHANNEL") {
        button.title = uploadSupported ? "" : "Seçimde fatura aktarım capability'si olmayan kanal var.";
      } else if (button.dataset.bulkAction === "REFRESH_STATUS") {
        button.title = refreshSupported ? "" : "Seçimde provider durum sorgulama capability'si olmayan fatura var.";
      } else if (artifactField) {
        button.title = artifactSupported ? "" : "Seçimde belgesi henüz hazır olmayan fatura var.";
      }
    });
  }

  async function bulkAction(action) {
    if (!state.selectedInvoices.size) return;
    const risky = ["RETRY", "REFRESH_STATUS", "UPLOAD_TO_CHANNEL"].includes(action);
    if (risky && !window.confirm(`${state.selectedInvoices.size} fatura için ${action} işlemi audit kaydıyla kuyruğa alınsın mı?`)) return;
    const requestedIds = [...state.selectedInvoices];
    const payload = await ui.request("/v1/e-invoicing/invoices/bulk", { method: "POST", body: JSON.stringify({ organizationId: state.context.organizationId, invoiceIds: [...state.selectedInvoices], action }) });
    if (!Array.isArray(payload.results)) throw new Error("Toplu işlem sonucu doğrulanamadı; seçimler korundu.");
    const resultById = new Map(payload.results.map((item) => [String(item.invoiceId || ""), item]));
    const failed = requestedIds.filter((id) => {
      const item = resultById.get(String(id));
      return !item || Boolean(item.error);
    });
    const downloadFailures = [];
    if (["PDF", "XML"].includes(action)) {
      for (const item of payload.results.filter((entry) => entry.signedUrl && !entry.error)) {
        try {
          await ui.downloadSignedUrl(item.signedUrl, `fatura-${item.invoiceId}.${action.toLowerCase()}`);
        } catch (_) {
          downloadFailures.push(item.invoiceId);
        }
      }
    }
    state.selectedInvoices.clear();
    [...new Set([...failed, ...downloadFailures])].forEach((id) => state.selectedInvoices.add(id));
    await loadView("invoices");
    const failedItems = payload.results.filter((item) => item.error);
    const failedIds = new Set([...failed, ...downloadFailures]);
    const succeededCount = Math.max(0, requestedIds.length - failedIds.size);
    if (failedIds.size) {
      const firstMessage = failedItems.find((item) => item.message)?.message || (downloadFailures.length ? "Belge indirme tamamlanamadı." : "Bir veya daha fazla işlem tamamlanamadı.");
      notice(`${succeededCount} kayıt kabul edildi; ${failedIds.size} kayıt başarısız. Başarısız seçimler korundu. ${firstMessage}`, "error");
    } else {
      const message = ["PDF", "XML"].includes(action)
        ? `${succeededCount} belge güvenli bağlantıdan indirildi.`
        : `${succeededCount} işlem API tarafından kabul edildi ve sonucu izlenmek üzere liste yenilendi.`;
      notice(message, "success");
    }
  }

  async function artifact(invoiceId, kind) {
    const payload = await ui.request(`/v1/e-invoicing/invoices/${encodeURIComponent(invoiceId)}/artifacts/${kind}`);
    ui.openSignedUrl(payload.signedUrl);
  }

  function openManualInvoice() {
    if (!state.context.organizationId || !state.context.legalEntityId || !state.context.sellerId) {
      notice("Manuel fatura için organizasyon, şirket ve satıcı seçilmelidir.");
      return;
    }
    const dialog = $("[data-edoc-dialog]");
    dialogAction = "manual-invoice";
    $("[data-edoc-dialog-title]").textContent = "Manuel fatura planla";
    $("[data-edoc-dialog-body]").innerHTML = `<div class="edoc-dialog-fields">
      <p>Sistem satıcıyı veya şirketi tahmin etmez. Sipariş ve önceden çözümlenmiş seller sub-order UUID değerleri birlikte doğrulanır.</p>
      <label>Sipariş UUID<input name="manualOrderId" autocomplete="off" required pattern="[0-9a-fA-F-]{36}"></label>
      <label>Seller sub-order UUID<input name="manualSubOrderId" autocomplete="off" required pattern="[0-9a-fA-F-]{36}"></label>
    </div>`;
    dialog.returnValue = "";
    dialog.showModal();
  }

  async function confirmManualInvoice() {
    const dialog = $("[data-edoc-dialog]");
    const orderId = dialog.querySelector("[name=manualOrderId]")?.value.trim();
    const subOrderId = dialog.querySelector("[name=manualSubOrderId]")?.value.trim();
    if (!orderId || !subOrderId) return;
    const result = await ui.request("/v1/e-invoicing/invoices/plan", {
      method: "POST",
      body: JSON.stringify({
        organizationId: state.context.organizationId,
        legalEntityId: state.context.legalEntityId,
        sellerId: state.context.sellerId,
        orderId,
        subOrderId
      })
    });
    await loadView("invoices");
    notice(result.duplicate ? "Aynı idempotency kapsamındaki mevcut fatura döndürüldü; yeni fatura oluşturulmadı." : "Fatura oluşturma işi güvenli kuyruğa alındı.", "success");
  }

  function openBulkPlan() {
    if (!state.context.organizationId || !state.context.legalEntityId || !state.context.sellerId) {
      notice("Toplu fatura için organizasyon, şirket ve satıcı seçilmelidir.");
      return;
    }
    const dialog = $("[data-edoc-dialog]");
    dialogAction = "bulk-plan";
    $("[data-edoc-dialog-title]").textContent = "Toplu fatura oluştur";
    $("[data-edoc-dialog-body]").innerHTML = `<div class="edoc-dialog-fields">
      <p>Her satıra <strong>sipariş UUID, seller sub-order UUID</strong> yazın. En fazla 50 çift, seçili tenant bağlamıyla tek tek doğrulanır.</p>
      <label class="is-wide">Sipariş / sub-order çiftleri<textarea name="bulkPlanRows" rows="10" required placeholder="order-uuid, sub-order-uuid"></textarea></label>
    </div>`;
    dialog.returnValue = "";
    dialog.showModal();
  }

  async function confirmBulkPlan() {
    const source = $("[data-edoc-dialog]")?.querySelector("[name=bulkPlanRows]")?.value || "";
    const items = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [orderId, subOrderId, ...extra] = line.split(/[;,\s]+/).filter(Boolean);
      if (!orderId || !subOrderId || extra.length) throw new Error("Her satır tam olarak iki UUID içermelidir.");
      return { orderId, subOrderId };
    });
    if (!items.length || items.length > 50) throw new Error("1 ile 50 arasında sipariş/sub-order çifti girin.");
    const payload = await ui.request("/v1/e-invoicing/invoices/plan-bulk", {
      method: "POST",
      body: JSON.stringify({
        organizationId: state.context.organizationId,
        legalEntityId: state.context.legalEntityId,
        sellerId: state.context.sellerId,
        items
      })
    });
    const failed = (payload.results || []).filter((item) => item.error);
    await loadView("invoices");
    notice(failed.length
      ? `${items.length - failed.length} fatura işi kabul edildi; ${failed.length} satır başarısız.`
      : `${items.length} fatura işi audit kaydıyla kuyruğa alındı.`, failed.length ? "error" : "success");
  }

  function dialogOptions(items, valueKey, label) {
    return items.map((item) => `<option value="${ui.escape(item[valueKey])}">${ui.escape(label(item))}</option>`).join("");
  }

  function showConfigDialog(action) {
    const dialog = $("[data-edoc-dialog]");
    const org = state.context.organizationId;
    const legal = state.context.legalEntityId;
    const scopedProfiles = state.invoiceProfiles.filter((item) => item.organization_id === org && item.legal_entity_id === legal && item.status === "active");
    const scopedProviders = state.providerAccounts.filter((item) => item.organization_id === org && item.legal_entity_id === legal && item.status === "connected");
    const scopedAccounts = state.channelAccounts.filter((item) => item.organization_id === org && item.legal_entity_id === legal);
    const definitions = {
      organization: ["Yeni organizasyon", `<label>Ad<input name="organizationName" required maxlength="180"></label><label>Slug<input name="organizationSlug" required maxlength="100" pattern="[a-z0-9]+(?:-[a-z0-9]+)*"></label>`],
      "legal-entity": ["Yeni şirket / legal entity", `<label>Resmî unvan<input name="legalName" required maxlength="240"></label><label>Görünen ad<input name="displayName" maxlength="180"></label><label>Vergi numarası<input name="taxNumber" required maxlength="32"></label><label>Vergi dairesi<input name="taxOffice" required maxlength="160"></label><label>İletişim e-postası<input name="contactEmail" type="email" maxlength="180"></label><label>Fatura adresi<textarea name="billingAddress" required maxlength="600"></textarea></label><label>Şehir<input name="billingCity" required maxlength="120"></label>`],
      seller: ["Yeni satıcı", `<label>Satıcı kodu<input name="sellerCode" required maxlength="80" pattern="[A-Za-z0-9._-]+"></label><label>Görünen ad<input name="sellerName" required maxlength="180"></label><p>Partner işletmesi bağlantısı yalnız doğrulanmış kayıt üzerinden super admin tarafından yapılır.</p>`],
      channel: ["Mağaza bağla", `<label>Kanal<select name="channelKey" required>${dialogOptions(state.catalog.salesChannels || [], "providerKey", (item) => item.displayName)}</select></label><label>Ortam<select name="channelEnvironment"><option value="local">Local</option><option value="sandbox" selected>Sandbox</option><option value="production">Production</option></select></label><label>Hesap adı<input name="accountName" required maxlength="160"></label><label>Harici hesap ID<input name="externalAccountId" maxlength="180"></label><label>Credential reference<input name="credentialReference" maxlength="300" placeholder="vault:... veya secret:INVOICE_..."></label><p>AllonaHub/Allona Shop local; harici kanallar sandbox veya production kullanır. Production için bağlı credential reference zorunludur.</p>`],
      profile: ["Fatura profili ekle", `<label>Profil adı<input name="profileName" required maxlength="160"></label><label>Belge öneki<input name="documentPrefix" maxlength="20"></label><label>Senaryo<input name="defaultScenario" value="TEMELFATURA" required maxlength="80"></label><label>Para birimi<input name="defaultCurrency" value="TRY" required maxlength="3"></label><label>Birim kodu<input name="defaultUnitCode" value="C62" required maxlength="20"></label><label class="edoc-check-label"><input name="isDefault" type="checkbox"> Varsayılan profil</label>`],
      provider: ["e-Dönüşüm entegratörü bağla", `<label>Provider<select name="providerKey" required>${dialogOptions(state.catalog.invoiceProviders || [], "providerKey", (item) => `${item.displayName} · ${item.implementation}`)}</select></label><label>Hesap etiketi<input name="accountLabel" required maxlength="120"></label><label>Ortam<select name="environment"><option value="mock">Mock</option><option value="sandbox">Sandbox</option><option value="production">Production</option></select></label><label>Credential reference<input name="credentialReference" maxlength="300" placeholder="vault:... veya secret:INVOICE_..."></label><label>Webhook secret reference<input name="webhookSecretReference" maxlength="300" placeholder="secret:INVOICE_..."></label><p>Mock credential kabul etmez. Skeleton providerlar resmî adapter eklenmeden production çağrısı yapmaz.</p>`],
      settings: ["Fatura ayarı kaydet", `<label>Fatura profili<select name="invoiceProfileId" required><option value="">Seçin</option>${dialogOptions(scopedProfiles, "id", (item) => item.profile_name)}</select></label><label>Entegratör hesabı<select name="invoiceProviderAccountId" required><option value="">Seçin</option>${dialogOptions(scopedProviders, "id", (item) => item.account_label)}</select></label><label>Mağaza kapsamı<select name="salesChannelAccountId"><option value="">Şirket geneli</option>${dialogOptions(scopedAccounts, "id", (item) => item.account_name)}</select></label><label>Tetikleme<select name="triggerEvent"><option>MANUAL</option><option>PAYMENT_COMPLETED</option><option>ORDER_CONFIRMED</option><option>READY_TO_SHIP</option><option>SHIPPED</option><option>DELIVERED</option></select></label><label>Belge tipi fallback<select name="documentTypeFallback"><option>MANUAL_REVIEW</option><option>E_INVOICE</option><option>E_ARCHIVE</option></select></label><label>Maksimum deneme<input name="maxRetryCount" type="number" min="1" max="20" value="4"></label><label class="edoc-check-label"><input name="autoUploadToChannel" type="checkbox"> Başarılı faturayı desteklenen kanala otomatik gönder</label>`]
    };
    const definition = definitions[action];
    if (!definition) return;
    dialogAction = action;
    $("[data-edoc-dialog-title]").textContent = definition[0];
    $("[data-edoc-dialog-body]").innerHTML = `<div class="edoc-dialog-fields">${definition[1]}</div>`;
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
        const account = scopedAccounts.find((item) => item.id === accountSelect?.value);
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
    dialog.returnValue = "";
    dialog.showModal();
  }

  async function submitConfigDialog(action) {
    const dialog = $("[data-edoc-dialog]");
    const value = (name) => String(dialog.querySelector(`[name=${name}]`)?.value || "").trim();
    const checked = (name) => dialog.querySelector(`[name=${name}]`)?.checked === true;
    const org = state.context.organizationId;
    const legal = state.context.legalEntityId;
    const requests = {
      organization: ["/v1/e-invoicing/organizations", { name: value("organizationName"), slug: value("organizationSlug") }],
      "legal-entity": ["/v1/e-invoicing/legal-entities", { organizationId: org, legalName: value("legalName"), displayName: value("displayName") || null, taxNumber: value("taxNumber") || null, taxOffice: value("taxOffice") || null, contactEmail: value("contactEmail") || null, billingAddress: { line1: value("billingAddress"), city: value("billingCity"), country: "TR" } }],
      seller: ["/v1/e-invoicing/sellers", { organizationId: org, legalEntityId: legal, sellerCode: value("sellerCode"), displayName: value("sellerName") }],
      channel: ["/v1/e-invoicing/sales-channel-accounts", { organizationId: org, legalEntityId: legal, sellerId: state.context.sellerId, channelKey: value("channelKey"), environment: value("channelEnvironment"), accountName: value("accountName"), externalAccountId: value("externalAccountId") || null, credentialReference: value("credentialReference") || null }],
      profile: ["/v1/e-invoicing/invoice-profiles", { organizationId: org, legalEntityId: legal, profileName: value("profileName"), documentPrefix: value("documentPrefix") || null, defaultScenario: value("defaultScenario"), defaultCurrency: value("defaultCurrency").toUpperCase(), defaultUnitCode: value("defaultUnitCode"), taxConfiguration: {}, isDefault: checked("isDefault") }],
      provider: ["/v1/e-invoicing/provider-accounts", { organizationId: org, legalEntityId: legal, providerKey: value("providerKey"), accountLabel: value("accountLabel"), environment: value("environment"), credentialReference: value("credentialReference") || null, webhookSecretReference: value("webhookSecretReference") || null }],
      settings: ["/v1/e-invoicing/settings", { organizationId: org, legalEntityId: legal, salesChannelAccountId: value("salesChannelAccountId") || null, invoiceProfileId: value("invoiceProfileId"), invoiceProviderAccountId: value("invoiceProviderAccountId"), triggerEvent: value("triggerEvent"), documentTypeFallback: value("documentTypeFallback"), autoUploadToChannel: checked("autoUploadToChannel"), maxRetryCount: Number(value("maxRetryCount") || 4) }]
    };
    const [path, body] = requests[action] || [];
    if (!path) return;
    await ui.request(path, { method: action === "settings" ? "PUT" : "POST", body: JSON.stringify(body) });
    await bootstrap(true);
    notice("Yapılandırma kaydedildi ve tenant bağlamı yenilendi.", "success");
  }

  async function openInvoiceWorkflow(action, invoiceId) {
    const dialog = $("[data-edoc-dialog]");
    dialog.dataset.invoiceId = invoiceId;
    dialog.dataset.organizationId = state.visibleInvoices.get(invoiceId)?.organization_id || state.context.organizationId;
    if (action === "cancel") {
      dialogAction = "cancel-invoice";
      $("[data-edoc-dialog-title]").textContent = "Fatura iptal akışı";
      $("[data-edoc-dialog-body]").innerHTML = `<div class="edoc-dialog-fields"><p>Sipariş iptali fatura iptali değildir. Bu işlem provider desteğine göre ayrı job oluşturur.</p><label>Neden kodu<input name="reasonCode" maxlength="80"></label><label>Açıklama<textarea name="reasonNote" maxlength="1000"></textarea></label></div>`;
    } else {
      const pending = readReturnRequest(invoiceId);
      const invoiceOrganizationId = state.visibleInvoices.get(invoiceId)?.organization_id || state.context.organizationId;
      if (pending?.payload && pending.payload.organizationId !== invoiceOrganizationId) clearReturnIdempotencyKey(invoiceId);
      else if (pending?.payload) {
        await createOrReconcileReturn(invoiceId, pending.payload);
        clearReturnIdempotencyKey(invoiceId);
        await loadView("invoices");
        notice("Önceki iade isteği aynı idempotency anahtarıyla uzlaştırıldı.", "success");
        return;
      }
      const detail = await ui.request(`/v1/e-invoicing/invoices/${encodeURIComponent(invoiceId)}`);
      const returnableItems = (detail.items || []).filter((item) => Number(item.returnable_quantity ?? item.quantity) > 0);
      if (!returnableItems.length) throw new Error("İade edilebilir fatura kalemi bulunamadı.");
      dialogAction = "return-invoice";
      dialog.dataset.returnIdempotencyKey = returnIdempotencyKey(invoiceId);
      $("[data-edoc-dialog-title]").textContent = "Kısmi / tam iade belgesi";
      $("[data-edoc-dialog-body]").innerHTML = `<div class="edoc-dialog-fields"><p>Yalnız iade edilecek adetleri girin. Vergi ve tutar orijinal fatura kaleminden exact olarak dağıtılır.</p>${returnableItems.map((item) => {
        const remaining = item.returnable_quantity ?? item.quantity;
        return `<label>${ui.escape(item.description)} · Kalan ${ui.escape(remaining)}<input type="number" min="0" max="${ui.escape(remaining)}" step="0.0001" value="0" data-return-item="${ui.escape(item.id)}"></label>`;
      }).join("")}<label>Neden kodu<input name="reasonCode" maxlength="80"></label><label>Açıklama<textarea name="reasonNote" maxlength="1000"></textarea></label></div>`;
    }
    dialog.returnValue = "";
    dialog.showModal();
  }

  async function submitInvoiceWorkflow(action) {
    const dialog = $("[data-edoc-dialog]");
    const invoiceId = dialog.dataset.invoiceId;
    const organizationId = dialog.dataset.organizationId;
    const reasonCode = String(dialog.querySelector("[name=reasonCode]")?.value || "").trim() || null;
    const reasonNote = String(dialog.querySelector("[name=reasonNote]")?.value || "").trim() || null;
    if (action === "cancel-invoice") {
      await ui.request(`/v1/e-invoicing/invoices/${encodeURIComponent(invoiceId)}/cancellations`, { method: "POST", body: JSON.stringify({ organizationId, reasonCode, reasonNote }) });
    } else {
      const items = $$('[data-return-item]', dialog)
        .map((input) => ({ originalInvoiceItemId: input.dataset.returnItem, quantity: String(input.value || "0") }))
        .filter((item) => Number(item.quantity) > 0);
      if (!items.length) throw new Error("En az bir kalem için iade adedi girin.");
      const idempotencyKey = dialog.dataset.returnIdempotencyKey || returnIdempotencyKey(invoiceId);
      await createOrReconcileReturn(invoiceId, { organizationId, idempotencyKey, reasonCode, reasonNote, items });
      clearReturnIdempotencyKey(invoiceId);
      delete dialog.dataset.returnIdempotencyKey;
    }
    await loadView("invoices");
    notice(action === "cancel-invoice" ? "Fatura iptal işi ayrı iş akışına alındı." : "İade belgesi işi güvenli kuyruğa alındı.", "success");
  }

  function bind() {
    document.addEventListener("click", async (event) => {
      const nav = event.target.closest("[data-edoc-view]");
      if (nav) { await loadView(nav.dataset.edocView); return; }
      if (event.target.closest("[data-edoc-refresh]")) { await bootstrap(true); return; }
      const select = event.target.closest("[data-invoice-select]");
      if (select) { select.checked ? state.selectedInvoices.add(select.dataset.invoiceSelect) : state.selectedInvoices.delete(select.dataset.invoiceSelect); updateBulkButtons(); return; }
      const bulk = event.target.closest("[data-bulk-action]");
      if (bulk) { try { await bulkAction(bulk.dataset.bulkAction); } catch (error) { notice(error.message); } return; }
      const pageButton = event.target.closest("[data-edoc-page]");
      if (pageButton && !pageButton.disabled) {
        state.pages[state.view] = Math.max(1, Number(pageButton.dataset.edocPage || 1));
        state.selectedInvoices.clear();
        await loadView(state.view);
        return;
      }
      const documentButton = event.target.closest("[data-invoice-artifact]");
      if (documentButton) { try { await artifact(documentButton.dataset.invoiceId, documentButton.dataset.invoiceArtifact); } catch (error) { notice(error.message); } return; }
      const workflowButton = event.target.closest("[data-invoice-workflow]");
      if (workflowButton) { try { await openInvoiceWorkflow(workflowButton.dataset.invoiceWorkflow, workflowButton.dataset.invoiceId); } catch (error) { notice(error.message || "Belge iş akışı açılamadı."); } return; }
      const rejectReturn = event.target.closest("[data-return-reject]");
      if (rejectReturn) {
        const reason = window.prompt("Provider çağrısı başlamamış bu iade talebini reddetme gerekçesini yazın:");
        if (reason === null) return;
        if (reason.trim().length < 3) { notice("En az 3 karakterlik reddetme gerekçesi gerekli."); return; }
        if (!window.confirm("İade talebi reddedilsin ve ayrılan miktar yeniden kullanılabilir olsun mu?")) return;
        try {
          await ui.request(`/v1/e-invoicing/returns/${encodeURIComponent(rejectReturn.dataset.returnReject)}/reject`, {
            method: "POST",
            body: JSON.stringify({ organizationId: state.context.organizationId, reason: reason.trim(), confirmation: "IADE_TALEBINI_REDDET" })
          });
          await loadView("returns");
          notice("İade talebi audit kaydıyla reddedildi.", "success");
        } catch (error) { notice(error.message || "İade talebi reddedilemedi."); }
        return;
      }
      if (event.target.closest("[data-invoice-export]")) {
        try { await ui.download(`/v1/e-invoicing/reports/invoices.csv?${queryParams({ pageSize: 100 })}`, `allonahub-faturalar-${new Date().toISOString().slice(0, 10)}.csv`); } catch (error) { notice(error.message); }
        return;
      }
      if (event.target.closest("[data-manual-invoice]")) {
        openManualInvoice();
        return;
      }
      if (event.target.closest("[data-bulk-plan]")) {
        openBulkPlan();
        return;
      }
      const createConfig = event.target.closest("[data-config-create]");
      if (createConfig && !createConfig.disabled) {
        showConfigDialog(createConfig.dataset.configCreate);
        return;
      }
      const testChannel = event.target.closest("[data-config-test-channel]");
      if (testChannel) {
        try {
          await ui.request(`/v1/e-invoicing/sales-channel-accounts/${encodeURIComponent(testChannel.dataset.configTestChannel)}/test`, { method: "POST" });
          await bootstrap(true); notice("Mağaza bağlantı testi tamamlandı.", "success");
        } catch (error) { notice(error.message || "Mağaza bağlantısı doğrulanamadı."); }
        return;
      }
      const testProvider = event.target.closest("[data-config-test-provider]");
      if (testProvider) {
        try {
          await ui.request(`/v1/e-invoicing/provider-accounts/${encodeURIComponent(testProvider.dataset.configTestProvider)}/test`, { method: "POST" });
          await bootstrap(true); notice("Entegratör bağlantı testi tamamlandı.", "success");
        } catch (error) { notice(error.message || "Entegratör bağlantısı doğrulanamadı."); }
        return;
      }
      const activate = event.target.closest("[data-config-activate]");
      if (activate) {
        if (!window.confirm("Bu yapılandırma kaydı ACTIVE durumuna geçirilsin mi?")) return;
        try {
          await ui.request(`/v1/e-invoicing/config/${encodeURIComponent(activate.dataset.configActivate)}/${encodeURIComponent(activate.dataset.configId)}/status`, {
            method: "PATCH",
            body: JSON.stringify({ organizationId: state.context.organizationId, status: "active", confirmation: "DURUMU_GUNCELLE" })
          });
          await bootstrap(true); notice("Yapılandırma aktifleştirildi.", "success");
        } catch (error) { notice(error.message || "Yapılandırma aktifleştirilemedi."); }
        return;
      }
      const connection = event.target.closest("[data-connection-status]");
      if (connection) {
        const label = connection.dataset.connectionStatus === "paused" ? "duraklatmak" : "bağlantıyı kesmek";
        if (!window.confirm(`Bu entegrasyonu ${label} istediğinize emin misiniz? Bekleyen işler dış çağrı yapmaz.`)) return;
        try {
          await ui.request(`/v1/e-invoicing/${encodeURIComponent(connection.dataset.connectionResource)}/${encodeURIComponent(connection.dataset.connectionId)}/status`, {
            method: "PATCH",
            body: JSON.stringify({ organizationId: state.context.organizationId, status: connection.dataset.connectionStatus, confirmation: "BAGLANTI_DURUMUNU_GUNCELLE" })
          });
          await bootstrap(true); notice("Entegrasyon durumu güncellendi.", "success");
        } catch (error) { notice(error.message || "Entegrasyon durumu güncellenemedi."); }
        return;
      }
    });
    document.addEventListener("change", async (event) => {
      const selector = event.target.closest("[data-edoc-context]");
      if (!selector) return;
      const key = `${selector.dataset.edocContext}Id`;
      state.context[key] = selector.value;
      if (key === "organizationId") Object.assign(state.context, { legalEntityId: "", sellerId: "", channelAccountId: "" });
      if (key === "legalEntityId") Object.assign(state.context, { sellerId: "", channelAccountId: "" });
      if (key === "sellerId") state.context.channelAccountId = "";
      state.pages = {};
      state.selectedInvoices.clear();
      syncContextSelectors();
      await loadView(state.view);
    });
    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-edoc-filter]");
      if (!form) return;
      event.preventDefault();
      const data = new FormData(form);
      Object.keys(state.filters).forEach((key) => { state.filters[key] = String(data.get(key) || ""); });
      state.pages[state.view] = 1;
      state.selectedInvoices.clear();
      await loadView(state.view);
    });
    $("[data-edoc-dialog]")?.addEventListener("close", async (event) => {
      if (event.currentTarget.returnValue !== "confirm") return;
      try {
        if (dialogAction === "manual-invoice") await confirmManualInvoice();
        else if (dialogAction === "bulk-plan") await confirmBulkPlan();
        else if (["cancel-invoice", "return-invoice"].includes(dialogAction)) await submitInvoiceWorkflow(dialogAction);
        else await submitConfigDialog(dialogAction);
      } catch (error) { notice(error.message || "İşlem tamamlanamadı."); }
      finally { dialogAction = ""; }
    });
  }

  async function bootstrap(refresh = false) {
    const generation = ++bootstrapGeneration;
    content().innerHTML = ui.loading(refresh ? "Merkez yenileniyor…" : "Tenant ve provider sözleşmeleri yükleniyor…");
    try {
      document.body.dataset.page = "admin-ops";
      if (!App.auth?.requireRole) throw new Error("Admin yetki doğrulaması yüklenemedi.");
      const access = await App.auth.requireRole(["admin", "super_admin"]);
      if (!access) return;
      state.currentUserId = access.user.id;
      const [catalog, context] = await Promise.all([ui.request("/v1/e-invoicing/catalog"), ui.request("/v1/e-invoicing/context")]);
      if (generation !== bootstrapGeneration) return;
      state.catalog = catalog;
      Object.assign(state, context);
      if (!state.context.organizationId && state.organizations.length) state.context.organizationId = state.organizations[0].id;
      syncContextSelectors();
      const environment = $("[data-edoc-environment]");
      environment.className = `edoc-environment ${catalog.productionProviderCallsEnabled ? "is-ready" : ""}`;
      environment.querySelector("span:last-child").textContent = catalog.productionProviderCallsEnabled ? "Production provider çağrıları açık" : "Güvenli mod · gerçek provider kapalı";
      await loadView((window.location.hash || "#dashboard").slice(1));
      if (generation !== bootstrapGeneration) return;
      if (Array.isArray(state.warnings) && state.warnings.length) notice(state.warnings.join(" "), "warning");
    } catch (error) {
      if (generation !== bootstrapGeneration) return;
      $("[data-edoc-environment]").classList.add("is-blocked");
      notice(error.message || "e-Dönüşüm bağlantısı kurulamadı.");
      content().innerHTML = ui.empty("Merkez henüz canlı veriye bağlı değil", "Backend migration ve tenant kurulumu tamamlandığında bu ekran gerçek kayıtları gösterecek.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => { bind(); bootstrap(); });
})();
