# Neutrex — Premium Shopify Plus Theme

Luxury performance fitness storefront. Online Store 2.0 · English (LTR) + Arabic (RTL) · Light / Dark modes · Appointment booking.

Comparable design bar: Gymshark · YoungLA · MyProtein · Nike · Apple.

---

## Quick start

1. Zip the theme folder (or push via Shopify CLI):
   ```bash
   shopify theme push
   # or
   shopify theme dev
   ```
2. In **Online Store → Themes → Customize**, set brand logo, colors, WhatsApp number, and menus.
3. Create navigation menus: `main-menu`, `footer`.
4. Create pages and assign templates (see below).
5. Enable **Shopify Markets / Languages** for Arabic (`ar`) — one set of templates; direction flips automatically.

---

## Templates

| Template | Use for |
|----------|---------|
| `index` | Homepage |
| `product` | All PDPs |
| `collection` | All collections |
| `page.appointment` | Personal Training, Online Coaching, Gym Consultation, Bodybuilding Coaching |
| `page.coach` | Coach profile pages |
| `page.wishlist` | Wishlist (localStorage) |
| `page.contact` | Contact |
| `page.account-appointments` | Account → Appointments |
| `customers/*` | Account dashboard, auth, orders, addresses |
| `blog` / `article` | Journal |
| `gift_card` | Gift cards |

**Recommended pages to create**

- `/pages/personal-training` → template **appointment**
- `/pages/online-coaching` → **appointment**
- `/pages/gym-consultation` → **appointment**
- `/pages/bodybuilding-coaching` → **appointment**
- `/pages/coach` (or coach name) → **coach**
- `/pages/wishlist` → **wishlist**
- `/pages/contact` → **contact**
- `/pages/account-appointments` → **account-appointments**

Duplicate the appointment template content in the customizer per service (title, price, trainers, duration).

---

## Brand tokens

| Token | Value |
|-------|-------|
| Primary | `#7A1F3D` |
| Gold | `#D4AF37` |
| Charcoal | `#1E1E1E` |
| White | `#FFFFFF` |
| EN font | Poppins |
| AR font | Cairo |

Dark mode uses a separate palette (not inverted). Preference is stored in `localStorage` key `neutrex-theme`.

---

## Architecture

```
assets/     CSS + JS (deferred, template-conditional)
config/     settings_schema + defaults
layout/     theme.liquid + password
locales/    en.default.json + ar.json
sections/   OS 2.0 sections (homepage, PDP, PLP, appointments, account)
snippets/   product-card, icons, schema, price, media, …
templates/  JSON templates + gift_card.liquid
```

Full sitemap: see `ARCHITECTURE.md`.

---

## Metafields (recommended)

Create under **Settings → Custom data**:

**Product** (`custom`)

| Key | Type | Use |
|-----|------|-----|
| `benefits` | multi-line / list | PDP accordion |
| `ingredients` | multi-line | PDP |
| `nutrition_facts` | multi-line / JSON | Nutrition table |
| `size_guide` | multi-line / rich text | Size guide |
| `spin_360` | list of files/images | 360° viewer |

**Product tags**

- `bestseller` → badge
- `new` → badge

**Storefront filtering**: enable Category, Price, Availability, and custom filters (Flavor, Color, Size, Brand) in Search & Discovery.

---

## Appointments

Booking UI is native (trainers → calendar → times → duration/price → Confirm).

- Default submit: **WhatsApp deep link** using Theme Settings → Appointments → WhatsApp number.
- Optional: external booking URL or contact form mode in the section settings.
- For production calendar sync, connect an appointments app; this theme UI remains the front-end conversion layer.

---

## Performance checklist

- Conditional CSS/JS by template
- Lazy-loaded images via `media` snippet
- Minimal classic JS (no jQuery)
- `prefers-reduced-motion` respected
- Critical CSS tokens inlined via `css-variables`

Target: 95+ Performance · 100 Accessibility / Best Practices / SEO (validate with Lighthouse on a product-populated store).

---

## Localization

- English + Arabic locale files ship with the theme.
- Enable Arabic in Shopify admin; theme sets `dir="rtl"` and Cairo automatically.
- Do **not** duplicate templates for languages — use Shopify localization.

---

## Theme editor

Every section is customizer-driven: headings, images, CTAs, blocks, colors (via theme settings). No hardcoded marketing copy required for production — defaults are Neutrex-branded starters.
