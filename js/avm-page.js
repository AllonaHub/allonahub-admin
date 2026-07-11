(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const planKey = "allona_avm_plan_v1";
  const directoryFavoritesKey = "allona_avm_directory_favorites_v1";
  const parkingLocationKey = "allona_avm_parking_location_v1";
  const parkingLocationTtlMs = 48 * 60 * 60 * 1000;
  const parkingAvailabilityFreshMs = 15 * 60 * 1000;
  const redemptionSessionKey = "allona_avm_redemption_session_v1";
  const savedRedemptionsKey = "allona_avm_saved_redemptions_v1";
  const mallSlug = "allona-avm-dunyasi";
  const directoryParams = new URLSearchParams(window.location.search);
  const requestedDirectoryItemId = String(directoryParams.get("item") || "").trim().slice(0, 180);
  const requestedDirectoryRoute = directoryParams.get("route") === "1";

  const viewLabels = {
    stores: "Mağazalar",
    events: "Etkinlikler",
    deals: "Kampanyalar",
    dining: "Yeme İçme"
  };

  const serviceCategoryLabels = {
    parking: "Otopark",
    transport: "Ulaşım",
    accessibility: "Erişilebilirlik",
    family: "Aile",
    guest_services: "Danışma",
    amenities: "Konfor"
  };

  const serviceAvailabilityLabels = {
    available: "Hizmet veriyor",
    limited: "Sınırlı hizmet",
    temporarily_unavailable: "Geçici olarak kapalı",
    scheduled: "Planlı"
  };

  const parkingAvailabilityLabels = {
    unknown: "Anlık bilgi yok",
    available: "Yer var",
    limited: "Sınırlı yer",
    full: "Dolu",
    closed: "Kapalı"
  };

  const transportModeLabels = {
    metro: "Metro / raylı sistem",
    bus: "Otobüs",
    shuttle: "AVM servisi",
    minibus: "Minibüs / dolmuş",
    taxi: "Taksi",
    walking: "Yaya",
    cycling: "Bisiklet"
  };

  const transportStatusLabels = {
    operating: "Hizmet veriyor",
    limited: "Sınırlı hizmet",
    suspended: "Geçici olarak durdu",
    planned: "Planlandı"
  };

  const noticeTypeLabels = {
    general: "Genel",
    access: "Giriş / erişim",
    transport: "Ulaşım",
    parking: "Otopark",
    service: "Ziyaretçi hizmeti",
    event: "Etkinlik etkisi"
  };

  const noticeSeverityLabels = {
    info: "Bilgi",
    advisory: "Dikkat",
    urgent: "Önemli"
  };

  const hoursScopeLabels = {
    mall: "AVM merkezi",
    stores: "Mağazalar",
    dining: "Yeme İçme",
    cinema: "Sinema",
    parking: "Otopark",
    entertainment: "Eğlence",
    services: "Ziyaretçi Hizmetleri",
    directory_item: "Mağaza / mekan"
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

  let items = [];
  let zones = [];
  let services = [];
  let parkingAreas = [];
  let transportRoutes = [];
  let operationalNotices = [];
  let parkingAreasReady = false;
  let hoursProfiles = [];
  let weeklyHoursRows = [];
  let specialHoursRows = [];
  let floorMaps = [];
  let activeFloorMapId = "";
  let activeZoneId = "";
  let currentView = viewLabels[directoryParams.get("view")] ? directoryParams.get("view") : "stores";
  let plan = readPlan();
  let directoryFavorites = readDirectoryFavorites();
  let mallCenterLookup;
  let directoryLinkFocused = false;
  let redemptionSessionFallback = "";
  let catalogMetricsState = isLocalPreview() ? "preview" : "loading";
  let zoneMetricsReady = false;
  let floorMapMetricsReady = false;
  let openingHoursRefreshTimer;
  let savedParkingLocation = readParkingLocation();
  const savedRedemptions = readSavedRedemptions();

  function readPlan() {
    try {
      const value = JSON.parse(localStorage.getItem(planKey) || "[]");
      return Array.isArray(value) ? value.filter((id) => typeof id === "string" && id) : [];
    } catch (error) {
      return [];
    }
  }

  function writePlan() {
    try {
      localStorage.setItem(planKey, JSON.stringify(plan));
    } catch (error) {
      // Visitor route planning can continue for the current page session.
    }
  }

  function readDirectoryFavorites() {
    try {
      const value = JSON.parse(localStorage.getItem(directoryFavoritesKey) || "[]");
      return new Set(Array.isArray(value) ? value.filter((id) => typeof id === "string" && id).slice(0, 500) : []);
    } catch (error) {
      return new Set();
    }
  }

  function writeDirectoryFavorites() {
    try {
      localStorage.setItem(directoryFavoritesKey, JSON.stringify([...directoryFavorites].slice(0, 500)));
    } catch (error) {
      // Favorites remain usable for the current page session when storage is unavailable.
    }
  }

  function toggleDirectoryFavorite(id) {
    const item = findItem(id);
    if (!item) return;
    if (directoryFavorites.has(item.id)) {
      directoryFavorites.delete(item.id);
    } else {
      directoryFavorites.add(item.id);
      recordDirectoryInteraction(item, "favorite_save");
    }
    writeDirectoryFavorites();
    renderResults();
  }

  function readParkingLocation() {
    try {
      const value = JSON.parse(localStorage.getItem(parkingLocationKey) || "null");
      const savedAt = new Date(value?.saved_at || "").getTime();
      const marker = String(value?.marker || "").trim();
      const note = String(value?.note || "").trim();
      if (!value?.parking_area_id || !marker || marker.length > 80 || note.length > 200 || !Number.isFinite(savedAt)) {
        localStorage.removeItem(parkingLocationKey);
        return null;
      }
      if (Date.now() - savedAt > parkingLocationTtlMs || savedAt - Date.now() > 5 * 60 * 1000) {
        localStorage.removeItem(parkingLocationKey);
        return null;
      }
      return {
        parking_area_id: String(value.parking_area_id),
        marker,
        note,
        saved_at: new Date(savedAt).toISOString()
      };
    } catch (error) {
      try {
        localStorage.removeItem(parkingLocationKey);
      } catch (storageError) {
        // Storage can remain unavailable while the page continues without a saved location.
      }
      return null;
    }
  }

  function writeParkingLocation(value) {
    savedParkingLocation = value;
    try {
      localStorage.setItem(parkingLocationKey, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearParkingLocation() {
    savedParkingLocation = null;
    try {
      localStorage.removeItem(parkingLocationKey);
    } catch (error) {
      // The in-memory record is still cleared for the current page.
    }
  }

  function readSavedRedemptions() {
    try {
      const values = JSON.parse(sessionStorage.getItem(savedRedemptionsKey) || "[]");
      return new Set(Array.isArray(values) ? values.filter(Boolean) : []);
    } catch (error) {
      return new Set();
    }
  }

  function markRedemptionSaved(id) {
    savedRedemptions.add(id);
    try {
      sessionStorage.setItem(savedRedemptionsKey, JSON.stringify([...savedRedemptions]));
    } catch (error) {
      // The in-memory state still prevents repeated clicks for this page.
    }
  }

  function createSessionUuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    if (!window.crypto?.getRandomValues) {
      const segment = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
      return `${segment()}${segment()}-${segment()}-4${segment().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${segment().slice(1)}-${segment()}${segment()}${segment()}`;
    }
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20)
    ].join("-");
  }

  function redemptionSessionId() {
    if (redemptionSessionFallback) return redemptionSessionFallback;
    try {
      const stored = sessionStorage.getItem(redemptionSessionKey);
      if (stored) {
        redemptionSessionFallback = stored;
        return stored;
      }
    } catch (error) {
      // A generated in-memory UUID is sufficient when sessionStorage is unavailable.
    }
    redemptionSessionFallback = createSessionUuid();
    if (redemptionSessionFallback) {
      try {
        sessionStorage.setItem(redemptionSessionKey, redemptionSessionFallback);
      } catch (error) {
        // Keep the generated identifier in memory for this page.
      }
    }
    return redemptionSessionFallback;
  }

  function client() {
    try {
      return App.db && App.db.client ? App.db.client() : null;
    } catch (error) {
      return null;
    }
  }

  async function recordDirectoryInteraction(item, interactionType) {
    const db = client();
    const sessionId = redemptionSessionId();
    if (!db || !sessionId || !item?.record_id) return;
    try {
      const mall = await resolveMallCenter(db);
      if (mall.error || !mall.id) return;
      const { error } = await db.from("mall_directory_interactions").insert({
        mall_id: mall.id,
        directory_item_id: item.record_id,
        directory_public_id: item.public_id,
        visitor_session_id: sessionId,
        interaction_type: interactionType,
        source_page: "avm-dunyasi"
      });
      if (error && error.code !== "23505") throw error;
    } catch (error) {
      // Interaction reporting never blocks the visitor action.
    }
  }

  function isLocalPreview() {
    return window.location.protocol === "file:" || ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  }

  function normalizeRemoteItem(row) {
    return {
      record_id: row.id || null,
      public_id: row.public_id || row.id,
      id: row.public_id || row.id,
      floor_zone_id: row.floor_zone_id || null,
      type: row.item_type,
      title: row.title,
      category: row.category,
      floor: row.floor_label || "Tüm AVM",
      image_url: row.image_url || "",
      image_alt: row.image_alt || row.title || "",
      tags: Array.isArray(row.tags) ? row.tags : [],
      detail: row.description || "",
      time: Number(row.estimated_minutes || 20),
      touch: Number(row.touch_score || 3),
      display_order: Number(row.display_order || 999),
      starts_at: row.starts_at || null,
      ends_at: row.ends_at || null,
      terms_text: row.terms_text || ""
    };
  }

  function isCurrentDirectoryItem(row) {
    const now = Date.now();
    const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : null;
    const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null;
    const hasRequiredTerms = row.type !== "deals" || String(row.terms_text || "").trim().length >= 3;
    return hasRequiredTerms
      && (!Number.isFinite(startsAt) || startsAt <= now)
      && (!Number.isFinite(endsAt) || endsAt >= now);
  }

  function normalizeRemoteZone(row) {
    return {
      record_id: row.id || null,
      floor_map_id: row.floor_map_id || null,
      id: row.public_id || row.id,
      title: row.title,
      floor: row.floor_label || "Zemin Kat",
      type: row.zone_type || "stores",
      detail: row.description || "",
      route: row.route_hint || "",
      metric: row.management_metric || "",
      map_x_percent: Number(row.map_x_percent ?? 10),
      map_y_percent: Number(row.map_y_percent ?? 25),
      map_width_percent: Number(row.map_width_percent ?? 25),
      map_height_px: Number(row.map_height_px ?? 58),
      display_order: Number(row.display_order || 999)
    };
  }

  function normalizeRemoteFloorMap(row) {
    return {
      record_id: row.id || null,
      id: row.public_id || row.id,
      title: row.title || "Kat planı",
      floor: row.floor_label || "Zemin Kat",
      image_url: row.image_url || "",
      image_alt: row.image_alt || row.title || "AVM kat planı",
      native_width_px: Number(row.native_width_px) || null,
      native_height_px: Number(row.native_height_px) || null,
      display_order: Number(row.display_order || 999)
    };
  }

  function normalizeRemoteService(row) {
    return {
      id: row.public_id || row.id,
      record_id: row.id || null,
      floor_zone_id: row.floor_zone_id || null,
      title: row.title,
      category: row.category,
      description: row.description || "",
      floor: row.floor_label || "Konum bilgisi bekliyor",
      route: row.route_hint || "",
      operating_hours: row.operating_hours || "",
      availability: row.availability_status || "available",
      availability_note: row.availability_note || "",
      accessible: Boolean(row.is_accessibility_service),
      display_order: Number(row.display_order || 999)
    };
  }

  function normalizeRemoteParkingArea(row) {
    return {
      id: row.public_id || row.id,
      record_id: row.id,
      mall_id: row.mall_id,
      floor_zone_id: row.floor_zone_id,
      hours_profile_id: row.hours_profile_id,
      title: row.title,
      level_label: row.level_label,
      entrance_label: row.entrance_label,
      directions_text: row.directions_text || "",
      directions_url: safeHttpUrl(row.directions_url),
      capacity_total: Number(row.capacity_total) || 0,
      accessible_spaces: Number(row.accessible_spaces) || 0,
      family_spaces: Number(row.family_spaces) || 0,
      ev_charging_spaces: Number(row.ev_charging_spaces) || 0,
      motorcycle_spaces: Number(row.motorcycle_spaces) || 0,
      max_height_m: row.max_height_m === null || row.max_height_m === undefined ? null : Number(row.max_height_m),
      pricing_text: row.pricing_text || "",
      best_for: row.best_for || "",
      availability_status: row.availability_status || "unknown",
      spaces_available: row.spaces_available === null || row.spaces_available === undefined ? null : Number(row.spaces_available),
      availability_updated_at: row.availability_updated_at || null,
      display_order: Number(row.display_order || 999)
    };
  }

  function normalizeRemoteTransportRoute(row) {
    return {
      id: row.public_id || row.id,
      mode: row.mode,
      title: row.title,
      origin: row.origin_label,
      destination: row.destination_label,
      stop: row.stop_name || "",
      route_number: row.route_number || "",
      schedule: row.schedule_text || "",
      duration: row.duration_text || "",
      fare: row.fare_text || "",
      accessibility: row.accessibility_text || "",
      directions: row.directions_text || "",
      directions_url: safeHttpUrl(row.directions_url),
      service_status: row.service_status || "operating",
      display_order: Number(row.display_order || 999)
    };
  }

  function numberValue(value, fallback, min, max) {
    const parsed = Number(value);
    const numeric = Number.isFinite(parsed) ? parsed : fallback;
    const minBound = Number.isFinite(min) ? min : -Infinity;
    const maxBound = Number.isFinite(max) ? max : Infinity;
    return Math.min(Math.max(numeric, minBound), maxBound);
  }

  function safeImageUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw, window.location.href);
      if (["http:", "https:", "file:"].includes(parsed.protocol)) return parsed.href;
    } catch (error) {
      return "";
    }
    return "";
  }

  function safeHttpUrl(value) {
    const url = safeImageUrl(value);
    return /^https?:/i.test(url) ? url : "";
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
    if (!Number.isFinite(date.getTime())) return dateKey;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function dayOfWeekForDate(dateKey) {
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
    const hour = Number(parts.hour || 0);
    const minute = Number(parts.minute || 0);
    return {
      dateKey,
      dayOfWeek: dayOfWeekForDate(dateKey),
      minutes: (hour * 60) + minute
    };
  }

  function istanbulDateTimeInputValue(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value || "");
    if (!Number.isFinite(date.getTime())) return "";
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function istanbulDateTimeInputToIso(value) {
    const match = String(value || "").trim().match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?$/);
    if (!match) return null;
    const date = new Date(`${match[1]}:00+03:00`);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function dateLabel(dateKey, includeDate = false) {
    const value = new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("tr-TR", {
      timeZone: "UTC",
      weekday: "long",
      ...(includeDate ? { day: "numeric", month: "long" } : {})
    });
    return value ? `${value.charAt(0).toLocaleUpperCase("tr-TR")}${value.slice(1)}` : "";
  }

  function specialHoursForDate(profileId, dateKey) {
    return specialHoursRows.find((row) => row.profile_id === profileId && row.service_date === dateKey) || null;
  }

  function hoursRowForDate(profileId, dateKey) {
    const special = specialHoursForDate(profileId, dateKey);
    if (special) return { ...special, is_special: true };
    const weekly = weeklyHoursRows.find((row) => row.profile_id === profileId && Number(row.day_of_week) === dayOfWeekForDate(dateKey));
    return weekly ? { ...weekly, is_special: false } : null;
  }

  function overnightHours(row) {
    if (row?.is_24_hours) return false;
    const opensAt = timeMinutes(row?.opens_at);
    const closesAt = timeMinutes(row?.closes_at);
    return Number.isFinite(opensAt) && Number.isFinite(closesAt) && closesAt < opensAt;
  }

  function nextOpening(profileId, clock) {
    for (let offset = 0; offset <= 8; offset += 1) {
      const dateKey = shiftDateKey(clock.dateKey, offset);
      const row = hoursRowForDate(profileId, dateKey);
      if (!row || row.is_closed) continue;
      const opensAt = row.is_24_hours ? 0 : timeMinutes(row.opens_at);
      if (!Number.isFinite(opensAt)) continue;
      if (offset === 0 && opensAt <= clock.minutes) continue;
      return {
        dateKey,
        dayLabel: offset === 0 ? "Bugün" : dateLabel(dateKey),
        time: row.is_24_hours ? "00:00" : timeValue(row.opens_at)
      };
    }
    return null;
  }

  function openingStatus(profile, value = new Date()) {
    const clock = istanbulClock(value);
    const todaySpecial = specialHoursForDate(profile.id, clock.dateKey);
    const todayRow = hoursRowForDate(profile.id, clock.dateKey);
    const previousDate = shiftDateKey(clock.dateKey, -1);
    const previousRow = todaySpecial ? null : hoursRowForDate(profile.id, previousDate);
    let activeRow = null;
    let closesAt = "";

    if (todayRow?.is_24_hours && !todayRow.is_closed) {
      activeRow = todayRow;
    }

    if (!activeRow && previousRow && !previousRow.is_closed && overnightHours(previousRow)) {
      const previousClose = timeMinutes(previousRow.closes_at);
      if (clock.minutes < previousClose) {
        activeRow = previousRow;
        closesAt = timeValue(previousRow.closes_at);
      }
    }

    if (!activeRow && todayRow && !todayRow.is_closed && !todayRow.is_24_hours) {
      const opensAt = timeMinutes(todayRow.opens_at);
      const closesAtMinutes = timeMinutes(todayRow.closes_at);
      const isOpen = overnightHours(todayRow)
        ? clock.minutes >= opensAt
        : clock.minutes >= opensAt && clock.minutes < closesAtMinutes;
      if (isOpen) {
        activeRow = todayRow;
        closesAt = timeValue(todayRow.closes_at);
      }
    }

    const next = activeRow ? null : nextOpening(profile.id, clock);
    const todayHours = !todayRow
      ? "Bugünkü program yayınlanmadı"
      : todayRow.is_closed
        ? "Bugün kapalı"
        : todayRow.is_24_hours
          ? "Bugün 24 saat açık"
          : `Bugün ${timeValue(todayRow.opens_at)} - ${timeValue(todayRow.closes_at)}`;
    const isOpen = Boolean(activeRow);
    return {
      isOpen,
      todayRow,
      activeRow,
      next,
      todayHours,
      note: (activeRow || todayRow)?.note || "",
      isSpecial: Boolean(todayRow?.is_special),
      summary: isOpen
        ? activeRow.is_24_hours ? "24 saat açık" : `Şimdi açık · ${closesAt} kapanış`
        : next
          ? `Kapalı · ${next.dayLabel} ${next.time} açılış`
          : "Kapalı",
      shortLabel: isOpen
        ? activeRow.is_24_hours ? "24 saat açık" : `Açık · ${closesAt} kapanış`
        : next
          ? `Kapalı · ${next.dayLabel} ${next.time}`
          : "Kapalı"
    };
  }

  function hoursProfileForItem(item) {
    const exact = hoursProfiles.find((profile) => profile.scope === "directory_item" && profile.directory_item_id === item.record_id);
    if (exact) return exact;
    const eventScopes = /sinema|cinema/i.test(String(item.category || ""))
      ? ["cinema", "entertainment"]
      : ["entertainment"];
    const scopesByType = { stores: ["stores"], dining: ["dining"], events: eventScopes };
    const scopes = scopesByType[item.type];
    if (!scopes) return null;
    return hoursProfiles.find((profile) => scopes.includes(profile.scope))
      || hoursProfiles.find((profile) => profile.scope === "mall")
      || null;
  }

  function itemOpeningStatus(item, value = new Date()) {
    const profile = hoursProfileForItem(item);
    return profile ? openingStatus(profile, value) : null;
  }

  function weeklyHoursMarkup(profile) {
    return weekDays.map((day) => {
      const row = weeklyHoursRows.find((entry) => entry.profile_id === profile.id && Number(entry.day_of_week) === day.value);
      const hours = !row ? "Yayınlanmadı" : row.is_closed ? "Kapalı" : row.is_24_hours ? "24 saat açık" : `${timeValue(row.opens_at)} - ${timeValue(row.closes_at)}`;
      return `<div><dt>${core.escapeHTML(day.label)}</dt><dd>${core.escapeHTML(hours)}${row?.note ? `<small>${core.escapeHTML(row.note)}</small>` : ""}</dd></div>`;
    }).join("");
  }

  function upcomingSpecialHours(profileId, today) {
    return specialHoursRows
      .filter((row) => row.profile_id === profileId && row.service_date > today)
      .sort((left, right) => left.service_date.localeCompare(right.service_date))[0] || null;
  }

  function hoursRowLabel(row) {
    if (!row) return "";
    if (row.is_closed) return "Kapalı";
    if (row.is_24_hours) return "24 saat açık";
    return `${timeValue(row.opens_at)} - ${timeValue(row.closes_at)}`;
  }

  function syncOpenNowFilter() {
    const option = document.querySelector('[data-avm-priority] option[value="open_now"]');
    if (!option) return;
    option.disabled = !hoursProfiles.some((profile) => ["mall", "stores", "dining", "cinema", "entertainment", "directory_item"].includes(profile.scope));
    const select = option.closest("select");
    if (option.disabled && select?.value === "open_now") select.value = "";
  }

  function renderOpeningHours() {
    const section = document.querySelector("[data-avm-opening-hours]");
    const target = document.querySelector("[data-avm-opening-hours-list]");
    const date = document.querySelector("[data-avm-opening-hours-date]");
    if (!section || !target) return;
    const profiles = hoursProfiles
      .filter((profile) => profile.scope !== "directory_item")
      .sort((a, b) => a.display_order - b.display_order);
    section.hidden = profiles.length === 0;
    syncOpenNowFilter();
    if (!profiles.length) {
      target.innerHTML = "";
      return;
    }
    const clock = istanbulClock();
    if (date) date.textContent = `${dateLabel(clock.dateKey, true)} · İstanbul saati`;
    target.innerHTML = profiles.map((profile) => {
      const status = openingStatus(profile);
      const upcomingSpecial = upcomingSpecialHours(profile.id, clock.dateKey);
      return `
        <article class="avm-opening-hours__item" data-avm-hours-state="${status.isOpen ? "open" : "closed"}">
          <div class="avm-opening-hours__top">
            <div>
              <span>${core.escapeHTML(hoursScopeLabels[profile.scope] || profile.scope)}</span>
              <h3>${core.escapeHTML(profile.title)}</h3>
            </div>
            <span class="pill ${status.isOpen ? "pill--gold" : ""}">${status.isOpen ? "Açık" : "Kapalı"}</span>
          </div>
          <strong>${core.escapeHTML(status.summary)}</strong>
          <p>${core.escapeHTML(status.todayHours)}${status.isSpecial ? " · Özel gün programı" : ""}</p>
          ${status.note ? `<p class="avm-opening-hours__notice">${core.escapeHTML(status.note)}</p>` : ""}
          ${upcomingSpecial ? `<p class="avm-opening-hours__notice"><strong>Sıradaki özel program:</strong> ${core.escapeHTML(dateLabel(upcomingSpecial.service_date, true))} · ${core.escapeHTML(hoursRowLabel(upcomingSpecial))}${upcomingSpecial.note ? ` · ${core.escapeHTML(upcomingSpecial.note)}` : ""}</p>` : ""}
          <details>
            <summary>Haftalık program</summary>
            <dl>${weeklyHoursMarkup(profile)}</dl>
          </details>
        </article>
      `;
    }).join("");
  }

  function updateMallCenterHoursSchema() {
    const schema = document.querySelector("#avm-center-schema");
    const profile = hoursProfiles.find((row) => row.scope === "mall")
      || hoursProfiles.find((row) => row.scope === "stores");
    if (!schema || !profile) return;
    try {
      const value = JSON.parse(schema.textContent || "{}");
      const weekly = weekDays.map((day) => {
        const row = weeklyHoursRows.find((entry) => entry.profile_id === profile.id && Number(entry.day_of_week) === day.value);
        if (!row || row.is_closed) return null;
        return {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: day.schema,
          opens: row.is_24_hours ? "00:00" : timeValue(row.opens_at),
          closes: row.is_24_hours ? "23:59" : timeValue(row.closes_at)
        };
      }).filter(Boolean);
      const specials = specialHoursRows
        .filter((row) => row.profile_id === profile.id)
        .map((row) => ({
          "@type": "OpeningHoursSpecification",
          validFrom: row.service_date,
          validThrough: row.service_date,
          opens: row.is_closed || row.is_24_hours ? "00:00" : timeValue(row.opens_at),
          closes: row.is_closed ? "00:00" : row.is_24_hours ? "23:59" : timeValue(row.closes_at)
        }));
      value.openingHoursSpecification = weekly;
      if (specials.length) value.specialOpeningHoursSpecification = specials;
      else delete value.specialOpeningHoursSpecification;
      schema.textContent = JSON.stringify(value);
    } catch (error) {
      // The center schema remains valid even when an external script changed it.
    }
  }

  async function loadOpeningHours() {
    if (isLocalPreview()) {
      hoursProfiles = [];
      weeklyHoursRows = [];
      specialHoursRows = [];
      renderOpeningHours();
      renderResults();
      renderParkingAreas();
      return;
    }
    const db = client();
    if (!db) {
      hoursProfiles = [];
      weeklyHoursRows = [];
      specialHoursRows = [];
      renderOpeningHours();
      renderParkingAreas();
      return;
    }
    try {
      const mall = await resolveMallCenter(db);
      if (mall.error) throw mall.error;
      if (!mall.id) throw new Error("AVM merkezi kaydı bulunamadı.");
      const { data, error } = await db
        .from("mall_hours_profiles")
        .select("id,mall_id,directory_item_id,public_id,title,scope,display_order,status")
        .eq("mall_id", mall.id)
        .eq("status", "active")
        .order("display_order", { ascending: true });
      if (error) throw error;
      hoursProfiles = data || [];
      const profileIds = hoursProfiles.map((profile) => profile.id);
      if (!profileIds.length) {
        weeklyHoursRows = [];
        specialHoursRows = [];
      } else {
        const clock = istanbulClock();
        const [weeklyResult, specialResult] = await Promise.all([
          db.from("mall_weekly_hours").select("profile_id,day_of_week,opens_at,closes_at,is_closed,is_24_hours,note").in("profile_id", profileIds),
          db.from("mall_special_hours")
            .select("profile_id,service_date,opens_at,closes_at,is_closed,is_24_hours,note,status")
            .in("profile_id", profileIds)
            .eq("status", "active")
            .gte("service_date", shiftDateKey(clock.dateKey, -1))
            .lte("service_date", shiftDateKey(clock.dateKey, 370))
        ]);
        if (weeklyResult.error) throw weeklyResult.error;
        if (specialResult.error) throw specialResult.error;
        weeklyHoursRows = weeklyResult.data || [];
        specialHoursRows = specialResult.data || [];
      }
      renderOpeningHours();
      updateMallCenterHoursSchema();
      renderResults();
      renderParkingAreas();
      if (openingHoursRefreshTimer) window.clearInterval(openingHoursRefreshTimer);
      openingHoursRefreshTimer = hoursProfiles.length
        ? window.setInterval(() => {
          renderOpeningHours();
          renderResults();
          renderParkingAreas();
        }, 60000)
        : undefined;
    } catch (error) {
      hoursProfiles = [];
      weeklyHoursRows = [];
      specialHoursRows = [];
      renderOpeningHours();
      renderResults();
      renderParkingAreas();
    }
  }

  function setCenterLink(selector, href) {
    const link = document.querySelector(selector);
    if (!link) return;
    link.hidden = !href;
    if (href) link.href = href;
    else link.removeAttribute("href");
  }

  function applyMallCenterProfile(center) {
    const name = String(center?.name || "").trim();
    if (!name || name.toLocaleLowerCase("tr-TR") === "avm merkezi") return;
    const eyebrow = document.querySelector("[data-avm-center-name]");
    if (eyebrow) eyebrow.textContent = name;
    const image = document.querySelector("[data-avm-center-hero]");
    const heroImage = safeImageUrl(center.hero_image_url);
    if (image && heroImage) {
      const fallbackImage = image.src;
      image.src = heroImage;
      image.alt = `${name} alışveriş merkezi`;
      image.addEventListener("error", () => {
        image.src = fallbackImage;
        image.alt = "AllonaHub AVM Dünyası alışveriş merkezi deneyimi";
      }, { once: true });
    }
    const location = [center.district, center.city].filter(Boolean).join(", ");
    const fullAddress = [center.address, center.district, center.city].filter(Boolean).join(", ");
    const website = safeHttpUrl(center.website_url);
    const phone = String(center.phone || "").trim();
    const phoneTarget = phone.replace(/[^+\d]/g, "");
    const details = document.querySelector("[data-avm-center-details]");
    const detailName = document.querySelector("[data-avm-center-detail-name]");
    const address = document.querySelector("[data-avm-center-address]");
    if (detailName) detailName.textContent = name;
    if (address) address.textContent = fullAddress;
    setCenterLink("[data-avm-center-phone]", phoneTarget ? `tel:${phoneTarget}` : "");
    setCenterLink("[data-avm-center-website]", website);
    const directionsQuery = [name, center.address, center.district, center.city].filter(Boolean).join(", ");
    setCenterLink("[data-avm-center-directions]", directionsQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsQuery)}`
      : "");
    if (details) details.hidden = !(fullAddress || phoneTarget || website);
    core.setMeta({
      title: `${name} | AllonaHub AVM Dünyası`,
      description: `${name}${location ? `, ${location}` : ""} mağaza, kampanya, etkinlik, yeme-içme, otopark rehberi, hizmet ve ziyaret planı.`,
      image: heroImage || undefined
    });
    let schema = document.querySelector("#avm-center-schema");
    if (!schema) {
      schema = document.createElement("script");
      schema.id = "avm-center-schema";
      schema.type = "application/ld+json";
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ShoppingCenter",
      name,
      url: website || window.location.href,
      image: heroImage || undefined,
      telephone: phone || undefined,
      address: {
        "@type": "PostalAddress",
        streetAddress: center.address || undefined,
        addressLocality: center.district || undefined,
        addressRegion: center.city || undefined,
        addressCountry: "TR"
      }
    });
  }

  function resolveMallCenter(db) {
    if (!mallCenterLookup) {
      mallCenterLookup = (async () => {
        try {
          const { data, error } = await db
            .from("mall_centers")
            .select("id,name,city,district,address,phone,website_url,hero_image_url,status")
            .eq("slug", mallSlug)
            .eq("status", "active")
            .maybeSingle();
          if (error) throw error;
          const center = { ...(data || {}), id: data?.id || "", error: null };
          if (center.id) applyMallCenterProfile(center);
          return center;
        } catch (error) {
          return { id: "", error };
        }
      })();
    }
    return mallCenterLookup;
  }

  async function loadCatalog() {
    if (isLocalPreview()) {
      items = [];
      setSource("Yerel önizlemede kurgusal katalog gösterilmez. Yayındaki içerik aktif Supabase AVM kayıtlarından yüklenir.", "info");
      renderFilterOptions();
      renderResults();
      renderPlan();
      renderPublicMetrics();
      return;
    }
    const db = client();
    if (!db) {
      items = [];
      catalogMetricsState = "error";
      setSource("Supabase istemcisi yüklenemedi; yayın öncesi SQL ve CDN bağlantısı kontrol edilmeli.", "error");
      renderFilterOptions();
      renderResults();
      renderPlan();
      renderPublicMetrics();
      return;
    }
    try {
      const mall = await resolveMallCenter(db);
      if (mall.error) throw mall.error;
      if (!mall.id) {
        items = [];
        catalogMetricsState = "error";
        setSource("AVM merkezi kaydı bulunamadı. Merkez kaydı admin tarafından doğrulanıp yayına alınmalı.", "error");
        renderFilterOptions();
        renderResults();
        renderPlan();
        renderPublicMetrics();
        return;
      }
      const { data, error } = await db
        .from("mall_directory_items")
        .select("id,public_id,floor_zone_id,item_type,title,category,floor_label,image_url,image_alt,terms_text,tags,description,estimated_minutes,touch_score,display_order,starts_at,ends_at,status")
        .eq("mall_id", mall.id)
        .eq("status", "active")
        .order("display_order", { ascending: true });
      if (error) throw error;
      const currentRows = (data || []).filter(isCurrentDirectoryItem);
      items = currentRows.map(normalizeRemoteItem);
      const linkedItem = items.find(matchesRequestedDirectoryItem);
      if (linkedItem && viewLabels[linkedItem.type]) currentView = linkedItem.type;
      catalogMetricsState = "ready";
      if (items.length) {
        setSource("Canlı Supabase katalog verisi gösteriliyor.", "success");
      } else {
        setSource("Supabase tablosunda şu anda yayında olan AVM kaydı bulunmuyor.", "info");
      }
    } catch (error) {
      items = [];
      catalogMetricsState = "error";
      setSource("AVM katalog tablosu henüz canlıya uygulanmamış. AVM deploy notundaki SQL çalıştırıldığında bu alan Supabase verisiyle beslenecek.", "error");
    }
    renderFilterOptions();
    renderResults();
    renderPlan();
    renderPublicMetrics();
    focusRequestedDirectoryItem();
  }

  async function loadZones() {
    if (isLocalPreview()) {
      zones = [];
      renderZones();
      renderPublicMetrics();
      return;
    }
    const db = client();
    if (!db) {
      zones = [];
      zoneMetricsReady = false;
      renderZones();
      renderPublicMetrics();
      return;
    }
    try {
      const mall = await resolveMallCenter(db);
      if (mall.error) throw mall.error;
      if (!mall.id) {
        zones = [];
        zoneMetricsReady = false;
        renderZones();
        renderPublicMetrics();
        return;
      }
      const { data, error } = await db
        .from("mall_floor_zones")
        .select("id,floor_map_id,public_id,title,floor_label,zone_type,route_hint,management_metric,description,map_x_percent,map_y_percent,map_width_percent,map_height_px,display_order,status")
        .eq("mall_id", mall.id)
        .eq("status", "active")
        .order("display_order", { ascending: true });
      if (error) throw error;
      zones = (data || []).map(normalizeRemoteZone);
      zoneMetricsReady = true;
    } catch (error) {
      zones = [];
      zoneMetricsReady = false;
    }
    renderZones();
    renderPublicMetrics();
  }

  async function loadFloorMaps() {
    if (isLocalPreview()) {
      floorMaps = [];
      activeFloorMapId = "";
      renderZones();
      renderPublicMetrics();
      return;
    }
    const db = client();
    if (!db) {
      floorMaps = [];
      activeFloorMapId = "";
      floorMapMetricsReady = false;
      renderZones();
      renderPublicMetrics();
      return;
    }
    try {
      const mall = await resolveMallCenter(db);
      if (mall.error) throw mall.error;
      if (!mall.id) {
        floorMaps = [];
        activeFloorMapId = "";
        floorMapMetricsReady = false;
        renderZones();
        renderPublicMetrics();
        return;
      }
      const { data, error } = await db
        .from("mall_floor_maps")
        .select("id,public_id,title,floor_label,image_url,image_alt,native_width_px,native_height_px,display_order,status")
        .eq("mall_id", mall.id)
        .eq("status", "active")
        .order("display_order", { ascending: true });
      if (error) throw error;
      floorMaps = (data || []).map(normalizeRemoteFloorMap);
      if (!floorMaps.some((map) => map.record_id === activeFloorMapId)) {
        activeFloorMapId = floorMaps[0]?.record_id || "";
      }
      floorMapMetricsReady = true;
    } catch (error) {
      floorMaps = [];
      activeFloorMapId = "";
      floorMapMetricsReady = false;
    }
    renderZones();
    renderPublicMetrics();
  }

  async function loadServices() {
    if (isLocalPreview()) {
      services = [];
      setServiceSource("Canlı hizmet envanteri yalnızca Supabase mall_services kayıtlarından yayınlanır.", "info");
      renderServiceFilterOptions();
      renderServices();
      return;
    }
    const db = client();
    if (!db) {
      services = [];
      setServiceSource("Hizmet verisi yüklenemedi. Supabase istemcisi ve AVM hizmet migration adımı kontrol edilmeli.", "error");
      renderServiceFilterOptions();
      renderServices();
      return;
    }
    try {
      const mall = await resolveMallCenter(db);
      if (mall.error) throw mall.error;
      if (!mall.id) throw new Error("AVM merkezi kaydı bulunamadı.");
      const { data, error } = await db
        .from("mall_services")
        .select("id,mall_id,floor_zone_id,public_id,title,category,description,floor_label,route_hint,operating_hours,availability_status,availability_note,is_accessibility_service,display_order,status")
        .eq("mall_id", mall.id)
        .eq("status", "active")
        .order("display_order", { ascending: true });
      if (error) throw error;
      services = (data || []).map(normalizeRemoteService);
      setServiceSource(
        services.length ? "Güncel Supabase hizmet envanteri gösteriliyor." : "Yayında ziyaretçi hizmeti bulunmuyor.",
        services.length ? "success" : "info"
      );
    } catch (error) {
      services = [];
      setServiceSource("AVM hizmet tablosu henüz canlıya uygulanmamış. Deploy notundaki mall_services migration adımı tamamlanmalı.", "error");
    }
    renderServiceFilterOptions();
    renderServices();
  }

  function setTransportSource(message, type) {
    const node = document.querySelector("[data-avm-transport-source]");
    if (!node) return;
    node.textContent = message;
    node.dataset.status = type || "info";
  }

  function renderTransportFilterOptions() {
    const select = document.querySelector("[data-avm-transport-mode]");
    if (!select) return;
    const selected = select.value;
    const modes = [...new Set(transportRoutes.map((route) => route.mode).filter(Boolean))];
    select.innerHTML = `<option value="">Tüm seçenekler</option>${modes.map((mode) => `<option value="${core.escapeHTML(mode)}">${core.escapeHTML(transportModeLabels[mode] || mode)}</option>`).join("")}`;
    if (modes.includes(selected)) select.value = selected;
  }

  function renderTransportRoutes() {
    const target = document.querySelector("[data-avm-transport-routes]");
    const count = document.querySelector("[data-avm-transport-count]");
    if (!target) return;
    const mode = document.querySelector("[data-avm-transport-mode]")?.value || "";
    const status = document.querySelector("[data-avm-transport-status]")?.value || "";
    const visible = transportRoutes.filter((route) => (!mode || route.mode === mode) && (!status || route.service_status === status));
    if (count) count.textContent = `${visible.length} ulaşım seçeneği gösteriliyor.`;
    target.innerHTML = visible.length
      ? visible.map((route) => `
        <article class="avm-transport-card">
          <div class="avm-directory-card__top">
            <span class="pill">${core.escapeHTML(transportModeLabels[route.mode] || route.mode)}</span>
            <span class="pill ${route.service_status === "operating" ? "pill--gold" : ""}">${core.escapeHTML(transportStatusLabels[route.service_status] || route.service_status)}</span>
          </div>
          <div>
            <h3>${core.escapeHTML(route.title)}</h3>
            <p>${core.escapeHTML(route.origin)} → ${core.escapeHTML(route.destination)}</p>
          </div>
          <div class="avm-transport-card__facts">
            ${route.route_number ? `<div><span>Hat</span><strong>${core.escapeHTML(route.route_number)}</strong></div>` : ""}
            ${route.stop ? `<div><span>Durak</span><strong>${core.escapeHTML(route.stop)}</strong></div>` : ""}
            ${route.duration ? `<div><span>Süre</span><strong>${core.escapeHTML(route.duration)}</strong></div>` : ""}
          </div>
          <p><strong>Sefer:</strong> ${core.escapeHTML(route.schedule)}</p>
          ${route.fare ? `<p><strong>Ücret:</strong> ${core.escapeHTML(route.fare)}</p>` : ""}
          ${route.accessibility ? `<p><strong>Erişilebilirlik:</strong> ${core.escapeHTML(route.accessibility)}</p>` : ""}
          <p>${core.escapeHTML(route.directions)}</p>
          ${route.directions_url ? `<div class="avm-directory-card__actions"><a class="btn" href="${core.escapeHTML(route.directions_url)}" target="_blank" rel="noopener">Canlı Rotayı Aç</a></div>` : ""}
        </article>
      `).join("")
      : '<div class="empty-state">Bu filtrelerle eşleşen yayındaki ulaşım rotası bulunmuyor.</div>';
  }

  async function loadTransportRoutes() {
    if (isLocalPreview()) {
      transportRoutes = [];
      setTransportSource("Canlı ulaşım rehberi yalnızca Supabase mall_transport_routes kayıtlarından yayınlanır.", "info");
      renderTransportFilterOptions();
      renderTransportRoutes();
      return;
    }
    const db = client();
    if (!db) {
      transportRoutes = [];
      setTransportSource("Ulaşım verisi yüklenemedi. Supabase istemcisi ve ulaşım migration adımı kontrol edilmeli.", "error");
      renderTransportFilterOptions();
      renderTransportRoutes();
      return;
    }
    try {
      const mall = await resolveMallCenter(db);
      if (mall.error) throw mall.error;
      if (!mall.id) throw new Error("AVM merkezi kaydı bulunamadı.");
      const { data, error } = await db
        .from("mall_transport_routes")
        .select("id,public_id,mode,title,origin_label,destination_label,stop_name,route_number,schedule_text,duration_text,fare_text,accessibility_text,directions_text,directions_url,service_status,display_order,status")
        .eq("mall_id", mall.id)
        .eq("status", "active")
        .order("display_order", { ascending: true });
      if (error) throw error;
      transportRoutes = (data || []).map(normalizeRemoteTransportRoute);
      setTransportSource(transportRoutes.length ? "Güncel Supabase ulaşım rehberi gösteriliyor." : "Yayında ulaşım rotası bulunmuyor.", transportRoutes.length ? "success" : "info");
    } catch (error) {
      transportRoutes = [];
      setTransportSource("Ulaşım rotası verisi henüz canlıya uygulanmamış. Deploy notundaki mall_transport_routes migration adımı tamamlanmalı.", "error");
    }
    renderTransportFilterOptions();
    renderTransportRoutes();
  }

  function renderOperationalNotices() {
    const section = document.querySelector("[data-avm-notices]");
    const target = document.querySelector("[data-avm-notice-list]");
    if (!section || !target) return;
    section.hidden = !operationalNotices.length;
    target.innerHTML = operationalNotices.map((notice) => {
      const end = new Date(notice.ends_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });
      const ctaUrl = safeHttpUrl(notice.cta_url);
      return `
        <article class="avm-notice avm-notice--${core.escapeHTML(notice.severity)}">
          <div class="avm-notice__meta">
            <span class="pill">${core.escapeHTML(noticeTypeLabels[notice.notice_type] || notice.notice_type)}</span>
            <span class="pill">${core.escapeHTML(noticeSeverityLabels[notice.severity] || notice.severity)}</span>
            <span>${core.escapeHTML(`Geçerlilik: ${end}'e kadar`)}</span>
          </div>
          <div>
            <h3>${core.escapeHTML(notice.title)}</h3>
            <p>${core.escapeHTML(notice.summary)}</p>
            ${notice.affected_area ? `<p><strong>Etkilenen alan:</strong> ${core.escapeHTML(notice.affected_area)}</p>` : ""}
          </div>
          ${ctaUrl && notice.cta_label ? `<a class="btn btn--light" href="${core.escapeHTML(ctaUrl)}" target="_blank" rel="noopener">${core.escapeHTML(notice.cta_label)}</a>` : ""}
        </article>
      `;
    }).join("");
  }

  async function loadOperationalNotices() {
    if (isLocalPreview()) {
      operationalNotices = [];
      renderOperationalNotices();
      return;
    }
    const db = client();
    if (!db) {
      operationalNotices = [];
      renderOperationalNotices();
      return;
    }
    try {
      const mall = await resolveMallCenter(db);
      if (mall.error) throw mall.error;
      if (!mall.id) throw new Error("AVM merkezi kaydı bulunamadı.");
      const now = new Date().toISOString();
      const { data, error } = await db
        .from("mall_operational_notices")
        .select("id,public_id,notice_type,severity,title,summary,affected_area,starts_at,ends_at,cta_label,cta_url,display_order,status")
        .eq("mall_id", mall.id)
        .eq("status", "active")
        .lte("starts_at", now)
        .gte("ends_at", now)
        .order("display_order", { ascending: true });
      if (error) throw error;
      operationalNotices = data || [];
    } catch (error) {
      operationalNotices = [];
    }
    renderOperationalNotices();
  }

  function setParkingSource(message, type) {
    const node = document.querySelector("[data-avm-parking-source]");
    if (!node) return;
    node.textContent = message;
    node.dataset.status = type || "info";
  }

  function parkingAvailabilityView(area) {
    const statusLabel = parkingAvailabilityLabels[area.availability_status] || area.availability_status;
    if (area.availability_status === "unknown") {
      return { fresh: false, label: statusLabel, detail: "Zaman damgalı doluluk bilgisi yayınlanmıyor." };
    }
    const updatedAt = new Date(area.availability_updated_at || "").getTime();
    const age = Date.now() - updatedAt;
    const fresh = Number.isFinite(updatedAt) && age >= -(5 * 60 * 1000) && age <= parkingAvailabilityFreshMs;
    const timeLabel = Number.isFinite(updatedAt)
      ? new Date(updatedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" })
      : "doğrulanamadı";
    if (!fresh) {
      return { fresh: false, label: "Doluluk güncel değil", detail: `Son doğrulama: ${timeLabel}.` };
    }
    const count = area.spaces_available === null ? "" : ` · ${area.spaces_available} boş alan`;
    return { fresh: true, label: `${statusLabel}${count}`, detail: `Güncellendi: ${timeLabel}.` };
  }

  function parkingHoursLabel(area) {
    const profile = hoursProfiles.find((row) => row.id === area.hours_profile_id);
    if (!profile || !weeklyHoursRows.some((row) => row.profile_id === profile.id)) {
      return "Çalışma saati yükleniyor";
    }
    const status = openingStatus(profile);
    return `${status.isOpen ? "Açık" : "Kapalı"} · ${status.todayHours}`;
  }

  function parkingAreaCard(area) {
    const availability = parkingAvailabilityView(area);
    const features = [
      area.accessible_spaces ? `${area.accessible_spaces} erişilebilir` : "",
      area.family_spaces ? `${area.family_spaces} aile` : "",
      area.ev_charging_spaces ? `${area.ev_charging_spaces} EV şarj` : "",
      area.motorcycle_spaces ? `${area.motorcycle_spaces} motosiklet` : ""
    ].filter(Boolean);
    return `
      <article class="avm-parking-card" data-avm-parking-area="${core.escapeHTML(area.id)}">
        <div class="avm-directory-card__top">
          <span class="pill ${availability.fresh && area.availability_status === "available" ? "pill--gold" : ""}">${core.escapeHTML(availability.label)}</span>
          <span class="pill">${core.escapeHTML(area.level_label)}</span>
        </div>
        <div>
          <h3>${core.escapeHTML(area.title)}</h3>
          <p>${core.escapeHTML(area.entrance_label)}</p>
        </div>
        <div class="avm-parking-card__metrics">
          <div><span>Kapasite</span><strong>${area.capacity_total}</strong></div>
          <div><span>Bugün</span><strong>${core.escapeHTML(parkingHoursLabel(area))}</strong></div>
          ${area.max_height_m ? `<div><span>Azami yükseklik</span><strong>${core.escapeHTML(area.max_height_m)} m</strong></div>` : ""}
        </div>
        ${features.length ? `<div class="avm-parking-card__features">${features.map((feature) => `<span>${core.escapeHTML(feature)}</span>`).join("")}</div>` : ""}
        <p class="avm-parking-card__freshness">${core.escapeHTML(availability.detail)}</p>
        <p><strong>Ücret:</strong> ${core.escapeHTML(area.pricing_text)}</p>
        ${area.best_for ? `<p><strong>Yakın hedefler:</strong> ${core.escapeHTML(area.best_for)}</p>` : ""}
        <p>${core.escapeHTML(area.directions_text)}</p>
        <div class="avm-directory-card__actions">
          <button class="btn btn--light" type="button" data-avm-parking-route="${core.escapeHTML(area.id)}">Haritada Göster</button>
          ${area.directions_url ? `<a class="btn" href="${core.escapeHTML(area.directions_url)}" target="_blank" rel="noopener">Araç Girişine Rota</a>` : ""}
        </div>
      </article>
    `;
  }

  function renderParkingLocationOptions() {
    const select = document.querySelector("[data-avm-parking-location-area]");
    if (!select) return;
    const selected = select.value || savedParkingLocation?.parking_area_id || "";
    select.innerHTML = `<option value="">Alan seçin</option>${parkingAreas.map((area) => `<option value="${core.escapeHTML(area.record_id)}">${core.escapeHTML(`${area.title} · ${area.level_label}`)}</option>`).join("")}`;
    if (parkingAreas.some((area) => area.record_id === selected)) select.value = selected;
  }

  function renderSavedParkingLocation() {
    const target = document.querySelector("[data-avm-parking-location-saved]");
    if (!target) return;
    if (!savedParkingLocation) {
      target.innerHTML = '<p class="muted">Kayıtlı park konumu yok.</p>';
      return;
    }
    if (!parkingAreasReady) {
      target.innerHTML = '<p class="muted">Kayıtlı park konumu doğrulanıyor.</p>';
      return;
    }
    const area = parkingAreas.find((row) => row.record_id === savedParkingLocation.parking_area_id);
    if (!area) {
      target.innerHTML = `
        <div class="status-box status-box--error">Kayıtlı otopark alanı artık yayında değil.</div>
        <button class="btn btn--light btn--full" type="button" data-avm-parking-location-clear>Kaydı Sil</button>
      `;
      return;
    }
    const savedAt = new Date(savedParkingLocation.saved_at);
    target.innerHTML = `
      <div class="avm-parking-saved">
        <div class="summary-line"><span>Alan</span><strong>${core.escapeHTML(area.title)} · ${core.escapeHTML(area.level_label)}</strong></div>
        <div class="summary-line"><span>Yer kodu</span><strong>${core.escapeHTML(savedParkingLocation.marker)}</strong></div>
        ${savedParkingLocation.note ? `<div class="summary-line"><span>Not</span><strong>${core.escapeHTML(savedParkingLocation.note)}</strong></div>` : ""}
        <p class="muted">${savedAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" })} tarihinde kaydedildi.</p>
        <div class="avm-parking-saved__actions">
          <button class="btn" type="button" data-avm-parking-location-show="${core.escapeHTML(area.id)}">Haritada Göster</button>
          <button class="btn btn--light" type="button" data-avm-parking-location-clear>Kaydı Sil</button>
        </div>
      </div>
    `;
  }

  function renderParkingAreas() {
    const target = document.querySelector("[data-avm-parking-areas]");
    if (!target) return;
    target.innerHTML = parkingAreas.length
      ? parkingAreas.map(parkingAreaCard).join("")
      : '<div class="empty-state">Yayında doğrulanmış otopark alanı bulunmuyor.</div>';
    renderParkingLocationOptions();
    renderSavedParkingLocation();
  }

  async function loadParkingAreas() {
    if (isLocalPreview()) {
      parkingAreas = [];
      parkingAreasReady = true;
      setParkingSource("Canlı otopark envanteri yalnızca Supabase mall_parking_areas kayıtlarından yayınlanır.", "info");
      renderParkingAreas();
      return;
    }
    const db = client();
    if (!db) {
      parkingAreas = [];
      parkingAreasReady = true;
      setParkingSource("Otopark verisi yüklenemedi. Supabase istemcisi ve otopark migration adımı kontrol edilmeli.", "error");
      renderParkingAreas();
      return;
    }
    try {
      const mall = await resolveMallCenter(db);
      if (mall.error) throw mall.error;
      if (!mall.id) throw new Error("AVM merkezi kaydı bulunamadı.");
      const { data, error } = await db
        .from("mall_parking_areas")
        .select("id,mall_id,floor_zone_id,hours_profile_id,public_id,title,level_label,entrance_label,directions_text,directions_url,capacity_total,accessible_spaces,family_spaces,ev_charging_spaces,motorcycle_spaces,max_height_m,pricing_text,best_for,availability_status,spaces_available,availability_updated_at,display_order,status")
        .eq("mall_id", mall.id)
        .eq("status", "active")
        .order("display_order", { ascending: true });
      if (error) throw error;
      parkingAreas = (data || []).map(normalizeRemoteParkingArea);
      parkingAreasReady = true;
      setParkingSource(
        parkingAreas.length ? "Güncel Supabase otopark envanteri gösteriliyor." : "Yayında otopark alanı bulunmuyor.",
        parkingAreas.length ? "success" : "info"
      );
    } catch (error) {
      parkingAreas = [];
      parkingAreasReady = true;
      setParkingSource("Otopark alanı verisi henüz canlıya uygulanmamış. Deploy notundaki mall_parking_areas migration adımı tamamlanmalı.", "error");
    }
    renderParkingAreas();
  }

  function setSource(message, type) {
    const node = document.querySelector("[data-avm-source]");
    if (!node) return;
    node.textContent = message;
    node.dataset.status = type || "info";
  }

  function setServiceSource(message, type) {
    const node = document.querySelector("[data-avm-service-source]");
    if (!node) return;
    node.textContent = message;
    node.dataset.status = type || "info";
  }

  function typedItems(type) {
    return items.filter((item) => item.type === type);
  }

  function renderPublicMetrics() {
    const catalogReady = catalogMetricsState === "ready";
    const values = {
      stores: catalogReady ? typedItems("stores").length : "-",
      deals: catalogReady ? typedItems("deals").length : "-",
      events: catalogReady ? typedItems("events").length : "-",
      dining: catalogReady ? typedItems("dining").length : "-",
      zones: zoneMetricsReady ? zones.length : "-",
      "floor-map": floorMapMetricsReady ? (floorMaps.some((map) => map.image_url) ? `${floorMaps.length} kat` : "Yok") : "-"
    };
    document.querySelectorAll("[data-avm-live-metric]").forEach((node) => {
      node.textContent = values[node.dataset.avmLiveMetric] ?? "-";
    });
    const heroValue = document.querySelector("[data-avm-live-score]");
    const heroLabel = document.querySelector("[data-avm-live-score-label]");
    if (heroValue) heroValue.textContent = catalogReady ? String(items.length) : "-";
    if (heroLabel) {
      heroLabel.textContent = catalogMetricsState === "ready"
        ? (items.length ? "Yayındaki güncel katalog kaydı" : "Yayında katalog kaydı bulunmuyor")
        : catalogMetricsState === "preview"
          ? "Canlı yayın verisi yerel önizlemede gösterilmez"
          : catalogMetricsState === "error"
            ? "Canlı katalog verisi doğrulanamadı"
            : "Canlı katalog verisi yükleniyor";
    }
  }

  function renderServiceFilterOptions() {
    const select = document.querySelector("[data-avm-service-category]");
    if (!select) return;
    const selected = select.value;
    const categories = [...new Set(services.map((service) => service.category).filter(Boolean))];
    select.innerHTML = `<option value="">Tüm hizmetler</option>${categories.map((category) => `<option value="${core.escapeHTML(category)}">${core.escapeHTML(serviceCategoryLabels[category] || category)}</option>`).join("")}`;
    if (categories.includes(selected)) select.value = selected;
  }

  function serviceFilters() {
    return {
      q: String(document.querySelector("[data-avm-service-search]")?.value || "").trim().toLocaleLowerCase("tr-TR"),
      category: String(document.querySelector("[data-avm-service-category]")?.value || ""),
      availability: String(document.querySelector("[data-avm-service-availability]")?.value || "")
    };
  }

  function filteredServices() {
    const active = serviceFilters();
    return services.filter((service) => {
      const haystack = `${service.title} ${service.description} ${service.floor} ${service.route} ${service.operating_hours}`.toLocaleLowerCase("tr-TR");
      return (!active.q || haystack.includes(active.q))
        && (!active.category || service.category === active.category)
        && (!active.availability || service.availability === active.availability);
    });
  }

  function serviceCard(service) {
    const availability = serviceAvailabilityLabels[service.availability] || service.availability;
    const canRoute = service.floor_zone_id || service.route;
    return `
      <article class="avm-service-card">
        <div class="avm-directory-card__top">
          <span class="pill ${service.availability === "available" ? "pill--gold" : ""}">${core.escapeHTML(availability)}</span>
          <span class="pill">${core.escapeHTML(serviceCategoryLabels[service.category] || service.category)}</span>
        </div>
        <strong>${core.escapeHTML(service.title)}</strong>
        <p>${core.escapeHTML(service.description)}</p>
        <div class="avm-directory-card__meta">
          <span>${core.escapeHTML(service.floor)}</span>
          ${service.operating_hours ? `<span>${core.escapeHTML(service.operating_hours)}</span>` : ""}
          ${service.accessible ? `<span>Erişilebilir hizmet</span>` : ""}
        </div>
        ${service.availability_note ? `<p class="avm-service-card__notice"><span>Güncel bilgi:</span> ${core.escapeHTML(service.availability_note)}</p>` : ""}
        ${canRoute ? `<div class="avm-directory-card__actions"><button class="btn btn--light" type="button" data-avm-service-route="${core.escapeHTML(service.id)}">Haritada Göster</button></div>` : ""}
      </article>
    `;
  }

  function renderServices() {
    const target = document.querySelector("[data-avm-services]");
    const count = document.querySelector("[data-avm-service-count]");
    if (!target) return;
    const visible = filteredServices();
    target.innerHTML = visible.length
      ? visible.map(serviceCard).join("")
      : `<div class="empty-state">Bu filtrelerle eşleşen yayındaki ziyaretçi hizmeti bulunmuyor.</div>`;
    if (count) count.textContent = `${visible.length} güncel hizmet gösteriliyor.`;
  }

  async function linkedZoneByRecordId(floorZoneId) {
    if (!floorZoneId) return null;
    let linkedZone = zones.find((zone) => zone.record_id === floorZoneId);
    if (!linkedZone && !isLocalPreview()) {
      await loadZones();
      linkedZone = zones.find((zone) => zone.record_id === floorZoneId);
    }
    return linkedZone || null;
  }

  async function showItemRoute(id) {
    const item = findItem(id);
    if (!item) return;
    recordDirectoryInteraction(item, "route_open");
    const linkedZone = await linkedZoneByRecordId(item.floor_zone_id);
    if (linkedZone && selectZone(linkedZone.id)) {
    } else {
      const title = document.querySelector("[data-avm-zone-title]");
      const copy = document.querySelector("[data-avm-zone-copy]");
      const route = document.querySelector("[data-avm-zone-route]");
      const metric = document.querySelector("[data-avm-zone-metric]");
      if (title) title.textContent = item.title;
      if (copy) copy.textContent = item.detail;
      if (route) route.textContent = item.floor;
      if (metric) metric.textContent = viewLabels[item.type] || item.type;
    }
    document.querySelector("#avm-wayfinding")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function showServiceRoute(id) {
    const service = services.find((item) => item.id === id);
    if (!service) return;
    const linkedZone = await linkedZoneByRecordId(service.floor_zone_id);
    if (linkedZone && selectZone(linkedZone.id)) {
    } else {
      const title = document.querySelector("[data-avm-zone-title]");
      const copy = document.querySelector("[data-avm-zone-copy]");
      const route = document.querySelector("[data-avm-zone-route]");
      const metric = document.querySelector("[data-avm-zone-metric]");
      if (title) title.textContent = service.title;
      if (copy) copy.textContent = service.description;
      if (route) route.textContent = service.route || service.floor;
      if (metric) metric.textContent = serviceAvailabilityLabels[service.availability] || service.availability;
    }
    document.querySelector("#avm-wayfinding")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function showParkingAreaRoute(id) {
    const area = parkingAreas.find((item) => item.id === id || item.record_id === id);
    if (!area) return;
    const linkedZone = await linkedZoneByRecordId(area.floor_zone_id);
    if (linkedZone && selectZone(linkedZone.id)) {
    } else {
      const title = document.querySelector("[data-avm-zone-title]");
      const copy = document.querySelector("[data-avm-zone-copy]");
      const route = document.querySelector("[data-avm-zone-route]");
      const metric = document.querySelector("[data-avm-zone-metric]");
      if (title) title.textContent = `${area.title} · ${area.level_label}`;
      if (copy) copy.textContent = area.directions_text;
      if (route) route.textContent = area.entrance_label;
      if (metric) metric.textContent = `${area.capacity_total} araç kapasitesi`;
    }
    document.querySelector("#avm-wayfinding")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function allItems() {
    return [...items];
  }

  function optionsFor(key) {
    return [...new Set(typedItems(currentView).map((item) => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  }

  function renderFilterOptions() {
    const category = document.querySelector("[data-avm-category]");
    const floor = document.querySelector("[data-avm-floor]");
    if (category) {
      category.innerHTML = `<option value="">Tüm kategoriler</option>${optionsFor("category").map((item) => `<option value="${core.escapeHTML(item)}">${core.escapeHTML(item)}</option>`).join("")}`;
    }
    if (floor) {
      floor.innerHTML = `<option value="">Tüm kat ve bölgeler</option>${optionsFor("floor").map((item) => `<option value="${core.escapeHTML(item)}">${core.escapeHTML(item)}</option>`).join("")}`;
    }
  }

  function filters() {
    return {
      q: String(document.querySelector("[data-avm-search]")?.value || "").trim().toLocaleLowerCase("tr-TR"),
      category: String(document.querySelector("[data-avm-category]")?.value || ""),
      floor: String(document.querySelector("[data-avm-floor]")?.value || ""),
      priority: String(document.querySelector("[data-avm-priority]")?.value || "")
    };
  }

  function filteredItems() {
    const active = filters();
    const now = new Date();
    return typedItems(currentView).filter((item) => {
      const haystack = `${item.title} ${item.category} ${item.floor} ${item.detail}`.toLocaleLowerCase("tr-TR");
      const qOk = !active.q || haystack.includes(active.q);
      const categoryOk = !active.category || item.category === active.category;
      const floorOk = !active.floor || item.floor === active.floor;
      const priorityOk = !active.priority
        || (active.priority === "open_now"
          ? Boolean(itemOpeningStatus(item, now)?.isOpen)
          : active.priority === "saved"
            ? directoryFavorites.has(item.id)
            : item.tags.includes(active.priority));
      return qOk && categoryOk && floorOk && priorityOk;
    });
  }

  function matchesRequestedDirectoryItem(item) {
    return Boolean(requestedDirectoryItemId)
      && [item.record_id, item.public_id, item.id].filter(Boolean).some((value) => String(value) === requestedDirectoryItemId);
  }

  function card(item) {
    const tagLabel = item.tags.includes("today") ? "Bugün aktif" : item.tags.includes("featured") ? "Öne çıkan" : item.tags.includes("family") ? "Aile dostu" : viewLabels[currentView];
    const isSaved = savedRedemptions.has(item.id);
    const campaignAction = item.type === "deals" && item.record_id
      ? `<button class="btn" type="button" data-avm-redemption="${core.escapeHTML(item.id)}" ${isSaved ? "disabled" : ""}>${isSaved ? "İlgi Kaydedildi" : "İlgileniyorum"}</button>`
      : "";
    const routeAction = item.floor_zone_id
      ? `<button class="btn btn--light" type="button" data-avm-item-route="${core.escapeHTML(item.id)}">Haritada Göster</button>`
      : "";
    const detailAction = `<a class="btn btn--light" href="avm-detay.html?item=${encodeURIComponent(item.public_id)}">Detayı Aç</a>`;
    const favoriteAction = `<button class="btn ${directoryFavorites.has(item.id) ? "btn--gold" : "btn--light"}" type="button" data-avm-favorite="${core.escapeHTML(item.id)}" aria-pressed="${directoryFavorites.has(item.id)}">${directoryFavorites.has(item.id) ? "Kaydedildi" : "Kaydet"}</button>`;
    const imageUrl = safeImageUrl(item.image_url);
    const hours = itemOpeningStatus(item);
    return `
      <article class="avm-directory-card${matchesRequestedDirectoryItem(item) ? " is-linked" : ""}" data-avm-directory-item="${core.escapeHTML(String(item.record_id || item.id))}" tabindex="-1">
        ${imageUrl ? `
          <div class="avm-directory-card__media">
            <img data-avm-directory-image src="${core.escapeHTML(imageUrl)}" alt="${core.escapeHTML(item.image_alt || item.title)}" loading="lazy">
          </div>
        ` : ""}
        <div class="avm-directory-card__top">
          <span class="pill pill--gold">${core.escapeHTML(tagLabel)}</span>
          <span class="pill">${core.escapeHTML(item.floor)}</span>
        </div>
        <h3>${core.escapeHTML(item.title)}</h3>
        <p>${core.escapeHTML(item.detail)}</p>
        <div class="avm-directory-card__meta">
          <span>${core.escapeHTML(item.category)}</span>
          <span>${item.time} dk</span>
          <span>${item.touch} temas</span>
          ${hours ? `<span class="avm-hours-inline ${hours.isOpen ? "is-open" : "is-closed"}">${core.escapeHTML(hours.shortLabel)}</span>` : ""}
        </div>
        <div class="avm-directory-card__actions avm-directory-card__actions--split">
          <button class="btn btn--light" type="button" data-avm-add="${core.escapeHTML(item.id)}">Rotaya Ekle</button>
          ${detailAction}
          ${favoriteAction}
          ${routeAction}
          ${campaignAction}
        </div>
      </article>
    `;
  }

  function renderResults() {
    const target = document.querySelector("[data-avm-results]");
    const count = document.querySelector("[data-avm-count]");
    if (!target) return;
    syncOpenNowFilter();
    const visibleItems = filteredItems();
    target.innerHTML = visibleItems.length
      ? visibleItems.map(card).join("")
      : `<div class="empty-state">Bu filtrelerle eşleşen ${core.escapeHTML(viewLabels[currentView].toLocaleLowerCase("tr-TR"))} bulunamadı.</div>`;
    if (count) {
      count.textContent = `${viewLabels[currentView]} içinde ${visibleItems.length} sonuç gösteriliyor.`;
    }
    document.querySelectorAll("[data-avm-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.avmView === currentView);
    });
  }

  function focusRequestedDirectoryItem() {
    if (!requestedDirectoryItemId || directoryLinkFocused) return;
    const item = items.find(matchesRequestedDirectoryItem);
    if (!item) return;
    directoryLinkFocused = true;
    window.requestAnimationFrame(() => {
      const target = [...document.querySelectorAll("[data-avm-directory-item]")]
        .find((node) => node.dataset.avmDirectoryItem === String(item.record_id || item.id));
      if (!target) return;
      target.focus({ preventScroll: true });
      if (requestedDirectoryRoute) showItemRoute(item.id);
      else target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function setView(view) {
    currentView = viewLabels[view] ? view : "stores";
    if (window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", currentView);
      url.searchParams.delete("item");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    renderFilterOptions();
    renderResults();
  }

  function normalizePlan() {
    const byId = new Map(allItems().map((item) => [item.id, item]));
    plan = plan.map((id) => byId.get(id)).filter(Boolean).map((item) => item.id);
    writePlan();
  }

  function renderPlan() {
    normalizePlan();
    const list = document.querySelector("[data-avm-plan-list]");
    const count = document.querySelector("[data-avm-plan-count]");
    const time = document.querySelector("[data-avm-plan-time]");
    const touch = document.querySelector("[data-avm-plan-touch]");
    const selected = plan.map((id) => allItems().find((item) => item.id === id)).filter(Boolean);
    if (list) {
      list.innerHTML = selected.length
        ? selected.map((item, index) => `
          <div class="avm-plan-item">
            <span>${index + 1}</span>
            <div>
              <strong>${core.escapeHTML(item.title)}</strong>
              <small>${core.escapeHTML(viewLabels[item.type])} • ${core.escapeHTML(item.floor)} • ${item.time} dk</small>
            </div>
            <button class="icon-btn" type="button" data-avm-remove="${core.escapeHTML(item.id)}" aria-label="Rotadan çıkar">×</button>
          </div>
        `).join("")
        : `<div class="empty-state">Henüz rota oluşturulmadı. Mağaza, etkinlik, kampanya veya yeme-içme kartlarından rotaya ekleyin.</div>`;
    }
    if (count) count.textContent = selected.length;
    if (time) time.textContent = `${selected.reduce((sum, item) => sum + item.time, 0)} dk`;
    if (touch) touch.textContent = selected.reduce((sum, item) => sum + item.touch, 0);
  }

  function selectedPlanItems() {
    return plan.map((id) => allItems().find((item) => item.id === id)).filter(Boolean);
  }

  function findItem(id) {
    return allItems().find((item) => item.id === id);
  }

  function planStatus(message, type) {
    const status = document.querySelector("[data-avm-plan-save-status]");
    if (!status) return;
    const statusType = type === "success" ? "success" : "error";
    status.innerHTML = `<div class="status-box status-box--${statusType}">${core.escapeHTML(message)}</div>`;
  }

  async function saveVisitPlan(form) {
    const selected = selectedPlanItems();
    if (!selected.length) {
      planStatus("Önce mağaza, etkinlik, kampanya veya yeme-içme kartlarından en az bir durak ekleyin.", "error");
      return;
    }
    const db = client();
    if (!db) {
      planStatus("Supabase istemcisi yüklenemedi. Canlı kayıt için AVM SQL kurulumu ve SDK bağlantısı gerekli.", "error");
      return;
    }
    try {
      const mall = await resolveMallCenter(db);
      if (mall.error) throw mall.error;
      if (!mall.id) throw new Error("AVM merkezi kaydı bulunamadı. Merkez kaydı admin tarafından doğrulanıp yayına alınmalı.");
      const values = core.parseForm(form);
      const payload = {
        mall_id: mall.id,
        contact_email: values.contact_email || null,
        visitor_note: values.visitor_note || null,
        selected_item_ids: selected.map((item) => item.id),
        selected_item_titles: selected.map((item) => item.title),
        total_stops: selected.length,
        total_minutes: selected.reduce((sum, item) => sum + item.time, 0),
        total_touch_score: selected.reduce((sum, item) => sum + item.touch, 0),
        source_page: "avm-dunyasi",
        status: "new"
      };
      const { error } = await db.from("mall_visit_plans").insert(payload);
      if (error) throw error;
      planStatus("Ziyaret planı Supabase AVM yönetim özetine kaydedildi.", "success");
      form.reset();
    } catch (error) {
      planStatus(`Ziyaret planı kaydedilemedi. AVM deploy notundaki ziyaret planı SQL'i uygulanmalı: ${error.message || "Supabase kayıt hatası"}`, "error");
    }
  }

  function addToPlan(id) {
    if (!plan.includes(id)) {
      plan.push(id);
      writePlan();
      renderPlan();
      recordDirectoryInteraction(findItem(id), "plan_add");
      core.toast("AVM rotasına eklendi.");
    } else {
      core.toast("Bu durak rotada zaten var.");
    }
  }

  function buildFamilyRoute() {
    const familyStops = allItems()
      .filter((item) => item.tags.includes("family"))
      .sort((left, right) => left.display_order - right.display_order)
      .slice(0, 4);
    if (!familyStops.length) {
      core.toast("Yayında aile rotasına uygun durak bulunmuyor.", "error");
      return;
    }
    plan = familyStops.map((item) => item.id);
    writePlan();
    renderPlan();
    familyStops.forEach((item) => recordDirectoryInteraction(item, "plan_add"));
    core.toast("Aile rotası oluşturuldu.");
  }

  async function saveCampaignRedemption(id, button) {
    const item = findItem(id);
    if (!item || item.type !== "deals") {
      core.toast("Kampanya kaydı bulunamadı.", "error");
      return;
    }
    if (!item.record_id) {
      core.toast("Kampanya henüz canlı AVM katalog kaydına bağlı değil.", "error");
      return;
    }
    if (savedRedemptions.has(item.id)) {
      core.toast("Bu kampanyaya ilginiz bu oturumda zaten kaydedildi.");
      return;
    }
    if (isLocalPreview()) {
      core.toast("Canlı kampanya kaydı için Supabase kampanya ilgi SQL'i uygulanmalı.", "error");
      return;
    }
    const db = client();
    if (!db) {
      core.toast("Supabase istemcisi yüklenemedi. Kampanya kaydı için SDK bağlantısı gerekli.", "error");
      return;
    }
    if (button) button.disabled = true;
    try {
      const mall = await resolveMallCenter(db);
      if (mall.error) throw mall.error;
      if (!mall.id) throw new Error("AVM merkezi kaydı bulunamadı.");
      const visitorSessionId = redemptionSessionId();
      if (!visitorSessionId) throw new Error("Ziyaretçi oturum kimliği oluşturulamadı.");
      const payload = {
        mall_id: mall.id,
        directory_item_id: item.record_id,
        directory_public_id: item.public_id || item.id,
        visitor_session_id: visitorSessionId,
        action_type: "save_interest",
        campaign_title: item.title,
        campaign_category: item.category || null,
        floor_label: item.floor || null,
        source_page: "avm-dunyasi",
        status: "new"
      };
      const { error } = await db.from("mall_campaign_redemptions").insert(payload);
      if (error) {
        if (error.code === "23505") {
          markRedemptionSaved(item.id);
          if (button) button.textContent = "İlgi Kaydedildi";
          core.toast("Bu kampanyaya ilginiz bu oturumda zaten kaydedildi.");
          return;
        }
        throw error;
      }
      markRedemptionSaved(item.id);
      if (button) button.textContent = "İlgi Kaydedildi";
      core.toast("Kampanya ilginiz kaydedildi.");
    } catch (error) {
      core.toast(`Kampanya ilgisi kaydedilemedi. AVM deploy notundaki kampanya ilgi SQL'i uygulanmalı: ${error.message || "Supabase kayıt hatası"}`, "error");
    } finally {
      if (button) button.disabled = savedRedemptions.has(item.id);
    }
  }

  function zoneClass(zone, index) {
    const byType = {
      stores: "avm-map-zone--fashion",
      events: "avm-map-zone--atrium",
      dining: "avm-map-zone--dining",
      parking: "avm-map-zone--parking",
      services: "avm-map-zone--services"
    };
    return byType[zone.type] || ["avm-map-zone--fashion", "avm-map-zone--atrium", "avm-map-zone--dining", "avm-map-zone--parking", "avm-map-zone--services"][index % 5];
  }

  function zoneLabel(zone) {
    const labels = {
      stores: "Mağaza",
      events: "Atrium",
      dining: "Yeme İçme",
      parking: "Otopark",
      services: "Hizmet"
    };
    return labels[zone.type] || zone.title;
  }

  function zoneStyle(zone, index) {
    const fallbackPositions = [
      { x: 10, y: 29, w: 27, h: 58 },
      { x: 39, y: 38, w: 23, h: 92 },
      { x: 66, y: 25, w: 25, h: 58 },
      { x: 12, y: 68, w: 29, h: 58 },
      { x: 62, y: 67, w: 26, h: 58 }
    ];
    const fallback = fallbackPositions[index % fallbackPositions.length];
    const w = numberValue(zone.map_width_percent, fallback.w, 10, 90);
    const x = numberValue(zone.map_x_percent, fallback.x, 0, 100 - w);
    const y = numberValue(zone.map_y_percent, fallback.y, 0, 95);
    const h = numberValue(zone.map_height_px, fallback.h, 44, 180);
    return `left:${x}%;top:${y}%;right:auto;bottom:auto;width:${w}%;min-height:${h}px;`;
  }

  function updateZonePanel(zone, floorMap, emptyMessage = "") {
    const title = document.querySelector("[data-avm-zone-title]");
    const copy = document.querySelector("[data-avm-zone-copy]");
    const route = document.querySelector("[data-avm-zone-route]");
    const metric = document.querySelector("[data-avm-zone-metric]");
    if (title) title.textContent = zone ? `${zone.title} · ${zone.floor}` : (floorMap?.title || "Kat planı seçimi");
    if (copy) copy.textContent = zone?.detail || emptyMessage || "Bu kat için yayında yön bulma bölgesi bulunmuyor.";
    if (route) route.textContent = zone?.route || "-";
    if (metric) metric.textContent = zone?.metric || "-";
  }

  function selectZone(id) {
    const zone = zones.find((item) => item.id === id);
    if (!zone || !zone.floor_map_id || !floorMaps.some((map) => map.record_id === zone.floor_map_id)) return false;
    activeFloorMapId = zone.floor_map_id;
    activeZoneId = zone.id;
    renderZones();
    return true;
  }

  function selectFloorMap(id) {
    if (!floorMaps.some((map) => map.record_id === id)) return;
    activeFloorMapId = id;
    if (!zones.some((zone) => zone.id === activeZoneId && zone.floor_map_id === id)) activeZoneId = "";
    renderZones();
  }

  function renderZones() {
    const map = document.querySelector("[data-avm-floor-map]");
    const tabs = document.querySelector("[data-avm-floor-map-tabs]");
    if (!map) return;
    const sortedMaps = [...floorMaps].sort((a, b) => a.display_order - b.display_order);
    if (!sortedMaps.some((floorMap) => floorMap.record_id === activeFloorMapId)) {
      activeFloorMapId = sortedMaps[0]?.record_id || "";
    }
    const floorMap = sortedMaps.find((item) => item.record_id === activeFloorMapId) || null;
    if (tabs) {
      tabs.hidden = !sortedMaps.length;
      tabs.innerHTML = sortedMaps.map((item) => {
        const tabId = `avm-floor-tab-${String(item.record_id).replace(/[^a-z0-9_-]/gi, "-")}`;
        return `
          <button id="${core.escapeHTML(tabId)}" type="button" role="tab" aria-controls="avm-floor-map-panel" aria-selected="${item.record_id === activeFloorMapId ? "true" : "false"}" tabindex="${item.record_id === activeFloorMapId ? "0" : "-1"}" class="${item.record_id === activeFloorMapId ? "is-active" : ""}" data-avm-floor-map-select="${core.escapeHTML(item.record_id)}">
            ${core.escapeHTML(item.floor)}
          </button>
        `;
      }).join("");
    }
    if (!floorMap) {
      activeZoneId = "";
      map.classList.remove("has-asset", "has-native-size");
      map.style.removeProperty("aspect-ratio");
      map.removeAttribute("aria-labelledby");
      map.setAttribute("aria-label", "AVM kat planı önizlemesi");
      map.innerHTML = `<div class="avm-floor-map__level">Onaylı kat planı henüz yayında değil</div>`;
      updateZonePanel(null, null, "AVM yönetimi gerçek kat planı görselini yayınladığında yön bulma bölgeleri burada açılır.");
      return;
    }
    const mapImage = safeHttpUrl(floorMap.image_url);
    const sorted = zones
      .filter((zone) => zone.floor_map_id === floorMap.record_id)
      .sort((a, b) => a.display_order - b.display_order);
    if (!sorted.some((zone) => zone.id === activeZoneId)) activeZoneId = sorted[0]?.id || "";
    const activeZone = sorted.find((zone) => zone.id === activeZoneId) || null;
    const hasDimensions = Number.isFinite(floorMap.native_width_px)
      && floorMap.native_width_px > 0
      && Number.isFinite(floorMap.native_height_px)
      && floorMap.native_height_px > 0;
    map.classList.toggle("has-asset", Boolean(mapImage));
    map.classList.toggle("has-native-size", Boolean(mapImage && hasDimensions));
    if (hasDimensions) map.style.aspectRatio = `${floorMap.native_width_px} / ${floorMap.native_height_px}`;
    else map.style.removeProperty("aspect-ratio");
    map.setAttribute("aria-label", `${floorMap.title} kat planı`);
    map.setAttribute("aria-labelledby", `avm-floor-tab-${String(floorMap.record_id).replace(/[^a-z0-9_-]/gi, "-")}`);
    map.innerHTML = `
      ${mapImage ? `<img class="avm-floor-map__asset" data-avm-map-asset src="${core.escapeHTML(mapImage)}" alt="${core.escapeHTML(floorMap.image_alt || floorMap.title)}" loading="lazy">` : ""}
      <div class="avm-floor-map__level">${core.escapeHTML(floorMap.title)} · ${mapImage ? "Yayındaki plan görseli" : "Görsel kullanılamıyor"}</div>
      ${mapImage ? sorted.map((zone, index) => `
        <button type="button" class="avm-map-zone ${zoneClass(zone, index)} ${zone.id === activeZoneId ? "is-active" : ""}" style="${zoneStyle(zone, index)}" data-avm-zone="${core.escapeHTML(zone.id)}" aria-label="${core.escapeHTML(`${zone.title} alanını seç`)}">
          ${core.escapeHTML(zoneLabel(zone))}
        </button>
      `).join("") : ""}
    `;
    updateZonePanel(mapImage ? activeZone : null, floorMap, mapImage
      ? "Bu kat planı için yayında yön bulma bölgesi bulunmuyor."
      : "Kat planı görseli kullanılamadığı için yön bulma bölgeleri gösterilmiyor.");
    const image = map.querySelector("[data-avm-map-asset]");
    if (image) {
      image.addEventListener("error", () => {
        image.hidden = true;
        map.classList.remove("has-asset", "has-native-size");
        map.style.removeProperty("aspect-ratio");
        map.querySelectorAll("[data-avm-zone]").forEach((button) => button.remove());
        updateZonePanel(null, floorMap, "Kat planı görseli yüklenemediği için yön bulma bölgeleri gösterilmiyor.");
      }, { once: true });
    }
  }

  function bindWayfinding() {
    const map = document.querySelector("[data-avm-floor-map]");
    const section = document.querySelector("#avm-wayfinding");
    if (!map || !section) return;
    renderZones();
    loadFloorMaps();
    loadZones();
    section.addEventListener("click", (event) => {
      const floorButton = event.target.closest("[data-avm-floor-map-select]");
      if (floorButton) {
        selectFloorMap(floorButton.dataset.avmFloorMapSelect);
        return;
      }
      const button = event.target.closest("[data-avm-zone]");
      if (button) selectZone(button.dataset.avmZone);
    });
    section.addEventListener("keydown", (event) => {
      const floorButton = event.target.closest("[data-avm-floor-map-select]");
      if (!floorButton || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const buttons = [...section.querySelectorAll("[data-avm-floor-map-select]")];
      if (!buttons.length) return;
      event.preventDefault();
      const currentIndex = buttons.indexOf(floorButton);
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      const nextButton = buttons[nextIndex];
      selectFloorMap(nextButton.dataset.avmFloorMapSelect);
      document.getElementById(nextButton.id)?.focus();
    });
  }

  function bindDirectory() {
    if (!document.querySelector("[data-page='avm']")) return;
    document.querySelector("[data-avm-results]")?.addEventListener("error", (event) => {
      if (event.target.matches("[data-avm-directory-image]")) {
        event.target.closest(".avm-directory-card__media")?.remove();
      }
    }, true);
    renderFilterOptions();
    renderResults();
    renderPlan();
    renderPublicMetrics();
    loadCatalog();
    loadOpeningHours();

    document.querySelectorAll("[data-avm-view]").forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.avmView));
    });

    const form = document.querySelector("[data-avm-filters]");
    if (form) {
      form.addEventListener("input", core.debounce(renderResults, 120));
      form.addEventListener("change", renderResults);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        renderResults();
      });
    }

    document.addEventListener("click", (event) => {
      const add = event.target.closest("[data-avm-add]");
      const remove = event.target.closest("[data-avm-remove]");
      const redemption = event.target.closest("[data-avm-redemption]");
      const favorite = event.target.closest("[data-avm-favorite]");
      const itemRoute = event.target.closest("[data-avm-item-route]");
      if (itemRoute) {
        showItemRoute(itemRoute.dataset.avmItemRoute);
        return;
      }
      if (redemption) {
        saveCampaignRedemption(redemption.dataset.avmRedemption, redemption);
        return;
      }
      if (favorite) {
        toggleDirectoryFavorite(favorite.dataset.avmFavorite);
        return;
      }
      if (add) addToPlan(add.dataset.avmAdd);
      if (remove) {
        plan = plan.filter((id) => id !== remove.dataset.avmRemove);
        writePlan();
        renderPlan();
      }
    });

    document.querySelector("[data-avm-reset]")?.addEventListener("click", () => {
      form?.reset();
      renderResults();
    });

    document.querySelector("[data-avm-plan-family]")?.addEventListener("click", buildFamilyRoute);

    document.querySelector("[data-avm-plan-clear]")?.addEventListener("click", () => {
      plan = [];
      writePlan();
      renderPlan();
    });

    document.querySelector("[data-avm-plan-save-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      saveVisitPlan(event.currentTarget);
    });

    bindWayfinding();
  }

  function bindServices() {
    const target = document.querySelector("[data-avm-services]");
    if (!target) return;
    setServiceSource("Hizmet envanteri yükleniyor...", "info");
    renderServiceFilterOptions();
    renderServices();
    loadServices();

    const form = document.querySelector("[data-avm-service-filters]");
    form?.addEventListener("input", core.debounce(renderServices, 120));
    form?.addEventListener("change", renderServices);
    form?.addEventListener("submit", (event) => event.preventDefault());
    document.querySelector("[data-avm-service-reset]")?.addEventListener("click", () => {
      form?.reset();
      renderServices();
    });
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-avm-service-route]");
      if (button) showServiceRoute(button.dataset.avmServiceRoute);
    });
  }

  function bindAccessibilityRequests() {
    const form = document.querySelector("[data-avm-assistance-form]");
    const status = document.querySelector("[data-avm-assistance-status]");
    const visitInput = document.querySelector("[data-avm-assistance-visit-at]");
    if (!form || !status || !visitInput) return;

    const setMinimumVisitTime = () => {
      const minimum = new Date(Date.now() + 60 * 60 * 1000);
      const maximum = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
      visitInput.min = istanbulDateTimeInputValue(minimum);
      visitInput.max = istanbulDateTimeInputValue(maximum);
    };
    setMinimumVisitTime();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const db = client();
      if (!db) {
        core.renderStatus(status, "Canlı kayıt bağlantısı kurulamadı. Lütfen daha sonra tekrar deneyin veya AVM danışmasıyla iletişime geçin.", "error");
        return;
      }
      const values = core.parseForm(form);
      const phone = String(values.contact_phone || "").trim();
      const email = String(values.contact_email || "").trim();
      const visitAtIso = istanbulDateTimeInputToIso(values.visit_at);
      const visitAt = new Date(visitAtIso || "");
      const partySize = Number(values.party_size || 0);
      const latestVisit = Date.now() + 180 * 24 * 60 * 60 * 1000;
      if (!phone && !email) {
        core.renderStatus(status, "Telefon veya e-posta alanlarından en az birini doldurun.", "error");
        return;
      }
      if (!Number.isFinite(visitAt.getTime()) || visitAt.getTime() < Date.now() + 55 * 60 * 1000 || visitAt.getTime() > latestVisit) {
        core.renderStatus(status, "Ziyaret zamanı en az bir saat sonrası ve en fazla 180 gün içinde olmalıdır.", "error");
        return;
      }
      if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) {
        core.renderStatus(status, "Kişi sayısı 1 ile 20 arasında olmalıdır.", "error");
        return;
      }

      const button = form.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      try {
        const mall = await resolveMallCenter(db);
        if (mall.error) throw mall.error;
        if (!mall.id) throw new Error("Yayındaki AVM merkezi bulunamadı.");
        const { error } = await db.from("mall_accessibility_requests").insert({
          mall_id: mall.id,
          visitor_name: String(values.visitor_name || "").trim(),
          service_type: values.service_type,
          visit_at: visitAtIso,
          party_size: partySize,
          contact_phone: phone || null,
          contact_email: email || null,
          meeting_point: String(values.meeting_point || "").trim() || null,
          request_note: String(values.request_note || "").trim() || null,
          consent_ack: values.consent_ack === "on",
          source_page: "avm-dunyasi"
        });
        if (error) throw error;
        form.reset();
        setMinimumVisitTime();
        core.renderStatus(status, "Destek talebiniz AVM operasyon kuyruğuna alındı. Talep teyidi verdiğiniz iletişim kanalından yapılacaktır.", "success");
      } catch (error) {
        core.renderStatus(status, error.message || "Destek talebi kaydedilemedi. Lütfen daha sonra tekrar deneyin.", "error");
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function bindTransport() {
    const target = document.querySelector("[data-avm-transport-routes]");
    const form = document.querySelector("[data-avm-transport-filters]");
    if (!target || !form) return;
    setTransportSource("Ulaşım rehberi yükleniyor...", "info");
    renderTransportFilterOptions();
    renderTransportRoutes();
    loadTransportRoutes();
    form.addEventListener("change", renderTransportRoutes);
    form.addEventListener("submit", (event) => event.preventDefault());
    document.querySelector("[data-avm-transport-reset]")?.addEventListener("click", () => {
      form.reset();
      renderTransportRoutes();
    });
  }

  function bindOperationalNotices() {
    if (!document.querySelector("[data-avm-notices]")) return;
    renderOperationalNotices();
    loadOperationalNotices();
  }

  function bindParking() {
    const target = document.querySelector("[data-avm-parking-areas]");
    const form = document.querySelector("[data-avm-parking-location-form]");
    const status = document.querySelector("[data-avm-parking-location-status]");
    if (!target || !form) return;
    setParkingSource("Otopark envanteri yükleniyor...", "info");
    renderParkingAreas();
    loadParkingAreas();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = core.parseForm(form);
      const area = parkingAreas.find((row) => row.record_id === values.parking_area_id);
      const marker = String(values.marker || "").trim();
      const note = String(values.note || "").trim();
      if (!area) {
        core.renderStatus(status, "Yayındaki bir otopark alanı seçin.", "error");
        return;
      }
      if (!marker || marker.length > 80 || note.length > 200) {
        core.renderStatus(status, "Yer kodu 1-80, not en fazla 200 karakter olmalıdır.", "error");
        return;
      }
      const persisted = writeParkingLocation({
        parking_area_id: area.record_id,
        marker,
        note,
        saved_at: new Date().toISOString()
      });
      form.reset();
      renderParkingLocationOptions();
      renderSavedParkingLocation();
      core.renderStatus(
        status,
        persisted ? "Park konumu bu cihazda 48 saat saklanacak." : "Park konumu bu sayfa açık kaldığı sürece saklanacak.",
        persisted ? "success" : ""
      );
    });

    document.addEventListener("click", (event) => {
      const route = event.target.closest("[data-avm-parking-route], [data-avm-parking-location-show]");
      if (route) {
        showParkingAreaRoute(route.dataset.avmParkingRoute || route.dataset.avmParkingLocationShow);
        return;
      }
      if (event.target.closest("[data-avm-parking-location-clear]")) {
        clearParkingLocation();
        renderParkingLocationOptions();
        renderSavedParkingLocation();
        core.renderStatus(status, "Kayıtlı park konumu silindi.", "success");
      }
    });
  }

  function bindPartner() {
    if (!document.querySelector("[data-page='avm-partner']")) return;
    const calculator = document.querySelector("[data-avm-partner-calculator]");
    const result = document.querySelector("[data-avm-package-result]");
    if (calculator && result) {
      calculator.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = core.parseForm(calculator);
        const stores = Number(data.store_count || 0);
        const premium = data.mall_size === "premium" || stores > 180;
        const packageName = premium ? "Enterprise AVM" : stores > 90 ? "Growth AVM" : "Launch AVM";
        const firstStep = data.focus_area === "leasing"
          ? "Tenant başvuru + kiralama vitrini"
          : data.focus_area === "analytics"
            ? "Yönetici raporu + kampanya ölçümü"
            : data.focus_area === "visitor"
              ? "Ziyaretçi rota + mağaza rehberi"
              : data.focus_area === "advertising"
                ? "Reklam envanteri + sponsor satış akışı"
                : "Etkinlik + kampanya takvimi";
        result.innerHTML = `
          <div class="summary-line"><span>Paket</span><strong>${core.escapeHTML(packageName)}</strong></div>
          <div class="summary-line"><span>İlk kurulum</span><strong>${core.escapeHTML(firstStep)}</strong></div>
          <div class="summary-line"><span>Panel ihtiyacı</span><strong>${premium ? "Yüksek" : "Orta"}</strong></div>
          <p class="muted">${stores} mağazalı yapı için önce görünür değer üreten modül, sonra yönetim paneli önerilir.</p>
        `;
      });
    }

    const leadForm = document.querySelector("[data-avm-lead-form]");
    const status = document.querySelector("[data-avm-lead-status]");
    if (leadForm) {
      leadForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const db = client();
        if (!db) {
          if (status) status.innerHTML = `<div class="status-box status-box--error">Supabase istemcisi yüklenemedi. Canlı kayıt için Supabase SDK ve AVM SQL kurulumu gerekli.</div>`;
          return;
        }
        const data = core.parseForm(leadForm);
        const payload = {
          mall_name: data.mall,
          contact_role: data.role,
          email: data.email,
          phone: data.phone,
          need_summary: data.need || "",
          mall_size: data.mall_size || null,
          interest_type: data.interest_type || "platform",
          source_page: "avm-partner"
        };
        try {
          const { error } = await db.from("mall_leads").insert(payload);
          if (error) throw error;
          if (status) status.innerHTML = `<div class="status-box status-box--success">Talep Supabase AVM lead tablosuna kaydedildi.</div>`;
          leadForm.reset();
        } catch (error) {
          if (status) status.innerHTML = `<div class="status-box status-box--error">Talep kaydedilemedi. AVM deploy notundaki Supabase SQL'i uygulanmalı: ${core.escapeHTML(error.message || "Supabase kayıt hatası")}</div>`;
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindDirectory();
    bindParking();
    bindTransport();
    bindOperationalNotices();
    bindServices();
    bindAccessibilityRequests();
    bindPartner();
  });
})();
