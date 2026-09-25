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
    "choose-sea-document": "openSeaServiceDocumentPicker",
    "choose-sea-document-source": "openSeaServiceDocumentSource",
    "save-sea": "saveSeaExperience",
    "remove-photo": "removePhoto",
    "generate-summary": "generateSummary"
  });

  function setPdfBusy(busy) {
    document.querySelectorAll("[data-cv-pdf]").forEach((button) => {
      button.disabled = busy;
      if (busy) button.setAttribute("aria-busy", "true");
      else button.removeAttribute("aria-busy");
    });
  }

  function message(key, fallback) {
    return typeof window.t === "function" ? window.t(key) : fallback;
  }

  async function waitForPdfAssets(root) {
    if (document.fonts?.ready) await document.fonts.ready.catch(() => undefined);
    const images = Array.from(root.querySelectorAll("img"));
    await Promise.all(images.map(image => {
      if (image.complete) return Promise.resolve();
      return new Promise(resolve => {
        const done = () => resolve();
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
        window.setTimeout(done, 8000);
      });
    }));
  }

  async function renderMaritimeCvPdfBlob() {
    if (new URLSearchParams(location.search).get("partnerReview") !== "1") throw new Error("CV inceleme modu kapalı.");
    const pages = Array.from(document.querySelectorAll(".cvPage"));
    if (!pages.length || !window.html2canvas || !window.jspdf?.jsPDF) throw new Error("CV PDF şablonu yüklenemedi.");
    document.body.classList.add("pdf-capture");
    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      await waitForPdfAssets(document.querySelector(".previewWrap") || document.body);
      const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
      for (let index = 0; index < pages.length; index += 1) {
        const canvas = await window.html2canvas(pages[index], { scale: 2.5, useCORS: true, backgroundColor: "#ffffff", imageTimeout: 15000, logging: false });
        if (index) pdf.addPage();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const ratio = canvas.height / canvas.width;
        const renderedWidth = ratio > pageHeight / pageWidth ? pageHeight / ratio : pageWidth;
        const renderedHeight = ratio > pageHeight / pageWidth ? pageHeight : pageWidth * ratio;
        pdf.addImage(canvas.toDataURL("image/jpeg", 1), "JPEG", (pageWidth - renderedWidth) / 2, 0, renderedWidth, renderedHeight, undefined, "FAST");
      }
      return pdf.output("blob");
    } finally { document.body.classList.remove("pdf-capture"); }
  }

  window.renderMaritimeCvPdfBlob = renderMaritimeCvPdfBlob;

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

    if (!window.AllonaMaritimePdfNames || typeof window.AllonaMaritimePdfNames.maritimeCv !== "function") {
      window.alert(message("pdfGenerationFailed", "The PDF could not be created. Please try again."));
      return;
    }
    const firstName = document.getElementById("firstName")?.value;
    const familyName = document.getElementById("familyName")?.value;
    const fileName = window.AllonaMaritimePdfNames.maritimeCv(firstName, familyName);

    pdfDownloadInProgress = true;
    setPdfBusy(true);
    document.body.classList.add("pdf-capture");

    try {
      await new Promise(resolve => window.requestAnimationFrame(resolve));
      await waitForPdfAssets(document.querySelector(".previewWrap") || document.body);
      const pdf = new JsPdf("p", "mm", "a4");
      pdf.setProperties({
        title: `${String(firstName || "").trim()} ${String(familyName || "").trim()} CV`.trim(),
        subject: "AllonaHub Maritime CV",
        author: "AllonaHub"
      });

      for (let index = 0; index < pages.length; index += 1) {
        const canvas = await html2canvas(pages[index], {
          scale: 2.5,
          useCORS: true,
          backgroundColor: "#ffffff",
          imageTimeout: 15000,
          logging: false
        });
        const imageData = canvas.toDataURL("image/jpeg", 1);
        if (index > 0) pdf.addPage();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imageRatio = canvas.height / canvas.width;
        const pageRatio = pageHeight / pageWidth;
        const renderedWidth = imageRatio > pageRatio ? pageHeight / imageRatio : pageWidth;
        const renderedHeight = imageRatio > pageRatio ? pageHeight : pageWidth * imageRatio;
        pdf.addImage(imageData, "JPEG", (pageWidth - renderedWidth) / 2, 0, renderedWidth, renderedHeight, undefined, "FAST");
        const pageRect = pages[index].getBoundingClientRect();
        if (pageRect.width > 0 && pageRect.height > 0) {
          pages[index].querySelectorAll("a.cv-service-document-link[href]").forEach(anchor => {
            const rect = anchor.getBoundingClientRect();
            const x = Math.max(0, (pageWidth - renderedWidth) / 2 + (rect.left - pageRect.left) * renderedWidth / pageRect.width);
            const y = Math.max(0, (rect.top - pageRect.top) * renderedHeight / pageRect.height);
            const width = Math.min(pageWidth - x, Math.max(2, rect.width * renderedWidth / pageRect.width));
            const height = Math.min(pageHeight - y, Math.max(2, rect.height * renderedHeight / pageRect.height));
            if (/^https:\/\/allonahub\.com\//i.test(anchor.href)) pdf.link(x, y, width, height, { url: anchor.href });
          });
        }
      }

      if (!window.AllonaMaritimeCommerce || typeof window.AllonaMaritimeCommerce.authorizeOrCheckout !== "function") {
        const error = new Error("MARITIME_COMMERCE_UNAVAILABLE");
        error.code = "MARITIME_COMMERCE_UNAVAILABLE";
        throw error;
      }
      const authorization = await window.AllonaMaritimeCommerce.authorizeOrCheckout("maritime_cv_pdf");
      if (!authorization) return;
      await pdf.save(fileName, { returnPromise: true });
    } catch (error) {
      const key = window.AllonaMaritimeCommerce?.pdfErrorKey ? window.AllonaMaritimeCommerce.pdfErrorKey(error) : error?.code === "AUTH_REQUIRED"
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
        pdfNetworkFailed: "The download service could not be reached. Your saved CV is unchanged. Check your connection and retry.",
        pdfPaymentUnavailable: "Paid PDF downloads are not available yet. Your saved CV is unchanged.",
        pdfDeviceFailed: "Device verification is required for this download. Open Maritime CV and complete the save verification.",
        pdfGenerationFailed: "The PDF could not be created. Please try again."
      };
      window.alert(message(key, fallbacks[key]));
    } finally {
      document.body.classList.remove("pdf-capture");
      pdfDownloadInProgress = false;
      setPdfBusy(false);
    }
  }

  function callGlobal(name, ...args) {
    if (typeof window[name] === "function") return window[name](...args);
    return undefined;
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
    if (action.startsWith("remove-") || action === "lookup-sea-imo" || action === "choose-sea-document" || action === "choose-sea-document-source" || action === "save-sea") {
      const index = validRowIndex(button.dataset.cvIndex);
      if (index === null) return;
      if (action === "choose-sea-document-source") callGlobal(handler, index, button.dataset.cvSource);
      else callGlobal(handler, index, button);
      return;
    }
    callGlobal(handler);
  }

  function bindControls() {
    document.getElementById("langSelect")?.addEventListener("change", event => {
      callGlobal("changeLanguage", event.currentTarget.value);
    });
    document.querySelectorAll("[data-cv-save]").forEach(button => button.addEventListener("click", () => callGlobal("saveCV")));
    document.querySelectorAll("[data-cv-pdf]").forEach(button => button.addEventListener("click", downloadPDF));
    document.querySelectorAll("[data-cv-back-to-top]").forEach(button => button.addEventListener("click", () => {
      const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      document.getElementById("cvEditor")?.scrollTo({ top:0, behavior });
      window.scrollTo({ top:0, behavior });
    }));
    document.getElementById("cvResetButton")?.addEventListener("click", () => callGlobal("resetForm"));
    const editor = document.getElementById("cvEditor");
    editor?.addEventListener("input", handleEditorInput);
    editor?.addEventListener("click", handleEditorClick);
    editor?.addEventListener("change", event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.matches("[data-cv-service-document]")) return;
      const index = validRowIndex(input.dataset.cvIndex);
      const file = input.files?.[0] || null;
      input.value = "";
      if (index !== null && file) callGlobal("attachSeaServiceDocument", index, file);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindControls, { once: true });
  } else {
    bindControls();
  }
})();
