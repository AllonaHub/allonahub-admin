(function () {
  const App = window.Allona = window.Allona || {};
  const core = App.core || {};
  const sync = window.AllonaProfileSync;
  const client = sync && sync.createClient ? sync.createClient() : null;
  const storageKey = "allonahub_user_documents_v1";
  const dbName = "allonahub_user_documents_db";
  const maritimeTypes = [
    { value: "passport_seafarer", label: "Pasaport / Denizci Belgesi" },
    { value: "stcw", label: "STCW / Denizcilik Sertifikası" },
    { value: "medical_maritime", label: "Denizci Sağlık Uygunluk Belgesi" }
  ];

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

  function esc(value) {
    return core.escapeHTML ? core.escapeHTML(value || "") : String(value || "");
  }

  function userKey(user) {
    return user && user.id ? `user:${user.id}` : "guest";
  }

  function setStatus(message, type) {
    const target = $("[data-document-status]");
    if (!target) return;
    if (core.renderStatus) {
      core.renderStatus(target, message, type || "info");
      return;
    }
    target.textContent = message || "";
  }

  function readDocuments(user) {
    const store = safeJson(storageKey, {});
    const list = store[userKey(user)];
    return Array.isArray(list) ? list : [];
  }

  function writeDocuments(user, docs) {
    const store = safeJson(storageKey, {});
    store[userKey(user)] = (Array.isArray(docs) ? docs : []).slice(0, 80);
    localStorage.setItem(storageKey, JSON.stringify(store));
  }

  function openDocumentDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("Tarayıcı dosya saklama alanı desteklenmiyor."));
        return;
      }
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function storeDocumentFile(id, file) {
    const db = await openDocumentDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put({ id, file, name: file.name, type: file.type, saved_at: new Date().toISOString() });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async function getDocumentFile(id) {
    const db = await openDocumentDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readonly");
      const request = tx.objectStore("files").get(id);
      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }

  function labelFor(type) {
    const labels = {
      certificate: "Sertifika / Yeterlilik",
      health: "Sağlık / Uygunluk Belgesi",
      diploma: "Diploma / Eğitim Belgesi",
      professional: "Mesleki Belge",
      contract: "Sözleşme / Başvuru Belgesi",
      passport_seafarer: "Pasaport / Denizci Belgesi",
      stcw: "STCW / Denizcilik Sertifikası",
      medical_maritime: "Denizci Sağlık Uygunluk Belgesi"
    };
    return labels[type] || "Belge";
  }

  function statusLabel(status) {
    if (status === "approved") return "Onaylandı";
    if (status === "rejected") return "Reddedildi";
    return "Onay Bekliyor";
  }

  function statusClass(status) {
    if (status === "approved") return "is-approved";
    if (status === "rejected") return "is-rejected";
    return "";
  }

  function renderDocuments(user) {
    const target = $("[data-document-list]");
    if (!target) return;
    const docs = readDocuments(user);
    if (!docs.length) {
      target.innerHTML = `<div class="empty-state">Henüz belge yüklenmedi. İlk belgeni yukarıdaki formdan onaya gönderebilirsin.</div>`;
      return;
    }
    target.innerHTML = docs.map((doc) => `
      <article class="document-row">
        <i class="fa-solid ${doc.type === "health" || doc.type === "medical_maritime" ? "fa-file-medical" : "fa-file-lines"}"></i>
        <span>
          <h3>${esc(doc.title || labelFor(doc.type))}</h3>
          <p>${esc(labelFor(doc.type))} · ${esc(doc.file_name || "Dosya")} · ${doc.share_with_partners ? "Partner paylaşım izni açık" : "Partner paylaşım izni kapalı"}</p>
        </span>
        <small>
          <span class="document-status ${statusClass(doc.status)}">${statusLabel(doc.status)}</span><br>
          ${doc.created_at ? new Date(doc.created_at).toLocaleDateString("tr-TR") : ""}<br>
          <button class="btn btn--light" type="button" data-open-document="${esc(doc.id)}">Aç</button>
        </small>
      </article>
    `).join("");
  }

  function configureForProfile(profile) {
    const typeSelect = $("[data-document-type]");
    if (!typeSelect) return;
    const isMaritime = sync && sync.isMaritimeProfile ? sync.isMaritimeProfile(profile) : false;
    maritimeTypes.forEach((item) => {
      if (!isMaritime) return;
      if (typeSelect.querySelector(`option[value="${item.value}"]`)) return;
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      typeSelect.appendChild(option);
    });
    const cvLink = $("[data-cv-center-link]");
    if (cvLink && sync && sync.cvTarget) cvLink.href = sync.cvTarget(profile);
  }

  async function createReviewTicket(user, profile, doc) {
    if (!client || !user) return null;
    try {
      const { data, error } = await client
        .from("support_tickets")
        .insert({
          user_id: user.id,
          title: `Belge onayı: ${doc.title}`,
          message: `${labelFor(doc.type)} onay incelemesi bekliyor.`,
          category: "document_review",
          priority: "normal",
          status: "open",
          metadata: {
            document_id: doc.id,
            document_type: doc.type,
            file_name: doc.file_name,
            sector_key: profile.sector_key || "",
            profession_key: profile.profession_key || "",
            share_with_partners: Boolean(doc.share_with_partners)
          }
        })
        .select("id, status, created_at")
        .maybeSingle();
      if (error) throw error;
      return data || null;
    } catch (error) {
      console.warn("Belge onay talebi Supabase'e yazılamadı:", error.message || error);
      return null;
    }
  }

  function validateFile(file) {
    if (!file) throw new Error("Lütfen belge dosyası seçin.");
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) throw new Error("Belge PDF, JPEG, PNG veya WebP formatında olmalıdır.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Belge dosyası en fazla 8 MB olabilir.");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector("[data-page='documents']")) return;
    if (!client || !sync) {
      setStatus("Belge merkezi için profil bağlantısı hazırlanamadı.", "error");
      return;
    }
    const loaded = await sync.load(client);
    if (!loaded || !loaded.user) {
      window.location.href = "user.html";
      return;
    }
    const user = loaded.user;
    const profile = loaded.profile || {};
    configureForProfile(profile);
    renderDocuments(user);

    const form = $("[data-document-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const file = formData.get("file");
      const title = String(formData.get("title") || "").trim();
      const type = String(formData.get("type") || "").trim();
      const isMaritime = sync.isMaritimeProfile(profile);

      try {
        if (!title) throw new Error("Belge başlığı zorunludur.");
        validateFile(file);
        if (/cv|özgeçmiş|resume/i.test(title) || type === "cv") {
          throw new Error("CV yükleme bu alanda kapalıdır. Lütfen CV merkezini kullanın.");
        }
        if (["passport_seafarer", "stcw", "medical_maritime"].includes(type) && !isMaritime) {
          throw new Error("Bu belge türü yalnızca denizcilik profilleri için açıktır.");
        }

        const doc = {
          id: `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          type,
          title,
          note: String(formData.get("note") || "").trim(),
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          status: "pending",
          share_with_partners: formData.get("share_with_partners") === "on",
          sector_key: profile.sector_key || "",
          profession_key: profile.profession_key || "",
          created_at: new Date().toISOString()
        };
        try {
          await storeDocumentFile(doc.id, file);
          doc.file_saved_local = true;
        } catch (fileError) {
          console.warn("Belge dosyası yerel saklama alanına yazılamadı:", fileError.message || fileError);
        }
        const ticket = await createReviewTicket(user, profile, doc);
        if (ticket && ticket.id) doc.review_ticket_id = ticket.id;
        writeDocuments(user, [doc, ...readDocuments(user)]);
        form.reset();
        renderDocuments(user);
        setStatus("Belge onaya gönderildi. Onaylanmadan partnerlerle paylaşılmaz.", "success");
      } catch (error) {
        setStatus(error.message || "Belge yüklenemedi.", "error");
      }
    });

    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-open-document]");
      if (!button) return;
      try {
        const record = await getDocumentFile(button.dataset.openDocument);
        if (!record || !record.file) throw new Error("Belge dosyası bu cihazda bulunamadı.");
        const url = URL.createObjectURL(record.file);
        window.open(url, "_blank", "noopener");
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      } catch (error) {
        setStatus(error.message || "Belge açılamadı.", "error");
      }
    });
  });
})();
