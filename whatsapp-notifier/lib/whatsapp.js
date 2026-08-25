/**
 * Shared config + Meta WhatsApp Cloud API helpers.
 * Secrets come from env (Vercel / .env). Non-secret defaults are filled in.
 */

const GRAPH_API_VERSION = 'v21.0';

export function getConfig() {
  return {
    whatsappToken: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '1335392636315748',
    adminNumber: process.env.ADMIN_WHATSAPP_NUMBER || '97452044520',
    adminTemplate: process.env.ADMIN_TEMPLATE_NAME || 'admin_order_notification',
    customerTemplate: process.env.CUSTOMER_TEMPLATE_NAME || 'customer_order_notification',
    templateLanguage: process.env.TEMPLATE_LANGUAGE || 'en_US',
    shopifyWebhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || '',
  };
}

export function normalizePhone(value) {
  if (!value) return '';
  let digits = String(value).replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits;
}

export function sanitizeTemplateText(value) {
  const text = String(value ?? '').trim() || '—';
  return text.replace(/[\r\n\t]+/g, ' ').slice(0, 1024);
}

export async function sendWhatsAppTemplate({ to, templateName, language, bodyParams, token, phoneNumberId }) {
  if (!to) throw new Error('Missing recipient phone');
  if (!token) throw new Error('Missing WHATSAPP_TOKEN');
  if (!phoneNumberId) throw new Error('Missing WHATSAPP_PHONE_NUMBER_ID');

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

  const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Meta API ${response.status}`);
  }

  return {
    ok: true,
    to,
    templateName,
    messageId: data?.messages?.[0]?.id || null,
  };
}
