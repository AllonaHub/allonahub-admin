(function () {
  const SERVICE_WORKER_VERSION = "20260628-heading2";
  const canUseServiceWorker = "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1");

  if(!canUseServiceWorker){return}

  const refresh = () => {
    navigator.serviceWorker.register(`/sw.js?v=${SERVICE_WORKER_VERSION}`, {scope: "/"})
      .then(registration => registration.update())
      .catch(() => undefined);
  };

  if(document.readyState === "complete"){
    refresh();
  }else{
    window.addEventListener("load", refresh, {once: true});
  }
})();
