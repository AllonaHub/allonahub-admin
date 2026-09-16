(function () {
  "use strict";

  function safePart(value, fallback) {
    const normalized = String(value || "")
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}_-]+/gu, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64);
    return normalized || fallback;
  }

  function maritimeCv(firstName, familyName) {
    const first = safePart(firstName, "Kullanici");
    const family = safePart(familyName, "");
    return `AllonaHub_${[first, family].filter(Boolean).join("_")}_CV.pdf`;
  }

  function globalCv(givenNames, familyName, holderName) {
    const given = safePart(givenNames, "");
    const family = safePart(familyName, "");
    const holder = [given, family].filter(Boolean).join("_") || safePart(holderName, "Kullanici");
    return `Global_CV_${holder}_AllonaHub.pdf`;
  }

  window.AllonaMaritimePdfNames = Object.freeze({ maritimeCv, globalCv, safePart });
})();
