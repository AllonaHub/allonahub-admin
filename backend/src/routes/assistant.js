import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import {
  ASSISTANT_CHANNELS,
  cleanAssistantMetadata,
  cleanAssistantText,
  detectAssistantIntent,
  generateAssistantReply,
  normalizeAssistantChannel,
  publicAssistantErrorMessage,
  saveConversationLog,
  shouldCreateSupportTicket
} from "../lib/assistant.js";
import { auditEvent, authContext, hasRole, supabaseAdmin } from "../lib/supabase.js";

const uuidSchema = z.string().uuid();
const supportPrioritySchema = z.enum(["low", "normal", "high", "urgent"]).default("normal");
const supportCategorySchema = z.string().trim().min(2).max(60).optional();

const assistantMessageSchema = z.object({
  message: z.string().trim().min(1).max(config.assistant.maxMessageChars),
  channel: z.enum(ASSISTANT_CHANNELS).optional(),
  source: z.enum(ASSISTANT_CHANNELS).optional(),
  conversationId: z.string().trim().max(120).optional(),
  orderId: z.string().trim().max(80).optional(),
  orderReference: z.string().trim().max(80).optional(),
  createSupportTicket: z.boolean().optional().default(false),
  support: z.object({
    category: supportCategorySchema,
    priority: supportPrioritySchema,
    title: z.string().trim().max(180).optional(),
    message: z.string().trim().max(3000).optional(),
    contact: z.record(z.unknown()).optional().default({})
  }).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({})
});

const telegramWebhookSchema = z.object({
  update_id: z.number().optional(),
  message: z.record(z.unknown()).optional(),
  edited_message: z.record(z.unknown()).optional(),
  callback_query: z.record(z.unknown()).optional()
}).passthrough();

const assistantRateLimit = {
  config: {
    rateLimit: {
      max: config.assistant.rateLimitMax,
      timeWindow: "1 minute"
    }
  }
};

const telegramRateLimit = {
  config: {
    rateLimit: {
      max: Math.max(30, config.assistant.rateLimitMax * 2),
      timeWindow: "1 minute"
    }
  }
};

