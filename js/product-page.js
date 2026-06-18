(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;

  function renderProduct(product) {
    const root = document.querySelector("[data-product-detail]");
    if (!root) return;
    const image = core.sanitizeUrl(product.image_url);
    root.innerHTML = `
      <div class="product-detail__media panel">
        <img src="${core.escapeHTML(image)}" alt="${core.escapeHTML(product.name)}" loading="eager" onerror="this.src='${core.url("images/product-fallback.svg")}'">
      </div>
      <section class="product-detail__info panel">
        <p class="eyebrow">${core.escapeHTML(product.category)}</p>
        <h1>${core.escapeHTML(product.name)}</h1>
        <p>${core.escapeHTML(product.description || "Ürün açıklaması yakında güncellenecek.")}</p>
        <div class="price-row">
          <span class="price">${core.money(product.price)}</span>
          <span class="${product.stock > 0 ? "stock" : "stock stock--out"}">${product.stock > 0 ? `${product.stock} stok` : "Stok yok"}</span>
        </div>
        <div class="form-actions">
          <div class="quantity-control" aria-label="Adet">
            <button type="button" data-qty-dec>-</button>
            <input type="number" min="1" max="${Math.max(product.stock, 1)}" value="1" data-product-qty aria-label="Adet">
            <button type="button" data-qty-inc>+</button>
          </div>
          <button class="btn" type="button" data-detail-add ${product.stock <= 0 ? "disabled" : ""}>Sepete Ekle</button>
          <button class="btn btn--light" type="button" data-fav-product="${core.escapeHTML(product.id)}">Favoriye Ekle</button>
        </div>
      </section>
    `;

    core.setMeta({
      title: `${product.meta_title || product.name} | AllonaHub`,
      description: product.meta_description || product.description || "AllonaHub ürün detayı.",
      image,
      url: window.location.href,
      schema: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image,
        sku: String(product.id),
        category: product.category,
        offers: {
          "@type": "Offer",
          price: product.price,
          priceCurrency: "TRY",
          availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: window.location.href
        }
      }
    });

    root.addEventListener("click", (event) => {
      const qtyInput = root.querySelector("[data-product-qty]");
      const qty = Math.max(1, Number(qtyInput.value || 1));

      if (event.target.closest("[data-qty-dec]")) {
        qtyInput.value = Math.max(1, qty - 1);
      }
      if (event.target.closest("[data-qty-inc]")) {
        qtyInput.value = Math.min(Math.max(product.stock, 1), qty + 1);
      }
      if (event.target.closest("[data-detail-add]")) {
        App.cart.add(product.id, qty);
      }
    });
  }

  async function init() {
    const root = document.querySelector("[data-product-detail]");
    if (!root) return;
    const id = core.getParam("id");
    if (!id) {
      core.renderStatus(root, "Ürün bağlantısı eksik.", "error");
      return;
    }

    core.renderStatus(root, "Ürün yükleniyor...");
    try {
      const product = await App.db.products.byId(id);
      if (!product) {
        core.renderStatus(root, "Ürün bulunamadı veya aktif değil.", "error");
        return;
      }
      renderProduct(product);
    } catch (error) {
      core.renderStatus(root, error.message || "Ürün yüklenemedi.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
