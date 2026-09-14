(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const allScreensMobileExperience = document.body && document.body.dataset.maritimeExperience === "mobile-all-screens";
  if ((allScreensMobileExperience || window.matchMedia("(max-width: 760px)").matches) && document.querySelector(".mobile-maritime")) return;
  const form = document.querySelector("[data-maritime-freight-form]");
  if (!form) return;
  const searchForm = document.querySelector(".maritime-search");
  const searchInput = document.getElementById("maritimeSearch");

  const storageKey = "allonahub.maritime.freightDraft.v1";
  const draftMaxAgeMs = 2 * 60 * 60 * 1000;
  const requestTimeoutMs = 15000;
  const maritimeBackendBuild = "super-admin-maritime-trust-20260911";
  const cargoTypes = new Set(["bulk", "general-cargo", "container", "tanker"]);
  const quantityUnits = new Set(["MT", "CBM", "TEU"]);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const fields = {
    cargoType: document.getElementById("cargoType"),
    loadPort: document.getElementById("loadPort"),
    dischargePort: document.getElementById("dischargePort"),
    cargoQuantity: document.getElementById("cargoQuantity"),
    quantityUnit: document.getElementById("quantityUnit"),
    laycanStart: document.getElementById("laycanStart")
  };
  const returnTo = form.querySelector('input[name="returnTo"]');
  const status = form.querySelector("[data-maritime-form-status]");
  const draftState = form.querySelector("[data-maritime-draft-state]");
  const clearButton = form.querySelector("[data-maritime-draft-clear]");
  const submitButton = form.querySelector("[data-maritime-submit]");
  const resultState = form.querySelector("[data-maritime-request-result]");
  const resultReference = form.querySelector("[data-maritime-request-reference]");
  let currentDraftId = "";
  let requestInFlight = false;
  let maritimeBackendReady = null;

  if (Object.values(fields).some(function (field) { return !field; }) || !returnTo || !submitButton) return;

  function compact(value, maxLength) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength || 80);
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function latestLaycanIso() {
    return new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  function applyLaycanBounds() {
    fields.laycanStart.min = todayIso();
    fields.laycanStart.max = latestLaycanIso();
  }

  function createClientRequestId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    if (!window.crypto?.getRandomValues) return "";
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, function (value) { return value.toString(16).padStart(2, "0"); }).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function normalizePort(value) {
    return compact(value, 80).toLocaleLowerCase("tr-TR");
  }

  function setStatus(message, tone) {
    if (!status) return;
    status.textContent = message || "";
    status.dataset.tone = tone || "neutral";
  }

  function setSubmitting(submitting) {
    requestInFlight = submitting;
    submitButton.disabled = submitting;
    submitButton.setAttribute("aria-busy", String(submitting));
    form.setAttribute("aria-busy", String(submitting));
    if (clearButton) clearButton.disabled = submitting;
    Object.values(fields).forEach(function (field) {
      field.disabled = submitting;
    });
  }

  function buildDraft() {
    if (!uuidPattern.test(currentDraftId)) currentDraftId = createClientRequestId();
    return {
      version: 1,
      client_request_id: currentDraftId,
      module_key: "maritime",
      status: "draft",
      cargo_type: compact(fields.cargoType.value, 32),
      load_port: compact(fields.loadPort.value, 80),
      discharge_port: compact(fields.dischargePort.value, 80),
      quantity: Number(fields.cargoQuantity.value),
      quantity_unit: compact(fields.quantityUnit.value, 8),
      laycan_start: compact(fields.laycanStart.value, 10),
      updated_at: new Date().toISOString()
    };
  }

  function validDraft(draft) {
    if (!draft || draft.version !== 1 || draft.module_key !== "maritime" || draft.status !== "draft") return false;
    if (!uuidPattern.test(String(draft.client_request_id || ""))) return false;
    if (!cargoTypes.has(draft.cargo_type) || !quantityUnits.has(draft.quantity_unit)) return false;
    if (!Number.isFinite(draft.quantity) || draft.quantity < 1 || draft.quantity > 1000000) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(draft.laycan_start || ""))) return false;
    if (!compact(draft.load_port, 80) || !compact(draft.discharge_port, 80)) return false;
    const updatedAt = Date.parse(draft.updated_at);
    const age = Date.now() - updatedAt;
    return Number.isFinite(updatedAt) && age >= -5 * 60 * 1000 && age <= draftMaxAgeMs;
  }

  function saveDraft(draft) {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeStoredDraft() {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch (error) {}
  }

  function readDraft() {
    try {
      const draft = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
      if (validDraft(draft)) return draft;
      removeStoredDraft();
    } catch (error) {
      removeStoredDraft();
    }
    return null;
  }

  function showDraftState(show) {
    if (draftState) draftState.hidden = !show;
  }

  function showResult(reference) {
    if (!resultState) return;
    resultState.hidden = false;
    if (resultReference) resultReference.textContent = reference ? `Talep no: ${reference}` : "Talep kaydi olusturuldu.";
  }

  function hideResult() {
    if (resultState) resultState.hidden = true;
    if (resultReference) resultReference.textContent = "";
  }

  function restoreDraft() {
    const draft = readDraft();
    if (!draft) return;
    currentDraftId = draft.client_request_id;
    fields.cargoType.value = draft.cargo_type;
    fields.loadPort.value = draft.load_port;
    fields.dischargePort.value = draft.discharge_port;
    fields.cargoQuantity.value = String(draft.quantity);
    fields.quantityUnit.value = draft.quantity_unit;
    fields.laycanStart.value = draft.laycan_start;
    showDraftState(true);
    setStatus("Bu sekmede kaydedilen navlun taslagi geri yuklendi.", "success");
  }

  function clearDraft() {
    removeStoredDraft();
    currentDraftId = "";
    form.reset();
    applyLaycanBounds();
    showDraftState(false);
    hideResult();
    setStatus("Navlun taslagi silindi.", "neutral");
    fields.cargoType.focus();
  }

  function validateRoute() {
    applyLaycanBounds();
    fields.dischargePort.setCustomValidity("");
    fields.laycanStart.setCustomValidity("");

    if (normalizePort(fields.loadPort.value) && normalizePort(fields.loadPort.value) === normalizePort(fields.dischargePort.value)) {
      fields.dischargePort.setCustomValidity("Yukleme ve tahliye limanlari farkli olmalidir.");
    }
    if (fields.laycanStart.value && fields.laycanStart.value < todayIso()) {
      fields.laycanStart.setCustomValidity("Yukleme tarihi bugunden once olamaz.");
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus("Devam etmek icin zorunlu alanlari kontrol et.", "error");
      return false;
    }
    return true;
  }

  function loginReturnTo() {
    const params = new URLSearchParams({
      intent: "navlun-talebi-olustur",
      module: "maritime"
    });
    return `../ecosystem/allonadenizcilik.html?${params.toString()}`;
  }

  function apiBaseUrl() {
    const configured = String(App.config && App.config.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  async function backendSupportsMaritime() {
    if (maritimeBackendReady !== null) return maritimeBackendReady;
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname) && !(App.config && App.config.apiBaseUrl)) {
      maritimeBackendReady = false;
      return maritimeBackendReady;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 2500);
    try {
      const response = await fetch(`${apiBaseUrl()}/health`, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) {
        maritimeBackendReady = false;
        return maritimeBackendReady;
      }
      const payload = await response.json().catch(function () { return {}; });
      maritimeBackendReady = payload && payload.build === maritimeBackendBuild;
      return maritimeBackendReady;
    } catch (error) {
      maritimeBackendReady = false;
      return maritimeBackendReady;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function maritimeSearchTarget(value) {
    const queryText = compact(value, 120);
    const normalized = queryText.toLocaleLowerCase("tr-TR");
    if (/\bcv\b|özgeçmiş|ozgecmis|gemiadam|gemi adam|stcw|sertifika/.test(normalized)) {
      return "../career/maritime-cv.html";
    }
    if (/navlun|freight|yük|yuk|tonaj|cargo/.test(normalized)) {
      return "#freightTitle";
    }
    if (/destek|yardım|yardim|sorun|iletişim|iletisim/.test(normalized)) {
      return "../company/destek.html?topic=maritime";
    }
    const params = new URLSearchParams({
      module: "maritime",
      q: `denizcilik maritime ${queryText}`
    });
    return `module-detail.html?${params.toString()}`;
  }

  function handleMaritimeSearch(event) {
    event.preventDefault();
    const target = maritimeSearchTarget(searchInput?.value || "");
    if (target === "#freightTitle") {
      window.location.hash = "freightTitle";
      document.getElementById("freightTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
      fields.cargoType.focus({ preventScroll: true });
      return;
    }
    window.location.href = target;
  }

  async function getSession() {
    if (!App.auth || !App.auth.getSession) return null;
    return App.auth.getSession();
  }

  function redirectToLogin() {
    returnTo.value = loginReturnTo();
    setStatus("Taslak kaydedildi. Guvenli giris ekranina yonlendiriliyorsun.", "success");
    form.submit();
  }

  async function createFreightRequest(draft, session) {
    if (!(await backendSupportsMaritime())) {
      const unavailableError = new Error("Navlun servisi henuz canli API build'inde aktif degil.");
      unavailableError.status = 503;
      throw unavailableError;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, requestTimeoutMs);
    try {
      const response = await fetch(`${apiBaseUrl()}/v1/maritime/freight-requests`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_request_id: draft.client_request_id,
          cargo_type: draft.cargo_type,
          load_port: draft.load_port,
          discharge_port: draft.discharge_port,
          quantity: draft.quantity,
          quantity_unit: draft.quantity_unit,
          laycan_start: draft.laycan_start
        }),
        signal: controller.signal
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.ok === false) {
        const error = new Error("Navlun talebi kaydedilemedi.");
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      if (error && error.name === "AbortError") {
        const timeoutError = new Error("Navlun istegi zaman asimina ugradi.");
        timeoutError.requestKind = "timeout";
        throw timeoutError;
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function requestErrorMessage(error, draftSaved) {
    const continuity = draftSaved
      ? "Taslagin bu sekmede korunuyor."
      : "Bilgilerin formda duruyor; bu sayfayi kapatmadan yeniden dene.";
    if (error && error.status === 400) return "Talep alanlari sunucu dogrulamasindan gecmedi. Bilgileri kontrol et.";
    if (error && error.status === 429) return "Cok fazla talep denemesi yapildi. Biraz bekleyip yeniden dene.";
    if (error && error.requestKind === "offline") return `Internet baglantisi gorunmuyor. ${continuity}`;
    if (error && error.requestKind === "timeout") return `Sunucu zamaninda yanit vermedi. ${continuity}`;
    if (error && error.status === 503) return `Navlun servisi gecici olarak bakimda. ${continuity}`;
    return `Talep su anda kaydedilemedi. ${continuity}`;
  }

  function publicListingCard(item) {
    const link = document.createElement("a");
    link.className = "maritime-listing";
    if (item.listing_type === "crew_position") {
      const query = new URLSearchParams({ source: "allonadenizcilik", position: item.title });
      link.href = `../career/cv-form.html?${query.toString()}`;
    } else {
      const query = new URLSearchParams({ module: "maritime", role: "shipowner", q: `denizcilik maritime ${item.title}` });
      link.href = `module-detail.html?${query.toString()}`;
    }

    const image = document.createElement("span");
    image.className = "maritime-listing__image";
    image.setAttribute("aria-hidden", "true");
    const title = document.createElement("b");
    title.textContent = item.title;
    const summary = document.createElement("p");
    summary.textContent = item.summary;
    const meta = document.createElement("small");
    meta.textContent = [item.detail_label, item.location_label].filter(Boolean).join(" - ") || (item.listing_type === "crew_position" ? "CV ile basvur" : "Ilani incele");
    link.append(image, title, summary, meta);
    return link;
  }

  function normalizePublicListing(item) {
    if (!item || item.module_key !== "maritime" || item.status !== "active") return null;
    if (!["crew_position", "vessel"].includes(item.listing_type)) return null;
    const title = compact(item.title, 140);
    const summary = compact(item.summary, 360);
    if (!title || !summary) return null;
    const publishedAt = Date.parse(item.published_at);
    const expiresAt = item.expires_at ? Date.parse(item.expires_at) : null;
    if (!Number.isFinite(publishedAt) || publishedAt > Date.now()) return null;
    if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) return null;
    return {
      ...item,
      title: title,
      summary: summary,
      location_label: compact(item.location_label, 120),
      detail_label: compact(item.detail_label, 120)
    };
  }

  function renderPublicListings(items, type) {
    const target = document.querySelector(`[data-maritime-listings="${type}"]`);
    if (!target) return;
    const rows = items.filter(function (item) { return item.listing_type === type; }).slice(0, 8);
    if (!rows.length) return;

    target.replaceChildren(...rows.map(publicListingCard));
    target.dataset.live = "true";
    const title = document.querySelector(`[data-maritime-listing-title="${type}"]`);
    const note = document.querySelector(`[data-maritime-listing-note="${type}"]`);
    if (title) title.textContent = type === "crew_position" ? "Aktif crew pozisyonlari" : "Aktif gemi ilanlari";
    if (note) note.textContent = "Dogrulanmis, aktif ve yayin suresi devam eden denizcilik kayitlari gosteriliyor.";
  }

  async function loadPublicListings() {
    if (!(await backendSupportsMaritime())) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 4500);
    try {
      const query = new URLSearchParams({ limit: "24" });
      const response = await fetch(`${apiBaseUrl()}/v1/public/maritime/listings?${query.toString()}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload || payload.ok !== true || payload.module_key !== "maritime" || !Array.isArray(payload.listings)) return;
      const listings = payload.listings.map(normalizePublicListing).filter(Boolean);
      renderPublicListings(listings, "crew_position");
      renderPublicListings(listings, "vessel");
    } catch (error) {
      // Static role and vessel profiles remain visible while live data is unavailable.
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function syncAuthState() {
    const session = await getSession();
    submitButton.textContent = session ? "Navlun Talebini Gonder" : "Taslagi Kaydet ve Giris Yap";
    if (session && readDraft()) {
      setStatus("Giris dogrulandi. Bilgileri kontrol edip talebi gonderebilirsin.", "success");
    }
  }

  applyLaycanBounds();
  restoreDraft();
  syncAuthState();
  loadPublicListings();

  [fields.loadPort, fields.dischargePort].forEach(function (field) {
    field.addEventListener("input", function () {
      fields.dischargePort.setCustomValidity("");
      hideResult();
    });
  });
  fields.laycanStart.addEventListener("input", function () {
    fields.laycanStart.setCustomValidity("");
    hideResult();
  });

  if (clearButton) clearButton.addEventListener("click", clearDraft);
  if (searchForm && searchInput) searchForm.addEventListener("submit", handleMaritimeSearch);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (requestInFlight) return;
    if (!validateRoute()) return;

    const draft = buildDraft();
    if (!uuidPattern.test(draft.client_request_id)) {
      setStatus("Guvenli talep kimligi olusturulamadi. Tarayiciyi guncelleyip yeniden dene.", "error");
      return;
    }
    const draftSaved = saveDraft(draft);
    showDraftState(draftSaved);
    hideResult();

    setSubmitting(true);
    try {
      const session = await getSession();
      if (!session || !session.access_token) {
        if (!draftSaved) {
          setStatus("Giris sonrasinda bilgileri geri yuklemek icin sekme depolamasina izin verip yeniden dene.", "error");
          return;
        }
        redirectToLogin();
        return;
      }
      if (window.navigator.onLine === false) {
        const offlineError = new Error("Internet baglantisi yok.");
        offlineError.requestKind = "offline";
        throw offlineError;
      }

      setStatus("Navlun talebi guvenli sunucu katmaninda dogrulaniyor.", "neutral");
      const payload = await createFreightRequest(draft, session);
      removeStoredDraft();
      currentDraftId = "";
      form.reset();
      applyLaycanBounds();
      showDraftState(false);
      showResult(payload.request && payload.request.reference_no);
      setStatus(payload.duplicate ? "Bu talep daha once kaydedilmisti; mevcut kayit gosteriliyor." : "Navlun talebin alindi ve inceleme sirasina eklendi.", "success");
    } catch (error) {
      if (error && error.status === 401) {
        redirectToLogin();
        return;
      }
      setStatus(requestErrorMessage(error, draftSaved), "error");
    } finally {
      setSubmitting(false);
    }
  });
})();
