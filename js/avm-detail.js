(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const mallSlug = "allona-avm-dunyasi";
  const planKey = "allona_avm_plan_v1";
  const redemptionSessionKey = "allona_avm_redemption_session_v1";
  const savedRedemptionsKey = "allona_avm_saved_redemptions_v1";
  const params = new URLSearchParams(window.location.search);
  const itemKey = String(params.get("item") || "").trim().slice(0, 180);
  const typeLabels = {
    stores: "Mağaza",
    events: "Etkinlik",
    deals: "Kampanya",
    dining: "Yeme İçme"
  };
  const weekDays = [
    { value: 1, label: "Pazartesi", schema: "https://schema.org/Monday" },
    { value: 2, label: "Salı", schema: "https://schema.org/Tuesday" },
    { value: 3, label: "Çarşamba", schema: "https://schema.org/Wednesday" },
    { value: 4, label: "Perşembe", schema: "https://schema.org/Thursday" },
    { value: 5, label: "Cuma", schema: "https://schema.org/Friday" },
    { value: 6, label: "Cumartesi", schema: "https://schema.org/Saturday" },
    { value: 0, label: "Pazar", schema: "https://schema.org/Sunday" }
  ];
  let item = null;
  let center = null;
  let hoursProfile = null;
  let weeklyRows = [];
  let specialRows = [];
  let refreshTimer;
  let publicDetailUrl = "";

  function client() {
    try {
      return App.db?.client ? App.db.client() : null;
    } catch (error) {
      return null;
    }
  }

  function isLocalPreview() {
    return window.location.protocol === "file:" || ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || "").trim(), window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function setStatus(message, type) {
    const target = document.querySelector("[data-avm-detail-status]");
    if (!target) return;
    target.hidden = false;
    target.innerHTML = `<div class="status-box ${type === "error" ? "status-box--error" : ""}">${core.escapeHTML(message)}</div>`;
  }

  function setActionStatus(message, type) {
    const target = document.querySelector("[data-avm-detail-action-status]");
    if (!target) return;
    target.innerHTML = `<div class="status-box status-box--${type === "error" ? "error" : "success"}">${core.escapeHTML(message)}</div>`;
  }

  function setRobots(indexable) {
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = indexable ? "index,follow,max-image-preview:large" : "noindex,follow";
  }

  function setLink(selector, href, label) {
    const link = document.querySelector(selector);
    if (!link) return;
    link.hidden = !href;
    if (!href) {
      link.removeAttribute("href");
      return;
    }
    link.href = href;
    if (label) link.textContent = label;
  }

  function timeValue(value) {
    const match = String(value || "").match(/^(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : "";
  }

  function timeMinutes(value) {
    const match = timeValue(value).match(/^(\d{2}):(\d{2})$/);
    return match ? (Number(match[1]) * 60) + Number(match[2]) : NaN;
  }

  function shiftDateKey(dateKey, days) {
    const date = new Date(`${dateKey}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function dayOfWeek(dateKey) {
    return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  }

  function istanbulClock(value = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(value).map((part) => [part.type, part.value]));
    const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
    return {
      dateKey,
      minutes: (Number(parts.hour || 0) * 60) + Number(parts.minute || 0)
    };
  }

  function dateLabel(dateKey) {
    const value = new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("tr-TR", {
      timeZone: "UTC",
      weekday: "long"
    });
    return value ? `${value.charAt(0).toLocaleUpperCase("tr-TR")}${value.slice(1)}` : "";
  }

  function specialForDate(dateKey) {
    return specialRows.find((row) => row.service_date === dateKey) || null;
  }

  function hoursForDate(dateKey) {
    const special = specialForDate(dateKey);
    if (special) return { ...special, is_special: true };
    const weekly = weeklyRows.find((row) => Number(row.day_of_week) === dayOfWeek(dateKey));
    return weekly ? { ...weekly, is_special: false } : null;
  }

  function isOvernight(row) {
    if (!row || row.is_24_hours) return false;
    const opensAt = timeMinutes(row.opens_at);
    const closesAt = timeMinutes(row.closes_at);
    return Number.isFinite(opensAt) && Number.isFinite(closesAt) && closesAt < opensAt;
  }

  function nextOpening(clock) {
    for (let offset = 0; offset <= 8; offset += 1) {
      const dateKey = shiftDateKey(clock.dateKey, offset);
      const row = hoursForDate(dateKey);
      if (!row || row.is_closed) continue;
      const opensAt = row.is_24_hours ? 0 : timeMinutes(row.opens_at);
      if (!Number.isFinite(opensAt) || (offset === 0 && opensAt <= clock.minutes)) continue;
      return `${offset === 0 ? "Bugün" : dateLabel(dateKey)} ${row.is_24_hours ? "00:00" : timeValue(row.opens_at)}`;
    }
    return "";
  }

  function currentHoursStatus() {
    const clock = istanbulClock();
    const todaySpecial = specialForDate(clock.dateKey);
    const today = hoursForDate(clock.dateKey);
    const previous = todaySpecial ? null : hoursForDate(shiftDateKey(clock.dateKey, -1));
    let active = today?.is_24_hours && !today.is_closed ? today : null;
    if (!active && previous && !previous.is_closed && isOvernight(previous) && clock.minutes < timeMinutes(previous.closes_at)) {
      active = previous;
    }
    if (!active && today && !today.is_closed && !today.is_24_hours) {
      const opensAt = timeMinutes(today.opens_at);
      const closesAt = timeMinutes(today.closes_at);
      const isOpen = isOvernight(today)
        ? clock.minutes >= opensAt
        : clock.minutes >= opensAt && clock.minutes < closesAt;
      if (isOpen) active = today;
    }
    const next = active ? "" : nextOpening(clock);
    return {
      isOpen: Boolean(active),
      summary: active
        ? active.is_24_hours ? "24 saat açık" : `Şimdi açık · ${timeValue(active.closes_at)} kapanış`
        : next ? `Kapalı · ${next} açılış` : "Kapalı",
      today: !today
        ? "Bugünkü program yayınlanmadı"
        : today.is_closed ? "Bugün kapalı" : today.is_24_hours ? "Bugün 24 saat açık" : `Bugün ${timeValue(today.opens_at)} - ${timeValue(today.closes_at)}`,
      note: (active || today)?.note || "",
      isSpecial: Boolean(today?.is_special)
    };
  }

  function weeklySchema() {
    if (!hoursProfile) return [];
    return weekDays.map((day) => {
      const row = weeklyRows.find((entry) => Number(entry.day_of_week) === day.value);
      if (!row || row.is_closed) return null;
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: day.schema,
        opens: row.is_24_hours ? "00:00" : timeValue(row.opens_at),
        closes: row.is_24_hours ? "23:59" : timeValue(row.closes_at)
      };
    }).filter(Boolean);
  }

  function specialHoursSchema() {
    return specialRows.map((row) => ({
      "@type": "OpeningHoursSpecification",
      validFrom: row.service_date,
      validThrough: row.service_date,
      opens: row.is_closed || row.is_24_hours ? "00:00" : timeValue(row.opens_at),
      closes: row.is_closed ? "00:00" : row.is_24_hours ? "23:59" : timeValue(row.closes_at)
    }));
  }

  function formatDateTime(value) {
    const date = new Date(value || "");
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      dateStyle: "long",
      timeStyle: "short"
    });
  }

  function googleCalendarUrl() {
    if (item.item_type !== "events") return "";
    const start = new Date(item.starts_at || "");
    const end = new Date(item.ends_at || "");
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return "";
    const calendarTime = (value) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const location = [center.name, item.floor_label, center.address, center.district, center.city]
      .filter(Boolean)
      .join(", ");
    const details = [item.description, publicDetailUrl].filter(Boolean).join("\n\n");
    const query = new URLSearchParams({
      action: "TEMPLATE",
      text: item.title,
      dates: `${calendarTime(start)}/${calendarTime(end)}`,
      details,
      location
    });
    return `https://calendar.google.com/calendar/render?${query.toString()}`;
  }

  function centerDirectionsUrl() {
    const query = [center.name, center.address, center.district, center.city]
      .filter(Boolean)
      .join(", ");
    return query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : "";
  }

  function isCurrent(row) {
    const now = Date.now();
    const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : null;
    const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null;
    const hasRequiredTerms = row.item_type !== "deals" || String(row.terms_text || "").trim().length >= 3;
    return hasRequiredTerms
      && (!Number.isFinite(startsAt) || startsAt <= now)
      && (!Number.isFinite(endsAt) || endsAt >= now);
  }

  function buildSchema(canonicalUrl, imageUrl) {
    const address = {
      "@type": "PostalAddress",
      streetAddress: center.address || undefined,
      addressLocality: center.district || undefined,
      addressRegion: center.city || undefined,
      addressCountry: "TR"
    };
    const place = {
      "@type": "Place",
      name: center.name,
      address
    };
    const common = {
      "@context": "https://schema.org",
      name: item.title,
      description: item.description,
      image: imageUrl || undefined,
      url: canonicalUrl
    };
    if (item.item_type === "events") {
      return {
        ...common,
        "@type": "Event",
        startDate: item.starts_at || undefined,
        endDate: item.ends_at || undefined,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        location: place,
        offers: safeHttpUrl(item.cta_url) ? {
          "@type": "Offer",
          url: safeHttpUrl(item.cta_url),
          availability: "https://schema.org/InStock"
        } : undefined
      };
    }
    if (item.item_type === "deals") {
      return {
        ...common,
        "@type": "Offer",
        validFrom: item.starts_at || undefined,
        validThrough: item.ends_at || undefined,
        availableAtOrFrom: place,
        termsOfService: item.terms_text || undefined,
        availability: "https://schema.org/InStock",
        url: safeHttpUrl(item.cta_url) || canonicalUrl
      };
    }
    const schema = {
      ...common,
      "@type": item.item_type === "dining" ? "Restaurant" : "Store",
      telephone: item.contact_phone || undefined,
      sameAs: safeHttpUrl(item.website_url) || undefined,
      address,
      containedInPlace: { "@type": "ShoppingCenter", name: center.name },
      openingHoursSpecification: weeklySchema()
    };
    const special = specialHoursSchema();
    if (special.length) schema.specialOpeningHoursSpecification = special;
    return schema;
  }

  function renderHours() {
    const section = document.querySelector("[data-avm-detail-hours-section]");
    if (!section || !hoursProfile || weeklyRows.length !== 7) {
      if (section) section.hidden = true;
      return;
    }
    const status = currentHoursStatus();
    section.hidden = false;
    document.querySelector("[data-avm-detail-hours-title]").textContent = hoursProfile.title;
    document.querySelector("[data-avm-detail-hours-status]").textContent = status.summary;
    document.querySelector("[data-avm-detail-hours-today]").textContent = `${status.today}${status.isSpecial ? " · Özel gün programı" : ""}`;
    const note = document.querySelector("[data-avm-detail-hours-note]");
    note.hidden = !status.note;
    note.textContent = status.note;
    document.querySelector("[data-avm-detail-weekly-hours]").innerHTML = weekDays.map((day) => {
      const row = weeklyRows.find((entry) => Number(entry.day_of_week) === day.value);
      const range = row.is_closed ? "Kapalı" : row.is_24_hours ? "24 saat açık" : `${timeValue(row.opens_at)} - ${timeValue(row.closes_at)}`;
      return `<div><dt>${core.escapeHTML(day.label)}</dt><dd>${core.escapeHTML(range)}${row.note ? `<small>${core.escapeHTML(row.note)}</small>` : ""}</dd></div>`;
    }).join("");
  }

  function renderRelated(rows) {
    const section = document.querySelector("[data-avm-detail-related-section]");
    const target = document.querySelector("[data-avm-detail-related]");
    const visible = (rows || []).filter(isCurrent).slice(0, 3);
    if (!section || !target || !visible.length) {
      if (section) section.hidden = true;
      return;
    }
    section.hidden = false;
    target.innerHTML = visible.map((row) => {
      const image = safeHttpUrl(row.image_url);
      return `
        <article class="avm-detail-related-card">
          ${image ? `<img src="${core.escapeHTML(image)}" alt="${core.escapeHTML(row.image_alt || row.title)}" loading="lazy">` : ""}
          <div>
            <span>${core.escapeHTML(row.floor_label || row.category)}</span>
            <h3>${core.escapeHTML(row.title)}</h3>
            <p>${core.escapeHTML(core.truncate(row.description || "", 120))}</p>
            <a class="link-btn" href="avm-detay.html?item=${encodeURIComponent(row.public_id)}">Detayı Aç</a>
          </div>
        </article>
      `;
    }).join("");
    target.querySelectorAll("img").forEach((image) => {
      image.addEventListener("error", () => image.remove(), { once: true });
    });
  }

  function renderDetail(relatedRows) {
    const detail = document.querySelector("[data-avm-detail]");
    const status = document.querySelector("[data-avm-detail-status]");
    const typeLabel = typeLabels[item.item_type] || "AVM İçeriği";
    const imageUrl = safeHttpUrl(item.image_url);
    const website = safeHttpUrl(item.website_url);
    const ctaUrl = safeHttpUrl(item.cta_url);
    const canonicalUrl = new URL(`avm-detay.html?item=${encodeURIComponent(item.public_id)}`, window.location.href).href;
    publicDetailUrl = canonicalUrl;
    setRobots(true);
    status.hidden = true;
    detail.hidden = false;
    document.querySelector("[data-avm-detail-type]").textContent = typeLabel;
    document.querySelector("[data-avm-detail-floor]").textContent = item.floor_label || "Konum bilgisi bekliyor";
    document.querySelector("[data-avm-detail-center]").textContent = center.name;
    document.querySelector("[data-avm-detail-title]").textContent = item.title;
    document.querySelector("[data-avm-detail-breadcrumb]").textContent = item.title;
    document.querySelector("[data-avm-detail-description]").textContent = core.truncate(item.description, 220);
    document.querySelector("[data-avm-detail-long-description]").textContent = item.description;
    document.querySelector("[data-avm-detail-location]").textContent = item.floor_label || center.name;
    document.querySelector("[data-avm-detail-category]").textContent = item.category;
    const directoryLink = document.querySelector("[data-avm-detail-directory-link]");
    directoryLink.href = `avm-dunyasi.html?view=${encodeURIComponent(item.item_type)}&item=${encodeURIComponent(item.public_id)}#avm-experience`;
    directoryLink.textContent = typeLabels[item.item_type] ? `${typeLabel} Rehberi` : "Katalog";
    const image = document.querySelector("[data-avm-detail-image]");
    image.hidden = !imageUrl;
    image.closest(".avm-detail__media")?.classList.toggle("is-empty", !imageUrl);
    image.closest(".avm-detail__hero")?.classList.toggle("has-no-media", !imageUrl);
    if (imageUrl) {
      image.src = imageUrl;
      image.alt = item.image_alt || item.title;
      image.addEventListener("error", () => {
        image.hidden = true;
        image.closest(".avm-detail__media")?.classList.add("is-empty");
        image.closest(".avm-detail__hero")?.classList.add("has-no-media");
      }, { once: true });
    }
    const schedule = document.querySelector("[data-avm-detail-schedule]");
    const scheduleText = item.starts_at && item.ends_at
      ? `${formatDateTime(item.starts_at)} - ${formatDateTime(item.ends_at)}`
      : "";
    schedule.hidden = !scheduleText;
    schedule.textContent = scheduleText;
    setLink("[data-avm-detail-cta]", ctaUrl, item.cta_label || "Detayı Aç");
    setLink("[data-avm-detail-website]", website && website !== ctaUrl ? website : "");
    const phoneTarget = String(item.contact_phone || "").replace(/[^+\d]/g, "");
    setLink("[data-avm-detail-phone]", phoneTarget ? `tel:${phoneTarget}` : "");
    setLink(
      "[data-avm-detail-route]",
      item.floor_zone_id
        ? `avm-dunyasi.html?view=${encodeURIComponent(item.item_type)}&item=${encodeURIComponent(item.public_id)}&route=1#avm-wayfinding`
        : ""
    );
    setLink("[data-avm-detail-directions]", centerDirectionsUrl());
    setLink("[data-avm-detail-calendar]", googleCalendarUrl());
    const termsSection = document.querySelector("[data-avm-detail-terms-section]");
    termsSection.hidden = !item.terms_text;
    document.querySelector("[data-avm-detail-terms]").textContent = item.terms_text || "";
    const redemption = document.querySelector("[data-avm-detail-redemption]");
    const redeemed = readSavedRedemptions().has(item.public_id);
    redemption.hidden = item.item_type !== "deals";
    redemption.disabled = redeemed;
    redemption.textContent = redeemed ? "İlgi Kaydedildi" : "İlgileniyorum";
    syncPlanButton();
    renderHours();
    renderRelated(relatedRows);
    core.setMeta({
      title: `${item.title} | ${center.name}`,
      description: core.truncate(`${item.description} ${item.floor_label || ""}`.trim(), 160),
      image: imageUrl || undefined,
      url: canonicalUrl,
      schema: buildSchema(canonicalUrl, imageUrl)
    });
  }

  function readPlan() {
    try {
      const value = JSON.parse(localStorage.getItem(planKey) || "[]");
      return Array.isArray(value) ? value.filter((id) => typeof id === "string" && id) : [];
    } catch (error) {
      return [];
    }
  }

  function syncPlanButton() {
    const button = document.querySelector("[data-avm-detail-plan]");
    if (!button || !item) return;
    const saved = readPlan().includes(item.public_id);
    button.disabled = saved;
    button.textContent = saved ? "Rotaya Eklendi" : "Rotaya Ekle";
  }

  function addToPlan() {
    const plan = readPlan();
    if (plan.includes(item.public_id)) {
      syncPlanButton();
      setActionStatus("Bu içerik ziyaret rotanızda zaten bulunuyor.", "success");
      return;
    }
    plan.push(item.public_id);
    try {
      localStorage.setItem(planKey, JSON.stringify(plan));
      syncPlanButton();
      setActionStatus("İçerik ziyaret rotanıza eklendi.", "success");
      recordInteraction("plan_add");
    } catch (error) {
      setActionStatus("Rota bu tarayıcıda kaydedilemedi.", "error");
    }
  }

  function readSavedRedemptions() {
    try {
      const value = JSON.parse(sessionStorage.getItem(savedRedemptionsKey) || "[]");
      return new Set(Array.isArray(value) ? value : []);
    } catch (error) {
      return new Set();
    }
  }

  function redemptionSessionId() {
    try {
      const saved = sessionStorage.getItem(redemptionSessionKey);
      if (saved) return saved;
    } catch (error) {
      // Continue with an in-memory identifier.
    }
    let value = window.crypto?.randomUUID ? window.crypto.randomUUID() : "";
    if (!value && window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((part) => part.toString(16).padStart(2, "0")).join("");
      value = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    if (value) {
      try {
        sessionStorage.setItem(redemptionSessionKey, value);
      } catch (error) {
        // The database write can still use the generated UUID.
      }
    }
    return value;
  }

  async function recordInteraction(interactionType) {
    const db = client();
    const sessionId = redemptionSessionId();
    if (!db || !sessionId || !item?.id || !center?.id) return;
    try {
      const { error } = await db.from("mall_directory_interactions").insert({
        mall_id: center.id,
        directory_item_id: item.id,
        directory_public_id: item.public_id,
        visitor_session_id: sessionId,
        interaction_type: interactionType,
        source_page: "avm-detay"
      });
      if (error && error.code !== "23505") throw error;
    } catch (error) {
      // Interaction reporting never blocks the visitor action.
    }
  }

  async function saveRedemption(button) {
    const db = client();
    const sessionId = redemptionSessionId();
    if (!db || !sessionId) {
      setActionStatus("Kampanya ilgisi şu anda kaydedilemiyor.", "error");
      return;
    }
    button.disabled = true;
    try {
      const { error } = await db.from("mall_campaign_redemptions").insert({
        mall_id: center.id,
        directory_item_id: item.id,
        directory_public_id: item.public_id,
        visitor_session_id: sessionId,
        action_type: "save_interest",
        campaign_title: item.title,
        source_page: "avm-detay"
      });
      if (error && error.code !== "23505") throw error;
      const saved = readSavedRedemptions();
      saved.add(item.public_id);
      try {
        sessionStorage.setItem(savedRedemptionsKey, JSON.stringify([...saved]));
      } catch (storageError) {
        // The successful database record remains authoritative.
      }
      button.textContent = "İlgi Kaydedildi";
      setActionStatus("Kampanya ilginiz kaydedildi.", "success");
    } catch (error) {
      button.disabled = false;
      setActionStatus(error.message || "Kampanya ilgisi kaydedilemedi.", "error");
    }
  }

  async function shareDetail() {
    const data = { title: item.title, text: item.description, url: publicDetailUrl || window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(data.url);
      setActionStatus("Detay bağlantısı paylaşım için hazırlandı.", "success");
      recordInteraction("share");
    } catch (error) {
      if (error.name !== "AbortError") setActionStatus("Bağlantı paylaşılamadı.", "error");
    }
  }

  async function loadHours(db) {
    try {
      const { data, error } = await db
        .from("mall_hours_profiles")
        .select("id,directory_item_id,title,scope,display_order,status")
        .eq("mall_id", center.id)
        .eq("status", "active")
        .order("display_order", { ascending: true });
      if (error) throw error;
      const profiles = data || [];
      const exact = profiles.find((profile) => profile.scope === "directory_item" && profile.directory_item_id === item.id);
      const eventScopes = /sinema|cinema/i.test(item.category) ? ["cinema", "entertainment"] : ["entertainment"];
      const scopes = item.item_type === "stores" ? ["stores"] : item.item_type === "dining" ? ["dining"] : item.item_type === "events" ? eventScopes : [];
      hoursProfile = exact || (scopes.length
        ? profiles.find((profile) => scopes.includes(profile.scope)) || profiles.find((profile) => profile.scope === "mall")
        : null);
      if (!hoursProfile) return;
      const clock = istanbulClock();
      const [weeklyResult, specialResult] = await Promise.all([
        db.from("mall_weekly_hours").select("profile_id,day_of_week,opens_at,closes_at,is_closed,is_24_hours,note").eq("profile_id", hoursProfile.id),
        db.from("mall_special_hours")
          .select("profile_id,service_date,opens_at,closes_at,is_closed,is_24_hours,note,status")
          .eq("profile_id", hoursProfile.id)
          .eq("status", "active")
          .gte("service_date", shiftDateKey(clock.dateKey, -1))
          .lte("service_date", shiftDateKey(clock.dateKey, 370))
      ]);
      if (weeklyResult.error) throw weeklyResult.error;
      if (specialResult.error) throw specialResult.error;
      weeklyRows = weeklyResult.data || [];
      specialRows = specialResult.data || [];
    } catch (error) {
      hoursProfile = null;
      weeklyRows = [];
      specialRows = [];
    }
  }

  async function findItem(db) {
    const fields = "id,mall_id,floor_zone_id,public_id,item_type,title,category,floor_label,description,image_url,image_alt,contact_phone,website_url,cta_url,cta_label,terms_text,tags,estimated_minutes,touch_score,display_order,starts_at,ends_at,status";
    let result = await db
      .from("mall_directory_items")
      .select(fields)
      .eq("mall_id", center.id)
      .eq("public_id", itemKey)
      .eq("status", "active")
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(itemKey)) {
      result = await db
        .from("mall_directory_items")
        .select(fields)
        .eq("mall_id", center.id)
        .eq("id", itemKey)
        .eq("status", "active")
        .maybeSingle();
      if (result.error) throw result.error;
    }
    return result.data || null;
  }

  async function loadDetail() {
    if (!itemKey) {
      setRobots(false);
      setStatus("Detay bağlantısında içerik kimliği bulunmuyor.", "error");
      return;
    }
    if (isLocalPreview()) {
      setRobots(false);
      setStatus("Yerel önizlemede kurgusal AVM detayı gösterilmez. Detaylar aktif Supabase kayıtlarından yayınlanır.", "info");
      return;
    }
    const db = client();
    if (!db) {
      setRobots(false);
      setStatus("AVM detay verisi şu anda yüklenemiyor.", "error");
      return;
    }
    try {
      const centerResult = await db
        .from("mall_centers")
        .select("id,name,city,district,address,phone,website_url,status")
        .eq("slug", mallSlug)
        .eq("status", "active")
        .maybeSingle();
      if (centerResult.error) throw centerResult.error;
      center = centerResult.data;
      if (!center) throw new Error("Aktif AVM merkezi bulunamadı.");
      item = await findItem(db);
      if (!item) throw new Error("Bu AVM içeriği şu anda yayında değil.");
      if (item.item_type === "deals" && String(item.terms_text || "").trim().length < 3) {
        throw new Error("Bu kampanyanın kullanım koşulları henüz yayına hazır değil.");
      }
      if (!isCurrent(item)) throw new Error("Bu AVM içeriği şu anda yayında değil.");
      const relatedPromise = db
        .from("mall_directory_items")
        .select("id,public_id,item_type,title,category,floor_label,description,image_url,image_alt,terms_text,starts_at,ends_at,status")
        .eq("mall_id", center.id)
        .eq("item_type", item.item_type)
        .eq("category", item.category)
        .eq("status", "active")
        .neq("id", item.id)
        .order("display_order", { ascending: true })
        .limit(12);
      const [relatedResult] = await Promise.all([relatedPromise, loadHours(db)]);
      renderDetail(relatedResult.error ? [] : relatedResult.data || []);
      recordInteraction("detail_view");
      if (refreshTimer) window.clearInterval(refreshTimer);
      refreshTimer = hoursProfile ? window.setInterval(renderHours, 60000) : undefined;
    } catch (error) {
      setRobots(false);
      setStatus(error.message || "AVM detayı yüklenemedi.", "error");
    }
  }

  function bindActions() {
    document.querySelector("[data-avm-detail-plan]")?.addEventListener("click", addToPlan);
    document.querySelector("[data-avm-detail-share]")?.addEventListener("click", shareDetail);
    document.querySelector("[data-avm-detail-redemption]")?.addEventListener("click", (event) => saveRedemption(event.currentTarget));
    document.querySelector("[data-avm-detail-cta]")?.addEventListener("click", () => recordInteraction("cta_open"));
    document.querySelector("[data-avm-detail-website]")?.addEventListener("click", () => recordInteraction("website_open"));
    document.querySelector("[data-avm-detail-phone]")?.addEventListener("click", () => recordInteraction("phone_open"));
    document.querySelector("[data-avm-detail-route]")?.addEventListener("click", () => recordInteraction("route_open"));
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-page='avm-detail']")) return;
    bindActions();
    loadDetail();
  });
})();
