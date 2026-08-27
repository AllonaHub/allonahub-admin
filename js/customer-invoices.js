(function () {
  const App = window.Allona = window.Allona || {};
  const ui = App.eDonusum;
  let currentOrderId = "";

  function profileLabel(profile) {
    return profile.profile_type === "corporate"
      ? `${profile.company_name || "Kurumsal profil"}${profile.tax_office ? ` · ${profile.tax_office}` : ""}`
      : `${profile.name || "Bireysel profil"} ${profile.surname || ""}`.trim();
  }

  function syncProfileTypeFields(form) {
    if (!form) return;
    const profileType = String(form.elements.profileType?.value || "individual");
    form.querySelectorAll("[data-profile-scope]").forEach((field) => {
      const active = field.dataset.profileScope === profileType;
      field.hidden = !active;
      field.querySelectorAll("input").forEach((input) => {
        input.disabled = !active;
        input.required = active;
      });
    });
  }

  async function artifact(invoiceId, kind, button) {
    button.disabled = true;
    try {
      const payload = await ui.request(`/v1/e-invoicing/invoices/${encodeURIComponent(invoiceId)}/artifacts/${kind}`);
      ui.openSignedUrl(payload.signedUrl);
    } catch (error) {
      const target = document.querySelector("[data-order-invoices]");
      if (target) target.insertAdjacentHTML("afterbegin", `<div class="customer-invoices__error">${ui.escape(error.message || "Belge açılamadı.")}</div>`);
    } finally {
      button.disabled = false;
    }
  }

  function render(target, items, profiles, selectedProfileId, profileLocked) {
    const profileOptions = profiles.map((profile) => `<option value="${ui.escape(profile.id)}" ${profile.id === selectedProfileId ? "selected" : ""}>${ui.escape(profileLabel(profile))}${profile.is_default ? " · Varsayılan" : ""}</option>`).join("");
    target.innerHTML = `
      <section class="customer-invoice-profile">
        <div><h2>Fatura bilgileri</h2><p>Fatura oluşmadan önce bireysel veya kurumsal profilinizi siparişe bağlayın.</p></div>
        <div class="customer-invoice-profile__select">
          <select data-customer-profile-select aria-label="Sipariş fatura profili" ${profileLocked ? "disabled" : ""}><option value="">Profil seçin</option>${profileOptions}</select>
          <button type="button" data-customer-profile-attach ${profileLocked || !profiles.length ? "disabled" : ""}>Siparişe Bağla</button>
        </div>
        ${profileLocked ? `<small class="customer-invoice-profile__locked">Fatura planlandığı için bağlı profil artık değiştirilemez.</small>` : ""}
        ${profileLocked ? "" : `<details class="customer-invoice-profile__new">
          <summary>Yeni fatura profili oluştur</summary>
          <form data-customer-profile-form>
            <label>Profil türü<select name="profileType"><option value="individual">Bireysel</option><option value="corporate">Kurumsal</option></select></label>
            <label data-profile-scope="individual">Ad<input name="name" maxlength="120"></label>
            <label data-profile-scope="individual">Soyad<input name="surname" maxlength="120"></label>
            <label data-profile-scope="corporate">Şirket unvanı<input name="companyName" maxlength="240"></label>
            <label data-profile-scope="corporate">Vergi numarası<input name="taxNumber" maxlength="32" inputmode="numeric"></label>
            <label data-profile-scope="corporate">Vergi dairesi<input name="taxOffice" maxlength="160"></label>
            <label>E-posta<input name="email" type="email" maxlength="180" required></label>
            <label class="is-wide">Fatura adresi<input name="addressLine" maxlength="400" required></label>
            <label>Şehir<input name="city" maxlength="120" required></label>
            <label class="customer-invoice-profile__default"><input name="isDefault" type="checkbox"> Varsayılan profil yap</label>
            <button type="submit">Profili Kaydet</button>
          </form>
        </details>`}
      </section>
      <header class="customer-invoices__head">
        <div><h2>Faturalar</h2><p>Bu sipariş birden fazla satıcı faturası içerebilir.</p></div>
        <span class="customer-invoices__count">${items.length}</span>
      </header>
      ${items.length ? `<div class="customer-invoices__list">${items.map((invoice) => `
        <article class="customer-invoice">
          <div><strong>${ui.escape(invoice.seller?.display_name || "Satıcı")}</strong><small>${ui.escape(invoice.invoice_number || "Fatura numarası bekleniyor")}</small></div>
          <div><span>${ui.escape(invoice.document_type === "E_INVOICE" ? "e-Fatura" : invoice.document_type === "E_ARCHIVE" ? "e-Arşiv" : invoice.document_type)}</span><small>${ui.escape(invoice.issue_date || "Tarih bekleniyor")}</small></div>
          <div><strong>${ui.exactMoney(invoice.grand_total, invoice.currency)}</strong></div>
          <div class="customer-invoice__status">${ui.badge(invoice.status)}</div>
          <div class="customer-invoice__actions">
            <button type="button" data-customer-invoice-artifact="pdf" data-invoice-id="${ui.escape(invoice.id)}" ${invoice.hasPdf ? "" : "disabled"}>PDF</button>
            <button type="button" data-customer-invoice-artifact="xml" data-invoice-id="${ui.escape(invoice.id)}" ${invoice.hasXml ? "" : "disabled"}>XML</button>
          </div>
        </article>`).join("")}</div>` : `<div class="customer-invoices__empty">Bu sipariş için henüz fatura oluşturulmadı. Satıcı veya vergi profili belirsizse sistem tahmin yapmak yerine inceleme bekler.</div>`}`;
    syncProfileTypeFields(target.querySelector("[data-customer-profile-form]"));
  }

  async function load(orderId) {
    const target = document.querySelector("[data-order-invoices]");
    if (!target || !orderId) return;
    target.hidden = false;
    target.innerHTML = `<div class="customer-invoices__loading">Faturalar yetki kontrolüyle yükleniyor…</div>`;
    try {
      const [payload, profilePayload] = await Promise.all([
        ui.request(`/v1/account/orders/${encodeURIComponent(orderId)}/invoices`),
        ui.request("/v1/account/invoice-profiles")
      ]);
      render(target, payload.items || [], profilePayload.items || [], payload.customerInvoiceProfileId || "", payload.profileLocked === true);
    } catch (error) {
      if (error.status === 404 || error.code === "E_INVOICING_DISABLED") {
        target.hidden = true;
        target.innerHTML = "";
        return;
      }
      target.innerHTML = `<div class="customer-invoices__error">${ui.escape(error.message || "Faturalar yüklenemedi.")}</div>`;
    }
  }

  document.addEventListener("allona:order-rendered", (event) => {
    if (event.detail?.mode === "user") { currentOrderId = event.detail.orderId; load(currentOrderId); }
  });
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-customer-invoice-artifact]");
    if (button) artifact(button.dataset.invoiceId, button.dataset.customerInvoiceArtifact, button);
    const attach = event.target.closest("[data-customer-profile-attach]");
    if (attach && currentOrderId) {
      const profileId = document.querySelector("[data-customer-profile-select]")?.value;
      if (!profileId) return;
      attach.disabled = true;
      try {
        await ui.request(`/v1/account/orders/${encodeURIComponent(currentOrderId)}/invoice-profile`, { method: "PATCH", body: JSON.stringify({ profileId }) });
        await load(currentOrderId);
      } catch (error) {
        const target = document.querySelector("[data-order-invoices]");
        if (target) target.insertAdjacentHTML("afterbegin", `<div class="customer-invoices__error">${ui.escape(error.message || "Profil bağlanamadı.")}</div>`);
        attach.disabled = false;
      }
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-customer-profile-form] [name=profileType]")) {
      syncProfileTypeFields(event.target.closest("[data-customer-profile-form]"));
    }
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-customer-profile-form]");
    if (!form || !currentOrderId) return;
    event.preventDefault();
    const data = new FormData(form);
    const profileType = String(data.get("profileType") || "individual");
    const payload = {
      profileType,
      name: profileType === "individual" ? String(data.get("name") || "").trim() || null : null,
      surname: profileType === "individual" ? String(data.get("surname") || "").trim() || null : null,
      companyName: profileType === "corporate" ? String(data.get("companyName") || "").trim() || null : null,
      taxNumber: profileType === "corporate" ? String(data.get("taxNumber") || "").trim() || null : null,
      taxOffice: profileType === "corporate" ? String(data.get("taxOffice") || "").trim() || null : null,
      email: String(data.get("email") || "").trim() || null,
      billingAddress: { line1: String(data.get("addressLine") || "").trim(), city: String(data.get("city") || "").trim(), country: "TR" },
      isDefault: data.get("isDefault") === "on"
    };
    if (!form.reportValidity()) return;
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      await ui.request(`/v1/account/orders/${encodeURIComponent(currentOrderId)}/invoice-profiles`, { method: "POST", body: JSON.stringify(payload) });
      await load(currentOrderId);
    } catch (error) {
      const target = document.querySelector("[data-order-invoices]");
      if (target) target.insertAdjacentHTML("afterbegin", `<div class="customer-invoices__error">${ui.escape(error.message || "Profil kaydedilemedi.")}</div>`);
      submit.disabled = false;
    }
  });
})();
