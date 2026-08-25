/**
 * Neutrex — Shopify order → WhatsApp (Meta Cloud API)
 *
 * Deploy as a Cloudflare Worker. Secrets are set via `wrangler secret put`
 * and never committed to git.
 */

const GRAPH_API_VERSION = 'v21.0';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'neutrex-whatsapp-notifier' });
    }

    if (request.method !== 'POST' || url.pathname !== '/webhooks/orders-create') {
      return json({ error: 'Not found' }, 404);
    }

    const rawBody = await request.text();

    if (!(await verifyShopifyHmac(rawBody, request.headers.get('X-Shopify-Hmac-Sha256'), env.SHOPIFY_WEBHOOK_SECRET))) {
      return json({ error: 'Invalid HMAC' }, 401);
    }

    let order;
    try {
      order = JSON.parse(rawBody);
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const orderName = String(order.name || order.order_number || order.id || '').trim() || 'N/A';
    const firstName = String(
      order.billing_address?.first_name ||
        order.customer?.first_name ||
        order.shipping_address?.first_name ||
        'Customer'
    ).trim();
    const email = String(order.email || order.customer?.email || order.contact_email || '—').trim();
    const customerPhoneRaw =
      order.billing_address?.phone || order.phone || order.customer?.phone || order.shipping_address?.phone || '';
    const customerPhone = normalizePhone(customerPhoneRaw);
    const billingPhoneDisplay = String(customerPhoneRaw || '—').trim() || '—';

    const results = { admin: null, customer: null };

    try {
      results.admin = await sendTemplate(env, {
        to: normalizePhone(env.ADMIN_WHATSAPP_NUMBER),
        templateName: env.ADMIN_TEMPLATE_NAME || 'admin_order_notification',
        language: env.TEMPLATE_LANGUAGE || 'en_US',
        bodyParams: [orderName, firstName, email, billingPhoneDisplay],
      });
    } catch (error) {
      results.admin = { ok: false, error: String(error?.message || error) };
      console.error('[WhatsApp] Admin notify failed', error);
    }

    if (customerPhone) {
      try {
        results.customer = await sendTemplate(env, {
          to: customerPhone,
          templateName: env.CUSTOMER_TEMPLATE_NAME || 'customer_order_notification',
          language: env.TEMPLATE_LANGUAGE || 'en_US',
          bodyParams: [firstName, orderName],
        });
      } catch (error) {
        results.customer = { ok: false, error: String(error?.message || error) };
        console.error('[WhatsApp] Customer notify failed', error);
      }
    } else {
      results.customer = { ok: false, skipped: true, reason: 'No customer phone on order' };
    }

    const failed = [results.admin, results.customer].some((r) => r && r.ok === false && !r.skipped);
    return json({ ok: !failed, order: orderName, results }, failed ? 502 : 200);
  },
};

async function sendTemplate(env, { to, templateName, language, bodyParams }) {
  if (!to) throw new Error('Missing recipient phone');
  if (!env.WHATSAPP_TOKEN) throw new Error('Missing WHATSAPP_TOKEN');
  if (!env.WHATSAPP_PHONE_NUMBER_ID) throw new Error('Missing WHATSAPP_PHONE_NUMBER_ID');

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: [
        {
          type: 'body',
          parameters: bodyParams.map((text) => ({
            type: 'text',
            text: sanitizeTemplateText(text),
          })),
        },
      ],
    },
  };

  const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Meta API ${response.status}`;
    throw new Error(message);
  }

  return { ok: true, to, templateName, messageId: data?.messages?.[0]?.id || null };
}

function sanitizeTemplateText(value) {
  const text = String(value ?? '').trim() || '—';
  // Meta rejects newlines / tabs in some template params
  return text.replace(/[\r\n\t]+/g, ' ').slice(0, 1024);
}

function normalizePhone(value) {
  if (!value) return '';
  let digits = String(value).replace(/[^\d]/g, '');
  // Drop a single leading 0 after country code mistakes are rare; keep full international digits
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits;
}

async function verifyShopifyHmac(rawBody, hmacHeader, secret) {
  if (!secret) {
    console.error('[WhatsApp] SHOPIFY_WEBHOOK_SECRET is not set');
    return false;
  }
  if (!hmacHeader) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const digest = bufferToBase64(signature);

  return timingSafeEqual(digest, hmacHeader);
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
