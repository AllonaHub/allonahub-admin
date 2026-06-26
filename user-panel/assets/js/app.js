(function () {
  "use strict";

  const storageKey = "allonahub:user-panel:v1";

  const seedState = {
    profile: {
      name: "Allona Business",
      email: "allona@example.com",
      phone: "+90 555 010 20 30",
      city: "Istanbul",
      address: "Maslak Mah. Buyukdere Cad. No: 42, Sariyer / Istanbul",
    },
    preferences: [
      {
        id: "push",
        title: "Push bildirimleri",
        description: "Kupon, yolculuk ve destek durumlarini aninda bildirir.",
        enabled: true,
      },
      {
        id: "email",
        title: "E-posta bildirimleri",
        description: "Fis, fatura, guvenlik ve hesap islemleri icin kullanilir.",
        enabled: true,
      },
      {
        id: "sms",
        title: "SMS bildirimleri",
        description: "Kritik giris ve yolculuk uyarilarinda yedek kanal olur.",
        enabled: false,
      },
      {
        id: "campaign",
        title: "Kampanya ve favori duyurulari",
        description: "Favori AVM ve magazalardan secili firsatlari gosterir.",
        enabled: true,
      },
    ],
    coupons: [
      {
        id: "CPN-AVM-25",
        title: "AVM Dunyasi %25 indirim",
        detail: "Favori magazalarda gecerli secili kampanya kuponu.",
        expiresAt: "2026-07-15",
        status: "active",
      },
      {
        id: "TAXI-120",
        title: "Taksi yolculugunda 120 TL",
        detail: "Istanbul icindeki ilk taksi yolculugunda kullanilabilir.",
        expiresAt: "2026-07-03",
        status: "active",
      },
      {
        id: "EVENT-OLD",
        title: "Etkinlik erken kayit",
        detail: "Kullanildi ve arsivlendi.",
        expiresAt: "2026-06-10",
        status: "used",
      },
    ],
    favorites: [
      { id: "fav-1", type: "AVM", name: "ALLONA Mall Istanbul", meta: "42 magaza, 8 aktif kampanya" },
      { id: "fav-2", type: "Magaza", name: "Nora Teknoloji", meta: "Elektronik ve aksesuar" },
      { id: "fav-3", type: "Hizmet", name: "VIP Taksi", meta: "Hizli erisimde" },
    ],
    rides: [
      {
        id: "R-24061",
        date: "27 Haz 2026",
        route: "Maslak - IstinyePark",
        fare: "₺284,50",
        status: "Tamamlandi",
        receipt: true,
      },
      {
        id: "R-24048",
        date: "25 Haz 2026",
        route: "Kadikoy - Moda",
        fare: "₺138,00",
        status: "Odeme kontrol",
        receipt: false,
      },
      {
        id: "R-24031",
        date: "21 Haz 2026",
        route: "Levent - Besiktas",
        fare: "₺196,75",
        status: "Tamamlandi",
        receipt: true,
      },
    ],
    tickets: [
      {
        id: "T-1008",
        subject: "Kupon kullanim limiti kontrolu",
        category: "Kupon",
        message: "Magazada kupon durumu teyit edildi.",
        status: "Cozumde",
        createdAt: "26 Haz 2026",
      },
    ],
    sessions: [
      { id: "s-current", device: "MacBook - Safari", location: "Istanbul", lastSeen: "Simdi", current: true },
      { id: "s-phone", device: "iPhone - Mobil Safari", location: "Istanbul", lastSeen: "Bugun 09:22", current: false },
      { id: "s-office", device: "Windows - Chrome", location: "Ankara", lastSeen: "24 Haz 2026", current: false },
    ],
    security: {
      mfaEnabled: false,
    },
    activity: [
      { title: "Profil bilgileri dogrulandi", time: "Bugun 10:12" },
      { title: "Taksi yolculugu tamamlandi", time: "27 Haz 2026" },
      { title: "AVM kampanya bildirimi acik", time: "26 Haz 2026" },
      { title: "Kupon destek talebi guncellendi", time: "26 Haz 2026" },
    ],
  };

  let state = loadState();
  let toastTimer = null;

  const selectors = {
    navItems: document.querySelectorAll(".nav-item"),
    sectionLinks: document.querySelectorAll("[data-section-link]"),
    sections: document.querySelectorAll(".panel-section"),
    toast: document.getElementById("toast"),
    profileForm: document.getElementById("profileForm"),
    ticketForm: document.getElementById("ticketForm"),
    preferenceList: document.getElementById("preferenceList"),
    couponList: document.getElementById("couponList"),
    favoriteList: document.getElementById("favoriteList"),
    rideTable: document.getElementById("rideTable"),
    ticketList: document.getElementById("ticketList"),
    sessionList: document.getElementById("sessionList"),
    activityList: document.getElementById("activityList"),
    mfaToggle: document.getElementById("mfaToggle"),
  };

  function loadState() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? mergeState(seedState, JSON.parse(saved)) : structuredClone(seedState);
    } catch (error) {
      console.warn("State yuklenemedi", error);
      return structuredClone(seedState);
    }
  }

  function mergeState(defaults, saved) {
    return {
      ...structuredClone(defaults),
      ...saved,
      profile: { ...defaults.profile, ...(saved.profile || {}) },
      security: { ...defaults.security, ...(saved.security || {}) },
    };
  }

  function saveState() {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function initials(name) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function showToast(message) {
    selectors.toast.textContent = message;
    selectors.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => selectors.toast.classList.remove("is-visible"), 2800);
  }

  function addActivity(title) {
    state.activity.unshift({
      title,
      time: new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
    });
    state.activity = state.activity.slice(0, 8);
  }

  function setSection(sectionId) {
    selectors.sections.forEach((section) => {
      section.classList.toggle("is-visible", section.id === sectionId);
    });

    selectors.navItems.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.section === sectionId);
    });

    document.body.classList.remove("nav-open");
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ block: "start" });
    }
  }

  function renderProfile() {
    const { profile } = state;
    selectors.profileForm.elements.name.value = profile.name;
    selectors.profileForm.elements.email.value = profile.email;
    selectors.profileForm.elements.phone.value = profile.phone;
    selectors.profileForm.elements.city.value = profile.city;
    selectors.profileForm.elements.address.value = profile.address;

    const initialText = initials(profile.name);
    document.getElementById("avatarInitials").textContent = initialText;
    document.getElementById("profileAvatar").textContent = initialText;
    document.getElementById("profileNamePreview").textContent = profile.name;
    document.getElementById("profileMailPreview").textContent = profile.email;
  }

  function renderDashboard() {
    document.getElementById("activeCouponCount").textContent = state.coupons.filter(
      (coupon) => coupon.status === "active",
    ).length;
    document.getElementById("favoriteCount").textContent = state.favorites.length;
    document.getElementById("rideCount").textContent = state.rides.length;
    document.getElementById("openTicketCount").textContent = state.tickets.filter(
      (ticket) => ticket.status !== "Kapandi",
    ).length;

    selectors.activityList.innerHTML = state.activity
      .map(
        (item) => `
          <li>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.time)}</small>
          </li>
        `,
      )
      .join("");
  }

  function renderPreferences() {
    selectors.preferenceList.innerHTML = state.preferences
      .map(
        (preference) => `
          <div class="preference-row">
            <div>
              <strong>${escapeHtml(preference.title)}</strong>
              <span>${escapeHtml(preference.description)}</span>
            </div>
            <label class="switch" aria-label="${escapeHtml(preference.title)}">
              <input type="checkbox" data-preference="${escapeHtml(preference.id)}" ${
                preference.enabled ? "checked" : ""
              }>
              <span></span>
            </label>
          </div>
        `,
      )
      .join("");
  }

  function renderCoupons() {
    selectors.couponList.innerHTML = state.coupons
      .map((coupon) => {
        const isActive = coupon.status === "active";
        return `
          <article class="item-card">
            <header>
              <strong>${escapeHtml(coupon.title)}</strong>
              <span class="status ${isActive ? "success" : "neutral"}">${
                isActive ? "Aktif" : "Kullanildi"
              }</span>
            </header>
            <p class="item-meta">${escapeHtml(coupon.detail)}</p>
            <footer>
              <span class="item-meta">Son tarih: ${escapeHtml(formatDate(coupon.expiresAt))}</span>
              <button class="${isActive ? "primary-button" : "secondary-button"}" type="button" data-coupon="${
          coupon.id
        }" ${isActive ? "" : "disabled"}>${isActive ? "Kullan" : "Arsivde"}</button>
            </footer>
          </article>
        `;
      })
      .join("");
  }

  function renderFavorites() {
    selectors.favoriteList.innerHTML = state.favorites
      .map(
        (favorite) => `
          <article class="item-card">
            <header>
              <strong>${escapeHtml(favorite.name)}</strong>
              <span class="status neutral">${escapeHtml(favorite.type)}</span>
            </header>
            <footer>
              <span class="item-meta">${escapeHtml(favorite.meta)}</span>
              <button class="danger-button" type="button" data-remove-favorite="${escapeHtml(favorite.id)}">
                Kaldir
              </button>
            </footer>
          </article>
        `,
      )
      .join("");
  }

  function renderRides() {
    selectors.rideTable.innerHTML = state.rides
      .map(
        (ride) => `
          <tr>
            <td><strong>${escapeHtml(ride.id)}</strong></td>
            <td>${escapeHtml(ride.date)}</td>
            <td>${escapeHtml(ride.route)}</td>
            <td>${escapeHtml(ride.fare)}</td>
            <td>
              <span class="status ${ride.status === "Tamamlandi" ? "success" : "warning"}">
                ${escapeHtml(ride.status)}
              </span>
            </td>
            <td>
              <button class="secondary-button" type="button" data-receipt="${escapeHtml(ride.id)}">
                ${ride.receipt ? "Fis indir" : "Destek ac"}
              </button>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  function renderTickets() {
    selectors.ticketList.innerHTML = state.tickets
      .map(
        (ticket) => `
          <article class="item-card">
            <header>
              <strong>${escapeHtml(ticket.subject)}</strong>
              <span class="status ${ticket.status === "Kapandi" ? "neutral" : "warning"}">
                ${escapeHtml(ticket.status)}
              </span>
            </header>
            <p class="item-meta">${escapeHtml(ticket.category)} - ${escapeHtml(ticket.message)}</p>
            <footer>
              <span class="item-meta">${escapeHtml(ticket.id)} - ${escapeHtml(ticket.createdAt)}</span>
              <button class="secondary-button" type="button" data-close-ticket="${escapeHtml(ticket.id)}">
                Kapat
              </button>
            </footer>
          </article>
        `,
      )
      .join("");
  }

  function renderSecurity() {
    selectors.mfaToggle.checked = state.security.mfaEnabled;
    const score = state.security.mfaEnabled ? 92 : 68;
    document.getElementById("securityScore").textContent = `${score}%`;
    document.getElementById("securityScoreText").textContent = state.security.mfaEnabled
      ? "MFA aktif, oturumlar kontrol altinda."
      : "MFA acilarak hesap korumasi guclendirilmeli.";

    selectors.sessionList.innerHTML = state.sessions
      .map(
        (session) => `
          <article class="item-card">
            <header>
              <strong>${escapeHtml(session.device)}</strong>
              <span class="status ${session.current ? "success" : "neutral"}">${
          session.current ? "Mevcut" : "Aktif"
        }</span>
            </header>
            <footer>
              <span class="item-meta">${escapeHtml(session.location)} - ${escapeHtml(session.lastSeen)}</span>
              <button class="danger-button" type="button" data-end-session="${escapeHtml(session.id)}" ${
          session.current ? "disabled" : ""
        }>
                Oturumu kapat
              </button>
            </footer>
          </article>
        `,
      )
      .join("");
  }

  function renderAll() {
    renderProfile();
    renderDashboard();
    renderPreferences();
    renderCoupons();
    renderFavorites();
    renderRides();
    renderTickets();
    renderSecurity();
  }

  function formatDate(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    selectors.navItems.forEach((item) => {
      item.addEventListener("click", () => setSection(item.dataset.section));
    });

    selectors.sectionLinks.forEach((item) => {
      item.addEventListener("click", () => setSection(item.dataset.sectionLink));
    });

    document.querySelector(".menu-toggle").addEventListener("click", () => {
      document.body.classList.toggle("nav-open");
    });

    selectors.profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(selectors.profileForm);
      state.profile = {
        name: form.get("name").trim(),
        email: form.get("email").trim(),
        phone: form.get("phone").trim(),
        city: form.get("city"),
        address: form.get("address").trim(),
      };
      addActivity("Profil bilgileri guncellendi");
      saveState();
      renderAll();
      showToast("Profil kaydedildi.");
    });

    selectors.ticketForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(selectors.ticketForm);
      const ticket = {
        id: `T-${Math.floor(1000 + Math.random() * 9000)}`,
        subject: form.get("subject").trim(),
        category: form.get("category"),
        message: form.get("message").trim(),
        status: "Yeni",
        createdAt: new Intl.DateTimeFormat("tr-TR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date()),
      };
      state.tickets.unshift(ticket);
      selectors.ticketForm.reset();
      addActivity(`Destek talebi olusturuldu: ${ticket.id}`);
      saveState();
      renderAll();
      showToast("Destek talebi olusturuldu.");
    });

    selectors.preferenceList.addEventListener("change", (event) => {
      const id = event.target.dataset.preference;
      if (!id) return;
      const preference = state.preferences.find((item) => item.id === id);
      preference.enabled = event.target.checked;
      addActivity(`${preference.title} tercihi guncellendi`);
      saveState();
      renderAll();
      showToast("Bildirim tercihi kaydedildi.");
    });

    selectors.couponList.addEventListener("click", (event) => {
      const id = event.target.dataset.coupon;
      if (!id) return;
      const coupon = state.coupons.find((item) => item.id === id);
      coupon.status = "used";
      addActivity(`${coupon.title} kuponu kullanildi`);
      saveState();
      renderAll();
      showToast("Kupon kullanildi ve arsive alindi.");
    });

    selectors.favoriteList.addEventListener("click", (event) => {
      const id = event.target.dataset.removeFavorite;
      if (!id) return;
      state.favorites = state.favorites.filter((item) => item.id !== id);
      addActivity("Favori listesi guncellendi");
      saveState();
      renderAll();
      showToast("Favori kaldirildi.");
    });

    selectors.rideTable.addEventListener("click", (event) => {
      const id = event.target.dataset.receipt;
      if (!id) return;
      const ride = state.rides.find((item) => item.id === id);
      if (ride.receipt) {
        downloadJson(`${ride.id}-fis.json`, ride);
        showToast("Fis dosyasi indirildi.");
      } else {
        setSection("support");
        selectors.ticketForm.elements.subject.value = `${ride.id} odeme kontrolu`;
        selectors.ticketForm.elements.category.value = "Taksi";
        selectors.ticketForm.elements.message.value = `${ride.id} yolculugundaki odeme durumu icin destek istiyorum.`;
        showToast("Destek formu yolculuk bilgisiyle hazirlandi.");
      }
    });

    selectors.ticketList.addEventListener("click", (event) => {
      const id = event.target.dataset.closeTicket;
      if (!id) return;
      const ticket = state.tickets.find((item) => item.id === id);
      ticket.status = "Kapandi";
      addActivity(`${ticket.id} destek talebi kapatildi`);
      saveState();
      renderAll();
      showToast("Destek talebi kapatildi.");
    });

    selectors.sessionList.addEventListener("click", (event) => {
      const id = event.target.dataset.endSession;
      if (!id) return;
      state.sessions = state.sessions.filter((session) => session.id !== id);
      addActivity("Bir uzak oturum sonlandirildi");
      saveState();
      renderAll();
      showToast("Oturum sonlandirildi.");
    });

    selectors.mfaToggle.addEventListener("change", (event) => {
      state.security.mfaEnabled = event.target.checked;
      addActivity(state.security.mfaEnabled ? "MFA aktif edildi" : "MFA kapatildi");
      saveState();
      renderAll();
      showToast(state.security.mfaEnabled ? "MFA aktif edildi." : "MFA kapatildi.");
    });

    document.addEventListener("click", (event) => {
      const action = event.target.dataset.action;
      if (action === "export-profile") {
        downloadJson("allonahub-user-profile.json", {
          profile: state.profile,
          preferences: state.preferences,
          favorites: state.favorites,
          coupons: state.coupons,
          rides: state.rides,
          tickets: state.tickets,
        });
        showToast("Kullanici verisi indirildi.");
      }

      if (action === "reset-demo") {
        state = structuredClone(seedState);
        saveState();
        renderAll();
        showToast("Demo veri sifirlandi.");
      }

      if (action === "add-favorite") {
        const names = ["Zorlu Center", "Emaar Square Mall", "MetroCity", "Aqua Florya"];
        const name = names[state.favorites.length % names.length];
        state.favorites.unshift({
          id: `fav-${Date.now()}`,
          type: "AVM",
          name,
          meta: "Yeni favori, kampanya bildirimlerine uygun",
        });
        addActivity(`${name} favorilere eklendi`);
        saveState();
        renderAll();
        showToast("Favori eklendi.");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        document.body.classList.remove("nav-open");
      }
    });
  }

  bindEvents();
  renderAll();
})();
