(function () {
  "use strict";
  const App = window.Allona = window.Allona || {};
  const state = { session: null, data: null, partnerId: "", activePanel: "", lastFocus: null, pendingLogoPath: null, finance: null, selectedRoomId: "", routeSync: false, candidateFilters: {} };
  const titles = { jobs: "Şirket İlanları", "job-create": "Yeni İlan Oluştur", vessels: "Gemilerim", "vessel-create": "Gemi Ekle", candidates: "Yetkili Adaylar", "candidate-detail": "Aday Detayı", applications: "Başvurular ve İşe Alım Dosyaları", notifications: "Şirket Bildirimleri", finance: "Finans ve Faturalandırma", company: "Şirket Hesabı", verification: "Doğrulama Şartları", refresh: "Havuzu Güncelle", evidence: "Kanıt Kontrolü", sla: "Süreç Süreleri", handover: "Dosya Devri", review: "Güvenli İnceleme", references: "Doğrulanmış Referans", governance: "Karar ve Değer Merkezi", "ready-pool": "Hazır Aday Havuzu", matches: "Akıllı Eşleşmeler", urgent: "Acil Personel ve Replacement", pending: "Bekleyen İşlemler", pipeline: "Hiring Pipeline", interviews: "Görüşmeler", offers: "Teklifler ve Kontratlar", "active-crew": "Aktif Mürettebat", relief: "Relief ve Rehire" };
  const templates = { jobs: "mpJobsTemplate", "job-create": "mpJobCreateTemplate", vessels: "mpVesselsTemplate", "vessel-create": "mpVesselCreateTemplate", candidates: "mpCandidatesTemplate", "candidate-detail": "mpPersonnelDataTemplate", applications: "mpApplicationsTemplate", notifications: "mpNotificationsTemplate", finance: "mpFinanceTemplate", company: "mpCompanyTemplate", verification: "mpVerificationTemplate", refresh: "mpRefreshTemplate", evidence: "mpEvidenceTemplate", sla: "mpSlaTemplate", handover: "mpHandoverTemplate", review: "mpReviewTemplate", references: "mpReferencesTemplate", governance: "mpGovernanceTemplate", "ready-pool": "mpReadyPoolTemplate", matches: "mpPersonnelDataTemplate", pending: "mpPersonnelDataTemplate", pipeline: "mpPersonnelDataTemplate", interviews: "mpPersonnelDataTemplate", offers: "mpPersonnelDataTemplate", "active-crew": "mpPersonnelDataTemplate", relief: "mpPersonnelDataTemplate", urgent: "mpUrgentTemplate" };
  const standalonePanels = new Set(["jobs", "job-create", "vessels", "vessel-create", "candidates", "applications", "notifications", "finance", "company", "verification"]);
  const legacyViewAliases = Object.freeze({ hiring: "pipeline", "smart-matches": "matches", candidates: "ready-pool", "urgent-crew": "urgent", "crew-matrix": "active-crew", "crew-pool": "ready-pool", interviews: "interviews", "offers-contracts": "offers", "active-crew": "active-crew", "relief-rehire": "relief", references: "references", verification: "verification", team: "company", analytics: "governance" });
  const referenceCategories = [
    ["professional_competence", "Mesleki yeterlilik"], ["safety_awareness", "Emniyet farkındalığı"], ["rule_compliance", "Kural uyumu"],
    ["teamwork", "Ekip çalışması"], ["communication", "İletişim"], ["reliability", "Güvenilirlik"], ["punctuality", "Dakiklik"],
    ["problem_solving", "Problem çözme"], ["leadership", "Liderlik"], ["technical_knowledge", "Teknik bilgi"], ["equipment_care", "Ekipman özeni"],
    ["watchkeeping", "Vardiya disiplini"], ["stress_management", "Stres yönetimi"], ["adaptability", "Uyum"], ["rehire_willingness", "Yeniden çalışma isteği"]
  ];
  const referenceQuestions = [
    ["employment_confirmed", "Adayın şirkette çalıştığını doğruluyor musunuz?"], ["rank_confirmed", "Beyan edilen görev/rütbe doğru mu?"],
    ["service_dates_confirmed", "Hizmet tarihleri doğru mu?"], ["completed_contract", "Kontratını tamamladı mı?"], ["eligible_for_rehire", "Yeniden işe almayı değerlendirir misiniz?"]
  ];
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function escape(value) {
    const node = document.createElement("span");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  function apiBase() {
    if (/^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) return "http://localhost:3000";
    return String(App.config?.apiBaseUrl || "https://api.allonahub.com").replace(/\/$/, "");
  }

  async function api(path, options) {
    const settings = options || {};
    const response = await fetch(`${apiBase()}${path}`, {
      method: settings.method || "GET",
      headers: { Accept: "application/json", ...(settings.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${state.session.access_token}` },
      body: settings.body ? JSON.stringify(settings.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      const error = new Error(payload.message || "İşlem tamamlanamadı.");
      error.status = response.status;
      error.code = payload.error || "REQUEST_ERROR";
      throw error;
    }
    return payload;
  }

  function alert(message, tone) {
    const target = $("[data-mp-alert]");
    target.hidden = !message;
    target.classList.toggle("is-success", tone === "success");
    target.textContent = message || "";
    if (message) target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function dateTime(value) {
    if (!value) return "-";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
  }

  function toInputDate(value) {
    const date = new Date(value || Date.now() + 7 * 86400000);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function selectedValues(form, name) {
    return $$(`[name="${name}"]:checked`, form).map((item) => item.value);
  }

  function option(value, label) {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = label;
    return item;
  }

  function initials(value) {
    return String(value || "MP").split(/\s+/).filter(Boolean).map((item) => item[0]).join("").slice(0, 2).toLocaleUpperCase("tr-TR");
  }

  function clientId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
      const random = Math.floor(Math.random() * 16);
      return (character === "x" ? random : (random & 3) | 8).toString(16);
    });
  }

  function statusLabel(value) {
    return ({ draft: "Taslak", unverified: "Doğrulanmadı", partner_asserted: "Doğrulama bekliyor", pending_review: "Onay bekliyor", verified: "Doğrulandı", active: "Yayında", open: "Açık", paused: "Duraklatıldı", rejected: "Düzeltme gerekli", archived: "Arşivlendi", closed: "Kapandı", cancelled: "İptal", filled: "Pozisyon doldu", offer: "Teklif aşaması", hired: "İşe alındı" })[value] || value || "Bekliyor";
  }

  function relationshipLabel(value) {
    return ({ owner: "Gemi sahibi", manager: "Teknik yönetici", operator: "İşletmeci", crewing_agent: "Personel acentesi", employer: "İşveren", authorized_representative: "Yetkili temsilci" })[value] || value || "Şirket ilişkisi";
  }

  function candidateLabel(room) {
    const name = room.candidate?.full_name || room.candidate?.public_id || "Aday";
    return `${name} · ${room.status}`;
  }

  function fillJobs(root, includeAll) {
    $$('[data-mp-form-jobs]', root).forEach((select) => {
      const first = select.options[0] ? select.options[0].cloneNode(true) : null;
      select.replaceChildren(...(first ? [first] : []));
      (state.data.jobs || []).forEach((job) => select.append(option(job.id, `${job.job_reference} · ${job.job_title}`)));
    });
    const filter = $("[data-mp-job-filter]");
    if (filter && includeAll) {
      const current = filter.value;
      filter.replaceChildren(option("", "Tüm ilanlar"));
      (state.data.jobs || []).forEach((job) => filter.append(option(job.id, `${job.job_reference} · ${job.job_title}`)));
      filter.value = current;
    }
  }

  function fillCandidates(root) {
    $$('[data-mp-candidate-options]', root).forEach((select) => {
      select.replaceChildren(option("", "Aday seçin"));
      (state.data.candidate_rooms || []).forEach((room) => select.append(option(room.id, candidateLabel(room))));
    });
    const list = $("[data-mp-form-candidates]", root);
    if (list) {
      if (!(state.data.candidate_rooms || []).length) list.innerHTML = '<div class="mp-empty">Yetkili özel aday odası bulunmuyor.</div>';
      else list.innerHTML = state.data.candidate_rooms.map((room) => `<label class="mp-check"><input type="checkbox" name="candidate_room_ids" value="${escape(room.id)}"> ${escape(candidateLabel(room))}</label>`).join("");
    }
  }

  function fillTeam(root) {
    $$('[data-mp-team-options]', root).forEach((select) => {
      const first = select.options[0] ? select.options[0].cloneNode(true) : null;
      select.replaceChildren(...(first ? [first] : []));
      (state.data.team || []).forEach((member) => select.append(option(member.user_id, `${member.full_name} · ${member.role}`)));
    });
  }

  function fillHiringRooms(root) {
    $$('[data-mp-hiring-options]', root).forEach((select) => {
      select.replaceChildren(option("", "Açık dosya seçin"));
      const seen = new Set();
      (state.data.candidate_rooms || []).forEach((room) => {
        if (!room.hiring_room_id || seen.has(room.hiring_room_id)) return;
        seen.add(room.hiring_room_id);
        const job = (state.data.jobs || []).find((item) => item.id === room.job_id);
        select.append(option(room.hiring_room_id, `${job?.job_reference || "Dosya"} · ${job?.job_title || candidateLabel(room)}`));
      });
    });
  }

  function fillVessels(root) {
    $$('[data-mp-vessel-options]', root).forEach((select) => {
      const first = select.options[0] ? select.options[0].cloneNode(true) : null;
      select.replaceChildren(...(first ? [first] : []));
      (state.data.vessels || []).forEach((vessel) => select.append(option(vessel.id, `${vessel.vessel_name} · IMO ${vessel.imo_number}`)));
    });
  }

  function candidateFacts(room) {
    const candidate = room.candidate || {};
    return [
      candidate.rank,
      candidate.current_work_status === "available_now" ? "Ready-to-Join" : null,
      candidate.sea_service_days ? `${candidate.sea_service_days} gün deniz hizmeti` : candidate.sea_service_count ? `${candidate.sea_service_count} deniz hizmeti` : null,
      candidate.vessel_types?.[0],
      candidate.availability_updated_at ? `Güncel: ${dateTime(candidate.availability_updated_at)}` : null
    ].filter(Boolean);
  }

  function historyCard(title, detail, meta, className, action) {
    return `<article class="${escape(className || "")}"><strong>${escape(title)}</strong><span>${escape(detail || "")}</span><small>${escape(meta || "")}</small>${action || ""}</article>`;
  }

  function setAvatar(target, business) {
    if (!target) return;
    const name = business?.display_name || "MariPartner";
    target.innerHTML = business?.logo_url ? `<img src="${escape(business.logo_url)}" alt="">` : escape(initials(name));
  }

  function roomForUser(userId, jobId) {
    return (state.data.candidate_rooms || []).find((room) => room.seafarer_user_id === userId && (!jobId || !room.job_id || room.job_id === jobId));
  }

  function personnelEmpty(text) {
    return `<div class="mp-empty">${escape(text)}</div>`;
  }

  function personnelCandidateCard(room, match) {
    const job = (state.data.jobs || []).find((item) => item.id === (match?.job_id || room.job_id));
    const score = match?.preference_score === null || match?.preference_score === undefined ? "" : `${Math.round(Number(match.preference_score))}% eşleşme`;
    const favorite = (state.data.favorite_candidates || []).some((item) => item.seafarer_user_id === room.seafarer_user_id);
    return `<article class="mp-candidate-card"><div><strong>${escape(room.candidate?.full_name || room.candidate?.public_id || "Aday")}</strong><span>${escape(job?.job_title || room.candidate?.rank || "Denizcilik adayı")}</span><div class="mp-candidate-card__facts">${[...candidateFacts(room), score].filter(Boolean).map((fact) => `<span>${escape(fact)}</span>`).join("")}</div></div><div class="mp-candidate-card__actions"><button type="button" data-mp-candidate-inspect="${escape(room.id)}">Adayı İncele</button><button type="button" data-mp-candidate-invite="${escape(room.id)}" data-job-id="${escape(match?.job_id || room.job_id || "")}" ${match?.job_id || room.job_id ? "" : "disabled"}>Davet Et</button><details class="mp-more"><summary aria-label="Aday için diğer işlemleri aç">⋮</summary><div role="menu"><button type="button" role="menuitem" data-mp-candidate-inspect="${escape(room.id)}">Eşleşme Nedenini Gör</button><button type="button" role="menuitem" data-mp-candidate-favorite="${escape(room.id)}" ${favorite ? "disabled" : ""}>${favorite ? "Favorilerde" : "Favoriye Ekle"}</button><button type="button" role="menuitem" data-mp-panel="references">Firma Referanslarını Gör</button></div></details></div></article>`;
  }

  function normalizeSearchValue(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase("tr-TR").trim();
  }

  function readyPoolRooms() {
    const filters = state.candidateFilters || {};
    return (state.data.candidate_rooms || []).filter((room) => {
      const candidate = room.candidate || {};
      if (filters.rank && !normalizeSearchValue(candidate.rank).includes(normalizeSearchValue(filters.rank))) return false;
      if (filters.vessel_type && !(candidate.vessel_types || []).some((value) => normalizeSearchValue(value).includes(normalizeSearchValue(filters.vessel_type)))) return false;
      if (Number(filters.minimum_sea_service_days || 0) > Number(candidate.sea_service_days || 0)) return false;
      if (filters.availability_status && candidate.availability_status !== filters.availability_status) return false;
      if (filters.ready_to_join && !(candidate.current_work_status === "available_now" && candidate.availability_status === "fresh" && candidate.readiness_level === "verified_ready")) return false;
      return true;
    });
  }

  function renderPoolFilter(root) {
    const form = $("[data-mp-pool-filter]", root);
    if (!form) return;
    for (const [key, value] of Object.entries(state.candidateFilters || {})) {
      if (!form.elements[key]) continue;
      if (form.elements[key].type === "checkbox") form.elements[key].checked = Boolean(value);
      else form.elements[key].value = value ?? "";
    }
    const active = Object.entries(state.candidateFilters || {}).filter(([key, value]) => key !== "minimum_sea_service_days" ? Boolean(value) : Number(value) > 0).length;
    $("[data-mp-filter-count]", form).textContent = `${active} aktif filtre`;
    const saved = $("[data-mp-saved-search]", form);
    saved.replaceChildren(option("", "Kayıtlı arama seçin"));
    (state.data.saved_searches || []).forEach((item) => saved.append(option(item.id, item.name)));
  }

  function renderPersonnelData(root, panel) {
    const target = $("[data-mp-personnel-data]", root);
    if (!target) return;
    if (panel === "candidate-detail") {
      const room = (state.data.candidate_rooms || []).find((item) => item.id === state.selectedRoomId);
      if (!room) { target.innerHTML = personnelEmpty("Aday yetkisi bulunamadı veya süresi doldu."); return; }
      const favorite = (state.data.favorite_candidates || []).some((item) => item.seafarer_user_id === room.seafarer_user_id);
      const match = (state.data.matches || []).find((item) => item.seafarer_user_id === room.seafarer_user_id && (!room.job_id || item.job_id === room.job_id));
      const applications = (state.data.applications || []).filter((item) => item.seafarer_user_id === room.seafarer_user_id);
      const interviews = (state.data.interviews || []).filter((item) => item.seafarer_user_id === room.seafarer_user_id);
      const offers = (state.data.offers || []).filter((item) => item.seafarer_user_id === room.seafarer_user_id);
      const tabs = [["overview", "Genel Bakış"], ["eligibility", "Uygunluk"], ["documents", "Belgeler"], ["service", "Deniz Hizmeti"], ["references", "Firma Referansları"], ["interviews", "Görüşmeler"], ["offers", "Teklifler"], ["history", "İşlem Geçmişi"]];
      const cards = (rows, title) => rows.length ? rows.map((item) => historyCard(title, statusLabel(item.status || item.offer_status), dateTime(item.created_at || item.scheduled_start))).join("") : personnelEmpty(`${title} kaydı bulunmuyor.`);
      target.innerHTML = `<section class="mp-candidate-detail"><div class="mp-history-card-head"><div><strong>${escape(room.candidate?.full_name || room.candidate?.public_id || "Aday")}</strong><span>${escape(room.candidate?.rank || "Yeterlilik bilgisi bekleniyor")}</span></div><span class="mp-status-pill is-${escape(room.status)}">${escape(statusLabel(room.status))}</span></div><div class="mp-candidate-tabs" role="tablist" aria-label="Aday detay bölümleri">${tabs.map(([key, label], index) => `<button type="button" role="tab" data-mp-candidate-tab="${key}" aria-selected="${index === 0}">${label}</button>`).join("")}</div><div data-mp-candidate-pane="overview"><div class="mp-candidate-card__facts">${candidateFacts(room).map((fact) => `<span>${escape(fact)}</span>`).join("")}</div><p class="mp-note">Bu görünüm yalnız aktif ve süreli şirket-aday ilişkisi kapsamındaki güvenli özeti gösterir.</p></div><div data-mp-candidate-pane="eligibility" hidden>${match ? historyCard(`${Math.round(Number(match.preference_score || 0))}% açıklanabilir eşleşme`, statusLabel(match.hard_gate_status), `Kural sürümü: ${match.metadata?.rule_version || "kayıtlı sürüm"}`) : personnelEmpty("Bu aday için güncel eşleşme sonucu bulunmuyor.")}</div><div data-mp-candidate-pane="documents" hidden>${historyCard("Belge hazırlığı", statusLabel(room.candidate?.readiness_level), "Hassas belge erişimi ayrıca amaç, süre ve audit kontrolü gerektirir.")}</div><div data-mp-candidate-pane="service" hidden>${historyCard("Deniz hizmeti özeti", `${room.candidate?.sea_service_days || 0} gün · ${room.candidate?.sea_service_count || 0} kayıt`, (room.candidate?.vessel_types || []).join(", ") || "Gemi türü kaydı yok")}</div><div data-mp-candidate-pane="references" hidden>${personnelEmpty("Firmalara özel referanslar yalnız doğrulanmış iş ilişkisi ve audit kaydıyla Güven bölümünde açılır.")}</div><div data-mp-candidate-pane="interviews" hidden>${cards(interviews, "Görüşme")}</div><div data-mp-candidate-pane="offers" hidden>${cards(offers, "Teklif / kontrat")}</div><div data-mp-candidate-pane="history" hidden>${cards(applications, "İşe alım işlemi")}</div><div class="mp-history-actions"><button type="button" data-mp-candidate-invite="${escape(room.id)}" data-job-id="${escape(room.job_id || "")}" ${room.job_id ? "" : "disabled"}>Davet Et</button><button type="button" data-mp-candidate-favorite="${escape(room.id)}" ${favorite ? "disabled" : ""}>${favorite ? "Favorilerde" : "Favoriye Ekle"}</button></div></section>`;
      return;
    }
    if (panel === "ready-pool") {
      const rooms = readyPoolRooms();
      target.innerHTML = `<h3>Yetkili hazır aday havuzu</h3>${rooms.length ? rooms.map((room) => personnelCandidateCard(room)).join("") : personnelEmpty("Seçili filtrelere uygun, erişim yetkisi bulunan aday bulunmuyor.")}`;
      return;
    }
    if (panel === "matches") {
      const rows = (state.data.matches || []).map((match) => ({ match, room: roomForUser(match.seafarer_user_id, match.job_id) })).filter((item) => item.room);
      target.innerHTML = `<h3>Açıklanabilir eşleşmeler</h3>${rows.length ? rows.map(({ room, match }) => personnelCandidateCard(room, match)).join("") : personnelEmpty("Güncel kuralları geçen yetkili eşleşme bulunmuyor.")}`;
      return;
    }
    const collectionMap = {
      pipeline: [state.data.applications || [], "Aktif işe alım dosyası bulunmuyor."],
      interviews: [state.data.interviews || [], "Planlanmış görüşme bulunmuyor."],
      offers: [state.data.offers || [], "Teklif veya kontrat kaydı bulunmuyor."],
      "active-crew": [state.data.work_relationships || [], "Aktif mürettebat kaydı bulunmuyor."],
      relief: [state.data.relief_plans || [], "Yaklaşan relief veya rehire planı bulunmuyor."]
    };
    if (collectionMap[panel]) {
      const [rows, emptyText] = collectionMap[panel];
      target.innerHTML = rows.length ? rows.map((item) => {
        const title = item.offer_status ? `Teklif · ${statusLabel(item.offer_status)}` : item.scheduled_start ? `Görüşme · ${dateTime(item.scheduled_start)}` : item.target_join_date ? `Relief · ${item.target_join_date}` : item.rank_code ? `${item.rank_code} · Aktif çalışma` : `İşe alım · ${statusLabel(item.status)}`;
        return historyCard(title, item.status || item.offer_status || item.verification_status || "Kayıtlı", dateTime(item.created_at));
      }).join("") : personnelEmpty(emptyText);
      return;
    }
    if (panel === "pending") {
      const counters = state.data.counters || {};
      const rows = [["Geciken SLA", counters.overdue_steps, "sla"], ["Bekleyen kanıt", counters.pending_evidence, "evidence"], ["Görüşme bekleyen", counters.pending_interviews, "interviews"], ["Teklif bekleyen", counters.pending_offers, "offers"], ["Referans doğrulaması", counters.pending_reference_matches, "references"]].filter((item) => Number(item[1]) > 0);
      target.innerHTML = rows.length ? rows.map(([title, count, destination]) => `<article><strong>${escape(title)}</strong><span>${escape(count)} işlem</span><div class="mp-history-actions"><button type="button" data-mp-open="${escape(destination)}">İncele</button></div></article>`).join("") : personnelEmpty("Size atanmış bekleyen işlem bulunmuyor.");
    }
  }

  function renderUrgent(root) {
    const target = $("[data-mp-urgent-list]", root);
    if (!target) return;
    const rows = state.data.urgent_crew_requests || [];
    target.innerHTML = `<h3>Acil personel talepleri</h3>${rows.length ? rows.map((item) => historyCard((item.ranks || []).join(", ") || "Acil pozisyon", statusLabel(item.status), `İhtiyaç: ${dateTime(item.needed_by)}`)).join("") : personnelEmpty("Aktif acil personel talebi bulunmuyor.")}`;
    const input = $('input[name="needed_by"]', root);
    if (input && !input.value) input.value = toInputDate(Date.now() + 2 * 86400000);
  }

  async function loadFinance(root) {
    const payload = await api(`/v1/maritime/partner-center/finance?partner_id=${encodeURIComponent(state.partnerId)}`);
    state.finance = payload.events || [];
    const target = $("[data-mp-finance-list]", root);
    target.innerHTML = state.finance.length ? state.finance.map((item) => historyCard(statusLabel(item.event_type), `${item.amount == null ? "Tutar yok" : `${item.amount} ${item.currency || ""}`} · ${statusLabel(item.status)}`, dateTime(item.created_at))).join("") : personnelEmpty("Henüz faturalandırma kaydı bulunmuyor.");
  }

  function renderWorkspacePanel(root, panel) {
    if (panel === "jobs") {
      const target = $("[data-mp-jobs-list]", root);
      const jobs = state.data.jobs || [];
      target.innerHTML = `<h3>İlan kayıtları</h3>${jobs.length ? jobs.map((item) => {
        const title = item.title || item.job_title;
        const detail = [item.location_label || item.structured_requirements?.location_label, item.detail_label || item.structured_requirements?.contract_label, item.rank_code].filter(Boolean).join(" · ");
        return `<article><div class="mp-history-card-head"><strong>${escape(title)}</strong><span class="mp-status-pill is-${escape(item.status)}">${escape(statusLabel(item.status))}</span></div><span>${escape(detail || "Denizcilik pozisyonu")}</span><small>${escape(item.summary || item.source_free_text || item.job_reference || "")} · ${escape(dateTime(item.created_at || item.submitted_at))}</small></article>`;
      }).join("") : '<div class="mp-empty">Henüz ilan oluşturulmadı. İlk doğrulanmış ilanınızı oluşturabilirsiniz.</div>'}`;
    }
    if (panel === "candidates") {
      const target = $("[data-mp-candidates-list]", root);
      const rooms = state.data.candidate_rooms || [];
      target.innerHTML = `<h3>Yetkili aday ilişkileri</h3>${rooms.length ? rooms.map((room) => {
        const job = (state.data.jobs || []).find((item) => item.id === room.job_id);
        return personnelCandidateCard(room, (state.data.matches || []).find((match) => match.seafarer_user_id === room.seafarer_user_id && (!room.job_id || match.job_id === room.job_id)));
      }).join("") : '<div class="mp-empty">Henüz şirketinizle açık ve izinli bir aday ilişkisi bulunmuyor.</div>'}`;
    }
    if (panel === "applications") {
      const target = $("[data-mp-applications-list]", root);
      const rooms = state.data.candidate_rooms || [];
      target.innerHTML = `<h3>Başvuru ve işe alım dosyaları</h3>${rooms.length ? rooms.map((room) => {
        const job = (state.data.jobs || []).find((item) => item.id === room.job_id);
        return historyCard(job?.job_title || "İşe alım dosyası", `${candidateLabel(room)} · ${statusLabel(room.status)}`, room.hiring_room_id ? `Dosya: ${room.hiring_room_id.slice(0, 8).toLocaleUpperCase("tr-TR")}` : "Dosya hazırlanıyor");
      }).join("") : '<div class="mp-empty">Henüz açık başvuru veya işe alım dosyası bulunmuyor.</div>'}`;
    }
    if (panel === "notifications") {
      const target = $("[data-mp-notifications-list]", root);
      const notifications = state.data.partner_notifications || [];
      target.innerHTML = `<h3>Okunmamış bildirimler</h3>${notifications.length ? notifications.map((item) => historyCard(item.title, item.message, dateTime(item.created_at))).join("") : '<div class="mp-empty">Yeni şirket bildirimi yok.</div>'}`;
      const form = $("[data-mp-notification-preferences-form]", root);
      const preferences = state.data.notification_preferences || {};
      if (form) {
        form.elements.in_app_mode.value = preferences.in_app_mode || "all";
        form.elements.email_digest.value = preferences.email_digest || "off";
      }
    }
    if (panel === "vessels") {
      const target = $("[data-mp-vessels-list]", root);
      const vessels = state.data.vessels || [];
      target.innerHTML = `<h3>Kayıtlı gemiler</h3>${vessels.length ? vessels.map((item) => {
        const facts = [item.vessel_type, item.flag_state, item.metadata?.gross_tonnage ? `GRT ${item.metadata.gross_tonnage}` : "", item.metadata?.deadweight ? `DWT ${item.metadata.deadweight}` : "", item.metadata?.year_built ? `Yapım ${item.metadata.year_built}` : ""].filter(Boolean);
        const relationship = item.relationship || {};
        return `<article><div class="mp-history-card-head"><strong>${escape(item.vessel_name)}</strong><span class="mp-status-pill is-${escape(item.verification_status)}">${escape(statusLabel(item.verification_status))}</span></div><span>IMO ${escape(item.imo_number)}</span><div class="mp-vessel-facts">${facts.map((fact) => `<span>${escape(fact)}</span>`).join("")}</div><div class="mp-vessel-relationship">${escape(relationshipLabel(relationship.relationship_role))} · ${escape(statusLabel(relationship.verification_status))}</div></article>`;
      }).join("") : '<div class="mp-empty">Henüz gemi kaydı bulunmuyor. IMO numarasıyla ilk geminizi ekleyebilirsiniz.</div>'}`;
    }
    if (panel === "company") {
      const business = state.data.partner || {};
      setAvatar($("[data-mp-logo-preview]", root), business);
      const form = $("[data-mp-profile-form]", root);
      ["display_name", "legal_name", "country", "city", "phone", "description"].forEach((key) => { if (form.elements[key]) form.elements[key].value = business[key] || ""; });
    }
    if (panel === "verification") {
      const verification = state.data.verification || {};
      const requirements = [
        [verification.company_active, "Aktif şirket hesabı", "Şirket hesabı askıda veya arşivde olmamalıdır."],
        [verification.company_verified, "Şirket kimliği doğrulaması", "Yasal şirket ve yetkili bilgileri yönetim tarafından doğrulanır."],
        [verification.cycle_current, "Güncel doğrulama döngüsü", "Doğrulama süresi dolduğunda yeniden kontrol gerekir."],
        [verification.recruiter_authorized, "Yetkili işe alım temsilcisi", "İlan ve aday işlemleri yalnız yetkili şirket temsilcileri tarafından yapılır."]
      ];
      $("[data-mp-verification-list]", root).innerHTML = requirements.map(([complete, title, copy]) => `<article class="${complete ? "is-complete" : ""}"><span aria-hidden="true">${complete ? "✓" : "!"}</span><span><strong>${escape(title)}</strong><small>${escape(copy)}</small></span><b>${complete ? "Tamam" : "Eksik"}</b></article>`).join("");
      const cycle = verification.cycle;
      $("[data-mp-verification-detail]", root).textContent = verification.ready_for_hiring
        ? `Şirketiniz doğrulanmış ve işe alım işlemlerine yetkilidir.${cycle?.expires_at ? ` Güncel doğrulama ${dateTime(cycle.expires_at)} tarihine kadar geçerlidir.` : ""}`
        : "Eksik bir doğrulama adımı varsa yeni ilan ve yetkili işe alım işlemleri güvenlik amacıyla sınırlandırılır. Düzenleme için AllonaHub destek ekibiyle iletişime geçin.";
    }
    if (["candidate-detail", "ready-pool", "matches", "pending", "pipeline", "interviews", "offers", "active-crew", "relief"].includes(panel)) renderPersonnelData(root, panel);
    if (panel === "urgent") renderUrgent(root);
    if (panel === "ready-pool") renderPoolFilter(root);
    if (panel === "finance") loadFinance(root).catch((error) => {
      const target = $("[data-mp-finance-list]", root);
      if (target) target.innerHTML = `<div class="mp-empty">${escape(error.message || "Finans kayıtları açılamadı.")}</div>`;
    });
  }

  function renderHistory(root, panel) {
    if (panel === "refresh") {
      const target = $("[data-mp-refresh-history]", root);
      target.innerHTML = `<h3>Son güncellemeler</h3>${(state.data.refresh_campaigns || []).map((item) => historyCard(item.title, item.status, `Son tarih: ${dateTime(item.expires_at)}`)).join("") || '<div class="mp-empty">Henüz güncelleme görevi yok.</div>'}`;
    }
    if (panel === "evidence") {
      const target = $("[data-mp-evidence-history]", root);
      target.innerHTML = `<h3>Kanıt talepleri</h3>${(state.data.evidence_requests || []).map((item) => { const requirements = Array.isArray(item.requirement_snapshot) ? item.requirement_snapshot : []; const ready = requirements.filter((row) => row.readiness_status === "ready").length; const waiting = requirements.length - ready; return historyCard(item.purpose, `${requirements.length} kanıt gerekli · ${ready} hazır · ${waiting} işlem bekliyor`, `Bitiş: ${dateTime(item.expires_at)}`); }).join("") || '<div class="mp-empty">Henüz kanıt talebi yok.</div>'}`;
      const select = $("[data-mp-template-options]", root);
      select.replaceChildren(option("", "Şablon seçin"));
      (state.data.evidence_templates || []).forEach((item) => select.append(option(item.id, `${item.name} · ${item.hiring_stage}`)));
    }
    if (panel === "sla") {
      const target = $("[data-mp-sla-history]", root);
      const policySelect = $("[data-mp-policy-options]", root);
      if (policySelect) {
        policySelect.replaceChildren(option("", "Süre kuralı seçin"));
        (state.data.sla_policies || []).forEach((item) => policySelect.append(option(item.id, `${item.stage} · ${item.target_minutes} dakika`)));
      }
      target.innerHTML = `<h3>Canlı süreçler</h3>${(state.data.sla_instances || []).map((item) => historyCard(item.stage, item.status, `Hedef: ${dateTime(item.extended_until || item.due_at)}`, `is-${item.status}`, item.status === "completed" ? "" : `<div class="mp-history-actions"><button type="button" data-mp-sla-action="remind" data-instance-id="${escape(item.id)}">Hatırlat</button><button type="button" data-mp-sla-action="redirect_backup" data-instance-id="${escape(item.id)}">Yedeğe yönlendir</button><button type="button" data-mp-sla-action="complete" data-instance-id="${escape(item.id)}">Tamamla</button></div><form class="mp-inline-form" data-mp-sla-extend-form data-instance-id="${escape(item.id)}"><label><span>Yeni hedef</span><input type="datetime-local" name="extend_until" required></label><label><span>Gerekçe</span><input name="reason" minlength="3" maxlength="500" required></label><button type="submit">Gerekçeli uzat</button></form>`)).join("") || '<div class="mp-empty">Aktif süreç süresi kaydı yok.</div>'}`;
    }
    if (panel === "handover") {
      const target = $("[data-mp-handover-history]", root);
      target.innerHTML = `<h3>Son devirler</h3>${(state.data.handovers || []).map((item) => historyCard("Dosya devri", item.reason, dateTime(item.created_at))).join("") || '<div class="mp-empty">Henüz dosya devri yok.</div>'}`;
    }
    if (panel === "review") {
      const target = $("[data-mp-review-history]", root);
      target.innerHTML = `<h3>İnceleme geçişleri</h3>${(state.data.reviewer_passes || []).map((item) => historyCard(item.reviewer_name, `${item.status} · ${item.purpose}`, `Bitiş: ${dateTime(item.expires_at)}`, "", item.status === "active" ? `<button type="button" data-mp-revoke-pass="${escape(item.id)}">İptal et</button>` : "")).join("") || '<div class="mp-empty">Henüz güvenli inceleme geçişi yok.</div>'}`;
    }
    if (panel === "references") renderReferences(root);
    if (panel === "governance") {
      const target = $("[data-mp-metrics]", root);
      const live = state.data.live_metrics || [];
      const snapshots = state.data.metric_snapshots || [];
      target.innerHTML = [...live.map((item) => historyCard(item.metric_key, Number(item.metric_value).toLocaleString("tr-TR"), item.explanation)), ...snapshots.map((item) => historyCard(item.metric_key, Number(item.metric_value).toLocaleString("tr-TR"), `${dateTime(item.period_start)} - ${dateTime(item.period_end)}`))].join("") || '<div class="mp-empty">Henüz hesaplanmış değer ölçümü yok.</div>';
    }
  }

  function referenceStatusLabel(status) {
    return ({ draft: "Taslak", submitted: "Gönderildi", automated_screening: "Ön kontrolde", needs_review: "Yönetici incelemesinde", approved: "Onaylandı", rejected: "Reddedildi", withdrawn: "Geri çekildi", superseded: "Yeni sürümle değiştirildi", expired: "Süresi doldu" })[status] || status || "Bekliyor";
  }

  function renderReferences(root) {
    const matchesTarget = $("[data-mp-reference-matches]", root);
    const historyTarget = $("[data-mp-reference-history]", root);
    const matches = state.data.historical_reference_matches || [];
    matchesTarget.innerHTML = matches.length ? matches.map((item) => {
      const evaluation = item.evaluation || {};
      const match = item.match;
      const safeToAccept = ["exact_verified", "strong_match"].includes(evaluation.level);
      const detail = `${item.vessel_name || "Gemi"} · IMO ${item.imo_number} · ${item.rank_name || "Görev belirtilmedi"} · ${item.service_start || "?"} - ${item.service_end || "?"}`;
      let actions = "";
      if (!match || match.status === "pending") actions = safeToAccept
        ? `<button type="button" class="mp-primary" data-mp-reference-match="accept" data-claim-id="${escape(item.id)}">Çalışma ilişkisini doğrula</button><button type="button" class="mp-secondary" data-mp-reference-match="reject" data-claim-id="${escape(item.id)}">Eşleşmeyi reddet</button>`
        : `<span class="mp-match-warning">${evaluation.level === "conflict" ? "Tarih aralığı şirket yetkisiyle çakışıyor." : "Tarihsel şirket-gemi yetkisi doğrulanmadan referans verilemez."}</span>`;
      if (match?.status === "accepted") actions = `<button type="button" class="mp-primary" data-mp-reference-compose="${escape(match.id)}">Referans oluştur</button>`;
      if (match?.status === "rejected") actions = '<span class="mp-match-warning">Şirket tarafından eşleşme reddedildi.</span>';
      return `<article class="mp-reference-item"><div><strong>${escape(item.candidate_name || item.candidate_public_id || "Aday")}</strong><p>${escape(detail)}</p><small>${escape(evaluation.level || "possible_match")} · güven ${escape(evaluation.confidence || 0)}%</small></div><div class="mp-history-actions">${actions}</div></article>`;
    }).join("") : '<div class="mp-empty">Doğrulanmış tarihsel IMO yetkinizle eşleşen eski çalışan kaydı bulunmuyor.</div>';
    const references = state.data.employer_references || [];
    historyTarget.innerHTML = `<h3>Şirket referansları</h3>${references.length ? references.map((item) => historyCard(`Sürüm ${item.version_number}`, `${referenceStatusLabel(item.status)} · ortalama ${item.average_score ?? "-"}/10`, dateTime(item.updated_at), item.high_impact_negative ? "is-overdue" : "", item.status === "draft" ? `<div class="mp-history-actions"><button type="button" data-mp-reference-submit="${escape(item.id)}">İncelemeye gönder</button><button type="button" data-mp-reference-withdraw="${escape(item.id)}">Geri çek</button></div>` : ["submitted", "automated_screening", "needs_review"].includes(item.status) ? `<div class="mp-history-actions"><button type="button" data-mp-reference-withdraw="${escape(item.id)}">Geri çek</button></div>` : "")).join("") : '<div class="mp-empty">Henüz işveren referansı oluşturulmadı.</div>'}`;
  }

  function showReferenceComposer(matchId) {
    const root = $("[data-mp-drawer-body]");
    const form = $("[data-mp-reference-form]", root);
    form.hidden = false;
    form.elements.match_id.value = matchId;
    const ratings = $("[data-mp-reference-ratings]", form);
    ratings.innerHTML = referenceCategories.map(([key, label]) => `<div class="mp-rating-row"><span id="rating-${escape(key)}">${escape(label)}</span><div class="mp-stars" role="radiogroup" aria-labelledby="rating-${escape(key)}">${Array.from({ length: 10 }, (_, index) => `<label title="${index + 1} puan"><input type="radio" name="rating_${escape(key)}" value="${index + 1}" required><span aria-hidden="true">★</span><span class="mp-sr-only">${index + 1}</span></label>`).join("")}</div><label class="mp-na"><input type="checkbox" name="na_${escape(key)}"> Uygulanamaz</label></div>`).join("");
    const answers = $("[data-mp-reference-answers]", form);
    answers.innerHTML = referenceQuestions.map(([key, label]) => `<label><span>${escape(label)}</span><select name="answer_${escape(key)}" required><option value="">Seçin</option><option value="yes">Evet</option><option value="no">Hayır</option><option value="unknown">Bilinmiyor</option></select></label>`).join("");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCounters(root) {
    const counters = state.data?.counters || {};
    $$('[data-mp-action-count]', root).forEach((badge) => {
      const count = Number(counters[badge.dataset.mpActionCount] || 0);
      badge.hidden = count <= 0;
      badge.textContent = count > 0 ? `${count} işlem` : "";
    });
    const main = $("[data-mp-main-counter]");
    const total = Number(counters.action_required || 0);
    if (main) {
      main.hidden = total <= 0;
      main.textContent = total > 0 ? `${total} işlem gerekli` : "";
    }
  }

  function renderOperationFeed() {
    const notifications = $("[data-mp-operation-notifications]");
    const tasks = $("[data-mp-operation-tasks]");
    if (notifications) {
      const rows = (state.data.partner_notifications || []).slice(0, 3);
      notifications.innerHTML = rows.length ? rows.map((item) => `<div class="mp-feed-row"><span><strong>${escape(item.title)}</strong><small>${escape(item.message)}</small></span><time>${escape(dateTime(item.created_at))}</time></div>`).join("") : '<div class="mp-empty">Yeni bildirim bulunmuyor.</div>';
    }
    if (tasks) {
      const counters = state.data.counters || {};
      const rows = [["Geciken SLA", counters.overdue_steps], ["Bekleyen kanıt", counters.pending_evidence], ["Görüşme bekleyen", counters.pending_interviews], ["Referans kontrolü", counters.pending_reference_matches]].filter((item) => Number(item[1]) > 0);
      tasks.innerHTML = rows.length ? rows.map(([label, count]) => `<div class="mp-feed-row"><strong>${escape(label)}</strong><b>${escape(count)}</b></div>`).join("") : '<div class="mp-empty">Size atanmış bekleyen görev bulunmuyor.</div>';
    }
  }

  function setRoute(view, tab, replace) {
    if (state.routeSync) return;
    const url = new URL(location.href);
    if (view && view !== "operations") url.searchParams.set("view", view);
    else url.searchParams.delete("view");
    if (tab) url.searchParams.set("tab", tab);
    else url.searchParams.delete("tab");
    history[replace ? "replaceState" : "pushState"]({ maripartner: true, view: view || "operations", tab: tab || null }, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function setActiveNavigation(view) {
    const group = view === "center" || ["ready-pool", "matches", "urgent", "pending", "pipeline", "interviews", "offers", "active-crew", "relief", "candidates", "applications", "refresh", "evidence", "sla", "handover", "review", "references", "governance", "candidate-detail"].includes(view)
      ? "personnel"
      : view === "job-create" ? "jobs" : view === "vessel-create" ? "vessels" : view;
    $$(".mp-primary-nav > *").forEach((item) => {
      const itemGroup = item.hasAttribute("data-mp-center") ? "personnel" : item.dataset.mpView || item.dataset.mpOpen || "";
      const active = itemGroup === (group || "operations");
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }

  function openCenter(trigger) {
    const template = document.getElementById("mpCenterTemplate");
    const wrap = $("[data-mp-drawer-wrap]");
    const body = $("[data-mp-drawer-body]");
    state.activePanel = "center";
    setActiveNavigation("center");
    if (trigger?.hasAttribute?.("data-mp-center")) state.lastFocus = trigger;
    else if (!state.lastFocus) state.lastFocus = document.activeElement;
    $("[data-mp-drawer-title]").textContent = "İşlemler";
    $("[data-mp-back]").hidden = true;
    body.replaceChildren(template.content.cloneNode(true));
    renderCounters(body);
    const requestedTab = new URLSearchParams(location.search).get("tab");
    const tabButton = requestedTab ? $(`[data-mp-center-tab="${requestedTab}"]`, body) : null;
    if (tabButton) selectCenterTab(tabButton, true);
    else setRoute("personnel", "operations", true);
    wrap.hidden = false;
    document.body.style.overflow = "hidden";
    $("[data-mp-close]", wrap).focus();
  }

  function selectCenterTab(button, replace) {
    const root = $("[data-mp-drawer-body]");
    const tab = button.dataset.mpCenterTab;
    $$('[data-mp-center-tab]', root).forEach((item) => { item.setAttribute("aria-selected", String(item === button)); item.tabIndex = item === button ? 0 : -1; });
    $$('[data-mp-center-pane]', root).forEach((pane) => { pane.hidden = pane.dataset.mpCenterPane !== tab; });
    $("[data-mp-drawer-title]").textContent = ({ operations: "İşlemler", trust: "Güven", management: "Yönetim" })[tab] || "Personel Merkezi";
    setRoute("personnel", tab, replace);
  }

  function addRequirement(root) {
    const target = $("[data-mp-requirements]", root);
    const index = target.children.length;
    const row = document.createElement("div");
    row.className = "mp-requirement";
    row.innerHTML = `<label><span>Kural kodu</span><input name="requirement_key_${index}" required pattern="[a-z0-9_]{2,60}" placeholder="certificate_validity"></label><label><span>Başlık</span><input name="requirement_label_${index}" required maxlength="160"></label><label><span>Kaynak</span><select name="source_type_${index}"><option value="company_rule">Şirket kuralı</option><option value="official_rule">Resmî kural</option></select></label><label><span>Hassasiyet</span><select name="sensitivity_${index}"><option value="metadata">Yalnız metadata</option><option value="standard">Standart</option><option value="sensitive">Hassas, aday rızası gerekir</option></select></label><label><span>Resmî kaynak bağlantısı</span><input type="url" name="official_source_url_${index}" maxlength="500"></label><label class="mp-check"><input type="checkbox" name="required_${index}" checked> Zorunlu</label><button type="button" data-mp-remove-requirement>Gereksinimi kaldır</button>`;
    target.append(row);
  }

  function openPanel(panel, trigger) {
    const template = document.getElementById(templates[panel]);
    if (!template) return;
    state.activePanel = panel;
    setActiveNavigation(panel);
    const wrap = $("[data-mp-drawer-wrap]");
    if (wrap.hidden) state.lastFocus = trigger || document.activeElement;
    const body = $("[data-mp-drawer-body]");
    $("[data-mp-drawer-title]").textContent = titles[panel];
    $("[data-mp-back]").hidden = standalonePanels.has(panel);
    body.replaceChildren(template.content.cloneNode(true));
    fillJobs(body);
    fillCandidates(body);
    fillTeam(body);
    fillHiringRooms(body);
    fillVessels(body);
    if (panel === "refresh" || panel === "evidence" || panel === "review") $$('input[name="expires_at"]', body).forEach((input) => { input.value = toInputDate(); });
    if (panel === "job-create") {
      const expiry = $('input[name="expires_at"]', body);
      if (expiry) expiry.value = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const joining = $('input[name="joining_date"]', body);
      if (joining) {
        const minimum = new Date().toISOString().slice(0, 10);
        joining.min = minimum;
        joining.value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      }
    }
    if (panel === "evidence") addRequirement(body);
    renderWorkspacePanel(body, panel);
    renderHistory(body, panel);
    wrap.hidden = false;
    document.body.style.overflow = "hidden";
    $("[data-mp-close]", wrap).focus();
    setRoute(panel, null, false);
  }

  function closePanel() {
    $("[data-mp-drawer-wrap]").hidden = true;
    document.body.style.overflow = "";
    state.lastFocus?.focus?.();
    setActiveNavigation("operations");
    setRoute("operations", null, true);
  }

  function applyRouteState() {
    const params = new URLSearchParams(location.search);
    const requestedView = params.get("view");
    const view = legacyViewAliases[requestedView] || requestedView;
    state.routeSync = true;
    try {
      if (view === "personnel") openCenter();
      else if (view && templates[view]) openPanel(view);
      else {
        const wrap = $("[data-mp-drawer-wrap]");
        if (wrap) wrap.hidden = true;
        document.body.style.overflow = "";
        state.activePanel = "";
        setActiveNavigation("operations");
      }
    } finally {
      state.routeSync = false;
    }
    if (requestedView && requestedView !== view) setRoute(view, params.get("tab"), true);
  }

  function renderMatches() {
    const target = $("[data-mp-match-list]");
    const jobId = $("[data-mp-job-filter]").value;
    const matches = (state.data.matches || []).filter((item) => !jobId || item.job_id === jobId);
    const rooms = state.data.candidate_rooms || [];
    const safe = matches.filter((match) => rooms.some((room) => room.seafarer_user_id === match.seafarer_user_id && (!match.job_id || room.job_id === match.job_id)));
    target.innerHTML = safe.length ? safe.map((match) => {
      const room = rooms.find((item) => item.seafarer_user_id === match.seafarer_user_id && (!match.job_id || item.job_id === match.job_id));
      const job = (state.data.jobs || []).find((item) => item.id === match.job_id);
      return `<article class="mp-match"><div><h3>${escape(room?.candidate?.full_name || room?.candidate?.public_id || "Aday")}</h3><p>${escape(job?.job_title || "Genel aday havuzu")} · ${escape(match.hard_gate_status)}</p></div><span class="mp-match__score" aria-label="Eşleşme puanı yüzde ${escape(Math.round(Number(match.preference_score || 0)))}">${escape(Math.round(Number(match.preference_score || 0)))}</span></article>`;
    }).join("") : '<div class="mp-empty">Bu kapsamda güvenli eşleşme bulunmuyor. Yalnız yetkili aday ilişkileri burada gösterilir.</div>';
  }

  function render() {
    Object.entries(state.data.counters || {}).forEach(([key, value]) => { $$(`[data-mp-count="${key}"]`).forEach((target) => { target.textContent = Number(value || 0).toLocaleString("tr-TR"); }); });
    const business = state.data.partner || {};
    const verification = state.data.verification || {};
    $("[data-mp-company-name]").textContent = business.display_name || "Şirket hesabı";
    setAvatar($("[data-mp-company-avatar]"), business);
    const badge = $("[data-mp-verification-badge]");
    badge.classList.toggle("is-verified", Boolean(verification.ready_for_hiring));
    badge.textContent = verification.ready_for_hiring ? "✓" : "!";
    badge.setAttribute("aria-label", verification.ready_for_hiring ? "Doğrulanmış şirket. Doğrulama ayrıntılarını aç" : "Doğrulama bekliyor. Şartları aç");
    const strip = $("[data-mp-verification-strip]");
    strip.classList.toggle("is-verified", Boolean(verification.ready_for_hiring));
    strip.classList.toggle("mp-required-incomplete", !verification.ready_for_hiring);
    $("[data-mp-verification-title]").textContent = verification.ready_for_hiring ? "Doğrulanmış denizcilik şirketi" : "Şirket doğrulama adımları tamamlanmalı";
    $("[data-mp-verification-copy]").textContent = verification.ready_for_hiring ? "İlan ve işe alım temsilcisi yetkileriniz güncel." : "Eksik şartları görmek için doğrulama durumunu açın.";
    $("[data-mp-hero-eyebrow]").textContent = verification.ready_for_hiring ? "Doğrulanmış denizcilik şirketi çalışma alanı" : "Denizcilik şirketi doğrulama çalışma alanı";
    const company = $("[data-mp-company]");
    company.replaceChildren(...(state.data.memberships || []).map((item) => option(item.id, item.display_name)));
    company.value = state.partnerId;
    const counts = {
      jobs: (state.data.jobs || []).length,
      candidates: (state.data.candidate_rooms || []).length,
      applications: new Set((state.data.candidate_rooms || []).map((item) => item.hiring_room_id).filter(Boolean)).size,
      notifications: (state.data.partner_notifications || []).length,
      vessels: (state.data.vessels || []).length
    };
    Object.entries(counts).forEach(([key, value]) => {
      const target = $(`[data-mp-nav-count="${key}"]`);
      if (target) target.textContent = Number(value).toLocaleString("tr-TR");
    });
    const notificationSignal = $("[data-mp-notification-signal]");
    if (notificationSignal) {
      notificationSignal.hidden = counts.notifications <= 0;
      notificationSignal.textContent = counts.notifications > 99 ? "99+" : String(counts.notifications);
    }
    const canCreateJob = !state.data.restricted && verification.ready_for_hiring;
    $$('[data-mp-open="job-create"]').forEach((button) => {
      button.dataset.mpBlocked = canCreateJob ? "false" : "true";
      button.setAttribute("aria-disabled", String(!canCreateJob));
      button.title = canCreateJob ? "Yeni denizcilik ilanı oluştur" : "İlan oluşturmak için şirket ve temsilci doğrulaması tamamlanmalıdır.";
    });
    $$('[data-mp-center]').forEach((button) => { button.disabled = Boolean(state.data.restricted); });
    fillJobs(document, true);
    renderMatches();
    renderCounters(document);
    renderOperationFeed();
  }

  async function load(partnerId) {
    alert("");
    const query = partnerId ? `?partner_id=${encodeURIComponent(partnerId)}` : "";
    state.data = await api(`/v1/maritime/partner-center${query}`);
    state.partnerId = state.data.partner.id;
    render();
  }

  async function submitWithButton(form, task) {
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try { await task(); }
    finally { button.disabled = false; button.removeAttribute("aria-busy"); }
  }

  async function prepareLogo(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type || "")) throw new Error("JPG, PNG veya WebP biçiminde bir şirket görseli seçin.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Seçilen görsel en fazla 8 MB olabilir.");
    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const node = new Image();
        node.onload = () => resolve(node);
        node.onerror = () => reject(new Error("Şirket görseli okunamadı."));
        node.src = sourceUrl;
      });
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 640;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 640, 640);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 640, 640);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", .9));
      if (!blob) throw new Error("Şirket görseli hazırlanamadı.");
      return blob;
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function uploadLogo(file) {
    if (!App.supabase?.storage) throw new Error("Güvenli görsel yükleme bağlantısı hazırlanamadı.");
    const blob = await prepareLogo(file);
    const intent = await api("/v1/maritime/partner-center/profile/logo-intent", { method: "POST", body: { partner_id: state.partnerId, mime_type: "image/webp" } });
    const { error } = await App.supabase.storage.from(intent.bucket).uploadToSignedUrl(intent.path, intent.token, blob, { contentType: "image/webp", upsert: true });
    if (error) throw new Error(error.message || "Şirket görseli yüklenemedi.");
    state.pendingLogoPath = intent.path;
    const preview = $("[data-mp-logo-preview]", $("[data-mp-drawer-body]"));
    if (preview) preview.innerHTML = `<img src="${escape(URL.createObjectURL(blob))}" alt="">`;
    alert("Şirket görseli hazırlandı. Değişikliği tamamlamak için profili kaydedin.", "success");
  }

  async function submitProfile(form) {
    const data = new FormData(form);
    const body = { partner_id: state.partnerId };
    ["display_name", "legal_name", "country", "city", "phone", "description"].forEach((key) => { body[key] = String(data.get(key) || "").trim() || null; });
    if (state.pendingLogoPath) body.logo_path = state.pendingLogoPath;
    await api("/v1/maritime/partner-center/profile", { method: "PATCH", body });
    state.pendingLogoPath = null;
    await load(state.partnerId);
    openPanel("company", state.lastFocus);
    alert("Şirket profili güncellendi.", "success");
  }

  async function submitJob(form) {
    const data = new FormData(form);
    const certificates = selectedValues(form, "certificates");
    if (!certificates.length) throw new Error("En az bir zorunlu sertifika seçin.");
    const language = String(data.get("language") || "");
    const expiry = new Date(`${data.get("expires_at")}T23:59:59`);
    const payload = {
      partner_id: state.partnerId,
      client_listing_id: clientId(),
      title: data.get("title"),
      summary: data.get("summary"),
      vessel_type: data.get("vessel_type"),
      joining_date: data.get("joining_date"),
      location_label: data.get("location_label"),
      detail_label: data.get("detail_label"),
      salary_amount: Number(data.get("salary_amount")),
      salary_currency: data.get("salary_currency"),
      preferred_conditions: data.get("preferred_conditions") || "",
      rank_code: data.get("rank_code"),
      required_certificate_codes: certificates,
      minimum_sea_service_days: Number(data.get("minimum_sea_service_days") || 0),
      required_languages: language ? [{ language, level: data.get("language_level") || "B1" }] : [],
      medical_required: data.get("medical_required") === "on",
      available_now_required: data.get("available_now_required") === "on",
      expires_at: expiry.toISOString()
    };
    await api("/v1/maritime/partner-center/jobs", { method: "POST", body: payload });
    await load(state.partnerId);
    openPanel("jobs", state.lastFocus);
    alert("İlanınız doğrulama ve yayın incelemesine gönderildi.", "success");
  }

  function vesselNumber(value) {
    const normalized = String(value ?? "").trim().replace(",", ".");
    if (!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  async function lookupVessel(form) {
    const imo = String(form.elements.imo_number.value || "").replace(/\D/g, "").slice(0, 7);
    form.elements.imo_number.value = imo;
    if (!/^\d{7}$/.test(imo)) throw new Error("Yedi haneli geçerli bir IMO numarası girin.");
    const button = $("[data-mp-vessel-lookup]", form);
    const result = $("[data-mp-vessel-lookup-result]", form);
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    result.hidden = false;
    result.classList.remove("is-error");
    result.textContent = "Gemi bilgileri aranıyor...";
    try {
      const payload = await api(`/v1/maritime/vessels/${encodeURIComponent(imo)}`);
      const vessel = payload.vessel || {};
      const values = {
        vessel_name: vessel.vessel_name,
        vessel_type: vessel.vessel_type,
        flag_state: vessel.flag,
        mmsi: vessel.mmsi,
        call_sign: vessel.call_sign,
        gross_tonnage: vessel.grt,
        deadweight: vessel.dwt,
        year_built: vessel.build_year,
        provider: vessel.provider
      };
      Object.entries(values).forEach(([key, value]) => { if (form.elements[key] && value !== null && value !== undefined && value !== "") form.elements[key].value = value; });
      result.textContent = `${vessel.vessel_name || `IMO ${imo}`} bilgileri getirildi. Eksik alanları kontrol edip tamamlayın.`;
    } catch (error) {
      result.classList.add("is-error");
      result.textContent = `${error.message || "Gemi bilgileri getirilemedi."} Zorunlu alanları elle doldurarak kayda devam edebilirsiniz.`;
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }

  async function submitVessel(form) {
    const data = new FormData(form);
    const validFrom = String(data.get("valid_from") || "") || null;
    const validUntil = String(data.get("valid_until") || "") || null;
    if (validFrom && validUntil && validUntil < validFrom) throw new Error("İlişki bitiş tarihi başlangıç tarihinden önce olamaz.");
    const body = {
      partner_id: state.partnerId,
      imo_number: String(data.get("imo_number") || "").replace(/\D/g, "").slice(0, 7),
      vessel_name: String(data.get("vessel_name") || "").trim(),
      vessel_type: String(data.get("vessel_type") || "").trim(),
      flag_state: String(data.get("flag_state") || "").trim(),
      relationship_role: data.get("relationship_role"),
      mmsi: String(data.get("mmsi") || "").trim() || null,
      call_sign: String(data.get("call_sign") || "").trim() || null,
      gross_tonnage: vesselNumber(data.get("gross_tonnage")),
      deadweight: vesselNumber(data.get("deadweight")),
      year_built: vesselNumber(data.get("year_built")),
      valid_from: validFrom,
      valid_until: validUntil,
      provider: String(data.get("provider") || "").trim() || null
    };
    await api("/v1/maritime/partner-center/vessels", { method: "POST", body });
    await load(state.partnerId);
    openPanel("vessels", state.lastFocus);
    alert("Gemi kaydı oluşturuldu ve şirket-gemi ilişkisi doğrulamaya gönderildi.", "success");
  }

  async function submitRefresh(form) {
    const data = new FormData(form);
    const rooms = selectedValues(form, "candidate_room_ids");
    if (!rooms.length) throw new Error("En az bir yetkili aday seçin.");
    const filters = { rank: data.get("filter_rank") || "", vessel_type: data.get("filter_vessel_type") || "", earliest_join_date: data.get("filter_earliest_join_date") || null, availability_status: data.get("filter_availability_status") || null, document_status: data.get("filter_document_status") || null, prior_relationship: "authorized_existing" };
    const payload = await api("/v1/maritime/partner-center/refresh-campaigns", { method: "POST", body: { partner_id: state.partnerId, candidate_room_ids: rooms, job_id: data.get("job_id") || null, title: data.get("title"), filters, questions: selectedValues(form, "questions"), expires_at: new Date(data.get("expires_at")).toISOString() } });
    await load(state.partnerId); openPanel("refresh", state.lastFocus); alert(`${payload.recipient_count} aday için uygulama içi güncelleme görevi oluşturuldu.`, "success");
  }

  function requirementsFromForm(form) {
    return $$(".mp-requirement", form).map((row) => {
      const get = (prefix) => $(`[name^="${prefix}_"]`, row);
      return { requirement_key: get("requirement_key").value.trim(), label: get("requirement_label").value.trim(), source_type: get("source_type").value, official_source_url: get("official_source_url").value.trim() || null, sensitivity: get("sensitivity").value, required: get("required").checked };
    });
  }

  async function submitEvidenceTemplate(form) {
    const data = new FormData(form);
    await api("/v1/maritime/partner-center/evidence-templates", { method: "POST", body: { partner_id: state.partnerId, name: data.get("name"), hiring_stage: data.get("hiring_stage"), requirements: requirementsFromForm(form) } });
    await load(state.partnerId); openPanel("evidence", state.lastFocus); alert("Kanıt şablonu kaydedildi.", "success");
  }

  async function submitEvidenceRequest(form) {
    const data = new FormData(form);
    await api("/v1/maritime/partner-center/evidence-requests", { method: "POST", body: { partner_id: state.partnerId, template_id: data.get("template_id"), candidate_room_id: data.get("candidate_room_id"), job_id: null, purpose: data.get("purpose"), expires_at: new Date(data.get("expires_at")).toISOString() } });
    await load(state.partnerId); openPanel("evidence", state.lastFocus); alert("Minimum gerekli kanıt talebi oluşturuldu.", "success");
  }

  async function submitSla(form) {
    const data = new FormData(form);
    await api("/v1/maritime/partner-center/sla-policies", { method: "POST", body: { partner_id: state.partnerId, stage: data.get("stage"), target_minutes: Number(data.get("target_minutes")), primary_role: data.get("primary_role"), primary_user_id: data.get("primary_user_id") || null, backup_user_id: data.get("backup_user_id") || null, notify_before_minutes: Number(data.get("notify_before_minutes")), escalation_after_minutes: 0, active: true } });
    await load(state.partnerId); openPanel("sla", state.lastFocus); alert("Süreç süresi kuralı kaydedildi.", "success");
  }

  async function submitSlaStart(form) {
    const data = new FormData(form);
    await api("/v1/maritime/partner-center/sla-instances", { method: "POST", body: { partner_id: state.partnerId, policy_id: data.get("policy_id"), hiring_room_id: data.get("hiring_room_id"), candidate_room_id: data.get("candidate_room_id") || null } });
    await load(state.partnerId); openPanel("sla", state.lastFocus); alert("Süre takibi sunucu saatiyle başlatıldı.", "success");
  }

  async function submitSlaExtend(form) {
    const data = new FormData(form);
    await api(`/v1/maritime/partner-center/sla-instances/${encodeURIComponent(form.dataset.instanceId)}/action`, { method: "POST", body: { action: "extend", reason: data.get("reason"), extend_until: new Date(data.get("extend_until")).toISOString() } });
    await load(state.partnerId); openPanel("sla"); alert("Süreç hedefi gerekçesiyle uzatıldı.", "success");
  }

  async function submitHandover(form) {
    const data = new FormData(form);
    const roomId = data.get("hiring_room_id");
    await api(`/v1/maritime/partner-center/hiring-rooms/${encodeURIComponent(roomId)}/handover`, { method: "POST", body: { partner_id: state.partnerId, new_owner_user_id: data.get("new_owner_user_id"), backup_user_id: data.get("backup_user_id") || null, reason: data.get("reason"), next_action: data.get("next_action") || "", next_action_at: data.get("next_action_at") ? new Date(data.get("next_action_at")).toISOString() : null, issue_note: data.get("issue_note") || "" } });
    await load(state.partnerId); openPanel("handover", state.lastFocus); alert("İşe alım dosyası yeni sorumluya devredildi.", "success");
  }

  async function submitReview(form) {
    const data = new FormData(form);
    const payload = await api("/v1/maritime/partner-center/reviewer-passes", { method: "POST", body: { partner_id: state.partnerId, candidate_room_id: data.get("candidate_room_id"), job_id: data.get("job_id") || null, reviewer_name: data.get("reviewer_name"), reviewer_contact: data.get("reviewer_contact"), purpose: data.get("purpose"), allowed_fields: selectedValues(form, "allowed_fields"), download_allowed: data.get("download_allowed") === "on", expires_at: new Date(data.get("expires_at")).toISOString(), max_uses: Number(data.get("max_uses")) } });
    const credential = $("[data-mp-credential]", $("[data-mp-drawer-body]"));
    credential.hidden = false;
    credential.innerHTML = `<strong>Güvenli geçiş oluşturuldu</strong><p>Bağlantı otomatik gönderilmedi. İnceleyene sayfa adresini, erişim anahtarını ve tek kullanımlık kodu ayrı kanallardan iletin.</p><code>${escape(location.origin + payload.reviewer_url)}</code><code>${escape(payload.access_token)}</code><code>${escape(payload.one_time_code)}</code>`;
    await load(state.partnerId); renderHistory($("[data-mp-drawer-body]"), "review"); alert("Güvenli inceleme geçişi oluşturuldu.", "success");
  }

  async function submitEmployerReference(form) {
    const data = new FormData(form);
    const ratings = referenceCategories.map(([key]) => {
      const notApplicable = data.get(`na_${key}`) === "on";
      const score = data.get(`rating_${key}`);
      if (!notApplicable && !score) throw new Error("Tüm değerlendirme kategorilerini puanlayın veya Uygulanamaz seçin.");
      return { category_key: key, score: notApplicable ? null : Number(score), not_applicable: notApplicable };
    });
    const answers = referenceQuestions.map(([key]) => ({ question_key: key, answer: data.get(`answer_${key}`), note: null }));
    await api("/v1/maritime/partner-center/employer-references", { method: "POST", body: { partner_id: state.partnerId, match_id: data.get("match_id"), ratings, answers, comment: data.get("comment") || null } });
    await load(state.partnerId);
    openPanel("references", state.lastFocus);
    alert("Referans taslağı güvenli biçimde kaydedildi. Yayımlanması için incelemeye gönderin.", "success");
  }

  async function submitUrgent(form) {
    const data = new FormData(form);
    await api("/v1/maritime/partner-center/urgent-crew", { method: "POST", body: {
      partner_id: state.partnerId,
      job_id: data.get("job_id") || null,
      vessel_profile_id: data.get("vessel_profile_id") || null,
      needed_by: new Date(data.get("needed_by")).toISOString(),
      ranks: [String(data.get("rank") || "").trim()],
      note: String(data.get("note") || "").trim() || null,
      idempotency_key: clientId()
    } });
    await load(state.partnerId);
    openPanel("urgent", state.lastFocus);
    alert("Acil personel eşleştirmesi, mevcut ilan şartları korunarak başlatıldı.", "success");
  }

  async function submitNotificationPreferences(form) {
    const data = new FormData(form);
    await api("/v1/maritime/partner-center/notification-preferences", { method: "PUT", body: { partner_id: state.partnerId, in_app_mode: data.get("in_app_mode"), email_digest: data.get("email_digest") } });
    await load(state.partnerId);
    openPanel("notifications", state.lastFocus);
    alert("Bildirim tercihleri kaydedildi.", "success");
  }

  async function inviteCandidate(button) {
    if (!button.dataset.jobId) throw new Error("Adayı davet etmek için önce bir ilan seçilmelidir.");
    await api("/v1/maritime/partner-center/candidate-invitations", { method: "POST", body: { partner_id: state.partnerId, candidate_room_id: button.dataset.mpCandidateInvite, job_id: button.dataset.jobId } });
    await load(state.partnerId);
    alert("Adaya güvenli sistem daveti gönderildi.", "success");
  }

  async function favoriteCandidate(button) {
    await api("/v1/maritime/partner-center/candidate-favorites", { method: "POST", body: { partner_id: state.partnerId, candidate_room_id: button.dataset.mpCandidateFavorite, list_name: "default" } });
    await load(state.partnerId);
    state.selectedRoomId = button.dataset.mpCandidateFavorite;
    openPanel("candidate-detail", state.lastFocus);
    alert("Aday şirket favorilerine eklendi.", "success");
  }

  function poolFiltersFromForm(form) {
    const data = new FormData(form);
    return {
      rank: String(data.get("rank") || "").trim(),
      vessel_type: String(data.get("vessel_type") || "").trim(),
      minimum_sea_service_days: Number(data.get("minimum_sea_service_days") || 0),
      availability_status: data.get("availability_status") || null,
      ready_to_join: data.get("ready_to_join") === "on"
    };
  }

  async function savePoolSearch(form) {
    const name = String(form.elements.search_name.value || "").trim();
    if (name.length < 2) throw new Error("Kayıtlı arama için en az iki karakterlik bir ad yazın.");
    state.candidateFilters = poolFiltersFromForm(form);
    await api("/v1/maritime/partner-center/saved-searches", { method: "POST", body: { partner_id: state.partnerId, name, search_scope: "candidate_pool", filters: state.candidateFilters } });
    await load(state.partnerId);
    openPanel("ready-pool", state.lastFocus);
    alert("Aday araması kaydedildi.", "success");
  }

  async function initialize() {
    state.session = App.auth?.getSession ? await App.auth.getSession() : null;
    if (!state.session?.access_token) {
      const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
      location.replace(`/pages/partner/partner.html?returnTo=${returnTo}`);
      return;
    }
    try {
      await load("");
      applyRouteState();
      if (!history.state?.maripartner) setRoute(new URLSearchParams(location.search).get("view") || "operations", new URLSearchParams(location.search).get("tab"), true);
    }
    catch (error) {
      if (error.status === 403 || error.status === 401) alert(error.message);
      else alert("MariPartner şu anda yüklenemedi. Lütfen tekrar deneyin.");
    }
  }

  document.addEventListener("click", async (event) => {
    const mobileMenu = event.target.closest("[data-mp-mobile-menu]");
    if (mobileMenu) {
      const sidebar = $("[data-mp-sidebar]");
      const open = !sidebar.classList.contains("is-open");
      sidebar.classList.toggle("is-open", open);
      mobileMenu.setAttribute("aria-expanded", String(open));
      return;
    }
    const operationView = event.target.closest('[data-mp-view="operations"]');
    if (operationView) {
      closePanel();
      $("[data-mp-sidebar]")?.classList.remove("is-open");
      return;
    }
    const verificationBadge = event.target.closest("[data-mp-verification-badge]");
    if (verificationBadge) {
      event.preventDefault();
      event.stopPropagation();
      openPanel("verification", verificationBadge);
      return;
    }
    const profileButton = event.target.closest("[data-mp-company-profile], [data-mp-account]");
    if (profileButton) {
      openPanel("company", profileButton);
      return;
    }
    const workspaceButton = event.target.closest("[data-mp-open]");
    if (workspaceButton) {
      if (workspaceButton.dataset.mpBlocked === "true") {
        alert("İlan oluşturmak için şirket doğrulaması ve işe alım temsilcisi yetkisi tamamlanmalıdır.");
        return;
      }
      openPanel(workspaceButton.dataset.mpOpen, workspaceButton);
      $("[data-mp-sidebar]")?.classList.remove("is-open");
      return;
    }
    const vesselLookup = event.target.closest("[data-mp-vessel-lookup]");
    if (vesselLookup) {
      try { await lookupVessel(vesselLookup.closest("form")); }
      catch (error) { alert(error.message || "Gemi bilgileri getirilemedi."); }
      return;
    }
    const centerButton = event.target.closest("[data-mp-center]");
    if (centerButton) { openCenter(centerButton); $("[data-mp-sidebar]")?.classList.remove("is-open"); }
    const panelButton = event.target.closest("[data-mp-panel]");
    if (panelButton) openPanel(panelButton.dataset.mpPanel, panelButton);
    const centerTab = event.target.closest("[data-mp-center-tab]");
    if (centerTab) selectCenterTab(centerTab);
    const candidateTab = event.target.closest("[data-mp-candidate-tab]");
    if (candidateTab) {
      const detail = candidateTab.closest(".mp-candidate-detail");
      $$('[data-mp-candidate-tab]', detail).forEach((item) => item.setAttribute("aria-selected", String(item === candidateTab)));
      $$('[data-mp-candidate-pane]', detail).forEach((pane) => { pane.hidden = pane.dataset.mpCandidatePane !== candidateTab.dataset.mpCandidateTab; });
      return;
    }
    if (event.target.closest("[data-mp-back]")) openCenter();
    if (event.target.closest("[data-mp-close]")) closePanel();
    const inspectCandidate = event.target.closest("[data-mp-candidate-inspect]");
    if (inspectCandidate) {
      state.selectedRoomId = inspectCandidate.dataset.mpCandidateInspect;
      openPanel("candidate-detail", inspectCandidate);
      return;
    }
    const invite = event.target.closest("[data-mp-candidate-invite]");
    if (invite) {
      try { await inviteCandidate(invite); }
      catch (error) { alert(error.message || "Aday daveti gönderilemedi."); }
      return;
    }
    const favorite = event.target.closest("[data-mp-candidate-favorite]");
    if (favorite) {
      try { await favoriteCandidate(favorite); }
      catch (error) { alert(error.message || "Aday favorilere eklenemedi."); }
      return;
    }
    const markAllRead = event.target.closest("[data-mp-mark-all-read]");
    if (markAllRead) {
      const ids = (state.data.partner_notifications || []).map((item) => item.id);
      if (!ids.length) { alert("Okunmamış bildirim bulunmuyor."); return; }
      try {
        await api("/v1/maritime/partner-center/notifications/read", { method: "PATCH", body: { partner_id: state.partnerId, notification_ids: ids } });
        await load(state.partnerId); openPanel("notifications", state.lastFocus); alert("Bildirimler okundu olarak işaretlendi.", "success");
      } catch (error) { alert(error.message || "Bildirimler güncellenemedi."); }
      return;
    }
    const clearPoolFilters = event.target.closest("[data-mp-filter-clear]");
    if (clearPoolFilters) {
      state.candidateFilters = {};
      openPanel("ready-pool", state.lastFocus);
      return;
    }
    const savePoolFilters = event.target.closest("[data-mp-filter-save]");
    if (savePoolFilters) {
      try { await savePoolSearch(savePoolFilters.closest("form")); }
      catch (error) { alert(error.message || "Aday araması kaydedilemedi."); }
      return;
    }
    const add = event.target.closest("[data-mp-add-requirement]");
    if (add) addRequirement($("[data-mp-drawer-body]"));
    const remove = event.target.closest("[data-mp-remove-requirement]");
    if (remove) remove.closest(".mp-requirement")?.remove();
    const compose = event.target.closest("[data-mp-reference-compose]");
    if (compose) showReferenceComposer(compose.dataset.mpReferenceCompose);
    if (event.target.closest("[data-mp-reference-cancel]")) $("[data-mp-reference-form]", $("[data-mp-drawer-body]")).hidden = true;
    const matchDecision = event.target.closest("[data-mp-reference-match]");
    if (matchDecision) {
      try {
        const decision = matchDecision.dataset.mpReferenceMatch;
        await api(`/v1/maritime/partner-center/reference-matches/${encodeURIComponent(matchDecision.dataset.claimId)}/decision`, { method: "POST", body: { partner_id: state.partnerId, decision, reason: decision === "accept" ? "Şirketin tarihsel çalışma kayıtlarıyla doğrulandı." : "Şirket kayıtlarıyla doğrulanamadı." } });
        await load(state.partnerId); openPanel("references", state.lastFocus); alert(decision === "accept" ? "Çalışma ilişkisi doğrulandı. Referans oluşturabilirsiniz." : "Eşleşme reddedildi.", "success");
      } catch (error) { alert(error.message); }
    }
    const submitReference = event.target.closest("[data-mp-reference-submit]");
    if (submitReference) {
      try { await api(`/v1/maritime/partner-center/employer-references/${encodeURIComponent(submitReference.dataset.mpReferenceSubmit)}/submit`, { method: "POST", body: { partner_id: state.partnerId } }); await load(state.partnerId); openPanel("references", state.lastFocus); alert("Referans güven ve moderasyon incelemesine gönderildi.", "success"); }
      catch (error) { alert(error.message); }
    }
    const withdrawReference = event.target.closest("[data-mp-reference-withdraw]");
    if (withdrawReference) {
      try { await api(`/v1/maritime/partner-center/employer-references/${encodeURIComponent(withdrawReference.dataset.mpReferenceWithdraw)}/withdraw`, { method: "POST", body: { partner_id: state.partnerId } }); await load(state.partnerId); openPanel("references", state.lastFocus); alert("Referans geri çekildi.", "success"); }
      catch (error) { alert(error.message); }
    }
    const revoke = event.target.closest("[data-mp-revoke-pass]");
    if (revoke) {
      try { await api(`/v1/maritime/partner-center/reviewer-passes/${encodeURIComponent(revoke.dataset.mpRevokePass)}/revoke`, { method: "POST", body: {} }); await load(state.partnerId); openPanel("review", state.lastFocus); alert("İnceleme geçişi iptal edildi.", "success"); }
      catch (error) { alert(error.message); }
    }
    const sla = event.target.closest("[data-mp-sla-action]");
    if (sla) {
      try { await api(`/v1/maritime/partner-center/sla-instances/${encodeURIComponent(sla.dataset.instanceId)}/action`, { method: "POST", body: { action: sla.dataset.mpSlaAction } }); await load(state.partnerId); openPanel("sla"); alert(sla.dataset.mpSlaAction === "complete" ? "Süreç adımı tamamlandı." : sla.dataset.mpSlaAction === "redirect_backup" ? "Dosya yedek sorumluya yönlendirildi." : "Hatırlatma kaydedildi.", "success"); }
      catch (error) { alert(error.message); }
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (form.matches("[data-mp-pool-filter]")) {
      event.preventDefault();
      state.candidateFilters = poolFiltersFromForm(form);
      renderPersonnelData($("[data-mp-drawer-body]"), "ready-pool");
      renderPoolFilter($("[data-mp-drawer-body]"));
      return;
    }
    const handler = form.matches("[data-mp-job-form]") ? submitJob : form.matches("[data-mp-vessel-form]") ? submitVessel : form.matches("[data-mp-profile-form]") ? submitProfile : form.matches("[data-mp-refresh-form]") ? submitRefresh : form.matches("[data-mp-evidence-template-form]") ? submitEvidenceTemplate : form.matches("[data-mp-evidence-request-form]") ? submitEvidenceRequest : form.matches("[data-mp-sla-form]") ? submitSla : form.matches("[data-mp-sla-start-form]") ? submitSlaStart : form.matches("[data-mp-sla-extend-form]") ? submitSlaExtend : form.matches("[data-mp-handover-form]") ? submitHandover : form.matches("[data-mp-review-form]") ? submitReview : form.matches("[data-mp-reference-form]") ? submitEmployerReference : form.matches("[data-mp-urgent-form]") ? submitUrgent : form.matches("[data-mp-notification-preferences-form]") ? submitNotificationPreferences : null;
    if (!handler) return;
    event.preventDefault();
    try { await submitWithButton(form, () => handler(form)); }
    catch (error) { alert(error.message || "İşlem tamamlanamadı."); }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-mp-saved-search]")) {
      const selected = (state.data.saved_searches || []).find((item) => item.id === event.target.value);
      if (selected) {
        state.candidateFilters = { ...(selected.filters || {}) };
        openPanel("ready-pool", state.lastFocus);
      }
      return;
    }
    if (event.target.matches("[data-mp-logo-input]")) {
      const file = event.target.files?.[0];
      if (file) uploadLogo(file).catch((error) => alert(error.message || "Şirket görseli yüklenemedi."));
      return;
    }
    if (!event.target.matches('[name^="na_"]')) return;
    const row = event.target.closest(".mp-rating-row");
    $$('.mp-stars input[type="radio"]', row).forEach((input) => { input.disabled = event.target.checked; input.required = !event.target.checked; if (event.target.checked) input.checked = false; });
  });
  document.addEventListener("input", (event) => {
    if (!event.target.matches("[data-mp-reference-comment]")) return;
    const counter = $("[data-mp-reference-count]", event.target.closest("form"));
    if (counter) counter.textContent = String(event.target.value.length);
  });

  $("[data-mp-company]").addEventListener("change", (event) => load(event.target.value).catch((error) => alert(error.message)));
  $("[data-mp-job-filter]").addEventListener("change", renderMatches);
  $("[data-mp-refresh]").addEventListener("click", () => load(state.partnerId).then(() => alert("Panel verileri yenilendi.", "success")).catch((error) => alert(error.message)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("[data-mp-drawer-wrap]").hidden) closePanel();
    if (event.key === "Tab" && !$("[data-mp-drawer-wrap]").hidden) {
      const drawer = $("[data-mp-drawer]");
      const focusable = $$('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', drawer).filter((item) => !item.hidden && item.offsetParent !== null);
      if (focusable.length) {
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    if (event.target.matches?.("[data-mp-verification-badge]") && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      openPanel("verification", event.target);
      return;
    }
    const tab = event.target.closest?.("[data-mp-center-tab]");
    if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = $$('[data-mp-center-tab]', tab.closest('[role="tablist"]').parentElement);
    const index = tabs.indexOf(tab);
    const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1) : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    selectCenterTab(next); next.focus();
  });
  window.addEventListener("popstate", () => { if (state.data) applyRouteState(); });
  window.addEventListener("load", initialize, { once: true });
})();
