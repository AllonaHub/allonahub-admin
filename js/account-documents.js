(function () {
  "use strict";
  const App = window.Allona = window.Allona || {};
  const sync = window.AllonaProfileSync;
  const client = sync?.createClient?.();
  const bucket = "account-documents";
  const legacyKey = "allonahub_user_documents_v1";
  const fileTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  const $ = (selector) => document.querySelector(selector);

  function status(message, type = "info") {
    const target = $("[data-document-status]");
    if (target && App.core?.renderStatus) App.core.renderStatus(target, message, type);
    else if (target) target.textContent = message;
  }

  function escapeHtml(value) {
    const span = document.createElement("span");
    span.textContent = String(value ?? "");
    return span.innerHTML;
  }

  function validate(file) {
    if (!(file instanceof File) || !file.size) throw new Error("Lütfen belge dosyası seçin.");
    if (!fileTypes.has(file.type)) throw new Error("Belge PDF, JPEG, PNG veya WebP olmalıdır.");
    if (file.size > 8388608) throw new Error("Belge en fazla 8 MB olabilir.");
  }

  function oldRows(userId) {
    try {
      const all = JSON.parse(localStorage.getItem(legacyKey) || "{}");
      return Array.isArray(all[`user:${userId}`]) ? all[`user:${userId}`] : [];
    } catch (error) { return []; }
  }

  function forgetOldRow(userId, id) {
    try {
      const all = JSON.parse(localStorage.getItem(legacyKey) || "{}");
      all[`user:${userId}`] = oldRows(userId).filter((row) => row.id !== id);
      localStorage.setItem(legacyKey, JSON.stringify(all));
    } catch (error) { /* The original browser copy remains intact. */ }
  }

  function oldFile(id) {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      const request = indexedDB.open("allonahub_user_documents_db", 1);
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("files")) { db.close(); return resolve(null); }
        const read = db.transaction("files", "readonly").objectStore("files").get(id);
        read.onsuccess = () => { db.close(); resolve(read.result?.file || null); };
        read.onerror = () => { db.close(); resolve(null); };
      };
    });
  }

  async function list(userId) {
    const { data, error } = await client.from("account_documents")
      .select("id,document_type,title,note,file_name,file_type,file_size_bytes,storage_path,status,created_at,legacy_local_id")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  }

  async function save(user, entry, legacyId = null) {
    const file = entry.file;
    validate(file);
    const id = crypto.randomUUID();
    const path = `${user.id}/${id}`;
    const uploaded = await client.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) throw uploaded.error;
    const { data, error } = await client.from("account_documents").insert({
      id, user_id: user.id, document_type: entry.type, title: entry.title,
      note: entry.note || "", file_name: file.name.slice(0, 180),
      file_type: file.type, file_size_bytes: file.size, storage_path: path,
      legacy_local_id: legacyId
    }).select("id,document_type,title,note,file_name,file_type,file_size_bytes,storage_path,status,created_at,legacy_local_id").single();
    if (error) {
      await client.storage.from(bucket).remove([path]);
      throw error;
    }
    return data;
  }

  async function migrate(user, existing) {
    const imported = new Set(existing.map((row) => row.legacy_local_id).filter(Boolean));
    let failed = 0;
    for (const record of oldRows(user.id)) {
      if (!record?.id) continue;
      if (imported.has(record.id)) { forgetOldRow(user.id, record.id); continue; }
      const file = await oldFile(record.id);
      if (!file) { failed += 1; continue; }
      try {
        await save(user, {
          file, type: record.type, title: String(record.title || file.name).slice(0, 160),
          note: String(record.note || "").slice(0, 1000)
        }, record.id);
        forgetOldRow(user.id, record.id);
      } catch (error) { failed += 1; }
    }
    if (failed) status(`${failed} eski belge aktarılamadı. Bu cihazdaki kayıtlar korunmuştur; dosyaları yeniden yükleyin.`, "warning");
  }

  function render(rows) {
    const target = $("[data-document-list]");
    if (!target) return;
    if (!rows.length) { target.innerHTML = '<div class="empty-state">Hesabınızda henüz belge yok.</div>'; return; }
    target.innerHTML = rows.map((row) => `<article class="document-row">
      <i class="fa-solid fa-file-shield" aria-hidden="true"></i>
      <span><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.file_name)} · ${Math.ceil(row.file_size_bytes / 1024)} KB</p></span>
      <small><span class="document-status is-approved">Hesapta saklandı</span><br>
      ${new Date(row.created_at).toLocaleDateString("tr-TR")}<br>
      <button class="btn btn--light" type="button" data-open-document="${row.id}">Aç</button>
      <button class="btn btn--light" type="button" data-delete-document="${row.id}">Sil</button>
      </small></article>`).join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!$("[data-page='documents']")) return;
    if (!client || !sync) { status("Sunucu bağlantısı kurulamadı. Belge yükleme kapalıdır.", "error"); return; }
    const access = await App.auth?.requireAccountType?.("customer", { redirect: true });
    if (!access) return;
    const loaded = await sync.load(client);
    if (!loaded?.user) { location.href = "user.html"; return; }
    const user = loaded.user;
    if (sync.isMaritimeProfile(loaded.profile || {})) {
      location.replace("../ecosystem/maritime-documents.html");
      return;
    }
    const form = $("[data-document-form]");
    const submit = form?.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    let rows = [];
    try {
      rows = await list(user.id);
      await migrate(user, rows);
      rows = await list(user.id);
      render(rows);
      if (submit) submit.disabled = false;
    } catch (error) {
      status("Belgeler sunucudan okunamadı. Bağlantı düzelene kadar belge gönderilemez.", "error");
      return;
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fields = new FormData(form);
      const type = String(fields.get("type") || "");
      const title = String(fields.get("title") || "").trim();
      try {
        if (!title || title.length > 160) throw new Error("Belge başlığını kontrol edin.");
        if (/cv|özgeçmiş|resume/i.test(title)) throw new Error("CV için CV merkezini kullanın.");
        if (["passport_seafarer", "stcw", "medical_maritime"].includes(type)) throw new Error("Denizcilik belgeleri için Denizcilik Belge Merkezi'ni kullanın.");
        if (rows.length >= 20) throw new Error("Bu alanda en fazla 20 belge saklanabilir. Yeni belge eklemek için eski bir belgeyi silin.");
        if (submit) submit.disabled = true;
        await save(user, { type, title, note: String(fields.get("note") || "").trim().slice(0, 1000), file: fields.get("file") });
        rows = await list(user.id);
        render(rows);
        form.reset();
        status("Belge güvenli hesabınıza kaydedildi. Başka cihazdan da erişebilirsiniz.", "success");
      } catch (error) {
        status(error.message || "Belge sunucuya kaydedilemedi.", "error");
      } finally { if (submit) submit.disabled = false; }
    });

    document.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-open-document]");
      const remove = event.target.closest("[data-delete-document]");
      if (!open && !remove) return;
      const id = open?.dataset.openDocument || remove?.dataset.deleteDocument;
      const row = rows.find((item) => item.id === id);
      if (!row) return;
      try {
        if (open) {
          const { data, error } = await client.storage.from(bucket).createSignedUrl(row.storage_path, 60, { download: row.file_name });
          if (error || !data?.signedUrl) throw error || new Error("Belge bağlantısı oluşturulamadı.");
          const link = document.createElement("a");
          link.href = data.signedUrl;
          link.download = row.file_name;
          link.rel = "noopener noreferrer";
          link.click();
        } else if (confirm("Bu belgeyi hesabınızdan silmek istiyor musunuz?")) {
          const removed = await client.storage.from(bucket).remove([row.storage_path]);
          if (removed.error) throw removed.error;
          const deleted = await client.from("account_documents").delete().eq("id", id).eq("user_id", user.id);
          if (deleted.error) throw deleted.error;
          rows = await list(user.id);
          render(rows);
          status("Belge silindi.", "success");
        }
      } catch (error) { status(error.message || "İşlem tamamlanamadı.", "error"); }
    });
  });
})();
