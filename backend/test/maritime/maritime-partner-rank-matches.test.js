import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizePartnerRankMatches } from "../../src/lib/maritime-partner-rank-matches.js";

test("saved Maritime CV ranks match open jobs without a Global CV run", () => {
  const jobs = [
    { id: "master-job", status: "open", rank_code: "master" },
    { id: "oiler-job", status: "open", rank_code: "oiler" },
    { id: "closed-job", status: "closed", rank_code: "master" }
  ];
  const cvs = [
    { seafarer_user_id: "a", profile_status: "draft", profile_payload: { data_origin: "user_entered_maritime_cv", rank: "Kaptan" } },
    { seafarer_user_id: "b", profile_status: "verified", profile_payload: { data_origin: "user_entered_maritime_cv", rank: "Master" } },
    { seafarer_user_id: "c", profile_status: "user_confirmed", profile_payload: { data_origin: "user_entered_maritime_cv", rank: "Yağcı" } },
    { seafarer_user_id: "d", profile_status: "restricted", profile_payload: { data_origin: "user_entered_maritime_cv", rank: "Master" } },
    { seafarer_user_id: "e", profile_status: "draft", profile_payload: { data_origin: "document_extracted", rank: "Master" } }
  ];
  const rooms = [{ job_id: "master-job", seafarer_user_id: "a" }];
  assert.deepEqual(summarizePartnerRankMatches(jobs, cvs, ["a", "b", "c", "d", "e"], rooms), [
    { job_id: "master-job", eligible_count: 2, authorized_count: 1 },
    { job_id: "oiler-job", eligible_count: 1, authorized_count: 0 }
  ]);
});

test("suspended accounts and missing ranks are never counted", () => {
  const jobs = [{ id: "job", status: "open", rank_code: "master" }];
  const cvs = [
    { seafarer_user_id: "suspended", profile_status: "verified", profile_payload: { data_origin: "user_entered_maritime_cv", rank: "Master" } },
    { seafarer_user_id: "empty", profile_status: "draft", profile_payload: { data_origin: "user_entered_maritime_cv", rank: "" } }
  ];
  assert.deepEqual(summarizePartnerRankMatches(jobs, cvs, ["empty"], []), [{ job_id: "job", eligible_count: 0, authorized_count: 0 }]);
});
