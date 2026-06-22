import { createHmac } from "node:crypto";
import { config } from "../config.js";

function compactPost(post) {
  return {
    id: post.id,
    draft_id: post.draft_id,
    platform: post.platform,
    post_type: post.post_type,
    caption: post.caption,
    hashtags: post.hashtags || [],
    media_asset_ids: post.media_asset_ids || [],
    scheduled_for: post.scheduled_for || null,
    platform_payload: post.platform_payload || {}
  };
}

function compactDraft(draft) {
  return {
    id: draft?.id || "",
    campaign_id: draft?.campaign_id || null,
    title: draft?.title || "",
    content_theme: draft?.content_theme || "",
    hook: draft?.hook || "",
    body: draft?.body || "",
    cta: draft?.cta || "",
    landing_url: draft?.landing_url || "",
    language: draft?.language || "tr",
    content_hash: draft?.content_hash || "",
    semantic_hash: draft?.semantic_hash || "",
    visual_hash: draft?.visual_hash || null
  };
}

function compactAccount(account) {
  return {
    id: account?.id || "",
    platform: account?.platform || "",
    display_name: account?.display_name || "",
    handle: account?.handle || "",
    account_url: account?.account_url || "",
    external_account_id: account?.external_account_id || "",
    connector_mode: account?.connector_mode || "pending",
    connection_status: account?.connection_status || "not_connected",
    default_publish_mode: account?.default_publish_mode || "draft_after_approval",
    metadata: account?.metadata || {}
  };
}

function signature(body) {
  if (!config.socialMedia.dispatchWebhookSecret) return "";
  return `sha256=${createHmac("sha256", config.socialMedia.dispatchWebhookSecret).update(body).digest("hex")}`;
}

export function socialMediaDispatchStatus() {
  return {
    enabled: config.socialMedia.dispatchEnabled,
    dry_run: config.socialMedia.dryRun || !config.socialMedia.dispatchEnabled,
    webhook_configured: Boolean(config.socialMedia.dispatchWebhookUrl),
    default_timezone: config.socialMedia.defaultTimezone,
    max_batch: config.socialMedia.maxDispatchBatch,
    supported_connector_modes: ["manual", "server_webhook", "native_api", "pending"]
  };
}

export async function dispatchSocialMediaPost({ post, draft, account, requestId }) {
  const mode = account?.connector_mode || "pending";
  const dispatchStatus = socialMediaDispatchStatus();
  const payload = {
    event: "allonahub.social_media.publish",
    request_id: requestId || "",
    dry_run: dispatchStatus.dry_run,
    post: compactPost(post),
    draft: compactDraft(draft),
    account: compactAccount(account)
  };
  const body = JSON.stringify(payload);

  if (dispatchStatus.dry_run) {
    return {
      provider: "server_webhook",
      status: "dry_run",
      responseStatus: null,
      responseBody: "SOCIAL_MEDIA_DRY_RUN active or dispatch disabled.",
      externalPostId: "",
      externalUrl: "",
      errorMessage: ""
    };
  }

  if (!["server_webhook", "native_api"].includes(mode)) {
    return {
      provider: mode,
      status: "skipped",
      responseStatus: null,
      responseBody: "",
      externalPostId: "",
      externalUrl: "",
      errorMessage: `Connector mode ${mode} is not ready for automatic dispatch.`
    };
  }

  if (!config.socialMedia.dispatchWebhookUrl) {
    return {
      provider: "server_webhook",
      status: "skipped",
      responseStatus: null,
      responseBody: "",
      externalPostId: "",
      externalUrl: "",
      errorMessage: "SOCIAL_MEDIA_DISPATCH_WEBHOOK_URL is not configured."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, config.socialMedia.sendTimeoutMs));

  try {
    const headers = {
      "Content-Type": "application/json",
      "X-AllonaHub-Event": "social_media.publish",
      "X-AllonaHub-Request-Id": requestId || ""
    };
    const signed = signature(body);
    if (signed) headers["X-AllonaHub-Signature"] = signed;

    const response = await fetch(config.socialMedia.dispatchWebhookUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal
    });
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }

    return {
      provider: "server_webhook",
      status: response.ok ? "sent" : "failed",
      responseStatus: response.status,
      responseBody: text.slice(0, 2000),
      externalPostId: String(parsed.external_post_id || parsed.id || ""),
      externalUrl: String(parsed.external_url || parsed.url || ""),
      errorMessage: response.ok ? "" : (parsed.message || parsed.error || "Dispatch webhook returned an error.")
    };
  } catch (error) {
    return {
      provider: "server_webhook",
      status: "failed",
      responseStatus: null,
      responseBody: "",
      externalPostId: "",
      externalUrl: "",
      errorMessage: error?.name === "AbortError" ? "Dispatch webhook timed out." : (error?.message || "Dispatch failed.")
    };
  } finally {
    clearTimeout(timeout);
  }
}
