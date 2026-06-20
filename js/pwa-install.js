(function(){
  const card = document.querySelector("[data-pwa-install-card]");
  const button = document.querySelector("[data-pwa-install]");
  const dismiss = document.querySelector("[data-pwa-dismiss]");
  const copy = document.querySelector("[data-pwa-install-copy]");
  const DISMISS_KEY = "allonahub.pwaInstall.dismissedUntil";
  let deferredPrompt = null;

  const isStandalone = () => {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  };

  const isMobile = () => {
    return window.matchMedia("(max-width: 760px)").matches ||
      /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
  };

  const isIos = () => /iPhone|iPad|iPod/i.test(window.navigator.userAgent) && !window.MSStream;

  const isDismissed = () => {
    try{
      const until = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
      return Date.now() < until;
    }catch(error){
      return false;
    }
  };

  const setMessage = message => {
    if(copy){copy.textContent = message}
  };

  const showCard = reason => {
    if(!card || isStandalone() || isDismissed()){return}
    if(reason === "ios"){
      setMessage("Paylaş menüsünden Ana Ekrana Ekle seçeneğini kullanarak AllonaHub'u tam ekran aç.");
    }else if(reason === "prompt"){
      setMessage("Tek dokunuşla ana ekrana ekle, AllonaHub'u tam ekran uygulama gibi kullan.");
    }else{
      setMessage("Tarayıcı menüsünden Ana Ekrana Ekle seçeneğiyle AllonaHub'u tam ekran kullan.");
    }
    card.hidden = false;
  };

  const hideCard = () => {
    if(card){card.hidden = true}
  };

  if(isStandalone()){
    document.documentElement.classList.add("is-standalone");
    hideCard();
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    showCard("prompt");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    document.documentElement.classList.add("is-standalone");
    hideCard();
  });

  if(button){
    button.addEventListener("click", async () => {
      if(deferredPrompt){
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        hideCard();
        return;
      }
      if(isIos()){
        setMessage("Safari'de Paylaş butonuna bas, ardından Ana Ekrana Ekle seçeneğini seç.");
        return;
      }
      setMessage("Tarayıcının menüsünden Ana Ekrana Ekle veya Uygulamayı Yükle seçeneğini kullanabilirsin.");
    });
  }

  if(dismiss){
    dismiss.addEventListener("click", () => {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      try{
        window.localStorage.setItem(DISMISS_KEY, String(Date.now() + sevenDays));
      }catch(error){
        // Dismissal is optional; keep the install UI functional if storage is blocked.
      }
      hideCard();
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    if(isMobile()){
      showCard(isIos() ? "ios" : "mobile");
    }
  });

  if("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")){
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", {scope: "./"}).catch(() => undefined);
    });
  }
})();
