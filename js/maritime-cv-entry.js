(function () {
  "use strict";

  function compact(value, maxLength) {
    return String(value || "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength || 80);
  }

  function applyEntryContext() {
    const params = new URLSearchParams(window.location.search);
    const source = compact(params.get("source"), 40).toLocaleLowerCase("tr-TR");
    const position = compact(params.get("position"), 80);
    const allowedSources = new Set(["allonadenizcilik", "maritime-cv", "maritime"]);
    if (!allowedSources.has(source)) return;

    document.body.dataset.cvSource = source;
    const positionInput = document.getElementById("position");
    if (!positionInput || !position) return;

    positionInput.value = position;
    positionInput.dataset.maritimePrefilled = "true";
    if (typeof window.syncCV === "function") window.syncCV();
  }

  document.addEventListener("allonahub:maritime-cv-ready", applyEntryContext, { once: true });
  if (document.body?.dataset.maritimeCvReady === "true") applyEntryContext();
})();
