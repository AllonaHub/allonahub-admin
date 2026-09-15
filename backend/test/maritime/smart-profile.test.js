import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMaritimeSmartProfile,
  maritimeSmartSnapshotHash,
  matchMaritimeJob
} from "../../src/lib/maritime-smart-profile.js";

const cvProfile = {
  profile_payload: {
    holder_name: "Sample Seafarer",
    nationality: "TR",
    date_of_birth: "1990-01-02",
    rank: "Chief Officer",
    rank_i18n: { tr: "Birinci Zabit", az: "Baş köməkçi", kk: "Аға көмекші", uz: "Bosh yordamchi", ky: "Башкы жардамчы", en: "Chief Officer", de: "Erster Offizier", ru: "Старший помощник", ar: "كبير الضباط" },
    suitable_positions: ["Chief Officer"],
    certificate_codes: ["STCW II/2", "GMDSS"],
    certificate_records: [{
      code: "SH",
      document_number: "COC-1001",
      certificate_serial: "SER-2048",
      endorsement_number: "END-4096",
      title: "Certificate of Competency",
      title_i18n: { tr: "Yeterlilik Belgesi", az: "Səriştə sertifikatı", kk: null, uz: null, ky: null, en: "Certificate of Competency", de: "Befähigungszeugnis", ru: "Диплом о квалификации", ar: "شهادة الكفاءة" },
      issuing_authority: "Maritime Authority",
      approval_authority: "Flag State Authority",
      approval_reference: "RES-2026-10",
      course_start_date: "2024-12-01",
      course_end_date: "2024-12-12",
      issue_date: "2025-01-01",
      expiry_date: "2030-01-01",
      rank_or_capacity: "Chief Officer",
      rank_or_capacity_i18n: { tr: "Birinci Zabit", az: "Baş köməkçi", kk: null, uz: null, ky: null, en: "Chief Officer", de: "Erster Offizier", ru: "Старший помощник", ar: "كبير الضباط" }
    }],
    endorsements: ["Tanker familiarization"],
    endorsements_i18n: { tr: ["Tanker aşinalığı"], az: ["Tanker tanışlığı"], kk: [], uz: [], ky: [], en: ["Tanker familiarization"], de: ["Tanker-Grundausbildung"], ru: ["Подготовка по танкерам"], ar: ["الإلمام بالناقلات"] },
    restrictions: [],
    restrictions_i18n: { tr: [], az: [], kk: [], uz: [], ky: [], en: [], de: [], ru: [], ar: [] },
    sea_service: [{ vessel_name: "M/V Sample", rank: "Chief Officer", sign_on_date: "2024-01-01", sign_off_date: "2024-12-31" }],
    languages: [{ language: "English", language_i18n: { tr: "İngilizce", az: "İngilis dili", kk: "Ағылшын тілі", uz: "Ingliz tili", ky: "Англис тили", en: "English", de: "Englisch", ru: "Английский", ar: "الإنجليزية" }, level: "B2", level_i18n: { tr: "B2", az: "B2", kk: "B2", uz: "B2", ky: "B2", en: "B2", de: "B2", ru: "B2", ar: "B2" } }],
    medical_fitness: "fit"
  },
  source_document_ids: ["10000000-0000-4000-8000-000000000001"]
};

const readinessItems = [
  { id: "1", item_type: "identity", trust_level: "user_confirmed", verification_status: "pending_review", source_label: "passport.pdf", value_payload: { holder_name: "Sample Seafarer", date_of_birth: "1990-01-02", nationality: "TR" }, expires_at: "2030-01-01" },
  { id: "2", item_type: "passport", trust_level: "user_confirmed", verification_status: "pending_review", source_label: "passport.pdf", value_payload: { document_type: "passport" }, expires_at: "2030-01-01" },
  { id: "3", item_type: "seaman_book", trust_level: "user_confirmed", verification_status: "pending_review", source_label: "book.pdf", value_payload: { document_type: "seafarer_book" }, expires_at: "2030-01-01" },
  { id: "4", item_type: "rank", trust_level: "user_confirmed", verification_status: "pending_review", source_label: "coc.pdf", value_payload: { rank: "Chief Officer", certificate_codes: ["STCW II/2"] }, expires_at: "2030-01-01" },
  { id: "5", item_type: "medical", trust_level: "user_confirmed", verification_status: "pending_review", source_label: "medical.pdf", value_payload: { medical_fitness: "fit" }, expires_at: "2030-01-01" }
];

