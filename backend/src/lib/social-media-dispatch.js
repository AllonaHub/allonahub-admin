import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
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

function videoFromPost(post) {
  return firstUrl(post?.platform_payload?.video_url, post?.platform_payload?.media_url);
}

function payloadValue(post, key, fallback = "") {
  const value = post?.platform_payload?.[key];
  if (value === undefined || value === null || value === "") return fallback;
  return value;
}

function payloadBool(post, key, fallback = false) {
  const value = payloadValue(post, key, fallback);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  return Boolean(value);
}

function publicHttpsUrl(value, label) {
  const raw = String(value || "").trim();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} valid bir HTTPS URL olmali.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} sadece HTTPS URL olabilir.`);
  }
  return parsed;
}

function isPrivateAddress(address) {
  const version = isIP(address);
  if (!version) return false;
  if (version === 6) {
    const lower = address.toLowerCase();
    return lower === "::1"
      || lower.startsWith("fc")
      || lower.startsWith("fd")
      || lower.startsWith("fe80:")
      || lower === "::";
  }
  const parts = address.split(".").map((item) => Number(item));
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

async function requirePublicHttpsUrl(value, label) {
  const parsed = publicHttpsUrl(value, label);
  const host = parsed.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host) || host.endsWith(".local")) {
    throw new Error(`${label} public HTTPS host kullanmali.`);
  }
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error(`${label} private/internal IP adresine cozumlenemez.`);
  }
  return parsed.toString();
}

async function fetchRemoteMedia(url, label) {
  const publicUrl = await requirePublicHttpsUrl(url, label);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(5000, config.socialMedia.sendTimeoutMs * 2));
  try {
    const response = await fetch(publicUrl, { method: "GET", signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${label} indirilemedi. HTTP ${response.status}`);
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > config.socialMedia.maxMediaBytes) {
      throw new Error(`${label} dosyasi SOCIAL_MEDIA_MAX_MEDIA_BYTES limitini asiyor.`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > config.socialMedia.maxMediaBytes) {
      throw new Error(`${label} dosyasi SOCIAL_MEDIA_MAX_MEDIA_BYTES limitini asiyor.`);
    }
    return {
      bytes,
      contentType: response.headers.get("content-type") || "application/octet-stream",
      contentLength: bytes.byteLength
    };
  } finally {
    clearTimeout(timeout);
  }
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

