# AI notes

Running log. Entries are added as things happen during the build.

## Tools
- Claude Code (Claude Sonnet 5.5) as pair programmer: plan, SQL schema/RLS/RPCs, web code, mobile code, tests and docs.
- Playwright driving real Chrome at 360px, used to check what the AI wrote instead of trusting it.
- PGlite (Postgres in Node) to run the migration and test row-level security as each role.
- Gemini (Google AI Studio key) is the model behind the "describe my photo" feature. It started as Anthropic, then Ollama, and was switched to Gemini because that is the key I have.

## Mistakes the AI made, and the fixes
1. **RLS policy matched the wrong column (DB slice).**
   In `orders_read`, the AI wrote `exists (select 1 from order_items oi where oi.order_id = id ...)`.
   Inside that subquery the bare `id` resolves to `order_items.id`, not `orders.id`, so sellers saw zero orders.
   Found by running the migration against a real Postgres (PGlite) and testing as the seller role. Fixed by writing `orders.id`.
   Lesson: always qualify column names in policy subqueries, and test RLS as each role instead of trusting a read-through.

## Decisions I (the human) must be able to explain
- Cart lives on the client (localStorage / AsyncStorage). Only `place_order` touches the DB at checkout.
- `place_order` ignores any price sent by the client and recomputes it from `option_values`.

2. **Wrong hand-calculated expected prices in unit tests.**
   The AI wrote expected totals for two option combinations by mental arithmetic (£639.99 and £499.98); the real sums are £609.99 and £449.98.
   `calculatePrice` was right; the tests failed and exposed the slip. Fixed the expectations and re-checked the sums with a second tool.
   Lesson: a failing test can mean the test is wrong. Check the arithmetic before touching the code.

3. **Page was wider than 360px, and the AI's own check hid it.**
   The product page grid had no `grid-cols-1`, so on mobile the single column grew to fit the thumbnail strip (449px wide).
   The AI had also added `overflow-x: hidden` on `body`, which made the "no horizontal scroll" check pass while the sticky Add-to-Basket bar was pushed off-screen.
   Found by driving the page in real Chrome at 360px (Playwright): the button could not be clicked. Fixed with `grid-cols-1` and by checking `window.innerWidth` instead of scrollWidth.
   Lesson: hiding overflow is not the same as having none; test at the real width.

4. **Empty environment variable broke the AI model name.**
   The AI wrote `process.env.OLLAMA_MODEL ?? "default-model"`. `.env.example` ships `OLLAMA_MODEL=` with nothing after it, and an empty string is not "missing", so the code would have sent an empty model name. Found while testing the real call. Fixed with `||` and the same rule for the Gemini route.
   Lesson: `??` only covers undefined; env files give empty strings.

5. **Claimed a missing AI key when the real reason was a missing photo.**
   The first version of the form always said "no AI key configured", even when the actual cause was that no photo had been uploaded yet. Noticed when the message appeared and the cause was unclear (the AI had assumed the key was the only reason). The route now returns a `reason` (`no_photo`, `no_key`, `unavailable`) and the form shows the right message.

6. **A placeholder pasted as if it were a real value.**
   The AI's setup steps showed a placeholder (`<your publishable key>`, then `PASTE_KEY_HERE`) for the public Supabase key; the placeholder was pasted literally, first into the shell and then into the EAS environment, so the first APK was built with a wrong key. Found by reading `env:list` output, not by the build (the build still succeeded). Fixed by overwriting the variable from `mobile/.env` and rebuilding.
   Lesson: a green build does not prove the configuration is right; read the values back.

7. **Guessing at a changing API.**
   Google's current docs describe a newer API and new model names than the `generateContent` call the AI knew. The AI used the call it knew, kept the model name in an environment variable, and marked the real call as unverified instead of presenting it as working.
