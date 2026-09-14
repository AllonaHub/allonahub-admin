import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../../supabase/migrations/20260914030000_harden_account_role_boundary.sql", import.meta.url);

test("partner membership requires a partner role and an active company", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create or replace function public\.partner_member_has_access/i);
  assert.match(sql, /business\.status\s*=\s*'active'/i);
  assert.match(sql, /profile\.role\s*=\s*'partner'/i);
});

test("customers cannot create or mutate partner businesses directly", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /partner_businesses_admin_insert[\s\S]*?with check \(public\.is_admin\(\)\)/i);
  assert.match(sql, /partner_businesses_admin_update[\s\S]*?using \(public\.is_admin\(\)\)[\s\S]*?with check \(public\.is_admin\(\)\)/i);
  assert.match(sql, /partner_businesses_admin_delete[\s\S]*?using \(public\.is_admin\(\)\)/i);
  assert.match(sql, /partner_staff_owner_or_admin_write[\s\S]*?business\.status\s*=\s*'active'[\s\S]*?profile\.role\s*=\s*'partner'/i);
  assert.doesNotMatch(sql, /for all[\s\S]{0,120}owner_id\s*=\s*auth\.uid\(\)/i);
});