const documents = [
  { id: "10000000-0000-4000-8000-000000000001", status: "user_confirmed" },
  { id: "10000000-0000-4000-8000-000000000002", status: "verification_pending" }
];

function smart(overrides = {}) {
  return buildMaritimeSmartProfile({
    cvProfile: overrides.cvProfile || cvProfile,
    readinessItems: overrides.readinessItems || readinessItems,
    workspace: overrides.workspace || { current_work_status: "available_now", availability_status: "fresh" },
    documents: overrides.documents || documents,
    now: overrides.now || new Date("2026-09-14T00:00:00.000Z")
  });
}

test("builds a complete smart profile only from user-confirmed readiness data", () => {
  const result = smart();
  assert.equal(result.profile.canonical_rank, "chief_officer");
  assert.equal(result.profile.total_sea_service_days, 366);
  assert.equal(result.readiness.score, 100);
  assert.equal(result.readiness.ready_to_apply, true);
  assert.equal(result.readiness.seafarer_status, "system_approved");
  assert.equal(result.readiness.seafarer_system_approved, true);
  assert.deepEqual(result.readiness.seafarer_reason_codes, []);
  assert.equal(result.readiness.confirmed_document_count, 2);
  assert.deepEqual(result.readiness.conflicts, []);
  assert.equal(result.rule_version, "maritime-smart-account-v5");
  assert.equal(result.cv_draft.template_version, "allonahub-maritime-cv-v6");
  assert.equal(result.cv_draft.source_document_ids, undefined);
  assert.equal(result.cv_draft.certificate_records[0].document_number, "COC-1001");
  assert.equal(result.cv_draft.certificate_records[0].certificate_serial, "SER-2048");
  assert.equal(result.cv_draft.certificate_records[0].endorsement_number, "END-4096");
  assert.equal(result.cv_draft.certificate_records[0].approval_reference, "RES-2026-10");
  assert.equal(result.cv_draft.headline_i18n.de, "Erster Offizier");
  assert.deepEqual(result.cv_draft.endorsements_i18n.ar, ["الإلمام بالناقلات"]);
  assert.equal(result.cv_draft.languages[0].language_i18n.de, "Englisch");
  assert.ok(result.profile.certificate_codes.includes("SH"));
  assert.equal(result.cv_draft.professional_summary_origin, "generated_from_verified_data");
  assert.ok(result.cv_draft.professional_summary_i18n.tr.includes("belge kaydı"));
  assert.equal(result.cv_draft.competency_highlights[0].origin, "verified_credential");
  assert.equal(result.cv_draft.experience_overview.record_count, 1);
});

