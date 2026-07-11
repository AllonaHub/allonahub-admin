(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const list = document.querySelector("[data-maritime-request-list]");
  const feedback = document.querySelector("[data-maritime-requests-feedback]");
  const empty = document.querySelector("[data-maritime-request-empty]");
  const login = document.querySelector("[data-maritime-request-login]");
  const loginLink = document.querySelector("[data-maritime-request-login-link]");
  const filter = document.querySelector("[data-maritime-request-filter]");
  const retryButton = document.querySelector("[data-maritime-requests-retry]");
  let requests = [];
  let offersByRequest = new Map();
  let eventsByRequest = new Map();
  let currentSession = null;
  let focusedRequestHash = "";
  const activeRequestMutations = new Set();
  const mutationTimeoutMs = 15000;
  const readTimeoutMs = 8000;
  let activeLoad = null;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!list || !feedback || !empty || !login || !filter || !retryButton) return;

  feedback.tabIndex = -1;

  const statusLabels = {
    submitted: "Alindi",
    in_review: "Incelemede",
    matching: "Eslesme",
    quoted: "Teklif Var",
    accepted: "Kabul Edildi",
    cancelled: "Iptal",
    closed: "Kapandi"
  };

  const cargoLabels = {
    bulk: "Bulk",
    "general-cargo": "General Cargo",
    container: "Container",
    tanker: "Tanker"
  };

  const offerStatusLabels = {
    submitted: "Sunuldu",
    accepted: "Kabul Edildi",
    rejected: "Sonuclanmadi",
    expired: "Suresi Doldu"
  };

  const pricingLabels = {
    lumpsum: "Lumpsum",
    per_mt: "MT basina",
    per_cbm: "CBM basina",
    per_teu: "TEU basina"
  };

  const eventLabels = {
    submitted: "Talep alindi",
    review_started: "Inceleme basladi",
    matching_started: "Broker eslesmesi basladi",
    match_declined: "Broker eslesmesi reddedildi",
    match_expired: "Broker eslesmesinin suresi doldu",
    quote_added: "Yeni teklif yayinlandi",
    offer_withdrawn: "Broker teklifi geri cekildi",
    offer_expired: "Broker teklifinin suresi doldu",
    accepted: "Teklif kabul edildi",
    cancelled: "Talep iptal edildi",
    closed: "Talep kapandi"
  };

  function setFeedback(message, tone) {
    feedback.textContent = message || "";
    feedback.dataset.tone = tone || "neutral";
    feedback.hidden = !message;
    feedback.setAttribute("role", tone === "error" ? "alert" : "status");
  }

  function setRetryAvailable(show) {
    retryButton.hidden = !show;
  }

  async function withReadTimeout(operation) {
    let timeout = 0;
    try {
      return await Promise.race([
        Promise.resolve(operation),
        new Promise(function (_, reject) {
          timeout = window.setTimeout(function () {
            const error = new Error("Maritime read timed out.");
            error.requestKind = "timeout";
            reject(error);
          }, readTimeoutMs);
        })
      ]);
    } finally {
      if (timeout) window.clearTimeout(timeout);
    }
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function formatDateTime(value) {
    const date = new Date(String(value || ""));
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatQuantity(value, unit) {
    const quantity = Number(value);
    if (!Number.isFinite(quantity)) return "-";
    return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(quantity)} ${String(unit || "")}`.trim();
  }

  function formatMoney(value, currency) {
    const amount = Number(value);
    const code = String(currency || "");
    if (!Number.isFinite(amount) || !["USD", "EUR", "TRY", "GBP"].includes(code)) return "-";
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function effectiveOfferStatus(offer) {
    if (offer.status !== "submitted") return offer.status;
    const validUntil = Date.parse(String(offer.valid_until || ""));
    return Number.isFinite(validUntil) && validUntil <= Date.now() ? "expired" : "submitted";
  }

  function addField(parent, label, value) {
    const item = document.createElement("div");
    const small = document.createElement("small");
    const strong = document.createElement("strong");
    small.textContent = label;
    strong.textContent = value || "-";
    item.append(small, strong);
    parent.append(item);
  }

  function offerRow(offer, requestItem) {
    const row = document.createElement("div");
    row.className = "maritime-request__offer";
    const displayStatus = effectiveOfferStatus(offer);

    const head = document.createElement("div");
    head.className = "maritime-request__offer-head";
    const broker = document.createElement("strong");
    broker.textContent = String(offer.company_display_name || offer.broker_display_name || "Dogrulanmis Broker");
    const status = document.createElement("span");
    status.className = "maritime-request__offer-status";
    status.dataset.status = String(displayStatus || "submitted");
    status.textContent = offerStatusLabels[displayStatus] || "Teklif";
    head.append(broker, status);

    const details = document.createElement("div");
    details.className = "maritime-request__offer-details";
    addField(details, "Tutar", formatMoney(offer.amount, offer.currency));
    addField(details, "Fiyatlama", pricingLabels[offer.pricing_basis] || "-");
    addField(details, "Transit", offer.transit_days ? `${Number(offer.transit_days)} gun` : "-");
    addField(details, "Gecerlilik", formatDate(offer.valid_until));

    row.append(head, details);
    if (offer.terms_summary) {
      const terms = document.createElement("p");
      terms.className = "maritime-request__offer-terms";
      terms.textContent = String(offer.terms_summary);
      row.append(terms);
    }
    if (
      displayStatus === "submitted"
      && ["matching", "quoted"].includes(requestItem.status)
      && UUID_PATTERN.test(String(requestItem.id || ""))
      && UUID_PATTERN.test(String(offer.id || ""))
    ) {
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "maritime-request__offer-action";
      accept.dataset.maritimeOfferAccept = String(offer.id);
      accept.dataset.maritimeRequestId = String(requestItem.id);
      accept.dataset.defaultAriaLabel = `${broker.textContent} teklifini sec`;
      accept.setAttribute("aria-pressed", "false");
      accept.setAttribute("aria-label", accept.dataset.defaultAriaLabel);
      accept.textContent = "Teklifi Sec";
      row.append(accept);
    }
    return row;
  }

  function offerSection(item) {
    const offers = offersByRequest.get(String(item.id || "")) || [];
    if (!offers.length && !["matching", "quoted", "accepted", "closed"].includes(item.status)) return null;

    const section = document.createElement("section");
    section.className = "maritime-request__offers";
    const heading = document.createElement("div");
    heading.className = "maritime-request__offers-head";
    const title = document.createElement("h3");
    title.textContent = "Broker teklifleri";
    const count = document.createElement("span");
    count.textContent = offers.length ? `${offers.length} teklif` : "Eslesme suruyor";
    heading.append(title, count);
    section.append(heading);

    if (offers.length) {
      const offerList = document.createElement("div");
      offerList.className = "maritime-request__offer-list";
      offerList.append(...offers.map(function (offer) { return offerRow(offer, item); }));
      section.append(offerList);
    } else {
      const note = document.createElement("p");
      note.className = "maritime-request__offer-empty";
      note.textContent = "Henuz yayinlanmis broker teklifi yok.";
      section.append(note);
    }
    return section;
  }

  function eventTimeline(item) {
    const events = eventsByRequest.get(String(item.id || "")) || [];
    if (!events.length) return null;

    const section = document.createElement("section");
    section.className = "maritime-request__timeline";
    const title = document.createElement("h3");
    title.textContent = "Durum gecmisi";
    const list = document.createElement("ol");
    events.forEach(function (event) {
      const row = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = eventLabels[event.event_type] || "Durum guncellendi";
      const time = document.createElement("time");
      time.dateTime = String(event.created_at || "");
      time.textContent = formatDateTime(event.created_at);
      row.append(label, time);
      list.append(row);
    });
    section.append(title, list);
    return section;
  }

  function requestCard(item) {
    const article = document.createElement("article");
    article.className = "maritime-request";
    const requestId = String(item.id || "");
    if (UUID_PATTERN.test(requestId)) {
      article.id = `maritime-request-${requestId}`;
      article.dataset.maritimeRequestId = requestId;
    }

    const head = document.createElement("div");
    head.className = "maritime-request__head";
    const reference = document.createElement("strong");
    reference.textContent = String(item.reference_no || "Navlun Talebi");
    const status = document.createElement("span");
    status.className = "maritime-request__status";
    status.dataset.status = String(item.status || "submitted");
    status.textContent = statusLabels[item.status] || "Isleniyor";
    head.append(reference, status);

    const route = document.createElement("p");
    route.className = "maritime-request__route";
    route.textContent = `${String(item.load_port || "-")} -> ${String(item.discharge_port || "-")}`;

    const details = document.createElement("div");
    details.className = "maritime-request__details";
    addField(details, "Yuk", cargoLabels[item.cargo_type] || String(item.cargo_type || "-"));
    addField(details, "Miktar", formatQuantity(item.quantity, item.quantity_unit));
    addField(details, "Laycan", formatDate(item.laycan_start));
    addField(details, "Olusturma", formatDate(item.created_at));

    article.append(head, route, details);
    const offers = offerSection(item);
    if (offers) article.append(offers);
    const timeline = eventTimeline(item);
    if (timeline) article.append(timeline);
    if (["submitted", "in_review"].includes(item.status) && UUID_PATTERN.test(String(item.id || ""))) {
      const actions = document.createElement("div");
      actions.className = "maritime-request__actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.dataset.maritimeRequestCancel = String(item.id);
      cancel.dataset.maritimeRequestId = String(item.id);
      cancel.dataset.defaultAriaLabel = `${reference.textContent} talebini iptal et`;
      cancel.setAttribute("aria-pressed", "false");
      cancel.setAttribute("aria-label", cancel.dataset.defaultAriaLabel);
      cancel.textContent = "Talebi Iptal Et";
      actions.append(cancel);
      article.append(actions);
    }
    return article;
  }

  function apiBaseUrl() {
    const configured = String(App.config && App.config.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  function resetActionButton(button, label) {
    if (!button || !button.isConnected) return;
    button.disabled = false;
    button.setAttribute("aria-busy", "false");
    button.setAttribute("aria-pressed", "false");
    button.dataset.confirmed = "false";
    button.textContent = label;
    button.setAttribute("aria-label", button.dataset.defaultAriaLabel || (label === "Teklifi Sec" ? "Teklifi sec" : "Talebi iptal et"));
  }

  function requestActionButtons(requestId) {
    const card = document.getElementById(`maritime-request-${requestId}`);
    return card ? Array.from(card.querySelectorAll("[data-maritime-request-cancel], [data-maritime-offer-accept]")) : [];
  }

  function lockRequestActions(requestId, activeButton) {
    requestActionButtons(requestId).forEach(function (button) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    });
    if (activeButton) activeButton.setAttribute("aria-busy", "true");
  }

  function resetRequestActions(requestId) {
    requestActionButtons(requestId).forEach(function (button) {
      button.setAttribute("aria-disabled", "false");
      resetActionButton(button, button.hasAttribute("data-maritime-offer-accept") ? "Teklifi Sec" : "Talebi Iptal Et");
    });
  }

  function focusRequestCard(requestId) {
    if (!UUID_PATTERN.test(String(requestId || ""))) return;
    const card = document.getElementById(`maritime-request-${requestId}`);
    if (!card) return;
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function cancelErrorMessage(error) {
    if (error && error.status === 404) return "Navlun talebi bulunamadi. Listeyi yenileyip tekrar kontrol et.";
    if (error && error.status === 409) return "Talep eslesme veya teklif asamasina gectigi icin panelden iptal edilemiyor.";
    if (error && error.status === 429) return "Cok fazla iptal denemesi yapildi. Biraz bekleyip yeniden dene.";
    if (error && error.status === 503) return "Navlun iptal servisi gecici olarak kullanilamiyor. Biraz sonra yeniden dene.";
    if (error && error.requestKind === "offline") return "Internet baglantisi gorunmuyor. Talep degistirilmedi.";
    if (error && error.requestKind === "timeout") return "Sunucu zamaninda yanit vermedi. Talep durumunu kontrol edip yeniden deneyebilirsin.";
    return "Navlun talebi su anda iptal edilemedi. Biraz sonra yeniden dene.";
  }

  async function cancelRequest(requestId, button) {
    if (!currentSession || !currentSession.access_token) {
      showLogin();
      return;
    }
    if (activeRequestMutations.has(requestId)) return;

    activeRequestMutations.add(requestId);
    lockRequestActions(requestId, button);
    setFeedback("Navlun talebi iptal ediliyor.", "neutral");
    const controller = new AbortController();
    let timeout = 0;
    try {
      if (window.navigator.onLine === false) {
        const offlineError = new Error("Internet baglantisi yok.");
        offlineError.requestKind = "offline";
        throw offlineError;
      }
      timeout = window.setTimeout(function () { controller.abort(); }, mutationTimeoutMs);
      const response = await fetch(`${apiBaseUrl()}/v1/maritime/freight-requests/${encodeURIComponent(requestId)}/cancel`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
          "Content-Type": "application/json"
        },
        body: "{}",
        signal: controller.signal
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.ok === false) {
        const error = new Error("Navlun talebi iptal edilemedi.");
        error.status = response.status;
        throw error;
      }
      if (String(payload.request && payload.request.id || "") !== requestId || payload.request.status !== "cancelled") {
        throw new Error("Navlun iptal yaniti dogrulanamadi.");
      }

      requests = requests.map(function (item) {
        return item.id === requestId ? { ...item, status: "cancelled", updated_at: payload.request && payload.request.updated_at || item.updated_at } : item;
      });
      appendLocalEvent(requestId, "cancelled");
      render();
      setFeedback(payload.duplicate ? "Navlun talebi daha once iptal edilmisti." : "Navlun talebi iptal edildi.", "success");
      focusRequestCard(requestId);
    } catch (error) {
      if (error && error.status === 401) {
        currentSession = null;
        showLogin();
        setFeedback("Oturumun sona erdi. Talebi iptal etmek icin yeniden giris yap.", "error");
        return;
      }
      if (error && error.name === "AbortError") {
        const timeoutError = new Error("Navlun iptal istegi zaman asimina ugradi.");
        timeoutError.requestKind = "timeout";
        error = timeoutError;
      }
      setFeedback(cancelErrorMessage(error), "error");
      resetRequestActions(requestId);
      if (button && button.isConnected) {
        button.focus({ preventScroll: false });
      } else {
        feedback.focus({ preventScroll: false });
      }
    } finally {
      if (timeout) window.clearTimeout(timeout);
      activeRequestMutations.delete(requestId);
    }
  }

  function acceptErrorMessage(error) {
    if (error && error.status === 404) return "Navlun talebi veya teklifi bulunamadi. Listeyi yenileyip tekrar kontrol et.";
    if (error && error.status === 409) return error.publicMessage || "Talep veya teklif durumu degisti; listeyi yenileyin.";
    if (error && error.status === 429) return "Cok fazla teklif kabul denemesi yapildi. Biraz bekleyip yeniden dene.";
    if (error && error.status === 503) return "Teklif kabul servisi gecici olarak kullanilamiyor. Biraz sonra yeniden dene.";
    if (error && error.requestKind === "offline") return "Internet baglantisi gorunmuyor. Teklif kabul edilmedi.";
    if (error && error.requestKind === "timeout") return "Sunucu zamaninda yanit vermedi. Talep durumunu kontrol edip yeniden deneyebilirsin.";
    return "Navlun teklifi su anda kabul edilemedi. Biraz sonra yeniden dene.";
  }

  async function acceptOffer(requestId, offerId, button) {
    if (!currentSession || !currentSession.access_token) {
      showLogin();
      return;
    }
    if (activeRequestMutations.has(requestId)) return;

    activeRequestMutations.add(requestId);
    lockRequestActions(requestId, button);
    setFeedback("Navlun teklifi kabul ediliyor.", "neutral");
    const controller = new AbortController();
    let timeout = 0;
    try {
      if (window.navigator.onLine === false) {
        const offlineError = new Error("Internet baglantisi yok.");
        offlineError.requestKind = "offline";
        throw offlineError;
      }
      timeout = window.setTimeout(function () { controller.abort(); }, mutationTimeoutMs);
      const response = await fetch(`${apiBaseUrl()}/v1/maritime/freight-requests/${encodeURIComponent(requestId)}/offers/${encodeURIComponent(offerId)}/accept`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
          "Content-Type": "application/json"
        },
        body: "{}",
        signal: controller.signal
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.ok === false) {
        const error = new Error("Navlun teklifi kabul edilemedi.");
        error.status = response.status;
        error.publicMessage = typeof payload.message === "string" ? payload.message.slice(0, 240) : "";
        throw error;
      }
      if (
        String(payload.request && payload.request.id || "") !== requestId
        || payload.request.status !== "accepted"
        || String(payload.offer && payload.offer.id || "") !== offerId
        || payload.offer.status !== "accepted"
        || !Number.isFinite(Date.parse(String(payload.offer.accepted_at || "")))
      ) {
        throw new Error("Teklif kabul yaniti dogrulanamadi.");
      }

      requests = requests.map(function (item) {
        return item.id === requestId
          ? { ...item, status: "accepted", updated_at: payload.request && payload.request.updated_at || item.updated_at }
          : item;
      });
      const offers = offersByRequest.get(requestId) || [];
      offersByRequest.set(requestId, offers.map(function (offer) {
        if (offer.id === offerId) {
          return { ...offer, status: "accepted", accepted_at: payload.offer && payload.offer.accepted_at || offer.accepted_at };
        }
        return offer.status === "submitted" ? { ...offer, status: "rejected" } : offer;
      }));
      appendLocalEvent(requestId, "accepted");
      render();
      setFeedback(payload.duplicate ? "Bu navlun teklifi daha once kabul edilmisti." : "Navlun teklifi kabul edildi.", "success");
      focusRequestCard(requestId);
    } catch (error) {
      if (error && error.status === 401) {
        currentSession = null;
        showLogin();
        setFeedback("Oturumun sona erdi. Teklifi kabul etmek icin yeniden giris yap.", "error");
        return;
      }
      if (error && error.name === "AbortError") {
        const timeoutError = new Error("Teklif kabul istegi zaman asimina ugradi.");
        timeoutError.requestKind = "timeout";
        error = timeoutError;
      }
      setFeedback(acceptErrorMessage(error), "error");
      resetRequestActions(requestId);
      if (button && button.isConnected) {
        button.focus({ preventScroll: false });
      } else {
        feedback.focus({ preventScroll: false });
      }
    } finally {
      if (timeout) window.clearTimeout(timeout);
      activeRequestMutations.delete(requestId);
    }
  }

  function render() {
    const activeTargetId = document.activeElement && document.activeElement.dataset
      ? String(document.activeElement.dataset.maritimeRequestId || "")
      : "";
    let selected = String(filter.value || "all");
    const targetId = deepLinkedRequestId();
    let visible = selected === "all" ? requests : requests.filter(function (item) { return item.status === selected; });
    if (targetId
      && focusedRequestHash !== window.location.hash
      && !visible.some(function (item) { return String(item.id || "") === targetId; })) {
      const targetExists = requests.some(function (item) { return String(item.id || "") === targetId; });
      if (targetExists) {
        filter.value = "all";
        selected = "all";
        visible = requests;
      }
    }
    list.replaceChildren(...visible.map(requestCard));
    empty.hidden = visible.length > 0;
    setFeedback(visible.length ? `${visible.length} navlun talebi gosteriliyor.` : "", "neutral");
    focusDeepLinkedRequest(activeTargetId === targetId);
  }

  function deepLinkedRequestId() {
    const match = String(window.location.hash || "").match(/^#request-([0-9a-f-]+)$/i);
    return match && UUID_PATTERN.test(match[1]) ? match[1] : "";
  }

  function focusDeepLinkedRequest(restoreFocus) {
    const requestId = deepLinkedRequestId();
    if (!requestId) return;
    const card = document.getElementById(`maritime-request-${requestId}`);
    if (!card) return;
    card.classList.add("is-targeted");
    const firstFocus = focusedRequestHash !== window.location.hash;
    if (!firstFocus && !restoreFocus) return;
    focusedRequestHash = window.location.hash;
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
    if (firstFocus) card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showLogin() {
    requests = [];
    offersByRequest = new Map();
    eventsByRequest = new Map();
    list.replaceChildren();
    empty.hidden = true;
    login.hidden = false;
    setRetryAvailable(false);
    setFeedback("", "neutral");
    if (loginLink) {
      const requestId = deepLinkedRequestId();
      const returnTo = requestId ? `maritime-requests.html#request-${requestId}` : "maritime-requests.html";
      loginLink.href = `login.html?${new URLSearchParams({ returnTo }).toString()}`;
    }
  }

  function appendLocalEvent(requestId, eventType) {
    if (!Object.prototype.hasOwnProperty.call(eventLabels, eventType)) return;
    const events = eventsByRequest.get(requestId) || [];
    if (events.some(function (event) { return event.event_type === eventType; })) return;
    eventsByRequest.set(requestId, [
      ...events,
      {
        id: `local-${eventType}-${Date.now()}`,
        freight_request_id: requestId,
        event_type: eventType,
        created_at: new Date().toISOString()
      }
    ]);
  }

  async function loadOffers() {
    offersByRequest = new Map();
    const requestIds = requests.map(function (item) { return item.id; }).filter(Boolean);
    if (!requestIds.length) return true;

    let result;
    try {
      result = await withReadTimeout(App.supabase
        .from("maritime_freight_offers")
        .select("id,offer_reference,freight_request_id,module_key,status,broker_display_name,company_display_name,amount,currency,pricing_basis,transit_days,terms_summary,valid_until,submitted_at,accepted_at")
        .eq("module_key", "maritime")
        .in("freight_request_id", requestIds)
        .in("status", Object.keys(offerStatusLabels))
        .order("submitted_at", { ascending: false }));
    } catch (error) {
      return false;
    }

    if (result.error) return false;
    (Array.isArray(result.data) ? result.data : []).forEach(function (offer) {
      if (!offer || offer.module_key !== "maritime" || !Object.prototype.hasOwnProperty.call(offerStatusLabels, offer.status)) return;
      const requestId = String(offer.freight_request_id || "");
      if (!requestIds.includes(requestId)) return;
      const current = offersByRequest.get(requestId) || [];
      current.push(offer);
      offersByRequest.set(requestId, current);
    });
    return true;
  }

  async function loadEvents() {
    eventsByRequest = new Map();
    const requestIds = requests.map(function (item) { return item.id; }).filter(Boolean);
    if (!requestIds.length) return true;

    let result;
    try {
      result = await withReadTimeout(App.supabase
        .from("maritime_freight_request_events")
        .select("id,freight_request_id,event_type,created_at")
        .in("freight_request_id", requestIds)
        .order("created_at", { ascending: true }));
    } catch (error) {
      return false;
    }

    if (result.error) return false;
    (Array.isArray(result.data) ? result.data : []).forEach(function (event) {
      if (!event || !Object.prototype.hasOwnProperty.call(eventLabels, event.event_type)) return;
      const requestId = String(event.freight_request_id || "");
      if (!requestIds.includes(requestId)) return;
      const current = eventsByRequest.get(requestId) || [];
      current.push(event);
      eventsByRequest.set(requestId, current);
    });
    return true;
  }

  async function loadRequests() {
    setRetryAvailable(false);
    setFeedback("Navlun talepleri yukleniyor.", "neutral");
    login.hidden = true;
    empty.hidden = true;

    currentSession = App.auth && App.auth.getSession ? await App.auth.getSession() : null;
    if (!currentSession || !currentSession.access_token || !App.supabase) {
      showLogin();
      return;
    }

    let result;
    try {
      result = await withReadTimeout(App.supabase
        .from("maritime_freight_requests")
        .select("id,reference_no,module_key,status,cargo_type,load_port,discharge_port,quantity,quantity_unit,laycan_start,created_at,updated_at")
        .eq("module_key", "maritime")
        .order("created_at", { ascending: false })
        .limit(50));
    } catch (error) {
      requests = [];
      list.replaceChildren();
      empty.hidden = true;
      setFeedback("Navlun talepleri su anda yuklenemedi. Biraz sonra yeniden dene.", "error");
      setRetryAvailable(true);
      return;
    }

    if (result.error) {
      requests = [];
      list.replaceChildren();
      empty.hidden = true;
      setFeedback("Navlun talepleri su anda yuklenemedi. Biraz sonra yeniden dene.", "error");
      setRetryAvailable(true);
      return;
    }

    requests = Array.isArray(result.data) ? result.data.filter(function (item) {
      return item && item.module_key === "maritime" && Object.prototype.hasOwnProperty.call(statusLabels, item.status);
    }) : [];
    offersByRequest = new Map();
    eventsByRequest = new Map();
    render();
    const [offersLoaded, eventsLoaded] = await Promise.all([loadOffers(), loadEvents()]);
    render();
    if (!offersLoaded && requests.some(function (item) { return ["matching", "quoted", "accepted", "closed"].includes(item.status); })) {
      setFeedback("Navlun talepleri yuklendi; teklif detaylari su anda alinamadi.", "warning");
      setRetryAvailable(true);
    } else if (!eventsLoaded) {
      setFeedback("Navlun talepleri yuklendi; durum gecmisi su anda alinamadi.", "warning");
      setRetryAvailable(true);
    }
  }

  function load() {
    if (activeLoad) return activeLoad;
    retryButton.disabled = true;
    retryButton.setAttribute("aria-busy", "true");
    activeLoad = loadRequests().finally(function () {
      retryButton.disabled = false;
      retryButton.setAttribute("aria-busy", "false");
      activeLoad = null;
    });
    return activeLoad;
  }

  filter.addEventListener("change", render);
  retryButton.addEventListener("click", load);
  window.addEventListener("hashchange", function () {
    focusedRequestHash = "";
    render();
  });
  list.addEventListener("click", function (event) {
    const offerButton = event.target.closest("[data-maritime-offer-accept]");
    if (offerButton && list.contains(offerButton)) {
      const offerId = String(offerButton.dataset.maritimeOfferAccept || "");
      const requestId = String(offerButton.dataset.maritimeRequestId || "");
      if (!UUID_PATTERN.test(offerId) || !UUID_PATTERN.test(requestId)) return;
      if (activeRequestMutations.has(requestId)) return;
      if (offerButton.dataset.confirmed !== "true") {
        offerButton.dataset.confirmed = "true";
        offerButton.setAttribute("aria-pressed", "true");
        offerButton.setAttribute("aria-label", "Teklif secimini onayla");
        offerButton.textContent = "Secimi Onayla";
        setFeedback("Teklifi kabul etmek icin ayni dugmeye tekrar bas.", "neutral");
        window.setTimeout(function () {
          if (!offerButton.isConnected || offerButton.disabled) return;
          resetActionButton(offerButton, "Teklifi Sec");
        }, 5000);
        return;
      }
      acceptOffer(requestId, offerId, offerButton);
      return;
    }
    const button = event.target.closest("[data-maritime-request-cancel]");
    if (!button || !list.contains(button)) return;
    const requestId = String(button.dataset.maritimeRequestCancel || "");
    if (!UUID_PATTERN.test(requestId)) return;
    if (activeRequestMutations.has(requestId)) return;
    if (button.dataset.confirmed !== "true") {
      button.dataset.confirmed = "true";
      button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-label", "Talep iptalini onayla");
      button.textContent = "Iptali Onayla";
      setFeedback("Talebi iptal etmek icin ayni dugmeye tekrar bas.", "neutral");
      window.setTimeout(function () {
        if (!button.isConnected || button.disabled) return;
        resetActionButton(button, "Talebi Iptal Et");
      }, 5000);
      return;
    }
    cancelRequest(requestId, button);
  });
  window.AllonaMaritimeRequests = { load: load };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load, { once: true });
  } else {
    load();
  }
})();
