import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../../supabase/migrations/20260916183000_create_marsoh_community_chat.sql", import.meta.url);
const routeUrl = new URL("../../src/routes/marsoh.js", import.meta.url);
const appUrl = new URL("../../src/app.js", import.meta.url);
const uiUrl = new URL("../../../js/marsoh.js", import.meta.url);
const speechUrl = new URL("../../../js/marsoh-speech-provider.js", import.meta.url);
const pageUrl = new URL("../../../pages/ecosystem/maritime-marsoh.html", import.meta.url);
const cssUrl = new URL("../../../css/marsoh.css", import.meta.url);
const modulePageUrl = new URL("../../../pages/ecosystem/allonadenizcilik.html", import.meta.url);
const adminPageUrl = new URL("../../../admin/super-admin.html", import.meta.url);
const adminUiUrl = new URL("../../../js/super-admin.js", import.meta.url);
const reactionMigrationUrl = new URL("../../../supabase/migrations/20260919203000_expand_marsoh_languages_and_reactions.sql", import.meta.url);
const adminManagementMigrationUrl = new URL("../../../supabase/migrations/20260920013000_expand_marsoh_admin_management.sql", import.meta.url);
const maritimeDeployUrl = new URL("../../../deploy/maritime/apply-maritime-migrations.sh", import.meta.url);
const maritimeSchemaCheckUrl = new URL("../../../deploy/maritime/check-maritime-hiring-core.sh", import.meta.url);

async function sources() {
  return Promise.all([migrationUrl, routeUrl, appUrl, uiUrl, speechUrl, pageUrl, cssUrl, modulePageUrl, adminPageUrl, adminUiUrl, reactionMigrationUrl, adminManagementMigrationUrl].map((url) => readFile(url, "utf8")));
}

test("unauthenticated visitors cannot read or write MarSoh", async () => {
  const [, route, , ui] = await sources();
  assert.match(route, /if \(!ctx\?\.user \|\| !ctx\.profilePersisted\).*AUTH_REQUIRED/);
  assert.match(route, /requireMarsohUser\(request, "marsoh\.messages\.list"\)/);
  assert.match(route, /requireMarsohUser\(request, "marsoh\.message\.send"\)/);
  assert.match(ui, /loginGate\(true\)/);
});

test("published messages alone enter the authenticated Realtime projection", async () => {
  const [migration, route, , ui] = await sources();
  assert.match(migration, /alter publication supabase_realtime add table public\.marsoh_published_messages/);
  assert.doesNotMatch(migration, /alter publication supabase_realtime add table public\.marsoh_messages/);
  assert.match(route, /p_decision: decision/);
  assert.match(ui, /table: "marsoh_published_messages"/);
});

test("quarantined sender response is masked as accepted and sent", async () => {
  const [migration, route] = await sources();
  const sendHandler = route.slice(
    route.indexOf('app.post("/v1/maritime/marsoh/messages"'),
    route.indexOf('app.post("/v1/maritime/marsoh/channels/:channelId/read"')
  );
  const senderResponse = sendHandler.slice(sendHandler.lastIndexOf("reply.code(202)"));
  assert.match(senderResponse, /reply\.code\(202\)/);
  assert.match(senderResponse, /accepted: true/);
  assert.doesNotMatch(senderResponse, /quarantined|confidence|rule_code|moderation/);
  assert.match(migration, /message\.sender_user_id = auth\.uid\(\)/);
});

test("other users cannot read quarantined messages through tables, RPC, or Realtime", async () => {
  const [migration] = await sources();
  assert.match(migration, /revoke all on table public\.marsoh_messages from public, anon, authenticated/);
  assert.match(migration, /revoke all on table public\.marsoh_moderation_decisions from public, anon, authenticated/);
  assert.match(migration, /from public\.marsoh_published_messages published/);
  assert.match(migration, /and published\.sender_user_id <> auth\.uid\(\)/);
  assert.match(migration, /union all[\s\S]*message\.sender_user_id = auth\.uid\(\)/);
  assert.match(migration, /public\.marsoh_can_read_channel\(channel_id\)[\s\S]*sender_user_id <> auth\.uid\(\)/);
});