const metaRateLimit = {
  config: {
    rateLimit: {
      max: Math.max(60, config.assistant.rateLimitMax * 3),
      timeWindow: "1 minute"
    }
  }
};

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function looksLikeMissingSchema(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""} ${error?.code || ""}`;
  return /does not exist|schema cache|PGRST20|PGRST30|42P01|42703|relation .* not found|column .* not found/i.test(message);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const clean = cleanAssistantText(value, 240);
    if (clean) return clean;
  }
  return "";
}

function conversationId(payload) {
  const clean = cleanAssistantText(payload.conversationId, 120).replace(/[^a-z0-9_.:-]/gi, "");
  return clean || `asst-${randomUUID()}`;
}

async function channelAuthContext(request, channel) {
  const ctx = await authContext(request);

  if (channel === "admin_panel" && !hasRole(ctx?.profile, ["admin", "super_admin"])) {
    await auditEvent({
      request,
      actorId: ctx?.user?.id || null,
      actorRole: ctx?.profile?.role || null,
      action: "assistant.admin_channel_denied",
      resourceType: "assistant",
      severity: "warning",
      source: "assistant",
      purpose: "support_access_control",
      metadata: { channel }
    });
    throw httpError("Admin asistan kanalı için yetki doğrulanamadı.", ctx?.user ? 403 : 401);
  }

  if (channel === "partner_panel" && !hasRole(ctx?.profile, ["partner", "admin", "super_admin"])) {
    await auditEvent({
      request,
      actorId: ctx?.user?.id || null,
      actorRole: ctx?.profile?.role || null,
      action: "assistant.partner_channel_denied",
      resourceType: "assistant",
      severity: "warning",
      source: "assistant",
      purpose: "support_access_control",
      metadata: { channel }
    });
    throw httpError("Partner asistan kanalı için yetki doğrulanamadı.", ctx?.user ? 403 : 401);
  }

  return ctx;
}

function publicOrderSummary(order) {
  return {
    id: order.id,
    order_no: order.order_no || null,
    order_status: order.order_status || "pending",
    payment_status: order.payment_status || "pending",
    tracking_number: order.tracking_number || null,
    total: Number(order.total || 0),
    created_at: order.created_at || null
  };
}

async function loadOrderContext({ payload, ctx, request }) {
  const reference = firstNonEmpty(payload.orderId, payload.orderReference, payload.metadata?.order_id, payload.metadata?.order_no);
  if (!reference) {
    return {
      order: null,
      orderWarning: "Sipariş durumunu gösterebilmem için sipariş numarası veya sipariş referansı gerekir."
    };
  }

  if (!ctx?.user) {
    return {
      order: null,
      orderWarning: "Sipariş bilgileri güvenlik nedeniyle yalnızca giriş yapılmış oturumla görüntülenebilir."
    };
  }

  let query = supabaseAdmin
    .from("orders")
    .select("id, order_no, user_id, order_status, payment_status, tracking_number, total, created_at")
    .limit(1);

  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(reference)) {
    query = query.eq("id", uuidSchema.parse(reference));
  } else {
    query = query.eq("order_no", reference.slice(0, 80));
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (looksLikeMissingSchema(error)) {
      request.log.warn({ error: error.message }, "Assistant order lookup schema is not ready");
      return {
        order: null,
        orderWarning: "Sipariş sorgulama veritabanı şeması production ortamında henüz hazır görünmüyor."
      };
    }
    throw error;
  }

  if (!data) {
    return {
      order: null,
      orderWarning: "Bu referansla eşleşen sipariş bulunamadı. İstersen destek talebi oluşturabilirim."
    };
  }

  const allowed = data.user_id === ctx.user.id || hasRole(ctx.profile, ["admin", "super_admin"]);
  if (!allowed) {
    await auditEvent({
      request,
      actorId: ctx.user.id,
      actorRole: ctx.profile.role,
      action: "assistant.order_lookup_denied",
      resourceType: "order",
      resourceId: data.id,
      severity: "warning",
      source: "assistant",
      purpose: "support_access_control",
      metadata: { channel: payload.channel || payload.source || "webchat" }
    });
    return {
      order: null,
      orderWarning: "Bu sipariş için görüntüleme yetkin doğrulanamadı."
    };
  }

  return {
    order: publicOrderSummary(data),
    orderWarning: ""
  };
}

function supportTitle(payload, message) {
  const title = firstNonEmpty(payload.support?.title, message).slice(0, 160);
  if (title.length >= 3) return title;
  return "AI destek talebi";
}

function supportBody(payload, message) {
  const body = firstNonEmpty(payload.support?.message, message).slice(0, 2800);
  if (body.length >= 3) return body;
  return "Kullanıcı AI destek asistanı üzerinden destek talebi oluşturdu.";
}

function supportCategory(payload, intent) {
  const raw = cleanAssistantText(payload.support?.category, 60).toLowerCase();
  if (raw) return raw.replace(/[^a-z0-9_.:-]/gi, "_").slice(0, 60);
  if (intent.key === "order_status") return "order";
  if (intent.key === "partner_application") return "partner";
  if (intent.key === "academy") return "academy";
  return "general";
}

function partnerSupportCategory(category) {
  const allowed = new Set(["general", "product", "order", "payment", "qr_nfc", "cargo", "payout", "technical"]);
  if (allowed.has(category)) return category;
  if (category === "partner" || category === "academy") return "general";
  return "technical";
}

async function partnerBusinessForUser(userId) {
  const { data, error } = await supabaseAdmin
    .from("partner_businesses")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (looksLikeMissingSchema(error)) return null;
    throw error;
  }
  return data || null;
}

async function createPartnerSupportTicket({ ctx, payload, message, intent, metadata }) {
  const business = await partnerBusinessForUser(ctx.user.id);
  if (!business?.id) return null;

  const category = partnerSupportCategory(supportCategory(payload, intent));
  const { data, error } = await supabaseAdmin
    .from("partner_support_tickets")
    .insert({
      partner_id: business.id,
      created_by: ctx.user.id,
      category,
      priority: payload.support?.priority || "normal",
      title: supportTitle(payload, message),
      message: supportBody(payload, message),
      metadata
    })
    .select("id")
    .single();

  if (error) {
    if (looksLikeMissingSchema(error)) return null;
    throw error;
  }
  return { id: data.id, type: "partner_support_ticket" };
}

async function createSupportTicket({ ctx, channel, payload, message, intent, request, conversationId }) {
  const metadata = cleanAssistantMetadata({
    source: "assistant",
    channel,
    conversation_id: conversationId,
    intent: intent.key,
    page: payload.metadata?.page || payload.metadata?.url || null,
    contact: payload.support?.contact || payload.metadata?.contact || {}
  });

  if (channel === "partner_panel" && ctx?.user && hasRole(ctx.profile, ["partner", "admin", "super_admin"])) {
    const partnerTicket = await createPartnerSupportTicket({ ctx, payload, message, intent, metadata });
    if (partnerTicket) return partnerTicket;
  }

  const requesterType = channel === "partner_panel" ? "partner" : ctx?.user ? "user" : "guest";
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      user_id: ctx?.user?.id || null,
      requester_type: requesterType,
      category: supportCategory(payload, intent),
      priority: payload.support?.priority || "normal",
      title: supportTitle(payload, message),
      message: supportBody(payload, message),
      metadata
    })
    .select("id")
    .single();

  if (error) {
    if (looksLikeMissingSchema(error)) {
      request.log.warn({ error: error.message }, "Assistant support ticket schema is not ready");
      return null;
    }
    throw error;
  }

  return { id: data.id, type: "support_ticket" };
}

function telegramMessage(update) {
  const message = update.message || update.edited_message || update.callback_query?.message || {};
  const text = cleanAssistantText(update.message?.text || update.edited_message?.text || update.callback_query?.data || "", config.assistant.maxMessageChars);
  const chat = message.chat || {};
  const from = update.message?.from || update.edited_message?.from || update.callback_query?.from || {};
  return {
    text,
    chatId: chat.id ? String(chat.id) : "",
    userId: from.id ? String(from.id) : "",
    username: from.username || "",
    languageCode: from.language_code || "",
    messageId: message.message_id || null
  };
}

async function sendTelegramReply(chatId, text) {
  if (!config.assistant.telegramBotToken || !chatId) return false;
  const response = await fetch(`https://api.telegram.org/bot${config.assistant.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: cleanAssistantText(text, 3900),
      disable_web_page_preview: true
    })
  });
  return response.ok;
}

