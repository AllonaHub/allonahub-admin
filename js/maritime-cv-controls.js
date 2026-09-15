(function () {
  "use strict";

  let pdfDownloadInProgress = false;
  const rowBindings = Object.freeze({
    additional: Object.freeze({
      handler: "updateAdditional",
      keys: new Set(["name", "institute", "place", "issue", "cert", "expiry"])
    }),
    stcw: Object.freeze({
      handler: "updateSTCW",
      keys: new Set(["presetId", "code", "name", "institute", "place", "issue", "rank", "cert", "number", "expiry", "unlimited", "included"])
    }),
    sea: Object.freeze({
      handler: "updateSea",
      keys: new Set([
        "imo", "vessel", "company", "type", "flag", "dwt", "grt", "netTonnage", "buildYear", "mmsi", "callSign", "lengthOverall",
        "rank", "signon", "signoff", "referenceName", "referenceCompanyEmail", "referenceCompanyPhone", "referencePhone", "lookupProvider", "lookupFetchedAt"
      ])
    })
  });
  const actionBindings = Object.freeze({
    "add-additional": "addAdditional",
    "add-stcw": "addSTCW",
    "add-sea": "addSea",
    "remove-additional": "removeAdditional",
    "remove-stcw": "removeSTCW",
    "remove-sea": "removeSea",
    "lookup-sea-imo": "lookupSeaVessel",
    "remove-photo": "removePhoto",
    "generate-summary": "generateSummary"
  });

  function safeFilePart(value, fallback) {
    const normalized = String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);
    return normalized || fallback;
  }

  function setPdfBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    if (busy) {
      button.setAttribute("aria-busy", "true");
    } else {
      button.removeAttribute("aria-busy");
    }
  }

  function message(key, fallback) {
    return typeof window.t === "function" ? window.t(key) : fallback;
  }

  async function downloadPDF() {
    if (pdfDownloadInProgress) return;
    if (typeof window.validateMaritimeCV === "function" && !window.validateMaritimeCV()) return;

    const html2canvas = window.html2canvas;
    const JsPdf = window.jspdf && window.jspdf.jsPDF;
    if (typeof html2canvas !== "function" || typeof JsPdf !== "function") {
      window.alert(message("pdfLibraryFailed", "The PDF library could not be loaded. Check your connection and try again."));
      return;
    }

    const pages = Array.from(document.querySelectorAll(".cvPage"));
    if (!pages.length) {
      window.alert(message("pdfPreviewMissing", "The PDF preview was not found. Reload the page and try again."));
      return;
    }

    const button = document.getElementById("cvPdfButton");
    const first = safeFilePart(document.getElementById("firstName")?.value, "User");
    const last = safeFilePart(document.getElementById("familyName")?.value, "CV");
    const fileName = `AllonaHub_CV_${first}_${last}.pdf`;

    pdfDownloadInProgress = true;
    setPdfBusy(button, true);
    document.body.classList.add("pdf-capture");

    try {
      await new Promise(resolve => window.requestAnimationFrame(resolve));
      const pdf = new JsPdf("p", "mm", "a4");

      for (let index = 0; index < pages.length; index += 1) {
        const canvas = await html2canvas(pages[index], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff"
        });
        const imageData = canvas.toDataURL("image/jpeg", 0.98);
        if (index > 0) pdf.addPage();
        pdf.addImage(imageData, "JPEG", 0, 0, 210, 297);
      }

      if (!window.AllonaMaritimeCommerce || typeof window.AllonaMaritimeCommerce.authorizeOrCheckout !== "function") {
        const error = new Error("MARITIME_COMMERCE_UNAVAILABLE");
        error.code = "MARITIME_COMMERCE_UNAVAILABLE";
        throw error;
      }
      const authorization = await window.AllonaMaritimeCommerce.authorizeOrCheckout("maritime_cv_pdf");
      if (!authorization) return;
      pdf.save(fileName);
    } catch (error) {
      const key = error?.code === "AUTH_REQUIRED"
        ? "pdfLoginRequired"
        : error?.code === "MARITIME_CV_REQUIRED"
        ? "pdfSaveRequired"
        : error?.code === "UNTRUSTED_PAYMENT_URL"
        ? "pdfPaymentSecurityFailed"
        : String(error?.code || "").includes("PAYMENT") || error?.status === 402 || error?.status === 503
        ? "pdfPaymentFailed"
        : "pdfGenerationFailed";
      const fallbacks = {
        pdfLoginRequired: "Sign in before downloading your PDF.",
        pdfSaveRequired: "Save your Maritime CV before downloading the PDF.",
        pdfPaymentSecurityFailed: "The secure payment address could not be verified.",
        pdfPaymentFailed: "The PDF payment could not be started. Please try again.",
        pdfGenerationFailed: "The PDF could not be created. Please try again."
      };
      window.alert(message(key, fallbacks[key]));
    } finally {
      document.body.classList.remove("pdf-capture");
      pdfDownloadInProgress = false;
      setPdfBusy(button, false);
    }
  }

  function callGlobal(name, ...args) {
    if (typeof window[name] === "function") window[name](...args);
  }

  function validRowIndex(value) {
    const index = Number(value);
    return Number.isInteger(index) && index >= 0 && index < 50 ? index : null;
  }

  function capControlValue(control, maxLength) {
    if (control.value.length <= maxLength) return control.value;
    control.value = control.value.slice(0, maxLength);
    return control.value;
  }

  function handleEditorInput(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) return;

    const rowType = input.dataset.cvRow;
    if (rowType) {
      const binding = rowBindings[rowType];
      const index = validRowIndex(input.dataset.cvIndex);
      const key = input.dataset.cvKey || "";
      if (binding && index !== null && binding.keys.has(key)) {
        const value = input.type === "checkbox" ? String(input.checked) : capControlValue(input, 300);
        callGlobal(binding.handler, index, key, value);
      }
      return;
    }

    if (input.type === "file" || !input.id) return;
    capControlValue(input, 2000);
    if (input.id === "note") callGlobal("setSummaryModeFromInput", input.value);
    callGlobal("syncCV");
    callGlobal("autoSaveCV");
  }

  function handleEditorClick(event) {
    const button = event.target.closest("[data-cv-action]");
    if (!(button instanceof HTMLButtonElement)) return;

    const action = button.dataset.cvAction || "";
    const handler = actionBindings[action];
    if (!handler) return;
    if (action.startsWith("remove-") || action === "lookup-sea-imo") {
      const index = validRowIndex(button.dataset.cvIndex);
      if (index === null) return;
      callGlobal(handler, index, button);
      return;
    }
    callGlobal(handler);
  }

  function bindControls() {
    document.getElementById("langSelect")?.addEventListener("change", event => {
      callGlobal("changeLanguage", event.currentTarget.value);
    });
    document.getElementById("cvSaveButton")?.addEventListener("click", () => callGlobal("saveCV"));
    document.getElementById("cvPdfButton")?.addEventListener("click", downloadPDF);
    document.getElementById("cvResetButton")?.addEventListener("click", () => callGlobal("resetForm"));
    const editor = document.getElementById("cvEditor");
    editor?.addEventListener("input", handleEditorInput);
    editor?.addEventListener("click", handleEditorClick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindControls, { once: true });
  } else {
    bindControls();
  }
})();