test("carries detailed CV records while keeping emergency contacts out of the employer CV", () => {
  const detailedProfile = {
    ...cvProfile,
    profile_payload: {
      ...cvProfile.profile_payload,
      family_name: "Example",
      given_names: "Seafarer",
      place_of_birth: "Sample City",
      contact: { email: "crew@example.invalid", phone: "+000000000", secondary_phone: null, permanent_address: "Sample address", nearest_airport: "Sample Airport" },
      physical_profile: { height_cm: 180, weight_kg: 78, eye_color: "Brown", hair_color: "Black", shoe_size: "43", overall_size: "L" },
      identity_documents: [{ kind: "passport", label: "Passport", issuing_country: "Türkiye", document_number: "MASKED-001", issue_date: "2025-01-01", expiry_date: "2035-01-01", validity_status: "dated" }],
      education: [{ institution: "Maritime Academy", qualification: "Marine Engineering", field_of_study: "Engine" }],
      medical_records: [{ record_type: "medical_certificate", document_number: "MED-MASKED", result: "fit", issue_date: "2026-01-01", expiry_date: "2028-01-01" }],
      vaccinations: [{ vaccine_name: "Yellow Fever", document_number: "VAC-MASKED", validity_status: "non_expiring" }],
      emergency_contacts: [{ name: "Private Contact", relationship: "Relative", phone: "+000000001" }],
      references: [{ name: "Captain Example", company: "Example Shipping", position: "Master" }],
      skills: [{ name: "Microsoft Office", name_i18n: { tr: "Microsoft Office", en: "Microsoft Office" }, category: "digital" }],
      achievements: [{ title: "Safety Award", title_i18n: { tr: "Emniyet Ödülü", en: "Safety Award" }, details: "Awarded by employer", date: "2025-03-01" }],
      professional_summary: "Experienced seafarer.",
      desired_salary_amount: 3000,
      desired_salary_currency: "USD",
      availability_text: "Available in 14 days"
    }
  };
  const result = smart({ cvProfile: detailedProfile });
  assert.equal(result.cv_draft.identity_documents[0].kind, "passport");
  assert.equal(result.cv_draft.education[0].institution, "Maritime Academy");
  assert.equal(result.cv_draft.medical_records[0].result, "fit");
  assert.equal(result.cv_draft.vaccinations[0].validity_status, "non_expiring");
  assert.equal(result.cv_draft.contact.email, "crew@example.invalid");
  assert.equal(result.cv_draft.desired_salary_currency, "USD");
  assert.equal(result.cv_draft.skills[0].category, "digital");
  assert.equal(result.cv_draft.achievements[0].title, "Safety Award");
  assert.equal(result.cv_draft.professional_summary_origin, "document");
  assert.equal(result.cv_draft.emergency_contacts, undefined);
  assert.equal(result.profile.emergency_contacts[0].name, "Private Contact");
});

test("upgrades legacy certificate fields into automatic CV credential records", () => {
  const legacyProfile = {
    ...cvProfile,
    profile_payload: {
      ...cvProfile.profile_payload,
      certificate_records: undefined,
      document_type: "competency_certificate",
      document_title: "Certificate of Competency",
      document_number: "SI-2048",
      issuing_authority: "Maritime Authority",
      issue_date: "2025-02-01",
      expiry_date: "2030-02-01",
      certificate_codes: ["SI"]
    }
  };
  const result = smart({ cvProfile: legacyProfile });
  assert.equal(result.cv_draft.certificate_records[0].code, "SI");
  assert.equal(result.cv_draft.certificate_records[0].document_number, "SI-2048");
});

test("blocks readiness when a critical identity document is expired", () => {
  const expiredItems = readinessItems.map((item) => item.item_type === "passport" ? { ...item, expires_at: "2025-01-01" } : item);
  const result = smart({ readinessItems: expiredItems });
  assert.equal(result.readiness.ready_to_apply, false);
  assert.equal(result.readiness.seafarer_status, "review_required");
  assert.ok(result.readiness.blocking_reasons.includes("critical_document_expired"));
  assert.equal(result.readiness.expiry_alerts[0].severity, "expired");
});

test("surfaces conflicting identity facts instead of silently choosing one", () => {
  const result = smart({
    readinessItems: readinessItems.concat({
      id: "6",
      item_type: "identity",
      trust_level: "user_confirmed",
      verification_status: "pending_review",
      source_label: "other-passport.pdf",
      value_payload: { holder_name: "Different Person", date_of_birth: "1990-01-02", nationality: "TR" }
    })
  });
  assert.equal(result.readiness.ready_to_apply, false);
  assert.equal(result.readiness.seafarer_status, "review_required");
  assert.equal(result.readiness.conflicts[0].code, "conflicting_holder_name");
});

