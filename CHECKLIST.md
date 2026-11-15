# Pre-submit checklist

Tick each box yourself on the **live site** and the **installed APK** before submitting. "Checked" means it was already checked by running it during the build; still do a final run on your phone.

Live site: https://mvp-marketplace-seven.vercel.app/
Test logins (sample data only), password for all: `Test1234!`
- Buyer: `buyer@test.com`
- Seller: `seller@test.com`
- Admin: `admin@test.com`

## Price combinations (base £269.99)

Pick the options on the product page, read the price, and compare. Colour does not change the price.

| # | Size | Storage | Headboard | Base | Assembly | Expected | Checked |
|---|---|---|---|---|---|---|---|
| 1 | Small Single 2FT6 (+90) | No Storage | FREE 26" | Standard | no | **£359.99** | ☑ web + app (default) |
| 2 | King 5FT (+125) | 4 Drawers (+210) | 54" (+10) | Reinforced (+25) | yes (+39.99) | **£679.98** | ☑ web + app |
| 3 | Double 4FT6 (+110) | 2 Drawers Left (+50) | FREE 26" | Standard | no | **£429.99** | ☑ unit test |
| 4 | Super King 6FT (+150) | 2 Drawers Foot End (+155) | 54" (+10) | Reinforced (+25) | no | **£609.99** | ☑ unit test |
| 5 | Single 3FT (+95) | 2 Drawers Right (+45) | FREE 26" | Standard | yes (+39.99) | **£449.98** | ☑ unit test |
| 6 | Small Double 4FT (+100) | No Storage | 54" (+10) | Standard | no | **£379.99** | ☑ unit test |
| 7 | Double 4FT6 (+110) | 2 Drawers Foot End (+155) | FREE 26" | Standard | yes (+39.99) | **£574.98** | ☑ web, matched the server total |
| 8 | King 5FT (+125) | 4 Drawers (+210) | 54" (+10) | Reinforced (+25) | no | **£639.99** | ☑ app |

The unit tests are in `packages/shared/src/pricing.test.ts` (`npm test`). Rows 3 to 6: also try them by hand on the page.

## Brief checklist (section 9)

- [ ] Live web link works on a phone
- [ ] Test logins work for buyer, seller and admin
- [ ] Prague bed has colour swatches, size, storage, headboard, base and assembly (all from the database)
- [ ] Price updates correctly for at least 5 combinations (table above)
- [ ] Cart shows every chosen option; two combinations make two lines
- [ ] Order status changes from the seller side and the buyer sees it
- [ ] APK installs and works on a real Android phone (log in, pick options, add to basket, place order)
- [ ] GitHub repo is **public**, with the README
- [ ] 3-minute video recorded (see VIDEO_SCRIPT.md)
- [ ] Plan (starts with what I understood from the JD and projects, in my own words) and AI notes

## Extra checks

- [ ] Phone at 360px width: no sideways scrolling, swatches and buttons easy to tap, gallery swipes, Add to Basket bar stays visible
- [ ] Logged out, opening `/admin` or `/seller/orders` sends you to the login page; a buyer is sent back to the home page
- [ ] AI button: with no key or quota it shows "Demo suggestion", and nothing breaks
- [ ] No `.env` files or secret keys in the repo (only `.env.example`); the service-role key is not used anywhere
- [ ] No company name, logo or copied photos in the repo, the site or the video
- [ ] Old test orders removed before recording (Supabase SQL editor):
  ```sql
  delete from public.orders
  where buyer_id = (select id from auth.users where email = 'buyer@test.com');
  ```
  (order items are deleted with their orders)
- [ ] APK link uploaded to Drive and added to README.md
