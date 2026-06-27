(function () {
  const currencyFormatter = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  });

  function getData() {
    return window.AVM_ACTIVE_DATA || window.AVM_SEED_DATA || {
      categoryMenu: [],
      products: [],
      stores: [],
    };
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  function byRootCategory(rootId) {
    return (item) => item.categoryPath && item.categoryPath[0] && item.categoryId && item.categoryId.startsWith(rootId);
  }

  function getCategoryStats(category) {
    const data = getData();
    const products = data.products.filter(byRootCategory(category.id));
    const stores = data.stores.filter(byRootCategory(category.id));

    return {
      products,
      stores,
      publishedProducts: products.filter((product) => product.status === "published"),
    };
  }

  function dispatchCategoryChange(root, category) {
    root.dispatchEvent(
      new CustomEvent("shop-category-change", {
        bubbles: true,
        detail: { category },
      })
    );
  }

  function renderCategoryPanel(root, category) {
    const panel = root.querySelector("[data-shop-category-panel]");
    const stats = getCategoryStats(category);
    panel.innerHTML = "";
    panel.setAttribute("aria-labelledby", `shop-category-tab-${category.id}`);

    const header = createElement("div", "shop-category-panel__header");
    const titleGroup = createElement("div", "shop-category-panel__title-group");
    const title = createElement("h2", "shop-category-panel__title", category.title);
    const meta = createElement(
      "p",
      "shop-category-panel__meta",
      `${stats.stores.length} mağaza • ${stats.publishedProducts.length} ürün`
    );
    titleGroup.append(title, meta);

    const benchmark = createElement(
      "span",
      "shop-category-panel__benchmark",
      category.benchmarkRefs.join(" + ")
    );
    header.append(titleGroup, benchmark);
    panel.appendChild(header);

    const columns = createElement("div", "shop-category-panel__columns");
    category.columns.forEach((column) => {
      const group = createElement("section", "shop-category-panel__group");
      const groupTitle = createElement("h3", "shop-category-panel__group-title", column.title);
      const list = createElement("div", "shop-category-panel__items");

      column.items.forEach((item) => {
        const button = createElement("button", "shop-category-panel__item", item);
        button.type = "button";
        button.dataset.categoryLeaf = item;
        list.appendChild(button);
      });

      group.append(groupTitle, list);
      columns.appendChild(group);
    });
    panel.appendChild(columns);

    if (stats.publishedProducts.length) {
      const featured = createElement("div", "shop-category-panel__featured");
      const featuredTitle = createElement("h3", "shop-category-panel__featured-title", "Öne çıkanlar");
      const featuredList = createElement("div", "shop-category-panel__featured-list");

      stats.publishedProducts.slice(0, 3).forEach((product) => {
        const productItem = createElement("a", "shop-category-panel__featured-item");
        productItem.href = `#urun-${product.id}`;
        productItem.innerHTML = `
          <img src="${product.image}" alt="${product.name}">
          <span>
            <strong>${product.name}</strong>
            <small>${currencyFormatter.format(product.price)}</small>
          </span>
        `;
        featuredList.appendChild(productItem);
      });

      featured.append(featuredTitle, featuredList);
      panel.appendChild(featured);
    }
  }

  function setActiveCategory(root, categoryId) {
    const data = getData();
    const category = data.categoryMenu.find((item) => item.id === categoryId) || data.categoryMenu[0];

    if (!category) {
      return;
    }

    root.querySelectorAll("[data-shop-category-tab]").forEach((button) => {
      const isActive = button.dataset.shopCategoryTab === category.id;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });

    root.dataset.activeCategory = category.id;
    renderCategoryPanel(root, category);
    dispatchCategoryChange(root, category);
  }

  function moveActiveCategory(root, direction) {
    const tabs = Array.from(root.querySelectorAll("[data-shop-category-tab]"));
    const currentIndex = tabs.findIndex((tab) => tab.classList.contains("is-active"));
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    nextTab.focus();
    setActiveCategory(root, nextTab.dataset.shopCategoryTab);
  }

  function initCategoryMenu(root) {
    const data = getData();

    if (!root || !data.categoryMenu.length) {
      return;
    }

    root.classList.add("shop-category-menu");
    root.innerHTML = "";

    const nav = createElement("nav", "shop-category-menu__nav");
    nav.setAttribute("aria-label", "Shop kategorileri");
    nav.setAttribute("role", "tablist");

    const panel = createElement("section", "shop-category-menu__panel");
    panel.dataset.shopCategoryPanel = "";
    panel.setAttribute("role", "tabpanel");

    data.categoryMenu.forEach((category, index) => {
      const button = createElement("button", "shop-category-menu__tab");
      const label = createElement("span", "shop-category-menu__tab-label", category.title);
      const count = createElement("span", "shop-category-menu__tab-count", String(category.productCount));

      button.id = `shop-category-tab-${category.id}`;
      button.type = "button";
      button.dataset.shopCategoryTab = category.id;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", index === 0 ? "true" : "false");
      button.tabIndex = index === 0 ? 0 : -1;
      button.append(label, count);

      button.addEventListener("pointerenter", () => setActiveCategory(root, category.id));
      button.addEventListener("focus", () => setActiveCategory(root, category.id));
      button.addEventListener("click", () => setActiveCategory(root, category.id));
      button.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          moveActiveCategory(root, 1);
        }

        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          moveActiveCategory(root, -1);
        }
      });

      nav.appendChild(button);
    });

    root.append(nav, panel);
    setActiveCategory(root, data.categoryMenu[0].id);
  }

  function productMatches(product, rootId, query) {
    const inCategory = !rootId || (product.categoryId && product.categoryId.startsWith(rootId));
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

    if (!normalizedQuery) {
      return inCategory;
    }

    return (
      inCategory &&
      [product.name, product.category, product.mainCategory, product.badge]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("tr-TR").includes(normalizedQuery))
    );
  }

  function renderProducts(container, rootId, query) {
    const data = getData();
    const products = data.products
      .filter((product) => product.status === "published")
      .filter((product) => productMatches(product, rootId, query || ""))
      .slice(0, 12);

    container.innerHTML = "";

    products.forEach((product) => {
      const card = createElement("article", "shop-product-card");
      card.id = `urun-${product.id}`;
      card.innerHTML = `
        <img class="shop-product-card__image" src="${product.image}" alt="${product.name}">
        <div class="shop-product-card__body">
          <span class="shop-product-card__category">${product.mainCategory}</span>
          <h3>${product.name}</h3>
          <div class="shop-product-card__meta">
            <strong>${currencyFormatter.format(product.price)}</strong>
            <span>${product.rating.toFixed(1)} / ${product.reviewCount} yorum</span>
          </div>
          <div class="shop-product-card__footer">
            <span>${product.badge}</span>
            <small>${product.stock} stok</small>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    if (!products.length) {
      const empty = createElement("p", "shop-product-grid__empty", "Bu kategori için yayınlanmış ürün bulunamadı.");
      container.appendChild(empty);
    }
  }

  function initProductGrid(container) {
    if (!container) {
      return;
    }

    const searchInput = document.querySelector("[data-shop-search]");
    let activeCategoryId = "";

    const rerender = () => renderProducts(container, activeCategoryId, searchInput ? searchInput.value : "");

    document.addEventListener("shop-category-change", (event) => {
      activeCategoryId = event.detail.category.id;
      rerender();
    });

    if (searchInput) {
      searchInput.addEventListener("input", rerender);
    }

    rerender();
  }

  function initMetricBar(container) {
    const data = getData();

    if (!container) {
      return;
    }

    const publishedProducts = data.products.filter((product) => product.status === "published").length;
    const publishedStores = data.stores.filter((store) => store.status === "published").length;
    container.innerHTML = `
      <span>${data.categories.length} ana kategori</span>
      <span>${data.categoryIndex.length} kategori kırılımı</span>
      <span>${publishedStores} yayınlı mağaza</span>
      <span>${publishedProducts} yayınlı ürün</span>
    `;
  }

  function initShopCategoryExperience() {
    document.querySelectorAll("[data-shop-category-menu]").forEach(initCategoryMenu);
    document.querySelectorAll("[data-shop-product-grid]").forEach(initProductGrid);
    document.querySelectorAll("[data-shop-metrics]").forEach(initMetricBar);
  }

  window.ShopCategoryExperience = {
    init: initShopCategoryExperience,
    initCategoryMenu,
    renderProducts,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShopCategoryExperience);
  } else {
    initShopCategoryExperience();
  }
})();
