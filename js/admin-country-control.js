(function () {
  const App = window.Allona = window.Allona || {};
  const state = {
    access: null,
    snapshot: null,
    selectedCountryId: "",
    pendingSubmit: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const escape = (value) => App.core?.escapeHTML
    ? App.core.escapeHTML(String(value ?? ""))
    : String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function apiUrl(path) {
    const base = String(App.config?.apiBaseUrl || "").replace(/\/$/, "");
    return `${base}${path}`;
  }

  function loginUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    return App.core?.url ? App.core.url(`/admin/admin-login.html?returnTo=${returnTo}`) : `/admin/admin-login.html?returnTo=${returnTo}`;
  }

  function notice(message, tone = "error") {
    const node = $("[data-country-notice]");
    if (!node) return;
    node.hidden = !message;
    node.dataset.tone = tone;
    node.textContent = message || "";
  }

  async function token() {
    const session = await App.auth?.getSession?.();
    if (!session?.access_token) {
      window.location.href = loginUrl();
      throw new Error("Admin oturumu gerekli.");
    }
    return session.access_token;
  }

  async function request(path, options = {}) {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) window.location.href = loginUrl();
      if (response.status === 403 && /MFA|iki aşamalı/i.test(payload.message || "")) {
        const target = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.href = App.auth?.mfaUrl ? App.auth.mfaUrl(target) : `/pages/account/mfa.html?returnTo=${encodeURIComponent(target)}`;
      }
      throw new Error(payload.message || "Country Control Center isteği tamamlanamadı.");
    }
    return payload;
  }

  function formatNumber(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
    return Number(value).toLocaleString("tr-TR");
  }

  function badge(value) {
    const label = String(value || "unknown");
    const tone = label.toLowerCase().replace(/_/g, "-");
    return `<span class="country-badge is-${escape(tone)}">${escape(label)}</span>`;
  }

  function selectedCountry() {
    return state.snapshot?.countries?.find((country) => country.id === state.selectedCountryId) || null;
  }

  function modulesFor(countryId) {
    return (state.snapshot?.modules || []).filter((module) => module.country_id === countryId);
  }

  function renderKpis() {
    const metrics = state.snapshot.metrics || {};
    const cards = [
      ["Desteklenen ülke kaydı", state.snapshot.countries.length, "Country Engine satırları"],
      ["Global kullanıcı", metrics.users, "profiles gerçek count"],
      ["Partner Passport", metrics.partners, "passport gerçek count"],
      ["B2B trade request", metrics.tradeRequests, "trade_requests gerçek count"],
      ["Cross-border order", metrics.crossBorderOrders, "context gerçek count"],
      ["Lojistik gönderi", metrics.shipments, "shipments gerçek count"],
      ["Yayındaki koridor", state.snapshot.corridors.filter((item) => item.status === "public").length, "status = public"],
      ["Doğrulanmış public KPI", state.snapshot.impact.filter((item) => item.verification_status === "published").length, "published evidence"],
      ["Cross-border GMV", null, "Doğrulanmış metrik yoksa hesaplanmaz"],
      ["Desteklenen istihdam", null, "Kaynak + yöntem gerekir"]
    ];
    $("[data-country-kpis]").innerHTML = cards.map(([label, value, note]) => `<article><span>${escape(label)}</span><strong>${formatNumber(value)}</strong><small>${escape(note)}</small></article>`).join("");
  }

  function renderCountries() {
    const writable = state.snapshot.writeEnabled && state.access?.profile?.role === "super_admin";
    $("[data-country-list]").innerHTML = state.snapshot.countries.map((country) => {
      const modules = modulesFor(country.id);
      const enabled = modules.filter((module) => module.enabled).length;
      const transaction = modules.filter((module) => module.transaction_enabled).length;
      return `<article class="country-card ${country.status === "disabled" ? "is-disabled" : ""} ${country.launch_stage === "PUBLIC" ? "is-public" : ""}">
        <header><span class="country-card-code">${escape(country.country_code)}</span>${badge(country.launch_stage)}</header>
        <h3>${escape(country.native_name)}</h3><p>${escape(country.country_name)}</p>
        <dl><dt>Statü</dt><dd>${badge(country.status)}</dd><dt>Para</dt><dd>${escape(country.currency_code)}</dd><dt>Dil</dt><dd>${escape(country.default_language)}</dd><dt>Açık modül</dt><dd>${enabled}</dd><dt>İşlem modülü</dt><dd>${transaction}</dd></dl>
        <button type="button" data-edit-country="${escape(country.id)}" ${writable ? "" : "disabled"}>Ülke aşamasını yönet</button>
      </article>`;
    }).join("") || `<div class="country-empty">Ülke kaydı yok.</div>`;
  }

  function renderCountrySelector() {
    const select = $("[data-country-select]");
    select.innerHTML = state.snapshot.countries.map((country) => `<option value="${escape(country.id)}">${escape(country.country_code)} · ${escape(country.native_name)}</option>`).join("");
    if (!state.selectedCountryId || !state.snapshot.countries.some((country) => country.id === state.selectedCountryId)) {
      state.selectedCountryId = state.snapshot.countries[0]?.id || "";
    }
    select.value = state.selectedCountryId;
  }

  function readonlyCheck(label, checked) {
    return `<label class="country-switch"><input type="checkbox" ${checked ? "checked" : ""} disabled><span>${escape(label)}</span></label>`;
  }

  function renderModules() {
    const country = selectedCountry();
    const writable = state.snapshot.writeEnabled && state.access?.profile?.role === "super_admin";
    const modules = modulesFor(country?.id);
    const rows = modules.map((module) => `<tr>
      <td><strong>${escape(module.module_key)}</strong><br><small>${escape(country?.country_code || "")}</small></td>
      <td>${readonlyCheck("Enabled", module.enabled)}</td>
      <td>${readonlyCheck("Beta", module.beta)}</td>
      <td>${readonlyCheck("Public", module.public_visible)}</td>
      <td>${readonlyCheck("Partner", module.partner_registration_enabled)}</td>
      <td>${readonlyCheck("Transaction", module.transaction_enabled)}</td>
      <td>${module.approval_reference ? escape(module.approval_reference) : "—"}</td>
      <td><button class="country-row-action" type="button" data-edit-module="${escape(module.id)}" ${writable ? "" : "disabled"}>Yönet</button></td>
    </tr>`).join("");
    $("[data-module-table]").innerHTML = rows
      ? `<table class="country-table"><thead><tr><th>Modül</th><th>Enabled</th><th>Beta</th><th>Public</th><th>Partner kayıt</th><th>Transaction</th><th>Onay</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
      : `<div class="country-empty">Bu ülke için modül kaydı yok.</div>`;
  }

  function renderCorridors() {
    $("[data-corridors]").innerHTML = state.snapshot.corridors.map((corridor) => `<article class="country-corridor"><header><strong>${escape(corridor.corridor_key)}</strong>${badge(corridor.status)}</header><ul><li class="${corridor.commerce_enabled ? "is-on" : ""}">Commerce</li><li class="${corridor.b2b_enabled ? "is-on" : ""}">B2B</li><li class="${corridor.logistics_enabled ? "is-on" : ""}">Logistics</li><li class="${corridor.rewards_enabled ? "is-on" : ""}">Rewards</li></ul></article>`).join("") || `<div class="country-empty">Koridor migration’ı henüz uygulanmamış veya kayıt yok.</div>`;
  }

  function renderImpact() {
    const impact = state.snapshot.impact || [];
    $("[data-impact]").innerHTML = impact.length
      ? impact.map((item) => `<article class="country-impact-row"><strong>${escape(item.metric_key)}</strong><span>${formatNumber(item.numeric_value)} ${escape(item.currency || item.unit || "")}</span><span>${escape(`${item.period_start} → ${item.period_end}`)}</span>${badge(item.verification_status)}</article>`).join("")
      : `<div class="country-empty">Henüz doğrulanmış aggregate etki metriği yok. Public sayfada sayı gösterilmeyecek.</div>`;
  }

  function render() {
    renderKpis();
    renderCountries();
    renderCountrySelector();
    renderModules();
    renderCorridors();
    renderImpact();
    const mode = $("[data-country-mode]");
    mode.textContent = state.snapshot.writeEnabled ? "MFA + super-admin yazma açık" : "Salt okunur · production kilidi kapalı";
    mode.classList.toggle("is-write", Boolean(state.snapshot.writeEnabled));
    if (state.snapshot.warnings?.length) {
      notice(`Kısmi veri: ${state.snapshot.warnings.join(", ")}. Eksik tablo veya migration doğrulanmalı.`);
    } else {
      notice("");
    }
  }

  function dialog() { return $("[data-country-dialog]"); }
  function closeDialog() {
    const node = dialog();
    if (node?.open) node.close();
    state.pendingSubmit = null;
  }

  function openDialog({ title, eyebrow, body, submit }) {
    $("[data-dialog-title]").textContent = title;
    $("[data-dialog-eyebrow]").textContent = eyebrow;
    $("[data-dialog-body]").innerHTML = body;
    state.pendingSubmit = submit;
    const node = dialog();
    if (node.showModal) node.showModal(); else node.setAttribute("open", "");
  }

  function editCountry(countryId) {
    const country = state.snapshot.countries.find((item) => item.id === countryId);
    if (!country) return;
    const stages = ["DISABLED", "PLANNING", "INTEGRATION", "INTERNAL_TEST", "BETA", "PUBLIC"];
    const statuses = ["disabled", "coming_soon", "active"];
    openDialog({
      title: `${country.country_code} · ${country.native_name}`,
      eyebrow: "Ülke lansman aşaması",
      body: `<label>Country status<select name="status">${statuses.map((value) => `<option value="${value}" ${country.status === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Launch stage<select name="launch_stage">${stages.map((value) => `<option value="${value}" ${country.launch_stage === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Onay referansı<input name="approval_reference" maxlength="180" placeholder="Owner approval / change ticket"></label><label>Değişiklik gerekçesi<textarea name="reason" minlength="10" maxlength="900" required placeholder="Neden ve hangi doğrulamalar tamamlandı?"></textarea></label>`,
      submit: async (form) => {
        const data = new FormData(form);
        await request(`/v1/admin/country-control/countries/${encodeURIComponent(country.country_code)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: data.get("status"), launch_stage: data.get("launch_stage"), approval_reference: String(data.get("approval_reference") || ""), reason: String(data.get("reason") || ""), expected_updated_at: country.updated_at })
        });
      }
    });
  }

  function editModule(moduleId) {
    const country = selectedCountry();
    const module = state.snapshot.modules.find((item) => item.id === moduleId);
    if (!country || !module) return;
    const checks = [
      ["enabled", "Enabled"], ["beta", "Beta"], ["public_visible", "Public visible"],
      ["partner_registration_enabled", "Partner registration"], ["transaction_enabled", "Transaction"]
    ];
    openDialog({
      title: `${country.country_code} · ${module.module_key}`,
      eyebrow: "Country × Module activation",
      body: `<div class="country-dialog-checks">${checks.map(([name, label]) => `<label><input type="checkbox" name="${name}" ${module[name] ? "checked" : ""}>${escape(label)}</label>`).join("")}</div><label>Onay referansı<input name="approval_reference" maxlength="180" value="${escape(module.approval_reference || "")}" placeholder="Owner approval / change ticket"></label><label>Değişiklik gerekçesi<textarea name="reason" minlength="10" maxlength="900" required placeholder="Provider, hukuki uygunluk ve test kanıtını belirtin."></textarea></label>`,
      submit: async (form) => {
        const data = new FormData(form);
        const payload = Object.fromEntries(checks.map(([name]) => [name, data.has(name)]));
        payload.approval_reference = String(data.get("approval_reference") || "");
        payload.reason = String(data.get("reason") || "");
        payload.expected_updated_at = module.updated_at;
        await request(`/v1/admin/country-control/countries/${encodeURIComponent(country.country_code)}/modules/${encodeURIComponent(module.module_key)}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
    });
  }

  async function load() {
    notice("");
    const payload = await request("/v1/admin/country-control");
    state.snapshot = payload;
    render();
  }

  function bind() {
    $("[data-country-refresh]")?.addEventListener("click", () => load().catch((error) => notice(error.message)));
    $("[data-country-select]")?.addEventListener("change", (event) => { state.selectedCountryId = event.target.value; renderModules(); });
    document.addEventListener("click", (event) => {
      const countryButton = event.target.closest("[data-edit-country]");
      if (countryButton) editCountry(countryButton.dataset.editCountry);
      const moduleButton = event.target.closest("[data-edit-module]");
      if (moduleButton) editModule(moduleButton.dataset.editModule);
    });
    $("[data-dialog-close]")?.addEventListener("click", closeDialog);
    $("[data-dialog-cancel]")?.addEventListener("click", closeDialog);
    $("[data-country-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.pendingSubmit) return;
      const submit = $("[data-dialog-submit]");
      submit.disabled = true;
      try {
        await state.pendingSubmit(event.currentTarget);
        closeDialog();
        await load();
        notice("Değişiklik audit kaydıyla kaydedildi.", "success");
      } catch (error) {
        notice(error.message || "Değişiklik kaydedilemedi.");
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function init() {
    try {
      const session = await App.auth?.getSession?.();
      if (!session?.access_token) { window.location.href = loginUrl(); return; }
      state.access = await App.auth.requireRole(["admin", "super_admin"]);
      if (await App.auth.redirectToMfaIfNeeded?.(`${window.location.pathname}${window.location.hash}`)) return;
      bind();
      await load();
    } catch (error) {
      notice(error.message || "Country Control Center başlatılamadı.");
      $("[data-country-list]").innerHTML = `<div class="country-empty">Backend flag, migration, admin rolü ve MFA doğrulamasını kontrol edin.</div>`;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
