(function(){
  const restaurants = [
    {
      id:"burger-house",
      name:"Allona Burger House",
      cuisine:"Burger",
      tags:["Burger","Patates","Soğuk içecek"],
      rating:4.8,
      eta:24,
      hp:35,
      min:180,
      deal:"2 menüye içecek",
      free:true,
      open:true,
      image:"../../images/modules/allona-yemek.png"
    },
    {
      id:"blue-pizza",
      name:"Blue Pizza",
      cuisine:"Pizza",
      tags:["Pizza","İtalyan","Aile menüsü"],
      rating:4.7,
      eta:29,
      hp:30,
      min:220,
      deal:"%20 menü indirimi",
      free:false,
      open:true,
      image:"../../images/modules/yemek.png"
    },
    {
      id:"kebap-prestige",
      name:"Kebap Prestige",
      cuisine:"Kebap",
      tags:["Kebap","Lahmacun","Izgara"],
      rating:4.9,
      eta:34,
      hp:42,
      min:260,
      deal:"Aile paketinde HP",
      free:true,
      open:true,
      image:"../../images/modules/allona-yemek.png"
    },
    {
      id:"fit-bowl",
      name:"Fit Bowl Kitchen",
      cuisine:"Sağlıklı",
      tags:["Salata","Protein","Vegan"],
      rating:4.6,
      eta:21,
      hp:28,
      min:160,
      deal:"Premium bowl fırsatı",
      free:false,
      open:true,
      image:"../../images/modules/yemek.png"
    },
    {
      id:"tatli-kahve",
      name:"Tatlı & Kahve Atelier",
      cuisine:"Tatlı",
      tags:["Tatlı","Kahve","Pasta"],
      rating:4.5,
      eta:27,
      hp:24,
      min:120,
      deal:"Kahve yanında tatlı",
      free:true,
      open:true,
      image:"../../images/modules/allona-yemek.png"
    },
    {
      id:"doner-line",
      name:"Döner Line",
      cuisine:"Döner",
      tags:["Döner","Ayran","Menü"],
      rating:4.4,
      eta:19,
      hp:22,
      min:110,
      deal:"Hızlı öğle menüsü",
      free:false,
      open:true,
      image:"../../images/modules/yemek.png"
    }
  ];

  const menuItems = [
    {id:"premium-burger",restaurant:"Allona Burger House",name:"Premium Burger Menü",desc:"Burger, patates, içecek ve sos",price:289.99,hp:35,icon:"fa-burger"},
    {id:"pizza-duo",restaurant:"Blue Pizza",name:"Pizza Duo Menü",desc:"2 kişilik pizza ve içecek",price:399.99,hp:30,icon:"fa-pizza-slice"},
    {id:"fit-protein",restaurant:"Fit Bowl Kitchen",name:"Fit Protein Bowl",desc:"Tavuk, yeşillik, tahıl ve sos",price:249.99,hp:28,icon:"fa-seedling"},
    {id:"kebap-family",restaurant:"Kebap Prestige",name:"Kebap Aile Menüsü",desc:"Izgara, lahmacun ve mezeler",price:599.99,hp:42,icon:"fa-fire-burner"},
    {id:"dessert-coffee",restaurant:"Tatlı & Kahve Atelier",name:"Tatlı & Kahve Seti",desc:"Pasta dilimi ve özel kahve",price:179.99,hp:24,icon:"fa-mug-hot"},
    {id:"quick-doner",restaurant:"Döner Line",name:"Hızlı Döner Menü",desc:"Döner, ayran ve patates",price:199.99,hp:22,icon:"fa-utensils"},
    {id:"vegan-bowl",restaurant:"Fit Bowl Kitchen",name:"Vegan Bowl",desc:"Nohut, avokado, yeşillik ve sos",price:229.99,hp:26,icon:"fa-leaf"},
    {id:"family-pizza",restaurant:"Blue Pizza",name:"Aile Pizza Paketi",desc:"Büyük pizza, tatlı ve içecek",price:529.99,hp:38,icon:"fa-people-group"}
  ];

  const state = {
    query:"",
    cuisine:"all",
    mode:"delivery",
    quick:new Set(),
    sort:"recommended",
    cart:[],
    discount:0,
    trackStep:1
  };

  const money = new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"});
  const qs = (selector,root=document) => root.querySelector(selector);
  const qsa = (selector,root=document) => Array.from(root.querySelectorAll(selector));

  const restaurantGrid = qs("[data-restaurant-grid]");
  const menuGrid = qs("[data-menu-grid]");
  const emptyState = qs("[data-food-empty]");
  const visibleCount = qs("[data-visible-count]");
  const summary = qs("[data-food-summary]");
  const searchInput = qs("[data-food-search]");
  const cartItems = qs("[data-cart-items]");
  const countBadges = qsa("[data-cart-count], [data-cart-count-rail]");
  const subtotalNode = qs("[data-subtotal]");
  const deliveryNode = qs("[data-delivery-fee]");
  const discountNode = qs("[data-discount]");
  const hpNode = qs("[data-hp-earned]");
  const totalNode = qs("[data-total]");

  function restaurantMatches(item){
    const query = state.query.trim().toLocaleLowerCase("tr-TR");
    const text = [item.name,item.cuisine,item.deal,...item.tags].join(" ").toLocaleLowerCase("tr-TR");
    if(query && !text.includes(query)) return false;
    if(state.cuisine !== "all" && item.cuisine !== state.cuisine) return false;
    if(state.quick.has("open") && !item.open) return false;
    if(state.quick.has("deal") && !item.deal) return false;
    if(state.quick.has("fast") && item.eta > 30) return false;
    if(state.quick.has("free") && !item.free) return false;
    return true;
  }

  function sortedRestaurants(){
    const list = restaurants.filter(restaurantMatches);
    if(state.sort === "rating") return list.sort((a,b) => b.rating - a.rating);
    if(state.sort === "fast") return list.sort((a,b) => a.eta - b.eta);
    if(state.sort === "hp") return list.sort((a,b) => b.hp - a.hp);
    return list.sort((a,b) => (b.open - a.open) || (b.rating - a.rating));
  }

  function renderRestaurants(){
    const list = sortedRestaurants();
    restaurantGrid.innerHTML = list.map(item => `
      <article class="food-card">
        <div class="food-card-media">
          <img src="${item.image}" alt="${item.name}">
          <div class="food-badge-row">
            <span class="food-badge"><i class="fa-solid fa-star" aria-hidden="true"></i>${item.rating.toFixed(1)}</span>
            <span class="food-badge food-badge--green">${item.free ? "Teslimat ücretsiz" : `${item.min} TL min.`}</span>
          </div>
        </div>
        <div>
          <h3>${item.name}</h3>
          <p>${item.tags.join(" • ")}</p>
        </div>
        <div class="food-meta">
          <span><i class="fa-solid fa-clock" aria-hidden="true"></i>${item.eta} dk</span>
          <span><i class="fa-solid fa-ticket" aria-hidden="true"></i>${item.deal}</span>
          <span><i class="fa-solid fa-coins" aria-hidden="true"></i>+${item.hp} HP</span>
        </div>
        <div class="food-card-footer">
          <strong>${state.mode === "pickup" ? "Gel-Al hazır" : "Teslimat açık"}</strong>
          <button class="food-add" type="button" data-add-suggested="${item.id}"><i class="fa-solid fa-plus" aria-hidden="true"></i>Menü Ekle</button>
        </div>
      </article>
    `).join("");
    emptyState.classList.toggle("is-visible", list.length === 0);
    visibleCount.textContent = list.length;
    summary.textContent = `${list.length} restoran, ${state.mode === "pickup" ? "gel-al" : "teslimat"} modunda listeleniyor.`;
  }

  function renderMenu(){
    menuGrid.innerHTML = menuItems.map(item => `
      <article class="food-menu-item">
        <div class="food-menu-top">
          <div>
            <h3>${item.name}</h3>
            <p>${item.restaurant}</p>
          </div>
          <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
        </div>
        <p>${item.desc}</p>
        <small>+${item.hp} HP kazandırır</small>
        <div class="food-price-line">
          <strong>${money.format(item.price)}</strong>
          <button class="food-add" type="button" data-add-item="${item.id}"><i class="fa-solid fa-plus" aria-hidden="true"></i>Ekle</button>
        </div>
      </article>
    `).join("");
  }

  function addItem(id){
    const source = menuItems.find(item => item.id === id) || suggestedItemForRestaurant(id);
    if(!source) return;
    const existing = state.cart.find(item => item.id === source.id);
    if(existing) existing.qty += 1;
    else state.cart.push({...source,qty:1});
    renderCart();
  }

  function suggestedItemForRestaurant(restaurantId){
    const restaurant = restaurants.find(item => item.id === restaurantId);
    if(!restaurant) return null;
    const match = menuItems.find(item => item.restaurant === restaurant.name) || menuItems[0];
    return {...match,id:`${match.id}-${restaurant.id}`};
  }

  function removeItem(id){
    state.cart = state.cart.filter(item => item.id !== id);
    renderCart();
  }

  function cartMath(){
    const subtotal = state.cart.reduce((sum,item) => sum + (item.price * item.qty),0);
    const delivery = subtotal === 0 ? 0 : state.mode === "pickup" ? 0 : subtotal >= 350 ? 0 : 34.99;
    const hp = state.cart.reduce((sum,item) => sum + (item.hp * item.qty),0);
    const discount = Math.min(state.discount,subtotal);
    return {subtotal,delivery,hp,discount,total:Math.max(0,subtotal + delivery - discount)};
  }

  function renderCart(){
    const count = state.cart.reduce((sum,item) => sum + item.qty,0);
    countBadges.forEach(node => node.textContent = count);
    if(count === 0){
      cartItems.innerHTML = `<div class="food-cart-empty">Sepete menü eklediğinde toplam, teslimat ve HP burada görünür.</div>`;
      state.discount = 0;
    } else {
      cartItems.innerHTML = state.cart.map(item => `
        <div class="food-cart-item">
          <div><b>${item.name} x${item.qty}</b><span>${item.restaurant} • ${money.format(item.price * item.qty)}</span></div>
          <button type="button" data-remove-item="${item.id}" aria-label="${item.name} ürünü çıkar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
      `).join("");
    }
    const totals = cartMath();
    subtotalNode.textContent = money.format(totals.subtotal);
    deliveryNode.textContent = money.format(totals.delivery);
    discountNode.textContent = `-${money.format(totals.discount)}`;
    hpNode.textContent = `${totals.hp} HP`;
    totalNode.textContent = money.format(totals.total);
  }

  function setCuisine(cuisine){
    state.cuisine = cuisine;
    qsa("[data-cuisine]").forEach(button => button.classList.toggle("is-active", button.dataset.cuisine === cuisine));
    renderRestaurants();
  }

  function progressOrder(){
    state.trackStep = state.trackStep >= 4 ? 1 : state.trackStep + 1;
    qsa("[data-order-track] .food-track-step").forEach((node,index) => {
      node.classList.toggle("is-done", index < state.trackStep);
    });
  }

  function bindEvents(){
    qs("[data-food-search-form]").addEventListener("submit", event => {
      event.preventDefault();
      state.query = searchInput.value;
      renderRestaurants();
    });
    searchInput.addEventListener("input", event => {
      state.query = event.target.value;
      renderRestaurants();
    });
    qsa("[data-mode]").forEach(button => {
      button.addEventListener("click", () => {
        state.mode = button.dataset.mode;
        qsa("[data-mode]").forEach(item => item.classList.toggle("is-active", item === button));
        renderRestaurants();
        renderCart();
      });
    });
    qsa("[data-cuisine]").forEach(button => {
      button.addEventListener("click", () => setCuisine(button.dataset.cuisine));
    });
    qsa("[data-quick]").forEach(button => {
      button.addEventListener("click", () => {
        const key = button.dataset.quick;
        if(state.quick.has(key)) state.quick.delete(key);
        else state.quick.add(key);
        button.classList.toggle("is-active", state.quick.has(key));
        renderRestaurants();
      });
    });
    qs("[data-food-sort]").addEventListener("change", event => {
      state.sort = event.target.value;
      renderRestaurants();
    });
    qs("[data-clear-filters]").addEventListener("click", () => {
      state.query = "";
      state.cuisine = "all";
      state.quick.clear();
      state.sort = "recommended";
      searchInput.value = "";
      qs("[data-food-sort]").value = "recommended";
      qsa("[data-quick]").forEach(button => button.classList.remove("is-active"));
      setCuisine("all");
    });
    document.addEventListener("click", event => {
      const add = event.target.closest("[data-add-item], [data-add-suggested]");
      if(add){
        addItem(add.dataset.addItem || add.dataset.addSuggested);
        return;
      }
      const remove = event.target.closest("[data-remove-item]");
      if(remove) removeItem(remove.dataset.removeItem);
    });
    qs("[data-coupon-form]").addEventListener("submit", event => {
      event.preventDefault();
      const code = qs("[data-coupon-code]").value.trim().toLocaleUpperCase("tr-TR");
      state.discount = code === "ALLONA50" ? 50 : code === "HP100" ? 100 : code ? 25 : 0;
      renderCart();
    });
    qs("[data-progress-order]").addEventListener("click", progressOrder);
  }

  renderRestaurants();
  renderMenu();
  renderCart();
  bindEvents();
})();
