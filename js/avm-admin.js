(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const mallSlug = "allona-avm-dunyasi";
  let defaultMallId;
  let floorMapRows = [];
  let floorZoneRows = [];
  let directoryRows = [];
  let hoursProfiles = [];
  let weeklyHoursRows = [];
  let specialHoursRows = [];
  let parkingAreaRows = [];
  let transportRouteRows = [];
  let operationalNoticeRows = [];
  let previewZoneId = "";
  let partnerSubmissionRows = [];
  let partnerSubmissionRequestTypeFilter = "";
  let partnerSubmissionStatusFilter = "";
  let partnerSubmissionVisibilityFilter = "";
  let partnerSubmissionStartDateFilter = "";
  let partnerSubmissionEndDateFilter = "";
  let partnerSubmissionTotal = 0;
  let partnerSubmissionPage = 1;
  let partnerSubmissionPageSize = 25;
  let partnerSubmissionRequestId = 0;
  let partnerSubmissionSummary = {
    total: 0,
    awaitingAction: 0,
    approved: 0,
    published: 0,
    advertising: 0,
    tenant: 0,
    campaign: 0,
    event: 0
  };
  let visitPlanRows = [];
  let visitPlanStatusFilter = "";
  let visitPlanSearchFilter = "";
  let visitPlanStartDateFilter = "";
  let visitPlanEndDateFilter = "";
  let visitPlanTotal = 0;
  let visitPlanPage = 1;
  let visitPlanPageSize = 50;
  let visitPlanRequestId = 0;
  let visitPlanMetrics = { newCount: 0, reviewed: 0, actioned: 0, archived: 0, stops: 0, minutes: 0, touch: 0 };
  let accessibilityRequestRows = [];
  let accessibilityRequestStatusFilter = "";
  let accessibilityRequestTypeFilter = "";
  let accessibilityRequestSearchFilter = "";
  let accessibilityRequestStartDateFilter = "";
  let accessibilityRequestEndDateFilter = "";
  let accessibilityRequestTotal = 0;
  let accessibilityRequestPage = 1;
  let accessibilityRequestPageSize = 50;
  let accessibilityRequestRequestId = 0;
  let accessibilityRequestMetrics = { newCount: 0, confirmed: 0, completed: 0, cancelled: 0, archived: 0, visitors: 0, upcoming: 0 };
  let campaignRedemptionRows = [];
  let campaignPartnerByItemId = new Map();
  let campaignPartnerLookupFailed = false;
  let campaignRedemptionStatusFilter = "";
  let campaignRedemptionActionFilter = "";
  let campaignRedemptionCampaignFilter = "";
  let campaignRedemptionCategoryFilter = "";
  let campaignRedemptionPartnerFilter = "";
  let campaignRedemptionVisibilityFilter = "";
  let campaignRedemptionStartDateFilter = "";
  let campaignRedemptionEndDateFilter = "";
  let campaignRedemptionTotal = 0;
  let campaignRedemptionPage = 1;
  let campaignRedemptionPageSize = 50;
  let campaignRedemptionRequestId = 0;
  let campaignRedemptionDimensionsLoaded = false;
  let campaignRedemptionDimensions = { campaigns: [], categories: [], partners: [], visibilities: [] };
  let campaignRedemptionMetrics = { newCount: 0, reviewed: 0, exported: 0, archived: 0 };
  let directoryInteractionRows = [];
  let directoryInteractionTypeFilter = "";
  let directoryInteractionSearchFilter = "";
  let directoryInteractionStartDateFilter = "";
  let directoryInteractionEndDateFilter = "";
  let directoryInteractionTotal = 0;
  let directoryInteractionPage = 1;
  let directoryInteractionPageSize = 50;
  let directoryInteractionRequestId = 0;
  let directoryInteractionMetrics = { detail: 0, routePlan: 0, outbound: 0, share: 0 };
  let leadRows = [];
  let leadStatusFilter = "";
  let leadInterestTypeFilter = "";
  let leadSearchFilter = "";
  let leadStartDateFilter = "";
  let leadEndDateFilter = "";
  let leadTotal = 0;
  let leadPage = 1;
  let leadPageSize = 50;
  let leadRequestId = 0;
  let leadMetrics = { newCount: 0, contacted: 0, qualified: 0, archived: 0 };

  const partnerRequestLabels = {
    tenant_profile: "Mağaza profili",
    campaign: "Kampanya",
    event: "Etkinlik",
    advertising: "Reklam / sponsor"
  };

  const partnerVisibilityLabels = {
    standard: "Standart",
    featured: "Öne çıkan",
    sponsored: "Sponsorlu",
    event_area: "Etkinlik alanı",
    not_published: "Yayında değil",
    scheduled: "Planlandı",
    published: "Yayında",
    hidden: "Gizli"
  };

  const partnerStatusLabels = {
    new: "Yeni",
    in_review: "İncelemede",
    changes_requested: "Revizyon istendi",
    approved: "Onaylandı",
    rejected: "Reddedildi",
    archived: "Arşivlendi"
  };

  const partnerBudgetLabels = {
    not_specified: "Bütçe belirtilmedi",
    under_50000: "50.000 TL altı",
    "50000_150000": "50.000 - 150.000 TL",
    "150000_500000": "150.000 - 500.000 TL",
    over_500000: "500.000 TL üzeri"
  };

  const campaignRedemptionLabels = {
    new: "Yeni",
    reviewed: "İncelendi",
    exported: "Raporlandı",
    archived: "Arşivlendi"
  };

  const visitPlanStatusLabels = {
    new: "Yeni",
    reviewed: "İncelendi",
    actioned: "İşleme alındı",
    archived: "Arşivlendi"
  };

  const accessibilityRequestTypeLabels = {
    wheelchair: "Tekerlekli sandalye",
    guided_assistance: "Karşılama ve yönlendirme",
    hearing_support: "İşitme desteği",
    visual_support: "Görme desteği",
    family_support: "Aile / bebek desteği",
    other: "Diğer"
  };

  const accessibilityRequestStatusLabels = {
    new: "Yeni",
    confirmed: "Teyit edildi",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
    archived: "Arşivlendi"
  };

  const leadStatusLabels = {
    new: "Yeni",
    contacted: "İletişime geçildi",
    qualified: "Nitelikli görüşme",
    archived: "Arşivlendi"
  };

  const leadInterestTypeLabels = {
    platform: "AVM platform kurulumu",
    leasing: "Kiralama / kiosk / stand",
    advertising: "Reklam ve sponsor alanı",
    events: "Etkinlik ve marka aktivasyonu"
  };

  const campaignActionLabels = {
    save_interest: "İlgi kaydı",
    redeem_request: "Kullanım talebi"
  };

  const directoryInteractionLabels = {
    detail_view: "Detay görüntüleme",
    route_open: "Harita açma",
    plan_add: "Rotaya ekleme",
    favorite_save: "Kaydetme",
    cta_open: "Dış aksiyon",
    website_open: "Resmi site",
    phone_open: "Telefon",
    share: "Paylaşım"
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
    directory_item: "Tek katalog kaydı"
  };

  const weekDays = [
    { value: 1, label: "Pazartesi" },
    { value: 2, label: "Salı" },
    { value: 3, label: "Çarşamba" },
    { value: 4, label: "Perşembe" },
    { value: 5, label: "Cuma" },
    { value: 6, label: "Cumartesi" },
    { value: 0, label: "Pazar" }
  ];

  function partnerSubmissionTarget(row) {
    if (row.request_type === "advertising") {
      return row.published_ad_slot_id
        ? {
          id: row.published_ad_slot_id,
          href: "#ad-slots",
          status: row.published_ad_slot_status || "missing",
          label: row.published_ad_slot_status === "active" ? "Reklam alanı aktif" : "Reklam taslağını aç"
        }
        : null;
    }
    return row.published_item_id
      ? {
        id: row.published_item_id,
        href: "#directory",
        status: row.published_item_status || "missing",
        label: row.published_item_status === "active" ? "Katalog yayını aktif" : "Katalog taslağını aç"
      }
      : null;
  }

  function rowStatus(value) {
    return `<span class="pill ${value === "active" || value === "new" ? "pill--gold" : ""}">${core.escapeHTML(value || "-")}</span>`;
  }

  function tagsToArray(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function tagsToText(value) {
    return Array.isArray(value) ? value.join(",") : "";
  }

  function numberValue(value, fallback, min, max) {
    const parsed = Number(value);
    const numeric = Number.isFinite(parsed) ? parsed : fallback;
    const minBound = Number.isFinite(min) ? min : -Infinity;
    const maxBound = Number.isFinite(max) ? max : Infinity;
    return Math.min(Math.max(numeric, minBound), maxBound);
  }

  function optionalNumberValue(value, min, max) {
    if (value === "" || value === null || value === undefined) return null;
    return numberValue(value, null, min, max);
  }

  function zoneCoordinatePayload(values) {
    const width = numberValue(values.map_width_percent, 25, 10, 90);
    return {
      map_x_percent: numberValue(values.map_x_percent, 10, 0, 100 - width),
      map_y_percent: numberValue(values.map_y_percent, 25, 0, 95),
      map_width_percent: width,
      map_height_px: numberValue(values.map_height_px, 58, 44, 180)
    };
  }

  function zonePreviewId(zone) {
    return String(zone.id || zone.public_id || zone.title || "");
  }

  function zonePreviewClass(zone, index) {
    const byType = {
      stores: "avm-map-zone--fashion",
      events: "avm-map-zone--atrium",
      dining: "avm-map-zone--dining",
      parking: "avm-map-zone--parking",
      services: "avm-map-zone--services"
    };
    return byType[zone.zone_type] || ["avm-map-zone--fashion", "avm-map-zone--atrium", "avm-map-zone--dining", "avm-map-zone--parking", "avm-map-zone--services"][index % 5];
  }

  function zonePreviewLabel(type) {
    const labels = {
      stores: "Mağaza",
      events: "Atrium",
      dining: "Yeme İçme",
      parking: "Otopark",
      services: "Hizmet"
    };
    return labels[type] || "Bölge";
  }

  function zonePreviewStyle(zone, index) {
    const fallbackPositions = [
      { x: 10, y: 29, w: 27, h: 58 },
      { x: 39, y: 38, w: 23, h: 92 },
      { x: 66, y: 25, w: 25, h: 58 },
      { x: 12, y: 68, w: 29, h: 58 },
      { x: 62, y: 67, w: 26, h: 58 }
    ];
    const fallback = fallbackPositions[index % fallbackPositions.length];
    const width = numberValue(zone.map_width_percent, fallback.w, 10, 90);
    const x = numberValue(zone.map_x_percent, fallback.x, 0, 100 - width);
    const y = numberValue(zone.map_y_percent, fallback.y, 0, 95);
    const height = numberValue(zone.map_height_px, fallback.h, 44, 180);
    return `left:${x}%;top:${y}%;right:auto;bottom:auto;width:${width}%;min-height:${height}px;`;
  }

  function zoneDraftFromForm(form) {
    const values = core.parseForm(form);
    const hasDraft = values.id || values.public_id || values.title || values.route_hint || values.management_metric || values.description;
    if (!hasDraft) return null;
    const coordinates = zoneCoordinatePayload(values);
    return {
      id: values.id || values.public_id || "__zone-draft",
      public_id: values.public_id || "__zone-draft",
      floor_map_id: values.floor_map_id || null,
      title: values.title || "Yeni bölge taslağı",
      floor_label: values.floor_label || "Zemin Kat",
      zone_type: values.zone_type || "stores",
      route_hint: values.route_hint || "",
      management_metric: values.management_metric || "",
      description: values.description || "",
      map_x_percent: coordinates.map_x_percent,
      map_y_percent: coordinates.map_y_percent,
      map_width_percent: coordinates.map_width_percent,
      map_height_px: coordinates.map_height_px,
      display_order: numberValue(values.display_order, 100, 1),
      status: values.status || "draft",
      isDraft: true
    };
  }

  function previewRows() {
    const form = document.querySelector("[data-avm-zone-form]");
    const draft = form ? zoneDraftFromForm(form) : null;
    const rows = floorZoneRows.map((zone) => ({ ...zone, isDraft: false }));
    if (draft) {
      const draftKey = zonePreviewId(draft);
      const existingIndex = rows.findIndex((zone) => {
        return zonePreviewId(zone) === draftKey || (draft.public_id && zone.public_id === draft.public_id);
      });
      if (existingIndex >= 0) rows[existingIndex] = { ...rows[existingIndex], ...draft };
      else rows.push(draft);
    }
    return rows.sort((a, b) => numberValue(a.display_order, 999, 1) - numberValue(b.display_order, 999, 1));
  }

  function renderZonePreview(nextActiveId) {
    const target = document.querySelector("[data-avm-admin-zone-preview]");
    if (!target) return;
    const allRows = previewRows();
    const requestedZone = allRows.find((zone) => zonePreviewId(zone) === nextActiveId);
    const form = document.querySelector("[data-avm-zone-form]");
    const selectedMapId = String(form?.elements.floor_map_id?.value || requestedZone?.floor_map_id || allRows.find((zone) => zone.floor_map_id)?.floor_map_id || floorMapRows[0]?.id || "");
    const floorMap = floorMapRows.find((map) => map.id === selectedMapId);
    if (!floorMap) {
      target.innerHTML = `<div class="empty-state">Koordinat önizlemesi için önce gerçek bir kat planı görseli seçin.</div>`;
      return;
    }
    const rows = allRows.filter((zone) => zone.floor_map_id === selectedMapId);
    const draft = rows.find((zone) => zone.isDraft);
    previewZoneId = nextActiveId || zonePreviewId(draft || rows[0] || {});
    const active = rows.find((zone) => zonePreviewId(zone) === previewZoneId) || rows[0] || null;
    const activeCoordinates = active ? zoneCoordinatePayload(active) : null;
    const mapImage = validHttpUrl(floorMap.image_url) ? floorMap.image_url : "";
    const width = Number(floorMap.native_width_px);
    const height = Number(floorMap.native_height_px);
    const aspectStyle = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
      ? `aspect-ratio:${width}/${height};`
      : "";
    target.innerHTML = `
      <div class="avm-admin-zone-preview">
        <div class="avm-floor-map avm-floor-map--admin ${mapImage ? "has-asset" : ""} ${aspectStyle ? "has-native-size" : ""}" style="${aspectStyle}" aria-label="${core.escapeHTML(`${floorMap.title} koordinat önizlemesi`)}">
          ${mapImage ? `<img class="avm-floor-map__asset" data-avm-admin-map-asset src="${core.escapeHTML(mapImage)}" alt="${core.escapeHTML(floorMap.image_alt || floorMap.title)}">` : ""}
          <div class="avm-floor-map__level">${core.escapeHTML(floorMap.title)} · ${rows.length} bölge</div>
          ${rows.map((zone, index) => {
            const id = zonePreviewId(zone);
            const isActive = id === zonePreviewId(active);
            return `
              <button type="button" class="avm-map-zone ${zonePreviewClass(zone, index)} ${isActive ? "is-active" : ""} ${zone.isDraft ? "is-draft" : ""}" style="${zonePreviewStyle(zone, index)}" data-avm-preview-zone="${core.escapeHTML(id)}" aria-label="${core.escapeHTML(`${zone.title || "Bölge"} koordinatını seç`)}">
                ${core.escapeHTML(zonePreviewLabel(zone.zone_type))}
              </button>
            `;
          }).join("")}
        </div>
        <aside class="summary-card avm-admin-zone-preview__meta">
          <h3>${core.escapeHTML(active?.title || floorMap.title)}</h3>
          <p class="muted">${core.escapeHTML(active?.description || "Bu kat planına bağlı bölge henüz oluşturulmadı.")}</p>
          <div class="summary-line"><span>Kat / durum</span><strong>${core.escapeHTML(active?.floor_label || floorMap.floor_label || "-")} · ${core.escapeHTML(active?.status || floorMap.status || "-")}</strong></div>
          <div class="summary-line"><span>Koordinat</span><strong>${activeCoordinates ? `${activeCoordinates.map_x_percent}% / ${activeCoordinates.map_y_percent}% / ${activeCoordinates.map_width_percent}% / ${activeCoordinates.map_height_px}px` : "-"}</strong></div>
          <div class="summary-line"><span>Yönlendirme</span><strong>${core.escapeHTML(active?.route_hint || "-")}</strong></div>
          <div class="summary-line"><span>Yönetim metriği</span><strong>${core.escapeHTML(active?.management_metric || "-")}</strong></div>
        </aside>
      </div>
    `;
    const image = target.querySelector("[data-avm-admin-map-asset]");
    if (image) {
      image.addEventListener("error", () => {
        image.hidden = true;
        const previewMap = image.closest(".avm-floor-map");
        previewMap?.classList.remove("has-asset", "has-native-size");
        previewMap?.style.removeProperty("aspect-ratio");
      }, { once: true });
    }
  }

  function parseRecord(raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      core.toast("Kayıt verisi okunamadı.", "error");
      return null;
    }
  }

  function istanbulInputValue(value) {
    const date = new Date(value || "");
    if (!Number.isFinite(date.getTime())) return "";
    const parts = Object.fromEntries(new Intl.DateTimeFormat("tr-TR", {
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

  function istanbulInputToIso(value) {
    const match = String(value || "").trim().match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?$/);
    if (!match) return null;
    const date = new Date(`${match[1]}:00+03:00`);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function directoryScheduleError(values) {
    const startsAt = istanbulInputToIso(values.starts_at);
    const endsAt = istanbulInputToIso(values.ends_at);
    if ((values.starts_at && !startsAt) || (values.ends_at && !endsAt)) {
      return "Yayın başlangıcı veya bitişi geçerli bir İstanbul tarih-saat değeri değil.";
    }
    const requiresWindow = values.status === "active" && ["events", "deals"].includes(values.item_type);
    if (requiresWindow && (!startsAt || !endsAt)) {
      return "Aktif etkinlik ve kampanyalarda yayın başlangıcı ile bitişi zorunludur.";
    }
    if (Boolean(startsAt) !== Boolean(endsAt)) {
      return "Yayın başlangıcı ve bitişi birlikte girilmelidir.";
    }
    if (startsAt && endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
      return "Yayın bitişi başlangıçtan önce olamaz.";
    }
    return "";
  }

  function formatDirectorySchedule(item) {
    if (!item.starts_at && !item.ends_at) return "Süresiz";
    if (!item.starts_at || !item.ends_at) return "Eksik aralık";
    const options = { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" };
    return `${new Date(item.starts_at).toLocaleString("tr-TR", options)} - ${new Date(item.ends_at).toLocaleString("tr-TR", options)}`;
  }

  function directoryMediaCell(item) {
    if (!validHttpUrl(item.image_url)) return "Görsel yok";
    return `<img class="avm-admin-directory-thumb" data-avm-admin-directory-image src="${core.escapeHTML(item.image_url)}" alt="${core.escapeHTML(item.image_alt || item.title)}" loading="lazy">`;
  }

  function fillForm(form, item, shouldScroll = true) {
    Object.keys(item).forEach((key) => {
      if (!form.elements[key]) return;
      if (form.elements[key].type === "checkbox") {
        form.elements[key].checked = Boolean(item[key]);
        return;
      }
      if (form.elements[key].type === "datetime-local") {
        form.elements[key].value = istanbulInputValue(item[key]);
        return;
      }
      form.elements[key].value = key === "tags" ? tagsToText(item[key]) : item[key] ?? "";
    });
    if (shouldScroll) {
      window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 120, behavior: "smooth" });
    }
  }

  function validHttpUrl(value) {
    try {
      return ["http:", "https:"].includes(new URL(String(value || "").trim()).protocol);
    } catch (error) {
      return false;
    }
  }

  function normalizedHttpUrl(value) {
    const raw = String(value || "").trim();
    if (!raw || /\s/.test(raw)) return "";
    try {
      const url = new URL(raw);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function floorMapActivationErrors(values) {
    if (values.status !== "active") return [];
    const errors = [];
    if (!validHttpUrl(values.image_url)) errors.push("geçerli HTTP(S) görsel URL'si");
    if (String(values.image_alt || "").trim().length < 3) errors.push("erişilebilir görsel açıklaması");
    if (!optionalNumberValue(values.native_width_px, 1)) errors.push("orijinal görsel genişliği");
    if (!optionalNumberValue(values.native_height_px, 1)) errors.push("orijinal görsel yüksekliği");
    if (values.storage_bucket !== "mall-assets") errors.push("mall-assets Storage bucket'ı");
    if (!String(values.storage_path || "").trim()) errors.push("Storage yolu");
    return errors;
  }

  function syncFloorMapRequirements(form) {
    if (!form) return;
    const active = form.elements.status?.value === "active";
    ["image_url", "native_width_px", "native_height_px", "storage_path"].forEach((name) => {
      if (form.elements[name]) form.elements[name].required = active;
    });
  }

  function centerActivationErrors(values) {
    if (values.status !== "active") return [];
    const errors = [];
    const name = String(values.name || "").trim();
    if (!name || name.toLocaleLowerCase("tr-TR") === "avm merkezi") errors.push("gerçek AVM adı");
    if (!String(values.city || "").trim()) errors.push("şehir");
    if (!String(values.district || "").trim()) errors.push("ilçe / bölge");
    if (!String(values.address || "").trim()) errors.push("açık adres");
    if (!String(values.phone || "").trim()) errors.push("telefon");
    if (!validHttpUrl(values.website_url)) errors.push("geçerli resmi web adresi");
    if (!validHttpUrl(values.hero_image_url)) errors.push("geçerli onaylı hero görseli URL'si");
    return errors;
  }

  function directoryMediaError(values) {
    const imageUrl = String(values.image_url || "").trim();
    const imageAlt = String(values.image_alt || "").trim();
    if (Boolean(imageUrl) !== Boolean(imageAlt)) {
      return "Katalog görseli ve erişilebilir görsel açıklaması birlikte girilmelidir.";
    }
    if (imageUrl && !validHttpUrl(imageUrl)) {
      return "Katalog görseli geçerli bir HTTP(S) URL olmalıdır.";
    }
    if (imageAlt && (imageAlt.length < 3 || imageAlt.length > 300)) {
      return "Görsel açıklaması 3-300 karakter arasında olmalıdır.";
    }
    if (values.status === "active" && !imageUrl) {
      return "Aktif katalog kaydı için onaylı görsel ve görsel açıklaması zorunludur.";
    }
    return "";
  }

  function directoryDetailsError(values) {
    const phone = String(values.contact_phone || "").trim();
    const website = String(values.website_url || "").trim();
    const ctaUrl = String(values.cta_url || "").trim();
    const ctaLabel = String(values.cta_label || "").trim();
    const terms = String(values.terms_text || "").trim();
    if (phone && (phone.length < 3 || phone.length > 40)) {
      return "Ziyaretçi telefonu 3-40 karakter arasında olmalıdır.";
    }
    if (website && !normalizedHttpUrl(website)) {
      return "Resmi web adresi geçerli bir HTTP(S) URL olmalıdır.";
    }
    if (Boolean(ctaUrl) !== Boolean(ctaLabel)) {
      return "Aksiyon etiketi ve aksiyon bağlantısı birlikte girilmelidir.";
    }
    if (ctaUrl && !normalizedHttpUrl(ctaUrl)) {
      return "Aksiyon bağlantısı geçerli bir HTTP(S) URL olmalıdır.";
    }
    if (ctaLabel && (ctaLabel.length < 2 || ctaLabel.length > 80)) {
      return "Aksiyon etiketi 2-80 karakter arasında olmalıdır.";
    }
    if (terms && (terms.length < 3 || terms.length > 5000)) {
      return "Kampanya koşulları 3-5000 karakter arasında olmalıdır.";
    }
    if (values.status === "active" && values.item_type === "deals" && !terms) {
      return "Aktif kampanya için kullanım ve geçerlilik koşulları zorunludur.";
    }
    return "";
  }

  function timeInputValue(value) {
    const match = String(value || "").match(/^(\d{2}:\d{2})/);
    return match ? match[1] : "";
  }

  function hoursRowError(isClosed, is24Hours, opensAt, closesAt, note) {
    const cleanNote = String(note || "").trim();
    if (cleanNote && cleanNote.length < 2) return "Çalışma saati notu en az 2 karakter olmalıdır.";
    if (isClosed && is24Hours) return "Bir gün aynı anda kapalı ve 24 saat açık olamaz.";
    if (isClosed || is24Hours) return "";
    if (!opensAt || !closesAt) return "Açık günlerde açılış ve kapanış saati zorunludur.";
    if (opensAt === closesAt) return "Açılış ve kapanış saati aynı olamaz.";
    return "";
  }

  function hoursProfileLabel(profile) {
    const item = directoryRows.find((row) => row.id === profile.directory_item_id);
    const target = item ? ` · ${item.title}` : "";
    return `${profile.title} · ${hoursScopeLabels[profile.scope] || profile.scope}${target}`;
  }

  function renderHoursDirectoryOptions(selectedValue) {
    const select = document.querySelector("[data-avm-hours-directory-select]");
    if (!select) return;
    const selected = selectedValue === undefined ? select.value : selectedValue;
    const rows = directoryRows.filter((item) => item.status !== "archived");
    select.innerHTML = `<option value="">Katalog kaydı seçin</option>${rows.map((item) => `<option value="${core.escapeHTML(item.id)}">${core.escapeHTML(`${item.title} · ${item.item_type}`)}</option>`).join("")}`;
    if (rows.some((item) => item.id === selected)) select.value = selected;
  }

  function renderHoursProfileOptions(selectedValue) {
    const selects = document.querySelectorAll("[data-avm-hours-profile-select], [data-avm-special-hours-profile-select]");
    selects.forEach((select) => {
      const selected = selectedValue === undefined ? select.value : selectedValue;
      const rows = hoursProfiles.filter((profile) => profile.status !== "archived");
      select.innerHTML = `<option value="">Saat profili seçin</option>${rows.map((profile) => `<option value="${core.escapeHTML(profile.id)}">${core.escapeHTML(hoursProfileLabel(profile))}</option>`).join("")}`;
      if (rows.some((profile) => profile.id === selected)) select.value = selected;
    });
  }

  function syncWeeklyDayRow(row, changedInput) {
    const day = row.dataset.avmWeekDay;
    const closedInput = row.querySelector(`[name="day_${day}_closed"]`);
    const allDayInput = row.querySelector(`[name="day_${day}_24_hours"]`);
    if (changedInput?.checked) {
      if (changedInput === closedInput) allDayInput.checked = false;
      if (changedInput === allDayInput) closedInput.checked = false;
    }
    const withoutTimes = closedInput?.checked || allDayInput?.checked;
    ["opens_at", "closes_at"].forEach((field) => {
      const input = row.querySelector(`[name="day_${day}_${field}"]`);
      if (!input) return;
      input.disabled = Boolean(withoutTimes);
      input.required = !withoutTimes;
    });
  }

  function fillWeeklyHoursForm(profileId) {
    const form = document.querySelector("[data-avm-weekly-hours-form]");
    if (!form) return;
    if (profileId) form.elements.profile_id.value = profileId;
    weekDays.forEach(({ value }) => {
      const row = form.querySelector(`[data-avm-week-day="${value}"]`);
      const record = weeklyHoursRows.find((entry) => entry.profile_id === form.elements.profile_id.value && Number(entry.day_of_week) === value);
      const closed = row?.querySelector(`[name="day_${value}_closed"]`);
      const allDay = row?.querySelector(`[name="day_${value}_24_hours"]`);
      const opensAt = row?.querySelector(`[name="day_${value}_opens_at"]`);
      const closesAt = row?.querySelector(`[name="day_${value}_closes_at"]`);
      const note = row?.querySelector(`[name="day_${value}_note"]`);
      if (closed) closed.checked = Boolean(record?.is_closed);
      if (allDay) allDay.checked = Boolean(record?.is_24_hours);
      if (opensAt) opensAt.value = record ? timeInputValue(record.opens_at) : "10:00";
      if (closesAt) closesAt.value = record ? timeInputValue(record.closes_at) : "22:00";
      if (note) note.value = record?.note || "";
      if (row) syncWeeklyDayRow(row);
    });
  }

  function formatHoursRange(row) {
    if (row.is_closed) return "Kapalı";
    if (row.is_24_hours) return "24 saat açık";
    return `${timeInputValue(row.opens_at) || "-"} - ${timeInputValue(row.closes_at) || "-"}`;
  }

  function renderOpeningHoursAdmin() {
    const target = document.querySelector("[data-avm-admin-hours]");
    if (!target) return;
    const weeklyCounts = new Map(hoursProfiles.map((profile) => [
      profile.id,
      new Set(weeklyHoursRows.filter((row) => row.profile_id === profile.id).map((row) => Number(row.day_of_week))).size
    ]));
    const activeSpecialCounts = new Map(hoursProfiles.map((profile) => [
      profile.id,
      specialHoursRows.filter((row) => row.profile_id === profile.id && row.status === "active").length
    ]));
    const profileTable = hoursProfiles.length
      ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Profil</th><th>Kapsam</th><th>Hafta</th><th>Özel gün</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              ${hoursProfiles.map((profile) => {
                const item = directoryRows.find((row) => row.id === profile.directory_item_id);
                return `
                  <tr>
                    <td><strong>${core.escapeHTML(profile.title)}</strong><br><small>${core.escapeHTML(profile.public_id)}</small></td>
                    <td>${core.escapeHTML(hoursScopeLabels[profile.scope] || profile.scope)}${item ? `<br><small>${core.escapeHTML(item.title)}</small>` : ""}</td>
                    <td>${weeklyCounts.get(profile.id) || 0} / 7 gün</td>
                    <td>${activeSpecialCounts.get(profile.id) || 0} aktif</td>
                    <td>${rowStatus(profile.status)}</td>
                    <td class="avm-hours-admin-actions">
                      <button class="btn btn--light" type="button" data-avm-hours-profile-edit='${core.escapeHTML(JSON.stringify(profile))}'>Profili Düzenle</button>
                      <button class="btn btn--light" type="button" data-avm-weekly-hours-edit="${core.escapeHTML(profile.id)}">Haftayı Aç</button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `
      : `<div class="empty-state">Henüz çalışma saati profili yok. İlk profili taslak oluşturup yedi günlük programı kaydedin.</div>`;
    const specialTable = specialHoursRows.length
      ? `
        <div class="table-wrap avm-hours-special-table">
          <table class="data-table">
            <thead><tr><th>Özel gün</th><th>Profil</th><th>Saat</th><th>Not</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              ${specialHoursRows.map((row) => {
                const profile = hoursProfiles.find((item) => item.id === row.profile_id);
                return `
                  <tr>
                    <td>${core.escapeHTML(row.service_date)}</td>
                    <td>${core.escapeHTML(profile?.title || "Profil bulunamadı")}</td>
                    <td>${core.escapeHTML(formatHoursRange(row))}</td>
                    <td>${core.escapeHTML(row.note || "-")}</td>
                    <td>${rowStatus(row.status)}</td>
                    <td><button class="btn btn--light" type="button" data-avm-special-hours-edit='${core.escapeHTML(JSON.stringify(row))}'>Düzenle</button></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `
      : "";
    target.innerHTML = `${profileTable}${specialTable}`;
    renderHoursDirectoryOptions();
    renderHoursProfileOptions();
    renderParkingHoursOptions();
    if (parkingAreaRows.length) renderParkingAreas();
  }

  async function loadOpeningHoursAdmin() {
    const target = document.querySelector("[data-avm-admin-hours]");
    if (!target) return;
    core.renderStatus(target, "Çalışma saatleri yükleniyor...");
    try {
      const mallId = await requireDefaultMallId();
      const { data, error } = await App.db.client()
        .from("mall_hours_profiles")
        .select("*")
        .eq("mall_id", mallId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      hoursProfiles = data || [];
      const profileIds = hoursProfiles.map((profile) => profile.id);
      const [weeklyResult, specialResult] = profileIds.length
        ? await Promise.all([
          App.db.client().from("mall_weekly_hours").select("*").in("profile_id", profileIds).order("day_of_week", { ascending: true }),
          App.db.client().from("mall_special_hours").select("*").in("profile_id", profileIds).order("service_date", { ascending: true })
        ])
        : [{ data: [], error: null }, { data: [], error: null }];
      if (weeklyResult.error) throw weeklyResult.error;
      if (specialResult.error) throw specialResult.error;
      weeklyHoursRows = weeklyResult.data || [];
      specialHoursRows = specialResult.data || [];
      renderOpeningHoursAdmin();
      fillWeeklyHoursForm(document.querySelector("[data-avm-hours-profile-select]")?.value || "");
    } catch (error) {
      hoursProfiles = [];
      weeklyHoursRows = [];
      specialHoursRows = [];
      renderHoursProfileOptions("");
      renderParkingHoursOptions("");
      core.renderStatus(target, error.message || "Çalışma saatleri yüklenemedi. İlgili Supabase migration uygulanmalı.", "error");
    }
  }

  async function loadMallCenter() {
    const form = document.querySelector("[data-avm-center-form]");
    const target = document.querySelector("[data-avm-center-status]");
    if (!form || !target) return null;
    core.renderStatus(target, "AVM merkez profili yükleniyor...");
    try {
      const { data, error } = await App.db.client()
        .from("mall_centers")
        .select("id,slug,name,city,district,address,phone,website_url,hero_image_url,status")
        .eq("slug", mallSlug)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        defaultMallId = null;
        form.reset();
        form.elements.slug.value = mallSlug;
        form.elements.city.value = "İstanbul";
        core.renderStatus(target, "Merkez profili bulunamadı. İlk kayıt sabit merkez koduyla taslak olarak oluşturulacak.");
        return null;
      }
      defaultMallId = data.id;
      fillForm(form, data, false);
      const active = data.status === "active";
      core.renderStatus(
        target,
        active
          ? `${data.name} aktif yayında; ziyaretçi katalog ve hero sorguları bu merkezi kullanıyor.`
          : `${data.name} ${data.status} durumda; ziyaretçi veri sorgularında yayınlanmıyor.`,
        active ? "success" : ""
      );
      return data;
    } catch (error) {
      defaultMallId = undefined;
      core.renderStatus(target, error.message || "AVM merkez profili yüklenemedi.", "error");
      return null;
    }
  }

  function renderServiceZoneOptions(selectedValue) {
    const select = document.querySelector("[data-avm-service-zone-select]");
    if (!select) return;
    const selected = selectedValue === undefined ? select.value : selectedValue;
    const rows = floorZoneRows.filter((zone) => zone.status !== "archived");
    select.innerHTML = `<option value="">Bölgeye bağlama</option>${rows.map((zone) => `<option value="${core.escapeHTML(zone.id)}">${core.escapeHTML(`${zone.title} · ${zone.floor_label}`)}</option>`).join("")}`;
    if (rows.some((zone) => zone.id === selected)) select.value = selected;
  }

  function renderZoneFloorMapOptions(selectedValue) {
    const select = document.querySelector("[data-avm-zone-floor-map-select]");
    if (!select) return;
    const selected = selectedValue === undefined ? select.value : selectedValue;
    const rows = floorMapRows.filter((map) => map.status !== "archived");
    select.innerHTML = `<option value="">Kat planı seçin</option>${rows.map((map) => `<option value="${core.escapeHTML(map.id)}">${core.escapeHTML(`${map.title} · ${map.floor_label} · ${map.status}`)}</option>`).join("")}`;
    if (rows.some((map) => map.id === selected)) select.value = selected;
    const form = select.closest("form");
    const selectedMap = rows.find((map) => map.id === select.value);
    if (form?.elements.floor_label) form.elements.floor_label.value = selectedMap?.floor_label || "";
  }

  function renderParkingZoneOptions(selectedValue) {
    const select = document.querySelector("[data-avm-parking-zone-select]");
    if (!select) return;
    const selected = selectedValue === undefined ? select.value : selectedValue;
    const rows = floorZoneRows.filter((zone) => zone.status !== "archived");
    select.innerHTML = `<option value="">Bölge seçin</option>${rows.map((zone) => `<option value="${core.escapeHTML(zone.id)}">${core.escapeHTML(`${zone.title} · ${zone.floor_label} · ${zone.status}`)}</option>`).join("")}`;
    if (rows.some((zone) => zone.id === selected)) select.value = selected;
  }

  function renderParkingHoursOptions(selectedValue) {
    const select = document.querySelector("[data-avm-parking-hours-select]");
    if (!select) return;
    const selected = selectedValue === undefined ? select.value : selectedValue;
    const rows = hoursProfiles.filter((profile) => profile.scope === "parking" && profile.status !== "archived");
    select.innerHTML = `<option value="">Parking profili seçin</option>${rows.map((profile) => `<option value="${core.escapeHTML(profile.id)}">${core.escapeHTML(`${profile.title} · ${profile.status}`)}</option>`).join("")}`;
    if (rows.some((profile) => profile.id === selected)) select.value = selected;
  }

  function renderDirectoryZoneOptions(selectedValue) {
    const select = document.querySelector("[data-avm-directory-zone-select]");
    if (!select) return;
    const selected = selectedValue === undefined ? select.value : selectedValue;
    const rows = floorZoneRows.filter((zone) => zone.status !== "archived");
    select.innerHTML = `<option value="">Bölgeye bağlama</option>${rows.map((zone) => `<option value="${core.escapeHTML(zone.id)}">${core.escapeHTML(`${zone.title} · ${zone.floor_label}`)}</option>`).join("")}`;
    if (rows.some((zone) => zone.id === selected)) select.value = selected;
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function campaignPartner(redemption) {
    if (Object.prototype.hasOwnProperty.call(redemption, "partner_submission_id")) {
      if (!redemption.partner_submission_id) return null;
      return {
        id: redemption.partner_submission_id,
        brand_name: redemption.partner_brand_name,
        requested_visibility: redemption.partner_requested_visibility,
        visibility_status: redemption.partner_visibility_status
      };
    }
    return campaignPartnerByItemId.get(redemption.directory_item_id) || null;
  }

  function campaignPartnerLabel(partner) {
    if (partner?.brand_name) return partner.brand_name;
    return campaignPartnerLookupFailed ? "Partner verisi kullanılamıyor" : "Organik / eşleşmeyen kampanya";
  }

  function nextDateKey(value) {
    const date = new Date(`${value}T12:00:00Z`);
    if (!Number.isFinite(date.getTime())) return "";
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  function campaignRedemptionFilterSnapshot() {
    return {
      status: campaignRedemptionStatusFilter,
      actionType: campaignRedemptionActionFilter,
      directoryItemId: campaignRedemptionCampaignFilter,
      category: campaignRedemptionCategoryFilter,
      partnerSubmissionId: campaignRedemptionPartnerFilter,
      requestedVisibility: campaignRedemptionVisibilityFilter,
      startDate: campaignRedemptionStartDateFilter,
      endDate: campaignRedemptionEndDateFilter
    };
  }

  async function queryCampaignRedemptionReport(limit, offset, filters = campaignRedemptionFilterSnapshot()) {
    const mallId = await requireDefaultMallId();
    return App.db.client().rpc("get_mall_campaign_redemption_report", {
      report_mall_id: mallId,
      report_status: filters.status || null,
      report_action_type: filters.actionType || null,
      report_directory_item_id: filters.directoryItemId || null,
      report_category: filters.category || null,
      report_partner_submission_id: filters.partnerSubmissionId || null,
      report_requested_visibility: filters.requestedVisibility || null,
      report_start_date: filters.startDate || null,
      report_end_date: filters.endDate || null,
      report_limit: limit,
      report_offset: offset
    });
  }

  async function loadCampaignRedemptionDimensions() {
    try {
      const mallId = await requireDefaultMallId();
      const { data, error } = await App.db.client().rpc("get_mall_campaign_redemption_dimensions", {
        report_mall_id: mallId
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] || {} : data || {};
      campaignRedemptionDimensions = {
        campaigns: Array.isArray(row.campaign_options) ? row.campaign_options : [],
        categories: Array.isArray(row.category_options) ? row.category_options : [],
        partners: Array.isArray(row.partner_options) ? row.partner_options : [],
        visibilities: Array.isArray(row.visibility_options) ? row.visibility_options : []
      };
      campaignPartnerLookupFailed = false;
      campaignRedemptionDimensionsLoaded = true;
    } catch (error) {
      campaignRedemptionDimensions = { campaigns: [], categories: [], partners: [], visibilities: [] };
      campaignPartnerLookupFailed = true;
      campaignRedemptionDimensionsLoaded = false;
    }
  }

  async function exportCampaignRedemptions(button) {
    if (!campaignRedemptionTotal) {
      core.toast("Dışa aktarılacak kampanya ilgi kaydı yok.", "error");
      return;
    }
    button.disabled = true;
    try {
      const filters = campaignRedemptionFilterSnapshot();
      const batchSize = 200;
      const rows = [];
      let expectedTotal = campaignRedemptionTotal;
      for (let offset = 0; offset < expectedTotal; offset += batchSize) {
        const { data, error } = await queryCampaignRedemptionReport(batchSize, offset, filters);
        if (error) throw error;
        const batch = data || [];
        if (!offset && batch[0]) expectedTotal = interactionNumber(batch[0].total_count);
        rows.push(...batch);
        if (batch.length < batchSize) break;
      }
      if (!rows.length) throw new Error("Filtre kapsamındaki kayıtlar artık bulunmuyor.");
      const headers = ["Kampanya", "Kampanya Kodu", "Kategori", "Konum", "Partner / Marka", "İstenen Görünürlük", "Yayın Durumu", "Aksiyon", "Kaynak", "İlgi Durumu", "Tarih"];
      const csvRows = rows.map((redemption) => {
        const partner = campaignPartner(redemption);
        return [
          redemption.campaign_title,
          redemption.directory_public_id,
          redemption.campaign_category,
          redemption.floor_label,
          campaignPartnerLabel(partner),
          partnerVisibilityLabels[partner?.requested_visibility] || partner?.requested_visibility || "-",
          partnerVisibilityLabels[partner?.visibility_status] || partner?.visibility_status || "-",
          campaignActionLabels[redemption.action_type] || redemption.action_type,
          redemption.source_page || "avm-dunyasi",
          campaignRedemptionLabels[redemption.status] || redemption.status,
          redemption.created_at ? new Date(redemption.created_at).toLocaleString("tr-TR") : ""
        ];
      });
      const csv = [headers, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
      const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `avm-kampanya-ilgi-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      core.toast(`${rows.length} kampanya ilgi kaydı CSV olarak hazırlandı.`);
    } catch (error) {
      core.toast(error.message || "Kampanya ilgi raporu hazırlanamadı.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function renderCampaignRedemptions() {
    const target = document.querySelector("[data-avm-admin-campaign-redemptions]");
    if (!target) return;
    const rows = campaignRedemptionRows;
    const totalPages = Math.max(1, Math.ceil(campaignRedemptionTotal / campaignRedemptionPageSize));
    const campaignOptions = campaignRedemptionDimensions.campaigns;
    const categoryOptions = campaignRedemptionDimensions.categories;
    const partnerOptions = campaignRedemptionDimensions.partners;
    const visibilityOptions = campaignRedemptionDimensions.visibilities;
    const hasFilters = Boolean(campaignRedemptionStatusFilter || campaignRedemptionActionFilter || campaignRedemptionCampaignFilter || campaignRedemptionCategoryFilter || campaignRedemptionPartnerFilter || campaignRedemptionVisibilityFilter || campaignRedemptionStartDateFilter || campaignRedemptionEndDateFilter);
    target.innerHTML = `
        <div class="avm-operation-summary" aria-label="Kampanya ilgi operasyon özeti">
          <div class="avm-operation-stat"><span>Filtrelenmiş toplam</span><strong>${campaignRedemptionTotal}</strong></div>
          <div class="avm-operation-stat"><span>Yeni</span><strong>${campaignRedemptionMetrics.newCount}</strong></div>
          <div class="avm-operation-stat"><span>İncelendi</span><strong>${campaignRedemptionMetrics.reviewed}</strong></div>
          <div class="avm-operation-stat"><span>Raporlandı</span><strong>${campaignRedemptionMetrics.exported}</strong></div>
        </div>
        <p class="muted">${rows.length} kayıt bu sayfada / ${campaignRedemptionTotal} eşleşme · ${campaignRedemptionMetrics.archived} arşivlendi · özet ve CSV seçili filtrelerin tamamını kapsar.</p>
        ${campaignPartnerLookupFailed ? '<div class="status-box status-box--error">Kampanya, partner ve görünürlük filtre seçenekleri yüklenemedi; temel kayıtlar ve diğer filtreler kullanılabilir.</div>' : ""}
        <form class="filters avm-admin-redemption-filters" data-avm-redemption-filters>
          <div class="field">
            <label for="avm-redemption-status-filter">Durum</label>
            <select id="avm-redemption-status-filter" data-avm-redemption-filter-status>
              <option value="">Tüm durumlar</option>
              ${Object.entries(campaignRedemptionLabels).map(([value, label]) => `<option value="${value}" ${campaignRedemptionStatusFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="avm-redemption-action-filter">Aksiyon</label>
            <select id="avm-redemption-action-filter" data-avm-redemption-filter-action>
              <option value="">Tüm aksiyonlar</option>
              ${Object.entries(campaignActionLabels).map(([value, label]) => `<option value="${value}" ${campaignRedemptionActionFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="avm-redemption-campaign-filter">Kampanya</label>
            <select id="avm-redemption-campaign-filter" data-avm-redemption-filter-campaign ${campaignPartnerLookupFailed ? "disabled" : ""}>
              <option value="">Tüm kampanyalar</option>
              ${campaignOptions.map((option) => `<option value="${core.escapeHTML(option.value)}" ${campaignRedemptionCampaignFilter === option.value ? "selected" : ""}>${core.escapeHTML(option.label)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="avm-redemption-category-filter">Kategori</label>
            <select id="avm-redemption-category-filter" data-avm-redemption-filter-category ${campaignPartnerLookupFailed ? "disabled" : ""}>
              <option value="">Tüm kategoriler</option>
              ${categoryOptions.map((option) => `<option value="${core.escapeHTML(option.value)}" ${campaignRedemptionCategoryFilter === option.value ? "selected" : ""}>${core.escapeHTML(option.label)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="avm-redemption-partner-filter">Partner / Marka</label>
            <select id="avm-redemption-partner-filter" data-avm-redemption-filter-partner ${campaignPartnerLookupFailed ? "disabled" : ""}>
              <option value="">Tüm partnerler</option>
              ${partnerOptions.map((option) => `<option value="${core.escapeHTML(option.value)}" ${campaignRedemptionPartnerFilter === option.value ? "selected" : ""}>${core.escapeHTML(option.label)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="avm-redemption-visibility-filter">Görünürlük</label>
            <select id="avm-redemption-visibility-filter" data-avm-redemption-filter-visibility ${campaignPartnerLookupFailed ? "disabled" : ""}>
              <option value="">Tüm görünürlükler</option>
              ${visibilityOptions.map((option) => `<option value="${core.escapeHTML(option.value)}" ${campaignRedemptionVisibilityFilter === option.value ? "selected" : ""}>${core.escapeHTML(partnerVisibilityLabels[option.value] || option.label)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="avm-redemption-start-filter">Başlangıç</label>
            <input id="avm-redemption-start-filter" type="date" data-avm-redemption-filter-start value="${core.escapeHTML(campaignRedemptionStartDateFilter)}" ${campaignRedemptionEndDateFilter ? `max="${core.escapeHTML(campaignRedemptionEndDateFilter)}"` : ""}>
          </div>
          <div class="field">
            <label for="avm-redemption-end-filter">Bitiş</label>
            <input id="avm-redemption-end-filter" type="date" data-avm-redemption-filter-end value="${core.escapeHTML(campaignRedemptionEndDateFilter)}" ${campaignRedemptionStartDateFilter ? `min="${core.escapeHTML(campaignRedemptionStartDateFilter)}"` : ""}>
          </div>
          <div class="field">
            <label for="avm-redemption-page-size">Sayfa başına</label>
            <select id="avm-redemption-page-size" data-avm-redemption-page-size>
              ${[25, 50, 100].map((value) => `<option value="${value}" ${campaignRedemptionPageSize === value ? "selected" : ""}>${value} kayıt</option>`).join("")}
            </select>
          </div>
          <div class="field field--actions">
            <label aria-hidden="true">&nbsp;</label>
            <div class="avm-redemption-filter-actions">
              <button class="btn btn--light" type="button" data-avm-redemption-reset>Temizle</button>
              <button class="btn" type="button" data-avm-redemption-export aria-label="Filtrelenmiş kampanya ilgi raporunu CSV olarak indir">CSV İndir</button>
            </div>
          </div>
        </form>
        ${rows.length
          ? `
            <div class="table-wrap">
              <table class="data-table data-table--wide">
                <thead><tr><th>Kampanya</th><th>Konum</th><th>Partner / Görünürlük</th><th>Aksiyon</th><th>Kaynak</th><th>Durum</th><th>Tarih</th></tr></thead>
                <tbody>
                  ${rows.map((redemption) => {
                    const partner = campaignPartner(redemption);
                    return `
                      <tr>
                        <td><strong>${core.escapeHTML(redemption.campaign_title)}</strong><br><small>${core.escapeHTML(redemption.directory_public_id || "-")}</small></td>
                        <td>${core.escapeHTML(redemption.campaign_category || "-")}<br><small>${core.escapeHTML(redemption.floor_label || "-")}</small></td>
                        <td>${core.escapeHTML(campaignPartnerLabel(partner))}<br><small>${core.escapeHTML(partnerVisibilityLabels[partner?.requested_visibility] || partner?.requested_visibility || "-")} · ${core.escapeHTML(partnerVisibilityLabels[partner?.visibility_status] || partner?.visibility_status || "-")}</small></td>
                        <td>${core.escapeHTML(campaignActionLabels[redemption.action_type] || redemption.action_type || "İlgi kaydı")}</td>
                        <td>${core.escapeHTML(redemption.source_page || "avm-dunyasi")}${redemption.visitor_email ? `<br><small>${core.escapeHTML(redemption.visitor_email)}</small>` : ""}</td>
                        <td>
                          <select data-avm-redemption-status="${core.escapeHTML(redemption.redemption_id || redemption.id)}">
                            ${Object.entries(campaignRedemptionLabels).map(([value, label]) => `<option value="${value}" ${redemption.status === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
                          </select>
                        </td>
                        <td>${redemption.created_at ? new Date(redemption.created_at).toLocaleString("tr-TR") : "-"}</td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
            <nav class="avm-report-pagination" aria-label="Kampanya ilgi kaydı sayfaları">
              <button class="icon-btn" type="button" data-avm-redemption-previous aria-label="Önceki sayfa" title="Önceki sayfa" ${campaignRedemptionPage <= 1 ? "disabled" : ""}>←</button>
              <span>Sayfa ${campaignRedemptionPage} / ${totalPages}</span>
              <button class="icon-btn" type="button" data-avm-redemption-next aria-label="Sonraki sayfa" title="Sonraki sayfa" ${campaignRedemptionPage >= totalPages ? "disabled" : ""}>→</button>
            </nav>
          `
          : `<div class="empty-state">${hasFilters ? "Bu filtrelerle eşleşen kampanya ilgi kaydı yok." : "Henüz kampanya ilgi kaydı yok. Canlı ziyaretçi kampanya aksiyonları burada görünür."}</div>`}
      `;
  }

  function directoryInteractionItem(row) {
    if (Object.prototype.hasOwnProperty.call(row, "item_title")) {
      return {
        title: row.item_title,
        category: row.item_category,
        item_type: row.item_type,
        floor_label: row.floor_label
      };
    }
    return Array.isArray(row.directory_item) ? row.directory_item[0] || {} : row.directory_item || {};
  }

  function interactionNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  async function queryDirectoryInteractionReport(limit, offset) {
    const mallId = await requireDefaultMallId();
    return App.db.client().rpc("get_mall_directory_interaction_report", {
      report_mall_id: mallId,
      report_interaction_type: directoryInteractionTypeFilter || null,
      report_search: directoryInteractionSearchFilter.trim() || null,
      report_start_date: directoryInteractionStartDateFilter || null,
      report_end_date: directoryInteractionEndDateFilter || null,
      report_limit: limit,
      report_offset: offset
    });
  }

  async function exportDirectoryInteractions(button) {
    if (!directoryInteractionTotal) {
      core.toast("Dışa aktarılacak katalog etkileşimi yok.", "error");
      return;
    }
    button.disabled = true;
    try {
      const batchSize = 200;
      const rows = [];
      let expectedTotal = directoryInteractionTotal;
      for (let offset = 0; offset < expectedTotal; offset += batchSize) {
        const { data, error } = await queryDirectoryInteractionReport(batchSize, offset);
        if (error) throw error;
        const batch = data || [];
        if (!offset && batch[0]) expectedTotal = interactionNumber(batch[0].total_count);
        rows.push(...batch);
        if (batch.length < batchSize) break;
      }
      if (!rows.length) throw new Error("Filtre kapsamındaki kayıtlar artık bulunmuyor.");
      const headers = ["İçerik", "İçerik Kodu", "Tür", "Kategori", "Kat", "Etkileşim", "Kaynak", "Etkileşim Günü", "Tarih"];
      const csvRows = rows.map((row) => {
        const item = directoryInteractionItem(row);
        return [
          item.title || "Yayından kaldırılmış içerik",
          row.directory_public_id,
          item.item_type,
          item.category,
          item.floor_label,
          directoryInteractionLabels[row.interaction_type] || row.interaction_type,
          row.source_page,
          row.interaction_date,
          row.created_at ? new Date(row.created_at).toLocaleString("tr-TR") : ""
        ];
      });
      const csv = [headers, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
      const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `avm-katalog-etkilesimleri-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      core.toast(`${rows.length} katalog etkileşimi CSV olarak hazırlandı.`);
    } catch (error) {
      core.toast(error.message || "Katalog etkileşim raporu hazırlanamadı.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function renderDirectoryInteractions() {
    const target = document.querySelector("[data-avm-admin-directory-interactions]");
    if (!target) return;
    const totalPages = Math.max(1, Math.ceil(directoryInteractionTotal / directoryInteractionPageSize));
    target.innerHTML = `
      <p class="muted">${directoryInteractionRows.length} kayıt bu sayfada / ${directoryInteractionTotal} eşleşme · ${directoryInteractionMetrics.detail} detay · ${directoryInteractionMetrics.routePlan} rota/plan · ${directoryInteractionMetrics.outbound} dış aksiyon · ${directoryInteractionMetrics.share} paylaşım</p>
      <form class="filters avm-admin-directory-interaction-filters" data-avm-directory-interaction-filters>
        <div class="field">
          <label for="avm-directory-interaction-type-filter">Etkileşim</label>
          <select id="avm-directory-interaction-type-filter" data-avm-directory-interaction-filter-type>
            <option value="">Tüm etkileşimler</option>
            ${Object.entries(directoryInteractionLabels).map(([value, label]) => `<option value="${value}" ${directoryInteractionTypeFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="avm-directory-interaction-search-filter">İçerik ara</label>
          <input id="avm-directory-interaction-search-filter" type="search" data-avm-directory-interaction-filter-search value="${core.escapeHTML(directoryInteractionSearchFilter)}" placeholder="Başlık, kod veya kategori">
        </div>
        <div class="field">
          <label for="avm-directory-interaction-start-filter">Başlangıç</label>
          <input id="avm-directory-interaction-start-filter" type="date" data-avm-directory-interaction-filter-start value="${core.escapeHTML(directoryInteractionStartDateFilter)}" ${directoryInteractionEndDateFilter ? `max="${core.escapeHTML(directoryInteractionEndDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="avm-directory-interaction-end-filter">Bitiş</label>
          <input id="avm-directory-interaction-end-filter" type="date" data-avm-directory-interaction-filter-end value="${core.escapeHTML(directoryInteractionEndDateFilter)}" ${directoryInteractionStartDateFilter ? `min="${core.escapeHTML(directoryInteractionStartDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="avm-directory-interaction-page-size">Sayfa başına</label>
          <select id="avm-directory-interaction-page-size" data-avm-directory-interaction-page-size>
            ${[25, 50, 100].map((value) => `<option value="${value}" ${directoryInteractionPageSize === value ? "selected" : ""}>${value} kayıt</option>`).join("")}
          </select>
        </div>
        <div class="field field--actions">
          <label aria-hidden="true">&nbsp;</label>
          <div class="avm-redemption-filter-actions">
            <button class="btn btn--light" type="button" data-avm-directory-interaction-reset>Temizle</button>
            <button class="btn" type="button" data-avm-directory-interaction-export aria-label="Katalog etkileşim raporunu CSV olarak indir">CSV İndir</button>
          </div>
        </div>
      </form>
      ${directoryInteractionRows.length
        ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>İçerik</th><th>Konum</th><th>Etkileşim</th><th>Kaynak</th><th>Tarih</th></tr></thead>
              <tbody>
                ${directoryInteractionRows.map((row) => {
                  const item = directoryInteractionItem(row);
                  const detailHref = row.directory_item_id ? `../avm-detay.html?item=${encodeURIComponent(row.directory_item_id)}` : "";
                  return `
                    <tr>
                      <td><strong>${core.escapeHTML(item.title || "Yayından kaldırılmış içerik")}</strong><br><small>${core.escapeHTML(row.directory_public_id || "-")}</small>${detailHref ? `<br><a class="link-btn" href="${core.escapeHTML(detailHref)}">Detayı aç</a>` : ""}</td>
                      <td>${core.escapeHTML(item.category || item.item_type || "-")}<br><small>${core.escapeHTML(item.floor_label || "-")}</small></td>
                      <td>${core.escapeHTML(directoryInteractionLabels[row.interaction_type] || row.interaction_type || "-")}</td>
                      <td>${core.escapeHTML(row.source_page || "-")}</td>
                      <td>${row.created_at ? new Date(row.created_at).toLocaleString("tr-TR") : core.escapeHTML(row.interaction_date || "-")}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
          <nav class="avm-report-pagination" aria-label="Katalog etkileşim sayfaları">
            <button class="icon-btn" type="button" data-avm-directory-interaction-previous aria-label="Önceki sayfa" title="Önceki sayfa" ${directoryInteractionPage <= 1 ? "disabled" : ""}>←</button>
            <span>Sayfa ${directoryInteractionPage} / ${totalPages}</span>
            <button class="icon-btn" type="button" data-avm-directory-interaction-next aria-label="Sonraki sayfa" title="Sonraki sayfa" ${directoryInteractionPage >= totalPages ? "disabled" : ""}>→</button>
          </nav>
        `
        : `<div class="empty-state">${directoryInteractionTypeFilter || directoryInteractionSearchFilter || directoryInteractionStartDateFilter || directoryInteractionEndDateFilter ? "Bu filtrelerle eşleşen katalog etkileşimi yok." : "Henüz katalog etkileşimi yok. Canlı detay, rota, plan ve iletişim aksiyonları burada görünür."}</div>`}
    `;
  }

  async function resolveDefaultMallId() {
    if (defaultMallId !== undefined) return defaultMallId;
    const { data, error } = await App.db.client()
      .from("mall_centers")
      .select("id")
      .eq("slug", mallSlug)
      .maybeSingle();
    if (error) throw error;
    defaultMallId = data?.id || null;
    return defaultMallId;
  }

  async function requireDefaultMallId() {
    const mallId = await resolveDefaultMallId();
    if (!mallId) {
      throw new Error("AVM merkez kaydı bulunamadı. Merkez kaydı doğrulanıp yayına alınmalı.");
    }
    return mallId;
  }

  async function guard() {
    const shell = document.querySelector("[data-admin-avm-shell]");
    if (!shell) return null;
    try {
      return await App.auth.requireRole(["admin", "super_admin"]);
    } catch (error) {
      shell.innerHTML = `<div class="status-box status-box--error">${core.escapeHTML(error.message)}</div>`;
      return null;
    }
  }

  async function loadDirectory() {
    const target = document.querySelector("[data-avm-admin-directory]");
    if (!target) return;
    if (!target.dataset.mediaErrorBound) {
      target.dataset.mediaErrorBound = "true";
      target.addEventListener("error", (event) => {
        if (!event.target.matches("[data-avm-admin-directory-image]")) return;
        const label = document.createElement("span");
        label.textContent = "Görsel yüklenemedi";
        event.target.replaceWith(label);
      }, true);
    }
    core.renderStatus(target, "AVM içerikleri yükleniyor...");
    try {
      const mallId = await requireDefaultMallId();
      const { data, error } = await App.db.client()
        .from("mall_directory_items")
        .select("*")
        .eq("mall_id", mallId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      const rows = data || [];
      directoryRows = rows;
      renderHoursDirectoryOptions();
      const zoneLookup = new Map(floorZoneRows.map((zone) => [zone.id, zone]));
      target.innerHTML = rows.length
        ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Görsel</th><th>Başlık</th><th>Tür</th><th>Kategori</th><th>Kat</th><th>Yayın aralığı</th><th>Etiket</th><th>Durum</th><th></th></tr></thead>
              <tbody>
                  ${rows.map((item) => `
                  <tr>
                    <td>${directoryMediaCell(item)}</td>
                    <td>${core.escapeHTML(item.title)}</td>
                    <td>${core.escapeHTML(item.item_type)}</td>
                    <td>${core.escapeHTML(item.category)}</td>
                    <td>${core.escapeHTML(item.floor_label)}${zoneLookup.get(item.floor_zone_id) ? `<br><small>${core.escapeHTML(zoneLookup.get(item.floor_zone_id).title)}</small>` : ""}</td>
                    <td>${core.escapeHTML(formatDirectorySchedule(item))}</td>
                    <td>${core.escapeHTML(tagsToText(item.tags))}</td>
                    <td>${rowStatus(item.status)}</td>
                    <td>
                      <button class="btn btn--light" type="button" data-avm-edit='${core.escapeHTML(JSON.stringify(item))}'>Düzenle</button>
                      ${item.status === "active" ? `<a class="btn btn--light" href="../avm-detay.html?item=${encodeURIComponent(item.public_id)}">Detayı Aç</a>` : ""}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="empty-state">AVM içeriği bulunamadı. Gerçek katalog kayıtları admin formundan oluşturulduğunda burada görünür.</div>`;
    } catch (error) {
      directoryRows = [];
      renderHoursDirectoryOptions("");
      core.renderStatus(target, error.message || "AVM içerikleri yüklenemedi. Supabase AVM migration uygulanmalı.", "error");
    }
  }

  async function loadFloorMaps() {
    const target = document.querySelector("[data-avm-admin-maps]");
    if (!target) return;
    core.renderStatus(target, "Kat planı görselleri yükleniyor...");
    try {
      const mallId = await requireDefaultMallId();
      const { data, error } = await App.db.client()
        .from("mall_floor_maps")
        .select("*")
        .eq("mall_id", mallId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      const rows = data || [];
      floorMapRows = rows;
      renderZoneFloorMapOptions();
      renderZonePreview(previewZoneId);
      target.innerHTML = rows.length
        ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Harita</th><th>Kat</th><th>Bucket</th><th>Görsel</th><th>Durum</th><th></th></tr></thead>
              <tbody>
                ${rows.map((map) => `
                  <tr>
                    <td>${core.escapeHTML(map.title)}</td>
                    <td>${core.escapeHTML(map.floor_label)}</td>
                    <td>${core.escapeHTML(map.storage_bucket || "mall-assets")}</td>
                    <td>${map.image_url ? `<a href="${core.escapeHTML(map.image_url)}" target="_blank" rel="noopener">Aç</a>` : "-"}</td>
                    <td>${rowStatus(map.status)}</td>
                    <td>
                      <button class="btn btn--light" type="button" data-avm-map-edit='${core.escapeHTML(JSON.stringify(map))}'>Düzenle</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="empty-state">Kat planı görsel kaydı bulunamadı. Supabase floor map migration'ı ve mall-assets bucket adımı uygulandıktan sonra kayıtlar burada görünür.</div>`;
    } catch (error) {
      floorMapRows = [];
      renderZoneFloorMapOptions("");
      renderZonePreview("");
      core.renderStatus(target, error.message || "Kat planı görselleri yüklenemedi. Supabase floor map migration uygulanmalı.", "error");
    }
  }

  async function loadFloorZones() {
    const target = document.querySelector("[data-avm-admin-zones]");
    if (!target) return;
    core.renderStatus(target, "Kat planı bölgeleri yükleniyor...");
    try {
      const mallId = await requireDefaultMallId();
      const { data, error } = await App.db.client()
        .from("mall_floor_zones")
        .select("*")
        .eq("mall_id", mallId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      const rows = data || [];
      floorZoneRows = rows;
      renderServiceZoneOptions();
      renderParkingZoneOptions();
      renderDirectoryZoneOptions();
      renderZonePreview(previewZoneId);
      if (parkingAreaRows.length) renderParkingAreas();
      const mapLookup = new Map(floorMapRows.map((map) => [map.id, map]));
      target.innerHTML = rows.length
        ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Bölge</th><th>Kat planı</th><th>Tür</th><th>Koordinat</th><th>Durum</th><th></th></tr></thead>
              <tbody>
                ${rows.map((zone) => `
                  <tr>
                    <td>${core.escapeHTML(zone.title)}</td>
                    <td>${mapLookup.get(zone.floor_map_id) ? core.escapeHTML(`${mapLookup.get(zone.floor_map_id).title} · ${zone.floor_label}`) : `<span class="pill">Bağlantı bekliyor</span><br><small>${core.escapeHTML(zone.floor_label)}</small>`}</td>
                    <td>${core.escapeHTML(zone.zone_type)}</td>
                    <td>${core.escapeHTML(`${zone.map_x_percent ?? "-"} / ${zone.map_y_percent ?? "-"} / ${zone.map_width_percent ?? "-"} / ${zone.map_height_px ?? "-"}`)}</td>
                    <td>${rowStatus(zone.status)}</td>
                    <td>
                      <button class="btn btn--light" type="button" data-avm-zone-edit='${core.escapeHTML(JSON.stringify(zone))}'>Düzenle</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="empty-state">Kat planı bölgesi bulunamadı. Supabase genişleme migration'ı çalıştırıldıktan sonra başlangıç bölgeleri burada görünür.</div>`;
    } catch (error) {
      floorZoneRows = [];
      renderServiceZoneOptions("");
      renderParkingZoneOptions("");
      renderDirectoryZoneOptions("");
      renderZonePreview("");
      core.renderStatus(target, error.message || "Kat planı bölgeleri yüklenemedi. Supabase AVM migration uygulanmalı.", "error");
    }
  }

  function parkingAvailabilityMeta(area) {
    if (area.availability_status === "unknown") {
      return { stale: false, label: "Zaman damgalı doluluk bilgisi yok" };
    }
    const updatedAt = new Date(area.availability_updated_at || "").getTime();
    if (!Number.isFinite(updatedAt)) {
      return { stale: true, label: "Doluluk zaman damgası geçersiz" };
    }
    const ageMs = Date.now() - updatedAt;
    const minutes = Math.max(0, Math.floor(ageMs / 60000));
    const stale = ageMs > 15 * 60000 || ageMs < -5 * 60000;
    if (ageMs < -5 * 60000) {
      return { stale: true, label: "Doluluk zaman damgası gelecekte" };
    }
    const age = minutes < 1 ? "şimdi" : `${minutes} dk önce`;
    return {
      stale,
      label: `${stale ? "Güncelliğini yitirdi" : "Güncel"} · ${age} · ${area.availability_source === "integration" ? "entegrasyon" : "manuel"}`
    };
  }

  function renderParkingAreas() {
    const target = document.querySelector("[data-avm-admin-parking]");
    if (!target) return;
    target.innerHTML = parkingAreaRows.length
      ? `
        <div class="table-wrap">
          <table class="data-table data-table--wide">
            <thead><tr><th>Alan</th><th>Giriş / bağlantı</th><th>Kapasite</th><th>Özel alanlar</th><th>Doluluk</th><th>Yayın</th><th></th></tr></thead>
            <tbody>
              ${parkingAreaRows.map((area) => {
                const zone = floorZoneRows.find((row) => row.id === area.floor_zone_id);
                const profile = hoursProfiles.find((row) => row.id === area.hours_profile_id);
                const availability = parkingAvailabilityMeta(area);
                const available = area.spaces_available === null || area.spaces_available === undefined
                  ? "-"
                  : `${area.spaces_available} boş`;
                return `
                  <tr>
                    <td><strong>${core.escapeHTML(area.title)}</strong><br><small>${core.escapeHTML(`${area.public_id} · ${area.level_label}`)}</small></td>
                    <td>${core.escapeHTML(area.entrance_label)}<br><small>${core.escapeHTML(zone ? `${zone.title} · ${zone.status}` : "Kat planı bağlantısı yok")} · ${core.escapeHTML(profile ? `${profile.title} · ${profile.status}` : "Saat profili yok")}</small>${validHttpUrl(area.directions_url) ? `<br><a class="link-btn" href="${core.escapeHTML(area.directions_url)}" target="_blank" rel="noopener">Araç Rotası</a>` : ""}</td>
                    <td>${area.capacity_total} toplam${area.max_height_m ? `<br><small>Azami ${core.escapeHTML(area.max_height_m)} m</small>` : ""}</td>
                    <td><small>Erişilebilir ${area.accessible_spaces} · Aile ${area.family_spaces}<br>EV ${area.ev_charging_spaces} · Motosiklet ${area.motorcycle_spaces}</small></td>
                    <td>${core.escapeHTML(parkingAvailabilityLabels[area.availability_status] || area.availability_status)} · ${core.escapeHTML(available)}<br><small class="${availability.stale ? "text-danger" : ""}">${core.escapeHTML(availability.label)}</small></td>
                    <td>${rowStatus(area.status)}</td>
                    <td><button class="btn btn--light" type="button" data-avm-parking-edit='${core.escapeHTML(JSON.stringify(area))}'>Düzenle</button></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `
      : `<div class="empty-state">Otopark alanı bulunamadı. İlk gerçek alanı taslak olarak oluşturup kat planı ve parking saat profiline bağlayın.</div>`;
  }

  async function loadParkingAreas() {
    const target = document.querySelector("[data-avm-admin-parking]");
    if (!target) return;
    core.renderStatus(target, "Otopark alanları yükleniyor...");
    try {
      const mallId = await requireDefaultMallId();
      const { data, error } = await App.db.client()
        .from("mall_parking_areas")
        .select("*")
        .eq("mall_id", mallId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      parkingAreaRows = data || [];
      renderParkingZoneOptions();
      renderParkingHoursOptions();
      renderParkingAreas();
    } catch (error) {
      parkingAreaRows = [];
      core.renderStatus(target, error.message || "Otopark alanları yüklenemedi. Supabase otopark migration uygulanmalı.", "error");
    }
  }

  async function loadServices() {
    const target = document.querySelector("[data-avm-admin-services]");
    if (!target) return;
    core.renderStatus(target, "Ziyaretçi hizmetleri yükleniyor...");
    try {
      const mallId = await requireDefaultMallId();
      const { data, error } = await App.db.client()
        .from("mall_services")
        .select("*")
        .eq("mall_id", mallId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      const rows = data || [];
      target.innerHTML = rows.length
        ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Hizmet</th><th>Kategori</th><th>Konum</th><th>Çalışma</th><th>Erişilebilirlik</th><th>Yayın</th><th></th></tr></thead>
              <tbody>
                ${rows.map((service) => `
                  <tr>
                    <td><strong>${core.escapeHTML(service.title)}</strong><br><small>${core.escapeHTML(service.public_id)}</small></td>
                    <td>${core.escapeHTML(serviceCategoryLabels[service.category] || service.category)}</td>
                    <td>${core.escapeHTML(service.floor_label)}${service.operating_hours ? `<br><small>${core.escapeHTML(service.operating_hours)}</small>` : ""}</td>
                    <td>${core.escapeHTML(serviceAvailabilityLabels[service.availability_status] || service.availability_status)}${service.availability_note ? `<br><small>${core.escapeHTML(service.availability_note)}</small>` : ""}</td>
                    <td>${service.is_accessibility_service ? "Evet" : "Hayır"}</td>
                    <td>${rowStatus(service.status)}</td>
                    <td><button class="btn btn--light" type="button" data-avm-service-edit='${core.escapeHTML(JSON.stringify(service))}'>Düzenle</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="empty-state">Ziyaretçi hizmeti bulunamadı. İlk gerçek hizmet kaydını formdan taslak olarak oluşturun.</div>`;
    } catch (error) {
      core.renderStatus(target, error.message || "Ziyaretçi hizmetleri yüklenemedi. Supabase mall_services migration uygulanmalı.", "error");
    }
  }

  function renderTransportRoutes() {
    const target = document.querySelector("[data-avm-admin-transport]");
    if (!target) return;
    target.innerHTML = transportRouteRows.length
      ? `
        <div class="table-wrap">
          <table class="data-table data-table--wide">
            <thead><tr><th>Rota</th><th>Başlangıç / varış</th><th>Sefer</th><th>Durum</th><th>Yayın</th><th></th></tr></thead>
            <tbody>
              ${transportRouteRows.map((route) => `
                <tr>
                  <td><strong>${core.escapeHTML(route.title)}</strong><br><small>${core.escapeHTML(transportModeLabels[route.mode] || route.mode)}${route.route_number ? ` · ${core.escapeHTML(route.route_number)}` : ""}</small></td>
                  <td>${core.escapeHTML(route.origin_label)} → ${core.escapeHTML(route.destination_label)}${route.stop_name ? `<br><small>${core.escapeHTML(route.stop_name)}</small>` : ""}</td>
                  <td>${core.escapeHTML(route.schedule_text || "Henüz girilmedi")}${route.duration_text ? `<br><small>${core.escapeHTML(route.duration_text)}</small>` : ""}</td>
                  <td>${core.escapeHTML(transportStatusLabels[route.service_status] || route.service_status)}</td>
                  <td>${rowStatus(route.status)}</td>
                  <td><button class="btn btn--light" type="button" data-avm-transport-edit='${core.escapeHTML(JSON.stringify(route))}'>Düzenle</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : `<div class="empty-state">Ulaşım rotası bulunamadı. İlk doğrulanmış rotayı taslak olarak oluşturun.</div>`;
  }

  async function loadTransportRoutes() {
    const target = document.querySelector("[data-avm-admin-transport]");
    if (!target) return;
    core.renderStatus(target, "Ulaşım rotaları yükleniyor...");
    try {
      const mallId = await requireDefaultMallId();
      const { data, error } = await App.db.client()
        .from("mall_transport_routes")
        .select("*")
        .eq("mall_id", mallId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      transportRouteRows = data || [];
      renderTransportRoutes();
    } catch (error) {
      transportRouteRows = [];
      core.renderStatus(target, error.message || "Ulaşım rotaları yüklenemedi. Supabase mall_transport_routes migration uygulanmalı.", "error");
    }
  }

  function noticeWindowLabel(row) {
    const options = { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" };
    return `${new Date(row.starts_at).toLocaleString("tr-TR", options)} - ${new Date(row.ends_at).toLocaleString("tr-TR", options)}`;
  }

  function renderOperationalNotices() {
    const target = document.querySelector("[data-avm-admin-notices]");
    if (!target) return;
    const now = Date.now();
    target.innerHTML = operationalNoticeRows.length
      ? `
        <div class="table-wrap">
          <table class="data-table data-table--wide">
            <thead><tr><th>Duyuru</th><th>Tür / önem</th><th>Yayın aralığı</th><th>Etkilenen alan</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              ${operationalNoticeRows.map((row) => {
                const current = row.status === "active" && new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() >= now;
                return `
                  <tr>
                    <td><strong>${core.escapeHTML(row.title)}</strong><br><small>${core.escapeHTML(row.public_id)}</small></td>
                    <td>${core.escapeHTML(noticeTypeLabels[row.notice_type] || row.notice_type)} · ${core.escapeHTML(noticeSeverityLabels[row.severity] || row.severity)}</td>
                    <td>${core.escapeHTML(noticeWindowLabel(row))}<br><small>${current ? "Şu anda görünür" : "Yayın aralığı dışında"}</small></td>
                    <td>${core.escapeHTML(row.affected_area || "-")}</td>
                    <td>${rowStatus(row.status)}</td>
                    <td><button class="btn btn--light" type="button" data-avm-notice-edit='${core.escapeHTML(JSON.stringify(row))}'>Düzenle</button></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `
      : `<div class="empty-state">Operasyon duyurusu bulunamadı. Yalnızca doğrulanmış gerçek bir etki oluştuğunda taslak kayıt oluşturun.</div>`;
  }

  async function loadOperationalNotices() {
    const target = document.querySelector("[data-avm-admin-notices]");
    if (!target) return;
    core.renderStatus(target, "Operasyon duyuruları yükleniyor...");
    try {
      const mallId = await requireDefaultMallId();
      const { data, error } = await App.db.client()
        .from("mall_operational_notices")
        .select("*")
        .eq("mall_id", mallId)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      operationalNoticeRows = data || [];
      renderOperationalNotices();
    } catch (error) {
      operationalNoticeRows = [];
      core.renderStatus(target, error.message || "Operasyon duyuruları yüklenemedi. Supabase mall_operational_notices migration uygulanmalı.", "error");
    }
  }

  async function loadAdSlots() {
    const target = document.querySelector("[data-avm-admin-ad-slots]");
    if (!target) return;
    core.renderStatus(target, "Reklam envanteri yükleniyor...");
    try {
      const mallId = await requireDefaultMallId();
      const { data, error } = await App.db.client()
        .from("mall_ad_slots")
        .select("*")
        .eq("mall_id", mallId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      const rows = data || [];
      target.innerHTML = rows.length
        ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Alan</th><th>Tür</th><th>Yerleşim</th><th>Lead hedefi</th><th>Durum</th><th></th></tr></thead>
              <tbody>
                ${rows.map((slot) => `
                  <tr>
                    <td>${core.escapeHTML(slot.title)}</td>
                    <td>${core.escapeHTML(slot.slot_type)}</td>
                    <td>${core.escapeHTML(slot.placement)}</td>
                    <td>${core.escapeHTML(slot.lead_goal || "-")}</td>
                    <td>${rowStatus(slot.status)}</td>
                    <td>
                      <button class="btn btn--light" type="button" data-avm-ad-edit='${core.escapeHTML(JSON.stringify(slot))}'>Düzenle</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="empty-state">Reklam envanteri kaydı bulunamadı. Gerçek reklam alanları admin formundan taslak olarak oluşturulduğunda burada görünür.</div>`;
    } catch (error) {
      core.renderStatus(target, error.message || "Reklam envanteri yüklenemedi. Supabase AVM migration uygulanmalı.", "error");
    }
  }

  function leadFilterSnapshot() {
    return {
      status: leadStatusFilter,
      interestType: leadInterestTypeFilter,
      search: leadSearchFilter,
      startDate: leadStartDateFilter,
      endDate: leadEndDateFilter
    };
  }

  function queryLeadReport(limit, offset, filters = leadFilterSnapshot()) {
    return App.db.client().rpc("get_mall_lead_report", {
      report_status: filters.status || null,
      report_interest_type: filters.interestType || null,
      report_search: filters.search.trim() || null,
      report_start_date: filters.startDate || null,
      report_end_date: filters.endDate || null,
      report_limit: limit,
      report_offset: offset
    });
  }

  async function exportLeads(button) {
    if (!leadTotal) {
      core.toast("Dışa aktarılacak AVM ön görüşmesi yok.", "error");
      return;
    }
    button.disabled = true;
    try {
      const filters = leadFilterSnapshot();
      const batchSize = 200;
      const rows = [];
      let expectedTotal = leadTotal;
      for (let offset = 0; offset < expectedTotal; offset += batchSize) {
        const { data, error } = await queryLeadReport(batchSize, offset, filters);
        if (error) throw error;
        const batch = data || [];
        if (!offset && batch[0]) expectedTotal = interactionNumber(batch[0].total_count);
        rows.push(...batch);
        if (batch.length < batchSize) break;
      }
      if (!rows.length) throw new Error("Filtre kapsamındaki ön görüşmeler artık bulunmuyor.");
      const headers = ["AVM", "Yetkili Rolü", "E-posta", "Telefon", "Görüşme Türü", "AVM Segmenti", "İhtiyaç", "Kaynak", "Durum", "Tarih"];
      const csvRows = rows.map((lead) => [
        lead.mall_name,
        lead.contact_role,
        lead.email,
        lead.phone,
        leadInterestTypeLabels[lead.interest_type] || lead.interest_type,
        lead.mall_size,
        lead.need_summary,
        lead.source_page,
        leadStatusLabels[lead.status] || lead.status,
        lead.created_at ? new Date(lead.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : ""
      ]);
      const csv = [headers, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
      const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `avm-on-gorusmeler-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      core.toast(`${rows.length} AVM ön görüşmesi CSV olarak hazırlandı.`);
    } catch (error) {
      core.toast(error.message || "AVM ön görüşme raporu hazırlanamadı.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function renderLeads() {
    const target = document.querySelector("[data-avm-admin-leads]");
    if (!target) return;
    const totalPages = Math.max(1, Math.ceil(leadTotal / leadPageSize));
    const hasFilters = Boolean(leadStatusFilter || leadInterestTypeFilter || leadSearchFilter || leadStartDateFilter || leadEndDateFilter);
    target.innerHTML = `
      <div class="avm-operation-summary" aria-label="AVM ön görüşme operasyon özeti">
        <div class="avm-operation-stat"><span>Filtrelenmiş görüşme</span><strong>${leadTotal}</strong></div>
        <div class="avm-operation-stat"><span>Yeni</span><strong>${leadMetrics.newCount}</strong></div>
        <div class="avm-operation-stat"><span>İletişime geçildi</span><strong>${leadMetrics.contacted}</strong></div>
        <div class="avm-operation-stat"><span>Nitelikli</span><strong>${leadMetrics.qualified}</strong></div>
      </div>
      <p class="muted">${leadRows.length} kayıt bu sayfada / ${leadTotal} eşleşme · ${leadMetrics.archived} arşivlendi</p>
      <form class="filters avm-admin-lead-filters" data-avm-lead-filters>
        <div class="field">
          <label for="avm-lead-status-filter">Durum</label>
          <select id="avm-lead-status-filter" data-avm-lead-filter-status>
            <option value="">Tüm durumlar</option>
            ${Object.entries(leadStatusLabels).map(([value, label]) => `<option value="${value}" ${leadStatusFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="avm-lead-interest-filter">Görüşme türü</label>
          <select id="avm-lead-interest-filter" data-avm-lead-filter-interest>
            <option value="">Tüm görüşme türleri</option>
            ${Object.entries(leadInterestTypeLabels).map(([value, label]) => `<option value="${value}" ${leadInterestTypeFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="avm-lead-search-filter">Görüşme ara</label>
          <input id="avm-lead-search-filter" type="search" data-avm-lead-filter-search value="${core.escapeHTML(leadSearchFilter)}" placeholder="AVM, yetkili, iletişim veya ihtiyaç">
        </div>
        <div class="field">
          <label for="avm-lead-start-filter">Başlangıç</label>
          <input id="avm-lead-start-filter" type="date" data-avm-lead-filter-start value="${core.escapeHTML(leadStartDateFilter)}" ${leadEndDateFilter ? `max="${core.escapeHTML(leadEndDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="avm-lead-end-filter">Bitiş</label>
          <input id="avm-lead-end-filter" type="date" data-avm-lead-filter-end value="${core.escapeHTML(leadEndDateFilter)}" ${leadStartDateFilter ? `min="${core.escapeHTML(leadStartDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="avm-lead-page-size">Sayfa başına</label>
          <select id="avm-lead-page-size" data-avm-lead-page-size>
            ${[25, 50, 100].map((value) => `<option value="${value}" ${leadPageSize === value ? "selected" : ""}>${value} kayıt</option>`).join("")}
          </select>
        </div>
        <div class="field field--actions">
          <label aria-hidden="true">&nbsp;</label>
          <div class="avm-redemption-filter-actions">
            <button class="btn btn--light" type="button" data-avm-lead-reset>Temizle</button>
            <button class="btn" type="button" data-avm-lead-export aria-label="Filtrelenmiş AVM ön görüşmelerini CSV olarak indir">CSV İndir</button>
          </div>
        </div>
      </form>
      ${leadRows.length
        ? `
          <div class="table-wrap">
            <table class="data-table data-table--wide">
              <thead><tr><th>AVM</th><th>Yetkili / İletişim</th><th>Görüşme</th><th>İhtiyaç</th><th>Durum</th><th>Tarih / Kaynak</th></tr></thead>
              <tbody>
                ${leadRows.map((lead) => `
                  <tr>
                    <td><strong>${core.escapeHTML(lead.mall_name)}</strong><br><small>${core.escapeHTML(lead.mall_size || "Segment belirtilmedi")}</small></td>
                    <td>${core.escapeHTML(lead.contact_role)}<br><small>${core.escapeHTML(lead.email)} · ${core.escapeHTML(lead.phone)}</small></td>
                    <td>${core.escapeHTML(leadInterestTypeLabels[lead.interest_type] || lead.interest_type || "AVM platform kurulumu")}</td>
                    <td>${core.escapeHTML(core.truncate(lead.need_summary || "-", 180))}</td>
                    <td>
                      <select data-avm-lead-status="${core.escapeHTML(lead.lead_id || lead.id)}">
                        ${Object.entries(leadStatusLabels).map(([value, label]) => `<option value="${value}" ${lead.status === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
                      </select>
                    </td>
                    <td>${lead.created_at ? new Date(lead.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "-"}<br><small>${core.escapeHTML(lead.source_page || "avm-partner")}</small></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `
        : `<div class="empty-state">${hasFilters ? "Seçilen filtrelerle eşleşen AVM ön görüşmesi yok." : "Henüz AVM ön görüşme talebi yok."}</div>`}
      ${leadTotal > leadPageSize
        ? `
          <div class="pagination" aria-label="AVM ön görüşme sayfaları">
            <button class="icon-btn" type="button" data-avm-lead-previous aria-label="Önceki sayfa" title="Önceki sayfa" ${leadPage <= 1 ? "disabled" : ""}>←</button>
            <span>Sayfa ${leadPage} / ${totalPages}</span>
            <button class="icon-btn" type="button" data-avm-lead-next aria-label="Sonraki sayfa" title="Sonraki sayfa" ${leadPage >= totalPages ? "disabled" : ""}>→</button>
          </div>
        `
        : ""}
    `;
  }

  async function loadLeads(options = {}) {
    const target = document.querySelector("[data-avm-admin-leads]");
    if (!target) return;
    if (options.resetPage) leadPage = 1;
    const requestId = ++leadRequestId;
    core.renderStatus(target, "AVM ön görüşmeleri yükleniyor...");
    try {
      const offset = (leadPage - 1) * leadPageSize;
      const { data, error } = await queryLeadReport(leadPageSize, offset);
      if (error) throw error;
      if (requestId !== leadRequestId) return;
      leadRows = data || [];
      if (!leadRows.length && leadPage > 1) {
        leadPage = 1;
        await loadLeads();
        return;
      }
      const metrics = leadRows[0] || {};
      leadTotal = interactionNumber(metrics.total_count);
      leadMetrics = {
        newCount: interactionNumber(metrics.new_count),
        contacted: interactionNumber(metrics.contacted_count),
        qualified: interactionNumber(metrics.qualified_count),
        archived: interactionNumber(metrics.archived_count)
      };
      renderLeads();
    } catch (error) {
      if (requestId !== leadRequestId) return;
      leadRows = [];
      leadTotal = 0;
      leadMetrics = { newCount: 0, contacted: 0, qualified: 0, archived: 0 };
      core.renderStatus(target, error.message || "AVM ön görüşmeleri yüklenemedi. Supabase lead raporlama migration uygulanmalı.", "error");
    }
  }

  function accessibilityRequestFilterSnapshot() {
    return {
      status: accessibilityRequestStatusFilter,
      serviceType: accessibilityRequestTypeFilter,
      search: accessibilityRequestSearchFilter,
      startDate: accessibilityRequestStartDateFilter,
      endDate: accessibilityRequestEndDateFilter
    };
  }

  async function queryAccessibilityRequestReport(limit, offset, filters = accessibilityRequestFilterSnapshot()) {
    const mallId = await requireDefaultMallId();
    return App.db.client().rpc("get_mall_accessibility_request_report", {
      report_mall_id: mallId,
      report_status: filters.status || null,
      report_service_type: filters.serviceType || null,
      report_search: filters.search.trim() || null,
      report_start_date: filters.startDate || null,
      report_end_date: filters.endDate || null,
      report_limit: limit,
      report_offset: offset
    });
  }

  async function exportAccessibilityRequests(button) {
    if (!accessibilityRequestTotal) {
      core.toast("Dışa aktarılacak erişilebilirlik talebi yok.", "error");
      return;
    }
    button.disabled = true;
    try {
      const filters = accessibilityRequestFilterSnapshot();
      const batchSize = 200;
      const rows = [];
      let expectedTotal = accessibilityRequestTotal;
      for (let offset = 0; offset < expectedTotal; offset += batchSize) {
        const { data, error } = await queryAccessibilityRequestReport(batchSize, offset, filters);
        if (error) throw error;
        const batch = data || [];
        if (!offset && batch[0]) expectedTotal = interactionNumber(batch[0].total_count);
        rows.push(...batch);
        if (batch.length < batchSize) break;
      }
      if (!rows.length) throw new Error("Filtre kapsamındaki talepler artık bulunmuyor.");
      const headers = ["Ziyaret", "Destek Türü", "Ad Soyad", "Kişi Sayısı", "Telefon", "E-posta", "Buluşma Noktası", "İhtiyaç Notu", "Admin Notu", "Durum", "Oluşturma"];
      const csvRows = rows.map((request) => [
        request.visit_at ? new Date(request.visit_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "",
        accessibilityRequestTypeLabels[request.service_type] || request.service_type,
        request.visitor_name,
        request.party_size,
        request.contact_phone,
        request.contact_email,
        request.meeting_point,
        request.request_note,
        request.admin_note,
        accessibilityRequestStatusLabels[request.status] || request.status,
        request.created_at ? new Date(request.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : ""
      ]);
      const csv = [headers, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
      const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `avm-erisilebilirlik-talepleri-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      core.toast(`${rows.length} erişilebilirlik talebi CSV olarak hazırlandı.`);
    } catch (error) {
      core.toast(error.message || "Erişilebilirlik talebi raporu hazırlanamadı.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function renderAccessibilityRequests() {
    const target = document.querySelector("[data-avm-admin-accessibility-requests]");
    if (!target) return;
    const totalPages = Math.max(1, Math.ceil(accessibilityRequestTotal / accessibilityRequestPageSize));
    const hasFilters = Boolean(accessibilityRequestStatusFilter || accessibilityRequestTypeFilter || accessibilityRequestSearchFilter || accessibilityRequestStartDateFilter || accessibilityRequestEndDateFilter);
    target.innerHTML = `
      <div class="avm-operation-summary" aria-label="Erişilebilirlik talebi operasyon özeti">
        <div class="avm-operation-stat"><span>Filtrelenmiş talep</span><strong>${accessibilityRequestTotal}</strong></div>
        <div class="avm-operation-stat"><span>Yeni</span><strong>${accessibilityRequestMetrics.newCount}</strong></div>
        <div class="avm-operation-stat"><span>Teyit edildi</span><strong>${accessibilityRequestMetrics.confirmed}</strong></div>
        <div class="avm-operation-stat"><span>Yaklaşan ziyaret</span><strong>${accessibilityRequestMetrics.upcoming}</strong></div>
        <div class="avm-operation-stat"><span>Toplam ziyaretçi</span><strong>${accessibilityRequestMetrics.visitors}</strong></div>
      </div>
      <p class="muted">${accessibilityRequestRows.length} kayıt bu sayfada / ${accessibilityRequestTotal} eşleşme · ${accessibilityRequestMetrics.completed} tamamlandı · ${accessibilityRequestMetrics.cancelled} iptal · ${accessibilityRequestMetrics.archived} arşivlendi</p>
      <form class="filters avm-admin-accessibility-request-filters" data-avm-accessibility-request-filters>
        <div class="field">
          <label for="avm-accessibility-status-filter">Durum</label>
          <select id="avm-accessibility-status-filter" data-avm-accessibility-filter-status>
            <option value="">Tüm durumlar</option>
            ${Object.entries(accessibilityRequestStatusLabels).map(([value, label]) => `<option value="${value}" ${accessibilityRequestStatusFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="avm-accessibility-type-filter">Destek türü</label>
          <select id="avm-accessibility-type-filter" data-avm-accessibility-filter-type>
            <option value="">Tüm destek türleri</option>
            ${Object.entries(accessibilityRequestTypeLabels).map(([value, label]) => `<option value="${value}" ${accessibilityRequestTypeFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="avm-accessibility-search-filter">Talep ara</label>
          <input id="avm-accessibility-search-filter" type="search" data-avm-accessibility-filter-search value="${core.escapeHTML(accessibilityRequestSearchFilter)}" placeholder="Ad, iletişim, buluşma veya not">
        </div>
        <div class="field">
          <label for="avm-accessibility-start-filter">Ziyaret başlangıcı</label>
          <input id="avm-accessibility-start-filter" type="date" data-avm-accessibility-filter-start value="${core.escapeHTML(accessibilityRequestStartDateFilter)}" ${accessibilityRequestEndDateFilter ? `max="${core.escapeHTML(accessibilityRequestEndDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="avm-accessibility-end-filter">Ziyaret bitişi</label>
          <input id="avm-accessibility-end-filter" type="date" data-avm-accessibility-filter-end value="${core.escapeHTML(accessibilityRequestEndDateFilter)}" ${accessibilityRequestStartDateFilter ? `min="${core.escapeHTML(accessibilityRequestStartDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="avm-accessibility-page-size">Sayfa başına</label>
          <select id="avm-accessibility-page-size" data-avm-accessibility-page-size>
            ${[25, 50, 100].map((value) => `<option value="${value}" ${accessibilityRequestPageSize === value ? "selected" : ""}>${value} kayıt</option>`).join("")}
          </select>
        </div>
        <div class="field field--actions">
          <label aria-hidden="true">&nbsp;</label>
          <div class="avm-redemption-filter-actions">
            <button class="btn btn--light" type="button" data-avm-accessibility-reset>Temizle</button>
            <button class="btn" type="button" data-avm-accessibility-export aria-label="Filtrelenmiş erişilebilirlik taleplerini CSV olarak indir">CSV İndir</button>
          </div>
        </div>
      </form>
      ${accessibilityRequestRows.length
        ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Ziyaret</th><th>Destek</th><th>Ziyaretçi</th><th>Buluşma / ziyaretçi notu</th><th>Operasyon notu</th><th>Durum</th><th>Oluşturma</th></tr></thead>
              <tbody>
                ${accessibilityRequestRows.map((request) => `
                  <tr>
                    <td>${request.visit_at ? new Date(request.visit_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "-"}<br><span class="muted">${core.escapeHTML(`${request.party_size || 1} kişi`)}</span></td>
                    <td>${core.escapeHTML(accessibilityRequestTypeLabels[request.service_type] || request.service_type)}</td>
                    <td>${core.escapeHTML(request.visitor_name)}<br>${core.escapeHTML([request.contact_phone, request.contact_email].filter(Boolean).join(" · ") || "-")}</td>
                    <td>${core.escapeHTML(request.meeting_point || "Belirtilmedi")}<br><span class="muted">${core.escapeHTML(request.request_note || "Not yok")}</span></td>
                    <td>
                      <div class="avm-accessibility-operation">
                        <label class="sr-only" for="avm-accessibility-note-${core.escapeHTML(request.request_id || request.id)}">${core.escapeHTML(request.visitor_name)} operasyon notu</label>
                        <textarea id="avm-accessibility-note-${core.escapeHTML(request.request_id || request.id)}" rows="3" maxlength="1000" data-avm-accessibility-request-note="${core.escapeHTML(request.request_id || request.id)}" placeholder="Teyit, ekip veya buluşma talimatı">${core.escapeHTML(request.admin_note || "")}</textarea>
                        <button class="btn btn--light" type="button" data-avm-accessibility-note-save="${core.escapeHTML(request.request_id || request.id)}">Notu Kaydet</button>
                      </div>
                    </td>
                    <td>
                      <select data-avm-accessibility-request-status="${core.escapeHTML(request.request_id || request.id)}">
                        ${Object.entries(accessibilityRequestStatusLabels).map(([value, label]) => `<option value="${value}" ${request.status === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
                      </select>
                    </td>
                    <td>${request.created_at ? new Date(request.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <nav class="avm-report-pagination" aria-label="Erişilebilirlik talebi sayfaları">
            <button class="icon-btn" type="button" data-avm-accessibility-previous aria-label="Önceki sayfa" title="Önceki sayfa" ${accessibilityRequestPage <= 1 ? "disabled" : ""}>←</button>
            <span>Sayfa ${accessibilityRequestPage} / ${totalPages}</span>
            <button class="icon-btn" type="button" data-avm-accessibility-next aria-label="Sonraki sayfa" title="Sonraki sayfa" ${accessibilityRequestPage >= totalPages ? "disabled" : ""}>→</button>
          </nav>
        `
        : `<div class="empty-state">${hasFilters ? "Bu filtrelerle eşleşen erişilebilirlik talebi yok." : "Henüz erişilebilirlik destek talebi yok."}</div>`}
    `;
  }

  async function loadAccessibilityRequests(options = {}) {
    const target = document.querySelector("[data-avm-admin-accessibility-requests]");
    if (!target) return;
    if (options.resetPage) accessibilityRequestPage = 1;
    const requestId = ++accessibilityRequestRequestId;
    core.renderStatus(target, "Erişilebilirlik destek talepleri yükleniyor...");
    try {
      const offset = (accessibilityRequestPage - 1) * accessibilityRequestPageSize;
      const { data, error } = await queryAccessibilityRequestReport(accessibilityRequestPageSize, offset);
      if (error) throw error;
      if (requestId !== accessibilityRequestRequestId) return;
      accessibilityRequestRows = data || [];
      if (!accessibilityRequestRows.length && accessibilityRequestPage > 1) {
        accessibilityRequestPage = 1;
        await loadAccessibilityRequests();
        return;
      }
      const metrics = accessibilityRequestRows[0] || {};
      accessibilityRequestTotal = interactionNumber(metrics.total_count);
      accessibilityRequestMetrics = {
        newCount: interactionNumber(metrics.new_count),
        confirmed: interactionNumber(metrics.confirmed_count),
        completed: interactionNumber(metrics.completed_count),
        cancelled: interactionNumber(metrics.cancelled_count),
        archived: interactionNumber(metrics.archived_count),
        visitors: interactionNumber(metrics.visitors_sum),
        upcoming: interactionNumber(metrics.upcoming_count)
      };
      renderAccessibilityRequests();
    } catch (error) {
      if (requestId !== accessibilityRequestRequestId) return;
      accessibilityRequestRows = [];
      accessibilityRequestTotal = 0;
      accessibilityRequestMetrics = { newCount: 0, confirmed: 0, completed: 0, cancelled: 0, archived: 0, visitors: 0, upcoming: 0 };
      core.renderStatus(target, error.message || "Erişilebilirlik talepleri yüklenemedi. Supabase erişilebilirlik raporlama migration'ı uygulanmalı.", "error");
    }
  }

  function submissionSummaryNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function renderPartnerSubmissions() {
    const target = document.querySelector("[data-avm-admin-partner-submissions]");
    if (!target) return;
    const totalPages = Math.max(1, Math.ceil(partnerSubmissionTotal / partnerSubmissionPageSize));
    target.innerHTML = `
      <div class="avm-operation-summary" aria-label="AVM yayın talebi operasyon özeti">
        <div class="avm-operation-stat"><span>Toplam talep</span><strong>${partnerSubmissionSummary.total}</strong></div>
        <div class="avm-operation-stat"><span>Aksiyon bekleyen</span><strong>${partnerSubmissionSummary.awaitingAction}</strong></div>
        <div class="avm-operation-stat"><span>Onaylanan</span><strong>${partnerSubmissionSummary.approved}</strong></div>
        <div class="avm-operation-stat"><span>Yayındaki hedef</span><strong>${partnerSubmissionSummary.published}</strong></div>
        <div class="avm-operation-stat"><span>Tenant profili</span><strong>${partnerSubmissionSummary.tenant}</strong></div>
        <div class="avm-operation-stat"><span>Kampanya</span><strong>${partnerSubmissionSummary.campaign}</strong></div>
        <div class="avm-operation-stat"><span>Etkinlik</span><strong>${partnerSubmissionSummary.event}</strong></div>
        <div class="avm-operation-stat"><span>Reklam / sponsor</span><strong>${partnerSubmissionSummary.advertising}</strong></div>
      </div>
      <form class="filters avm-admin-partner-submission-filters" data-avm-partner-submission-filters>
        <div class="field">
          <label for="avm-partner-request-type-filter">Talep türü</label>
          <select id="avm-partner-request-type-filter" data-avm-partner-submission-filter-type>
            <option value="">Tüm türler</option>
            ${Object.entries(partnerRequestLabels).map(([value, label]) => `<option value="${value}" ${partnerSubmissionRequestTypeFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="avm-partner-status-filter">İnceleme</label>
          <select id="avm-partner-status-filter" data-avm-partner-submission-filter-status>
            <option value="">Tüm durumlar</option>
            ${Object.entries(partnerStatusLabels).map(([value, label]) => `<option value="${value}" ${partnerSubmissionStatusFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="avm-partner-visibility-filter">Yayın durumu</label>
          <select id="avm-partner-visibility-filter" data-avm-partner-submission-filter-visibility>
            <option value="">Tüm yayın durumları</option>
            ${["not_published", "scheduled", "published", "hidden"].map((value) => `<option value="${value}" ${partnerSubmissionVisibilityFilter === value ? "selected" : ""}>${core.escapeHTML(partnerVisibilityLabels[value])}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="avm-partner-start-filter">Oluşturma başlangıcı</label>
          <input id="avm-partner-start-filter" type="date" data-avm-partner-submission-filter-start value="${core.escapeHTML(partnerSubmissionStartDateFilter)}" ${partnerSubmissionEndDateFilter ? `max="${core.escapeHTML(partnerSubmissionEndDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="avm-partner-end-filter">Oluşturma bitişi</label>
          <input id="avm-partner-end-filter" type="date" data-avm-partner-submission-filter-end value="${core.escapeHTML(partnerSubmissionEndDateFilter)}" ${partnerSubmissionStartDateFilter ? `min="${core.escapeHTML(partnerSubmissionStartDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="avm-partner-page-size">Sayfa başına</label>
          <select id="avm-partner-page-size" data-avm-partner-submission-page-size>
            ${[25, 50, 100].map((value) => `<option value="${value}" ${partnerSubmissionPageSize === value ? "selected" : ""}>${value} kayıt</option>`).join("")}
          </select>
        </div>
        <div class="field field--actions">
          <label aria-hidden="true">&nbsp;</label>
          <button class="btn btn--light" type="button" data-avm-partner-submission-reset>Filtreleri Temizle</button>
        </div>
      </form>
      <p class="muted">${partnerSubmissionRows.length} kayıt bu sayfada / ${partnerSubmissionTotal} eşleşme · özet seçili tarih aralığındaki tüm AVM taleplerini kapsar.</p>
      ${partnerSubmissionRows.length
        ? `
          <div class="table-wrap">
            <table class="data-table data-table--wide">
              <thead><tr><th>Tür</th><th>Marka / Talep</th><th>İletişim</th><th>Dönem / Görünürlük</th><th>İçerik</th><th>İnceleme</th><th>Yayın hedefi</th><th>Yayın</th></tr></thead>
              <tbody>
                ${partnerSubmissionRows.map((row) => {
                  const publicationTarget = partnerSubmissionTarget(row);
                  const targetType = row.request_type === "advertising" ? "Reklam taslağı" : "Katalog taslağı";
                  return `
                    <tr>
                      <td>${core.escapeHTML(partnerRequestLabels[row.request_type] || row.request_type)}</td>
                      <td><strong>${core.escapeHTML(row.brand_name)}</strong><br>${core.escapeHTML(row.submission_title)}</td>
                      <td>${core.escapeHTML(row.contact_name)}<br>${core.escapeHTML(row.contact_email)}${row.contact_phone ? `<br>${core.escapeHTML(row.contact_phone)}` : ""}</td>
                      <td>${core.escapeHTML(`${row.requested_start_date || "-"} / ${row.requested_end_date || "-"}`)}<br>${core.escapeHTML(partnerVisibilityLabels[row.requested_visibility] || row.requested_visibility)}<br><small>${core.escapeHTML(partnerBudgetLabels[row.budget_range] || row.budget_range || partnerBudgetLabels.not_specified)}</small></td>
                      <td>
                        ${core.escapeHTML(core.truncate(row.submission_summary || "-", 120))}
                        ${row.destination_url ? `<br><small>${core.escapeHTML(core.truncate(row.destination_url, 52))}</small>` : ""}
                        ${validHttpUrl(row.media_url) ? `<br><a class="link-btn" href="${core.escapeHTML(row.media_url)}" target="_blank" rel="noopener">Görseli aç</a><br><small>${core.escapeHTML(row.media_alt || "Alt metin bekliyor")}</small>` : ""}
                      </td>
                      <td>
                        <select data-avm-partner-submission-status="${core.escapeHTML(row.id)}">
                          ${Object.entries(partnerStatusLabels).map(([value, label]) => `<option value="${value}" ${row.status === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
                        </select>
                      </td>
                      <td>
                        ${publicationTarget
                          ? `<a class="btn btn--light" href="${publicationTarget.href}">${core.escapeHTML(publicationTarget.label)}</a>`
                          : `<button class="btn btn--light" type="button" data-avm-partner-create-target="${core.escapeHTML(row.id)}">${core.escapeHTML(targetType)} oluştur</button>`}
                      </td>
                      <td>
                        <select data-avm-partner-submission-visibility="${core.escapeHTML(row.id)}">
                          ${["not_published", "scheduled", "published", "hidden"].map((value) => {
                            const requiresTarget = ["scheduled", "published"].includes(value);
                            const requiredTargetStatus = value === "scheduled" ? "draft" : "active";
                            const disabled = requiresTarget && (
                              row.status !== "approved"
                              || publicationTarget?.status !== requiredTargetStatus
                            );
                            return `<option value="${value}" ${row.visibility_status === value ? "selected" : ""} ${disabled ? "disabled" : ""}>${core.escapeHTML(partnerVisibilityLabels[value])}</option>`;
                          }).join("")}
                        </select>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
          <nav class="avm-report-pagination" aria-label="Tenant ve reklam talebi sayfaları">
            <button class="icon-btn" type="button" data-avm-partner-submission-previous aria-label="Önceki sayfa" title="Önceki sayfa" ${partnerSubmissionPage <= 1 ? "disabled" : ""}>←</button>
            <span>Sayfa ${partnerSubmissionPage} / ${totalPages}</span>
            <button class="icon-btn" type="button" data-avm-partner-submission-next aria-label="Sonraki sayfa" title="Sonraki sayfa" ${partnerSubmissionPage >= totalPages ? "disabled" : ""}>→</button>
          </nav>
        `
        : `<div class="empty-state">${partnerSubmissionRequestTypeFilter || partnerSubmissionStatusFilter || partnerSubmissionVisibilityFilter || partnerSubmissionStartDateFilter || partnerSubmissionEndDateFilter ? "Bu filtrelerle eşleşen tenant veya marka talebi yok." : "Henüz tenant veya marka yayın talebi yok."}</div>`}
    `;
  }

  async function loadPartnerSubmissions(options = {}) {
    const target = document.querySelector("[data-avm-admin-partner-submissions]");
    if (!target) return;
    if (options.resetPage) partnerSubmissionPage = 1;
    const requestId = ++partnerSubmissionRequestId;
    core.renderStatus(target, "Tenant ve marka yayın talepleri yükleniyor...");
    try {
      const mallId = await requireDefaultMallId();
      let query = App.db.client()
        .from("mall_partner_submissions")
        .select("*", { count: "exact" })
        .eq("mall_id", mallId)
        .eq("module_key", "mall")
        .order("created_at", { ascending: false });
      if (partnerSubmissionRequestTypeFilter) query = query.eq("request_type", partnerSubmissionRequestTypeFilter);
      if (partnerSubmissionStatusFilter) query = query.eq("status", partnerSubmissionStatusFilter);
      if (partnerSubmissionVisibilityFilter) query = query.eq("visibility_status", partnerSubmissionVisibilityFilter);
      if (partnerSubmissionStartDateFilter) query = query.gte("created_at", `${partnerSubmissionStartDateFilter}T00:00:00+03:00`);
      if (partnerSubmissionEndDateFilter) query = query.lt("created_at", `${nextDateKey(partnerSubmissionEndDateFilter)}T00:00:00+03:00`);
      const offset = (partnerSubmissionPage - 1) * partnerSubmissionPageSize;
      const [submissionResult, summaryResult] = await Promise.all([
        query.range(offset, offset + partnerSubmissionPageSize - 1),
        App.db.client().rpc("get_mall_partner_submission_summary", {
          report_mall_id: mallId,
          report_start_date: partnerSubmissionStartDateFilter || null,
          report_end_date: partnerSubmissionEndDateFilter || null
        })
      ]);
      const { data, error, count } = submissionResult;
      if (error) throw error;
      if (summaryResult.error) throw summaryResult.error;
      if (requestId !== partnerSubmissionRequestId) return;
      partnerSubmissionTotal = Number(count) || 0;
      const totalPages = Math.max(1, Math.ceil(partnerSubmissionTotal / partnerSubmissionPageSize));
      if (partnerSubmissionPage > totalPages) {
        partnerSubmissionPage = totalPages;
        await loadPartnerSubmissions();
        return;
      }
      const baseRows = data || [];
      const directoryIds = baseRows.map((row) => row.published_item_id).filter(Boolean);
      const adSlotIds = baseRows.map((row) => row.published_ad_slot_id).filter(Boolean);
      const [directoryResult, adSlotResult] = await Promise.all([
        directoryIds.length
          ? App.db.client().from("mall_directory_items").select("id,status").in("id", directoryIds)
          : Promise.resolve({ data: [], error: null }),
        adSlotIds.length
          ? App.db.client().from("mall_ad_slots").select("id,status").in("id", adSlotIds)
          : Promise.resolve({ data: [], error: null })
      ]);
      if (directoryResult.error) throw directoryResult.error;
      if (adSlotResult.error) throw adSlotResult.error;
      const directoryStatuses = new Map((directoryResult.data || []).map((row) => [row.id, row.status]));
      const adSlotStatuses = new Map((adSlotResult.data || []).map((row) => [row.id, row.status]));
      const rows = baseRows.map((row) => ({
        ...row,
        published_item_status: row.published_item_id ? directoryStatuses.get(row.published_item_id) || "missing" : null,
        published_ad_slot_status: row.published_ad_slot_id ? adSlotStatuses.get(row.published_ad_slot_id) || "missing" : null
      }));
      partnerSubmissionRows = rows;
      const summary = summaryResult.data?.[0] || {};
      partnerSubmissionSummary = {
        total: submissionSummaryNumber(summary.total_count),
        awaitingAction: submissionSummaryNumber(summary.awaiting_action_count),
        approved: submissionSummaryNumber(summary.approved_count),
        published: submissionSummaryNumber(summary.published_count),
        advertising: submissionSummaryNumber(summary.advertising_count),
        tenant: submissionSummaryNumber(summary.tenant_count),
        campaign: submissionSummaryNumber(summary.campaign_count),
        event: submissionSummaryNumber(summary.event_count)
      };
      renderPartnerSubmissions();
    } catch (error) {
      if (requestId !== partnerSubmissionRequestId) return;
      partnerSubmissionRows = [];
      partnerSubmissionTotal = 0;
      partnerSubmissionSummary = { total: 0, awaitingAction: 0, approved: 0, published: 0, advertising: 0, tenant: 0, campaign: 0, event: 0 };
      core.renderStatus(target, error.message || "Tenant ve marka yayın talepleri yüklenemedi. İlgili Supabase migration uygulanmalı.", "error");
    }
  }

  function visitPlanFilterSnapshot() {
    return {
      status: visitPlanStatusFilter,
      search: visitPlanSearchFilter,
      startDate: visitPlanStartDateFilter,
      endDate: visitPlanEndDateFilter
    };
  }

  async function queryVisitPlanReport(limit, offset, filters = visitPlanFilterSnapshot()) {
    const mallId = await requireDefaultMallId();
    return App.db.client().rpc("get_mall_visit_plan_report", {
      report_mall_id: mallId,
      report_status: filters.status || null,
      report_search: filters.search.trim() || null,
      report_start_date: filters.startDate || null,
      report_end_date: filters.endDate || null,
      report_limit: limit,
      report_offset: offset
    });
  }

  async function exportVisitPlans(button) {
    if (!visitPlanTotal) {
      core.toast("Dışa aktarılacak ziyaret planı yok.", "error");
      return;
    }
    button.disabled = true;
    try {
      const filters = visitPlanFilterSnapshot();
      const batchSize = 200;
      const rows = [];
      let expectedTotal = visitPlanTotal;
      for (let offset = 0; offset < expectedTotal; offset += batchSize) {
        const { data, error } = await queryVisitPlanReport(batchSize, offset, filters);
        if (error) throw error;
        const batch = data || [];
        if (!offset && batch[0]) expectedTotal = interactionNumber(batch[0].total_count);
        rows.push(...batch);
        if (batch.length < batchSize) break;
      }
      if (!rows.length) throw new Error("Filtre kapsamındaki planlar artık bulunmuyor.");
      const headers = ["Duraklar", "Durak Kodları", "Durak Sayısı", "Tahmini Süre", "Temas Skoru", "Ziyaret Notu", "İletişim E-postası", "Kaynak", "Durum", "Tarih"];
      const csvRows = rows.map((row) => [
        (row.selected_item_titles || []).join(" | "),
        (row.selected_item_ids || []).join(" | "),
        row.total_stops,
        row.total_minutes,
        row.total_touch_score,
        row.visitor_note,
        row.contact_email,
        row.source_page,
        visitPlanStatusLabels[row.status] || row.status,
        row.created_at ? new Date(row.created_at).toLocaleString("tr-TR") : ""
      ]);
      const csv = [headers, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
      const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `avm-ziyaret-planlari-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      core.toast(`${rows.length} ziyaret planı CSV olarak hazırlandı.`);
    } catch (error) {
      core.toast(error.message || "Ziyaret planı raporu hazırlanamadı.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function renderVisitPlans() {
    const target = document.querySelector("[data-avm-admin-visit-plans]");
    if (!target) return;
    const totalPages = Math.max(1, Math.ceil(visitPlanTotal / visitPlanPageSize));
    const hasFilters = Boolean(visitPlanStatusFilter || visitPlanSearchFilter || visitPlanStartDateFilter || visitPlanEndDateFilter);
    target.innerHTML = `
      <div class="avm-operation-summary" aria-label="Ziyaret planı operasyon özeti">
        <div class="avm-operation-stat"><span>Filtrelenmiş plan</span><strong>${visitPlanTotal}</strong></div>
        <div class="avm-operation-stat"><span>Yeni</span><strong>${visitPlanMetrics.newCount}</strong></div>
        <div class="avm-operation-stat"><span>İşleme alındı</span><strong>${visitPlanMetrics.actioned}</strong></div>
        <div class="avm-operation-stat"><span>Toplam durak</span><strong>${visitPlanMetrics.stops}</strong></div>
      </div>
      <p class="muted">${visitPlanRows.length} kayıt bu sayfada / ${visitPlanTotal} eşleşme · ${visitPlanMetrics.reviewed} incelendi · ${visitPlanMetrics.archived} arşivlendi · ${visitPlanMetrics.minutes} dk · ${visitPlanMetrics.touch} temas</p>
      <form class="filters avm-admin-visit-plan-filters" data-avm-visit-plan-filters>
        <div class="field">
          <label for="avm-visit-plan-status-filter">Durum</label>
          <select id="avm-visit-plan-status-filter" data-avm-visit-plan-filter-status>
            <option value="">Tüm durumlar</option>
            ${Object.entries(visitPlanStatusLabels).map(([value, label]) => `<option value="${value}" ${visitPlanStatusFilter === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="avm-visit-plan-search-filter">Plan ara</label>
          <input id="avm-visit-plan-search-filter" type="search" data-avm-visit-plan-filter-search value="${core.escapeHTML(visitPlanSearchFilter)}" placeholder="Durak, not veya e-posta">
        </div>
        <div class="field">
          <label for="avm-visit-plan-start-filter">Başlangıç</label>
          <input id="avm-visit-plan-start-filter" type="date" data-avm-visit-plan-filter-start value="${core.escapeHTML(visitPlanStartDateFilter)}" ${visitPlanEndDateFilter ? `max="${core.escapeHTML(visitPlanEndDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="avm-visit-plan-end-filter">Bitiş</label>
          <input id="avm-visit-plan-end-filter" type="date" data-avm-visit-plan-filter-end value="${core.escapeHTML(visitPlanEndDateFilter)}" ${visitPlanStartDateFilter ? `min="${core.escapeHTML(visitPlanStartDateFilter)}"` : ""}>
        </div>
        <div class="field">
          <label for="avm-visit-plan-page-size">Sayfa başına</label>
          <select id="avm-visit-plan-page-size" data-avm-visit-plan-page-size>
            ${[25, 50, 100].map((value) => `<option value="${value}" ${visitPlanPageSize === value ? "selected" : ""}>${value} kayıt</option>`).join("")}
          </select>
        </div>
        <div class="field field--actions">
          <label aria-hidden="true">&nbsp;</label>
          <div class="avm-redemption-filter-actions">
            <button class="btn btn--light" type="button" data-avm-visit-plan-reset>Temizle</button>
            <button class="btn" type="button" data-avm-visit-plan-export aria-label="Filtrelenmiş ziyaret planlarını CSV olarak indir">CSV İndir</button>
          </div>
        </div>
      </form>
      ${visitPlanRows.length
        ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Duraklar</th><th>Özet</th><th>Not / İletişim</th><th>Durum</th><th>Tarih / Kaynak</th></tr></thead>
              <tbody>
                ${visitPlanRows.map((planRow) => `
                  <tr>
                    <td>${core.escapeHTML((planRow.selected_item_titles || []).join(", ") || "-")}</td>
                    <td>${core.escapeHTML(`${planRow.total_stops || 0} durak / ${planRow.total_minutes || 0} dk / ${planRow.total_touch_score || 0} temas`)}</td>
                    <td>${core.escapeHTML(core.truncate(planRow.visitor_note || "-", 180))}<br><small>${core.escapeHTML(planRow.contact_email || "-")}</small></td>
                    <td>
                      <select data-avm-plan-status="${core.escapeHTML(planRow.plan_id || planRow.id)}">
                        ${Object.entries(visitPlanStatusLabels).map(([value, label]) => `<option value="${value}" ${planRow.status === value ? "selected" : ""}>${core.escapeHTML(label)}</option>`).join("")}
                      </select>
                    </td>
                    <td>${planRow.created_at ? new Date(planRow.created_at).toLocaleString("tr-TR") : "-"}<br><small>${core.escapeHTML(planRow.source_page || "avm-dunyasi")}</small></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <nav class="avm-report-pagination" aria-label="Ziyaret planı sayfaları">
            <button class="icon-btn" type="button" data-avm-visit-plan-previous aria-label="Önceki sayfa" title="Önceki sayfa" ${visitPlanPage <= 1 ? "disabled" : ""}>←</button>
            <span>Sayfa ${visitPlanPage} / ${totalPages}</span>
            <button class="icon-btn" type="button" data-avm-visit-plan-next aria-label="Sonraki sayfa" title="Sonraki sayfa" ${visitPlanPage >= totalPages ? "disabled" : ""}>→</button>
          </nav>
        `
        : `<div class="empty-state">${hasFilters ? "Bu filtrelerle eşleşen ziyaret planı yok." : "Henüz ziyaret planı gönderimi yok. Canlı ziyaretçi planları burada görünür."}</div>`}
    `;
  }

  async function loadVisitPlans(options = {}) {
    const target = document.querySelector("[data-avm-admin-visit-plans]");
    if (!target) return;
    if (options.resetPage) visitPlanPage = 1;
    const requestId = ++visitPlanRequestId;
    core.renderStatus(target, "Ziyaret planları yükleniyor...");
    try {
      const offset = (visitPlanPage - 1) * visitPlanPageSize;
      const { data, error } = await queryVisitPlanReport(visitPlanPageSize, offset);
      if (error) throw error;
      if (requestId !== visitPlanRequestId) return;
      visitPlanRows = data || [];
      if (!visitPlanRows.length && visitPlanPage > 1) {
        visitPlanPage = 1;
        await loadVisitPlans();
        return;
      }
      const metrics = visitPlanRows[0] || {};
      visitPlanTotal = interactionNumber(metrics.total_count);
      visitPlanMetrics = {
        newCount: interactionNumber(metrics.new_count),
        reviewed: interactionNumber(metrics.reviewed_count),
        actioned: interactionNumber(metrics.actioned_count),
        archived: interactionNumber(metrics.archived_count),
        stops: interactionNumber(metrics.stops_sum),
        minutes: interactionNumber(metrics.minutes_sum),
        touch: interactionNumber(metrics.touch_score_sum)
      };
      renderVisitPlans();
    } catch (error) {
      if (requestId !== visitPlanRequestId) return;
      visitPlanRows = [];
      visitPlanTotal = 0;
      visitPlanMetrics = { newCount: 0, reviewed: 0, actioned: 0, archived: 0, stops: 0, minutes: 0, touch: 0 };
      core.renderStatus(target, error.message || "Ziyaret planları yüklenemedi. Supabase ziyaret planı raporlama migration uygulanmalı.", "error");
    }
  }

  async function loadCampaignRedemptions(options = {}) {
    const target = document.querySelector("[data-avm-admin-campaign-redemptions]");
    if (!target) return;
    if (options.resetPage) campaignRedemptionPage = 1;
    const requestId = ++campaignRedemptionRequestId;
    core.renderStatus(target, "Kampanya ilgi kayıtları yükleniyor...");
    try {
      const offset = (campaignRedemptionPage - 1) * campaignRedemptionPageSize;
      const [reportResult] = await Promise.all([
        queryCampaignRedemptionReport(campaignRedemptionPageSize, offset),
        options.refreshDimensions || !campaignRedemptionDimensionsLoaded
          ? loadCampaignRedemptionDimensions()
          : Promise.resolve()
      ]);
      const { data, error } = reportResult;
      if (error) throw error;
      if (requestId !== campaignRedemptionRequestId) return;
      campaignRedemptionRows = data || [];
      if (!campaignRedemptionRows.length && campaignRedemptionPage > 1) {
        campaignRedemptionPage = 1;
        await loadCampaignRedemptions();
        return;
      }
      const metrics = campaignRedemptionRows[0] || {};
      campaignRedemptionTotal = interactionNumber(metrics.total_count);
      campaignRedemptionMetrics = {
        newCount: interactionNumber(metrics.new_count),
        reviewed: interactionNumber(metrics.reviewed_count),
        exported: interactionNumber(metrics.exported_count),
        archived: interactionNumber(metrics.archived_count)
      };
      campaignPartnerByItemId = new Map();
      campaignRedemptionRows.forEach((row) => {
        const partner = campaignPartner(row);
        if (row.directory_item_id && partner && !campaignPartnerByItemId.has(row.directory_item_id)) {
          campaignPartnerByItemId.set(row.directory_item_id, partner);
        }
      });
      renderCampaignRedemptions();
    } catch (error) {
      if (requestId !== campaignRedemptionRequestId) return;
      campaignRedemptionRows = [];
      campaignPartnerByItemId = new Map();
      campaignRedemptionTotal = 0;
      campaignRedemptionMetrics = { newCount: 0, reviewed: 0, exported: 0, archived: 0 };
      core.renderStatus(target, error.message || "Kampanya ilgi kayıtları yüklenemedi. Supabase kampanya raporlama migration uygulanmalı.", "error");
    }
  }

  async function loadDirectoryInteractions(options = {}) {
    const target = document.querySelector("[data-avm-admin-directory-interactions]");
    if (!target) return;
    if (options.resetPage) directoryInteractionPage = 1;
    const requestId = ++directoryInteractionRequestId;
    core.renderStatus(target, "Katalog etkileşimleri yükleniyor...");
    try {
      const offset = (directoryInteractionPage - 1) * directoryInteractionPageSize;
      const { data, error } = await queryDirectoryInteractionReport(directoryInteractionPageSize, offset);
      if (error) throw error;
      if (requestId !== directoryInteractionRequestId) return;
      directoryInteractionRows = data || [];
      const metrics = directoryInteractionRows[0] || {};
      directoryInteractionTotal = interactionNumber(metrics.total_count);
      directoryInteractionMetrics = {
        detail: interactionNumber(metrics.detail_count),
        routePlan: interactionNumber(metrics.route_plan_count),
        outbound: interactionNumber(metrics.outbound_count),
        share: interactionNumber(metrics.share_count)
      };
      const totalPages = Math.max(1, Math.ceil(directoryInteractionTotal / directoryInteractionPageSize));
      if (directoryInteractionPage > totalPages) {
        directoryInteractionPage = totalPages;
        await loadDirectoryInteractions();
        return;
      }
      renderDirectoryInteractions();
    } catch (error) {
      if (requestId !== directoryInteractionRequestId) return;
      directoryInteractionRows = [];
      directoryInteractionTotal = 0;
      directoryInteractionMetrics = { detail: 0, routePlan: 0, outbound: 0, share: 0 };
      core.renderStatus(target, error.message || "Katalog etkileşimleri yüklenemedi. Supabase raporlama migration uygulanmalı.", "error");
    }
  }

  function bindMallCenterForm() {
    const form = document.querySelector("[data-avm-center-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const target = document.querySelector("[data-avm-center-status]");
      button.disabled = true;
      const values = core.parseForm(form);
      try {
        const missing = centerActivationErrors(values);
        if (missing.length) {
          throw new Error(`Aktif yayın için şu alanları tamamlayın: ${missing.join(", ")}.`);
        }
        const payload = {
          name: String(values.name || "").trim(),
          city: String(values.city || "").trim(),
          district: String(values.district || "").trim() || null,
          address: String(values.address || "").trim() || null,
          phone: String(values.phone || "").trim() || null,
          website_url: String(values.website_url || "").trim() || null,
          hero_image_url: String(values.hero_image_url || "").trim() || null,
          status: values.status || "draft"
        };
        const query = values.id
          ? App.db.client().from("mall_centers").update(payload).eq("id", values.id)
          : App.db.client().from("mall_centers").insert({ ...payload, slug: mallSlug });
        const { error } = await query;
        if (error) throw error;
        defaultMallId = undefined;
        await loadMallCenter();
        await refreshMallOperations();
        core.toast("AVM merkez profili kaydedildi.");
      } catch (error) {
        core.renderStatus(target, error.message || "AVM merkez profili kaydedilemedi.", "error");
        core.toast(error.message || "AVM merkez profili kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  function bindHoursProfileForm() {
    const form = document.querySelector("[data-avm-hours-profile-form]");
    if (!form) return;
    const syncScope = () => {
      const isDirectoryItem = form.elements.scope.value === "directory_item";
      form.elements.directory_item_id.disabled = !isDirectoryItem;
      form.elements.directory_item_id.required = isDirectoryItem;
      if (!isDirectoryItem) form.elements.directory_item_id.value = "";
    };
    form.elements.scope.addEventListener("change", syncScope);
    form.addEventListener("reset", () => window.setTimeout(() => {
      renderHoursDirectoryOptions("");
      syncScope();
    }, 0));
    syncScope();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const values = core.parseForm(form);
      button.disabled = true;
      try {
        const linkedItem = values.scope === "directory_item" ? values.directory_item_id : null;
        if (values.scope === "directory_item" && !linkedItem) {
          throw new Error("Tek katalog kaydı kapsamı için mağaza, restoran veya etkinlik seçilmelidir.");
        }
        const weeklyDayCount = new Set(
          weeklyHoursRows
            .filter((row) => row.profile_id === values.id)
            .map((row) => Number(row.day_of_week))
        ).size;
        if (values.status === "active" && (!values.id || weeklyDayCount !== 7)) {
          throw new Error("Profili aktifleştirmeden önce taslak olarak kaydedin ve haftanın yedi gününü tamamlayın.");
        }
        const payload = {
          mall_id: await requireDefaultMallId(),
          directory_item_id: linkedItem || null,
          public_id: String(values.public_id || "").trim(),
          title: String(values.title || "").trim(),
          scope: values.scope,
          display_order: numberValue(values.display_order, 100, 1, 10000),
          status: values.status || "draft"
        };
        const query = values.id
          ? App.db.client().from("mall_hours_profiles").update(payload).eq("id", values.id)
          : App.db.client().from("mall_hours_profiles").insert(payload);
        const { error } = await query;
        if (error) throw error;
        core.toast("Çalışma saati profili kaydedildi.");
        form.reset();
        if (form.elements.id) form.elements.id.value = "";
        await loadOpeningHoursAdmin();
      } catch (error) {
        core.toast(error.message || "Çalışma saati profili kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-avm-hours-profile-edit]");
      if (!edit) return;
      const profile = parseRecord(edit.dataset.avmHoursProfileEdit);
      if (!profile) return;
      renderHoursDirectoryOptions(profile.directory_item_id || "");
      fillForm(form, profile);
      syncScope();
    });
  }

  function bindWeeklyHoursForm() {
    const form = document.querySelector("[data-avm-weekly-hours-form]");
    if (!form) return;
    form.addEventListener("change", (event) => {
      if (event.target.matches("[data-avm-hours-profile-select]")) {
        fillWeeklyHoursForm(event.target.value);
        return;
      }
      const row = event.target.closest("[data-avm-week-day]");
      if (row && event.target.type === "checkbox") syncWeeklyDayRow(row, event.target);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const profileId = form.elements.profile_id.value;
      button.disabled = true;
      try {
        if (!profileId || !hoursProfiles.some((profile) => profile.id === profileId)) {
          throw new Error("Haftalık program için geçerli bir saat profili seçin.");
        }
        const payload = weekDays.map(({ value, label }) => {
          const row = form.querySelector(`[data-avm-week-day="${value}"]`);
          const isClosed = Boolean(row.querySelector(`[name="day_${value}_closed"]`).checked);
          const is24Hours = Boolean(row.querySelector(`[name="day_${value}_24_hours"]`).checked);
          const opensAt = row.querySelector(`[name="day_${value}_opens_at"]`).value;
          const closesAt = row.querySelector(`[name="day_${value}_closes_at"]`).value;
          const note = row.querySelector(`[name="day_${value}_note"]`).value.trim();
          const rowError = hoursRowError(isClosed, is24Hours, opensAt, closesAt, note);
          if (rowError) throw new Error(`${label}: ${rowError}`);
          return {
            profile_id: profileId,
            day_of_week: value,
            opens_at: isClosed || is24Hours ? null : opensAt,
            closes_at: isClosed || is24Hours ? null : closesAt,
            is_closed: isClosed,
            is_24_hours: is24Hours,
            note: note || null
          };
        });
        const { error } = await App.db.client()
          .from("mall_weekly_hours")
          .upsert(payload, { onConflict: "profile_id,day_of_week" });
        if (error) throw error;
        core.toast("Yedi günlük çalışma programı kaydedildi.");
        await loadOpeningHoursAdmin();
        fillWeeklyHoursForm(profileId);
      } catch (error) {
        core.toast(error.message || "Haftalık çalışma programı kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-avm-weekly-hours-edit]");
      if (!edit) return;
      fillWeeklyHoursForm(edit.dataset.avmWeeklyHoursEdit);
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function bindSpecialHoursForm() {
    const form = document.querySelector("[data-avm-special-hours-form]");
    if (!form) return;
    const syncMode = (changedInput) => {
      if (changedInput?.checked) {
        if (changedInput === form.elements.is_closed) form.elements.is_24_hours.checked = false;
        if (changedInput === form.elements.is_24_hours) form.elements.is_closed.checked = false;
      }
      const isClosed = form.elements.is_closed.checked;
      const is24Hours = form.elements.is_24_hours.checked;
      [form.elements.opens_at, form.elements.closes_at].forEach((input) => {
        input.disabled = isClosed || is24Hours;
        input.required = !isClosed && !is24Hours;
      });
    };
    form.elements.is_closed.addEventListener("change", (event) => syncMode(event.target));
    form.elements.is_24_hours.addEventListener("change", (event) => syncMode(event.target));
    form.addEventListener("reset", () => window.setTimeout(syncMode, 0));
    syncMode();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const values = core.parseForm(form);
      button.disabled = true;
      try {
        const isClosed = values.is_closed === "on";
        const is24Hours = values.is_24_hours === "on";
        const rowError = hoursRowError(isClosed, is24Hours, values.opens_at, values.closes_at, values.note);
        if (rowError) throw new Error(rowError);
        if (!hoursProfiles.some((profile) => profile.id === values.profile_id)) {
          throw new Error("Özel gün için geçerli bir saat profili seçin.");
        }
        const payload = {
          profile_id: values.profile_id,
          service_date: values.service_date,
          opens_at: isClosed || is24Hours ? null : values.opens_at,
          closes_at: isClosed || is24Hours ? null : values.closes_at,
          is_closed: isClosed,
          is_24_hours: is24Hours,
          note: String(values.note || "").trim() || null,
          status: values.status || "draft"
        };
        const query = values.id
          ? App.db.client().from("mall_special_hours").update(payload).eq("id", values.id)
          : App.db.client().from("mall_special_hours").insert(payload);
        const { error } = await query;
        if (error) throw error;
        core.toast("Özel gün çalışma saati kaydedildi.");
        form.reset();
        if (form.elements.id) form.elements.id.value = "";
        await loadOpeningHoursAdmin();
      } catch (error) {
        core.toast(error.message || "Özel gün çalışma saati kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-avm-special-hours-edit]");
      if (!edit) return;
      const row = parseRecord(edit.dataset.avmSpecialHoursEdit);
      if (!row) return;
      renderHoursProfileOptions();
      fillForm(form, row);
      syncMode();
    });
  }

  function bindDirectoryForm() {
    const form = document.querySelector("[data-avm-admin-form]");
    if (!form) return;
    const syncDirectoryRequirements = () => {
      const active = form.elements.status.value === "active";
      const scheduleRequired = active
        && ["events", "deals"].includes(form.elements.item_type.value);
      form.elements.starts_at.required = scheduleRequired;
      form.elements.ends_at.required = scheduleRequired;
      form.elements.image_url.required = active;
      form.elements.image_alt.required = active;
      form.elements.terms_text.required = active && form.elements.item_type.value === "deals";
    };
    form.elements.item_type.addEventListener("change", syncDirectoryRequirements);
    form.elements.status.addEventListener("change", syncDirectoryRequirements);
    form.addEventListener("reset", () => window.setTimeout(syncDirectoryRequirements, 0));
    syncDirectoryRequirements();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      const values = core.parseForm(form);
      try {
        const mediaError = directoryMediaError(values);
        if (mediaError) throw new Error(mediaError);
        const detailsError = directoryDetailsError(values);
        if (detailsError) throw new Error(detailsError);
        const scheduleError = directoryScheduleError(values);
        if (scheduleError) throw new Error(scheduleError);
        const payload = {
          mall_id: await requireDefaultMallId(),
          public_id: values.public_id,
          item_type: values.item_type,
          title: values.title,
          category: values.category,
          floor_label: values.floor_label,
          floor_zone_id: values.floor_zone_id || null,
          image_url: String(values.image_url || "").trim() || null,
          image_alt: String(values.image_alt || "").trim(),
          contact_phone: String(values.contact_phone || "").trim() || null,
          website_url: normalizedHttpUrl(values.website_url) || null,
          cta_url: normalizedHttpUrl(values.cta_url) || null,
          cta_label: String(values.cta_label || "").trim() || null,
          terms_text: String(values.terms_text || "").trim() || null,
          description: values.description,
          tags: tagsToArray(values.tags),
          estimated_minutes: numberValue(values.estimated_minutes, 20, 1),
          touch_score: numberValue(values.touch_score, 3, 1),
          display_order: numberValue(values.display_order, 100, 1),
          starts_at: istanbulInputToIso(values.starts_at),
          ends_at: istanbulInputToIso(values.ends_at),
          status: values.status || "draft"
        };
        const query = values.id
          ? App.db.client().from("mall_directory_items").update(payload).eq("id", values.id)
          : App.db.client().from("mall_directory_items").insert(payload);
        const { error } = await query;
        if (error) throw error;
        core.toast("AVM içeriği kaydedildi.");
        form.reset();
        if (form.elements.id) form.elements.id.value = "";
        await Promise.all([loadDirectory(), loadPartnerSubmissions()]);
      } catch (error) {
        core.toast(error.message || "AVM içeriği kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-avm-edit]");
      if (!edit) return;
      const item = parseRecord(edit.dataset.avmEdit);
      if (item) {
        renderDirectoryZoneOptions(item.floor_zone_id || "");
        fillForm(form, item);
        syncDirectoryRequirements();
      }
    });
  }

  function bindFloorMapForm() {
    const form = document.querySelector("[data-avm-map-form]");
    if (!form) return;
    syncFloorMapRequirements(form);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      const values = core.parseForm(form);
      try {
        const activationErrors = floorMapActivationErrors(values);
        if (activationErrors.length) {
          throw new Error(`Aktif kat planı için ${activationErrors.join(", ")} zorunludur.`);
        }
        const payload = {
          mall_id: await requireDefaultMallId(),
          public_id: values.public_id,
          title: values.title,
          floor_label: values.floor_label,
          image_url: values.image_url || null,
          image_alt: values.image_alt || "",
          native_width_px: optionalNumberValue(values.native_width_px, 1),
          native_height_px: optionalNumberValue(values.native_height_px, 1),
          storage_bucket: values.storage_bucket || "mall-assets",
          storage_path: values.storage_path || null,
          display_order: numberValue(values.display_order, 100, 1),
          status: values.status || "draft"
        };
        const query = values.id
          ? App.db.client().from("mall_floor_maps").update(payload).eq("id", values.id)
          : App.db.client().from("mall_floor_maps").insert(payload);
        const { error } = await query;
        if (error) throw error;
        core.toast("Kat planı görsel kaydı kaydedildi.");
        form.reset();
        if (form.elements.id) form.elements.id.value = "";
        if (form.elements.storage_bucket) form.elements.storage_bucket.value = "mall-assets";
        syncFloorMapRequirements(form);
        await loadFloorMaps();
        await loadFloorZones();
      } catch (error) {
        core.toast(error.message || "Kat planı görsel kaydı kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-avm-map-edit]");
      if (!edit) return;
      const item = parseRecord(edit.dataset.avmMapEdit);
      if (item) {
        fillForm(form, item);
        syncFloorMapRequirements(form);
      }
    });
    form.elements.status?.addEventListener("change", () => syncFloorMapRequirements(form));
    form.addEventListener("reset", () => window.setTimeout(() => syncFloorMapRequirements(form), 0));
  }

  function bindFloorZoneForm() {
    const form = document.querySelector("[data-avm-zone-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      const values = core.parseForm(form);
      try {
        const selectedMap = floorMapRows.find((map) => map.id === values.floor_map_id);
        if (!selectedMap) throw new Error("Kat planı bölgesi için gerçek bir kat görseli seçin.");
        if (values.status === "active" && selectedMap.status !== "active") {
          throw new Error("Bölge aktifleştirilmeden önce bağlı kat planını aktif yayına alın.");
        }
        const coordinates = zoneCoordinatePayload(values);
        const payload = {
          mall_id: await requireDefaultMallId(),
          floor_map_id: selectedMap.id,
          public_id: values.public_id,
          title: values.title,
          floor_label: selectedMap.floor_label,
          zone_type: values.zone_type,
          route_hint: values.route_hint || "",
          management_metric: values.management_metric || "",
          description: values.description || "",
          map_x_percent: coordinates.map_x_percent,
          map_y_percent: coordinates.map_y_percent,
          map_width_percent: coordinates.map_width_percent,
          map_height_px: coordinates.map_height_px,
          display_order: numberValue(values.display_order, 100, 1),
          status: values.status || "draft"
        };
        const query = values.id
          ? App.db.client().from("mall_floor_zones").update(payload).eq("id", values.id)
          : App.db.client().from("mall_floor_zones").insert(payload);
        const { error } = await query;
        if (error) throw error;
        core.toast("Kat planı bölgesi kaydedildi.");
        form.reset();
        if (form.elements.id) form.elements.id.value = "";
        renderZoneFloorMapOptions("");
        await loadFloorZones();
      } catch (error) {
        core.toast(error.message || "Kat planı bölgesi kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-avm-zone-edit]");
      if (!edit) return;
      const item = parseRecord(edit.dataset.avmZoneEdit);
      if (item) {
        renderZoneFloorMapOptions(item.floor_map_id || "");
        fillForm(form, item);
        previewZoneId = zonePreviewId(item);
        renderZonePreview(previewZoneId);
      }
    });
    form.elements.floor_map_id?.addEventListener("change", () => {
      renderZoneFloorMapOptions(form.elements.floor_map_id.value);
      previewZoneId = "";
      renderZonePreview("");
    });
    form.addEventListener("input", () => {
      previewZoneId = "";
      renderZonePreview("");
    });
    form.addEventListener("change", () => {
      previewZoneId = "";
      renderZonePreview("");
    });
    form.addEventListener("reset", () => {
      window.setTimeout(() => {
        renderZoneFloorMapOptions("");
        previewZoneId = "";
        renderZonePreview("");
      }, 0);
    });
  }

  function bindZonePreview() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-avm-preview-zone]");
      if (!button) return;
      previewZoneId = button.dataset.avmPreviewZone || "";
      renderZonePreview(previewZoneId);
    });
  }

  function bindParkingAreaForm() {
    const form = document.querySelector("[data-avm-parking-form]");
    if (!form) return;
    const availabilitySelect = form.elements.availability_status;
    const spacesInput = form.elements.spaces_available;
    const publicationSelect = form.elements.status;
    const syncParkingRequirements = () => {
      const availability = availabilitySelect.value;
      const editableSpaces = ["available", "limited"].includes(availability);
      spacesInput.disabled = !editableSpaces;
      spacesInput.required = editableSpaces;
      if (availability === "unknown") spacesInput.value = "";
      if (["full", "closed"].includes(availability)) spacesInput.value = "0";
      const active = publicationSelect.value === "active";
      form.elements.floor_zone_id.required = active;
      form.elements.hours_profile_id.required = active;
      form.elements.directions_text.required = active;
      form.elements.pricing_text.required = active;
    };
    availabilitySelect.addEventListener("change", syncParkingRequirements);
    publicationSelect.addEventListener("change", syncParkingRequirements);
    form.addEventListener("reset", () => window.setTimeout(syncParkingRequirements, 0));
    syncParkingRequirements();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      const values = core.parseForm(form);
      try {
        const capacity = Number(values.capacity_total);
        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
          throw new Error("Toplam otopark kapasitesi 1-100000 arasında tam sayı olmalıdır.");
        }
        const countFields = ["accessible_spaces", "family_spaces", "ev_charging_spaces", "motorcycle_spaces"];
        const counts = Object.fromEntries(countFields.map((field) => [field, Number(values[field])]));
        if (Object.values(counts).some((value) => !Number.isInteger(value) || value < 0 || value > capacity)) {
          throw new Error("Özel park alanı sayıları 0 ile toplam kapasite arasında olmalıdır.");
        }
        const maxHeight = values.max_height_m === "" || values.max_height_m === null || values.max_height_m === undefined
          ? null
          : Number(values.max_height_m);
        if (maxHeight !== null && (!Number.isFinite(maxHeight) || maxHeight < 1 || maxHeight > 10)) {
          throw new Error("Azami araç yüksekliği 1-10 metre arasında olmalıdır.");
        }
        const directionsUrl = String(values.directions_url || "").trim();
        if (directionsUrl && !validHttpUrl(directionsUrl)) {
          throw new Error("Araç navigasyon bağlantısı geçerli bir HTTP(S) URL olmalıdır.");
        }
        const availabilityStatus = values.availability_status || "unknown";
        let spacesAvailable = null;
        if (["available", "limited"].includes(availabilityStatus)) {
          spacesAvailable = Number(spacesInput.value);
          if (!Number.isInteger(spacesAvailable) || spacesAvailable < 1 || spacesAvailable > capacity) {
            throw new Error("Yer var veya sınırlı yer durumunda boş alan 1 ile toplam kapasite arasında olmalıdır.");
          }
        } else if (["full", "closed"].includes(availabilityStatus)) {
          spacesAvailable = 0;
        }
        const directionsText = String(values.directions_text || "").trim();
        const pricingText = String(values.pricing_text || "").trim();
        if (values.status === "active" && (!values.floor_zone_id || !values.hours_profile_id || !directionsText || !pricingText)) {
          throw new Error("Aktif otopark alanı için kat planı bölgesi, aktif parking saat profili, yaya yönlendirmesi ve ücret bilgisi zorunludur.");
        }
        const current = parkingAreaRows.find((row) => row.id === values.id);
        const currentSpaces = current?.spaces_available === null || current?.spaces_available === undefined
          ? null
          : Number(current.spaces_available);
        const availabilityChanged = !current
          ? availabilityStatus !== "unknown"
          : availabilityStatus !== current.availability_status || spacesAvailable !== currentSpaces;
        const availabilityUpdatedAt = availabilityStatus === "unknown"
          ? null
          : availabilityChanged || !current?.availability_updated_at
            ? new Date().toISOString()
            : current.availability_updated_at;
        const payload = {
          mall_id: await requireDefaultMallId(),
          floor_zone_id: values.floor_zone_id || null,
          hours_profile_id: values.hours_profile_id || null,
          public_id: String(values.public_id || "").trim(),
          title: String(values.title || "").trim(),
          level_label: String(values.level_label || "").trim(),
          entrance_label: String(values.entrance_label || "").trim(),
          directions_text: directionsText || null,
          directions_url: directionsUrl ? normalizedHttpUrl(directionsUrl) : null,
          capacity_total: capacity,
          ...counts,
          max_height_m: maxHeight,
          pricing_text: pricingText || null,
          best_for: String(values.best_for || "").trim() || null,
          availability_status: availabilityStatus,
          spaces_available: spacesAvailable,
          availability_updated_at: availabilityUpdatedAt,
          availability_source: availabilityChanged ? "manual" : current?.availability_source || "manual",
          display_order: numberValue(values.display_order, 100, 1, 10000),
          status: values.status || "draft"
        };
        const query = values.id
          ? App.db.client().from("mall_parking_areas").update(payload).eq("id", values.id)
          : App.db.client().from("mall_parking_areas").insert(payload);
        const { error } = await query;
        if (error) throw error;
        core.toast("Otopark alanı kaydedildi.");
        form.reset();
        form.elements.id.value = "";
        renderParkingZoneOptions("");
        renderParkingHoursOptions("");
        await loadParkingAreas();
      } catch (error) {
        core.toast(error.message || "Otopark alanı kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-avm-parking-edit]");
      if (!edit) return;
      const item = parseRecord(edit.dataset.avmParkingEdit);
      if (!item) return;
      renderParkingZoneOptions(item.floor_zone_id || "");
      renderParkingHoursOptions(item.hours_profile_id || "");
      fillForm(form, item);
      syncParkingRequirements();
    });
  }

  function bindServiceForm() {
    const form = document.querySelector("[data-avm-service-form]");
    if (!form) return;
    const availabilitySelect = form.elements.availability_status;
    const availabilityNote = form.elements.availability_note;
    const syncAvailabilityNote = () => {
      if (!availabilityNote) return;
      availabilityNote.required = availabilitySelect?.value !== "available";
    };
    availabilitySelect?.addEventListener("change", syncAvailabilityNote);
    form.addEventListener("reset", () => window.setTimeout(syncAvailabilityNote, 0));
    syncAvailabilityNote();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      const values = core.parseForm(form);
      try {
        const payload = {
          mall_id: await requireDefaultMallId(),
          floor_zone_id: values.floor_zone_id || null,
          public_id: values.public_id,
          title: values.title,
          category: values.category,
          description: values.description,
          floor_label: values.floor_label,
          route_hint: values.route_hint || null,
          operating_hours: values.operating_hours || null,
          availability_status: values.availability_status || "available",
          availability_note: values.availability_note || null,
          is_accessibility_service: values.is_accessibility_service === "on",
          display_order: numberValue(values.display_order, 100, 1, 10000),
          status: values.status || "draft"
        };
        const query = values.id
          ? App.db.client().from("mall_services").update(payload).eq("id", values.id)
          : App.db.client().from("mall_services").insert(payload);
        const { error } = await query;
        if (error) throw error;
        core.toast("Ziyaretçi hizmeti kaydedildi.");
        form.reset();
        if (form.elements.id) form.elements.id.value = "";
        renderServiceZoneOptions("");
        await loadServices();
      } catch (error) {
        core.toast(error.message || "Ziyaretçi hizmeti kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-avm-service-edit]");
      if (!edit) return;
      const item = parseRecord(edit.dataset.avmServiceEdit);
      if (!item) return;
      renderServiceZoneOptions(item.floor_zone_id || "");
      fillForm(form, item);
      syncAvailabilityNote();
    });
  }

  function bindTransportRouteForm() {
    const form = document.querySelector("[data-avm-transport-form]");
    if (!form) return;
    const publicationStatus = form.elements.status;
    const serviceStatus = form.elements.service_status;
    const syncRequirements = () => {
      const active = publicationStatus.value === "active";
      form.elements.schedule_text.required = active;
      form.elements.directions_url.required = active;
      if (active && serviceStatus.value === "planned") serviceStatus.value = "operating";
    };
    publicationStatus.addEventListener("change", syncRequirements);
    serviceStatus.addEventListener("change", syncRequirements);
    form.addEventListener("reset", () => window.setTimeout(syncRequirements, 0));
    syncRequirements();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      const values = core.parseForm(form);
      try {
        const directionsUrl = String(values.directions_url || "").trim();
        const scheduleText = String(values.schedule_text || "").trim();
        if (directionsUrl && !validHttpUrl(directionsUrl)) {
          throw new Error("Rota bağlantısı geçerli bir HTTP(S) URL olmalıdır.");
        }
        if (values.status === "active" && (!directionsUrl || !scheduleText || values.service_status === "planned")) {
          throw new Error("Aktif ulaşım rotası için sefer bilgisi, doğrulanmış rota URL'si ve planlandı dışında bir hizmet durumu zorunludur.");
        }
        const payload = {
          mall_id: await requireDefaultMallId(),
          public_id: String(values.public_id || "").trim(),
          mode: values.mode,
          title: String(values.title || "").trim(),
          origin_label: String(values.origin_label || "").trim(),
          destination_label: String(values.destination_label || "").trim(),
          stop_name: String(values.stop_name || "").trim() || null,
          route_number: String(values.route_number || "").trim() || null,
          schedule_text: scheduleText || null,
          duration_text: String(values.duration_text || "").trim() || null,
          fare_text: String(values.fare_text || "").trim() || null,
          accessibility_text: String(values.accessibility_text || "").trim() || null,
          directions_text: String(values.directions_text || "").trim(),
          directions_url: directionsUrl ? normalizedHttpUrl(directionsUrl) : null,
          service_status: values.service_status || "operating",
          display_order: numberValue(values.display_order, 100, 1, 10000),
          status: values.status || "draft"
        };
        const query = values.id
          ? App.db.client().from("mall_transport_routes").update(payload).eq("id", values.id)
          : App.db.client().from("mall_transport_routes").insert(payload);
        const { error } = await query;
        if (error) throw error;
        core.toast("Ulaşım rotası kaydedildi.");
        form.reset();
        form.elements.id.value = "";
        await loadTransportRoutes();
      } catch (error) {
        core.toast(error.message || "Ulaşım rotası kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-avm-transport-edit]");
      if (!edit) return;
      const item = parseRecord(edit.dataset.avmTransportEdit);
      if (!item) return;
      fillForm(form, item);
      syncRequirements();
    });
  }

  function bindOperationalNoticeForm() {
    const form = document.querySelector("[data-avm-notice-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      const values = core.parseForm(form);
      try {
        const startsAt = istanbulInputToIso(values.starts_at);
        const endsAt = istanbulInputToIso(values.ends_at);
        if (!startsAt || !endsAt || new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
          throw new Error("Duyuru bitişi başlangıçtan sonra olan geçerli bir İstanbul tarih-saat aralığı olmalıdır.");
        }
        const ctaLabel = String(values.cta_label || "").trim();
        const ctaUrl = String(values.cta_url || "").trim();
        if (Boolean(ctaLabel) !== Boolean(ctaUrl)) {
          throw new Error("Aksiyon etiketi ve URL birlikte girilmelidir.");
        }
        if (ctaUrl && !validHttpUrl(ctaUrl)) {
          throw new Error("Duyuru aksiyon bağlantısı geçerli bir HTTP(S) URL olmalıdır.");
        }
        const payload = {
          mall_id: await requireDefaultMallId(),
          public_id: String(values.public_id || "").trim(),
          notice_type: values.notice_type,
          severity: values.severity || "info",
          title: String(values.title || "").trim(),
          summary: String(values.summary || "").trim(),
          affected_area: String(values.affected_area || "").trim() || null,
          starts_at: startsAt,
          ends_at: endsAt,
          cta_label: ctaLabel || null,
          cta_url: ctaUrl ? normalizedHttpUrl(ctaUrl) : null,
          status: values.status || "draft",
          display_order: numberValue(values.display_order, 100, 1, 10000)
        };
        const query = values.id
          ? App.db.client().from("mall_operational_notices").update(payload).eq("id", values.id)
          : App.db.client().from("mall_operational_notices").insert(payload);
        const { error } = await query;
        if (error) throw error;
        core.toast("Operasyon duyurusu kaydedildi.");
        form.reset();
        form.elements.id.value = "";
        await loadOperationalNotices();
      } catch (error) {
        core.toast(error.message || "Operasyon duyurusu kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-avm-notice-edit]");
      if (!edit) return;
      const item = parseRecord(edit.dataset.avmNoticeEdit);
      if (!item) return;
      fillForm(form, item);
    });
  }

  function bindAdSlotForm() {
    const form = document.querySelector("[data-avm-ad-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      const values = core.parseForm(form);
      try {
        const payload = {
          mall_id: await requireDefaultMallId(),
          public_id: values.public_id,
          title: values.title,
          slot_type: values.slot_type,
          placement: values.placement,
          description: values.description || "",
          lead_goal: values.lead_goal || "",
          display_order: numberValue(values.display_order, 100, 1),
          status: values.status || "draft"
        };
        const query = values.id
          ? App.db.client().from("mall_ad_slots").update(payload).eq("id", values.id)
          : App.db.client().from("mall_ad_slots").insert(payload);
        const { error } = await query;
        if (error) throw error;
        core.toast("Reklam alanı kaydedildi.");
        form.reset();
        if (form.elements.id) form.elements.id.value = "";
        await Promise.all([loadAdSlots(), loadPartnerSubmissions()]);
      } catch (error) {
        core.toast(error.message || "Reklam alanı kaydedilemedi.", "error");
      } finally {
        button.disabled = false;
      }
    });

    document.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-avm-ad-edit]");
      if (!edit) return;
      const item = parseRecord(edit.dataset.avmAdEdit);
      if (item) fillForm(form, item);
    });
  }

  function bindLeadUpdates() {
    document.addEventListener("change", async (event) => {
      const select = event.target.closest("[data-avm-lead-status]");
      if (!select) return;
      try {
        const { error } = await App.db.client()
          .from("mall_leads")
          .update({ status: select.value })
          .eq("id", select.dataset.avmLeadStatus);
        if (error) throw error;
        core.toast("AVM talep durumu güncellendi.");
        await loadLeads();
      } catch (error) {
        core.toast(error.message || "AVM talebi güncellenemedi.", "error");
        await loadLeads();
      }
    });
  }

  function bindLeadControls() {
    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-avm-lead-filters]");
      if (!form) return;
      event.preventDefault();
      leadSearchFilter = form.querySelector("[data-avm-lead-filter-search]")?.value || "";
      loadLeads({ resetPage: true });
    });

    document.addEventListener("change", (event) => {
      const statusFilter = event.target.closest("[data-avm-lead-filter-status]");
      const interestFilter = event.target.closest("[data-avm-lead-filter-interest]");
      const searchFilter = event.target.closest("[data-avm-lead-filter-search]");
      const startFilter = event.target.closest("[data-avm-lead-filter-start]");
      const endFilter = event.target.closest("[data-avm-lead-filter-end]");
      const pageSize = event.target.closest("[data-avm-lead-page-size]");
      if (!statusFilter && !interestFilter && !searchFilter && !startFilter && !endFilter && !pageSize) return;
      if (statusFilter) leadStatusFilter = statusFilter.value;
      if (interestFilter) leadInterestTypeFilter = interestFilter.value;
      if (searchFilter) leadSearchFilter = searchFilter.value;
      if (startFilter) leadStartDateFilter = startFilter.value;
      if (endFilter) leadEndDateFilter = endFilter.value;
      if (pageSize) leadPageSize = Number(pageSize.value) || 50;
      if (leadStartDateFilter && leadEndDateFilter && leadEndDateFilter < leadStartDateFilter) {
        core.toast("Bitiş tarihi başlangıç tarihinden önce olamaz.", "error");
        renderLeads();
        return;
      }
      loadLeads({ resetPage: true });
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-avm-lead-reset]")) {
        leadStatusFilter = "";
        leadInterestTypeFilter = "";
        leadSearchFilter = "";
        leadStartDateFilter = "";
        leadEndDateFilter = "";
        loadLeads({ resetPage: true });
        return;
      }
      const exportButton = event.target.closest("[data-avm-lead-export]");
      if (exportButton) {
        exportLeads(exportButton);
        return;
      }
      if (event.target.closest("[data-avm-lead-previous]") && leadPage > 1) {
        leadPage -= 1;
        loadLeads();
        return;
      }
      const totalPages = Math.max(1, Math.ceil(leadTotal / leadPageSize));
      if (event.target.closest("[data-avm-lead-next]") && leadPage < totalPages) {
        leadPage += 1;
        loadLeads();
      }
    });
  }

  function bindAccessibilityRequestUpdates() {
    document.addEventListener("change", async (event) => {
      const select = event.target.closest("[data-avm-accessibility-request-status]");
      if (!select) return;
      try {
        const { error } = await App.db.client()
          .from("mall_accessibility_requests")
          .update({ status: select.value })
          .eq("id", select.dataset.avmAccessibilityRequestStatus);
        if (error) throw error;
        core.toast("Erişilebilirlik talebi durumu güncellendi.");
        await loadAccessibilityRequests();
      } catch (error) {
        core.toast(error.message || "Erişilebilirlik talebi güncellenemedi.", "error");
        await loadAccessibilityRequests();
      }
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-avm-accessibility-note-save]");
      if (!button) return;
      const requestId = button.dataset.avmAccessibilityNoteSave;
      const input = button.closest(".avm-accessibility-operation")?.querySelector("[data-avm-accessibility-request-note]");
      const adminNote = String(input?.value || "").trim();
      if (adminNote.length === 1) {
        core.toast("Operasyon notu boş bırakılmalı veya en az 2 karakter olmalıdır.", "error");
        return;
      }
      button.disabled = true;
      try {
        const { error } = await App.db.client()
          .from("mall_accessibility_requests")
          .update({ admin_note: adminNote || null })
          .eq("id", requestId);
        if (error) throw error;
        core.toast(adminNote ? "Erişilebilirlik operasyon notu kaydedildi." : "Erişilebilirlik operasyon notu temizlendi.");
        await loadAccessibilityRequests();
      } catch (error) {
        core.toast(error.message || "Erişilebilirlik operasyon notu kaydedilemedi.", "error");
        button.disabled = false;
      }
    });
  }

  function bindAccessibilityRequestControls() {
    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-avm-accessibility-request-filters]");
      if (!form) return;
      event.preventDefault();
      accessibilityRequestSearchFilter = form.querySelector("[data-avm-accessibility-filter-search]")?.value || "";
      loadAccessibilityRequests({ resetPage: true });
    });

    document.addEventListener("change", (event) => {
      const statusFilter = event.target.closest("[data-avm-accessibility-filter-status]");
      const typeFilter = event.target.closest("[data-avm-accessibility-filter-type]");
      const searchFilter = event.target.closest("[data-avm-accessibility-filter-search]");
      const startFilter = event.target.closest("[data-avm-accessibility-filter-start]");
      const endFilter = event.target.closest("[data-avm-accessibility-filter-end]");
      const pageSize = event.target.closest("[data-avm-accessibility-page-size]");
      if (!statusFilter && !typeFilter && !searchFilter && !startFilter && !endFilter && !pageSize) return;
      if (statusFilter) accessibilityRequestStatusFilter = statusFilter.value;
      if (typeFilter) accessibilityRequestTypeFilter = typeFilter.value;
      if (searchFilter) accessibilityRequestSearchFilter = searchFilter.value;
      if (startFilter) accessibilityRequestStartDateFilter = startFilter.value;
      if (endFilter) accessibilityRequestEndDateFilter = endFilter.value;
      if (pageSize) accessibilityRequestPageSize = Number(pageSize.value) || 50;
      if (accessibilityRequestStartDateFilter && accessibilityRequestEndDateFilter && accessibilityRequestEndDateFilter < accessibilityRequestStartDateFilter) {
        core.toast("Ziyaret bitişi başlangıç tarihinden önce olamaz.", "error");
        renderAccessibilityRequests();
        return;
      }
      loadAccessibilityRequests({ resetPage: true });
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-avm-accessibility-reset]")) {
        accessibilityRequestStatusFilter = "";
        accessibilityRequestTypeFilter = "";
        accessibilityRequestSearchFilter = "";
        accessibilityRequestStartDateFilter = "";
        accessibilityRequestEndDateFilter = "";
        loadAccessibilityRequests({ resetPage: true });
        return;
      }
      const exportButton = event.target.closest("[data-avm-accessibility-export]");
      if (exportButton) {
        exportAccessibilityRequests(exportButton);
        return;
      }
      if (event.target.closest("[data-avm-accessibility-previous]") && accessibilityRequestPage > 1) {
        accessibilityRequestPage -= 1;
        loadAccessibilityRequests();
        return;
      }
      const totalPages = Math.max(1, Math.ceil(accessibilityRequestTotal / accessibilityRequestPageSize));
      if (event.target.closest("[data-avm-accessibility-next]") && accessibilityRequestPage < totalPages) {
        accessibilityRequestPage += 1;
        loadAccessibilityRequests();
      }
    });
  }

  function bindPartnerSubmissionUpdates() {
    document.addEventListener("change", async (event) => {
      const statusSelect = event.target.closest("[data-avm-partner-submission-status]");
      const visibilitySelect = event.target.closest("[data-avm-partner-submission-visibility]");
      if (!statusSelect && !visibilitySelect) return;
      const select = statusSelect || visibilitySelect;
      const id = statusSelect
        ? statusSelect.dataset.avmPartnerSubmissionStatus
        : visibilitySelect.dataset.avmPartnerSubmissionVisibility;
      const payload = statusSelect
        ? {
          status: select.value,
          ...(select.value === "approved" ? {} : { visibility_status: "not_published" })
        }
        : { visibility_status: select.value };
      try {
        const { error } = await App.db.client()
          .from("mall_partner_submissions")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
        core.toast(statusSelect ? "Yayın talebi inceleme durumu güncellendi." : "Yayın görünürlüğü güncellendi.");
        await loadPartnerSubmissions();
      } catch (error) {
        core.toast(error.message || "AVM yayın talebi güncellenemedi.", "error");
        await loadPartnerSubmissions();
      }
    });
  }

  function bindPartnerSubmissionControls() {
    document.addEventListener("change", (event) => {
      const requestType = event.target.closest("[data-avm-partner-submission-filter-type]");
      const status = event.target.closest("[data-avm-partner-submission-filter-status]");
      const visibility = event.target.closest("[data-avm-partner-submission-filter-visibility]");
      const startDate = event.target.closest("[data-avm-partner-submission-filter-start]");
      const endDate = event.target.closest("[data-avm-partner-submission-filter-end]");
      const pageSize = event.target.closest("[data-avm-partner-submission-page-size]");
      if (!requestType && !status && !visibility && !startDate && !endDate && !pageSize) return;
      if (requestType) partnerSubmissionRequestTypeFilter = requestType.value;
      if (status) partnerSubmissionStatusFilter = status.value;
      if (visibility) partnerSubmissionVisibilityFilter = visibility.value;
      if (startDate) partnerSubmissionStartDateFilter = startDate.value;
      if (endDate) partnerSubmissionEndDateFilter = endDate.value;
      if (pageSize) partnerSubmissionPageSize = Number(pageSize.value) || 25;
      if (partnerSubmissionStartDateFilter && partnerSubmissionEndDateFilter && partnerSubmissionEndDateFilter < partnerSubmissionStartDateFilter) {
        core.toast("Bitiş tarihi başlangıç tarihinden önce olamaz.", "error");
        renderPartnerSubmissions();
        return;
      }
      loadPartnerSubmissions({ resetPage: true });
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-avm-partner-submission-reset]")) {
        partnerSubmissionRequestTypeFilter = "";
        partnerSubmissionStatusFilter = "";
        partnerSubmissionVisibilityFilter = "";
        partnerSubmissionStartDateFilter = "";
        partnerSubmissionEndDateFilter = "";
        loadPartnerSubmissions({ resetPage: true });
        return;
      }
      if (event.target.closest("[data-avm-partner-submission-previous]") && partnerSubmissionPage > 1) {
        partnerSubmissionPage -= 1;
        loadPartnerSubmissions();
        return;
      }
      const totalPages = Math.max(1, Math.ceil(partnerSubmissionTotal / partnerSubmissionPageSize));
      if (event.target.closest("[data-avm-partner-submission-next]") && partnerSubmissionPage < totalPages) {
        partnerSubmissionPage += 1;
        loadPartnerSubmissions();
      }
    });
  }

  function bindPartnerSubmissionTargetCreation() {
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-avm-partner-create-target]");
      if (!button) return;
      const id = button.dataset.avmPartnerCreateTarget;
      const submission = partnerSubmissionRows.find((row) => row.id === id);
      if (!submission || partnerSubmissionTarget(submission)) return;
      button.disabled = true;
      try {
        const { error } = await App.db.client().rpc("create_mall_partner_submission_target", {
          target_submission_id: id
        });
        if (error) throw error;
        core.toast(submission.request_type === "advertising" ? "Reklam alanı taslağı oluşturuldu." : "AVM katalog taslağı oluşturuldu.");
        await Promise.all([loadPartnerSubmissions(), loadDirectory(), loadAdSlots()]);
      } catch (error) {
        core.toast(error.message || "Yayın hedefi oluşturulamadı.", "error");
        button.disabled = false;
      }
    });
  }

  function bindVisitPlanUpdates() {
    document.addEventListener("change", async (event) => {
      const select = event.target.closest("[data-avm-plan-status]");
      if (!select) return;
      try {
        const { error } = await App.db.client()
          .from("mall_visit_plans")
          .update({ status: select.value })
          .eq("id", select.dataset.avmPlanStatus);
        if (error) throw error;
        core.toast("Ziyaret planı durumu güncellendi.");
        await loadVisitPlans();
      } catch (error) {
        core.toast(error.message || "Ziyaret planı güncellenemedi.", "error");
        await loadVisitPlans();
      }
    });
  }

  function bindVisitPlanControls() {
    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-avm-visit-plan-filters]");
      if (!form) return;
      event.preventDefault();
      visitPlanSearchFilter = form.querySelector("[data-avm-visit-plan-filter-search]")?.value || "";
      loadVisitPlans({ resetPage: true });
    });

    document.addEventListener("change", (event) => {
      const statusFilter = event.target.closest("[data-avm-visit-plan-filter-status]");
      const searchFilter = event.target.closest("[data-avm-visit-plan-filter-search]");
      const startFilter = event.target.closest("[data-avm-visit-plan-filter-start]");
      const endFilter = event.target.closest("[data-avm-visit-plan-filter-end]");
      const pageSize = event.target.closest("[data-avm-visit-plan-page-size]");
      if (!statusFilter && !searchFilter && !startFilter && !endFilter && !pageSize) return;
      if (statusFilter) visitPlanStatusFilter = statusFilter.value;
      if (searchFilter) visitPlanSearchFilter = searchFilter.value;
      if (startFilter) visitPlanStartDateFilter = startFilter.value;
      if (endFilter) visitPlanEndDateFilter = endFilter.value;
      if (pageSize) visitPlanPageSize = Number(pageSize.value) || 50;
      if (visitPlanStartDateFilter && visitPlanEndDateFilter && visitPlanEndDateFilter < visitPlanStartDateFilter) {
        core.toast("Bitiş tarihi başlangıç tarihinden önce olamaz.", "error");
        renderVisitPlans();
        return;
      }
      loadVisitPlans({ resetPage: true });
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-avm-visit-plan-reset]")) {
        visitPlanStatusFilter = "";
        visitPlanSearchFilter = "";
        visitPlanStartDateFilter = "";
        visitPlanEndDateFilter = "";
        loadVisitPlans({ resetPage: true });
        return;
      }
      const exportButton = event.target.closest("[data-avm-visit-plan-export]");
      if (exportButton) {
        exportVisitPlans(exportButton);
        return;
      }
      if (event.target.closest("[data-avm-visit-plan-previous]") && visitPlanPage > 1) {
        visitPlanPage -= 1;
        loadVisitPlans();
        return;
      }
      const totalPages = Math.max(1, Math.ceil(visitPlanTotal / visitPlanPageSize));
      if (event.target.closest("[data-avm-visit-plan-next]") && visitPlanPage < totalPages) {
        visitPlanPage += 1;
        loadVisitPlans();
      }
    });
  }

  function bindCampaignRedemptionUpdates() {
    document.addEventListener("change", async (event) => {
      const select = event.target.closest("[data-avm-redemption-status]");
      if (!select) return;
      try {
        const { error } = await App.db.client()
          .from("mall_campaign_redemptions")
          .update({ status: select.value })
          .eq("id", select.dataset.avmRedemptionStatus);
        if (error) throw error;
        core.toast("Kampanya ilgi durumu güncellendi.");
        await loadCampaignRedemptions();
      } catch (error) {
        core.toast(error.message || "Kampanya ilgi durumu güncellenemedi.", "error");
        await loadCampaignRedemptions();
      }
    });
  }

  function bindCampaignRedemptionControls() {
    document.addEventListener("change", (event) => {
      const statusFilter = event.target.closest("[data-avm-redemption-filter-status]");
      const actionFilter = event.target.closest("[data-avm-redemption-filter-action]");
      const campaignFilter = event.target.closest("[data-avm-redemption-filter-campaign]");
      const categoryFilter = event.target.closest("[data-avm-redemption-filter-category]");
      const partnerFilter = event.target.closest("[data-avm-redemption-filter-partner]");
      const visibilityFilter = event.target.closest("[data-avm-redemption-filter-visibility]");
      const startFilter = event.target.closest("[data-avm-redemption-filter-start]");
      const endFilter = event.target.closest("[data-avm-redemption-filter-end]");
      const pageSize = event.target.closest("[data-avm-redemption-page-size]");
      if (!statusFilter && !actionFilter && !campaignFilter && !categoryFilter && !partnerFilter && !visibilityFilter && !startFilter && !endFilter && !pageSize) return;
      if (statusFilter) campaignRedemptionStatusFilter = statusFilter.value;
      if (actionFilter) campaignRedemptionActionFilter = actionFilter.value;
      if (campaignFilter) campaignRedemptionCampaignFilter = campaignFilter.value;
      if (categoryFilter) campaignRedemptionCategoryFilter = categoryFilter.value;
      if (partnerFilter) campaignRedemptionPartnerFilter = partnerFilter.value;
      if (visibilityFilter) campaignRedemptionVisibilityFilter = visibilityFilter.value;
      if (startFilter) campaignRedemptionStartDateFilter = startFilter.value;
      if (endFilter) campaignRedemptionEndDateFilter = endFilter.value;
      if (pageSize) campaignRedemptionPageSize = Number(pageSize.value) || 50;
      if (campaignRedemptionStartDateFilter && campaignRedemptionEndDateFilter && campaignRedemptionEndDateFilter < campaignRedemptionStartDateFilter) {
        core.toast("Bitiş tarihi başlangıç tarihinden önce olamaz.", "error");
        renderCampaignRedemptions();
        return;
      }
      loadCampaignRedemptions({ resetPage: true });
    });

    document.addEventListener("click", (event) => {
      const resetButton = event.target.closest("[data-avm-redemption-reset]");
      if (resetButton) {
        campaignRedemptionStatusFilter = "";
        campaignRedemptionActionFilter = "";
        campaignRedemptionCampaignFilter = "";
        campaignRedemptionCategoryFilter = "";
        campaignRedemptionPartnerFilter = "";
        campaignRedemptionVisibilityFilter = "";
        campaignRedemptionStartDateFilter = "";
        campaignRedemptionEndDateFilter = "";
        loadCampaignRedemptions({ resetPage: true });
        return;
      }
      const exportButton = event.target.closest("[data-avm-redemption-export]");
      if (exportButton) {
        exportCampaignRedemptions(exportButton);
        return;
      }
      if (event.target.closest("[data-avm-redemption-previous]") && campaignRedemptionPage > 1) {
        campaignRedemptionPage -= 1;
        loadCampaignRedemptions();
        return;
      }
      const totalPages = Math.max(1, Math.ceil(campaignRedemptionTotal / campaignRedemptionPageSize));
      if (event.target.closest("[data-avm-redemption-next]") && campaignRedemptionPage < totalPages) {
        campaignRedemptionPage += 1;
        loadCampaignRedemptions();
      }
    });
  }

  function bindDirectoryInteractionControls() {
    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-avm-directory-interaction-filters]");
      if (!form) return;
      event.preventDefault();
      directoryInteractionSearchFilter = form.querySelector("[data-avm-directory-interaction-filter-search]")?.value || "";
      loadDirectoryInteractions({ resetPage: true });
    });

    document.addEventListener("change", (event) => {
      const typeFilter = event.target.closest("[data-avm-directory-interaction-filter-type]");
      const searchFilter = event.target.closest("[data-avm-directory-interaction-filter-search]");
      const startFilter = event.target.closest("[data-avm-directory-interaction-filter-start]");
      const endFilter = event.target.closest("[data-avm-directory-interaction-filter-end]");
      const pageSize = event.target.closest("[data-avm-directory-interaction-page-size]");
      if (!typeFilter && !searchFilter && !startFilter && !endFilter && !pageSize) return;
      if (typeFilter) directoryInteractionTypeFilter = typeFilter.value;
      if (searchFilter) directoryInteractionSearchFilter = searchFilter.value;
      if (startFilter) directoryInteractionStartDateFilter = startFilter.value;
      if (endFilter) directoryInteractionEndDateFilter = endFilter.value;
      if (pageSize) directoryInteractionPageSize = Number(pageSize.value) || 50;
      if (directoryInteractionStartDateFilter && directoryInteractionEndDateFilter && directoryInteractionEndDateFilter < directoryInteractionStartDateFilter) {
        core.toast("Bitiş tarihi başlangıç tarihinden önce olamaz.", "error");
        renderDirectoryInteractions();
        return;
      }
      loadDirectoryInteractions({ resetPage: true });
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-avm-directory-interaction-reset]")) {
        directoryInteractionTypeFilter = "";
        directoryInteractionSearchFilter = "";
        directoryInteractionStartDateFilter = "";
        directoryInteractionEndDateFilter = "";
        loadDirectoryInteractions({ resetPage: true });
        return;
      }
      const exportButton = event.target.closest("[data-avm-directory-interaction-export]");
      if (exportButton) {
        exportDirectoryInteractions(exportButton);
        return;
      }
      if (event.target.closest("[data-avm-directory-interaction-previous]") && directoryInteractionPage > 1) {
        directoryInteractionPage -= 1;
        loadDirectoryInteractions();
        return;
      }
      const totalPages = Math.max(1, Math.ceil(directoryInteractionTotal / directoryInteractionPageSize));
      if (event.target.closest("[data-avm-directory-interaction-next]") && directoryInteractionPage < totalPages) {
        directoryInteractionPage += 1;
        loadDirectoryInteractions();
      }
    });
  }

  async function refreshMallOperations() {
    await loadFloorMaps();
    await loadFloorZones();
    await loadDirectory();
    await Promise.all([
      loadOpeningHoursAdmin(),
      loadOperationalNotices(),
      loadAdSlots(),
      loadPartnerSubmissions(),
      loadVisitPlans(),
      loadCampaignRedemptions({ refreshDimensions: true }),
      loadDirectoryInteractions(),
      loadAccessibilityRequests(),
      loadLeads()
    ]);
    await Promise.all([loadParkingAreas(), loadTransportRoutes(), loadServices()]);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector("[data-page='admin-avm']")) return;
    const access = await guard();
    if (!access) return;
    bindMallCenterForm();
    bindOperationalNoticeForm();
    bindHoursProfileForm();
    bindWeeklyHoursForm();
    bindSpecialHoursForm();
    bindDirectoryForm();
    bindFloorMapForm();
    bindFloorZoneForm();
    bindParkingAreaForm();
    bindTransportRouteForm();
    bindServiceForm();
    bindAdSlotForm();
    bindLeadUpdates();
    bindLeadControls();
    bindAccessibilityRequestUpdates();
    bindAccessibilityRequestControls();
    bindPartnerSubmissionUpdates();
    bindPartnerSubmissionControls();
    bindPartnerSubmissionTargetCreation();
    bindVisitPlanUpdates();
    bindVisitPlanControls();
    bindCampaignRedemptionUpdates();
    bindCampaignRedemptionControls();
    bindDirectoryInteractionControls();
    bindZonePreview();
    await loadMallCenter();
    await refreshMallOperations();
  });
})();
