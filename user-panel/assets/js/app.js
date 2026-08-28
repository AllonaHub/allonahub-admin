(function () {
  "use strict";

  const canonicalPanel = "/pages/account/user-panel.html";

  if (window.location.pathname !== canonicalPanel) {
    window.location.replace(canonicalPanel);
  }
})();
