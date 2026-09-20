import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MARIPARTNER_REFERENCE_CATEGORIES,
  MARIPARTNER_REFERENCE_QUESTIONS,
  MARIPARTNER_SAFE_REVIEW_FIELDS,
  approvedReferenceSummary,
  constantTimeHashEqual,
  createReviewerCredentials,
  historicalEmploymentMatch,
  projectReviewerCandidate,
  reviewerCandidateFromProfilePayload,
  refreshResponsePayload,
  referenceModerationScreen,
  reviewerPassState,
  sanitizeRefreshQuestions,
  sanitizeReviewFields,
  sha256,
  slaStatus,
  validateEmployerReferencePayload
} from "../../src/lib/maritime-partner-center.js";

const root = new URL("../../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("reviewer credentials are random and only verifiable through hashes", () => {
  const first = createReviewerCredentials();
  const second = createReviewerCredentials();
  assert.notEqual(first.token, second.token);
  assert.match(first.code, /^\d{6}$/);
  assert.equal(first.tokenHash, sha256(first.token));
  assert.equal(constantTimeHashEqual(first.codeHash, first.code), true);
  assert.equal(constantTimeHashEqual(first.codeHash, "000000"), false);
});

test("external reviewer projection is allowlist-only", () => {
  const candidate = { display_name: "Aday", rank: "Oiler", passport_number: "SECRET", phone: "SECRET", certificate_status: "valid" };
  const fields = sanitizeReviewFields(["display_name", "rank", "passport_number", "phone", "certificate_status"]);
  assert.deepEqual(fields, ["display_name", "rank", "certificate_status"]);
  assert.deepEqual(projectReviewerCandidate(candidate, fields), { display_name: "Aday", rank: "Oiler", certificate_status: "valid" });
  assert.equal(MARIPARTNER_SAFE_REVIEW_FIELDS.includes("passport_number"), false);
});

test("reviewer candidate projection uses Maritime CV fields and strips contact data", () => {
  const candidate = reviewerCandidateFromProfilePayload({
    holder_name: "Nijat Mahmudov",
    rank: "Oiler",
    contact: { email: "private@example.com", phone: "+994500000000" },
    sea_service: [{ vessel_name: "NURKA", imo_number: "9389370", company_name: "Sea Co", vessel_type: "General Cargo", rank: "Oiler", reference_phone: "+994501111111" }],
    certificate_records: [{ expiry_date: "2027-01-01" }, { expiry_date: "2025-01-01" }, {}]
  }, new Date("2026-09-20T12:00:00.000Z"));
  assert.equal(candidate.display_name, "Nijat Mahmudov");
  assert.equal(candidate.vessel_experience[0].imo_number, "9389370");
  assert.equal(candidate.vessel_experience[0].reference_phone, undefined);
  assert.deepEqual(candidate.certificate_status, { total: 3, valid: 1, expired: 1, undated: 1 });
  assert.equal(candidate.contact, undefined);
});

test("refresh questions reject arbitrary sensitive prompts", () => {
  assert.deepEqual(sanitizeRefreshQuestions(["availability", "passport_number", "health_record", "available_from"]), ["availability", "available_from"]);
  assert.throws(() => refreshResponsePayload({ response_code: "available" }), /tarihi seçin/i);
  assert.equal(refreshResponsePayload({ response_code: "available", available_from: "2026-10-10" }).status, "responded");
});

test("SLA state is calculated from server-style timestamps", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");
  assert.equal(slaStatus({ dueAt: "2026-09-20T11:59:00.000Z", now }), "overdue");
  assert.equal(slaStatus({ dueAt: "2026-09-20T12:30:00.000Z", notifyBeforeMinutes: 60, now }), "approaching");
  assert.equal(slaStatus({ dueAt: "2026-09-21T12:00:00.000Z", notifyBeforeMinutes: 60, now }), "on_time");
  assert.equal(slaStatus({ dueAt: "2026-09-20T11:00:00.000Z", completedAt: "2026-09-20T10:00:00.000Z", now }), "completed");
});

test("reviewer pass closes on expiry, revocation or use limit", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");
  assert.equal(reviewerPassState({ status: "active", expires_at: "2026-09-21T12:00:00.000Z", use_count: 0, max_uses: 1 }, now), "active");
  assert.equal(reviewerPassState({ status: "active", expires_at: "2026-09-19T12:00:00.000Z", use_count: 0, max_uses: 1 }, now), "expired");
  assert.equal(reviewerPassState({ status: "active", expires_at: "2026-09-21T12:00:00.000Z", use_count: 1, max_uses: 1 }, now), "used");
  assert.equal(reviewerPassState({ status: "revoked", expires_at: "2026-09-21T12:00:00.000Z", use_count: 0, max_uses: 1 }, now), "revoked");
});

