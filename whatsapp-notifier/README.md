# Neutrex WhatsApp order notifications

Sends Meta Cloud API WhatsApp templates when a Shopify order is created.

- Admin: `admin_order_notification` → `{{order}}`, `{{first_name}}`, `{{email}}`, `{{phone}}`
- Customer: `customer_order_notification` → `{{first_name}}`, `{{order}}`

## Security

**Do not put the WhatsApp permanent token in git, theme settings, or chat.**

The token shared in Cursor chat should be **rotated now** in Meta Business Manager, then stored only as a Cloudflare secret.

## 1. Deploy the worker

```bash
cd whatsapp-notifier
npm install
npx wrangler login
npx wrangler secret put WHATSAPP_TOKEN
# paste the NEW rotated Meta permanent token

npx wrangler secret put SHOPIFY_WEBHOOK_SECRET
# paste the signing secret from the Shopify webhook (step 2)

npm run deploy
```

Copy the worker URL, e.g. `https://neutrex-whatsapp-notifier.<your-subdomain>.workers.dev`.

## 2. Create the Shopify webhook

Shopify Admin → **Settings → Notifications → Webhooks** → Create webhook:

| Field | Value |
| --- | --- |
| Event | Order creation |
| Format | JSON |
| URL | `https://neutrex-whatsapp-notifier.<your-subdomain>.workers.dev/webhooks/orders-create` |
| API version | `2024-10` or latest |

Copy the **webhook signing secret** into `SHOPIFY_WEBHOOK_SECRET` (re-run `wrangler secret put` if you set a placeholder earlier).

## 3. Test

1. Place a test order with a phone number on the billing address.
2. Confirm admin `+97452044520` gets `admin_order_notification`.
3. Confirm the customer phone gets `customer_order_notification`.
4. Watch logs: `npm run tail`

Health check: `GET /health`

## Env vars

| Name | Where | Example |
| --- | --- | --- |
| `WHATSAPP_TOKEN` | secret | Meta permanent token |
| `SHOPIFY_WEBHOOK_SECRET` | secret | Shopify webhook HMAC secret |
| `WHATSAPP_PHONE_NUMBER_ID` | wrangler.toml | `1335392636315748` |
| `ADMIN_WHATSAPP_NUMBER` | wrangler.toml | `97452044520` |
| `ADMIN_TEMPLATE_NAME` | wrangler.toml | `admin_order_notification` |
| `CUSTOMER_TEMPLATE_NAME` | wrangler.toml | `customer_order_notification` |
| `TEMPLATE_LANGUAGE` | wrangler.toml | `en_US` |

## Notes

- Customer messages are skipped when the order has no phone number.
- Phone numbers are normalized to digits only (no `+`).
- Theme code cannot send WhatsApp; this worker is required.
- Namespace `27676537628679891` is not needed for Cloud API template sends (template name + language is enough).
