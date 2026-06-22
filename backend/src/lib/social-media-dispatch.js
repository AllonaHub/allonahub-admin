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

function secret(secrets, key) {
  return String(secrets?.[key] || "").trim();
}

function firstUrl(...values) {
  for (const value of values) {
    const raw = String(value || "").trim();
    if (/^https:\/\//i.test(raw)) return raw;
  }
  return "";
}

function linkFromPost(post, draft) {
  return firstUrl(post?.platform_payload?.link, post?.platform_payload?.landing_url, draft?.landing_url);
}

function imageFromPost(post) {
  return firstUrl(post?.platform_payload?.image_url, post?.platform_payload?.media_url, post?.platform_payload?.thumbnail_url);
}

async function postJson(url, token, payload, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, config.socialMedia.sendTimeoutMs));
  try {
    const headers = {
      "Content-Type": "application/json",
      ...extraHeaders
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    Object.keys(headers).forEach((key) => {
      if (headers[key] === undefined || headers[key] === null) delete headers[key];
    });
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    return { response, text, parsed };
  } finally {
    clearTimeout(timeout);
  }
}

async function postForm(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, config.socialMedia.sendTimeoutMs));
  try {
    const response = await fetch(url, {
      method: "POST",
      body: new URLSearchParams(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null)),
      signal: controller.signal
    });
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    return { response, text, parsed };
  } finally {
    clearTimeout(timeout);
  }
}

function nativeResult({ response, text, parsed, externalPostId = "", externalUrl = "" }) {
  const id = externalPostId || parsed.id || parsed.data?.id || parsed.post_id || "";
  return {
    provider: "native_api",
    status: response.ok ? "sent" : "failed",
    responseStatus: response.status,
    responseBody: text.slice(0, 2000),
    externalPostId: String(id || ""),
    externalUrl: String(externalUrl || parsed.url || ""),
    errorMessage: response.ok ? "" : (parsed.message || parsed.error?.message || parsed.error || "Native API returned an error.")
  };
}

function skippedNative(message) {
  return {
    provider: "native_api",
    status: "skipped",
    responseStatus: null,
    responseBody: "",
    externalPostId: "",
    externalUrl: "",
    errorMessage: message
  };
}

