(function () {
  "use strict";

  const App = window.Allona = window.Allona || {};
  const center = document.querySelector("[data-maritime-notification-center]");
  const list = document.querySelector("[data-maritime-notification-list]");
  const count = document.querySelector("[data-maritime-notification-count]");
  const feedback = document.querySelector("[data-maritime-notification-feedback]");
  const empty = document.querySelector("[data-maritime-notification-empty]");
  const login = document.querySelector("[data-maritime-notification-login]");
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!center || !list || !count || !feedback || !empty || !login) return;

  const eventLabels = Object.freeze({
    submitted: "Navlun talebiniz alındı",
    review_started: "Navlun talebiniz incelemeye alındı",
    matching_started: "Broker eşleştirmesi başladı",
    match_declined: "Bir broker eşleşmeyi reddetti",
    match_expired: "Broker eşleşmesinin süresi doldu",
    quote_added: "Yeni navlun teklifi geldi",
    offer_withdrawn: "Broker teklifini geri çekti",
    offer_expired: "Broker teklifinin süresi doldu",
    accepted: "Navlun teklifi kabul edildi",
    cancelled: "Navlun talebi iptal edildi",
    closed: "Navlun talebi kapandı"
  });

  const eventTones = Object.freeze({
    quote_added: "action",
    accepted: "success",
    match_declined: "warning",
    match_expired: "warning",
    offer_withdrawn: "warning",
    offer_expired: "warning",
    cancelled: "muted",
    closed: "muted"
  });

  const statusLabels = Object.freeze({
    submitted: "Alındı",
    in_review: "İncelemede",
    matching: "Eşleşiyor",
    quoted: "Teklif var",
    accepted: "Kabul edildi",
    cancelled: "İptal",
    closed: "Kapandı"
  });

  function setFeedback(message, tone) {
    feedback.textContent = message || "";
    feedback.dataset.tone = tone || "neutral";
    feedback.hidden = !message;
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

  function notificationRow(event, request) {
    const item = document.createElement("li");
    item.className = "maritime-notification";
    item.dataset.tone = eventTones[event.event_type] || "neutral";

    const marker = document.createElement("span");
    marker.className = "maritime-notification__marker";
    marker.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = eventLabels[event.event_type];
    const meta = document.createElement("span");
    meta.textContent = `${String(request.reference_no || "Navlun Talebi")} · ${statusLabels[request.status] || "Güncellendi"}`;
    body.append(title, meta);

    const time = document.createElement("time");
    time.dateTime = String(event.created_at || "");
    time.textContent = formatDateTime(event.created_at);

    const action = document.createElement("a");
    const requestId = String(request.id || "");
    action.href = UUID_PATTERN.test(requestId)
      ? `maritime-requests.html#request-${requestId}`
      : "maritime-requests.html";
    action.textContent = "Talebi Gör";
    action.setAttribute("aria-label", `${String(request.reference_no || "Navlun talebi")} kaydını gör`);

    item.append(marker, body, time, action);
    return item;
  }

  function showLogin() {
    center.hidden = true;
    login.hidden = false;
  }

  async function load() {
    login.hidden = true;
    center.hidden = false;
    empty.hidden = true;
    list.replaceChildren();
    count.textContent = "";
    setFeedback("Denizcilik bildirimleri yükleniyor.", "neutral");

    const session = App.auth?.getSession ? await App.auth.getSession() : null;
    if (!session?.access_token || !App.supabase) {
      showLogin();
      return;
    }

    let requestResult;
    try {
      requestResult = await App.supabase
        .from("maritime_freight_requests")
        .select("id,reference_no,module_key,status,created_at")
        .eq("module_key", "maritime")
        .order("created_at", { ascending: false })
        .limit(50);
    } catch (error) {
      setFeedback("Denizcilik bildirimleri şu anda alınamıyor.", "error");
      return;
    }

    if (requestResult.error) {
      setFeedback("Denizcilik bildirimleri şu anda alınamıyor.", "error");
      return;
    }

    const requests = (Array.isArray(requestResult.data) ? requestResult.data : []).filter((request) => (
      request?.module_key === "maritime"
      && Object.prototype.hasOwnProperty.call(statusLabels, request.status)
    ));
    const requestsById = new Map(requests.map((request) => [String(request.id || ""), request]));
    const requestIds = [...requestsById.keys()].filter(Boolean);
    if (!requestIds.length) {
      count.textContent = "0 kayıt";
      empty.hidden = false;
      setFeedback("", "neutral");
      return;
    }

    let eventResult;
    try {
      eventResult = await App.supabase
        .from("maritime_freight_request_events")
        .select("id,freight_request_id,event_type,created_at")
        .in("freight_request_id", requestIds)
        .order("created_at", { ascending: false })
        .limit(50);
    } catch (error) {
      setFeedback("Denizcilik olay geçmişi şu anda alınamıyor.", "error");
      return;
    }

    if (eventResult.error) {
      setFeedback("Denizcilik olay geçmişi şu anda alınamıyor.", "error");
      return;
    }

    const events = (Array.isArray(eventResult.data) ? eventResult.data : []).filter((event) => (
      event
      && Object.prototype.hasOwnProperty.call(eventLabels, event.event_type)
      && requestsById.has(String(event.freight_request_id || ""))
    ));
    list.replaceChildren(...events.map((event) => (
      notificationRow(event, requestsById.get(String(event.freight_request_id)))
    )));
    count.textContent = `${events.length} kayıt`;
    empty.hidden = events.length > 0;
    setFeedback("", "neutral");
  }

  window.AllonaMaritimeNotifications = { load };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load, { once: true });
  } else {
    load();
  }
})();