test("migration is deny-by-default and stores no raw reviewer secret", () => {
  const sql = read("supabase/migrations/20260920153000_create_maripartner_personnel_center.sql");
  for (const table of ["maritime_talent_refresh_campaigns", "maritime_evidence_requests", "maritime_hiring_sla_instances", "maritime_hiring_handovers", "maritime_reviewer_passes"]) {
    assert.match(sql, new RegExp(`'${table}'`, "i"));
  }
  assert.match(sql, /alter table public\.%I enable row level security/i);
  assert.match(sql, /revoke all on public\.%I from anon, authenticated/i);
  assert.match(sql, /token_hash text not null unique/i);
  assert.match(sql, /code_hash text not null/i);
  assert.doesNotMatch(sql, /\btoken\s+text\b/i);
  assert.match(sql, /security definer\s+set search_path = public, pg_temp/i);
  assert.match(sql, /maritime_transfer_hiring_case/i);
  assert.match(sql, /maritime_record_reviewer_decision/i);
  assert.match(sql, /from public\.maritime_reviewer_passes[\s\S]*for update/i);
  assert.match(sql, /response_payload jsonb not null/);
  assert.match(sql, /confirmed_fields jsonb not null/);
  assert.match(sql, /changed_fields jsonb not null/);
  const applyScript = read("deploy/maritime/apply-maritime-migrations.sh");
  const checkScript = read("deploy/maritime/check-maripartner-schema.sh");
  assert.match(applyScript, /20260920153000_create_maripartner_personnel_center\.sql/);
  assert.match(applyScript, /check-maripartner-schema\.sh/);
  assert.match(checkScript, /Direct client privilege detected on MariPartner table/);
});

