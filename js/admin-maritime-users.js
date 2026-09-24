(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const config = App.config || {};
  const state = {
    users: [],
    detail: null,
    activeUserId: "",
    activeTab: "account"
  };

  const collectionDefinitions = {
    additionalData: {
      title: "Ek Sertifikalar",
      fields: ["name", "institute", "place", "issue", "cert", "expiry"]
    },
    stcwData: {
      title: "STCW Sertifikaları",
      fields: ["code", "name", "institute", "place", "issue", "rank", "number", "expiry", "unlimited", "included"]
    },
    seaData: {
      title: "Deniz Tecrübesi",
      fields: ["imo", "vessel", "company", "type", "flag", "mmsi", "dwt", "grt", "rank", "signon", "signoff", "referenceName", "referenceCompanyEmail", "referenceCompanyPhone", "referencePhone"]
    }
  };

  const fieldLabels = {
    position: "Pozisyon",
    familyName: "Soyadı",
    firstName: "Adı",
    fatherName: "Baba Adı",
    birthDate: "Doğum Tarihi",
    birthPlace: "Doğum Yeri",
    nationality: "Uyruğu",
    gender: "Cinsiyet",
    marital: "Medeni Durum",
    address: "Daimi Adres",
    airport: "En Yakın Havalimanı",
    height: "Boy",
    weight: "Kilo",
    eyes: "Göz Rengi",
    hair: "Saç Rengi",
    shoes: "İş Ayakkabısı",
    overall: "Tulum Bedeni",
    mobile: "Telefon",
    email: "E-posta",
    kinName: "Yakın Kişi",
    kinPhone: "Yakın Telefonu",
    kinRelation: "Yakınlık Derecesi",
    kinAddress: "Yakın Adresi",
    passportDoc: "Pasaport Türü",
    passportNo: "Pasaport Numarası",
    passportCountry: "Pasaportu Düzenleyen Ülke",
    passportPlace: "Pasaport Düzenleme Yeri",
    passportIssued: "Pasaport Veriliş Tarihi",
    passportValid: "Pasaport Geçerlilik Tarihi",
    seamanBookNo: "Gemiadamı Cüzdan Numarası",
    seamanBookPlace: "Gemiadamı Cüzdan Düzenleme Yeri",
    seamanBookIssued: "Gemiadamı Cüzdan Veriliş Tarihi",
    seamanBookValid: "Gemiadamı Cüzdan Geçerlilik Tarihi",
    seafarerIdNo: "Gemiadamı Kimlik Numarası",
    seafarerIdPlace: "Gemiadamı Kimlik Düzenleme Yeri",
    seafarerIdIssued: "Gemiadamı Kimlik Veriliş Tarihi",
    seafarerIdValid: "Gemiadamı Kimlik Geçerlilik Tarihi",
    windows: "Windows Bilgisi",
    office: "Office Bilgisi",
    internet: "İnternet Bilgisi",
    schoolName: "Okul Adı",
    schoolPlace: "Okul Yeri",
    schoolGrade: "Eğitim Derecesi",
    schoolFrom: "Eğitim Başlangıcı",
    schoolTo: "Eğitim Bitişi",
    azSpeak: "Azerice Konuşma",
    azRead: "Azerice Okuma",
    azWrite: "Azerice Yazma",
    trSpeak: "Türkçe Konuşma",
    trRead: "Türkçe Okuma",
    trWrite: "Türkçe Yazma",
    enSpeak: "İngilizce Konuşma",
    enRead: "İngilizce Okuma",
    enWrite: "İngilizce Yazma",
    ruSpeak: "Rusça Konuşma",
    ruRead: "Rusça Okuma",
    ruWrite: "Rusça Yazma",
    medicalDoc: "Sağlık Belgesi",
    medicalFitness: "Sağlık Uygunluğu",
    medicalGrade: "Sağlık Belgesi Geçerlilik Yılı",
    medicalPlace: "Sağlık Belgesi Düzenleme Yeri",
    medicalIssue: "Sağlık Belgesi Veriliş Tarihi",
    medicalExpiry: "Sağlık Belgesi Geçerlilik Tarihi",
    competencyClass: "Yeterlilik Sınıfı",
    competencyCountry: "Yeterliliği Düzenleyen Ülke",
    competencyCertificate: "Yeterlilik Sertifikası",
    competencyIssued: "Yeterlilik Veriliş Tarihi",
    competencyExpires: "Yeterlilik Geçerlilik Tarihi",
    competencyLimit: "Yeterlilik Sınırı",
    note: "Mesleki Özet",
    tradeSpecialty: "Ek Mesleki Yeterlilik",
    name: "Sertifika Adı",
    institute: "Kurum",
    place: "Alındığı Yer",
    issue: "Veriliş Tarihi",
    cert: "Sertifika Numarası",
    expiry: "Geçerlilik Tarihi",
    presetId: "Hazır Sertifika Kaydı",
    code: "STCW Kodu",
    rank: "Rütbe",
    number: "Sertifika Numarası",
    unlimited: "Süresiz",
    included: "CV'de Göster",
    vessel: "Gemi",
    company: "Şirket",
    type: "Gemi Türü",
    flag: "Bayrak",
    dwt: "DWT",
    grt: "GRT",
    signon: "Katılış Tarihi",
    signoff: "Ayrılış Tarihi",
    imo: "IMO Numarası",
    mmsi: "MMSI",
    referenceName: "Referans Yetkilisi",
    referenceCompanyEmail: "Şirket E-postası",
    referenceCompanyPhone: "Şirket Telefonu",
    referencePhone: "Referans Telefonu"
  };

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function escapeHtml(value) {
    if (App.core && App.core.escapeHTML) return App.core.escapeHTML(String(value ?? ""));
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[char]);
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("tr-TR");
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function humanize(key) {
    if (fieldLabels[key]) return fieldLabels[key];
    return String(key || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function inputType(key) {
    return new Set(["birthDate", "passportIssued", "passportValid", "seamanBookIssued", "seamanBookValid", "seafarerIdIssued", "seafarerIdValid", "schoolFrom", "schoolTo", "medicalIssue", "medicalExpiry", "competencyIssued", "competencyExpires", "issue", "expiry", "signon", "signoff"]).has(key) ? "date" : "text";
  }

  function cvDisplayValue(field, value, language) {
    const contexts = {
      position: "rank", rank: "rank", type: "vesselType", nationality: "country", passportCountry: "country", competencyCountry: "country", flag: "country",
      gender: "gender", marital: "marital", firstName: "name", familyName: "name", fatherName: "name", kinName: "name", referenceName: "name",
      name: "semantic", birthPlace: "place", address: "place", airport: "place", place: "place", passportPlace: "place", institute: "organization", company: "organization", vessel: "vessel",
      overall: "semantic", eyes: "semantic", hair: "semantic", schoolGrade: "semantic", tradeSpecialty: "semantic"
    };
    const context = contexts[field] || (/^(az|tr|en|ru)(Speak|Read|Write)$/.test(field) || ["windows", "office", "internet"].includes(field) ? "semantic" : "identifier");
    return window.AllonaMaritimeCvValueLocalizer?.localize(value, language, context) ?? String(value ?? "");
  }

  function cvControl(field, value, dataAttribute, language, readonly = false) {
    const escapedField = escapeHtml(field);
    const displayValue = cvDisplayValue(field, value ?? "", language);
    const escapedValue = escapeHtml(displayValue);
    const source = `data-source-value="${escapeHtml(value ?? "")}" data-display-value="${escapedValue}"`;
    if (field === "note") {
      return `<textarea rows="4" ${source} ${dataAttribute}="${escapedField}">${escapedValue}</textarea>`;
    }
    if (field === "name") {
      return `<textarea rows="2" ${source} ${dataAttribute}="${escapedField}"${readonly ? " readonly" : ""}>${escapedValue}</textarea>`;
    }
    if (["included", "unlimited"].includes(field)) {
      return `<select ${dataAttribute}="${escapedField}">
        <option value="true"${String(value) === "true" || (field === "included" && value !== "false") ? " selected" : ""}>Evet</option>
        <option value="false"${String(value) === "false" || (field === "unlimited" && value !== "true") ? " selected" : ""}>Hayır</option>
      </select>`;
    }
    return `<input type="${inputType(field)}" ${source} ${dataAttribute}="${escapedField}" value="${escapedValue}"${readonly ? " readonly" : ""}>`;
  }

  function setAlert(message, error) {
    const target = qs("[data-alert]");
    if (!target) return;
    target.hidden = !message;
    target.textContent = message || "";
    target.classList.toggle("is-error", Boolean(error));
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = Boolean(busy);
    if (busy) {
      button.dataset.previousLabel = button.textContent;
      button.textContent = "İşleniyor";
    } else if (button.dataset.previousLabel) {
      button.textContent = button.dataset.previousLabel;
      delete button.dataset.previousLabel;
    }
  }

  async function sessionToken() {
    const session = await App.auth.getSession();
    if (!session || !session.access_token) throw new Error("Süper Admin oturumu bulunamadı.");
    return session.access_token;
  }

  function loginUrl() {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    return `../pages/account/user.html?tab=login&switchAccount=1&intent=super_admin&returnTo=${returnTo}`;
  }

  async function api(path, options) {
    const token = await sessionToken();
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: options?.method || "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    const message = payload.message || payload.error || "İşlem tamamlanamadı.";
    if (response.status === 401) window.location.href = loginUrl();
    if (response.status === 403 && /mfa|iki aşamalı|aal2/i.test(message)) {
      const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      window.location.href = `../pages/account/mfa.html?returnTo=${returnTo}`;
    }
    throw new Error(message);
  }

  function statusLabel(value) {
    const labels = {
      active: "Aktif",
      passive: "Pasif",
      suspended: "Askıda",
      draft: "Taslak",
      user_confirmed: "Kullanıcı onaylı",
      verification_pending: "İncelemede",
      verified: "Doğrulanmış",
      stale: "Güncelleme gerekli",
      restricted: "Kısıtlı"
    };
    return labels[value] || value || "Kayıt yok";
  }

  function renderUsers() {
    const target = qs("[data-user-list]");
    const status = qs("[data-directory-status]");
    if (status) status.textContent = `${state.users.length} denizcilik kullanıcısı gösteriliyor.`;
    if (!target) return;
    if (!state.users.length) {
      target.innerHTML = '<div class="mau-record"><p>Kullanıcı bulunamadı.</p></div>';
      return;
    }
    target.innerHTML = state.users.map((user) => `
      <button class="mau-user-item ${state.activeUserId === user.id ? "is-active" : ""}" type="button" data-user-id="${escapeHtml(user.id)}">
        <strong>${escapeHtml(user.public_id)}</strong>
        <span>${escapeHtml(user.full_name || user.email || "İsimsiz kullanıcı")}</span>
        <small>${escapeHtml(statusLabel(user.maritime_cv?.profile_status))} / ${escapeHtml(user.email)}</small>
      </button>
    `).join("");
  }

  async function loadUsers(form) {
    const params = new URLSearchParams();
    if (form) {
      const data = new FormData(form);
      ["search", "profile_status", "account_status"].forEach((key) => {
        const value = String(data.get(key) || "").trim();
        if (value) params.set(key, value);
      });
    }
    qs("[data-directory-status]").textContent = "Kullanıcılar yükleniyor.";
    const payload = await api(`/v1/control-center/maritime-users?${params.toString()}`);
    state.users = payload.users || [];
    renderUsers();
  }

  function renderHeader(detail) {
    qs("[data-user-name]").textContent = detail.user.full_name || detail.auth?.email || "İsimsiz kullanıcı";
    qs("[data-user-public-id]").textContent = detail.user.public_id || "AL-";
    qs("[data-user-account-status]").textContent = statusLabel(detail.user.account_status);
    qs("[data-user-cv-status]").textContent = statusLabel(detail.cv_profile?.profile_status);
    const photo = qs("[data-profile-photo]");
    const empty = qs("[data-profile-photo-empty]");
    const hasPhoto = Boolean(detail.profile_photo_url);
    if (photo) {
      photo.hidden = !hasPhoto;
      if (hasPhoto) photo.src = detail.profile_photo_url;
      else photo.removeAttribute("src");
    }
    if (empty) empty.hidden = hasPhoto;
  }

  function renderAccount(detail) {
    const form = qs("[data-account-form]");
    form.elements.full_name.value = detail.user.full_name || "";
    form.elements.email.value = detail.auth?.email || detail.user.email || "";
    form.elements.phone.value = detail.user.phone || "";
    form.elements.account_status.value = detail.user.account_status || "active";
    form.elements.risk_level.value = detail.user.risk_level || "low";
    form.elements.flagged_suspicious.checked = Boolean(detail.user.flagged_suspicious);
    form.elements.reason.value = "";

    const stats = [
      ["AL Kimliği", detail.user.public_id || "-"],
      ["E-posta Doğrulaması", detail.auth?.email_confirmed_at ? "Doğrulandı" : "Bekliyor"],
      ["Son Giriş", formatDate(detail.auth?.last_sign_in_at)],
      ["Kayıt Tarihi", formatDate(detail.auth?.created_at || detail.user.created_at)],
      ["Hazırlık Puanı", detail.workspace?.readiness_score ?? 0],
      ["Hazırlık Durumu", statusLabel(detail.workspace?.readiness_level)],
      ["Çalışma Durumu", statusLabel(detail.workspace?.current_work_status)],
      ["Uygunluk", statusLabel(detail.workspace?.availability_status)]
    ];
    qs("[data-account-stats]").innerHTML = stats.map(([label, value]) => `
      <div class="mau-stat"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>
    `).join("");
  }

  function currentManualCv(detail) {
    const payload = detail.cv_profile?.profile_payload || {};
    const manual = payload.manual_cv && typeof payload.manual_cv === "object" ? payload.manual_cv : {};
    return {
      ...manual,
      lang: ["tr", "az", "kk", "uz", "ky", "en", "de", "ru", "ar"].includes(manual.lang) ? manual.lang : "tr",
      summaryMode: ["auto", "custom"].includes(manual.summaryMode) ? manual.summaryMode : "auto",
      fields: manual.fields && typeof manual.fields === "object" && !Array.isArray(manual.fields) ? manual.fields : {},
      additionalData: Array.isArray(manual.additionalData) ? manual.additionalData : [],
      stcwData: Array.isArray(manual.stcwData) ? manual.stcwData : [],
      seaData: Array.isArray(manual.seaData) ? manual.seaData : []
    };
  }

  function renderCvFields(detail, preserveSettings = false) {
    const manual = currentManualCv(detail);
    const orderedKeys = detail.cv_editor?.fields || Object.keys(fieldLabels).slice(0, Object.keys(fieldLabels).indexOf("name"));
    qs("[data-cv-fields]").innerHTML = `
      <h4>CV Bilgileri</h4>
      <div class="mau-cv-field-grid">
        ${orderedKeys.length ? orderedKeys.map((key) => `
          <label>${escapeHtml(humanize(key))}
            ${cvControl(key, manual.fields[key], "data-cv-field", manual.lang)}
          </label>
        `).join("") : '<p>Henüz CV alanı bulunmuyor.</p>'}
      </div>
    `;

    qs("[data-cv-collections]").innerHTML = Object.entries(collectionDefinitions).map(([key, definition]) => {
      const rows = Array.isArray(manual[key]) ? manual[key] : [];
      const fields = definition.fields;
      return `
        <section class="mau-collection" data-collection="${escapeHtml(key)}">
          <div class="mau-collection-head">
            <h4>${escapeHtml(definition.title)}</h4>
            <button class="mau-btn mau-btn-ghost" type="button" data-add-row="${escapeHtml(key)}">Yeni Kayıt Ekle</button>
          </div>
          <div class="mau-repeat-list">
            ${rows.length ? rows.map((row, index) => {
              const preset = key === "stcwData" && detail.cv_editor?.presets?.[String(row.presetId || row.code || "").toLowerCase()];
              const stored = detail.cv_profile?.profile_payload?.certificate_records?.find((item) => item.code === row.code);
              const values = key === "stcwData" ? { ...row, number: row.number || row.cert || "", name: preset?.[manual.lang] || preset?.en || row.name || stored?.title_i18n?.[manual.lang] || stored?.title || "" } : row;
              return `
              <div class="mau-repeat-row" data-row-index="${index}">
                ${fields.map((field) => `
                  <label${field === "name" ? ' class="mau-certificate-name"' : ""}>${escapeHtml(humanize(field))}
                    ${cvControl(field, values?.[field], "data-row-field", manual.lang, Boolean(preset && ["name", "code"].includes(field)))}
                  </label>
                `).join("")}
                <button class="mau-btn mau-btn-danger" type="button" data-remove-row="${escapeHtml(key)}" data-row-index="${index}">Kaldır</button>
              </div>
            `; }).join("") : '<div class="mau-record"><p>Kayıt bulunmuyor.</p></div>'}
          </div>
        </section>
      `;
    }).join("");

    const form = qs("[data-cv-form]");
    form.elements.cv_language.value = manual.lang;
    form.elements.summary_mode.value = manual.summaryMode;
    if (!preserveSettings) {
      form.elements.profile_status.value = detail.cv_profile?.profile_status || "draft";
      form.elements.completion_percent.value = detail.cv_profile?.completion_percent ?? 0;
      form.elements.reason.value = "";
    }
  }

  function renderDocuments(detail) {
    const documents = detail.documents || [];
    qs("[data-document-count]").textContent = `${documents.length} belge`;
    qs("[data-documents]").innerHTML = documents.length ? documents.map((document) => `
      <article class="mau-record" data-document-id="${escapeHtml(document.id)}">
        <div class="mau-record-head">
          <strong>${escapeHtml(document.original_file_name || document.document_type || "Belge")}</strong>
          <span>${escapeHtml(statusLabel(document.status))}</span>
        </div>
        <p>${escapeHtml(document.document_type)} / ${escapeHtml(formatBytes(document.file_size_bytes))} / ${escapeHtml(formatDate(document.created_at))}</p>
        <div class="mau-document-actions">
          <select data-document-status aria-label="Belge kararı"><option value="verified">Doğrula</option><option value="rejected">Reddet</option><option value="revoked">Geçersiz Kıl</option></select>
          <input data-document-reason type="text" maxlength="1200" placeholder="Karar gerekçesi">
          <button class="mau-btn" type="button" data-document-save>Kararı Kaydet</button>
          <button class="mau-btn mau-btn-ghost" type="button" data-document-open>Belgeyi Aç</button>
        </div>
      </article>
    `).join("") : '<div class="mau-record"><p>Yüklenmiş belge bulunmuyor.</p></div>';
  }

  function renderActivity(detail) {
    const applications = detail.applications || [];
    const offers = detail.offers || [];
    qs("[data-applications]").innerHTML = applications.length ? applications.map((item) => `
      <article class="mau-record">
        <div class="mau-record-head"><strong>${escapeHtml(item.job?.job_title || item.job?.job_reference || item.job_id)}</strong><span>${escapeHtml(statusLabel(item.status))}</span></div>
        <p>${escapeHtml(item.job?.rank_code || "Pozisyon belirtilmedi")} / ${escapeHtml(formatDate(item.created_at))}</p>
      </article>
    `).join("") : '<div class="mau-record"><p>Başvuru bulunmuyor.</p></div>';
    qs("[data-offers]").innerHTML = offers.length ? offers.map((item) => `
      <article class="mau-record">
        <div class="mau-record-head"><strong>${escapeHtml(item.id)}</strong><span>${escapeHtml(statusLabel(item.offer_status))}</span></div>
        <p>${escapeHtml(formatDate(item.created_at))}</p>
      </article>
    `).join("") : '<div class="mau-record"><p>Teklif bulunmuyor.</p></div>';
  }

  function renderSecurity(detail) {
    const security = detail.security || {};
    const stats = [
      ["Kimlik Kilidi", security.identity_lock ? "Aktif" : "Yok"],
      ["Passkey", security.passkey && !security.passkey.revoked_at ? "Aktif" : "Yok"],
      ["Bağlı Cihaz", security.device_binding_count || 0],
      ["Kimlik Kilit Tarihi", formatDate(security.identity_lock?.locked_at)]
    ];
    qs("[data-security-stats]").innerHTML = stats.map(([label, value]) => `
      <div class="mau-stat"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>
    `).join("");

    const history = detail.admin_history || [];
    qs("[data-admin-history]").innerHTML = history.length ? history.map((item) => `
      <article class="mau-record">
        <div class="mau-record-head"><strong>${escapeHtml(humanize(item.action))}</strong><span>${escapeHtml(formatDate(item.created_at))}</span></div>
        <p>${escapeHtml(item.reason)} / Saklama: ${escapeHtml(formatDate(item.retention_until))}</p>
      </article>
    `).join("") : '<div class="mau-record"><p>Yönetim müdahalesi bulunmuyor.</p></div>';

    qs("[data-reset-form]").elements.confirmation_public_id.value = "";
    qs("[data-reset-form]").elements.reason.value = "";
  }

  function renderDetail() {
    const detail = state.detail;
    qs("[data-empty-state]").hidden = Boolean(detail);
    qs("[data-user-workspace]").hidden = !detail;
    if (!detail) return;
    renderHeader(detail);
    renderAccount(detail);
    renderCvFields(detail);
    renderDocuments(detail);
    renderActivity(detail);
    renderSecurity(detail);
    switchTab(state.activeTab);
  }

  async function openUser(userId) {
    state.activeUserId = userId;
    renderUsers();
    setAlert("Kullanıcı kaydı açılıyor.");
    const detail = await api(`/v1/control-center/maritime-users/${encodeURIComponent(userId)}`);
    state.detail = detail;
    const listed = state.users.find((user) => user.id === userId);
    if (listed && detail.cv_profile) listed.maritime_cv = { ...listed.maritime_cv, profile_status: detail.cv_profile.profile_status };
    renderUsers();
    renderDetail();
    setAlert("");
  }

  function switchTab(tab) {
    state.activeTab = tab;
    qsa("[data-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tab));
    qsa("[data-view]").forEach((view) => view.classList.toggle("is-active", view.dataset.view === tab));
  }

  function collectCvPayload() {
    const detail = state.detail;
    const payload = JSON.parse(JSON.stringify(detail.cv_profile?.profile_payload || {}));
    const manual = currentManualCv(detail);
    const cvForm = qs("[data-cv-form]");
    manual.lang = cvForm.elements.cv_language.value;
    manual.summaryMode = cvForm.elements.summary_mode.value;
    manual.fields = {};
    const sourceValue = (input) => input.dataset.displayValue === input.value ? input.dataset.sourceValue : input.value;
    qsa("[data-cv-field]").forEach((input) => {
      manual.fields[input.dataset.cvField] = sourceValue(input);
    });

    Object.keys(collectionDefinitions).forEach((key) => {
      const section = qs(`[data-collection="${key}"]`);
      manual[key] = qsa(".mau-repeat-row[data-row-index]", section).map((row) => {
        const item = { ...(manual[key][Number(row.dataset.rowIndex)] || {}) };
        qsa("[data-row-field]", row).forEach((input) => {
          if (input.readOnly) return;
          item[input.dataset.rowField] = sourceValue(input);
        });
        if (key === "stcwData") item.cert = "";
        return item;
      });
    });

    payload.manual_cv = manual;
    payload.data_origin = payload.data_origin || "user_entered_maritime_cv";
    payload.given_names = manual.fields.firstName || "";
    payload.family_name = manual.fields.familyName || "";
    payload.middle_name = manual.fields.fatherName || "";
    payload.date_of_birth = manual.fields.birthDate || "";
    payload.place_of_birth = manual.fields.birthPlace || "";
    payload.nationality = manual.fields.nationality || "";
    payload.gender = manual.fields.gender || "";
    payload.holder_name = [payload.given_names, payload.middle_name, payload.family_name].filter(Boolean).join(" ");
    return payload;
  }

  function addCollectionRow(key) {
    state.detail.cv_profile = state.detail.cv_profile || { profile_payload: {}, profile_status: "draft", completion_percent: 0 };
    state.detail.cv_profile.profile_payload = collectCvPayload();
    const manual = currentManualCv(state.detail);
    manual[key] = Array.isArray(manual[key]) ? manual[key] : [];
    const row = Object.fromEntries(collectionDefinitions[key].fields.map((field) => [field, ""]));
    manual[key].push(row);
    state.detail.cv_profile.profile_payload.manual_cv = manual;
    renderCvFields(state.detail, true);
  }

  function removeCollectionRow(key, index) {
    state.detail.cv_profile.profile_payload = collectCvPayload();
    const manual = currentManualCv(state.detail);
    if (!Array.isArray(manual[key])) return;
    manual[key].splice(index, 1);
    state.detail.cv_profile.profile_payload.manual_cv = manual;
    renderCvFields(state.detail, true);
  }

  async function saveAccount(form, button) {
    const data = new FormData(form);
    const body = {
      full_name: String(data.get("full_name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      account_status: String(data.get("account_status") || "active"),
      risk_level: String(data.get("risk_level") || "low"),
      flagged_suspicious: data.get("flagged_suspicious") === "on",
      reason: String(data.get("reason") || "").trim()
    };
    setBusy(button, true);
    try {
      await api(`/v1/control-center/maritime-users/${encodeURIComponent(state.activeUserId)}/account`, { method: "PATCH", body });
      await openUser(state.activeUserId);
      setAlert("Hesap bilgileri kaydedildi.");
    } finally {
      setBusy(button, false);
    }
  }

  async function saveCv(form, button) {
    const data = new FormData(form);
    const body = {
      profile_payload: collectCvPayload(),
      profile_status: String(data.get("profile_status") || "draft"),
      completion_percent: Number(data.get("completion_percent") || 0),
      reason: String(data.get("reason") || "").trim()
    };
    setBusy(button, true);
    try {
      await api(`/v1/control-center/maritime-users/${encodeURIComponent(state.activeUserId)}/cv`, { method: "PATCH", body });
      await openUser(state.activeUserId);
      switchTab("cv");
      setAlert("Maritime CV güvenli biçimde güncellendi.");
    } finally {
      setBusy(button, false);
    }
  }

  async function decide(decision, button) {
    const reason = qs("[data-decision-reason]").value.trim();
    if (reason.length < 6) throw new Error("Karar için en az 6 karakterlik gerekçe girin.");
    if (!window.confirm("Bu yönetici kararını uygulamak istediğinizi doğrulayın.")) return;
    setBusy(button, true);
    try {
      await api(`/v1/control-center/maritime-users/${encodeURIComponent(state.activeUserId)}/decision`, {
        method: "POST",
        body: { decision, reason }
      });
      await openUser(state.activeUserId);
      setAlert("Denizcilik kullanıcı kararı uygulandı.");
    } finally {
      setBusy(button, false);
    }
  }

  async function reviewDocument(card, button) {
    const documentId = card.dataset.documentId;
    const status = qs("[data-document-status]", card).value;
    const reason = qs("[data-document-reason]", card).value.trim();
    if (reason.length < 6) throw new Error("Belge kararı için en az 6 karakterlik gerekçe girin.");
    setBusy(button, true);
    try {
      await api(`/v1/control-center/maritime-users/${encodeURIComponent(state.activeUserId)}/documents/${encodeURIComponent(documentId)}/decision`, {
        method: "POST",
        body: { status, reason }
      });
      await openUser(state.activeUserId);
      switchTab("documents");
      setAlert("Belge kararı kaydedildi.");
    } finally {
      setBusy(button, false);
    }
  }

  async function openDocument(card, button) {
    const documentId = card.dataset.documentId;
    const opened = window.open("about:blank", "_blank", "noopener");
    setBusy(button, true);
    try {
      const payload = await api(`/v1/control-center/maritime-users/${encodeURIComponent(state.activeUserId)}/documents/${encodeURIComponent(documentId)}/download`);
      if (opened) opened.location.href = payload.url;
      else window.location.href = payload.url;
    } catch (error) {
      if (opened) opened.close();
      throw error;
    } finally {
      setBusy(button, false);
    }
  }

  async function resetMaritime(form, button) {
    const data = new FormData(form);
    const body = {
      scope: String(data.get("scope") || "cv"),
      confirmation_public_id: String(data.get("confirmation_public_id") || "").trim().toUpperCase(),
      reason: String(data.get("reason") || "").trim()
    };
    if (body.confirmation_public_id !== state.detail.user.public_id) throw new Error("Onay için kullanıcının AL kimliğini eksiksiz yazın.");
    if (!window.confirm("Bu işlem aktif denizcilik verilerini temizleyecek. Devam etmek istediğinizi doğrulayın.")) return;
    setBusy(button, true);
    try {
      await api(`/v1/control-center/maritime-users/${encodeURIComponent(state.activeUserId)}/reset`, { method: "POST", body });
      await openUser(state.activeUserId);
      switchTab("security");
      setAlert("Kontrollü temizleme tamamlandı; işlem öncesi denetim kaydı 90 gün saklanıyor.");
    } finally {
      setBusy(button, false);
    }
  }

  function bindEvents() {
    qs('[name="cv_language"]')?.addEventListener("change", () => {
      if (!state.detail) return;
      state.detail.cv_profile.profile_payload = collectCvPayload();
      renderCvFields(state.detail, true);
    });
    qs("[data-back]")?.addEventListener("click", () => {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "./super-admin.html";
    });
    qs("[data-signout]")?.addEventListener("click", async () => {
      await App.auth.signOut({ scope: "local" });
      window.location.href = loginUrl();
    });
    qs("[data-search-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try { await loadUsers(event.currentTarget); } catch (error) { setAlert(error.message, true); }
    });
    qs("[data-account-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try { await saveAccount(event.currentTarget, event.submitter); } catch (error) { setAlert(error.message, true); }
    });
    qs("[data-cv-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try { await saveCv(event.currentTarget, event.submitter); } catch (error) { setAlert(error.message, true); }
    });
    qs("[data-reset-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try { await resetMaritime(event.currentTarget, event.submitter); } catch (error) { setAlert(error.message, true); }
    });

    document.addEventListener("click", async (event) => {
      const userButton = event.target.closest("[data-user-id]");
      const tabButton = event.target.closest("[data-tab]");
      const decisionButton = event.target.closest("[data-decision]");
      const addButton = event.target.closest("[data-add-row]");
      const removeButton = event.target.closest("[data-remove-row]");
      const documentSave = event.target.closest("[data-document-save]");
      const documentOpen = event.target.closest("[data-document-open]");
      try {
        if (userButton) await openUser(userButton.dataset.userId);
        if (tabButton) switchTab(tabButton.dataset.tab);
        if (decisionButton) await decide(decisionButton.dataset.decision, decisionButton);
        if (addButton) addCollectionRow(addButton.dataset.addRow);
        if (removeButton) removeCollectionRow(removeButton.dataset.removeRow, Number(removeButton.dataset.rowIndex));
        if (documentSave) await reviewDocument(documentSave.closest("[data-document-id]"), documentSave);
        if (documentOpen) await openDocument(documentOpen.closest("[data-document-id]"), documentOpen);
      } catch (error) {
        setAlert(error.message, true);
      }
    });
  }

  async function init() {
    bindEvents();
    try {
      await api("/v1/control-center/owner-session");
      await loadUsers(qs("[data-search-form]"));
    } catch (error) {
      setAlert(error.message, true);
      qs("[data-directory-status]").textContent = "Süper Admin doğrulaması gerekli.";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
