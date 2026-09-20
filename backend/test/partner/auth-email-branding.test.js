import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function source(file) {
  return fs.readFile(path.join(root, file), "utf8");
}

test("confirmation email uses the AllonaHub identity and secure verification link", async () => {
  const [template, script] = await Promise.all([
    source("supabase/auth-email-templates/confirmation.html"),
    source("scripts/apply-supabase-auth-email-branding.mjs")
  ]);

  assert.match(template, /Ekosisteme hoş geldiniz/);
  assert.match(template, /https:\/\/allonahub\.com\/images\/allona-logo-mark\.png/);
  assert.match(template, /href="\{\{ \.ConfirmationURL \}\}"/);
  assert.match(template, /AllonaHub giriş sayfasını aç/);
  assert.doesNotMatch(template, /<script\b/i);
  assert.doesNotMatch(template, /Alloana Hub|Allono Hub/);
  assert.match(script, /SUPABASE_AUTH_SENDER_NAME"\) \|\| "AllonaHub"/);
  assert.match(script, /mailer_subjects_confirmation/);
  assert.match(script, /readTemplate\("confirmation\.html"\)/);
});
