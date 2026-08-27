(function () {
  const App = window.Allona = window.Allona || {};

  function apiUrl(path) {
    const base = String(App.config?.apiBaseUrl || "").replace(/\/$/, "");
    return `${base}${path}`;
  }

  async function json(path) {
    const response = await fetch(apiUrl(path), { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`request ${response.status}`);
    return response.json();
  }

  function updateCountries(countries) {
    const byCode = Object.fromEntries((countries || []).map((item) => [item.countryCode, item]));
    document.querySelectorAll("[data-country-code]").forEach((card) => {
      const country = byCode[card.dataset.countryCode];
      if (!country) return;
      const badge = card.querySelector("header span");
      if (badge) badge.textContent = country.launchStage;
      card.classList.toggle("is-public", country.launchStage === "PUBLIC");
      card.classList.toggle("is-beta", country.launchStage === "BETA");
    });
  }

  function metricLabel(item) {
    const value = Number(item.value);
    if (!Number.isFinite(value)) return "—";
    if (item.currency) {
      return new Intl.NumberFormat("tr-TR", { style: "currency", currency: item.currency, maximumFractionDigits: 0 }).format(value);
    }
    return `${value.toLocaleString("tr-TR")}${item.unit && item.unit !== "count" ? ` ${item.unit}` : ""}`;
  }

  function updateImpact(metrics) {
    const globalMetrics = (metrics || []).filter((item) => !item.countryId && !item.corridorId);
    const byKey = Object.fromEntries(globalMetrics.map((item) => [item.metricKey, item]));
    document.querySelectorAll("[data-impact-key]").forEach((card) => {
      const metric = byKey[card.dataset.impactKey];
      if (!metric) return;
      const value = card.querySelector("strong");
      if (value) value.textContent = metricLabel(metric);
      card.title = `Kaynak: ${metric.dataSource}; doğrulama: ${metric.verifiedAt || "-"}`;
    });
  }

  async function loadCountries() {
    const source = document.querySelector("[data-country-source]");
    try {
      const payload = await json("/v1/platform/countries");
      updateCountries(payload.countries || []);
      if (source) source.textContent = "Country Engine yayın dizini";
    } catch (error) {
      if (source) source.textContent = "Yol haritası · canlı aktivasyon yayınlanmadı";
    }
  }

  async function loadImpact() {
    const source = document.querySelector("[data-impact-source]");
    try {
      const payload = await json("/v1/platform/impact");
      if (!payload.published || !payload.metrics?.length) {
        if (source) source.textContent = "Doğrulanmış public metrik yok";
        return;
      }
      updateImpact(payload.metrics);
      if (source) source.textContent = "Doğrulanmış aggregate veri";
    } catch (error) {
      if (source) source.textContent = "Doğrulanmış public metrik yok";
    }
  }

  function init() {
    Promise.allSettled([loadCountries(), loadImpact()]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