test("keeps maritime identity pending until confirmed evidence identifies the person and profession", () => {
  const result = smart({
    cvProfile: { profile_payload: {}, source_document_ids: [] },
    readinessItems: [],
    documents: []
  });
  assert.equal(result.readiness.seafarer_status, "not_assessed");
  assert.equal(result.readiness.seafarer_system_approved, false);
  assert.ok(result.readiness.seafarer_reason_codes.includes("confirmed_profile_required"));
  assert.ok(result.readiness.seafarer_reason_codes.includes("maritime_evidence_required"));
});

test("builds Global CV from a user-confirmed Maritime CV without treating archived files as verified evidence", () => {
  const result = smart({
    cvProfile: {
      profile_status: "user_confirmed",
      profile_payload: {
        ...cvProfile.profile_payload,
        data_origin: "user_entered_maritime_cv"
      },
      source_document_ids: []
    },
    readinessItems: [],
    documents: [{ id: "10000000-0000-4000-8000-000000000009", status: "uploaded" }]
  });
  assert.equal(result.profile.data_origin, "user_entered_maritime_cv");
  assert.equal(result.cv_draft.holder_name, "Sample Seafarer");
  assert.equal(result.readiness.confirmed_document_count, 0);
  assert.equal(result.readiness.seafarer_status, "evidence_required");
  assert.equal(result.readiness.seafarer_system_approved, false);
  assert.ok(result.readiness.seafarer_reason_codes.includes("documents_not_verified"));
});

test("scores transparent positive matches and never reveals company contact", () => {
  const match = matchMaritimeJob(smart(), {
    id: "20000000-0000-4000-8000-000000000001",
    partner_id: "30000000-0000-4000-8000-000000000001",
    job_reference: "MJ-CHIEF-01",
    job_title: "Chief Officer",
    rank_code: "chief_officer",
    hard_gates: {
      required_certificate_codes: ["II/2", "GMDSS"],
      minimum_sea_service_days: 300,
      medical_required: true,
      available_now_required: true
    },
    structured_requirements: { required_languages: [{ language: "English", level: "B2" }] }
  });
  assert.equal(match.score, 100);
  assert.equal(match.eligible, true);
  assert.equal(match.hard_gate_status, "passed");
  assert.equal(match.company_contact_visible, false);
  assert.equal(match.components.length, 6);
});

test("does not invent missing qualifications or mark a hard-gate mismatch eligible", () => {
  const match = matchMaritimeJob(smart(), {
    id: "20000000-0000-4000-8000-000000000002",
    partner_id: "30000000-0000-4000-8000-000000000001",
    job_reference: "MJ-MASTER-01",
    job_title: "Master",
    rank_code: "master",
    hard_gates: { required_certificate_codes: ["II/1", "ADVANCED-DP"], minimum_sea_service_days: 900 }
  });
  assert.equal(match.eligible, false);
  assert.equal(match.hard_gate_status, "failed");
  assert.ok(match.missing_requirements.includes("rank"));
  assert.ok(match.missing_requirements.some((item) => item.includes("ADVANCED-DP")));
});

test("never treats an underspecified job as eligible", () => {
  const match = matchMaritimeJob(smart(), {
    id: "20000000-0000-4000-8000-000000000003",
    partner_id: "30000000-0000-4000-8000-000000000001",
    job_reference: "MJ-INCOMPLETE-01",
    job_title: "Officer"
  });
  assert.equal(match.eligible, false);
  assert.equal(match.hard_gate_status, "needs_data");
  assert.ok(match.missing_requirements.includes("job_requirements_incomplete"));
});

test("smart snapshot hashes are stable across object key order and change with facts", () => {
  const first = maritimeSmartSnapshotHash({ profile: { rank: "Master", certificates: ["II/2"] }, version: 1 });
  const second = maritimeSmartSnapshotHash({ version: 1, profile: { certificates: ["II/2"], rank: "Master" } });
  const changed = maritimeSmartSnapshotHash({ version: 1, profile: { certificates: ["II/1"], rank: "Master" } });
  assert.equal(first, second);
  assert.notEqual(first, changed);
});
