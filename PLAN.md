# Plan (sent before coding)

## What I understood
*I was only given the test brief, not the full job description, so this is based on the brief alone.* You are building a multi-vendor marketplace (Amazon/eBay style). The core difficulty is **variation pricing driven by seller-entered data** (colour, size, storage, headboard, base, assembly), plus three roles (buyer, seller, admin), orders with status, and one backend shared by web and mobile. **I build first:** DB schema + server-side pricing engine, then seller form, product page with live price, cart/checkout, orders, admin, mobile polish.

## Questions for you
1. Brief says £269.99 is the *small single* price, but Small Single is also listed as +£90. I follow the size table literally (Small Single = £359.99). Correct?
2. Should unapproved sellers be able to create listings (hidden until approved), as I assume?
3. Is a PWA acceptable as the "app" (I chose it over Flutter)?

## Stack
Node 22 + Express, SQLite, vanilla JS SPA, PWA (manifest + service worker). One REST API for web and app.

## Tables
users, categories, products, product_images, option_groups, option_values (numeric price_delta), cart_items, orders, order_items (option snapshot).

## Skipping
Real payments, emails, delivery tracking, analytics, guest basket, push notifications, app stores.

## 72-hour split
- 0-8h: plan, schema, seed, pricing engine
- 8-24h: seller form + option editor, uploads
- 24-40h: buyer list/filters, product page, cart, checkout
- 40-52h: orders, status changes, admin, roles
- 52-62h: AI feature, mobile/PWA polish, real-phone testing
- 62-72h: deploy, README, video, AI notes, honest status
