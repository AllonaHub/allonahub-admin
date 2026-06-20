(function () {
  window.Allona = window.Allona || {};

  window.Allona.config = {
    supabaseUrl: "https://xqvikrysciguzholdjeb.supabase.co",
    supabaseAnonKey: "sb_publishable_-P8KULtNFK5D9XRAeJrdng_zTCZ8zdF",
    locale: "tr-TR",
    currency: "TRY",
    defaultShipping: 89.9,
    freeShippingThreshold: 1500,
    apiBaseUrl: "https://api.allonahub.com",
    iyzicoFunctionName: "create-iyzico-checkout",
    cvCheckoutFunctionName: "create-cv-checkout",
    cvPrice: 149.99,
    translationEndpoint: "",
    partnerAdsEnabled: false,
    storageKeys: {
      cart: "allona_cart_v2",
      favorites: "allona_favorites_v2"
    }
  };
})();
