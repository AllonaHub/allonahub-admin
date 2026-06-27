import http from 'node:http';
import { readRequestBody, parseJsonBody, sendJson } from './body.mjs';
import { verifyHmacSignature } from '../security/signature.mjs';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Allonahub-Signature'
  };
}

function clientKey(request, body = {}) {
  return (
    request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    body?.user?.externalUserId ||
    request.socket.remoteAddress ||
    'unknown'
  );
}

function normalizeGenericWebhook(body) {
  return {
    conversationId: body.conversationId,
    channel: body.channel || 'generic',
    message: body.message || body.text || '',
    user: body.user || {
      externalUserId: body.externalUserId,
      displayName: body.displayName
    }
  };
}

function normalizeTelegramWebhook(body) {
  const message = body.message || body.edited_message || {};
  const chat = message.chat || {};
  const from = message.from || {};
  return {
    conversationId: `telegram_${chat.id ?? from.id ?? 'unknown'}`,
    channel: 'telegram',
    message: message.text || message.caption || '',
    user: {
      externalUserId: String(from.id ?? chat.id ?? ''),
      displayName: [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username
    },
    telegramChatId: chat.id
  };
}

function normalizeWhatsappWebhook(body) {
  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];
  const contact = value?.contacts?.[0];
  return {
    conversationId: `whatsapp_${message?.from ?? contact?.wa_id ?? 'unknown'}`,
    channel: 'whatsapp',
    message: message?.text?.body || '',
    user: {
      externalUserId: message?.from ?? contact?.wa_id,
      displayName: contact?.profile?.name
    }
  };
}

export function createHttpServer({ config, orchestrator, rateLimiter, reportBuilder }) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders());
      response.end();
      return;
    }

    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(
          response,
          200,
          {
            ok: true,
            service: 'allonahub-bot-platform',
            time: new Date().toISOString()
          },
          corsHeaders()
        );
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/report/daily') {
        sendJson(response, 200, await reportBuilder(), corsHeaders());
        return;
      }

      if (request.method !== 'POST') {
        sendJson(response, 404, { ok: false, error: 'not_found' }, corsHeaders());
        return;
      }

      const raw = await readRequestBody(request);
      const body = parseJsonBody(raw);
      const rate = rateLimiter.check(clientKey(request, body));
      if (!rate.allowed) {
        sendJson(response, 429, { ok: false, error: 'rate_limited', rate }, corsHeaders());
        return;
      }

      if (url.pathname === '/api/chat') {
        sendJson(response, 200, await orchestrator.handleMessage(normalizeGenericWebhook(body)), corsHeaders());
        return;
      }

      if (url.pathname === '/webhooks/generic') {
        const verification = verifyHmacSignature({
          body: raw,
          secret: config.webhookSecret,
          signatureHeader: request.headers['x-allonahub-signature']
        });
        if (!verification.ok) {
          sendJson(response, 401, { ok: false, error: verification.reason }, corsHeaders());
          return;
        }
        sendJson(response, 200, await orchestrator.handleMessage(normalizeGenericWebhook(body)), corsHeaders());
        return;
      }

      if (url.pathname === '/webhooks/telegram') {
        const normalized = normalizeTelegramWebhook(body);
        const result = await orchestrator.handleMessage(normalized);
        sendJson(
          response,
          200,
          {
            method: 'sendMessage',
            chat_id: normalized.telegramChatId,
            text: result.answer,
            parse_mode: 'HTML',
            result
          },
          corsHeaders()
        );
        return;
      }

      if (url.pathname === '/webhooks/whatsapp') {
        sendJson(
          response,
          200,
          {
            outboundRequired: true,
            result: await orchestrator.handleMessage(normalizeWhatsappWebhook(body))
          },
          corsHeaders()
        );
        return;
      }

      sendJson(response, 404, { ok: false, error: 'not_found' }, corsHeaders());
    } catch (error) {
      sendJson(
        response,
        error.statusCode ?? 500,
        {
          ok: false,
          error: error.message
        },
        corsHeaders()
      );
    }
  });
}