function rawRequestBody(request) {
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody;
  return Buffer.from(JSON.stringify(request.body || {}), "utf8");
}

function safeEqual(value, expected) {
  const left = Buffer.from(String(value || ""), "utf8");
  const right = Buffer.from(String(expected || ""), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifyMetaSignature(request) {
  if (!config.assistant.metaAppSecret) return;

  const received = String(request.headers["x-hub-signature-256"] || "").trim();
  if (!received.startsWith("sha256=")) {
    throw httpError("Meta webhook imzası eksik.", 401);
  }

  const expected = `sha256=${createHmac("sha256", config.assistant.metaAppSecret)
    .update(rawRequestBody(request))
    .digest("hex")}`;

  if (!safeEqual(received, expected)) {
    throw httpError("Meta webhook imzası doğrulanamadı.", 401);
  }
}

function metaGraphUrl(endpoint) {
  const cleanEndpoint = String(endpoint || "").replace(/^\/+/, "");
  return `${config.assistant.metaGraphBaseUrl}/${config.assistant.metaGraphVersion}/${cleanEndpoint}`;
}

async function postMetaGraph({ endpoint, token, body, request, platform }) {
  if (!token) {
    request.log.warn({ platform }, "Meta assistant reply skipped because access token is missing");
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, config.assistant.metaSendTimeoutMs));

  try {
    const response = await fetch(metaGraphUrl(endpoint), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = cleanAssistantText(await response.text().catch(() => ""), 300);
      request.log.warn({ platform, statusCode: response.status, error: errorText }, "Meta assistant reply failed");
      return false;
    }
    return true;
  } finally {
    clearTimeout(timeout);
  }
}

function whatsappIncomingText(message) {
  if (message?.type === "text") return message.text?.body || "";
  if (message?.type === "button") return message.button?.text || message.button?.payload || "";
  if (message?.type === "interactive") {
    return message.interactive?.button_reply?.title
      || message.interactive?.button_reply?.id
      || message.interactive?.list_reply?.title
      || message.interactive?.list_reply?.id
      || "";
  }
  return "";
}

function parseWhatsappEvents(payload) {
  const events = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const metadata = value.metadata || {};
      const phoneNumberId = metadata.phone_number_id || config.assistant.metaWhatsappPhoneNumberId;
      const contactById = new Map((value.contacts || []).map((contact) => [String(contact.wa_id || ""), contact]));

      for (const message of value.messages || []) {
        const text = cleanAssistantText(whatsappIncomingText(message), config.assistant.maxMessageChars);
        if (!text) continue;

        const from = String(message.from || "");
        const contact = contactById.get(from) || {};
        events.push({
          channel: "whatsapp",
          text,
          conversationId: `wa-${phoneNumberId || "default"}-${from}`,
          replyTo: from,
          phoneNumberId,
          metadata: {
            meta_object: payload.object || "",
            entry_id: entry.id || null,
            change_field: change.field || null,
            phone_number_id: phoneNumberId || null,
            display_phone_number: metadata.display_phone_number || null,
            whatsapp_user_id: from,
            profile_name: contact.profile?.name || null,
            message_id: message.id || null,
            message_type: message.type || null,
            timestamp: message.timestamp || null
          }
        });
      }
    }
  }
  return events;
}

