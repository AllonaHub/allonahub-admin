(function () {
  const App = window.Allona = window.Allona || {};
  const sync = window.AllonaProfileSync;
  const client = sync && sync.createClient ? sync.createClient() : null;
  const awardStoreKey = "allonahub_task_awards_v1";
  const profileAwardId = "task:profile-complete";
  const profileReward = { hp: 20, xp: 80 };

  function $(selector) {
    return document.querySelector(selector);
  }

  function safeJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function userKey(user) {
    return user && user.id ? `user:${user.id}` : "guest";
  }

  function esc(value) {
    return App.core && App.core.escapeHTML ? App.core.escapeHTML(value || "") : String(value || "");
  }

  function setStatus(message, type) {
    const target = $("[data-task-status]");
    if (!target) return;
    if (App.core && App.core.renderStatus) {
      App.core.renderStatus(target, message, type || "info");
      return;
    }
    target.textContent = message || "";
  }

  function profileSteps(profile) {
    return [
      { key: "full_name", label: "Ad soyad bilgisi", done: Boolean(String(profile.full_name || "").trim()) },
      { key: "phone", label: "Telefon bilgisi", done: Boolean(String(profile.phone || "").trim()) },
      { key: "country", label: "Ülke seçimi", done: Boolean(String(profile.country || "").trim()) },
      { key: "city", label: "Şehir seçimi", done: Boolean(String(profile.city || "").trim()) },
      {
        key: "profession",
        label: "Sektör ve meslek seçimi",
        done: Boolean(profile.profession_key && profile.profession_key !== "other_profession" && profile.sector_key)
      },
      { key: "bio", label: "Kısa profil açıklaması", done: String(profile.bio || "").trim().length >= 12 }
    ];
  }

  function hasAward(user) {
    const store = safeJson(awardStoreKey, {});
    const list = store[userKey(user)];
    if (Array.isArray(list) && list.includes(profileAwardId)) return true;
    return sync && sync.hasHpLedgerEntry ? sync.hasHpLedgerEntry(user, profileAwardId) : false;
  }

  function markAward(user) {
    try {
      const store = safeJson(awardStoreKey, {});
      const key = userKey(user);
      store[key] = Array.from(new Set([...(Array.isArray(store[key]) ? store[key] : []), profileAwardId]));
      localStorage.setItem(awardStoreKey, JSON.stringify(store));
    } catch (error) {
      // Ledger prevents repeated awards even if local marker cannot be written.
    }
  }

  function renderProfileTask(loaded) {
    const profile = loaded.profile || {};
    const steps = profileSteps(profile);
    const done = steps.filter((step) => step.done).length;
    const complete = done === steps.length;
    const awarded = hasAward(loaded.user);
    const card = $("[data-profile-task-card]");
    const count = $("[data-profile-task-count]");
    const awardState = $("[data-profile-award-state]");
    const progress = $("[data-profile-task-progress]");
    const list = $("[data-profile-task-steps]");
    const button = $("[data-claim-profile-award]");

    if (count) count.textContent = `${done}/${steps.length}`;
    if (awardState) awardState.textContent = awarded ? "Alındı" : (complete ? "Hazır" : "Bekliyor");
    if (progress) progress.style.width = `${Math.round((done / Math.max(1, steps.length)) * 100)}%`;
    if (card) {
      card.classList.toggle("is-done", awarded);
      card.classList.toggle("is-locked", !complete);
    }
    if (list) {
      list.innerHTML = steps.map((step) => `
        <li class="${step.done ? "is-complete" : ""}">
          <i class="fa-solid ${step.done ? "fa-circle-check" : "fa-circle"}"></i>
          <span>${esc(step.label)}</span>
        </li>
      `).join("");
    }
    if (button) {
      button.disabled = !complete || awarded;
      button.textContent = awarded ? "Ödül Alındı" : (complete ? "Ödülü Al" : "Adımlar Eksik");
      button.dataset.ready = complete && !awarded ? "true" : "false";
    }
  }

  async function claimProfileAward(loaded) {
    if (!loaded || !loaded.user) return;
    const steps = profileSteps(loaded.profile || {});
    if (!steps.every((step) => step.done)) {
      setStatus("Profil ödülü için tüm profil adımlarını tamamlamalısın.", "warning");
      return;
    }
    if (hasAward(loaded.user)) {
      setStatus("Profil tamamlama ödülü daha önce işlenmiş.", "success");
      renderProfileTask(loaded);
      return;
    }
    if (!client || !sync || !sync.updateEconomy) {
      setStatus("Ödül işlemek için profil senkronu hazırlanamadı.", "error");
      return;
    }

    try {
      const updated = await sync.updateEconomy(client, {
        hp: profileReward.hp,
        xp: profileReward.xp,
        cashout_balance: profileReward.hp
      });
      if (sync.recordHpLedger) {
        sync.recordHpLedger(loaded.user, {
          id: profileAwardId,
          bucket: "daily",
          title: "Profil tamamlama ödülü",
          source: "Görevler",
          amount: profileReward.hp,
          note: "Tüm profil adımları tamamlandığında tek sefer işlenir."
        });
      }
      markAward(loaded.user);
      loaded.profile = updated;
      renderProfileTask(loaded);
      setStatus(`Profil ödülü işlendi: +${profileReward.hp} HP ve +${profileReward.xp} XP.`, "success");
    } catch (error) {
      console.error("Profil ödülü işlenemedi:", error);
      setStatus("Profil ödülü güvenli şekilde işlenemedi.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector("[data-page='account-tasks']")) return;
    if (!client || !sync) {
      setStatus("Görevleri görmek için profil bağlantısı hazırlanamadı.", "error");
      return;
    }

    try {
      const loaded = await sync.load(client);
      if (!loaded || !loaded.user) {
        window.location.href = "user.html";
        return;
      }
      renderProfileTask(loaded);
      const button = $("[data-claim-profile-award]");
      if (button) button.addEventListener("click", () => claimProfileAward(loaded));
    } catch (error) {
      console.error("Görevler yüklenemedi:", error);
      setStatus("Görevler şu anda yüklenemedi. Profil sayfasından bilgilerini kontrol edebilirsin.", "error");
    }
  });
})();
