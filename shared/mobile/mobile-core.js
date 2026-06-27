/*
  ALLONAHUB Central Mobile Core
  Loads once per page and enhances all module layouts from one place.
*/

(function () {
  const railSelectors = [
    ".metric-grid",
    ".metrics-grid",
    ".stat-grid",
    ".kpi-grid",
    ".quick-actions",
    ".service-list",
    ".campaign-strip",
    ".coupon-strip",
    ".store-strip",
    ".product-rail",
    ".approval-list",
    ".horizontal-strip",
    ".checklist",
    ".preference-list",
    ".item-list",
    ".activity-list",
    ".mall-list",
    ".cart-items",
    ".grid-list",
    ".review-list",
    ".definition-list",
    ".shop-product-grid",
    ".shop-status-strip",
    ".shop-audit-strip",
    ".admin-tabs",
    ".admin-controls",
    ".utility-band",
    ".filters",
    "[data-mobile-rail]"
  ];

  function enhanceRails(root) {
    root.querySelectorAll(railSelectors.join(",")).forEach((rail) => {
      if (rail.classList.contains("mobile-core-no-rail")) return;
      rail.classList.add("mobile-core-rail");
      if (!rail.hasAttribute("tabindex")) rail.setAttribute("tabindex", "0");
      if (!rail.hasAttribute("aria-label")) {
        rail.setAttribute("aria-label", "Yatay kaydirilabilir modul alani");
      }
    });
  }

  function enhanceTables(root) {
    root.querySelectorAll("table").forEach((table) => {
      if (table.closest(".table-wrap, .mobile-core-table-wrap")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "mobile-core-table-wrap";
      wrapper.setAttribute("tabindex", "0");
      wrapper.setAttribute("aria-label", "Yatay kaydirilabilir tablo");
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function markDocument() {
    document.documentElement.dataset.mobileCore = "ready";
  }

  function enhance(root = document) {
    markDocument();
    enhanceTables(root);
    enhanceRails(root);
  }

  let observer;

  function observeDynamicContent() {
    if (observer || !document.body) return;
    let scheduled = false;
    observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        enhance(document);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      enhance();
      observeDynamicContent();
    });
  } else {
    enhance();
    observeDynamicContent();
  }

  window.ALLONAHUBMobileCore = {
    enhance
  };
})();