function instagramIncomingText(item) {
  if (item.message?.is_echo) return "";
  return item.message?.text
    || item.postback?.payload
    || item.postback?.title
    || item.message?.quick_reply?.payload
    || "";
}

function parseInstagramEvents(payload) {
  const events = [];
  for (const entry of payload.entry || []) {
    for (const item of entry.messaging || []) {
      const senderId = String(item.sender?.id || "");
      const text = cleanAssistantText(instagramIncomingText(item), config.assistant.maxMessageChars);
      if (!senderId || !text) continue;

      events.push({
        channel: "instagram",
        text,
        conversationId: `ig-${senderId}`,
        replyTo: senderId,
        metadata: {
          meta_object: payload.object || "",
          entry_id: entry.id || null,
          instagram_sender_id: senderId,
          instagram_recipient_id: item.recipient?.id || null,
          message_id: item.message?.mid || null,
          timestamp: item.timestamp || entry.time || null,
          postback_payload: item.postback?.payload || null
        }
      });
    }
  }
  return events;
}

function metaEvents(payload) {
  if (payload.object === "whatsapp_business_account") return parseWhatsappEvents(payload);
  if (payload.object === "instagram") return parseInstagramEvents(payload);
  return [...parseWhatsappEvents(payload), ...parseInstagramEvents(payload)];
}

async function sendWhatsappReply(event, text, request) {
  const phoneNumberId = event.phoneNumberId || config.assistant.metaWhatsappPhoneNumberId;
  if (!phoneNumberId || !event.replyTo) return false;

  return postMetaGraph({
    endpoint: `${phoneNumberId}/messages`,
    token: config.assistant.metaWhatsappAccessToken,
    platform: "whatsapp",
    request,
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: event.replyTo,
      type: "text",
      text: {
        preview_url: false,
        body: cleanAssistantText(text, 4096)
      }
    }
  });
}

