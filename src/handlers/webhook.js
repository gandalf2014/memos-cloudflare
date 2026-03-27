import { createResponse, createErrorResponse } from '../utils/response.js';

// In-memory webhook config (in production, store in D1)
const webhookConfig = {
  url: null,
  events: [],
  secret: null,
  enabled: false
};

// POST /api/webhook/config - 配置 Webhook
export async function configureWebhook(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    if (body.url) {
      try {
        new URL(body.url);
      } catch {
        return createErrorResponse('Invalid webhook URL', 400);
      }
      webhookConfig.url = body.url;
    }

    if (body.events) {
      const validEvents = ['memo.created', 'memo.updated', 'memo.deleted'];
      webhookConfig.events = body.events.filter(e => validEvents.includes(e));
    }

    if (body.secret !== undefined) {
      webhookConfig.secret = body.secret;
    }

    if (body.enabled !== undefined) {
      webhookConfig.enabled = !!body.enabled;
    }

    return createResponse({
      success: true,
      config: {
        url: webhookConfig.url,
        events: webhookConfig.events,
        enabled: webhookConfig.enabled
      }
    }, 200);
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}

// GET /api/webhook/config - 获取 Webhook 配置
export async function getWebhookConfig(request, env) {
  return createResponse({
    url: webhookConfig.url,
    events: webhookConfig.events,
    enabled: webhookConfig.enabled
  }, 200);
}

// 触发 Webhook
export async function triggerWebhook(event, data) {
  if (!webhookConfig.enabled || !webhookConfig.url) {
    return;
  }

  if (!webhookConfig.events.includes(event)) {
    return;
  }

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data
  };

  try {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (webhookConfig.secret) {
      // Simple signature (in production use HMAC)
      headers['X-Webhook-Secret'] = webhookConfig.secret;
    }

    await fetch(webhookConfig.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Webhook trigger failed:', error);
  }
}