(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core;
  const config = App.config;
  let favoriteRefreshTimer = null;

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getItems() {
    return read(config.storageKeys.cart, []);
  }

  function setItems(items) {
    write(config.storageKeys.cart, items);
    updateBadges();
  }

  function backendMissing(error) {
    const message = `${error && error.message || ""} ${error && error.details || ""} ${error && error.hint || ""}`;
    return /function|schema cache|could not find|does not exist|not found/i.test(message);
  }

  function normalizeProductSnapshot(value) {
    if (!value) return null;
    try {
      const raw = typeof value === "string" ? JSON.parse(decodeURIComponent(value)) : value;
      const product = core.normalizeProduct(raw);
      return product.id ? product : null;
    } catch (error) {
      return null;
    }
  }

  function rememberProductPreview(value) {
    const product = normalizeProductSnapshot(value);
    if (!product || !product.id) return;
    try {
      const serialized = JSON.stringify(product);
      localStorage.setItem(`allona_product_preview_${product.id}`, serialized);
      if (product.slug) localStorage.setItem(`allona_product_preview_slug_${product.slug}`, serialized);
      localStorage.setItem("allona_product_preview_last", serialized);
    } catch (error) {}
  }

  function remoteCartLines(cart) {
    return ((cart && cart.items) || [])
      .map((item) => {
        const product = item.product ? core.normalizeProduct(item.product) : null;
        return {
          id: item.product_id || product?.id,
          qty: Math.max(1, Number(item.quantity || item.qty || 1)),
          quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
          product
        };
      })
      .filter((item) => item.product);
  }

  function mirrorRemoteCart(cart) {
    const lines = remoteCartLines(cart);
    setItems(lines.map((line) => ({
      id: line.product.id,
      qty: line.qty,
      added_at: new Date().toISOString()
    })));
    return lines;
  }

  async function currentUser() {
    return App.auth ? App.auth.getUser() : null;
  }

  async function migrateLocalCartIfNeeded() {
    const user = await currentUser();
    if (!user || !App.db || !App.db.cart) return null;
    const localItems = getItems();
    const remote = await App.db.cart.get();
    if (((remote && remote.items) || []).length) {
      let next = remote;
      const remoteIds = new Set(remoteCartLines(remote).map((line) => String(line.id || line.product.id)));
      for (const item of localItems) {
        if (!remoteIds.has(String(item.id))) {
          next = await App.db.cart.add(item.id, Math.max(1, Number(item.qty || 1)));
        }
      }
      mirrorRemoteCart(next);
      return next;
    }
    if (!localItems.length) return remote;
    let next = remote;
    for (const item of localItems) {
      next = await App.db.cart.add(item.id, Math.max(1, Number(item.qty || 1)));
    }
    mirrorRemoteCart(next);
    return next;
  }

  async function syncLocalToRemote() {
    try {
      const user = await currentUser();
      if (!user || !App.db || !App.db.cart) return hydrateLocal();
      const remote = await migrateLocalCartIfNeeded();
      return mirrorRemoteCart(remote || await App.db.cart.get());
    } catch (error) {
      if (backendMissing(error)) return hydrateLocal();
      throw error;
    }
  }

  function addLocal(productId, qty, productSnapshot) {
    const id = String(productId);
    const amount = Math.max(1, Number(qty || 1));
    const product = normalizeProductSnapshot(productSnapshot);
    const items = getItems();
    const found = items.find((item) => String(item.id) === id);
    if (found) {
      found.qty += amount;
      if (product && !found.product) found.product = product;
    } else {
      items.push({ id, qty: amount, product, added_at: new Date().toISOString() });
    }
    setItems(items);
    core.toast("Ürün sepete eklendi.");
  }

  async function add(productId, qty, productSnapshot) {
    const user = await currentUser();
    if (!user || !App.db || !App.db.cart) {
      addLocal(productId, qty, productSnapshot);
      return;
    }
    try {
      await migrateLocalCartIfNeeded();
      const remote = await App.db.cart.add(String(productId), Math.max(1, Number(qty || 1)));
      mirrorRemoteCart(remote);
      core.toast("Ürün sepete eklendi.");
    } catch (error) {
      if (!backendMissing(error)) throw error;
      addLocal(productId, qty, productSnapshot);
    }
  }

  function setQtyLocal(productId, qty) {
    const nextQty = Number(qty);
    const items = nextQty <= 0
      ? getItems().filter((item) => String(item.id) !== String(productId))
      : getItems().map((item) => {
        if (String(item.id) !== String(productId)) return item;
        return { ...item, qty: Math.max(1, nextQty || 1) };
      });
    setItems(items);
  }

  async function setQty(productId, qty) {
    const user = await currentUser();
    if (!user || !App.db || !App.db.cart) {
      setQtyLocal(productId, qty);
      return;
    }
    try {
      const remote = await App.db.cart.setQuantity(String(productId), Number(qty || 0));
      mirrorRemoteCart(remote);
    } catch (error) {
      if (!backendMissing(error)) throw error;
      setQtyLocal(productId, qty);
    }
  }

  function removeLocal(productId) {
    setItems(getItems().filter((item) => String(item.id) !== String(productId)));
    core.toast("Ürün sepetten çıkarıldı.");
  }

  async function remove(productId) {
    const user = await currentUser();
    if (!user || !App.db || !App.db.cart) {
      removeLocal(productId);
      return;
    }
    try {
      const remote = await App.db.cart.setQuantity(String(productId), 0);
      mirrorRemoteCart(remote);
      core.toast("Ürün sepetten çıkarıldı.");
    } catch (error) {
      if (!backendMissing(error)) throw error;
      removeLocal(productId);
    }
  }

  function clearLocal() {
    setItems([]);
  }

  async function clear() {
    const user = await currentUser();
    if (!user || !App.db || !App.db.cart) {
      clearLocal();
      return;
    }
    try {
      const remote = await App.db.cart.clear();
      mirrorRemoteCart(remote);
    } catch (error) {
      if (!backendMissing(error)) throw error;
      clearLocal();
    }
  }

  function count() {
    return getItems().reduce((total, item) => total + Number(item.qty || 0), 0);
  }

  async function hydrateLocal() {
    const cartItems = getItems();
    let products = [];
    try {
      products = App.db && App.db.products
        ? await App.db.products.byIds(cartItems.map((item) => item.id))
        : [];
    } catch (error) {
      products = [];
    }
    const byId = new Map(products.map((product) => [String(product.id), product]));
    return cartItems
      .map((item) => ({
        ...item,
        qty: Math.max(1, Number(item.qty || 1)),
        product: byId.get(String(item.id)) || normalizeProductSnapshot(item.product)
      }))
      .filter((item) => item.product);
  }

  async function hydrate() {
    const user = await currentUser();
    if (!user || !App.db || !App.db.cart) return hydrateLocal();
    try {
      const remote = await migrateLocalCartIfNeeded();
      return mirrorRemoteCart(remote || await App.db.cart.get());
    } catch (error) {
      if (backendMissing(error)) return hydrateLocal();
      throw error;
    }
  }

  function totals(lines, coupon, hpToUse) {
    const subtotal = (lines || []).reduce((sum, item) => sum + item.product.price * item.qty, 0);
    const shipping = subtotal >= config.freeShippingThreshold || subtotal === 0 ? 0 : config.defaultShipping;
    const discount = coupon && coupon.type === "percent"
      ? subtotal * (Number(coupon.value || 0) / 100)
      : Number(coupon && coupon.value || 0);
    const hpDiscount = Math.min(Math.max(0, Number(hpToUse || 0)), 100, Math.floor(subtotal * 0.2));
    const safeDiscount = Math.min(subtotal, Math.max(0, discount) + hpDiscount);
    return {
      subtotal,
      shipping,
      discount: Math.min(subtotal, Math.max(0, discount)),
      hpDiscount,
      discountTotal: safeDiscount,
      total: Math.max(0, subtotal + shipping - safeDiscount)
    };
  }

  function updateBadges() {
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      node.textContent = count();
    });
    document.querySelectorAll("[data-fav-count]").forEach((node) => {
      node.textContent = App.favorites.count();
    });
  }

  function setFavoriteButtonState(button, isFavorite) {
    if (!button) return;
    button.classList.toggle("is-favorite", isFavorite);
    button.setAttribute("aria-pressed", isFavorite ? "true" : "false");
    button.setAttribute("aria-label", isFavorite ? "Favoriden çıkar" : "Favoriye ekle");
    if (button.classList.contains("product-card__favorite")) {
      button.textContent = isFavorite ? "♥" : "♡";
    } else if (isFavorite) {
      button.textContent = "Favoriden Çıkar";
    } else {
      button.textContent = "Favoriye Ekle";
    }
  }

  function syncFavoriteButtons(ids) {
    const favoriteIds = new Set((ids || getLocalFavorites()).map(String));
    document.querySelectorAll("[data-fav-product]").forEach((button) => {
      setFavoriteButtonState(button, favoriteIds.has(String(button.dataset.favProduct)));
    });
  }

  async function refreshFavoriteUi() {
    try {
      const ids = await favoriteIds();
      syncFavoriteButtons(ids);
      document.querySelectorAll("[data-fav-count]").forEach((node) => {
        node.textContent = ids.length;
      });
    } catch (error) {
      syncFavoriteButtons();
      updateBadges();
    }
  }

  function scheduleFavoriteRefresh() {
    window.clearTimeout(favoriteRefreshTimer);
    favoriteRefreshTimer = window.setTimeout(() => {
      refreshFavoriteUi();
    }, 80);
  }

  const productCardInteractiveSelector = [
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "label",
    "summary",
    "[role='button']",
    "[role='link']"
  ].join(",");

  function closestElement(target, selector) {
    if (!target) return null;
    const node = target.nodeType === 1 ? target : target.parentElement;
    return node && node.closest ? node.closest(selector) : null;
  }

  function isShopSurface(node) {
    return Boolean(node && node.closest && node.closest('.site-shell[data-page="shop"]'));
  }

  function shopProductCardFromTarget(target) {
    const card = closestElement(target, "[data-product-card]");
    return card && isShopSurface(card) ? card : null;
  }

  function isProductCardInteractiveTarget(target, card) {
    const interactive = closestElement(target, productCardInteractiveSelector);
    return Boolean(interactive && card && card.contains(interactive));
  }

  function prepareShopProductCard(card) {
    if (!card || card.dataset.shopCardReady === "true") return;
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-expanded", card.classList.contains("is-description-open") ? "true" : "false");
    const description = card.querySelector(".product-card__description");
    if (description) description.setAttribute("aria-hidden", card.classList.contains("is-description-open") ? "false" : "true");
    card.dataset.shopCardReady = "true";
  }

  function prepareShopProductCards() {
    document.querySelectorAll('.site-shell[data-page="shop"] [data-product-card]').forEach(prepareShopProductCard);
  }

  function setProductDescriptionOpen(card, isOpen) {
    if (!card) return;
    prepareShopProductCard(card);
    document.querySelectorAll('.site-shell[data-page="shop"] .product-card.is-description-open').forEach((item) => {
      if (item !== card) setProductDescriptionOpen(item, false);
    });
    card.classList.toggle("is-description-open", isOpen);
    card.setAttribute("aria-expanded", isOpen ? "true" : "false");
    const description = card.querySelector(".product-card__description");
    if (description) description.setAttribute("aria-hidden", isOpen ? "false" : "true");
  }

  function toggleProductDescription(card) {
    setProductDescriptionOpen(card, !card.classList.contains("is-description-open"));
  }

  function getLocalFavorites() {
    return read(config.storageKeys.favorites, []);
  }

  function setLocalFavorites(items) {
    write(config.storageKeys.favorites, [...new Set(items.map(String))]);
    updateBadges();
  }

  async function favoriteIds() {
    const user = App.auth ? await App.auth.getUser() : null;
    if (!user) return getLocalFavorites().map(String);
    const { data, error } = await App.db.client()
      .from("favorites")
      .select("product_id")
      .eq("user_id", user.id);
    if (error) throw error;
    return (data || []).map((item) => String(item.product_id));
  }

  async function toggleFavorite(productId) {
    const id = String(productId);
    const user = App.auth ? await App.auth.getUser() : null;

    if (!user) {
      const current = getLocalFavorites().map(String);
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      setLocalFavorites(next);
      core.toast("Favoriler güncellendi.");
      syncFavoriteButtons(next);
      return next.includes(id);
    }

    const { data } = await App.db.client()
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", id)
      .maybeSingle();

    if (data) {
      const { error } = await App.db.client().from("favorites").delete().eq("id", data.id);
      if (error) throw error;
      core.toast("Favoriden çıkarıldı.");
      updateBadges();
      refreshFavoriteUi();
      return false;
    }

    const { error } = await App.db.client().from("favorites").insert({ user_id: user.id, product_id: id });
    if (error) throw error;
    core.toast("Favoriye eklendi.");
    updateBadges();
    refreshFavoriteUi();
    return true;
  }

  async function hydrateFavorites() {
    const ids = await favoriteIds();
    return App.db.products.byIds(ids);
  }

  App.cart = {
    getItems,
    setItems,
    add,
    setQty,
    remove,
    clear,
    clearLocal,
    count,
    hydrate,
    syncLocalToRemote,
    totals,
    updateBadges
  };

  App.favorites = {
    ids: favoriteIds,
    toggle: toggleFavorite,
    hydrate: hydrateFavorites,
    count: () => getLocalFavorites().length,
    refreshUi: refreshFavoriteUi
  };

  document.addEventListener("click", async (event) => {
    const addButton = event.target.closest("[data-add-product]");
    const favButton = event.target.closest("[data-fav-product]");
    const previewLink = event.target.closest("[data-product-preview-link]");
    const productCard = shopProductCardFromTarget(event.target);

    if (previewLink) {
      rememberProductPreview(previewLink.dataset.productSnapshot);
    }

    if (addButton) {
      try {
        addButton.disabled = true;
        await App.cart.add(addButton.dataset.addProduct, 1, addButton.dataset.productSnapshot);
      } catch (error) {
        core.toast(error.message || "Ürün sepete eklenemedi.", "error");
      } finally {
        addButton.disabled = false;
      }
    }

    if (favButton) {
      try {
        favButton.disabled = true;
        const isFavorite = await App.favorites.toggle(favButton.dataset.favProduct);
        document.querySelectorAll("[data-fav-product]").forEach((button) => {
          if (String(button.dataset.favProduct) === String(favButton.dataset.favProduct)) {
            setFavoriteButtonState(button, isFavorite);
          }
        });
      } catch (error) {
        core.toast(error.message || "Favori güncellenemedi.", "error");
      } finally {
        favButton.disabled = false;
      }
    }

    if (productCard && !isProductCardInteractiveTarget(event.target, productCard)) {
      toggleProductDescription(productCard);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || !["Enter", " "].includes(event.key)) return;
    const productCard = shopProductCardFromTarget(event.target);
    if (!productCard || event.target !== productCard) return;
    event.preventDefault();
    toggleProductDescription(productCard);
  });

  const favoriteObserver = new MutationObserver(() => {
    scheduleFavoriteRefresh();
    prepareShopProductCards();
  });

  document.addEventListener("DOMContentLoaded", () => {
    updateBadges();
    refreshFavoriteUi();
    prepareShopProductCards();
    favoriteObserver.observe(document.body, { childList: true, subtree: true });
  });
  window.addEventListener("storage", () => {
    updateBadges();
    refreshFavoriteUi();
  });
})();
