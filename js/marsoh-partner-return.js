(function () {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  if (params.get("source") !== "partner" || !params.get("partner_id")) return;
  const panelUrl = "../partner/maripartner.html";
  const back = document.querySelector("[data-firm-nav-back]");
  const returnLink = document.querySelector("[data-firm-nav-return]");
  if (back) back.href = panelUrl;
  if (returnLink) {
    returnLink.href = panelUrl;
    returnLink.textContent = "Panele Dön";
  }
})();