test("sender cannot infer quarantine through its own published projection", async () => {
  const [migration, route] = await sources();
  assert.match(migration, /create policy marsoh_published_member_select[\s\S]*sender_user_id <> auth\.uid\(\)/);
  assert.match(route, /denyOwnMessageAction\(ctx, messageId\)/);
  assert.doesNotMatch(migration, /grant select on table public\.marsoh_message_reactions to authenticated/);
});

test("direct message insertion and moderation updates are service-role only", async () => {
  const [migration] = await sources();
  assert.match(migration, /MARSOH_SERVICE_ROLE_REQUIRED/);
  assert.match(migration, /revoke all on function public\.marsoh_visible_messages\(uuid,timestamptz,integer\) from public, anon/);
  assert.match(migration, /revoke all on function public\.marsoh_accept_text_message[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.marsoh_admin_decide_message[\s\S]*from public, anon, authenticated/);
});

test("idempotent offline outbox retries without duplicate server messages", async () => {
  const [migration, , , ui] = await sources();
  assert.match(migration, /unique \(sender_user_id, idempotency_key\)/);
  assert.match(migration, /on conflict \(sender_user_id, idempotency_key\) do nothing/);
  assert.match(ui, /idempotency_key: uuid\(\)/);
  const [, route] = await sources();
  assert.match(route, /\.eq\("sender_user_id", ctx\.user\.id\)\.eq\("idempotency_key", input\.idempotency_key\)/);
  assert.match(ui, /indexedDB\.open\(DB_NAME, 1\)/);
  assert.match(ui, /window\.addEventListener\("online", async \(\) =>[\s\S]*await flushOutbox\(\)/);
});

test("network failures expose retry and delete while policy failures expose edit and delete", async () => {
  const [, , , ui] = await sources();
  assert.match(ui, /failure_type = policyError\(error\) \? "policy" : "network"/);
  assert.match(ui, /message\.failure_type === "policy"[\s\S]*t\("edit"\)/);
  assert.match(ui, /t\("retry"\)/);
  assert.match(ui, /t\("remove"\)/);
});

test("translation is authenticated, rate limited, cached, and published-only", async () => {
  const [migration, route, , ui] = await sources();
  assert.match(route, /visiblePublished\(ctx, messageId\)/);
  assert.match(route, /denyOwnMessageAction\(ctx, messageId\)/);
  assert.match(route, /MARSOH_TRANSLATION_RATE_LIMITED/);
  assert.match(route, /marsoh_translation_cache/);
  assert.match(migration, /unique \(message_id, target_language, source_hash\)/);
  const controls = ui.slice(ui.indexOf("function addTranslationControls"), ui.indexOf("async function toggleReaction"));
  assert.match(controls, /message\.own/);
  assert.match(ui, /allona\.marsoh\.autoTranslate/);
  assert.match(ui, /sourceLanguage !== state\.locale/);
  assert.match(ui, /reserveAutomaticTranslation\(\)/);
});

test("speech provider produces editable text and never creates audio media", async () => {
  const [, , , ui, speech, page] = await sources();
  assert.match(speech, /SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(speech, /interimResults = true/);
  assert.match(speech, /combinedText: joinSpeech\(\[this\.finalText, interimText\]\)/);
  assert.match(speech, /this\.desiredActive[\s\S]*this\.startRecognition\(\)/);
  assert.match(ui, /onText\(\{ combinedText \}\)/);
  assert.doesNotMatch(`${speech}\n${ui}\n${page}`, /MediaRecorder|audio\/|Blob\(|getUserMedia|voice_message/);
  assert.match(page, /data-marsoh-voice-typing="disabled"/);
  assert.match(ui, /dataset\.marsohVoiceTyping !== "enabled"/);
});

test("translation languages and emoji reactions share the same strict server and database allowlists", async () => {
  const [, route, , ui, , , , , , , reactionMigration] = await sources();
  for (const language of ["tr", "az", "en", "de", "ru", "ar", "kk", "uz", "ky"]) {
    assert.match(route, new RegExp(`"${language}"`));
  }
  for (const emoji of ["👍", "❤️", "👏", "⚓", "🌊", "💪", "🙏", "🫡", "🚢", "🧭", "✨", "😊"]) {
    assert.ok(route.includes(emoji), `server reaction allowlist is missing ${emoji}`);
    assert.ok(ui.includes(emoji), `client reaction allowlist is missing ${emoji}`);
    assert.ok(reactionMigration.includes(emoji), `database reaction constraint is missing ${emoji}`);
  }
});

test("MarSoh has no attachment, camera, file, video, audio, GIF, or storage feature", async () => {
  const [migration, route, , ui, , page] = await sources();
  assert.doesNotMatch(page, /type=["']file|accept=["']|attach|camera|gallery|gif|sticker/i);
  assert.doesNotMatch(route, /attachment|storage\.from|bucket|multipart/i);
  assert.doesNotMatch(migration, /attachment|storage\.buckets|storage\.objects/i);
  assert.doesNotMatch(ui, /FormData|FileReader|MediaRecorder/);
});

test("blocking hides sender messages at API, RPC, RLS, and UI layers", async () => {
  const [migration, route, , ui] = await sources();
  assert.match(migration, /marsoh_sender_is_blocked/);
  assert.match(route, /blocked\.has\(row\.sender_user_id\)/);
  assert.match(route, /app\.post\("\/v1\/maritime\/marsoh\/blocks"/);
  assert.match(ui, /state\.messages = state\.messages\.filter\(\(item\) => item\.sender\?\.id !== message\.sender\.id\)/);
});

test("admin moderation requires MFA and every decision is audited", async () => {
  const [migration, route, , , , , , , adminPage, adminUi] = await sources();
  assert.match(route, /hasRole\(ctx\.profile, \["admin", "super_admin"\]\) \|\| !hasMfa\(ctx\)/);
  assert.match(route, /marsoh\.moderation\.context_viewed/);
  assert.match(migration, /marsoh\.moderation\.' \|\| p_decision/);
  assert.match(adminPage, /data-view-target="marsoh-moderation"/);
  assert.match(adminUi, /data-marsoh-admin-action="published"/);
  assert.match(adminUi, /data-marsoh-admin-action="rejected"/);
  assert.match(adminUi, /data-marsoh-report-action="dismissed"/);
  assert.match(route, /\/v1\/admin\/marsoh\/reports\/:reportId\/decision/);
});

test("MarSoh owner management controls rooms, topics, announcements, reports, and public removals", async () => {
  const [, route, , , , , , , adminPage, adminUi, , managementMigration] = await sources();
  const [deployScript, schemaCheck] = await Promise.all([readFile(maritimeDeployUrl, "utf8"), readFile(maritimeSchemaCheckUrl, "utf8")]);
  assert.match(adminPage, /data-view-target="marsoh-moderation">MarSoh<\/button>/);
  assert.match(adminUi, /data-marsoh-announcement-form/);
  assert.match(adminUi, /data-marsoh-topic-form/);
  assert.match(adminUi, /data-marsoh-channel-form/);
  assert.match(adminUi, /data-marsoh-bulk-remove/);
  assert.match(adminUi, /Tüm Yayınlanmış Mesajları Sil/);
  assert.match(route, /app\.get\("\/v1\/admin\/marsoh\/management"[\s\S]*requireModerator\(request, "marsoh\.management\.read"\)/);
  assert.match(route, /app\.patch\("\/v1\/admin\/marsoh\/channels\/:channelId"[\s\S]*marsoh\.management\.channel_updated/);
  assert.match(route, /app\.put\("\/v1\/admin\/marsoh\/topics\/:topicDate"[\s\S]*marsoh\.management\.topic_updated/);
  assert.match(route, /app\.post\("\/v1\/admin\/marsoh\/messages"[\s\S]*ADMIN_NOTICE/);
  assert.match(route, /app\.post\("\/v1\/admin\/marsoh\/messages\/bulk-remove"/);
  assert.match(route, /confirmation: z\.literal\("MARSOH_ALL_MESSAGES_REMOVE"\)/);
  assert.match(managementMigration, /create or replace function public\.marsoh_admin_remove_published_messages/);
  assert.match(managementMigration, /delete from public\.marsoh_published_messages/);
  assert.doesNotMatch(managementMigration, /delete from public\.marsoh_messages/);
  assert.match(managementMigration, /MARSOH_SERVICE_ROLE_REQUIRED/);
  assert.match(managementMigration, /marsoh\.management\.bulk_removed/);
  assert.match(deployScript, /20260920013000_expand_marsoh_admin_management\.sql/);
  assert.match(schemaCheck, /marsoh_admin_remove_published_messages\(uuid,text,uuid\)/);
});

test("admin removals disappear from open chats and Turkish/Azerbaijani room text has safe fallbacks", async () => {
  const [, , , ui, , , , , , , , managementMigration] = await sources();
  assert.match(ui, /event: "DELETE"[\s\S]*table: "marsoh_published_messages"/);
  assert.match(ui, /state\.messages = state\.messages\.filter/);
  assert.match(ui, /COUNTRY_ROOM_NOTICES/);
  assert.match(ui, /hasBrokenEncoding/);
  assert.match(managementMigration, /U&'Sayg\\0131l\\0131, g\\00FCvenli/);
  assert.match(managementMigration, /U&'H\\00F6rm\\0259tli, t\\0259hl\\00FCk\\0259siz/);
});

test("message reports remain as evidence when a published projection is removed", async () => {
  const [migration] = await sources();
  assert.match(migration, /message_id uuid not null references public\.marsoh_messages\(id\) on delete restrict/);
  assert.doesNotMatch(migration, /marsoh_message_reports \([\s\S]{0,300}references public\.marsoh_published_messages/);
});

test("verified-country rooms are server-created and cannot be client-created", async () => {
  const [migration, route] = await sources();
  assert.match(route, /\.eq\("kyc_status", "verified"\)/);
  assert.match(route, /slug: `country-\$\{country\.country_code\.toLowerCase\(\)\}`/);
  assert.match(route, /created_by_system: true/);
  assert.doesNotMatch(route, /app\.post\("\/v1\/maritime\/marsoh\/channels"\s*,/);
  assert.match(migration, /marsoh_channels_country_unique/);
});

test("company actors stay behind the disabled feature flag and verified-company check", async () => {
  const [, route] = await sources();
  assert.match(route, /companyMessagingEnabled/);
  assert.match(route, /MARSOH_COMPANY_MESSAGING_DISABLED/);
  assert.match(route, /verification_status", "verified"/);
  assert.match(route, /badge: "verified_company"/);
});

test("text is rendered with textContent rather than executable HTML", async () => {
  const [, , , ui, , , , , , adminUi] = await sources();
  assert.match(ui, /body\.textContent = message\.body/);
  assert.match(adminUi, /escape\(message\.body \|\| "-"\)/);
  assert.doesNotMatch(ui, /innerHTML\s*=\s*message\.body/);
});

test("the responsive UI covers required widths, keyboard labels, and reduced motion", async () => {
  const [, , , , , page, css] = await sources();
  assert.match(page, /aria-label="MarSoh sohbet alanını aç"|aria-label="Mesaj gönder"/);
  assert.match(page, /role="log"/);
  assert.match(page, /tabindex="0"/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /width: 48px; height: 48px/);
  assert.match(page, /data-marsoh-auto-translate/);
  assert.match(css, /\.marsoh-auto-translate/);
});

test("the maritime module exposes the exact MarSoh name, route, accessible label, and unread badge", async () => {
  const [, , , , , , , modulePage] = await sources();
  assert.match(modulePage, />MarSoh</);
  assert.match(modulePage, /href="\/(?:maritime\/marsoh|pages\/ecosystem\/maritime-marsoh\.html)"/);
  assert.match(modulePage, /data-maritime-i18n-aria="marsohAria"/);
  assert.match(modulePage, /data-marsoh-entry-unread/);
});

test("application registers the MarSoh backend routes", async () => {
  const [, , app] = await sources();
  assert.match(app, /registerMarsohRoutes/);
});
