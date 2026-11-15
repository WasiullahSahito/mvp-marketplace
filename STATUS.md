# Honest status

Last updated after the first deploy and the first EAS build. Everything below was checked by running it, unless it says "not verified".

## Links
- Web (Vercel): https://mvp-marketplace-seven.vercel.app/
- Repo: https://github.com/WasiullahSahito/mvp-marketplace
- Android APK: see the link in README.md (EAS build, installed on a phone for the demo)

## What works (checked in a real browser at 360px, against the live Supabase)
- Seller: sign up and log in, product form with a variation builder (groups and option values with prices), photo upload to Storage, edit a product, see incoming orders, move an order New → Confirmed → Shipped → Delivered (one step at a time).
- Buyer: browse, search, filters (price, colour, size, category), product page with swatches, size, storage, headboard, base, assembly tick box, live price, 5-image gallery with swipe and click-to-enlarge, sticky Add to Basket bar.
- Cart: same options = quantity goes up, different options = a new line. Every chosen option is shown on the line.
- Checkout (fake, no payment) goes through the database function `place_order`. The server recomputes every price; the price from the browser is ignored. Checked: the preview and the stored total matched (for example £574.98 and £1959.96).
- Orders: buyer sees their orders with the status steps; seller sees incoming orders.
- Admin: approve or hide sellers and listings. A new seller product stays hidden from the public until the admin approves it.
- Roles: logged-out users and buyers are redirected away from `/seller` and `/admin`, and the database (RLS) blocks the same things if someone calls the API directly.
- Mobile app (Expo, React Native): login, product list with search, product page with the same options and the same `calculatePrice` function, basket, checkout through `place_order`, order list with status steps. Checked end to end in a browser build against the real backend.
- 14 unit tests for the price function (6 option combinations, discount badge, cart line key, formatting).

## What is incomplete or not verified
- **AI feature (title and description from a photo):** built with Gemini on the server and a labelled demo suggestion as a fallback. The real Gemini call has **not been verified end to end** (no working key at the time of writing). The request and parsing were tested against a stub server. If there is no key, no photo or the quota is used up, the form shows a clearly labelled demo suggestion instead of failing.
- **APK on a real phone:** the build succeeds, but I tested the app logic in a browser build, not on a device. Check the checklist before relying on it.
- **Order-status notice on mobile (bonus):** not working. The code listens for changes, but Realtime is not enabled on the `orders` table. Pull-to-refresh on the Orders tab works.
- **Photo upload through the seller form in the browser:** the storage upload itself was tested; the full click-through in the form was not.
- **Default price:** the brief says the base price £269.99 is for a small single, but also lists Small Single 2FT6 as +£90. I followed the list, so the first option is selected by default and the page opens at £359.99. A different rule (first size is free) would be a one-line change in the seed data.
- **Colour photos:** colours do not have their own photos; the placeholder image is tinted with the chosen colour (allowed by the brief).
- **Cart is kept on the device**, not in the database. Deliberate, to keep checkout simple; a logged-in cart would sync across devices.
- **Plan timing:** the plan was written alongside the build, not sent before coding as the brief asks.
- Leftover test orders from my testing may still exist in the demo database.

## Deliberately skipped
Real payments, emails, delivery tracking, analytics, Play Store and App Store, push notifications, other products or categories, PWA, iOS.

## With 2 more weeks I would
1. Verify and tune the AI feature with real photos, add a "recommend similar products" option, and add a daily limit per seller.
2. Enable Realtime on orders and add a real push notification for status changes.
3. Move the cart into the database so it follows the buyer across devices, and reserve stock at checkout.
4. Add per-colour photos and image reordering in the seller form (currently editing re-creates options and images).
5. Add automated tests for the database rules (RLS as each role, `place_order` rejecting bad input) and a few end-to-end browser tests, instead of only the price unit tests.
6. Reduce page latency (fewer auth round trips per page; the functions now run in Seoul next to the database).
7. Add proper order detail pages, seller order filters, and basic reporting for the admin.