async function getJson(url, token, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, config.socialMedia.sendTimeoutMs));
  try {
    const headers = { ...extraHeaders };
    if (token) headers.Authorization = `Bearer ${token}`;
    Object.keys(headers).forEach((key) => {
      if (headers[key] === undefined || headers[key] === null) delete headers[key];
    });
    const response = await fetch(url, {
      method: "GET",
      headers,
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

async function putBytes(url, token, bytes, contentType, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(10000, config.socialMedia.sendTimeoutMs * 4));
  try {
    const headers = {
      "Content-Type": contentType || "application/octet-stream",
      ...extraHeaders
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    Object.keys(headers).forEach((key) => {
      if (headers[key] === undefined || headers[key] === null) delete headers[key];
    });
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: bytes,
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
  const id = externalPostId
    || parsed.id
    || parsed.data?.id
    || parsed.data?.publish_id
    || parsed.data?.share_id
    || parsed.post_id
    || parsed.name
    || "";
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

function failedNative(message, responseStatus = null, responseBody = "") {
  return {
    provider: "native_api",
    status: "failed",
    responseStatus,
    responseBody: String(responseBody || "").slice(0, 2000),
    externalPostId: "",
    externalUrl: "",
    errorMessage: message
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

async function googleAccessToken(secrets) {
  const accessToken = secret(secrets, "ACCESS_TOKEN");
  if (accessToken) return { token: accessToken };

  const clientId = secret(secrets, "CLIENT_ID");
  const clientSecret = secret(secrets, "CLIENT_SECRET");
  const refreshToken = secret(secrets, "REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    return { error: "Google ACCESS_TOKEN veya CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN missing." };
  }

  const result = await postForm("https://oauth2.googleapis.com/token", {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });
  if (!result.response.ok || !result.parsed.access_token) {
    return { error: result.parsed.error_description || result.parsed.error || "Google OAuth refresh failed.", result };
  }
  return { token: result.parsed.access_token };
}

function googleBusinessParent(secrets) {
  const locationId = secret(secrets, "LOCATION_ID");
  if (locationId.startsWith("accounts/")) return locationId.replace(/\/localPosts.*$/i, "");
  const accountId = secret(secrets, "ACCOUNT_ID");
  if (!accountId || !locationId) return "";
  return `accounts/${accountId}/locations/${locationId}`;
}

function stripHash(tag) {
  return String(tag || "").replace(/^#/, "").trim();
}

function cleanObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
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
    const imageUrl = imageFromPost(post);
    if (imageUrl) {
      try {
        const result = await postForm(`${config.assistant.metaGraphBaseUrl}/${config.assistant.metaGraphVersion}/${encodeURIComponent(pageId)}/photos`, {
          url: await requirePublicHttpsUrl(imageUrl, "Facebook image_url"),
          caption,
          published: "true",
          access_token: token
        });
        return nativeResult(result);
      } catch (error) {
        return failedNative(error.message || "Facebook image publish failed.");
      }
    }
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
    const videoUrl = videoFromPost(post);
    if (!userId || !token) return skippedNative("Instagram IG_USER_ID or ACCESS_TOKEN missing.");
    if (!imageUrl && !videoUrl) return skippedNative("Instagram native publish requires platform_payload.image_url or platform_payload.video_url.");
    const base = `${config.assistant.metaGraphBaseUrl}/${config.assistant.metaGraphVersion}`;
    let created;
    try {
      created = await postForm(`${base}/${encodeURIComponent(userId)}/media`, videoUrl ? {
        media_type: "REELS",
        video_url: await requirePublicHttpsUrl(videoUrl, "Instagram video_url"),
        caption,
        access_token: token
      } : {
        image_url: await requirePublicHttpsUrl(imageUrl, "Instagram image_url"),
        caption,
        access_token: token
      });
    } catch (error) {
      return failedNative(error.message || "Instagram media container failed.");
    }
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

  if (platform === "tiktok") {
    const token = secret(secrets, "ACCESS_TOKEN");
    const videoUrl = videoFromPost(post);
    if (!token) return skippedNative("TikTok ACCESS_TOKEN missing.");
    if (!videoUrl) return skippedNative("TikTok native publish requires platform_payload.video_url.");
    try {
      const result = await postJson("https://open.tiktokapis.com/v2/post/publish/video/init/", token, {
        post_info: {
          title: caption.slice(0, 2200),
          privacy_level: String(payloadValue(post, "privacy_level", "PUBLIC_TO_EVERYONE")),
          disable_duet: payloadBool(post, "disable_duet", false),
          disable_comment: payloadBool(post, "disable_comment", false),
          disable_stitch: payloadBool(post, "disable_stitch", false),
          video_cover_timestamp_ms: Number(payloadValue(post, "video_cover_timestamp_ms", 1000)) || 1000
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: await requirePublicHttpsUrl(videoUrl, "TikTok video_url")
        }
      });
      return nativeResult(result);
    } catch (error) {
      return failedNative(error.message || "TikTok native publish failed.");
    }
  }

  if (platform === "youtube") {
    const tokenResult = await googleAccessToken(secrets);
    if (!tokenResult.token) return failedNative(tokenResult.error || "YouTube OAuth token missing.");
    const videoUrl = videoFromPost(post);
    if (!videoUrl) return skippedNative("YouTube native publish requires platform_payload.video_url.");
    try {
      const media = await fetchRemoteMedia(videoUrl, "YouTube video_url");
      const metadata = {
        snippet: {
          title: String(payloadValue(post, "youtube_title", draft?.title || "AllonaHub")).slice(0, 100),
          description: caption.slice(0, 5000),
          tags: (post.hashtags || []).map(stripHash).filter(Boolean).slice(0, 25),
          categoryId: String(payloadValue(post, "youtube_category_id", "22"))
        },
        status: {
          privacyStatus: String(payloadValue(post, "privacy_status", "public")),
          selfDeclaredMadeForKids: payloadBool(post, "made_for_kids", false)
        }
      };
      const started = await postJson("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", tokenResult.token, metadata, {
        "X-Upload-Content-Type": media.contentType,
        "X-Upload-Content-Length": String(media.contentLength)
      });
      if (!started.response.ok) return nativeResult(started);
      const uploadUrl = started.response.headers.get("location");
      if (!uploadUrl) return failedNative("YouTube resumable upload URL donmedi.", started.response.status, started.text);
      const uploaded = await putBytes(uploadUrl, tokenResult.token, media.bytes, media.contentType, {
        "Content-Length": String(media.contentLength)
      });
      return nativeResult(uploaded);
    } catch (error) {
      return failedNative(error.message || "YouTube native publish failed.");
    }
  }

  if (platform === "whatsapp") {
    const phoneNumberId = secret(secrets, "PHONE_NUMBER_ID");
    const token = secret(secrets, "ACCESS_TOKEN");
    const to = String(payloadValue(post, "to", secret(secrets, "DEFAULT_RECIPIENT_PHONE")) || "").replace(/[^\d+]/g, "");
    if (!phoneNumberId || !token) return skippedNative("WhatsApp PHONE_NUMBER_ID or ACCESS_TOKEN missing.");
    if (!to) return skippedNative("WhatsApp native send requires platform_payload.to or DEFAULT_RECIPIENT_PHONE.");
    const templateName = String(payloadValue(post, "template_name", secret(secrets, "DEFAULT_TEMPLATE_NAME")) || "").trim();
    const payload = templateName
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: String(payloadValue(post, "language_code", secret(secrets, "LANGUAGE_CODE") || "tr")) }
          }
        }
      : {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: {
            preview_url: payloadBool(post, "preview_url", true),
            body: caption.slice(0, 4096)
          }
        };
    const result = await postJson(`${config.assistant.metaGraphBaseUrl}/${config.assistant.metaGraphVersion}/${encodeURIComponent(phoneNumberId)}/messages`, token, payload);
    return nativeResult(result);
  }

  if (platform === "google_business") {
    const parent = googleBusinessParent(secrets);
    if (!parent) return skippedNative("Google Business ACCOUNT_ID and LOCATION_ID missing.");
    const tokenResult = await googleAccessToken(secrets);
    if (!tokenResult.token) return failedNative(tokenResult.error || "Google Business OAuth token missing.");
    const link = linkFromPost(post, draft);
    const localPost = cleanObject({
      languageCode: String(payloadValue(post, "language_code", draft?.language === "tr" ? "tr-TR" : "en-US")),
      summary: caption.slice(0, 1500),
      topicType: String(payloadValue(post, "topic_type", "STANDARD")),
      callToAction: link ? {
        actionType: String(payloadValue(post, "action_type", "LEARN_MORE")),
        url: link
      } : undefined
    });
    const result = await postJson(`https://mybusiness.googleapis.com/v4/${parent}/localPosts`, tokenResult.token, localPost);
    return nativeResult({ ...result, externalPostId: result.parsed.name || "" });
  }

  if (platform === "nsosyal") {
    const webhookUrl = secret(secrets, "DISPATCH_WEBHOOK_URL");
    if (!webhookUrl) return skippedNative("Nsosyal native mode requires DISPATCH_WEBHOOK_URL or server_webhook connector.");
    try {
      const body = JSON.stringify({
        event: "allonahub.social_media.publish",
        platform: "nsosyal",
        post: compactPost(post),
        draft: compactDraft(draft)
      });
      const webhookSecret = secret(secrets, "DISPATCH_WEBHOOK_SECRET");
      const result = await postJson(await requirePublicHttpsUrl(webhookUrl, "Nsosyal webhook URL"), "", JSON.parse(body), {
        "X-AllonaHub-Event": "social_media.publish",
        "X-AllonaHub-Signature": webhookSecret
          ? `sha256=${createHmac("sha256", webhookSecret).update(body).digest("hex")}`
          : undefined,
        Authorization: undefined
      });
      return nativeResult(result);
    } catch (error) {
      return failedNative(error.message || "Nsosyal webhook dispatch failed.");
    }
  }

  return skippedNative(`${platform} native publish is not implemented.`);
}

function connectorTestResult({ response, text, parsed, provider = "native_api_test" }) {
  return {
    provider,
    status: response.ok ? "verified" : "failed",
    responseStatus: response.status,
    responseBody: text.slice(0, 2000),
    externalPostId: String(parsed.id || parsed.data?.id || parsed.name || parsed.open_id || ""),
    externalUrl: String(parsed.url || ""),
    errorMessage: response.ok ? "" : (parsed.message || parsed.error?.message || parsed.error || "Connector test returned an error.")
  };
}

function skippedTest(message) {
  return {
    provider: "native_api_test",
    status: "skipped",
    responseStatus: null,
    responseBody: "",
    externalPostId: "",
    externalUrl: "",
    errorMessage: message
  };
}

export async function testSocialMediaConnector({ platform, secrets }) {
  if (platform === "x") {
    const token = secret(secrets, "ACCESS_TOKEN");
    if (!token) return skippedTest("X ACCESS_TOKEN missing.");
    return connectorTestResult(await getJson("https://api.x.com/2/users/me", token));
  }

  if (platform === "facebook") {
    const pageId = secret(secrets, "PAGE_ID");
    const token = secret(secrets, "PAGE_ACCESS_TOKEN");
    if (!pageId || !token) return skippedTest("Facebook PAGE_ID or PAGE_ACCESS_TOKEN missing.");
    return connectorTestResult(await getJson(`${config.assistant.metaGraphBaseUrl}/${config.assistant.metaGraphVersion}/${encodeURIComponent(pageId)}?fields=id,name`, token));
  }

  if (platform === "threads") {
    const userId = secret(secrets, "THREADS_USER_ID");
    const token = secret(secrets, "ACCESS_TOKEN");
    if (!userId || !token) return skippedTest("Threads THREADS_USER_ID or ACCESS_TOKEN missing.");
    return connectorTestResult(await getJson(`https://graph.threads.net/v1.0/${encodeURIComponent(userId)}?fields=id,username`, token));
  }

  if (platform === "instagram") {
    const userId = secret(secrets, "IG_USER_ID");
    const token = secret(secrets, "ACCESS_TOKEN");
    if (!userId || !token) return skippedTest("Instagram IG_USER_ID or ACCESS_TOKEN missing.");
    return connectorTestResult(await getJson(`${config.assistant.metaGraphBaseUrl}/${config.assistant.metaGraphVersion}/${encodeURIComponent(userId)}?fields=id,username`, token));
  }

  if (platform === "linkedin") {
    const organizationUrn = secret(secrets, "ORGANIZATION_URN");
    const token = secret(secrets, "ACCESS_TOKEN");
    const organizationId = organizationUrn.split(":").pop();
    if (!organizationId || !token) return skippedTest("LinkedIn ORGANIZATION_URN or ACCESS_TOKEN missing.");
    return connectorTestResult(await getJson(`https://api.linkedin.com/rest/organizations/${encodeURIComponent(organizationId)}`, token, {
      "LinkedIn-Version": "202606",
      "X-Restli-Protocol-Version": "2.0.0"
    }));
  }

  if (platform === "pinterest") {
    const token = secret(secrets, "ACCESS_TOKEN");
    if (!token) return skippedTest("Pinterest ACCESS_TOKEN missing.");
    return connectorTestResult(await getJson("https://api.pinterest.com/v5/user_account", token));
  }

  if (platform === "telegram") {
    const botToken = secret(secrets, "BOT_TOKEN");
    if (!botToken) return skippedTest("Telegram BOT_TOKEN missing.");
    return connectorTestResult(await getJson(`https://api.telegram.org/bot${botToken}/getMe`, ""));
  }

  if (platform === "tiktok") {
    const token = secret(secrets, "ACCESS_TOKEN");
    if (!token) return skippedTest("TikTok ACCESS_TOKEN missing.");
    return connectorTestResult(await postJson("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", token, {}));
  }

  if (platform === "youtube") {
    const channelId = secret(secrets, "CHANNEL_ID");
    const tokenResult = await googleAccessToken(secrets);
    if (!channelId) return skippedTest("YouTube CHANNEL_ID missing.");
    if (!tokenResult.token) return skippedTest(tokenResult.error || "YouTube OAuth token missing.");
    return connectorTestResult(await getJson(`https://www.googleapis.com/youtube/v3/channels?part=id,snippet&id=${encodeURIComponent(channelId)}`, tokenResult.token));
  }

  if (platform === "whatsapp") {
    const phoneNumberId = secret(secrets, "PHONE_NUMBER_ID");
    const token = secret(secrets, "ACCESS_TOKEN");
    if (!phoneNumberId || !token) return skippedTest("WhatsApp PHONE_NUMBER_ID or ACCESS_TOKEN missing.");
    return connectorTestResult(await getJson(`${config.assistant.metaGraphBaseUrl}/${config.assistant.metaGraphVersion}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, token));
  }

  if (platform === "google_business") {
    const parent = googleBusinessParent(secrets);
    const tokenResult = await googleAccessToken(secrets);
    if (!parent) return skippedTest("Google Business ACCOUNT_ID and LOCATION_ID missing.");
    if (!tokenResult.token) return skippedTest(tokenResult.error || "Google Business OAuth token missing.");
    return connectorTestResult(await getJson(`https://mybusiness.googleapis.com/v4/${parent}/localPosts?pageSize=1`, tokenResult.token));
  }

  if (platform === "nsosyal") {
    const webhookUrl = secret(secrets, "DISPATCH_WEBHOOK_URL");
    if (!webhookUrl) return skippedTest("Nsosyal icin DISPATCH_WEBHOOK_URL girilmemis; manual veya server_webhook modunda kullanilabilir.");
    try {
      const body = JSON.stringify({ event: "allonahub.social_media.connector_test", platform: "nsosyal" });
      const webhookSecret = secret(secrets, "DISPATCH_WEBHOOK_SECRET");
      return connectorTestResult(await postJson(await requirePublicHttpsUrl(webhookUrl, "Nsosyal webhook URL"), "", JSON.parse(body), {
        "X-AllonaHub-Event": "social_media.connector_test",
        "X-AllonaHub-Signature": webhookSecret
          ? `sha256=${createHmac("sha256", webhookSecret).update(body).digest("hex")}`
          : undefined,
        Authorization: undefined
      }));
    } catch (error) {
      return skippedTest(error.message || "Nsosyal connector test failed.");
    }
  }

  return skippedTest(`${platform} connector test is not implemented.`);
}

export function socialMediaDispatchStatus() {
  const assetGenerationReady =
    Boolean(config.socialMedia.assetGenerationEnabled) &&
    config.socialMedia.assetGenerationProvider === "openai" &&
    Boolean(config.socialMedia.assetOpenAiApiKey) &&
    Boolean(config.socialMedia.assetStorageBucket);

  return {
    enabled: config.socialMedia.dispatchEnabled,
    dry_run: config.socialMedia.dryRun || !config.socialMedia.dispatchEnabled,
    webhook_configured: Boolean(config.socialMedia.dispatchWebhookUrl),
    daily_drafts_enabled: Boolean(config.socialMedia.dailyDraftsEnabled),
    asset_webhook_configured: Boolean(config.socialMedia.assetWebhookUrl),
    asset_generation_enabled: Boolean(config.socialMedia.assetGenerationEnabled),
    asset_generation_provider: config.socialMedia.assetGenerationProvider,
    asset_generation_ready: Boolean(config.socialMedia.assetWebhookUrl) || assetGenerationReady,
    asset_storage_bucket_configured: Boolean(config.socialMedia.assetStorageBucket),
    default_timezone: config.socialMedia.defaultTimezone,
    max_batch: config.socialMedia.maxDispatchBatch,
    max_media_bytes: config.socialMedia.maxMediaBytes,
    supported_connector_modes: ["manual", "server_webhook", "native_api", "pending"],
    supported_native_platforms: ["x", "facebook", "threads", "instagram", "linkedin", "pinterest", "telegram", "tiktok", "youtube", "whatsapp", "google_business", "nsosyal"]
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
    try {
      return await publishNative({ post, draft, account, secrets: connectorSecrets });
    } catch (error) {
      return failedNative(error?.name === "AbortError" ? "Native API request timed out." : (error?.message || "Native API dispatch failed."));
    }
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
