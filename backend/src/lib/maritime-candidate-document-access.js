export function canViewCandidateDocuments(application, grant, now = Date.now()) {
  if (!application || !["submitted", "shortlisted", "interviewing", "offer_sent", "offer_accepted", "hired"].includes(application.status)
    || application.candidate_consent_snapshot?.final_submission_confirmed !== true) return false;
  if (["declined", "revoked"].includes(grant?.status)) return false;
  return application.candidate_consent_snapshot?.documents_share_confirmed === true
    || (grant?.status === "accepted" && Date.parse(grant.expires_at) > now);
}
