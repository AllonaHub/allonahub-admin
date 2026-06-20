(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core || {};
  const fallbackCenter = [41.0082, 28.9784];
  const updateIntervalMs = 2800;

  const drivers = [
    { id: "AT-104", name: "Ahmet K.", type: "Ekonomik", lat: 41.0146, lng: 28.9767, rating: 4.9, hp: 20 },
    { id: "AT-218", name: "Mehmet A.", type: "Konfor", lat: 41.0048, lng: 28.9896, rating: 4.8, hp: 25 },
    { id: "AT-331", name: "Selin T.", type: "Kadın Sürücü", lat: 41.0182, lng: 28.9660, rating: 5.0, hp: 30 },
    { id: "AT-442", name: "VIP Transfer", type: "VIP", lat: 41.0328, lng: 28.9839, rating: 5.0, hp: 50 },
    { id: "AT-509", name: "Allona 509", type: "Aile", lat: 40.9987, lng: 28.9728, rating: 4.8, hp: 24 }
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
    watchId: null
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function escapeHTML(value) {
    return core.escapeHTML ? core.escapeHTML(value) : String(value ?? "");
  }

  function setText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
  }

  function setInput(selector, value) {
    const node = $(selector);
    if (node) node.value = value;
  }

  function toast(message, type) {
    if (core.toast) core.toast(message, type);
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
    return icon(`taxi-driver-marker${driver.id === state.selectedDriverId ? " is-selected" : ""}`, "T");
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
    return Math.max(2, Math.round(km * 4 + 2));
  }

  function sortedDrivers() {
    return [...drivers].sort((a, b) => etaFor(a) - etaFor(b));
  }

  function setLiveLabel(message) {
    setText("[data-taxi-live-label]", message);
  }

  function setStatus(message) {
    setText("[data-taxi-map-status]", message);
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
  }

  function updateRoute() {
    if (!state.map || !state.pickup || !state.destination) return;
    const points = [
      [state.pickup.lat, state.pickup.lng],
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
    sortedDrivers().forEach((driver) => {
      const popup = `<strong>${escapeHTML(driver.name)}</strong><br>${escapeHTML(driver.type)} - ${etaFor(driver)} dk`;
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

    renderDriverList();
    updateSummary();
  }

  function renderDriverList() {
    const list = $("[data-taxi-driver-list]");
    if (!list) return;

    list.innerHTML = sortedDrivers().slice(0, 4).map((driver) => `
      <button class="driver glass${driver.id === state.selectedDriverId ? " is-selected" : ""}" type="button" data-taxi-driver="${escapeHTML(driver.id)}">
        <div class="driver-img"></div>
        <b>${escapeHTML(driver.name)}</b>
        <p>${escapeHTML(driver.type)} - ${etaFor(driver)} dk uzaklıkta</p>
        <div class="meta"><span>${driver.rating.toFixed(1)} Puan</span><span>+${driver.hp} HP</span></div>
      </button>
    `).join("");
  }

  function updateSummary() {
    const nearest = sortedDrivers()[0];
    const eta = nearest ? etaFor(nearest) : "-";
    setText("[data-taxi-map-title]", `Yakında ${drivers.length} sürücü`);
    setStatus(`En yakın sürücü: ${nearest ? nearest.name : "-"} - tahmini varış ${eta} dk.`);
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
    if (!driver) return;
    state.map.panTo([driver.lat, driver.lng]);
    const marker = state.markers.get(driver.id);
    if (marker) marker.openPopup();
    renderDrivers();
    toast(`${driver.name} seçildi. Tahmini geliş ${etaFor(driver)} dk.`);
  }

  function findNearestDriver() {
    if (!state.pickup) setPickup(fallbackCenter[0], fallbackCenter[1], "Alış noktası: İstanbul merkez");
    const nearest = sortedDrivers()[0];
    if (!nearest) return;
    selectDriver(nearest.id);
    const service = $("[data-taxi-service]")?.selectedOptions?.[0]?.textContent || "Ekonomik";
    setStatus(`${nearest.name} ${service} yolculuk için yönlendiriliyor. Tahmini geliş ${etaFor(nearest)} dk.`);
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

  function bindEvents() {
    $("[data-taxi-find]")?.addEventListener("click", findNearestDriver);
    $("[data-taxi-locate]")?.addEventListener("click", locateUser);

    document.addEventListener("click", (event) => {
      const destination = event.target.closest("[data-taxi-destination]");
      const driver = event.target.closest("[data-taxi-driver]");

      if (destination) {
        const lat = Number(destination.dataset.lat);
        const lng = Number(destination.dataset.lng);
        const label = destination.dataset.taxiDestination || destination.textContent.trim();
        setDestination(lat, lng, label);
        state.map.panTo([lat, lng]);
        setStatus(`${label} varış noktası olarak seçildi.`);
      }

      if (driver) {
        selectDriver(driver.dataset.taxiDriver);
      }
    });

    state.map.on("click", (event) => {
      setPickup(event.latlng.lat, event.latlng.lng, "Alış noktası: Haritadan seçildi");
      setStatus("Alış noktası haritadan güncellendi.");
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
    renderDrivers();
    bindEvents();
    state.intervalId = window.setInterval(moveDrivers, updateIntervalMs);
    setLiveLabel("Canlı harita aktif");
  }

  document.addEventListener("DOMContentLoaded", initMap);
})();
