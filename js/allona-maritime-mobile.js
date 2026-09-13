(function () {
  const mobileQuery = window.matchMedia("(max-width: 760px)");

  function mobileOnly() {
    return mobileQuery.matches;
  }

  async function updateAccountLink() {
    if (!mobileOnly()) return;
    const link = document.querySelector("[data-maritime-mobile-account]");
    if (!link) return;

    try {
      const user = window.Allona && window.Allona.auth
        ? await window.Allona.auth.getUser()
        : null;
      if (!user) return;
      link.href = "../account/user-panel.html?module=allonadenizcilik";
      link.textContent = "Hesabım";
    } catch (error) {
      // Giriş bağlantısı ağ sorunu halinde kullanılabilir kalır.
    }
  }

  function setupSearch() {
    const form = document.querySelector("[data-maritime-mobile-search]");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const query = String(new FormData(form).get("q") || "").trim();
      const search = query ? `denizcilik ${query}` : "denizcilik iş ilanları";
      window.location.href = `../search/arama.html?q=${encodeURIComponent(search)}`;
    });
  }

  function logoMarkup(label, source, extraClass) {
    return `<span class="mobile-payment-logo ${extraClass || ""}" role="listitem" aria-label="${label}"><img src="${source}" alt="${label}"></span>`;
  }

  function enhanceFooter() {
    if (!mobileOnly()) return false;
    const strip = document.querySelector(".site-footer .footer-payment-strip");
    if (!strip) return false;
    const storeButtons = document.querySelector(".site-footer .store-buttons");
    if (storeButtons) storeButtons.hidden = true;
    if (strip.dataset.mobileLogosReady === "true") return true;

    strip.dataset.mobileLogosReady = "true";
    strip.setAttribute("aria-label", "Desteklenen ödeme yöntemleri");
    strip.setAttribute("role", "list");
    strip.innerHTML = [
      logoMarkup("TROY", "https://www.troyodeme.com/upload/cmspagefile/image/anasayfa/TROY-Logo-Tagline.png", "mobile-payment-logo--troy"),
      logoMarkup("Visa", "https://cdn.simpleicons.org/visa/1434CB"),
      logoMarkup("Mastercard", "https://cdn.simpleicons.org/mastercard/EB001B"),
      logoMarkup("American Express", "https://cdn.simpleicons.org/americanexpress/006FCF"),
      logoMarkup("PayPal", "https://cdn.simpleicons.org/paypal/003087"),
      logoMarkup("Google Pay", "https://cdn.simpleicons.org/googlepay/3C4043"),
      logoMarkup("Apple Pay", "https://cdn.simpleicons.org/applepay/000000")
    ].join("");
    return true;
  }

  function watchFooter() {
    if (enhanceFooter()) return;
    const observer = new MutationObserver(function () {
      if (enhanceFooter()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(function () {
      observer.disconnect();
    }, 10000);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupSearch();
    updateAccountLink();
    watchFooter();
  });
})();
