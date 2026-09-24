import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("../../../js/account-documents.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/migrations/20260925110000_account_documents_server_storage.sql", import.meta.url), "utf8");

function harness(options = {}) {
  const docs = [];
  const uploaded = [];
  const handlers = {};
  const messages = [];
  const submit = { disabled: false };
  const list = { innerHTML: "" };
  const form = {
    addEventListener: (name, handler) => { handlers[name] = handler; },
    querySelector: () => submit,
    reset: () => { handlers.reset = true; }
  };
  const elements = {
    "[data-page='documents']": {},
    "[data-document-form]": form,
    "[data-document-list]": list,
    "[data-document-status]": {}
  };
  const document = {
    addEventListener: (name, handler) => { handlers[`document:${name}`] = handler; },
    querySelector: (selector) => elements[selector] || null,
    createElement: () => ({
      set textContent(value) { this.innerHTML = String(value); },
      innerHTML: ""
    })
  };
  const builder = {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    limit: async () => ({ data: [...docs], error: null }),
    insert(row) {
      return {
        select: () => ({
          single: async () => {
            const saved = { ...row, status: "stored", created_at: new Date().toISOString() };
            docs.push(saved);
            return { data: saved, error: null };
          }
        })
      };
    }
  };
  const client = {
    from: () => builder,
    storage: {
      from: () => ({
        upload: async (path) => {
          uploaded.push(path);
          return { error: options.uploadError ? new Error("Storage unavailable") : null };
        },
        remove: async () => ({ error: null })
      })
    }
  };
  class FakeFile {
    constructor() {
      this.name = "certificate.pdf";
      this.type = "application/pdf";
      this.size = 100;
    }
  }
  const values = {
    type: "certificate",
    title: "Safety Certificate",
    note: "",
    file: new FakeFile()
  };
  const window = {
    Allona: {
      core: { renderStatus: (_target, message, type) => messages.push({ message, type }) },
      auth: { requireAccountType: async () => true }
    },
    AllonaProfileSync: {
      createClient: () => client,
      load: async () => ({ user: { id: "11111111-1111-4111-8111-111111111111" }, profile: {} }),
      isMaritimeProfile: () => false
    },
    indexedDB: null
  };
  runInNewContext(source, {
    window, document, location: { replace() {}, href: "" },
    localStorage: { getItem: () => null, setItem() {} },
    indexedDB: null,
    File: FakeFile,
    crypto: { randomUUID: () => "22222222-2222-4222-8222-222222222222" },
    FormData: class { get(key) { return values[key]; } },
    Date, Math, Set, Error, Array, String, Number, Promise, console
  });
  return { docs, uploaded, handlers, messages, list, submit };
}

test("private server storage and owner-only records are required", () => {
  assert.match(migration, /'account-documents', 'account-documents', false/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /status = 'stored'/);
  assert.match(migration, /account_document_upload_capacity/);
});

test("a document is acknowledged only after storage and database writes", async () => {
  const app = harness();
  await app.handlers["document:DOMContentLoaded"]();
  await app.handlers.submit({ preventDefault() {} });
  assert.equal(app.uploaded.length, 1);
  assert.equal(app.docs.length, 1);
  assert.match(app.list.innerHTML, /Hesapta saklandı/);
  assert.equal(app.messages.at(-1).type, "success");
});

test("storage outage cannot produce a false saved state", async () => {
  const app = harness({ uploadError: true });
  await app.handlers["document:DOMContentLoaded"]();
  await app.handlers.submit({ preventDefault() {} });
  assert.equal(app.docs.length, 0);
  assert.equal(app.messages.at(-1).type, "error");
  assert.equal(app.submit.disabled, false);
});