test("API resolves tenant membership server-side and audits privileged operations", () => {
  const route = read("backend/src/routes/maritime-partner-center.js");
  assert.match(route, /partnerMemberships\(ctx\.user\.id\)/);
  assert.match(route, /MARIPARTNER_TENANT_DENIED/);
  assert.match(route, /candidateRoom\(body\.partner_id, body\.candidate_room_id\)/);
  assert.match(route, /roomExpired/);
  assert.match(route, /REVIEW_JOB_SCOPE_MISMATCH/);
  assert.match(route, /REFRESH_FILTER_EMPTY/);
  assert.match(route, /metadata\?\.available_from/);
  assert.match(route, /availableFrom <= filters\.earliest_join_date/);
  assert.match(route, /readinessSnapshot/);
  assert.match(route, /auditEvent\(/);
  assert.match(route, /maritime_transfer_hiring_case/);
  assert.match(route, /maritime_record_reviewer_decision/);
  assert.match(route, /delivery: "link_generated_not_sent"/);
  assert.match(route, /reviewerPassFromCredentials\(request, body\)/);
  assert.match(route, /pass\.job_id && !job/);
  assert.doesNotMatch(route, /serviceRoleKey/);
});

test("MariPartner frontend exposes one Personel Merkezi with three tabs and preserves five operations", () => {
  const html = read("pages/partner/maripartner.html");
  const js = read("js/maripartner.js");
  const css = read("css/maripartner.css");
  assert.equal((html.match(/data-mp-center-tab=/g) || []).length, 3);
  assert.equal((html.match(/data-mp-center-pane=/g) || []).length, 3);
  assert.equal((html.match(/data-mp-center(?:\s|>)/g) || []).length, 1);
  assert.match(html, /id="mpCenterTemplate"/);
  assert.match(html, /data-mp-main-counter/);
  assert.match(html, />Personel Merkezi</);
  for (const label of ["Havuzu Güncelle", "Kanıt Kontrolü", "Süreç Süreleri", "Dosya Devri", "Güvenli İnceleme"]) assert.match(html, new RegExp(label));
  for (const label of ["İşlemler", "Güven", "Yönetim", "Firmalara Özel Doğrulanmış Referans"]) assert.match(html, new RegExp(label));
  assert.match(js, /\/v1\/maritime\/partner-center\/refresh-campaigns/);
  assert.match(js, /\/v1\/maritime\/partner-center\/evidence-requests/);
  assert.match(js, /\/v1\/maritime\/partner-center\/sla-policies/);
  assert.match(js, /\/handover/);
  assert.match(js, /\/reviewer-passes/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /mp-rating-row/);
  assert.match(js, /referenceCategories/);
  assert.match(js, /data-mp-reference-match/);
});

test("historical employer matching requires IMO and overlapping verified authority", () => {
  const claim = { imo_number: "9389370", source_company_name: "Nurka Shipping", service_start: "2023-01-01", service_end: "2023-08-01" };
  const exact = historicalEmploymentMatch(claim, [{ id: "rel-1", imo_number: "9389370", company_name: "Nurka Shipping", valid_from: "2022-01-01", valid_until: "2024-01-01", verification_status: "admin_verified" }]);
  assert.equal(exact.level, "exact_verified");
  assert.equal(exact.relationship_id, "rel-1");
  assert.equal(historicalEmploymentMatch(claim, [{ id: "rel-2", imo_number: "9389370", company_name: "Nurka Shipping", valid_from: "2025-01-01", valid_until: null, verification_status: "admin_verified" }]).level, "conflict");
  assert.equal(historicalEmploymentMatch({ ...claim, imo_number: "bad" }, []).level, "rejected");
});

test("employer reference validation enforces all categories, 1-10 ratings and structured answers", () => {
  const payload = {
    ratings: MARIPARTNER_REFERENCE_CATEGORIES.map((category_key, index) => ({ category_key, score: index === 0 ? 3 : 8, not_applicable: false })),
    answers: MARIPARTNER_REFERENCE_QUESTIONS.map((question_key) => ({ question_key, answer: question_key === "eligible_for_rehire" ? "no" : "yes" })),
    comment: "Güvenlik prosedürlerinde ek gözetim gerektirir."
  };
  const result = validateEmployerReferencePayload(payload);
  assert.equal(result.ratings.length, 15);
  assert.equal(result.answers.length, 5);
  assert.equal(result.high_impact_negative, true);
  assert.throws(() => validateEmployerReferencePayload({ ...payload, ratings: payload.ratings.slice(1) }), /Tüm referans kategorilerini/);
});

test("reference moderation screens contact data and summaries use approved records only", () => {
  assert.deepEqual(referenceModerationScreen({ comment: "WhatsApp +90 555 111 22 33" }).rule_codes, ["CONTACT_DATA"]);
  const summary = approvedReferenceSummary([
    { status: "approved", average_score: 8, approved_at: "2026-09-01T00:00:00Z" },
    { status: "needs_review", average_score: 1, approved_at: null },
    { status: "approved", average_score: 6, approved_at: "2026-09-02T00:00:00Z" }
  ]);
  assert.deepEqual(summary, { approved_count: 2, average_score: 7, last_approved_at: "2026-09-02T00:00:00Z" });
});

test("trust reference migration is deny-by-default and enforces independent second review", () => {
  const sql = read("supabase/migrations/20260920190000_expand_maripartner_trust_reference_layer.sql");
  for (const table of ["maritime_company_verification_cycles", "maritime_recruiter_authorities", "maritime_vessel_company_relationships", "maritime_employer_reference_matches", "maritime_employer_references", "maritime_employer_reference_access_logs", "maritime_trust_appeals", "maritime_consent_receipts", "maritime_interview_template_versions", "maritime_integration_connections"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
  }
  assert.match(sql, /revoke all on public\.%I from anon, authenticated/i);
  assert.match(sql, /second_reviewed_by <> first_reviewed_by/i);
  assert.match(sql, /MARITIME_REFERENCE_SECOND_REVIEW_REQUIRED/);
  assert.match(sql, /MARITIME_REFERENCE_VERIFIED_RELATIONSHIP_REQUIRED/);
  assert.match(sql, /Never project to candidate, CV or public endpoints/i);
  const applyScript = read("deploy/maritime/apply-maritime-migrations.sh");
  assert.match(applyScript, /20260920190000_expand_maripartner_trust_reference_layer\.sql/);
});

test("employer reference routes are partner/admin only and never exposed on candidate routes", () => {
  const route = read("backend/src/routes/maritime-partner-center.js");
  assert.match(route, /ensureReferenceAuthority\(access\)/);
  assert.match(route, /REFERENCE_RELATIONSHIP_NOT_VERIFIED/);
  assert.match(route, /reference_second_approve/);
  assert.match(route, /REFERENCE_SECOND_REVIEWER_MUST_DIFFER/);
  assert.match(route, /maritime_employer_reference_access_logs/);
  assert.doesNotMatch(route, /candidate\/.*employer-reference/i);
});

test("candidate refresh response and admin management are wired", () => {
  const candidate = read("js/maritime-company-requests.js");
  const admin = read("js/super-admin.js");
  assert.match(candidate, /candidate\/refresh-requests/);
  assert.match(candidate, /response_code/);
  assert.match(candidate, /critical_document_change/);
  assert.match(admin, /data-maripartner-admin-action/);
  assert.match(admin, /\/v1\/admin\/maripartner/);
  assert.match(admin, /cancel_evidence/);
  assert.match(admin, /data-maripartner-company-verify/);
  assert.match(admin, /data-maripartner-recruiter-grant/);
  assert.match(admin, /data-maripartner-relationship-form/);
  assert.match(admin, /reference_second_approve/);
});

test("maritime partner routing remains isolated from general Partner OS", () => {
  const auth = read("js/auth.js");
  const partner = read("pages/partner/partner.html");
  assert.match(auth, /partnerBusiness\?\.partner_type === "maritime"/);
  assert.match(auth, /pages\/partner\/maripartner\.html/);
  assert.match(partner, /type==="maritime"/);
  assert.match(partner, /partnerPortalUrl\("\/maripartner"\)/);
});
