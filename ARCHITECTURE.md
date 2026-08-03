# Neutrex — Shopify Plus Theme Architecture

**Brand:** Neutrex · Luxury Performance Fitness  
**Stack:** Shopify Online Store 2.0 · Liquid · CSS Variables · Vanilla JS  
**Locales:** English (LTR) · Arabic (RTL)  
**Modes:** Light · Dark (designed independently)

---

## 1. Sitemap

```
/
├── Home                              (index)
│
├── Shop
│   ├── All Products                  (collection/all)
│   ├── Training                      (collection)
│   ├── Supplements                   (collection)
│   │   ├── Protein Powder
│   │   ├── RTD Protein
│   │   ├── Energy Drinks
│   │   ├── Creatine
│   │   └── Vitamins
│   ├── Clothing                      (collection)
│   │   ├── Compression Wear
│   │   ├── T-Shirts
│   │   ├── Hoodies
│   │   ├── Shorts
│   │   └── Socks
│   ├── Accessories                   (collection)
│   │   ├── Shakers
│   │   ├── Wrist Straps
│   │   ├── Knee Sleeves
│   │   ├── Lifting Belts
│   │   └── Resistance Bands
│   └── Nutrition Plans               (collection)
│
├── Product                           (product)
│
├── Book
│   ├── Personal Training             (page.appointment)
│   ├── Online Coaching               (page.appointment)
│   ├── Gym Consultation              (page.appointment)
│   └── Bodybuilding Coaching         (page.appointment)
│
├── Coaches
│   └── Coach Profile                 (page.coach)
│
├── Transformations                   (page.gallery / section)
├── About                             (page)
├── Contact                           (page.contact)
│
├── Account
│   ├── Login / Register
│   ├── Dashboard                     (customers/account)
│   ├── Orders                        (customers/order)
│   ├── Addresses                     (customers/addresses)
│   ├── Wishlist                      (page.wishlist)
│   └── Appointments                  (page.account-appointments)
│
├── Cart                              (cart)
├── Search                            (search)
│
├── Policies
│   ├── Privacy / Terms / Refund / Shipping
│
└── Blog / Journal                    (blog / article)
```

---

## 2. Component Architecture

### Layout
| File | Role |
|------|------|
| `layout/theme.liquid` | Root shell, CSS vars, dark mode, locale dir, skip link |
| `layout/password.liquid` | Password gate |

### Config
| File | Role |
|------|------|
| `config/settings_schema.json` | Colors, typography, social, appointments, performance |
| `config/settings_data.json` | Default Neutrex presets |

### Global Sections
| Section | Purpose |
|---------|---------|
| `header` | Sticky transparent, mega menu, lang/theme/cart/search |
| `footer` | Premium multi-column, newsletter, WhatsApp, location |
| `announcement-bar` | Promo / shipping strip |
| `cart-drawer` | Ajax cart drawer |
| `predictive-search` | Overlay predictive search |
| `mobile-nav` | Full-screen mobile navigation |

### Homepage Sections
| Section | Purpose |
|---------|---------|
| `hero-premium` | Full-bleed hero, 3D athlete, dual CTA |
| `stats-animated` | Animated counters |
| `featured-categories` | 5 category glass cards |
| `product-carousel` | Best sellers / trending (reusable) |
| `featured-coach` | Coach spotlight + book CTA |
| `appointment-cta` | Booking conversion band |
| `transformation-gallery` | Before/after masonry |
| `testimonials` | Review carousel |
| `instagram-feed` | Social grid |
| `newsletter` | Email capture |
| `rich-text` | Flexible content |
| `image-with-text` | Editorial split |
| `logo-list` | Trust / press logos |
| `faq` | Accordion FAQ |

### Product / Collection
| Section | Purpose |
|---------|---------|
| `main-product` | Gallery, sticky ATC, accordions, 360, size guide |
| `product-recommendations` | Related products |
| `recently-viewed` | LocalStorage recently viewed |
| `main-collection` | Filters, sort, infinite load, quick view |
| `collection-banner` | Hero banner for collection |

### Appointments
| Section | Purpose |
|---------|---------|
| `appointment-hero` | Service hero |
| `appointment-booking` | Trainer, calendar, times, duration, price |
| `appointment-faq` | Service FAQ |
| `appointment-reviews` | Service reviews |
| `coach-profile` | Cover, achievements, gallery, certs, book |

### Account / Utility
| Section | Purpose |
|---------|---------|
| `main-account` | Dashboard: orders, wishlist, appointments |
| `main-cart` | Cart page |
| `main-search` | Search results |
| `main-login` / `main-register` | Auth |
| `main-addresses` | Address book |
| `main-order` | Order detail |
| `wishlist` | Wishlist page |
| `contact-form` | Contact |
| `404` | Not found |

### Snippets (Reusable)
```
icon-*                  SVG icon system
price                   Money formatting
product-card            Card + hover swap + quick add
product-card-badge
quick-view-modal
filter-drawer
breadcrumb
pagination
skeleton
media                   Responsive image / picture
schema-org              JSON-LD helpers
share-buttons
wishlist-button
stock-indicator
size-guide
nutrition-facts
accordion
button
badge
locale-selectors
theme-switcher
cart-count
```

### Assets
```
base.css                Design tokens + reset + utilities
components.css          Cards, buttons, forms, glass
layout.css              Header, footer, grids
product.css             PDP styles
collection.css          PLP + filters
appointments.css        Booking UI
account.css             Dashboard
animations.css          Motion (respect prefers-reduced-motion)
theme.js                Core: dark mode, cart, search, a11y
product.js              Gallery, zoom, sticky ATC, variants
collection.js           Filters, infinite, quick add
appointments.js         Calendar / time slots UI
animations.js           Counters, parallax, reveal, tilt
predictive-search.js
cart-drawer.js
```

### Locales
```
en.default.json
ar.json
en.default.schema.json
ar.schema.json
```

### Metaobjects / Metafields (Theme Settings + Shopify Admin)
| Type | Fields |
|------|--------|
| `coach` | name, photo, cover, bio, achievements, certs, IG, specialties |
| `appointment_service` | title, duration, price, description, trainers |
| `transformation` | before, after, name, story |
| Product metafields | nutrition_facts, ingredients, benefits, size_guide, spin_360 |
| Variant metafields | flavor, color swatch |

---

## 3. Design Tokens

```css
--color-primary: #7A1F3D;
--color-gold: #D4AF37;
--color-charcoal: #1E1E1E;
--color-white: #FFFFFF;
/* Light & dark surfaces designed separately */
--font-en: 'Poppins', system-ui, sans-serif;
--font-ar: 'Cairo', 'Poppins', sans-serif;
--radius-sm/md/lg/xl
--shadow-soft / elevated / glow
--glass-bg / glass-border / blur
```

---

## 4. Build Order

1. Foundation (settings, layout, tokens, locales, core JS)
2. Header / Footer / Cart / Search
3. Homepage sections
4. Product + Collection
5. Appointments + Coach
6. Account + SEO + polish
