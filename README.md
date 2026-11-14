# Mini Marketplace – MVP Skills Test

Multi-vendor marketplace slice: sellers list products with database-driven variations (colour swatches, size, storage, headboard, base, assembly), buyers browse / filter / basket / fake-checkout, sellers manage order status, admin approves sellers and listings. The same backend serves the responsive web app and the installable PWA.

> Reference product only: "Prague Divan Bed – Cream Naples". No third-party logo, brand or photos are used – images are generated placeholders, shop name is "Demo Seller".

## Plan (as required in section 5)

**What I understood:** a marketplace like Amazon/eBay where the hard part is *variation pricing driven by seller-entered data*, plus roles, orders and a shared backend for web and mobile. **Built first:** DB schema + pricing engine → seller form → product page with live price → cart/checkout → orders → admin → PWA polish. *(I did not have the JD in the docx, so I could not tailor this to your specific projects – please send it if you want me to.)*

**Stack:** Node 22 + Express, SQLite (`node:sqlite`, built in), vanilla JS single-page front end, PWA (manifest + service worker). No build step.
**Tables:** `users` (role buyer/seller/admin, status approved/pending/hidden), `categories`, `products`, `product_images`, `option_groups` (swatch/select/checkbox), `option_values` (numeric `price_delta`, `hex`), `cart_items` (unique per product+option combination), `orders` (one per seller), `order_items` (option snapshot).
**Skipped on purpose:** real payments, emails, delivery tracking, analytics, guest (logged-out) basket, push notifications, Play/App store.

## Run it

```bash
npm install
npm start          # http://localhost:3000  (auto-creates and seeds data/marketplace.db on first run)
npm run seed       # wipe + reseed demo data
```
Requires Node ≥ 22.13. Copy `.env.example` to `.env` for optional settings (`SESSION_SECRET`, `ANTHROPIC_API_KEY`). Secrets are never committed (`.env`, `data/`, `uploads/` are git-ignored).

## Test accounts

| Role | Email | Password |
|---|---|---|
| Buyer | buyer@demo.test | buyer123 |
| Seller (approved) | seller@demo.test | seller123 |
| Seller (pending approval) | pending@demo.test | seller123 |
| Admin | admin@demo.test | admin123 |

## Database set-up
Schema is created by `server/db.js` on start; `server/seed.js` inserts the accounts, category *Furniture > Divan Beds*, and the Prague bed **through the same `saveProduct()` code the seller form uses**. Prices are `REAL` columns. Nothing about options is hard-coded in the buyer page – `app.js` renders whatever groups/values the API returns. The server recomputes every price (`server/products.js → priceSelection`) so the cart/checkout cannot be tampered with.

## Pricing rules
`price = base_price + Σ selected option price_delta`. Example: Grey, King (+125), 4 Drawers (+210), 54" headboard (+10), Reinforced base (+25), assembly (+39.99) = **£679.98**. Different option combinations are separate cart lines; the same combination increments quantity.

> Note: the brief says the base price is for "small single", yet also lists Small Single 2FT6 as **+90**. I followed the size table literally (Small Single = £359.99 with defaults). Changing it is a one-line edit in the seller form.

## Features
- **Seller:** sign up (needs admin approval), add/edit product, upload photos, option-group editor, hide/show, incoming orders with status (New → Confirmed → Shipped → Delivered). "Fill with Prague bed example" button pre-fills the form.
- **Buyer:** list, search, filters (price, colour, size, category – facets come from the DB), product page (swatches show selected state + colour name, title and main image update, gallery with thumbnails, click-to-enlarge, swipe), live price, basket, fake checkout, order list.
- **Admin:** approve/hide sellers and listings. Role checks are enforced on the server.
- **AI:** (1) "Describe my product photo" in the seller form – uses Claude vision if `ANTHROPIC_API_KEY` is set, otherwise a rule-based template; (2) "You might also like" similar-product recommendations (scored on category, price closeness, shared words).
- **Mobile:** 360px+, 44px tap targets, sticky Add-to-Basket bar, bottom tab bar, swipe gallery.

## Mobile app = PWA + React Native app (see mobile/README.md)
Open the live link on the phone.
- **Android (Chrome):** ⋮ menu → *Install app* / *Add to Home screen*.
- **iPhone (Safari):** Share → *Add to Home Screen*.
It opens full screen with its own icon and uses the same API/database. (PWAs need HTTPS when hosted – Render/Railway/Fly provide it.)

## Deployment
SQLite needs a persistent disk, so deploy on a Node host with a volume (Render, Railway, Fly.io) rather than serverless Vercel/Netlify. Set `SESSION_SECRET`; start command `npm start`. To use Vercel + hosted Postgres you would swap `server/db.js` queries for a Postgres client (next step).

## Honest status
**Done:** everything in sections 2–3 as described above.
**Not done / not verified:** React Native app in `mobile/` bundles but has not been run on a device and no APK is built yet; not yet deployed; the browser UI was not tested on a real phone or in automated browser tests (API flows were tested with curl); no video recorded; no git commits yet (repo not initialised); colour names are plausible "Naples" fabric names, not copied from the reference page (it could not be fetched); AI "describe photo" only uses real vision with an API key; no push notification; basket requires login.
**With 2 more weeks:** Postgres + migrations, automated tests (Playwright for the option/price rules), real image optimisation/storage, per-colour photos, guest basket, order-status push notifications, proper seller onboarding/KYC, pagination.

## AI notes
Built with Claude Code (Claude): scaffolding, schema, API, front end and this README. One thing it got wrong and I had to fix: a first-pass seed put a placeholder `0` over the Small Single size price, which would have silently dropped the +£90 – caught by calling the price API with known combinations (359.99 / 679.98).
