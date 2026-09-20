(function () {
  "use strict";
  const App = window.Allona = window.Allona || {};
  const state = { session: null, data: null, partnerId: "", activePanel: "", lastFocus: null };
  const titles = { refresh: "Havuzu Güncelle", evidence: "Kanıt Kontrolü", sla: "Süreç Süreleri", handover: "Dosya Devri", review: "Güvenli İnceleme", references: "Doğrulanmış Referans", governance: "Karar ve Değer Merkezi" };
  const templates = { refresh: "mpRefreshTemplate", evidence: "mpEvidenceTemplate", sla: "mpSlaTemplate", handover: "mpHandoverTemplate", review: "mpReviewTemplate", references: "mpReferencesTemplate", governance: "mpGovernanceTemplate" };
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

  function historyCard(title, detail, meta, className, action) {
    return `<article class="${escape(className || "")}"><strong>${escape(title)}</strong><span>${escape(detail || "")}</span><small>${escape(meta || "")}</small>${action || ""}</article>`;
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

  function openCenter(trigger) {
    const template = document.getElementById("mpCenterTemplate");
    const wrap = $("[data-mp-drawer-wrap]");
    const body = $("[data-mp-drawer-body]");
    state.activePanel = "center";
    if (trigger?.hasAttribute?.("data-mp-center")) state.lastFocus = trigger;
    else if (!state.lastFocus) state.lastFocus = document.activeElement;
    $("[data-mp-drawer-title]").textContent = "İşlemler";
    $("[data-mp-back]").hidden = true;
    body.replaceChildren(template.content.cloneNode(true));
    renderCounters(body);
    wrap.hidden = false;
    document.body.style.overflow = "hidden";
    $("[data-mp-close]", wrap).focus();
  }

  function selectCenterTab(button) {
    const root = $("[data-mp-drawer-body]");
    const tab = button.dataset.mpCenterTab;
    $$('[data-mp-center-tab]', root).forEach((item) => { item.setAttribute("aria-selected", String(item === button)); item.tabIndex = item === button ? 0 : -1; });
    $$('[data-mp-center-pane]', root).forEach((pane) => { pane.hidden = pane.dataset.mpCenterPane !== tab; });
    $("[data-mp-drawer-title]").textContent = ({ operations: "İşlemler", trust: "Güven", management: "Yönetim" })[tab] || "Personel Merkezi";
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
    const wrap = $("[data-mp-drawer-wrap]");
    if (wrap.hidden) state.lastFocus = trigger || document.activeElement;
    const body = $("[data-mp-drawer-body]");
    $("[data-mp-drawer-title]").textContent = titles[panel];
    $("[data-mp-back]").hidden = false;
    body.replaceChildren(template.content.cloneNode(true));
    fillJobs(body);
    fillCandidates(body);
    fillTeam(body);
    fillHiringRooms(body);
    if (panel === "refresh" || panel === "evidence" || panel === "review") $$('input[name="expires_at"]', body).forEach((input) => { input.value = toInputDate(); });
    if (panel === "evidence") addRequirement(body);
    renderHistory(body, panel);
    wrap.hidden = false;
    document.body.style.overflow = "hidden";
    $("[data-mp-close]", wrap).focus();
  }

  function closePanel() {
    $("[data-mp-drawer-wrap]").hidden = true;
    document.body.style.overflow = "";
    state.lastFocus?.focus?.();
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
    Object.entries(state.data.counters || {}).forEach(([key, value]) => { const target = $(`[data-mp-count="${key}"]`); if (target) target.textContent = Number(value || 0).toLocaleString("tr-TR"); });
    $("[data-mp-account]").textContent = state.data.partner?.display_name || "Şirket hesabı";
    const company = $("[data-mp-company]");
    company.replaceChildren(...(state.data.memberships || []).map((item) => option(item.id, item.display_name)));
    company.value = state.partnerId;
    fillJobs(document, true);
    renderMatches();
    renderCounters(document);
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

  async function initialize() {
    state.session = App.auth?.getSession ? await App.auth.getSession() : null;
    if (!state.session?.access_token) {
      const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
      location.replace(`/pages/partner/partner.html?returnTo=${returnTo}`);
      return;
    }
    try { await load(""); }
    catch (error) {
      if (error.status === 403 || error.status === 401) alert(error.message);
      else alert("MariPartner şu anda yüklenemedi. Lütfen tekrar deneyin.");
    }
  }

  document.addEventListener("click", async (event) => {
    const centerButton = event.target.closest("[data-mp-center]");
    if (centerButton) openCenter(centerButton);
    const panelButton = event.target.closest("[data-mp-panel]");
    if (panelButton) openPanel(panelButton.dataset.mpPanel, panelButton);
    const centerTab = event.target.closest("[data-mp-center-tab]");
    if (centerTab) selectCenterTab(centerTab);
    if (event.target.closest("[data-mp-back]")) openCenter();
    if (event.target.closest("[data-mp-close]")) closePanel();
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
    const handler = form.matches("[data-mp-refresh-form]") ? submitRefresh : form.matches("[data-mp-evidence-template-form]") ? submitEvidenceTemplate : form.matches("[data-mp-evidence-request-form]") ? submitEvidenceRequest : form.matches("[data-mp-sla-form]") ? submitSla : form.matches("[data-mp-sla-start-form]") ? submitSlaStart : form.matches("[data-mp-sla-extend-form]") ? submitSlaExtend : form.matches("[data-mp-handover-form]") ? submitHandover : form.matches("[data-mp-review-form]") ? submitReview : form.matches("[data-mp-reference-form]") ? submitEmployerReference : null;
    if (!handler) return;
    event.preventDefault();
    try { await submitWithButton(form, () => handler(form)); }
    catch (error) { alert(error.message || "İşlem tamamlanamadı."); }
  });

  document.addEventListener("change", (event) => {
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
    const tab = event.target.closest?.("[data-mp-center-tab]");
    if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = $$('[data-mp-center-tab]', tab.closest('[role="tablist"]').parentElement);
    const index = tabs.indexOf(tab);
    const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1) : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    selectCenterTab(next); next.focus();
  });
  window.addEventListener("load", initialize, { once: true });
})();
