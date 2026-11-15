# 3-minute video: shot list

Target: 3:00 or less. Record the laptop screen for the web parts, and the phone screen (or a phone filmed from above) for the app part. Say things in your own words; the lines below are only cues.

## Before you hit record
- Remove old test orders (SQL in CHECKLIST.md) so the order list starts clean.
- Log in once in three browser profiles or windows: seller, buyer, admin. Keep the live site open: https://mvp-marketplace-seven.vercel.app/
- Install the APK on your phone and log in once so the first screen is ready.
- Have a photo ready to upload for the AI step (optional).

## Shots

| Time | Screen | Say / do |
|---|---|---|
| 0:00 to 0:15 | Live site home | "This is a small multi-vendor marketplace: Next.js web on Vercel, a React Native app, and one shared Supabase backend." |
| 0:15 to 0:50 | **Seller** (seller@test.com) → My products → Prague bed edit page | Show that the options are data: swatches, sizes with prices, storage, headboard, base, assembly. Add one new storage option (for example "6 Drawers +£300") and save. "The seller enters the options and prices; nothing is hard-coded on the buyer page." Optionally click the AI button: "title and description from a photo". |
| 0:50 to 1:10 | **Admin** (admin@test.com) | Show approve or hide for the seller and the listing. "Roles: buyer, seller, admin. The page is blocked by role, and the database rules enforce it too." (Skip if short on time.) |
| 1:10 to 1:55 | **Buyer** (buyer@test.com), product page | Click a swatch: selected state, colour name next to "Colour:", title and image update. Change size, storage, headboard, base, tick assembly. Say the price out loud as it changes (for example £359.99 to £679.98). Show the "50% OFF" badge and the gallery. Add to Basket. Change one option and add again: two cart lines. |
| 1:55 to 2:15 | Cart → checkout | Show each line with all chosen options. Fill the fake checkout, place the order. "The server recomputes the price; the browser total is only a preview." |
| 2:15 to 2:35 | Orders | Buyer sees the order. Switch to seller → incoming orders → move it to Confirmed, then Shipped. Switch back to the buyer: status updated. |
| 2:35 to 3:00 | **Phone, installed APK** | Log in, search, open the product, pick a colour and size, watch the price change, add to basket, check out, then open Orders. "Same backend, same price function." Mention the phone web view works at 360px with a sticky Add to Basket bar. |

## Say honestly at the end (10 seconds, if there is time)
"The AI call falls back to a demo suggestion when there is no quota. The order notice on mobile uses pull-to-refresh. See STATUS.md for what I would do with two more weeks."

## Tips
- Keep it under 3:00; cut the admin shot first if you run long.
- Do not show the Supabase dashboard, the `.env` files or any key.
- Do not show or mention the company name or the reference website.
