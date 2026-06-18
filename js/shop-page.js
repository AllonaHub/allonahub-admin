(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  let products = [];

  function filtersFromDom() {
    return {
      search: document.querySelector("[data-filter-search]")?.value || core.getParam("q") || "",
      category: document.querySelector("[data-filter-category]")?.value || "",
      minPrice: document.querySelector("[data-filter-min]")?.value || "",
      maxPrice: document.querySelector("[data-filter-max]")?.value || "",
      sort: document.querySelector("[data-filter-sort]")?.value || "newest"
    };
  }

  function applyLocalFilters() {
    const filters = filtersFromDom();
    const q = filters.search.trim().toLocaleLowerCase("tr-TR");
    const category = filters.category.trim().toLocaleLowerCase("tr-TR");
    const min = Number(filters.minPrice || 0);
    const max = Number(filters.maxPrice || 0);

    let list = products.filter((product) => {
      const text = `${product.name} ${product.description} ${product.category} ${product.brand || ""}`.toLocaleLowerCase("tr-TR");
      const searchOk = !q || text.includes(q);
      const categoryOk = !category || product.category.toLocaleLowerCase("tr-TR") === category;
      const minOk = !min || product.price >= min;
      const maxOk = !max || product.price <= max;
      return searchOk && categoryOk && minOk && maxOk;
    });

    if (filters.sort === "price_asc") list.sort((a, b) => a.price - b.price);
    else if (filters.sort === "price_desc") list.sort((a, b) => b.price - a.price);
    else if (filters.sort === "best_selling") list.sort((a, b) => b.sold_count - a.sold_count);
    else list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return list;
  }

  function renderGrid(target, items) {
    const node = typeof target === "string" ? document.querySelector(target) : target;
    if (!node) return;
    if (!items.length) {
      node.innerHTML = `<div class="empty-state">Bu filtrelerle eşleşen aktif ürün bulunamadı.</div>`;
      return;
    }
    node.innerHTML = items.map(core.productCard).join("");
  }

  function renderCategoryOptions() {
    const select = document.querySelector("[data-filter-category]");
    if (!select) return;
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    select.innerHTML = `<option value="">Tüm kategoriler</option>${categories.map((category) => `<option value="${core.escapeHTML(category)}">${core.escapeHTML(category)}</option>`).join("")}`;
  }

  function renderHomeSections() {
    renderGrid("[data-products-grid]", applyLocalFilters());
    renderGrid("[data-new-grid]", products.slice(0, 4));
    renderGrid("[data-best-grid]", [...products].sort((a, b) => b.sold_count - a.sold_count).slice(0, 4));
    renderGrid("[data-featured-grid]", products.filter((item) => item.stock > 0).slice(0, 4));
  }

  async function loadProducts() {
    const loadingTargets = ["[data-products-grid]", "[data-new-grid]", "[data-best-grid]", "[data-featured-grid]"];
    loadingTargets.forEach((target) => core.renderStatus(target, "Ürünler yükleniyor..."));

    try {
      products = await App.db.products.listActive({ sort: "newest" });
      renderCategoryOptions();
      const searchInput = document.querySelector("[data-filter-search]");
      if (searchInput && core.getParam("q")) searchInput.value = core.getParam("q");
      renderHomeSections();
    } catch (error) {
      loadingTargets.forEach((target) => core.renderStatus(target, error.message || "Ürünler yüklenemedi.", "error"));
    }
  }

  function bindFilters() {
    const form = document.querySelector("[data-product-filters]");
    if (!form) return;
    form.addEventListener("input", core.debounce(renderHomeSections, 160));
    form.addEventListener("change", renderHomeSections);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      renderHomeSections();
    });
    const reset = form.querySelector("[data-filter-reset]");
    if (reset) {
      reset.addEventListener("click", () => {
        form.reset();
        renderHomeSections();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-page='shop']")) return;
    bindFilters();
    loadProducts();
  });
})();
