import test from "node:test";
import assert from "node:assert/strict";
import { assertInvoiceTransition, canTransitionInvoice, canTransitionWorkflow } from "../../src/modules/e-invoicing/state-machine.js";

test("valid invoice lifecycle transitions are accepted", () => {
  assert.equal(canTransitionInvoice("DRAFT", "QUEUED"), true);
  assert.equal(canTransitionInvoice("QUEUED", "PROCESSING"), true);
  assert.equal(canTransitionInvoice("ISSUED", "SENT"), true);
  assert.equal(canTransitionInvoice("ACCEPTED", "CANCEL_PENDING"), true);
});

test("invalid invoice lifecycle transitions are rejected", () => {
  assert.equal(canTransitionInvoice("DRAFT", "ACCEPTED"), false);
  assert.equal(canTransitionInvoice("ISSUED", "CANCELLED"), false);
  assert.throws(() => assertInvoiceTransition("CANCELLED", "QUEUED"), /Geçersiz/);
});

test("return and cancellation workflows stay separate", () => {
  assert.equal(canTransitionWorkflow("REQUESTED", "REVIEW"), true);
  assert.equal(canTransitionWorkflow("COMPLETED", "QUEUED"), false);
});
