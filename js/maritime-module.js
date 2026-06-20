(function () {
  const STORAGE_KEY = "allonahub.maritime.request.v1";

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function updateSummary(form) {
    const summary = qs("[data-maritime-summary]");
    if (!summary) return;

    const data = new FormData(form);
    const type = data.get("requestType") || "Operasyon";
    const route = [data.get("loadPort"), data.get("dischargePort")].filter(Boolean).join(" - ") || "Rota bekleniyor";
    const cargo = data.get("cargo") || "Yük / pozisyon bekleniyor";
    const timing = data.get("laycan") || "Tarih bekleniyor";

    summary.innerHTML = `
      <div class="maritime-summary-row"><span>Talep tipi</span><strong>${type}</strong></div>
      <div class="maritime-summary-row"><span>Rota / görev</span><strong>${route}</strong></div>
      <div class="maritime-summary-row"><span>Detay</span><strong>${cargo}</strong></div>
      <div class="maritime-summary-row"><span>Laycan / tarih</span><strong>${timing}</strong></div>
    `;
  }

  function bindRequestForm() {
    const form = qs("[data-maritime-request-form]");
    if (!form) return;

    const status = qs("[data-maritime-status]");
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && status) {
      status.textContent = "Kayıtlı denizcilik talep taslağı hazır.";
    }

    form.addEventListener("input", () => updateSummary(form));
    form.addEventListener("change", () => updateSummary(form));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
      if (status) {
        status.textContent = "Talep taslağı kaydedildi. Partner paneli veya destek ekibiyle paylaşmaya hazır.";
      }
    });

    updateSummary(form);
  }

  function bindFilters() {
    const buttons = qsa("[data-maritime-filter]");
    const listings = qsa("[data-maritime-segment]");
    if (!buttons.length || !listings.length) return;

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.maritimeFilter;
        buttons.forEach((item) => item.classList.toggle("is-active", item === button));
        listings.forEach((listing) => {
          const segments = (listing.dataset.maritimeSegment || "").split(" ");
          listing.hidden = value !== "all" && !segments.includes(value);
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindRequestForm();
    bindFilters();
  });
})();
