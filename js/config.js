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
    turnstileSiteKey: "0x4AAAAAADokiv3Rugyxil7J",
    emailjs: {
      serviceId: "service_s9myas7",
      templateId: "template_i7xzsya",
      publicKey: "j_8unIhsqi5PEVebP"
    },
    bankPaymentFunctionName: "create-bank-checkout",
    bankPaymentAllowedHosts: ["api.allonahub.com", "allonahub.com", "bank.example.com", "bank-api.example.com"],
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