async function sendInstagramReply(event, text, request) {
  if (!event.replyTo) return false;

  return postMetaGraph({
    endpoint: `${config.assistant.metaInstagramGraphId || "me"}/messages`,
    token: config.assistant.metaInstagramAccessToken,
    platform: "instagram",
    request,
    body: {
      recipient: {
        id: event.replyTo
      },
      message: {
        text: cleanAssistantText(text, 1000)
      }
    }
  });
}

async function handleAssistantMessage({ request, payload, channel }) {
  const ctx = await channelAuthContext(request, channel);
  const cleanMessage = cleanAssistantText(payload.message, config.assistant.maxMessageChars);
  const cleanMetadata = cleanAssistantMetadata(payload.metadata || {});
  const cid = conversationId(payload);
  const intent = detectAssistantIntent(cleanMessage, cleanMetadata);
  const context = {};

  if (intent.key === "order_status" || payload.orderId || payload.orderReference) {
    Object.assign(context, await loadOrderContext({ payload, ctx, request }));
  }

  if (shouldCreateSupportTicket(cleanMessage, payload, intent)) {
    context.supportTicket = await createSupportTicket({
      ctx,
      channel,
      payload,
      message: cleanMessage,
      intent,
      request,
      conversationId: cid
    });
  }

  const userLogId = await saveConversationLog({
    userId: ctx?.user?.id || null,
    channel,
    senderType: "user",
    message: cleanMessage,
    metadata: {
      ...cleanMetadata,
      conversation_id: cid,
      intent: intent.key,
      request_id: request.id || null
    },
    request
  });

  const assistant = await generateAssistantReply({
    message: cleanMessage,
    channel,
    intent,
    context,
    metadata: cleanMetadata,
    request
  });

  const assistantLogId = await saveConversationLog({
    userId: ctx?.user?.id || null,
    channel,
    senderType: "assistant",
    message: assistant.message,
    metadata: {
      conversation_id: cid,
      intent: assistant.intent,
      provider: assistant.provider,
      user_log_id: userLogId,
      support_ticket: context.supportTicket || null,
      order_context_used: Boolean(context.order)
    },
    request
  });

  await auditEvent({
    request,
    actorId: ctx?.user?.id || null,
    actorRole: ctx?.profile?.role || null,
    action: "assistant.message_answered",
    resourceType: "assistant_conversation",
    resourceId: assistantLogId || userLogId || cid,
    source: "assistant",
    purpose: "customer_support",
    evidenceTags: ["assistant", channel, intent.key],
    metadata: {
      channel,
      conversation_id: cid,
      intent: intent.key,
      provider: assistant.provider,
      support_ticket: context.supportTicket || null
    }
  });

  return {
    ok: true,
    conversationId: cid,
    message: assistant.message,
    intent: assistant.intent,
    actions: assistant.actions,
    supportTicket: context.supportTicket || null,
    logs: {
      user: userLogId,
      assistant: assistantLogId
    }
  };
}

function verifyTelegramSecret(request) {
  if (!config.assistant.telegramWebhookSecret) return;
  const received = String(request.headers["x-telegram-bot-api-secret-token"] || "");
  if (received !== config.assistant.telegramWebhookSecret) {
    throw httpError("Telegram webhook doğrulanamadı.", 401);
  }
}

