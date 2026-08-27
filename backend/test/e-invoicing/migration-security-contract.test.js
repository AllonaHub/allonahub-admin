import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../../supabase/migrations/20260827120000_create_e_invoicing_center.sql", import.meta.url);

async function migration() {
  return readFile(migrationUrl, "utf8");
}

function functionBody(sql, functionName, nextFunctionName) {
  const start = sql.indexOf(`create or replace function public.${functionName}`);
  assert.notEqual(start, -1, `${functionName} must exist`);
  const end = nextFunctionName
    ? sql.indexOf(`create or replace function public.${nextFunctionName}`, start + 1)
    : sql.length;
  assert.notEqual(end, -1, `${nextFunctionName} must follow ${functionName}`);
  return sql.slice(start, end);
}

test("privileged e-invoicing tenant writes require AAL2 or service role", async () => {
  const sql = await migration();
  const assurance = functionBody(sql, "e_invoicing_has_write_assurance", "add_organization_creator_as_owner");

  assert.match(assurance, /public\.has_mfa\(\)/i);
  assert.match(assurance, /auth\.role\(\)[\s\S]*?service_role/i);
  assert.match(sql, /revoke all on function public\.e_invoicing_has_write_assurance\(\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.e_invoicing_has_write_assurance\(\) to authenticated, service_role/i);
});

test("the authenticated organization RPC fails closed without write assurance", async () => {
  const sql = await migration();
  const body = functionBody(sql, "create_e_invoicing_organization", "resolve_unified_seller_sub_order");

  assert.match(body, /if not public\.e_invoicing_has_write_assurance\(\)[\s\S]*?MFA required/i);
  assert.match(body, /grant execute on function public\.create_e_invoicing_organization\(text, text\) to authenticated/i);
});

test("every tenant management helper is protected by the central assurance predicate", async () => {
  const sql = await migration();
  const helpers = [
    ["organization_member_can_manage", "legal_entity_member_has_access"],
    ["legal_entity_member_can_manage", "seller_member_has_access"],
    ["seller_member_can_manage", "sales_channel_account_member_can_manage"],
    ["sales_channel_account_member_can_manage", "sales_channel_account_member_has_access"]
  ];

  for (const [name, next] of helpers) {
    assert.match(
      functionBody(sql, name, next),
      /select public\.e_invoicing_has_write_assurance\(\)[\s\S]*?and\s*\(/i,
      `${name} must reject AAL1 writes`
    );
  }
});

test("direct organization insertion and server-only configuration remain protected", async () => {
  const sql = await migration();

  assert.match(
    sql,
    /create policy "organizations_insert_creator"[\s\S]*?with check \(public\.e_invoicing_has_write_assurance\(\) and created_by = auth\.uid\(\)\)/i
  );
  for (const table of [
    "sales_channel_accounts",
    "invoice_provider_accounts",
    "invoice_profiles",
    "invoice_settings",
    "customer_invoice_profiles"
  ]) {
    assert.match(sql, new RegExp(`revoke insert, update, delete on public\\.${table} from authenticated`, "i"));
  }
});

test("return and cancellation provider side effects are database fenced", async () => {
  const sql = await migration();
  const reservation = functionBody(sql, "reserve_invoice_document_operation", "mark_invoice_job_provider_call_started");
  const providerBoundary = functionBody(sql, "mark_invoice_job_provider_call_started", "reject_invoice_return_request");
  const rejection = functionBody(sql, "reject_invoice_return_request", "claim_invoice_jobs");

  assert.match(reservation, /for update/i);
  assert.match(reservation, /invoice_document_operation_guards/i);
  assert.match(reservation, /invoice_returns[\s\S]*?invoice_cancellations/i);
  assert.match(providerBoundary, /lock_expires_at > now\(\)/i);
  assert.match(providerBoundary, /provider_call_started_at = coalesce/i);
  assert.match(providerBoundary, /operation_type = requested_operation/i);
  assert.match(rejection, /invoice_return_items|invoice_items/i);
  assert.match(rejection, /provider_call_started_at is not null/i);
  assert.match(rejection, /status = 'REJECTED'/i);
  assert.match(rejection, /status = 'RELEASED'/i);
  assert.match(sql, /revoke all on function public\.reject_invoice_return_request\(uuid, uuid, text, text, text\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.reject_invoice_return_request\(uuid, uuid, text, text, text\) to service_role/i);
});

test("customer RLS hides unissued return workflow placeholders", async () => {
  const sql = await migration();
  const invoiceAccess = functionBody(sql, "invoice_record_has_access", "invoice_operational_record_has_access");
  const customerReturnEvidence = /document_scope\s*=\s*'RETURN'[\s\S]*?document_type\s*=\s*'RETURN'[\s\S]*?provider_document_id is not null[\s\S]*?ettn_uuid is not null[\s\S]*?invoice_number is not null[\s\S]*?issued_at is not null/i;

  assert.match(invoiceAccess, customerReturnEvidence);
  assert.match(
    sql,
    /create policy "invoices_select_authorized"[\s\S]*?customer_id = auth\.uid\(\)[\s\S]*?document_scope = 'CUSTOMER_SALE'[\s\S]*?document_scope = 'RETURN'[\s\S]*?issued_at is not null/i
  );
});

test("legacy text order-item identifiers remain compatible with uuid order records", async () => {
  const sql = await migration();

  assert.match(sql, /oi\.order_id::text\s*=\s*p_order_id::text/i);
  assert.match(sql, /o\.id::text\s*=\s*order_items\.order_id::text/i);
  assert.match(sql, /sso\.order_id::text\s*=\s*new\.order_id::text/i);
  assert.match(sql, /join scoped_totals st on st\.order_id\s*=\s*o\.id::text/i);
});

test("legacy text partner identifiers are compared without unsafe uuid casts", async () => {
  const sql = await migration();

  assert.match(sql, /oi\.partner_id::text\s*=\s*auth\.uid\(\)::text/i);
  assert.match(sql, /partner_id::text\s*=\s*auth\.uid\(\)::text/i);
});
