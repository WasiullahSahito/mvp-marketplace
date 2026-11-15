# AI notes

Running log. Entries are added as things happen during the build.

## Tools
- Claude Code (Claude Sonnet 5.5) as pair programmer: plan, SQL schema/RLS/RPCs, and (later) web and mobile code.

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