async function publishNative({ post, draft, secrets }) {
  const platform = post.platform;
  const caption = String(post.caption || draft?.body || "").slice(0, 4000);
  if (platform === "x") {
    const token = secret(secrets, "ACCESS_TOKEN");
    if (!token) return skippedNative("X ACCESS_TOKEN missing.");
    const result = await postJson("https://api.x.com/2/tweets", token, { text: caption.slice(0, 280) });
    return nativeResult(result);
  }

  if (platform === "facebook") {
    const pageId = secret(secrets, "PAGE_ID");
    const token = secret(secrets, "PAGE_ACCESS_TOKEN");
    if (!pageId || !token) return skippedNative("Facebook PAGE_ID or PAGE_ACCESS_TOKEN missing.");
    const link = linkFromPost(post, draft);
    const result = await postForm(`${config.assistant.metaGraphBaseUrl}/${config.assistant.metaGraphVersion}/${encodeURIComponent(pageId)}/feed`, {
      message: caption,
      link: link || undefined,
      access_token: token
    });
    return nativeResult(result);
  }

  if (platform === "threads") {
    const userId = secret(secrets, "THREADS_USER_ID");
    const token = secret(secrets, "ACCESS_TOKEN");
    if (!userId || !token) return skippedNative("Threads THREADS_USER_ID or ACCESS_TOKEN missing.");
    const base = "https://graph.threads.net/v1.0";
    const created = await postForm(`${base}/${encodeURIComponent(userId)}/threads`, {
      media_type: "TEXT",
      text: caption,
      access_token: token
    });
    if (!created.response.ok || !created.parsed.id) return nativeResult(created);
    const published = await postForm(`${base}/${encodeURIComponent(userId)}/threads_publish`, {
      creation_id: created.parsed.id,
      access_token: token
    });
    return nativeResult(published);
  }

  if (platform === "instagram") {
    const userId = secret(secrets, "IG_USER_ID");
    const token = secret(secrets, "ACCESS_TOKEN");
    const imageUrl = imageFromPost(post);
    if (!userId || !token) return skippedNative("Instagram IG_USER_ID or ACCESS_TOKEN missing.");
    if (!imageUrl) return skippedNative("Instagram native publish requires platform_payload.image_url.");
    const base = `${config.assistant.metaGraphBaseUrl}/${config.assistant.metaGraphVersion}`;
    const created = await postForm(`${base}/${encodeURIComponent(userId)}/media`, {
      image_url: imageUrl,
      caption,
      access_token: token
    });
    if (!created.response.ok || !created.parsed.id) return nativeResult(created);
    const published = await postForm(`${base}/${encodeURIComponent(userId)}/media_publish`, {
      creation_id: created.parsed.id,
      access_token: token
    });
    return nativeResult(published);
  }

  if (platform === "linkedin") {
    const organizationUrn = secret(secrets, "ORGANIZATION_URN");
    const token = secret(secrets, "ACCESS_TOKEN");
    if (!organizationUrn || !token) return skippedNative("LinkedIn ORGANIZATION_URN or ACCESS_TOKEN missing.");
    const result = await postJson("https://api.linkedin.com/rest/posts", token, {
      author: organizationUrn,
      commentary: caption,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: []
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false
    }, {
      "LinkedIn-Version": "202606",
      "X-Restli-Protocol-Version": "2.0.0"
    });
    return nativeResult(result);
  }

  if (platform === "pinterest") {
    const boardId = secret(secrets, "BOARD_ID");
    const token = secret(secrets, "ACCESS_TOKEN");
    const imageUrl = imageFromPost(post);
    if (!boardId || !token) return skippedNative("Pinterest BOARD_ID or ACCESS_TOKEN missing.");
    if (!imageUrl) return skippedNative("Pinterest native publish requires platform_payload.image_url.");
    const result = await postJson("https://api.pinterest.com/v5/pins", token, {
      board_id: boardId,
      title: String(draft?.title || "AllonaHub").slice(0, 100),
      description: caption.slice(0, 500),
      link: linkFromPost(post, draft) || undefined,
      media_source: {
        source_type: "image_url",
        url: imageUrl
      }
    });
    return nativeResult(result);
  }

  if (platform === "telegram") {
    const botToken = secret(secrets, "BOT_TOKEN");
    const channelId = secret(secrets, "CHANNEL_ID");
    if (!botToken || !channelId) return skippedNative("Telegram BOT_TOKEN or CHANNEL_ID missing.");
    const result = await postJson(`https://api.telegram.org/bot${botToken}/sendMessage`, "", {
      chat_id: channelId,
      text: caption,
      disable_web_page_preview: false
    }, { Authorization: undefined });
    return nativeResult(result);
  }

  if (["tiktok", "youtube", "whatsapp", "google_business", "nsosyal"].includes(platform)) {
    return skippedNative(`${platform} native publish requires a dedicated adapter or approved platform flow.`);
  }

  return skippedNative(`${platform} native publish is not implemented.`);
}

export function socialMediaDispatchStatus() {
  return {
    enabled: config.socialMedia.dispatchEnabled,
    dry_run: config.socialMedia.dryRun || !config.socialMedia.dispatchEnabled,
    webhook_configured: Boolean(config.socialMedia.dispatchWebhookUrl),
    default_timezone: config.socialMedia.defaultTimezone,
    max_batch: config.socialMedia.maxDispatchBatch,
    supported_connector_modes: ["manual", "server_webhook", "native_api", "pending"],
    supported_native_platforms: ["x", "facebook", "threads", "instagram", "linkedin", "pinterest", "telegram"]
  };
}

export async function dispatchSocialMediaPost({ post, draft, account, requestId, connectorSecrets = {} }) {
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

  if (mode === "native_api") {
    return publishNative({ post, draft, account, secrets: connectorSecrets });
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
