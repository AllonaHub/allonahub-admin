(function () {
  "use strict";
  const toggle = document.getElementById("home-services-toggle");
  const menu = document.getElementById("home-services-menu");
  if (!toggle || !menu) return;

  const mobile = window.matchMedia("(max-width: 760px)");
  const labels = {
    tr: ["Hizmetler menüsünü aç", "Hizmetler menüsünü kapat", "Hizmetlerimiz", "Allona Denizcilik"],
    az: ["Xidmətlər menyusunu aç", "Xidmətlər menyusunu bağla", "Xidmətlərimiz", "Allona Dənizçilik"],
    en: ["Open services menu", "Close services menu", "Our services", "Allona Maritime"],
    de: ["Dienstleistungsmenü öffnen", "Dienstleistungsmenü schließen", "Unsere Dienstleistungen", "Allona Seefahrt"],
    ru: ["Открыть меню услуг", "Закрыть меню услуг", "Наши услуги", "Allona Морское дело"],
    ar: ["فتح قائمة الخدمات", "إغلاق قائمة الخدمات", "خدماتنا", "Allona للملاحة البحرية"],
    kk: ["Қызметтер мәзірін ашу", "Қызметтер мәзірін жабу", "Қызметтеріміз", "Allona Теңіз ісі"],
    uz: ["Xizmatlar menyusini ochish", "Xizmatlar menyusini yopish", "Xizmatlarimiz", "Allona Dengizchilik"],
    ky: ["Кызматтар менюсун ачуу", "Кызматтар менюсун жабуу", "Кызматтарыбыз", "Allona Деңизчилик"]
  };

  function localize() {
    const language = document.documentElement.lang.split("-")[0];
    const copy = labels[language] || labels.tr;
    toggle.setAttribute("aria-label", copy[menu.hidden ? 0 : 1]);
    document.getElementById("home-services-title").textContent = copy[2];
    menu.querySelector("[data-home-service='maritime']").textContent = copy[3];
  }

  function setOpen(open, restoreFocus) {
    menu.hidden = !(open && mobile.matches);
    toggle.setAttribute("aria-expanded", String(!menu.hidden));
    localize();
    if (restoreFocus && mobile.matches) toggle.focus();
  }

  toggle.addEventListener("click", () => {
    setOpen(menu.hidden);
    if (!menu.hidden) menu.querySelector("a").focus();
  });
  toggle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    setOpen(true);
    menu.querySelector("a").focus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      event.preventDefault();
      setOpen(false, true);
    }
  });
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });
  document.addEventListener("focusin", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  mobile.addEventListener("change", () => setOpen(false));
  document.addEventListener("allona:language-changed", localize);
  localize();
})();
