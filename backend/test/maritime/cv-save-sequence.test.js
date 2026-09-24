import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../../js/maritime-cv-form.js", import.meta.url), "utf8");
const saveRow = source.slice(source.indexOf("async function saveSeaExperience("), source.indexOf("function validImo("));
const saveAll = source.slice(source.indexOf("let cvSaveInProgress ="), source.indexOf("function autoSaveCV("));

function harness({ incomplete = false, failReference = false } = {}) {
  const calls = [];
  const alerts = [];
  const seaData = [{ vessel: "Sample vessel", saved: "false" }];
  const context = vm.createContext({
    seaData, autoSaveTimer: 0,
    document: { querySelector: () => null },
    validateSeaExperience: () => !incomplete,
    validateMaritimeCV: (options) => { const ready = !incomplete && seaData[0].saved === "true"; if (!ready && !options) alerts.push("required fields"); return ready; },
    seaRowHasData: () => true, t: (key) => key, alert: (message) => alerts.push(message),
    persistCV: () => { calls.push("local"); return true; }, renderSeaInputs() {}, renderSea() {}, syncCV() {},
    getCVData: () => ({ fields: {}, seaData }),
    window: { AllonaMaritimeCvAccount: {
      saveSeaExperience: async () => { calls.push("reference"); if (failReference) throw new Error("document mismatch"); return { notification: { status: "queued" } }; },
      save: async (_cv, options) => { calls.push(options.finalize ? "final" : "draft"); return { finalized: options.finalize }; }
    } }
  });
  vm.runInContext(`${saveRow}\n${saveAll}`, context);
  return { context, calls, alerts, seaData };
}

test("main Save securely saves a complete unsaved reference before final CV save, once", async () => {
  const { context, calls, alerts, seaData } = harness();
  await vm.runInContext("Promise.all([saveCV(), saveCV()])", context);
  assert.equal(seaData[0].saved, "true");
  assert.equal(calls.filter((call) => call === "reference").length, 1);
  assert.equal(calls.filter((call) => call === "final").length, 1);
  assert.ok(calls.indexOf("reference") < calls.indexOf("final"));
  assert.deepEqual(alerts, ["accountSaved"]);
});

test("incomplete reference preserves draft and explains missing fields without claiming final save", async () => {
  const { context, calls, alerts } = harness({ incomplete: true });
  await vm.runInContext("saveCV()", context);
  assert.ok(calls.includes("draft"));
  assert.ok(!calls.includes("reference") && !calls.includes("final"));
  assert.deepEqual(alerts, ["accountDraftSaved", "required fields"]);
});

test("reference rejection cannot turn an unsaved experience into a confirmed CV", async () => {
  const { context, calls, seaData, alerts } = harness({ failReference: true });
  await vm.runInContext("saveCV()", context);
  assert.equal(seaData[0].saved, "false");
  assert.ok(calls.includes("local") && !calls.includes("final"));
  assert.ok(!alerts.includes("accountSaved"));
});
