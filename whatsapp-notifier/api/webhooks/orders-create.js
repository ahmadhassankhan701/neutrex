import { readRawBody, verifyShopifyHmac } from '../../lib/shopify.js';
import { getConfig, normalizePhone, sendWhatsAppTemplate } from '../../lib/whatsapp.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cfg = getConfig();
  const rawBody = await readRawBody(req);
  const hmac = req.headers['x-shopify-hmac-sha256'];

  if (!verifyShopifyHmac(rawBody, hmac, cfg.shopifyWebhookSecret)) {
    return res.status(401).json({ error: 'Invalid HMAC' });
  }

  let order;
  try {
    order = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
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
    results.admin = await sendWhatsAppTemplate({
      to: normalizePhone(cfg.adminNumber),
      templateName: cfg.adminTemplate,
      language: cfg.templateLanguage,
      bodyParams: [orderName, firstName, email, billingPhoneDisplay],
      token: cfg.whatsappToken,
      phoneNumberId: cfg.phoneNumberId,
    });
  } catch (error) {
    results.admin = { ok: false, error: String(error?.message || error) };
    console.error('[WhatsApp] Admin notify failed', error);
  }

  if (customerPhone) {
    try {
      results.customer = await sendWhatsAppTemplate({
        to: customerPhone,
        templateName: cfg.customerTemplate,
        language: cfg.templateLanguage,
        bodyParams: [firstName, orderName],
        token: cfg.whatsappToken,
        phoneNumberId: cfg.phoneNumberId,
      });
    } catch (error) {
      results.customer = { ok: false, error: String(error?.message || error) };
      console.error('[WhatsApp] Customer notify failed', error);
    }
  } else {
    results.customer = { ok: false, skipped: true, reason: 'No customer phone on order' };
  }

  const failed = [results.admin, results.customer].some((r) => r && r.ok === false && !r.skipped);
  return res.status(failed ? 502 : 200).json({ ok: !failed, order: orderName, results });
}
