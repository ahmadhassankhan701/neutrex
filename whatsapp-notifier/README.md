# Neutrex WhatsApp order notifications (Vercel Node)

Shopify `orders/create` webhook → Meta Cloud API templates.

- Admin (`admin_order_notification`): order, first name, email, phone → `+97452044520`
- Customer (`customer_order_notification`): first name, order

## 1. Install & set env

```bash
cd whatsapp-notifier
cp .env.example .env
# .env already can hold WHATSAPP_TOKEN + phone/templates
# SHOPIFY_WEBHOOK_SECRET is filled after creating the Shopify webhook
```

## 2. Deploy to Vercel

```bash
npx vercel login
npx vercel link   # create/link project in this folder
npx vercel env add WHATSAPP_TOKEN production
npx vercel env add SHOPIFY_WEBHOOK_SECRET production
# optional (defaults already in code):
npx vercel env add WHATSAPP_PHONE_NUMBER_ID production
npx vercel env add ADMIN_WHATSAPP_NUMBER production

npx vercel --prod
```

Or from the Vercel dashboard: import this folder / repo subdirectory `whatsapp-notifier`, then set Environment Variables, then Deploy.

Your webhook URL will look like:

`https://<project>.vercel.app/webhooks/orders-create`

Health check: `https://<project>.vercel.app/health`

## 3. Connect Shopify

Shopify Admin → **Settings → Notifications → Webhooks** → Create webhook:

| Field | Value |
| --- | --- |
| Event | Order creation |
| Format | JSON |
| URL | `https://<project>.vercel.app/webhooks/orders-create` |
| API version | latest |

Copy the **webhook signing secret** → set as `SHOPIFY_WEBHOOK_SECRET` in Vercel (and local `.env`), then redeploy if needed.

## 4. Test

1. Place a test order with a billing phone number.
2. Admin WhatsApp `+97452044520` should receive `admin_order_notification`.
3. Customer phone should receive `customer_order_notification`.
4. Check Vercel → Project → Logs.

## Env vars

| Name | Required | Value |
| --- | --- | --- |
| `WHATSAPP_TOKEN` | yes | Meta permanent token |
| `SHOPIFY_WEBHOOK_SECRET` | yes | Shopify webhook HMAC secret |
| `WHATSAPP_PHONE_NUMBER_ID` | no | `1335392636315748` |
| `ADMIN_WHATSAPP_NUMBER` | no | `97452044520` |
| `ADMIN_TEMPLATE_NAME` | no | `admin_order_notification` |
| `CUSTOMER_TEMPLATE_NAME` | no | `customer_order_notification` |
| `TEMPLATE_LANGUAGE` | no | `en_US` |

## Notes

- `.env` is gitignored — do not commit tokens.
- Customer notify is skipped if the order has no phone.
- Rotate the Meta token if it was ever pasted into chat or git.
