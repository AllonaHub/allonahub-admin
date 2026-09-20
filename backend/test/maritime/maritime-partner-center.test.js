import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MARIPARTNER_SAFE_REVIEW_FIELDS,
  constantTimeHashEqual,
  createReviewerCredentials,
  projectReviewerCandidate,
  reviewerCandidateFromProfilePayload,
  refreshResponsePayload,
  reviewerPassState,
  sanitizeRefreshQuestions,
  sanitizeReviewFields,
  sha256,
  slaStatus
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

test("MariPartner frontend exposes one Personel Merkezi with five working actions", () => {
  const html = read("pages/partner/maripartner.html");
  const js = read("js/maripartner.js");
  const css = read("css/maripartner.css");
  assert.equal((html.match(/data-mp-panel=/g) || []).length, 5);
  assert.equal((html.match(/data-mp-center/g) || []).length, 1);
  assert.match(html, /id="mpCenterTemplate"/);
  assert.match(html, /data-mp-main-counter/);
  assert.match(html, />Personel Merkezi</);
  for (const label of ["Havuzu Güncelle", "Kanıt Kontrolü", "Süreç Süreleri", "Dosya Devri", "Güvenli İnceleme"]) assert.match(html, new RegExp(label));
  assert.match(js, /\/v1\/maritime\/partner-center\/refresh-campaigns/);
  assert.match(js, /\/v1\/maritime\/partner-center\/evidence-requests/);
  assert.match(js, /\/v1\/maritime\/partner-center\/sla-policies/);
  assert.match(js, /\/handover/);
  assert.match(js, /\/reviewer-passes/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
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
});

test("maritime partner routing remains isolated from general Partner OS", () => {
  const auth = read("js/auth.js");
  const partner = read("pages/partner/partner.html");
  assert.match(auth, /partnerBusiness\?\.partner_type === "maritime"/);
  assert.match(auth, /pages\/partner\/maripartner\.html/);
  assert.match(partner, /type==="maritime"/);
  assert.match(partner, /partnerPortalUrl\("\/maripartner"\)/);
});