export function registerAssistantRoutes(app) {
  app.get("/v1/meta/webhook", async (request, reply) => {
    const query = request.query || {};
    const mode = String(query["hub.mode"] || "");
    const token = String(query["hub.verify_token"] || "");
    const challenge = String(query["hub.challenge"] || "");

    if (!config.assistant.metaVerifyToken) {
      return reply.code(503).send({
        ok: false,
        error: "META_VERIFY_TOKEN_MISSING",
        message: "Meta webhook doğrulama anahtarı production ortamında tanımlı değil."
      });
    }

    if (mode === "subscribe" && safeEqual(token, config.assistant.metaVerifyToken)) {
      return reply.code(200).type("text/plain").send(challenge);
    }

    return reply.code(403).send({
      ok: false,
      error: "META_WEBHOOK_DENIED",
      message: "Meta webhook doğrulanamadı."
    });
  });

  app.post("/v1/meta/webhook", metaRateLimit, async (request, reply) => {
    try {
      verifyMetaSignature(request);
      const events = metaEvents(request.body || {}).slice(0, 20);

      if (!events.length) {
        return reply.code(200).send({ ok: true, ignored: true, processed: 0, delivered: 0 });
      }

      const results = [];
      for (const event of events) {
        try {
          const result = await handleAssistantMessage({
            request,
            channel: event.channel,
            payload: {
              message: event.text,
              channel: event.channel,
              conversationId: event.conversationId,
              metadata: {
                ...event.metadata,
                source: "meta_webhook"
              }
            }
          });

          const delivered = event.channel === "whatsapp"
            ? await sendWhatsappReply(event, result.message, request)
            : await sendInstagramReply(event, result.message, request);

          results.push({
            ok: true,
            channel: event.channel,
            delivered,
            conversationId: result.conversationId
          });
        } catch (error) {
          request.log.warn({ channel: event.channel, error: error.message }, "Meta assistant event failed");
          results.push({
            ok: false,
            channel: event.channel,
            delivered: false
          });
        }
      }

      return reply.code(200).send({
        ok: true,
        processed: results.length,
        delivered: results.filter((result) => result.delivered).length,
        results
      });
    } catch (error) {
      request.log.warn({ statusCode: error.statusCode || 500 }, "Meta assistant webhook failed");
      return reply.code(error.statusCode || 500).send({
        ok: false,
        error: error.statusCode === 429 ? "RATE_LIMITED" : "META_WEBHOOK_ERROR",
        message: publicAssistantErrorMessage(error)
      });
    }
  });

  app.post("/v1/assistant/messages", assistantRateLimit, async (request, reply) => {
    try {
      const payload = assistantMessageSchema.parse(request.body || {});
      const channel = normalizeAssistantChannel(payload.channel || payload.source || "webchat");
      const result = await handleAssistantMessage({ request, payload, channel });
      return reply.code(result.supportTicket ? 201 : 200).send(result);
    } catch (error) {
      if (error.name === "ZodError") throw error;
      request.log.warn({ statusCode: error.statusCode || 500 }, "Assistant message failed");
      return reply.code(error.statusCode || 500).send({
        ok: false,
        error: error.statusCode === 429 ? "RATE_LIMITED" : "ASSISTANT_ERROR",
        message: publicAssistantErrorMessage(error)
      });
    }
  });

  app.post("/v1/telegram/webhook", telegramRateLimit, async (request, reply) => {
    verifyTelegramSecret(request);
    const update = telegramWebhookSchema.parse(request.body || {});
    const telegram = telegramMessage(update);

    if (!telegram.text || !telegram.chatId) {
      return reply.code(202).send({ ok: true, ignored: true });
    }

    const result = await handleAssistantMessage({
      request,
      channel: "telegram",
      payload: {
        message: telegram.text,
        channel: "telegram",
        conversationId: `tg-${telegram.chatId}`,
        metadata: {
          telegram_user_id: telegram.userId,
          telegram_chat_id: telegram.chatId,
          username: telegram.username,
          language_code: telegram.languageCode,
          message_id: telegram.messageId,
          update_id: update.update_id || null
        }
      }
    });

    let delivered = false;
    try {
      delivered = await sendTelegramReply(telegram.chatId, result.message);
    } catch (error) {
      request.log.warn({ error: error.message }, "Telegram assistant reply could not be delivered");
    }

    return reply.code(200).send({
      ok: true,
      delivered,
      conversationId: result.conversationId,
      message: result.message
    });
  });
}
