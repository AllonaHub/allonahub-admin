(function () {
  const App = window.Allona = window.Allona || {};

  let lastKnownLocation = null;

  function apiBaseUrl() {
    const configured = String(App.config?.apiBaseUrl || "").replace(/\/$/, "");
    if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return "http://localhost:3000";
    return configured || "https://api.allonahub.com";
  }

  async function authHeaders() {
    if (!App.auth || !App.auth.getSession) return null;
    const session = await App.auth.getSession();
    if (!session?.access_token) return null;
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    };
  }

  function cleanAction(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]/g, "_")
      .slice(0, 90);
  }

  function cleanText(value, max) {
    return String(value || "").trim().slice(0, max || 180);
  }

  function pagePath() {
    return `${window.location.pathname}${window.location.search}`.slice(0, 220);
  }

  function normalizeLocation(position) {
    if (!position?.coords) return null;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_m: position.coords.accuracy
    };
  }

  async function record(options) {
    const settings = options || {};
    const action = cleanAction(settings.action);
    if (!action) return false;

    const headers = await authHeaders();
    if (!headers) return false;

    const payload = {
      category: settings.category || "fraud_signal",
      action,
      resource_type: cleanText(settings.resourceType || settings.resource_type || "", 90) || undefined,
      resource_id: cleanText(settings.resourceId || settings.resource_id || "", 180) || undefined,
      severity: settings.severity || "info",
      page: cleanText(settings.page || pagePath(), 220),
      location_consent: Boolean(settings.locationConsent || settings.location_consent),
      location: settings.locationConsent || settings.location_consent ? settings.location || lastKnownLocation || undefined : undefined,
      evidence_tags: Array.isArray(settings.evidenceTags || settings.evidence_tags)
        ? (settings.evidenceTags || settings.evidence_tags).slice(0, 12)
        : [],
      metadata: settings.metadata || {}
    };

    try {
      const response = await fetch(`${apiBaseUrl()}/v1/security/events`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        keepalive: JSON.stringify(payload).length < 60000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  function requestLocationForSecurity(options) {
    const settings = options || {};
    if (!navigator.geolocation) {
      return Promise.resolve(null);
    }

    if (App.privacy && typeof App.privacy.getLocation === "function") {
      return App.privacy.getLocation({
        highAccuracy: Boolean(settings.highAccuracy),
        timeout: Number(settings.timeout || 8000),
        maximumAge: Number(settings.maximumAge || 5 * 60 * 1000),
        prompt: Boolean(settings.prompt)
      }).then(async (location) => {
        if (!location) return null;
        lastKnownLocation = location;
        if (settings.recordAction) {
          await record({
            category: "location_consent",
            action: settings.recordAction,
            severity: "info",
            locationConsent: true,
            location: lastKnownLocation,
            evidenceTags: ["location_permission"],
            metadata: {
              reason: cleanText(settings.reason || "security_verification", 120)
            }
          });
        }
        return lastKnownLocation;
      });
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          lastKnownLocation = normalizeLocation(position);
          if (settings.recordAction) {
            await record({
              category: "location_consent",
              action: settings.recordAction,
              severity: "info",
              locationConsent: true,
              location: lastKnownLocation,
              evidenceTags: ["location_permission"],
              metadata: {
                reason: cleanText(settings.reason || "security_verification", 120)
              }
            });
          }
          resolve(lastKnownLocation);
        },
        () => resolve(null),
        {
          enableHighAccuracy: Boolean(settings.highAccuracy),
          timeout: Number(settings.timeout || 8000),
          maximumAge: Number(settings.maximumAge || 5 * 60 * 1000)
        }
      );
    });
  }

  function bindDeclarativeAudit() {
    document.addEventListener("submit", (event) => {
      const target = event.target.closest("[data-audit-action]");
      if (!target) return;
      void record({
        category: target.getAttribute("data-audit-category") || "fraud_signal",
        action: target.getAttribute("data-audit-action"),
        resourceType: target.getAttribute("data-audit-resource-type") || "",
        resourceId: target.getAttribute("data-audit-resource-id") || "",
        evidenceTags: ["declarative_form"],
        metadata: { event_type: "submit" }
      });
    }, true);

    document.addEventListener("click", (event) => {
      const target = event.target.closest("button[data-audit-action], a[data-audit-action]");
      if (!target) return;
      void record({
        category: target.getAttribute("data-audit-category") || "fraud_signal",
        action: target.getAttribute("data-audit-action"),
        resourceType: target.getAttribute("data-audit-resource-type") || "",
        resourceId: target.getAttribute("data-audit-resource-id") || "",
        evidenceTags: ["declarative_click"],
        metadata: { event_type: "click" }
      });
    }, true);
  }

  App.complianceAudit = {
    record,
    requestLocationForSecurity,
    lastKnownLocation: () => lastKnownLocation
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindDeclarativeAudit);
  } else {
    bindDeclarativeAudit();
  }
})();
