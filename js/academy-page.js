(function () {
  const App = window.Allona = window.Allona || {};

  const academyModel = {
    table: "academy_articles",
    publicStatus: "published",
    statuses: ["draft", "review", "published", "archived"],
    fields: [
      "title",
      "slug",
      "category",
      "excerpt",
      "content",
      "keywords",
      "meta_title",
      "meta_description",
      "author",
      "status",
      "published_at",
      "updated_at"
    ],
    access: {
      public: "Herkese acik ve indekslenebilir.",
      partner: "Partner oturumu gerekir ve indekslemeye kapali tutulur.",
      internal: "Admin rolu gerekir ve public sitede gosterilmez."
    }
  };

  function hideUnpublished() {
    document.querySelectorAll("[data-academy-articles] [data-status]").forEach((card) => {
      if (card.getAttribute("data-status") !== academyModel.publicStatus) {
        card.hidden = true;
      }
    });
  }

  function initCategoryFilter() {
    document.querySelectorAll("[data-category]").forEach((link) => {
      link.addEventListener("click", () => {
        sessionStorage.setItem("allona_academy_last_category", link.getAttribute("data-category") || "");
      });
    });
  }

  function initAcademySearch() {
    const input = document.getElementById("globalSearchInput");
    const button = document.querySelector("[data-global-search]");
    const routes = [
      { keys: ["akademi", "makale", "rehber", "egitim", "eğitim"], url: "allonahub-akademi.html" },
      { keys: ["kupon", "hp", "kampanya", "indirim"], url: "pages/commerce/kuponlar.html" },
      { keys: ["partner", "satici", "satıcı"], url: "pages/partner/partner.html" },
      { keys: ["kariyer", "cv", "is", "iş"], url: "pages/career/allonakariyer.html" },
      { keys: ["shop", "magaza", "mağaza", "alisveris", "alışveriş"], url: "pages/commerce/allonashop.html" }
    ];

    function search() {
      const q = String(input && input.value || "").toLocaleLowerCase("tr-TR").trim();
      if (!q) return;
      const found = routes.find((item) => item.keys.some((key) => q.includes(key)));
      window.location.href = found ? found.url : `pages/search/arama.html?q=${encodeURIComponent(q)}`;
    }

    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") search();
      });
    }
    if (button) button.addEventListener("click", search);
  }

  App.academy = {
    model: academyModel,
    hideUnpublished,
    initCategoryFilter,
    initAcademySearch
  };

  document.addEventListener("DOMContentLoaded", () => {
    hideUnpublished();
    initCategoryFilter();
    initAcademySearch();
  });
})();
