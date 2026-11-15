# PLAN: Mini Marketplace MVP

## 1. What I understood
<!-- TODO (REQUIRED, before submitting): replace the paragraph below with what YOU understood from the JD and the company projects, in your own words, and list your questions. -->
(Generic draft, to be replaced.) The company appears to build multi-vendor marketplaces (Amazon/eBay style): sellers list products with variations, buyers browse, configure and order, and an admin moderates. A product with many options (colour, size, storage, extras) must show a live price, and the server must be the single source of truth for that price. I would build first the thin end-to-end core: seller lists a product, buyer configures it, orders it, seller moves the order through its statuses. Search, filters, moderation and AI helpers come after that.

## 2. Stack, tables, scope, time

**Stack**
- Supabase: Postgres, Auth, Storage, RLS. One DB for web and mobile.
- Checkout is the Postgres function `place_order(...)`. It recomputes prices from DB option values and writes order + items in one transaction.
- Web: Next.js (App Router, TS), Tailwind, Vercel. A server route for the AI call (Gemini vision, labelled demo fallback). Admin actions go through the database with RLS.
- Mobile: Expo (TS), supabase-js, React Context for state, a simple tab state instead of a router. Android APK via EAS cloud build (no Android SDK or `adb` on this machine).
- Shared `calculatePrice` in `packages/shared`: the web app uses it as an npm workspace package, the mobile app imports the same file through Metro (`mobile/metro.config.js`). One copy, one set of tests.

**Tables**
profiles(role, status), categories, products, product_images, option_groups(type swatch|select|checkbox), option_values(price_delta, hex), orders, order_items (snapshots). The cart is kept on the client (localStorage / AsyncStorage), one line per product + sorted option-value ids, so there are no carts tables; `place_order` is the only DB write at checkout. Roles are enforced by RLS plus the Next.js `proxy.ts` (called middleware in older versions).

**Skipping**
Real payments, emails, delivery tracking, analytics, Play/App Store publishing, push notifications, other products or categories, PWA, iOS build.

**72 hours**
| Hours | Work |
|---|---|
| 0-8 | DB, auth/roles, RLS, `place_order`, seed Prague bed |
| 8-24 | Web product page with live price, cart, checkout, orders |
| 24-36 | Seller form with variation builder, status changes, admin |
| 36-44 | Search and filters, 360px polish, deploy to Vercel |
| 44-48 | AI title/description feature |
| 48-64 | Mobile app: login, list, product page, cart, orders |
| 64-68 | APK build |
| 68-72 | Docs, tests, checklist, video |

## 3. Questions for the hiring team
1. Is the Prague bed's option data expected to be seller-entered only (no code-level defaults)?
2. Is one shared Supabase project acceptable, or should I provide separate environments?
3. Should buyers be able to check out as guests, or is login required?
4. Should the compare-at price and the % badge be seller-editable per product?
5. Is a small extra (e.g. the order-status notice via Realtime) preferred over polish on the core flow?
6. Any preference between an APK link on Drive and an EAS build link?
