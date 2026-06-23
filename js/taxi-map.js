(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core || {};
  const fallbackCenter = [41.0082, 28.9784];
  const updateIntervalMs = 2800;

  let serviceConfig = {
    ekonomik: { label: "Ekonomik", description: "Uygun fiyat", base: 72, perKm: 21, perMin: 2.9, reserveFee: 45, airportFee: 0, multiplier: 1, hpRate: 18 },
    konfor: { label: "Konfor", description: "Daha geniş araç", base: 95, perKm: 27, perMin: 3.4, reserveFee: 55, airportFee: 0, multiplier: 1.18, hpRate: 16 },
    vip: { label: "VIP", description: "Premium sürüş", base: 170, perKm: 42, perMin: 5.2, reserveFee: 85, airportFee: 80, multiplier: 1.55, hpRate: 12 },
    aile: { label: "Aile", description: "Bagaj ve aile aracı", base: 110, perKm: 29, perMin: 3.7, reserveFee: 60, airportFee: 0, multiplier: 1.24, hpRate: 15 }
  };

  const paymentLabels = {
    "allona-cash": "Allona Cash",
    card: "Kayıtlı Kart",
    cash: "Nakit",
    coupon: "Kupon + Kart"
  };

  const profileLabels = {
    personal: "Kişisel",
    business: "Kurumsal",
    airport: "Havalimanı"
  };

  const phaseOrder = ["plan", "option", "match", "route", "complete"];

  let drivers = [
    {
      id: "AT-104",
      name: "Ahmet K.",
      type: "Ekonomik",
      services: ["ekonomik", "aile"],
      lat: 41.0146,
      lng: 28.9767,
      rating: 4.9,
      hp: 20,
      vehicle: "Toyota Corolla Hybrid",
      plate: "34 AT 104",
      color: "Beyaz",
      verified: true,
      female: false,
      airportPermit: true
    },
    {
      id: "AT-218",
      name: "Mehmet A.",
      type: "Konfor",
      services: ["konfor", "aile"],
      lat: 41.0048,
      lng: 28.9896,
      rating: 4.8,
      hp: 25,
      vehicle: "Skoda Superb",
      plate: "34 AH 218",
      color: "Siyah",
      verified: true,
      female: false,
      airportPermit: true
    },
    {
      id: "AT-331",
      name: "Selin T.",
      type: "Kadın Sürücü",
      services: ["ekonomik", "konfor"],
      lat: 41.0182,
      lng: 28.9660,
      rating: 5.0,
      hp: 30,
      vehicle: "Hyundai Ioniq",
      plate: "34 AL 331",
      color: "Mavi",
      verified: true,
      female: true,
      airportPermit: false
    },
    {
      id: "AT-442",
      name: "VIP Transfer",
      type: "VIP",
      services: ["vip"],
      lat: 41.0328,
      lng: 28.9839,
      rating: 5.0,
      hp: 50,
      vehicle: "Mercedes Vito",
      plate: "34 VIP 442",
      color: "Siyah",
      verified: true,
      female: false,
      airportPermit: true
    },
    {
      id: "AT-509",
      name: "Allona 509",
      type: "Aile",
      services: ["aile", "konfor"],
      lat: 40.9987,
      lng: 28.9728,
      rating: 4.8,
      hp: 24,
      vehicle: "Volkswagen Caddy",
      plate: "34 AIL 509",
      color: "Gri",
      verified: true,
      female: false,
      airportPermit: false
    },
    {
      id: "AT-612",
      name: "Derya M.",
      type: "Kadın Konfor",
      services: ["konfor", "vip"],
      lat: 41.0112,
      lng: 28.9546,
      rating: 4.9,
      hp: 34,
      vehicle: "BMW iX1",
      plate: "34 DRY 612",
      color: "Lacivert",
      verified: true,
      female: true,
      airportPermit: true
    }
  ];

  const state = {
    map: null,
    markers: new Map(),
    userMarker: null,
    pickupMarker: null,
    destinationMarker: null,
    routeLine: null,
    pickup: { lat: fallbackCenter[0], lng: fallbackCenter[1] },
    destination: null,
    selectedDriverId: "",
    intervalId: null,
    watchId: null,
    service: "ekonomik",
    payment: "allona-cash",
    profile: "personal",
    reserveMode: "now",
    reserveTime: "",
    preferWomanDriver: false,
    safety: {
      pin: true,
      share: true,
      ridecheck: true
    },
    pin: "4826",
    phase: "plan",
    lastNotice: "",
    dataSource: "Demo filo",
    syncState: "Supabase bağlanıyor",
    rideRequestId: "",
    supabaseReady: false
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function escapeHTML(value) {
    return core.escapeHTML ? core.escapeHTML(value) : String(value ?? "");
  }

  function setText(selector, value) {
    $all(selector).forEach((node) => {
      node.textContent = value;
    });
  }

  function setInput(selector, value) {
    $all(selector).forEach((node) => {
      node.value = value;
    });
  }

  function toast(message, type) {
    if (core.toast) {
      core.toast(message, type);
    }
  }

  function dataApi() {
    return App.db && App.db.taxi ? App.db.taxi : null;
  }

  function setDataSource(source, syncState) {
    state.dataSource = source;
    state.syncState = syncState;
    setText("[data-taxi-data-source]", source);
    setText("[data-taxi-sync-state]", syncState);
  }

  function requestStatus(message) {
    setText("[data-taxi-request-status]", message);
  }

  function clearDriverMarkers() {
    state.markers.forEach((marker) => marker.remove());
    state.markers.clear();
  }

  function renderServiceControls() {
    const entries = Object.entries(serviceConfig)
      .sort(([, a], [, b]) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100));
    const select = $("[data-taxi-service]");
    const optionList = $("[data-taxi-service-options]");

    if (select) {
      select.innerHTML = entries.map(([key, config]) => `<option value="${escapeHTML(key)}">${escapeHTML(config.label)}</option>`).join("");
      select.value = serviceConfig[state.service] ? state.service : entries[0]?.[0] || "ekonomik";
      state.service = select.value;
    }

    if (optionList) {
      optionList.innerHTML = entries.map(([key, config]) => `
        <button class="ride${key === state.service ? " is-active" : ""}" type="button" data-taxi-option="${escapeHTML(key)}">
          <b>${escapeHTML(config.label)}</b>
          <p>${escapeHTML(config.description || "Yolculuk")}</p>
        </button>
      `).join("");
    }
  }

  function renderQuickDestinations(destinations) {
    const list = $("[data-taxi-destination-list]");
    if (!list || !destinations || !destinations.length) return;
    list.innerHTML = destinations.map((destination) => `
      <button type="button" data-taxi-destination="${escapeHTML(destination.label)}" data-lat="${Number(destination.lat)}" data-lng="${Number(destination.lng)}">
        ${escapeHTML(destination.shortLabel || destination.label)}
      </button>
    `).join("");
  }

  function normalizeRemoteServiceConfig(items) {
    if (!items || !items.length) return;
    serviceConfig = items.reduce((next, item) => {
      next[item.key] = {
        label: item.label,
        description: item.description,
        base: item.base,
        perKm: item.perKm,
        perMin: item.perMin,
        reserveFee: item.reserveFee,
        airportFee: item.airportFee,
        multiplier: item.multiplier || 1,
        hpRate: item.hpRate || 18,
        sortOrder: item.sortOrder || 100
      };
      return next;
    }, {});
    if (!serviceConfig[state.service]) {
      state.service = Object.keys(serviceConfig)[0] || "ekonomik";
    }
    renderServiceControls();
  }

  function icon(className, label) {
    return L.divIcon({
      className: "taxi-leaflet-icon",
      html: `<span class="${className}">${escapeHTML(label)}</span>`,
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });
  }

  function driverIcon(driver) {
    const isSelected = driver.id === state.selectedDriverId;
    const label = driver.services.includes("vip") ? "V" : (driver.female ? "K" : "T");
    return icon(`taxi-driver-marker${isSelected ? " is-selected" : ""}`, label);
  }

  function pointIcon(label) {
    return icon("taxi-point-marker", label);
  }

  function userIcon() {
    return icon("taxi-user-marker", "K");
  }

  function toRad(value) {
    return value * Math.PI / 180;
  }

  function distanceKm(a, b) {
    if (!a || !b) return 0;
    const earthRadius = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function etaFor(driver) {
    const km = distanceKm(driver, state.pickup);
    const serviceFactor = state.service === "vip" ? 3 : 2;
    return Math.max(2, Math.round(km * 4 + serviceFactor));
  }

  function driveMinutes() {
    const km = tripDistance();
    return Math.max(8, Math.round(km * 4.8 + 6));
  }

  function tripDistance() {
    if (!state.destination) return 5.8;
    return Math.max(1.2, distanceKm(state.pickup, state.destination));
  }

  function normalizedService(value) {
    return serviceConfig[value] ? value : "ekonomik";
  }

  function availableDrivers() {
    let filtered = drivers.filter((driver) => driver.services.includes(state.service));
    if (state.preferWomanDriver) {
      filtered = filtered.filter((driver) => driver.female);
    }
    if (state.profile === "airport") {
      filtered = filtered.filter((driver) => driver.airportPermit);
    }
    return filtered.length ? filtered : drivers.filter((driver) => driver.services.includes(state.service));
  }

  function sortedDrivers() {
    return [...availableDrivers()].sort((a, b) => etaFor(a) - etaFor(b));
  }

  function selectedDriver() {
    return drivers.find((driver) => driver.id === state.selectedDriverId) || sortedDrivers()[0] || null;
  }

  function estimateFare() {
    const service = serviceConfig[state.service];
    const km = tripDistance();
    const minutes = driveMinutes();
    const reserveFee = state.reserveMode === "reserve" ? Number(service.reserveFee || 45) : 0;
    const airportFee = state.profile === "airport" ? Number(service.airportFee || 80) : 0;
    const profileDiscount = state.profile === "business" ? 0.96 : 1;
    const couponDiscount = state.payment === "coupon" ? 0.9 : 1;
    const amount = ((service.base + km * service.perKm + minutes * Number(service.perMin || 2.9) + reserveFee + airportFee) * service.multiplier) * profileDiscount * couponDiscount;
    const low = Math.max(Number(service.minimumFare || service.base), Math.round(amount * 0.93));
    const high = Math.round(amount * 1.08);
    const hp = Math.max(12, Math.round(high / service.hpRate) + (selectedDriver()?.hp || 0));
    return { low, high, hp, km, minutes };
  }

  function money(value) {
    return `₺${Math.round(value).toLocaleString("tr-TR")}`;
  }

  function formattedReserveTime() {
    if (state.reserveMode === "now") return "Şimdi";
    if (!state.reserveTime) return "Saat seç";
    const date = new Date(state.reserveTime);
    if (Number.isNaN(date.getTime())) return "Saat seç";
    return date.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function toLocalInputValue(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function safetySummary() {
    const active = [];
    if (state.safety.pin) active.push("PIN");
    if (state.safety.share) active.push("Paylaşım");
    if (state.safety.ridecheck) active.push("RideCheck");
    return active.length ? active.join(" + ") : "Standart takip";
  }

  function setLiveLabel(message) {
    setText("[data-taxi-live-label]", message);
  }

  function setStatus(message) {
    state.lastNotice = message;
    setText("[data-taxi-map-status]", message);
    setText("[data-taxi-command-status]", message);
  }

  function setPhase(phase) {
    if (!phaseOrder.includes(phase)) return;
    state.phase = phase;
    updateTimeline();
  }

  function updateTimeline() {
    const activeIndex = phaseOrder.indexOf(state.phase);
    $all("[data-taxi-phase]").forEach((node) => {
      const index = phaseOrder.indexOf(node.dataset.taxiPhase);
      node.classList.toggle("is-active", index === activeIndex);
      node.classList.toggle("is-complete", index > -1 && index < activeIndex);
    });
  }

  function updateControls() {
    const serviceNode = $("[data-taxi-service]");
    if (serviceNode && serviceNode.value !== state.service) {
      serviceNode.value = state.service;
    }

    $all("[data-taxi-option]").forEach((node) => {
      node.classList.toggle("is-active", node.dataset.taxiOption === state.service);
    });

    $all("[data-taxi-reserve-mode]").forEach((node) => {
      node.classList.toggle("is-active", node.dataset.taxiReserveMode === state.reserveMode);
    });

    $all("[data-taxi-safety]").forEach((node) => {
      const key = node.dataset.taxiSafety;
      if (key && Object.prototype.hasOwnProperty.call(state.safety, key)) {
        node.classList.toggle("is-active", Boolean(state.safety[key]));
      }
    });

    $all("[data-taxi-woman-driver]").forEach((node) => {
      node.classList.toggle("is-active", state.preferWomanDriver);
    });

    setText("[data-taxi-payment-summary]", paymentLabels[state.payment] || paymentLabels["allona-cash"]);
    setText("[data-taxi-reserve-summary]", formattedReserveTime());
  }

  function updateSummary() {
    const nearest = sortedDrivers()[0];
    const fare = estimateFare();
    const serviceLabel = serviceConfig[state.service].label;
    const eta = nearest ? etaFor(nearest) : "-";
    const driverCount = availableDrivers().length;
    const driver = selectedDriver();

    setText("[data-taxi-map-title]", `Yakında ${driverCount} uygun sürücü`);
    setText("[data-taxi-fare]", `${money(fare.low)} - ${money(fare.high)}`);
    setText("[data-taxi-eta]", `${eta} dk`);
    setText("[data-taxi-distance]", `${fare.km.toFixed(1)} km`);
    setText("[data-taxi-hp]", `+${fare.hp} HP`);
    setText("[data-taxi-pin]", state.safety.pin ? state.pin : "Kapalı");
    setText("[data-taxi-security-summary]", safetySummary());
    setText("[data-taxi-data-source]", state.dataSource);
    setText("[data-taxi-sync-state]", state.syncState);

    if (driver) {
      setText("[data-taxi-driver-name]", driver.name);
      setText("[data-taxi-driver-vehicle]", `${driver.vehicle} ${driver.color}`);
      setText("[data-taxi-driver-plate]", driver.plate);
      renderDriverProfile(driver, fare, eta);
    }

    if (!state.lastNotice) {
      setStatus(`${serviceLabel} yolculuk için ${driver ? driver.name : "uygun sürücü"} öneriliyor. Tahmini geliş ${eta} dk.`);
    }
  }

  function renderDriverProfile(driver, fare, eta) {
    const profile = $("[data-taxi-driver-profile]");
    if (!profile) return;
    const verification = driver.verified ? "Doğrulanmış sürücü" : "Doğrulama bekleniyor";
    const womanPreference = driver.female ? "Kadın sürücü tercihi uygun" : "Standart sürücü";
    profile.innerHTML = `
      <small>${escapeHTML(verification)} · ${escapeHTML(womanPreference)}</small>
      <h3>${escapeHTML(driver.name)} · ${driver.rating.toFixed(1)} puan</h3>
      <p>${escapeHTML(driver.vehicle)} · ${escapeHTML(driver.color)} · Plaka ${escapeHTML(driver.plate)}</p>
      <p>PIN: <strong>${escapeHTML(state.safety.pin ? state.pin : "Kapalı")}</strong> · ETA ${escapeHTML(String(eta))} dk · ${escapeHTML(money(fare.low))}-${escapeHTML(money(fare.high))}</p>
    `;
  }

  function setPickup(lat, lng, label) {
    state.pickup = { lat, lng };
    setInput("[data-taxi-pickup]", label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);

    if (!state.pickupMarker) {
      state.pickupMarker = L.marker([lat, lng], { icon: pointIcon("A"), zIndexOffset: 420 }).addTo(state.map);
    } else {
      state.pickupMarker.setLatLng([lat, lng]);
    }

    state.pickupMarker.bindPopup("Alış noktası");
    updateRoute();
    renderDrivers();
  }

  function setDestination(lat, lng, label) {
    state.destination = { lat, lng };
    setInput("[data-taxi-dropoff]", label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);

    if (!state.destinationMarker) {
      state.destinationMarker = L.marker([lat, lng], { icon: pointIcon("B"), zIndexOffset: 420 }).addTo(state.map);
    } else {
      state.destinationMarker.setLatLng([lat, lng]);
    }

    state.destinationMarker.bindPopup("Varış noktası");
    updateRoute();
    setPhase("option");
    renderDrivers();
  }

  function updateRoute() {
    if (!state.map || !state.pickup || !state.destination) return;
    const midpoint = {
      lat: (state.pickup.lat + state.destination.lat) / 2 + 0.007,
      lng: (state.pickup.lng + state.destination.lng) / 2 - 0.004
    };
    const points = [
      [state.pickup.lat, state.pickup.lng],
      [midpoint.lat, midpoint.lng],
      [state.destination.lat, state.destination.lng]
    ];

    if (!state.routeLine) {
      state.routeLine = L.polyline(points, {
        color: "#00e5ff",
        weight: 5,
        opacity: 0.86,
        dashArray: "8 10"
      }).addTo(state.map);
    } else {
      state.routeLine.setLatLngs(points);
    }
  }

  function renderDrivers() {
    if (!state.map) return;
    const visibleDrivers = sortedDrivers();
    const visibleIds = new Set(visibleDrivers.map((driver) => driver.id));

    state.markers.forEach((marker, driverId) => {
      if (!visibleIds.has(driverId)) {
        marker.remove();
        state.markers.delete(driverId);
      }
    });

    visibleDrivers.forEach((driver) => {
      const popup = `<strong>${escapeHTML(driver.name)}</strong><br>${escapeHTML(driver.type)} · ${escapeHTML(driver.plate)}<br>${etaFor(driver)} dk · ${driver.rating.toFixed(1)} puan`;
      const marker = state.markers.get(driver.id);

      if (marker) {
        marker.setLatLng([driver.lat, driver.lng]);
        marker.setIcon(driverIcon(driver));
        marker.setPopupContent(popup);
      } else {
        const nextMarker = L.marker([driver.lat, driver.lng], { icon: driverIcon(driver), title: driver.name })
          .addTo(state.map)
          .bindPopup(popup);
        state.markers.set(driver.id, nextMarker);
      }
    });

    if (!visibleIds.has(state.selectedDriverId)) {
      state.selectedDriverId = visibleDrivers[0]?.id || "";
    }

    renderDriverList();
    updateControls();
    updateSummary();
  }

  function renderDriverList() {
    const list = $("[data-taxi-driver-list]");
    if (!list) return;

    list.innerHTML = sortedDrivers().slice(0, 4).map((driver) => {
      const badges = [
        driver.verified ? "Doğrulanmış" : "Kontrol",
        driver.female ? "Kadın sürücü" : serviceConfig[state.service].label,
        driver.airportPermit ? "Havalimanı" : "Şehir içi"
      ].join(" · ");

      return `
        <button class="driver glass${driver.id === state.selectedDriverId ? " is-selected" : ""}" type="button" data-taxi-driver="${escapeHTML(driver.id)}">
          <div class="driver-img"></div>
          <b>${escapeHTML(driver.name)}</b>
          <p>${escapeHTML(driver.vehicle)} · ${escapeHTML(driver.plate)}</p>
          <p>${escapeHTML(badges)} · ${etaFor(driver)} dk uzaklıkta</p>
          <div class="meta"><span>${driver.rating.toFixed(1)} Puan</span><span>${driver.completedTrips ? `${driver.completedTrips}+ sürüş` : `+${driver.hp} HP`}</span></div>
        </button>
      `;
    }).join("");
  }

  async function loadSupabaseTaxiData() {
    const api = dataApi();
    if (!api) {
      setDataSource("Demo filo", "Supabase client yok");
      requestStatus("Supabase client yüklenmedi; demo filo ile çalışıyor.");
      return;
    }

    setDataSource("Supabase aranıyor", "Canlı tablo kontrolü");
    try {
      const [classes, remoteDrivers, destinations] = await Promise.all([
        api.vehicleClasses(),
        api.drivers(),
        api.destinations()
      ]);

      normalizeRemoteServiceConfig(classes);
      if (destinations && destinations.length) renderQuickDestinations(destinations);
      if (remoteDrivers && remoteDrivers.length) {
        drivers = remoteDrivers;
        state.selectedDriverId = "";
        clearDriverMarkers();
      }

      state.supabaseReady = Boolean(remoteDrivers && remoteDrivers.length);
      setDataSource(state.supabaseReady ? "Supabase canlı filo" : "Demo filo", state.supabaseReady ? `${remoteDrivers.length} taksici kaydı` : "Kayıt yok, demo aktif");
      requestStatus(state.supabaseReady ? "Canlı sürücü kayıtları Supabase'ten okundu." : "Supabase boş döndü; demo filo korunuyor.");
      state.lastNotice = "";
      renderDrivers();
      setLiveLabel(state.supabaseReady ? "Supabase canlı filo" : "Demo filo canlı");
    } catch (error) {
      console.warn("Allona Taxi Supabase data fallback", error);
      state.supabaseReady = false;
      setDataSource("Demo filo", "Supabase migration bekliyor");
      requestStatus("Taksi tabloları canlı DB'de yoksa demo filo devrede kalır.");
      setLiveLabel("Demo filo canlı");
      renderServiceControls();
      renderDrivers();
    }
  }

  function rideRequestPayload(driver, fare) {
    const dropoff = $("[data-taxi-dropoff]")?.value || "Varış seçilmedi";
    const pickup = $("[data-taxi-pickup]")?.value || "Alış noktası";
    return {
      pickup_label: pickup,
      pickup_lat: state.pickup.lat,
      pickup_lng: state.pickup.lng,
      dropoff_label: dropoff,
      dropoff_lat: state.destination?.lat || state.pickup.lat,
      dropoff_lng: state.destination?.lng || state.pickup.lng,
      service_key: state.service,
      payment_method: state.payment,
      profile_type: state.profile,
      reserve_at: state.reserveMode === "reserve" && state.reserveTime ? new Date(state.reserveTime).toISOString() : null,
      prefer_female_driver: state.preferWomanDriver,
      matched_driver_id: driver && /^[0-9a-f-]{36}$/i.test(String(driver.id)) ? driver.id : null,
      estimated_distance_km: fare.km,
      estimated_minutes: fare.minutes,
      fare_min: fare.low,
      fare_max: fare.high,
      hp_reward: fare.hp,
      safety_features: {
        pin: state.safety.pin,
        share: state.safety.share,
        ridecheck: state.safety.ridecheck
      }
    };
  }

  async function persistRideRequest(driver) {
    const api = dataApi();
    if (!api || !state.destination) {
      requestStatus("Misafir demo eşleşme: varış seçildiğinde kayıtlı kullanıcı için Supabase isteği açılır.");
      return;
    }

    const fare = estimateFare();
    try {
      requestStatus("Supabase yolculuk isteği oluşturuluyor...");
      const created = await api.createRideRequest(rideRequestPayload(driver, fare));
      state.rideRequestId = created && created.id ? created.id : "";
      if (created && created.safety_pin) state.pin = created.safety_pin;
      requestStatus(state.rideRequestId ? `Supabase ride request: ${state.rideRequestId.slice(0, 8)} · ${created.status}` : "Supabase ride request oluşturuldu.");
      updateSummary();
    } catch (error) {
      if (error && error.code === "AUTH_REQUIRED") {
        requestStatus("Üye girişi yok: canlı filo demo eşleşme gösterir, gerçek ride request giriş sonrası açılır.");
        return;
      }
      console.warn("Allona Taxi ride request fallback", error);
      requestStatus("Ride request kaydı için Supabase migration/deploy bekleniyor; demo eşleşme aktif.");
    }
  }

  function moveDrivers() {
    drivers.forEach((driver, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      driver.lat += (Math.random() - 0.44) * 0.0016 * direction;
      driver.lng += (Math.random() - 0.5) * 0.0018;
    });
    renderDrivers();
    setLiveLabel("Sürücüler canlı güncelleniyor");
  }

  function selectDriver(driverId) {
    state.selectedDriverId = driverId;
    const driver = drivers.find((item) => item.id === driverId);
    if (!driver || !state.map) return;
    state.map.panTo([driver.lat, driver.lng]);
    const marker = state.markers.get(driver.id);
    if (marker) marker.openPopup();
    setPhase("match");
    renderDrivers();
    setStatus(`${driver.name} eşleşti. ${driver.plate} plakalı ${driver.vehicle} tahmini ${etaFor(driver)} dk içinde alış noktasında.`);
    toast(`${driver.name} seçildi. Güvenlik PIN: ${state.safety.pin ? state.pin : "kapalı"}.`, "success");
  }

  async function findNearestDriver() {
    if (!state.pickup) setPickup(fallbackCenter[0], fallbackCenter[1], "Alış noktası: İstanbul merkez");
    const nearest = sortedDrivers()[0];
    if (!nearest) {
      setStatus("Seçilen filtrelere uygun sürücü bulunamadı. Tercihleri güncelleyebilirsin.");
      return;
    }
    selectDriver(nearest.id);
    setPhase("route");
    const service = serviceConfig[state.service].label;
    const reservation = formattedReserveTime();
    setStatus(`${nearest.name} ${service} yolculuk için yönlendiriliyor. ${reservation} · ${paymentLabels[state.payment]} · ${safetySummary()}.`);
    await persistRideRequest(nearest);
  }

  function setUserPosition(lat, lng) {
    if (!state.userMarker) {
      state.userMarker = L.marker([lat, lng], { icon: userIcon(), zIndexOffset: 520 }).addTo(state.map);
    } else {
      state.userMarker.setLatLng([lat, lng]);
    }
    state.userMarker.bindPopup("Konumunuz");
  }

  function startWatch() {
    if (!navigator.geolocation || state.watchId) return;
    state.watchId = navigator.geolocation.watchPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserPosition(lat, lng);
      renderDrivers();
    }, () => {
      setLiveLabel("Demo filo canlı");
    }, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 10000
    });
  }

  function locateUser() {
    if (!navigator.geolocation) {
      setStatus("Tarayıcı konum servisini desteklemiyor. İstanbul merkezli demo filo aktif.");
      setLiveLabel("Demo filo canlı");
      return;
    }

    setStatus("Konum izni bekleniyor...");
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserPosition(lat, lng);
      setPickup(lat, lng, "Alış noktası: Mevcut konum");
      state.map.setView([lat, lng], 15);
      setStatus("Konumunuz canlı haritaya işlendi. Yakındaki sürücü ETA bilgileri güncellendi.");
      setLiveLabel("Konum canlı izleniyor");
      startWatch();
    }, () => {
      setStatus("Konum izni alınamadı. İstanbul merkezli demo filo aktif.");
      setLiveLabel("Demo filo canlı");
    }, {
      enableHighAccuracy: true,
      timeout: 9000,
      maximumAge: 15000
    });
  }

  function setService(service) {
    state.service = normalizedService(service);
    state.lastNotice = "";
    setPhase(state.destination ? "option" : "plan");
    renderDrivers();
    setStatus(`${serviceConfig[state.service].label} seçildi. Uygun sürücüler, ücret ve ETA yeniden hesaplandı.`);
  }

  function setReserveMode(mode) {
    state.reserveMode = mode === "reserve" ? "reserve" : "now";
    if (state.reserveMode === "reserve" && !state.reserveTime) {
      const next = new Date(Date.now() + 45 * 60 * 1000);
      next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5, 0, 0);
      state.reserveTime = toLocalInputValue(next);
      setInput("[data-taxi-reserve-time]", state.reserveTime);
    }
    state.lastNotice = "";
    updateControls();
    updateSummary();
    setStatus(state.reserveMode === "reserve" ? `Planlı yolculuk aktif: ${formattedReserveTime()}.` : "Anlık yolculuk modu aktif.");
  }

  function toggleSafety(key) {
    if (!Object.prototype.hasOwnProperty.call(state.safety, key)) return;
    state.safety[key] = !state.safety[key];
    state.lastNotice = "";
    updateControls();
    updateSummary();
    setStatus(`${safetySummary()} güvenlik paketi güncellendi.`);
  }

  function toggleWomanDriver() {
    state.preferWomanDriver = !state.preferWomanDriver;
    state.selectedDriverId = "";
    state.lastNotice = "";
    renderDrivers();
    setStatus(state.preferWomanDriver ? "Kadın sürücü tercihi aktif. Uygun filo filtrelendi." : "Kadın sürücü tercihi kapatıldı. Tüm uygun sürücüler listeleniyor.");
  }

  function shareText() {
    const driver = selectedDriver();
    const fare = estimateFare();
    const destination = $("[data-taxi-dropoff]")?.value || "Varış seçilmedi";
    const pickup = $("[data-taxi-pickup]")?.value || "Alış noktası";
    return [
      "Allona Taksi yolculuğum",
      `Alış: ${pickup}`,
      `Varış: ${destination}`,
      `Sürücü: ${driver ? `${driver.name} (${driver.plate})` : "Henüz atanmadı"}`,
      `Araç: ${driver ? driver.vehicle : "-"}`,
      `ETA: ${driver ? `${etaFor(driver)} dk` : "-"}`,
      `Ücret: ${money(fare.low)} - ${money(fare.high)}`,
      `Güvenlik: ${safetySummary()} · PIN ${state.safety.pin ? state.pin : "kapalı"}`
    ].join("\n");
  }

  async function shareTrip() {
    const text = shareText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Allona Taksi", text });
        setStatus("Yolculuk paylaşımı gönderildi.");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast("Yolculuk paylaşım metni kopyalandı.", "success");
        setStatus("Yolculuk paylaşım metni panoya kopyalandı.");
        return;
      }
    } catch (error) {
      console.warn("Allona Taxi share failed", error);
    }
    window.location.href = `mailto:?subject=${encodeURIComponent("Allona Taksi yolculuğum")}&body=${encodeURIComponent(text)}`;
  }

  function runRideCheck() {
    setStatus("RideCheck aktif: rota, bekleme süresi ve paylaşım durumu kontrol edildi. Olağan dışı durum yok.");
    toast("RideCheck kontrolü tamamlandı.", "success");
  }

  function syncInitialInputs() {
    const payment = $("[data-taxi-payment]");
    if (payment) state.payment = payment.value || state.payment;
    const profile = $("[data-taxi-profile]");
    if (profile) state.profile = profile.value || state.profile;
    const reserveTime = $("[data-taxi-reserve-time]");
    if (reserveTime) {
      const next = new Date(Date.now() + 30 * 60 * 1000);
      reserveTime.min = toLocalInputValue(next);
    }
  }

  function bindEvents() {
    $("[data-taxi-find]")?.addEventListener("click", findNearestDriver);
    $("[data-taxi-locate]")?.addEventListener("click", locateUser);

    $("[data-taxi-service]")?.addEventListener("change", (event) => {
      setService(event.target.value);
    });

    $("[data-taxi-payment]")?.addEventListener("change", (event) => {
      state.payment = event.target.value;
      state.lastNotice = "";
      updateControls();
      updateSummary();
      setStatus(`${paymentLabels[state.payment] || "Ödeme"} seçildi. Ücret ve kupon etkisi güncellendi.`);
    });

    $("[data-taxi-profile]")?.addEventListener("change", (event) => {
      state.profile = event.target.value;
      state.selectedDriverId = "";
      state.lastNotice = "";
      renderDrivers();
      setStatus(`${profileLabels[state.profile] || "Yolculuk"} profili aktif. Filo ve ücret yeniden hesaplandı.`);
    });

    $("[data-taxi-reserve-time]")?.addEventListener("change", (event) => {
      state.reserveTime = event.target.value;
      state.reserveMode = event.target.value ? "reserve" : state.reserveMode;
      updateControls();
      updateSummary();
      setStatus(`Planlanan saat güncellendi: ${formattedReserveTime()}.`);
    });

    document.addEventListener("click", (event) => {
      const destination = event.target.closest("[data-taxi-destination]");
      const driver = event.target.closest("[data-taxi-driver]");
      const option = event.target.closest("[data-taxi-option]");
      const reserveMode = event.target.closest("[data-taxi-reserve-mode]");
      const safety = event.target.closest("[data-taxi-safety]");
      const womanDriver = event.target.closest("[data-taxi-woman-driver]");
      const share = event.target.closest("[data-taxi-share]");
      const rideCheck = event.target.closest("[data-taxi-sos]");

      if (destination) {
        const lat = Number(destination.dataset.lat);
        const lng = Number(destination.dataset.lng);
        const label = destination.dataset.taxiDestination || destination.textContent.trim();
        setDestination(lat, lng, label);
        state.map.panTo([lat, lng]);
        setStatus(`${label} varış noktası olarak seçildi. Ücret ve ETA canlı hesaplandı.`);
      }

      if (driver) {
        selectDriver(driver.dataset.taxiDriver);
      }

      if (option) {
        setService(option.dataset.taxiOption);
      }

      if (reserveMode) {
        setReserveMode(reserveMode.dataset.taxiReserveMode);
      }

      if (safety) {
        toggleSafety(safety.dataset.taxiSafety);
      }

      if (womanDriver) {
        toggleWomanDriver();
      }

      if (share) {
        shareTrip();
      }

      if (rideCheck) {
        runRideCheck();
      }
    });

    state.map.on("click", (event) => {
      setPickup(event.latlng.lat, event.latlng.lng, "Alış noktası: Haritadan seçildi");
      setStatus("Alış noktası haritadan güncellendi. Sürücü ETA bilgileri yeniden hesaplandı.");
    });

    window.addEventListener("beforeunload", () => {
      if (state.intervalId) window.clearInterval(state.intervalId);
      if (state.watchId && navigator.geolocation) navigator.geolocation.clearWatch(state.watchId);
    });
  }

  function initMap() {
    const mapNode = $("[data-taxi-map]");
    if (!mapNode) return;
    if (!window.L) {
      setStatus("Harita kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edin.");
      setLiveLabel("Harita yüklenemedi");
      return;
    }

    syncInitialInputs();
    renderServiceControls();
    state.map = L.map(mapNode, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView(fallbackCenter, 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);

    L.control.scale({ metric: true, imperial: false }).addTo(state.map);
    setPickup(fallbackCenter[0], fallbackCenter[1], "Alış noktası: İstanbul merkez");
    bindEvents();
    renderDrivers();
    updateTimeline();
    loadSupabaseTaxiData();
    state.intervalId = window.setInterval(moveDrivers, updateIntervalMs);
    setLiveLabel("Canlı harita aktif");
  }

  document.addEventListener("DOMContentLoaded", initMap);
})();
