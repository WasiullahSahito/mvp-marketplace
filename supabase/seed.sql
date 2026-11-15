-- Sample data only. Test password for all three accounts: Test1234!
-- Run AFTER the migrations (SQL editor in Supabase, or `supabase db reset`).

-- ------------------------------------------------------------ test users
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change, email_change_token_new)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'buyer@test.com',  crypt('Test1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"buyer","display_name":"Test Buyer"}',  now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'seller@test.com', crypt('Test1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"seller","display_name":"Demo Seller"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'admin@test.com',  crypt('Test1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"buyer","display_name":"Test Admin"}',  now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email), now(), now(), now()
from auth.users u
where u.email in ('buyer@test.com', 'seller@test.com', 'admin@test.com')
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

-- The sign-up trigger made profiles. Approve the demo seller, promote the admin.
update public.profiles set status = 'approved' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set role = 'admin'      where id = '33333333-3333-3333-3333-333333333333';

-- -------------------------------------------------------------- category
insert into public.categories (id, name) values
  ('c0000000-0000-0000-0000-000000000001', 'Furniture')
on conflict (id) do nothing;
insert into public.categories (id, name, parent_id) values
  ('c0000000-0000-0000-0000-000000000002', 'Divan Beds', 'c0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- --------------------------------------------------------------- product
insert into public.products (id, seller_id, category_id, title, description, base_price, compare_at_price, status)
values (
  'a0000000-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'c0000000-0000-0000-0000-000000000002',
  'Prague Divan Bed – Cream Naples',
  'A sturdy divan bed with a soft Naples-style fabric finish. Choose your colour, size, storage, headboard and base. Sample listing for demo purposes.',
  269.99, 539.98, 'approved'
) on conflict (id) do nothing;

-- Placeholder images: url is empty, the apps draw an SVG tinted with the chosen colour.
insert into public.product_images (product_id, url, alt, position) values
  ('a0000000-0000-0000-0000-000000000001', '', 'Front view',  0),
  ('a0000000-0000-0000-0000-000000000001', '', 'Side view',   1),
  ('a0000000-0000-0000-0000-000000000001', '', 'Headboard',   2),
  ('a0000000-0000-0000-0000-000000000001', '', 'Drawers',     3),
  ('a0000000-0000-0000-0000-000000000001', '', 'Detail',      4);

-- Option groups (colour first). Fixed ids so the values below can refer to them.
insert into public.option_groups (id, product_id, name, type, position, required) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Colour',    'swatch',   0, true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Size',      'select',   1, true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Storage',   'select',   2, true),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Headboard', 'select',   3, true),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Base',      'select',   4, true),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Assembly',  'checkbox', 5, false);

-- Colours: names from the reference product's swatch list; hex values are approximate.
insert into public.option_values (group_id, label, price_delta, hex, position) values
  ('b0000000-0000-0000-0000-000000000001', 'Cream Naples',       0, '#E6DCC6', 0),
  ('b0000000-0000-0000-0000-000000000001', 'Charcoal Coniston',  0, '#4B4D50', 1),
  ('b0000000-0000-0000-0000-000000000001', 'Silver Plush Velvet', 0, '#B9BABC', 2),
  ('b0000000-0000-0000-0000-000000000001', 'Seal Grey Naples',   0, '#A39C94', 3),
  ('b0000000-0000-0000-0000-000000000001', 'Emerald Coniston',   0, '#1F5B3D', 4),
  ('b0000000-0000-0000-0000-000000000001', 'Blue Plush Velvet',  0, '#1F4E8C', 5),
  ('b0000000-0000-0000-0000-000000000001', 'Pink Plush Velvet',  0, '#E2A7B6', 6),
  ('b0000000-0000-0000-0000-000000000001', 'Mocca Plush Velvet', 0, '#6A4934', 7);

insert into public.option_values (group_id, label, price_delta, position) values
  ('b0000000-0000-0000-0000-000000000002', 'Small Single 2FT6', 90,  0),
  ('b0000000-0000-0000-0000-000000000002', 'Single 3FT',        95,  1),
  ('b0000000-0000-0000-0000-000000000002', 'Small Double 4FT',  100, 2),
  ('b0000000-0000-0000-0000-000000000002', 'Double 4FT6',       110, 3),
  ('b0000000-0000-0000-0000-000000000002', 'King 5FT',          125, 4),
  ('b0000000-0000-0000-0000-000000000002', 'Super King 6FT',    150, 5),

  ('b0000000-0000-0000-0000-000000000003', 'No Storage',              0,   0),
  ('b0000000-0000-0000-0000-000000000003', '2 Drawers Left Side',     50,  1),
  ('b0000000-0000-0000-0000-000000000003', '2 Drawers Right Side',    45,  2),
  ('b0000000-0000-0000-0000-000000000003', '2 Drawers Foot End',      155, 3),
  ('b0000000-0000-0000-0000-000000000003', '4 Drawers',               210, 4),

  ('b0000000-0000-0000-0000-000000000004', 'FREE 26" Headboard',               0,  0),
  ('b0000000-0000-0000-0000-000000000004', '54" Floor Standing Headboard',     10, 1),

  ('b0000000-0000-0000-0000-000000000005', 'Standard Base (holds 50 stone)',   0,  0),
  ('b0000000-0000-0000-0000-000000000005', 'Reinforced Base (holds 100 stone)', 25, 1),

  ('b0000000-0000-0000-0000-000000000006', 'Professional Assembly', 39.99, 0);
