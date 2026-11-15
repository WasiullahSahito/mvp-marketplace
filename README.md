# Mini Marketplace

A small multi-vendor marketplace: a responsive **Next.js web app** and a **React Native (Expo) mobile app**, both on ONE shared **Supabase** backend, with one reference product (a divan bed with colour, size, storage, headboard, base and assembly options).

> Status: web app done. Mobile app: see STATUS.md.

## Repo layout

| Folder | What |
|---|---|
| `supabase/migrations` | Schema, Row Level Security, `place_order` and `set_order_status` functions, storage bucket |
| `supabase/seed.sql` | Test accounts and the sample product |
| `packages/shared` | `calculatePrice` (the ONE pricing function) + shared types + unit tests |
| `web` | Next.js 16 (App Router, TypeScript, Tailwind) |
| `mobile` | Expo app (added after the web app) |

## How it works (the 4 things to explain)

1. **Options are data.** Colours, sizes, storage etc. are rows in `option_groups` / `option_values`, entered by the seller. The product page just renders whatever groups exist.
2. **Live price** = `calculatePrice(base_price, chosen options)` in `packages/shared/src/pricing.ts`. Works in pence to avoid float errors.
3. **Server is the authority.** Checkout calls the Postgres function `place_order`. It receives only product ids, option value ids and quantities, and recomputes every price from the database. The browser's total is only a preview.
4. **Roles** live in `profiles.role`. `web/proxy.ts` redirects people away from pages that are not theirs (Next.js 16 renamed "middleware" to "proxy"), and RLS policies in the database enforce it for real.

## Run locally

Needs Node 20+.

```bash
npm install                       # from the repo root (npm workspaces)
cp .env.example web/.env.local    # then fill in the Supabase values
npm test                          # pricing unit tests (vitest)
npm run dev --workspace web       # http://localhost:3000
```

## Run the mobile app (Expo)

The mobile app is its own project in `mobile/` (it is not part of the npm workspaces, because React Native pins its own React version). It still imports the same `calculatePrice` from `packages/shared` (Metro is pointed at it in `mobile/metro.config.js`).

```bash
cd mobile
npm install
# mobile/.env needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (same values as the web app)
npx expo start          # scan the QR code with the Expo Go app on your phone (same Wi-Fi)
npx expo start --web    # or preview in a browser
```

Log in with `buyer@test.com` / `Test1234!`. Screens: login (or sign up as a buyer), product list with search, product page (swipeable gallery, colour swatches, size/storage/headboard/base, assembly checkbox, live price, sticky bar), basket, fake checkout through `place_order`, orders with status steps. Sellers and admins use the web app.

### Build the Android APK (EAS, no Android SDK needed)

```bash
cd mobile
npx eas-cli login
npx eas-cli init                        # links the project to your Expo account
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value <url> --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
npx eas-cli build -p android --profile preview
```

When the build finishes, EAS prints a download link for the `.apk`. Only the public anon key is used; the service-role key is never in the app.

## Database setup (Supabase)

1. Create a project at supabase.com.
2. **SQL Editor** → paste all of `supabase/migrations/20260101000000_schema.sql` → Run.
3. **SQL Editor** → paste all of `supabase/seed.sql` → Run.
4. **Authentication → Providers → Email**: turn **off** "Confirm email" (so sign-up works instantly in the demo).
5. **Project Settings → API**: copy the Project URL and the publishable (anon) key.

## Environment variables

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | public publishable key |
| `ANTHROPIC_API_KEY` | web, server only | optional; without it the AI button returns a labelled demo suggestion |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | same values as web |

The Supabase service-role key is **never** used by any client and is not in this repo. `.env*` files are git-ignored; only `.env.example` is committed.

## Deploy the web app on Vercel

1. Push this repo to GitHub (public).
2. vercel.com → **Add New → Project** → import the repo.
3. **Root Directory:** `web`. Keep "Include source files outside of the Root Directory" **on** (the shared package lives in `packages/shared`). Framework preset: Next.js.
4. **Environment Variables:** add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and optionally `ANTHROPIC_API_KEY`.
5. Deploy. Then in Supabase **Authentication → URL Configuration** set Site URL to your Vercel URL.

## Test accounts (sample data only)

| Email | Password | Role |
|---|---|---|
| buyer@test.com | Test1234! | buyer |
| seller@test.com | Test1234! | seller (approved) |
| admin@test.com | Test1234! | admin |

## What is done / not done

Done (web): seller sign-up/login, product form with variation builder and photo upload, seller incoming orders with status steps; buyer browse, search, filters (price, colour, size, category), product page with live price, gallery with swipe and lightbox, sticky Add-to-Basket bar, cart (same options = quantity, different options = new line), fake checkout through `place_order`, order list with status; admin approve/hide for sellers and listings; AI "title and description from photo" with mock fallback; role gating in `proxy.ts` and RLS.

Deliberately skipped: real payments, emails, delivery tracking, analytics, Play/App Store publishing, push notifications, other products or categories, PWA, iOS build.

Known simplifications: the cart is stored on the device (localStorage), not in the database; editing a product re-creates its options and images; colour values do not link to specific photos (the placeholder is tinted instead).
