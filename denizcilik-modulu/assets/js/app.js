(function () {
  const appState = {
    data: {
      freightRates: [],
      companies: [],
      consultants: [],
      posts: [],
      quoteRequests: [],
      supportTickets: []
    }
  };

  const moneyUsd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });

  const moneyTry = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  });

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatUsd(value) {
    return value ? moneyUsd.format(value) : "Teyitli";
  }

  function initials(name) {
    return String(name)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function todayLabel() {
    return new Date().toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function statusClass(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("acil") || normalized.includes("yuksek")) return "danger";
    if (normalized.includes("yeni") || normalized.includes("toplaniyor")) return "info";
    if (normalized.includes("cozuldu") || normalized.includes("onayli") || normalized.includes("yayinda")) return "success";
    return "warning";
  }

  function chips(items) {
    return (items || []).map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  }

  function setConnectionStatus() {
    const status = $("#connection-status");
    if (!status) return;
    const active = window.MaritimeStore?.isSupabaseActive?.();
    status.textContent = active ? "Supabase bagli" : "Demo veri modu";
    status.classList.toggle("is-live", Boolean(active));
  }

  function setupChrome() {
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();

    const page = document.body.dataset.page;
    $all("[data-nav]").forEach((link) => {
      link.classList.toggle("active", link.dataset.nav === page);
    });

    const menuToggle = $(".menu-toggle");
    const nav = $(".site-nav");
    if (menuToggle && nav) {
      menuToggle.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
      });
    }

    $all("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        const value = button.getAttribute("data-copy") || "";
        await navigator.clipboard?.writeText(value);
        showToast("Bilgi panoya alindi.");
      });
    });
  }

  function renderKpis() {
    const target = $("[data-render='kpis']");
    if (!target) return;
    const rates = appState.data.freightRates;
    const avg = Math.round(rates.reduce((sum, rate) => sum + Number(rate.priceUsd || 0), 0) / Math.max(rates.length, 1));
    const openCapacity = rates.reduce((sum, rate) => {
      const parsed = parseInt(String(rate.capacity || "0"), 10);
      return sum + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);

    const kpis = [
      { label: "Aktif navlun", value: String(rates.length), hint: "onayli ve yeni teklif" },
      { label: "Ortalama FCL", value: moneyUsd.format(avg), hint: "demo sepet ortalamasi" },
      { label: "Acik kapasite", value: `${openCapacity}`, hint: "TEU / slot toplam" },
      { label: "Partner yaniti", value: "28 dk", hint: "ortalama donus" }
    ];

    target.innerHTML = kpis
      .map(
        (item) => `
          <article class="metric">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            <small>${escapeHtml(item.hint)}</small>
          </article>
        `
      )
      .join("");
  }

  function rateCard(rate) {
    return `
      <article class="rate-card">
        <div class="card-topline">
          <span class="pill ${statusClass(rate.status)}">${escapeHtml(rate.status)}</span>
          <span>${escapeHtml(rate.mode)} / ${escapeHtml(rate.containerType)}</span>
        </div>
        <h3>${escapeHtml(rate.route)}</h3>
        <div class="price">${formatUsd(rate.priceUsd)}</div>
        <dl class="mini-list">
          <div><dt>Firma</dt><dd>${escapeHtml(rate.carrier)}</dd></div>
          <div><dt>Transit</dt><dd>${escapeHtml(rate.transitDays)} gun</dd></div>
          <div><dt>Kapasite</dt><dd>${escapeHtml(rate.capacity)}</dd></div>
          <div><dt>Gecerlilik</dt><dd>${escapeHtml(rate.validity)}</dd></div>
        </dl>
        <p>${escapeHtml(rate.note)}</p>
        <div class="card-actions">
          <a class="button compact" href="teklif.html?route=${encodeURIComponent(rate.route)}">
            <i data-lucide="send"></i><span>Teklif Al</span>
          </a>
          <a class="button secondary compact" href="navlun.html#${escapeHtml(rate.id)}">
            <i data-lucide="search"></i><span>Incele</span>
          </a>
        </div>
      </article>
    `;
  }

  function renderRatesPreview() {
    const target = $("[data-render='rates-preview']");
    if (!target) return;
    target.innerHTML = appState.data.freightRates.slice(0, 8).map(rateCard).join("");
  }

  function renderRatesBoard() {
    const target = $("[data-render='rates-board']");
    if (!target) return;

    const search = ($("#rate-search")?.value || "").toLowerCase();
    const mode = $("#rate-mode")?.value || "all";
    const container = $("#rate-container")?.value || "all";
    const maxPrice = Number($("#rate-budget")?.value || 0);

    const filtered = appState.data.freightRates.filter((rate) => {
      const text = `${rate.route} ${rate.carrier} ${rate.origin} ${rate.destination}`.toLowerCase();
      const matchesText = !search || text.includes(search);
      const matchesMode = mode === "all" || rate.mode === mode;
      const matchesContainer = container === "all" || rate.containerType === container;
      const matchesPrice = !maxPrice || Number(rate.priceUsd || 0) <= maxPrice;
      return matchesText && matchesMode && matchesContainer && matchesPrice;
    });

    $("#rates-count") && ($("#rates-count").textContent = `${filtered.length} kayit`);

    target.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rota</th>
              <th>Firma</th>
              <th>Tip</th>
              <th>Transit</th>
              <th>Kapasite</th>
              <th>Fiyat</th>
              <th>Durum</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map(
                (rate) => `
                  <tr id="${escapeHtml(rate.id)}">
                    <td>
                      <strong>${escapeHtml(rate.route)}</strong>
                      <small>${escapeHtml(rate.note)}</small>
                    </td>
                    <td>${escapeHtml(rate.carrier)}</td>
                    <td>${escapeHtml(rate.mode)} / ${escapeHtml(rate.containerType)}</td>
                    <td>${escapeHtml(rate.transitDays)} gun</td>
                    <td>${escapeHtml(rate.capacity)}</td>
                    <td><strong>${formatUsd(rate.priceUsd)}</strong></td>
                    <td><span class="pill ${statusClass(rate.status)}">${escapeHtml(rate.status)}</span></td>
                    <td>
                      <a class="icon-link" href="teklif.html?route=${encodeURIComponent(rate.route)}" aria-label="Teklif al">
                        <i data-lucide="send"></i>
                      </a>
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function postCard(post) {
    return `
      <article class="post-card">
        <div class="card-topline">
          <span class="pill ${statusClass(post.status)}">${escapeHtml(post.type)}</span>
          <span>${escapeHtml(post.publishedAt)}</span>
        </div>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.content)}</p>
        <div class="post-meta">
          <span><i data-lucide="anchor"></i>${escapeHtml(post.route)}</span>
          <span><i data-lucide="building-2"></i>${escapeHtml(post.owner)}</span>
          <span><i data-lucide="badge-dollar-sign"></i>${formatUsd(post.priceUsd)}</span>
        </div>
        <div class="chips">${chips(post.tags)}</div>
        <div class="card-actions">
          <a class="button compact" href="teklif.html?route=${encodeURIComponent(post.route)}">
            <i data-lucide="message-square-plus"></i><span>Yanıtla</span>
          </a>
          <a class="button secondary compact" href="paylasimlar.html#${escapeHtml(post.id)}">
            <i data-lucide="external-link"></i><span>Detay</span>
          </a>
        </div>
      </article>
    `;
  }

  function renderPostsPreview() {
    const target = $("[data-render='posts-preview']");
    if (!target) return;
    target.innerHTML = appState.data.posts.slice(0, 6).map(postCard).join("");
  }

  function renderPostsBoard() {
    const target = $("[data-render='posts-board']");
    if (!target) return;
    target.innerHTML = appState.data.posts.map(postCard).join("");
  }

  function companyCard(company) {
    return `
      <article class="company-card" id="${escapeHtml(company.id)}">
        <div class="avatar" aria-hidden="true">${escapeHtml(initials(company.name))}</div>
        <div>
          <div class="card-topline">
            <span class="pill ${company.verified ? "success" : "warning"}">${company.verified ? "Dogrulanmis" : "On inceleme"}</span>
            <span>${escapeHtml(company.responseTime)} yanit</span>
          </div>
          <h3>${escapeHtml(company.name)}</h3>
          <p>${escapeHtml(company.type)} / ${escapeHtml(company.base)} merkezli operasyon.</p>
          <dl class="mini-list">
            <div><dt>Puan</dt><dd>${escapeHtml(company.rating)}</dd></div>
            <div><dt>Aktif teklif</dt><dd>${escapeHtml(company.activeOffers)}</dd></div>
          </dl>
          <div class="chips">${chips(company.services)}</div>
          <div class="card-actions">
            <a class="button compact" href="mailto:${escapeHtml(company.email)}">
              <i data-lucide="mail"></i><span>E-posta</span>
            </a>
            <a class="button secondary compact" href="tel:${escapeHtml(company.phone.replaceAll(" ", ""))}">
              <i data-lucide="phone"></i><span>Ara</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function renderCompanies() {
    const preview = $("[data-render='companies-preview']");
    const board = $("[data-render='companies-board']");
    if (preview) preview.innerHTML = appState.data.companies.slice(0, 6).map(companyCard).join("");
    if (board) board.innerHTML = appState.data.companies.map(companyCard).join("");
  }

  function consultantCard(consultant) {
    return `
      <article class="consultant-card" id="${escapeHtml(consultant.id)}">
        <div class="avatar consultant" aria-hidden="true">${escapeHtml(initials(consultant.name))}</div>
        <div class="card-topline">
          <span class="pill success">${escapeHtml(consultant.nextSlot)}</span>
          <span>${escapeHtml(consultant.rating)} puan</span>
        </div>
        <h3>${escapeHtml(consultant.name)}</h3>
        <p>${escapeHtml(consultant.title)}</p>
        <dl class="mini-list">
          <div><dt>Sehir</dt><dd>${escapeHtml(consultant.city)}</dd></div>
          <div><dt>Deneyim</dt><dd>${escapeHtml(consultant.experience)}</dd></div>
          <div><dt>Seans</dt><dd>${moneyTry.format(consultant.priceTry)}</dd></div>
        </dl>
        <div class="chips">${chips(consultant.specialties)}</div>
        <div class="card-actions">
          <a class="button compact" href="mailto:${escapeHtml(consultant.email)}">
            <i data-lucide="calendar-plus"></i><span>Randevu</span>
          </a>
          <a class="button secondary compact" href="tel:${escapeHtml(consultant.phone.replaceAll(" ", ""))}">
            <i data-lucide="phone-call"></i><span>Ara</span>
          </a>
        </div>
      </article>
    `;
  }

  function renderConsultants() {
    const preview = $("[data-render='consultants-preview']");
    const board = $("[data-render='consultants-board']");
    if (preview) preview.innerHTML = appState.data.consultants.slice(0, 4).map(consultantCard).join("");
    if (board) board.innerHTML = appState.data.consultants.map(consultantCard).join("");
  }

  function renderQuoteRequests() {
    const target = $("[data-render='quote-requests']");
    if (!target) return;
    target.innerHTML = appState.data.quoteRequests
      .map(
        (quote) => `
          <article class="request-card">
            <div class="card-topline">
              <span class="pill ${statusClass(quote.status)}">${escapeHtml(quote.status)}</span>
              <span>${escapeHtml(quote.createdAt)}</span>
            </div>
            <h3>${escapeHtml(quote.companyName)}</h3>
            <p>${escapeHtml(quote.cargoType)} / ${escapeHtml(quote.containerType)}</p>
            <dl class="mini-list">
              <div><dt>Rota</dt><dd>${escapeHtml(quote.origin)} - ${escapeHtml(quote.destination)}</dd></div>
              <div><dt>Tarih</dt><dd>${escapeHtml(quote.targetDate)}</dd></div>
              <div><dt>Butce</dt><dd>${formatUsd(quote.budgetUsd)}</dd></div>
            </dl>
            <div class="card-actions">
              <a class="button compact" href="mailto:${escapeHtml(quote.email)}">
                <i data-lucide="mail-check"></i><span>Teklif Gonder</span>
              </a>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderSupportTickets() {
    const target = $("[data-render='support-tickets']");
    if (!target) return;
    target.innerHTML = appState.data.supportTickets
      .map(
        (ticket) => `
          <article class="ticket-row">
            <div>
              <span class="pill ${statusClass(ticket.status)}">${escapeHtml(ticket.status)}</span>
              <h3>${escapeHtml(ticket.subject)}</h3>
              <p>${escapeHtml(ticket.owner)} / ${escapeHtml(ticket.updatedAt)}</p>
            </div>
            <strong>${escapeHtml(ticket.priority)}</strong>
          </article>
        `
      )
      .join("");
  }

  function renderRouteOptions() {
    const routeFields = $all("[data-route-options]");
    if (!routeFields.length) return;
    const routes = appState.data.freightRates.map((rate) => rate.route);
    routeFields.forEach((field) => {
      field.innerHTML = `<option value="">Rota secin</option>${routes
        .map((route) => `<option value="${escapeHtml(route)}">${escapeHtml(route)}</option>`)
        .join("")}`;
    });

    const params = new URLSearchParams(window.location.search);
    const route = params.get("route");
    if (route) {
      routeFields.forEach((field) => {
        field.value = route;
      });
    }
  }

  function setupFilters() {
    $all("[data-rate-filter]").forEach((input) => {
      input.addEventListener("input", renderRatesBoard);
      input.addEventListener("change", renderRatesBoard);
    });
  }

  function formValue(form, name) {
    return new FormData(form).get(name)?.toString().trim() || "";
  }

  function showToast(message) {
    let toast = $(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function setupForms() {
    const quoteForm = $("[data-form='quote']");
    if (quoteForm) {
      quoteForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const route = formValue(quoteForm, "route");
        const [origin = formValue(quoteForm, "origin"), destination = formValue(quoteForm, "destination")] = route.includes(" - ")
          ? route.split(" - ")
          : [formValue(quoteForm, "origin"), formValue(quoteForm, "destination")];

        const payload = {
          companyName: formValue(quoteForm, "companyName"),
          contactName: formValue(quoteForm, "contactName"),
          email: formValue(quoteForm, "email"),
          phone: formValue(quoteForm, "phone"),
          origin,
          destination,
          cargoType: formValue(quoteForm, "cargoType"),
          containerType: formValue(quoteForm, "containerType"),
          targetDate: formValue(quoteForm, "targetDate"),
          budgetUsd: Number(formValue(quoteForm, "budgetUsd")),
          status: "Yeni Talep",
          createdAt: new Date().toLocaleString("tr-TR")
        };

        await window.MaritimeStore.insertQuoteRequest(payload);
        appState.data.quoteRequests = [payload, ...appState.data.quoteRequests];
        renderQuoteRequests();
        quoteForm.reset();
        showToast("Teklif talebi kaydedildi.");
      });
    }

    const postForm = $("[data-form='post']");
    if (postForm) {
      postForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = {
          type: formValue(postForm, "type"),
          title: formValue(postForm, "title"),
          owner: formValue(postForm, "owner"),
          route: formValue(postForm, "route"),
          publishedAt: new Date().toLocaleString("tr-TR"),
          priceUsd: Number(formValue(postForm, "priceUsd")),
          status: "Yayinda",
          content: formValue(postForm, "content"),
          tags: formValue(postForm, "tags").split(",").map((tag) => tag.trim()).filter(Boolean)
        };

        await window.MaritimeStore.insertPost(payload);
        appState.data.posts = [payload, ...appState.data.posts];
        renderPostsBoard();
        renderPostsPreview();
        postForm.reset();
        showToast("Paylasim yayina alindi.");
      });
    }

    const rateForm = $("[data-form='rate']");
    if (rateForm) {
      rateForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const origin = formValue(rateForm, "origin");
        const destination = formValue(rateForm, "destination");
        const payload = {
          route: `${origin} - ${destination}`,
          origin,
          destination,
          transitDays: Number(formValue(rateForm, "transitDays")),
          carrier: formValue(rateForm, "carrier"),
          mode: formValue(rateForm, "mode"),
          containerType: formValue(rateForm, "containerType"),
          priceUsd: Number(formValue(rateForm, "priceUsd")),
          validity: formValue(rateForm, "validity"),
          status: "Yeni",
          capacity: formValue(rateForm, "capacity"),
          updatedAt: todayLabel(),
          note: formValue(rateForm, "note")
        };

        await window.MaritimeStore.insertRate(payload);
        appState.data.freightRates = [payload, ...appState.data.freightRates];
        renderRatesBoard();
        renderRatesPreview();
        renderKpis();
        rateForm.reset();
        showToast("Navlun bilgisi kaydedildi.");
      });
    }

    const supportForm = $("[data-form='support']");
    if (supportForm) {
      supportForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = {
          subject: formValue(supportForm, "subject"),
          owner: formValue(supportForm, "owner"),
          priority: formValue(supportForm, "priority"),
          status: "Yeni",
          updatedAt: new Date().toLocaleString("tr-TR")
        };

        await window.MaritimeStore.insertSupportTicket(payload);
        appState.data.supportTickets = [payload, ...appState.data.supportTickets];
        renderSupportTickets();
        supportForm.reset();
        showToast("Destek kaydi acildi.");
      });
    }
  }

  function renderAll() {
    renderKpis();
    renderRatesPreview();
    renderRatesBoard();
    renderPostsPreview();
    renderPostsBoard();
    renderCompanies();
    renderConsultants();
    renderQuoteRequests();
    renderSupportTickets();
    renderRouteOptions();
    if (window.lucide) window.lucide.createIcons();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    setupChrome();
    setConnectionStatus();
    setupFilters();

    if (window.MaritimeStore) {
      appState.data = await window.MaritimeStore.loadAll();
    } else {
      appState.data = window.MARITIME_DEMO_DATA || appState.data;
    }

    renderAll();
    setupForms();
  });
})();
