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

  function add(productId, qty) {
    const id = String(productId);
    const amount = Math.max(1, Number(qty || 1));
    const items = getItems();
    const found = items.find((item) => String(item.id) === id);
    if (found) {
      found.qty += amount;
    } else {
      items.push({ id, qty: amount, added_at: new Date().toISOString() });
    }
    setItems(items);
    core.toast("Ürün sepete eklendi.");
  }

  function setQty(productId, qty) {
    const nextQty = Number(qty);
    const items = getItems().map((item) => {
      if (String(item.id) !== String(productId)) return item;
      return { ...item, qty: Math.max(1, nextQty || 1) };
    });
    setItems(items);
  }

  function remove(productId) {
    setItems(getItems().filter((item) => String(item.id) !== String(productId)));
    core.toast("Ürün sepetten çıkarıldı.");
  }

  function clear() {
    setItems([]);
  }

  function count() {
    return getItems().reduce((total, item) => total + Number(item.qty || 0), 0);
  }

  async function hydrate() {
    const cartItems = getItems();
    const products = await App.db.products.byIds(cartItems.map((item) => item.id));
    const byId = new Map(products.map((product) => [String(product.id), product]));
    return cartItems
      .map((item) => ({
        ...item,
        qty: Math.max(1, Number(item.qty || 1)),
        product: byId.get(String(item.id))
      }))
      .filter((item) => item.product);
  }

  function totals(lines, coupon) {
    const subtotal = (lines || []).reduce((sum, item) => sum + item.product.price * item.qty, 0);
    const shipping = subtotal >= config.freeShippingThreshold || subtotal === 0 ? 0 : config.defaultShipping;
    const discount = coupon && coupon.type === "percent"
      ? subtotal * (Number(coupon.value || 0) / 100)
      : Number(coupon && coupon.value || 0);
    const safeDiscount = Math.min(subtotal, Math.max(0, discount));
    return {
      subtotal,
      shipping,
      discount: safeDiscount,
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
    count,
    hydrate,
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

    if (addButton) {
      App.cart.add(addButton.dataset.addProduct);
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
  });

  const favoriteObserver = new MutationObserver(() => {
    scheduleFavoriteRefresh();
  });

  document.addEventListener("DOMContentLoaded", () => {
    updateBadges();
    refreshFavoriteUi();
    favoriteObserver.observe(document.body, { childList: true, subtree: true });
  });
  window.addEventListener("storage", () => {
    updateBadges();
    refreshFavoriteUi();
  });
})();
