import { canonicalRank } from "./maritime-smart-profile.js";

export function summarizePartnerRankMatches(jobs, cvProfiles, activeUserIds, authorizedRooms) {
  const active = new Set(activeUserIds);
  const candidates = new Map();
  for (const cv of cvProfiles) {
    if (!active.has(cv.seafarer_user_id) || ["restricted", "stale"].includes(cv.profile_status)) continue;
    const payload = cv.profile_payload || {};
    if (payload.data_origin !== "user_entered_maritime_cv") continue;
    const rank = canonicalRank(payload.rank);
    if (rank) candidates.set(cv.seafarer_user_id, rank);
  }
  return jobs.filter((job) => job.status === "open").map((job) => {
    const rank = canonicalRank(job.rank_code);
    const matchedIds = new Set(rank ? [...candidates].filter(([, candidateRank]) => candidateRank === rank).map(([id]) => id) : []);
    const authorizedIds = new Set(authorizedRooms.filter((room) => room.job_id === job.id && matchedIds.has(room.seafarer_user_id)).map((room) => room.seafarer_user_id));
    return { job_id: job.id, eligible_count: matchedIds.size, authorized_count: authorizedIds.size };
  });
}
