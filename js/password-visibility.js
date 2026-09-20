(function () {
  "use strict";

  const labels = {
    tr: { show: "Şifreyi göster", hide: "Şifreyi gizle" },
    az: { show: "Şifrəni göstər", hide: "Şifrəni gizlət" },
    en: { show: "Show password", hide: "Hide password" },
    de: { show: "Passwort anzeigen", hide: "Passwort ausblenden" },
    ru: { show: "Показать пароль", hide: "Скрыть пароль" },
    ar: { show: "إظهار كلمة المرور", hide: "إخفاء كلمة المرور" },
    kk: { show: "Құпиясөзді көрсету", hide: "Құпиясөзді жасыру" },
    uz: { show: "Parolni ko‘rsatish", hide: "Parolni yashirish" },
    ky: { show: "Сырсөздү көрсөтүү", hide: "Сырсөздү жашыруу" }
  };

  const icons = {
    show: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.1 12s3.6-7 9.9-7 9.9 7 9.9 7-3.6 7-9.9 7-9.9-7-9.9-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    hide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"></path><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"></path><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c6.3 0 9.9 8 9.9 8a15.8 15.8 0 0 1-2.1 3.2"></path><path d="M6.6 6.6C3.8 8.5 2.1 12 2.1 12s3.6 8 9.9 8a9.7 9.7 0 0 0 4.1-.9"></path></svg>'
  };

  function currentLabels() {
    const stored = String(localStorage.getItem("allona.language") || "").toLowerCase();
    const documentLanguage = String(document.documentElement.lang || "tr").toLowerCase().split("-")[0];
    return labels[stored] || labels[documentLanguage] || labels.tr;
  }

  function updateButton(input, button) {
    const visible = input.type === "text";
    const text = currentLabels()[visible ? "hide" : "show"];
    button.setAttribute("aria-label", text);
    button.setAttribute("title", text);
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.innerHTML = icons[visible ? "hide" : "show"];
  }

  function enhance(input) {
    if (!(input instanceof HTMLInputElement) || input.dataset.passwordVisibilityReady === "true") return;
    input.dataset.passwordVisibilityReady = "true";

    const wrapper = document.createElement("span");
    wrapper.className = "password-visibility-field";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-visibility-toggle";
    button.addEventListener("click", function () {
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      input.type = input.type === "password" ? "text" : "password";
      updateButton(input, button);
      input.focus({ preventScroll: true });
      if (selectionStart !== null && selectionEnd !== null) input.setSelectionRange(selectionStart, selectionEnd);
    });
    wrapper.appendChild(button);
    updateButton(input, button);
  }

  function mount(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('input[type="password"], input[data-password-visibility-ready="true"]').forEach(enhance);
  }

  document.addEventListener("allona:language-changed", function () {
    document.querySelectorAll(".password-visibility-field > input").forEach(function (input) {
      const button = input.parentElement && input.parentElement.querySelector(".password-visibility-toggle");
      if (button) updateButton(input, button);
    });
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { mount(document); });
  else mount(document);

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) mount(node);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
