-- Mini Marketplace: schema, RLS, and server-side functions.
-- Prices are numeric(10,2). Roles live in profiles.role and are enforced by RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  display_name text not null default '',
  status       text not null default 'approved' check (status in ('pending', 'approved', 'hidden')),
  created_at   timestamptz not null default now()
);

-- Create a profile for every new auth user.
-- Self sign-up can only pick buyer or seller (never admin). Sellers start as 'pending'.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text := case when new.raw_user_meta_data->>'role' = 'seller' then 'seller' else 'buyer' end;
begin
  insert into public.profiles (id, role, display_name, status)
  values (
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when v_role = 'seller' then 'pending' else 'approved' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers used by the RLS policies below.
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'admin', false)
$$;

create or replace function public.is_seller() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'seller', false)
$$;

-- ------------------------------------------------------------- catalogue
create table public.categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  parent_id uuid references public.categories(id)
);

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  seller_id        uuid not null references public.profiles(id),
  category_id      uuid references public.categories(id),
  title            text not null,
  description      text not null default '',
  base_price       numeric(10,2) not null check (base_price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price >= 0),
  status           text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'hidden')),
  created_at       timestamptz not null default now()
);

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,          -- storage URL, or empty when using a placeholder
  alt        text not null default '',
  position   int not null default 0
);

create table public.option_groups (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name       text not null,          -- Colour, Size, Storage, Headboard, Base, Assembly
  type       text not null check (type in ('swatch', 'select', 'checkbox')),
  position   int not null default 0,
  required   boolean not null default true
);

create table public.option_values (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.option_groups(id) on delete cascade,
  label       text not null,
  price_delta numeric(10,2) not null default 0,
  hex         text check (hex ~ '^#[0-9a-fA-F]{6}$'),
  image_id    uuid references public.product_images(id) on delete set null,
  position    int not null default 0
);

create index on public.products (status);
create index on public.option_groups (product_id);
create index on public.option_values (group_id);
create index on public.product_images (product_id);

-- ---------------------------------------------------------------- orders
-- No insert/update policies on orders: they are changed only by the
-- place_order and set_order_status functions below.
create table public.orders (
  id         uuid primary key default gen_random_uuid(),
  buyer_id   uuid not null references public.profiles(id),
  status     text not null default 'new' check (status in ('new', 'confirmed', 'shipped', 'delivered')),
  total      numeric(10,2) not null default 0,
  shipping   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  buyer_id    uuid not null,          -- copied from the order so RLS needs no join
  seller_id   uuid not null,
  product_id  uuid references public.products(id) on delete set null,
  title       text not null,          -- snapshot
  options     jsonb not null,         -- snapshot: [{group, label, price_delta}]
  unit_price  numeric(10,2) not null, -- snapshot
  quantity    int not null check (quantity > 0)
);

create index on public.orders (buyer_id);
create index on public.order_items (order_id);
create index on public.order_items (seller_id);

-- -------------------------------------------------------------------- RLS
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.option_groups  enable row level security;
alter table public.option_values  enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

-- profiles: readable by all (only role, name, status). Only admins change them.
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_admin  on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- categories: public read, admin write
create policy categories_read  on public.categories for select using (true);
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());

-- products: the public sees approved products from approved sellers.
-- A seller sees and edits their own, but can only save them as draft/pending.
create policy products_read on public.products for select using (
  (status = 'approved' and exists (
     select 1 from public.profiles s where s.id = seller_id and s.status = 'approved'))
  or seller_id = auth.uid()
  or public.is_admin()
);
create policy products_seller_insert on public.products for insert
  with check (public.is_seller() and seller_id = auth.uid() and status in ('draft', 'pending'));
create policy products_seller_update on public.products for update
  using (seller_id = auth.uid() and public.is_seller())
  with check (seller_id = auth.uid() and status in ('draft', 'pending'));
create policy products_seller_delete on public.products for delete
  using (seller_id = auth.uid() and public.is_seller());
create policy products_admin on public.products for all
  using (public.is_admin()) with check (public.is_admin());

-- child tables of a product: visible if the product is visible (the subquery
-- runs through products RLS); writable by the product's seller or an admin.
create policy images_read on public.product_images for select
  using (exists (select 1 from public.products p where p.id = product_id));
create policy images_write on public.product_images for all
  using (exists (select 1 from public.products p where p.id = product_id and (p.seller_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.products p where p.id = product_id and (p.seller_id = auth.uid() or public.is_admin())));

create policy groups_read on public.option_groups for select
  using (exists (select 1 from public.products p where p.id = product_id));
create policy groups_write on public.option_groups for all
  using (exists (select 1 from public.products p where p.id = product_id and (p.seller_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.products p where p.id = product_id and (p.seller_id = auth.uid() or public.is_admin())));

create policy values_read on public.option_values for select
  using (exists (select 1 from public.option_groups g where g.id = group_id));
create policy values_write on public.option_values for all
  using (exists (select 1 from public.option_groups g join public.products p on p.id = g.product_id
                 where g.id = group_id and (p.seller_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.option_groups g join public.products p on p.id = g.product_id
                 where g.id = group_id and (p.seller_id = auth.uid() or public.is_admin())));

-- orders: buyer sees own; seller sees orders that contain their items; admin sees all
create policy order_items_read on public.order_items for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy orders_read on public.orders for select using (
  buyer_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.order_items oi where oi.order_id = orders.id and oi.seller_id = auth.uid())
);

-- ------------------------------------------------------------ place_order
-- p_items: [{ "product_id": uuid, "quantity": int, "value_ids": [uuid, ...] }]
-- Prices come from the DB only: unit price = base_price + sum(price_delta of chosen values).
-- Anything the client sends about prices is ignored (it is not even read).
create or replace function public.place_order(p_items jsonb, p_shipping jsonb default '{}')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_order   uuid;
  v_total   numeric(10,2) := 0;
  v_item    jsonb;
  v_product public.products%rowtype;
  v_ids     uuid[];
  v_qty     int;
  v_unit    numeric(10,2);
  v_options jsonb;
  g         record;
begin
  if v_uid is null then raise exception 'Please sign in to place an order'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your basket is empty';
  end if;

  insert into public.orders (buyer_id, shipping) values (v_uid, coalesce(p_shipping, '{}'))
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'Quantity must be between 1 and 20'; end if;

    select p.* into v_product
    from public.products p
    join public.profiles s on s.id = p.seller_id
    where p.id = (v_item->>'product_id')::uuid and p.status = 'approved' and s.status = 'approved';
    if not found then raise exception 'Product is not available'; end if;

    select coalesce(array_agg(x::uuid), '{}') into v_ids
    from jsonb_array_elements_text(coalesce(v_item->'value_ids', '[]'::jsonb)) x;

    -- every chosen value must belong to this product
    if exists (
      select 1 from unnest(v_ids) vid
      where not exists (select 1 from public.option_values ov
                        join public.option_groups og on og.id = ov.group_id
                        where ov.id = vid and og.product_id = v_product.id)
    ) then raise exception 'Invalid option for this product'; end if;

    -- one value per group; required groups must have one
    for g in
      select og.name, og.required,
             (select count(*) from public.option_values ov where ov.group_id = og.id and ov.id = any (v_ids)) as n
      from public.option_groups og where og.product_id = v_product.id
    loop
      if g.n > 1 then raise exception 'Choose only one % option', g.name; end if;
      if g.required and g.n = 0 then raise exception 'Please choose a % option', g.name; end if;
    end loop;

    select v_product.base_price + coalesce(sum(ov.price_delta), 0),
           coalesce(jsonb_agg(jsonb_build_object('group', og.name, 'label', ov.label, 'price_delta', ov.price_delta)
                              order by og.position), '[]'::jsonb)
      into v_unit, v_options
    from public.option_values ov
    join public.option_groups og on og.id = ov.group_id
    where ov.id = any (v_ids);

    insert into public.order_items (order_id, buyer_id, seller_id, product_id, title, options, unit_price, quantity)
    values (v_order, v_uid, v_product.seller_id, v_product.id, v_product.title, v_options, v_unit, v_qty);

    v_total := v_total + v_unit * v_qty;
  end loop;

  update public.orders set total = v_total where id = v_order;
  return v_order;
end $$;

-- --------------------------------------------------------- set_order_status
-- Sellers (of items in the order) and admins may move an order one step forward.
create or replace function public.set_order_status(p_order uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current text;
  v_steps   text[] := array['new', 'confirmed', 'shipped', 'delivered'];
begin
  select status into v_current from public.orders where id = p_order;
  if v_current is null then raise exception 'Order not found'; end if;

  if not (public.is_admin() or exists (
    select 1 from public.order_items where order_id = p_order and seller_id = auth.uid()
  )) then raise exception 'Not allowed'; end if;

  if array_position(v_steps, p_status) is distinct from array_position(v_steps, v_current) + 1 then
    raise exception 'Cannot change status from % to %', v_current, p_status;
  end if;

  update public.orders set status = p_status where id = p_order;
end $$;

revoke all on function public.place_order(jsonb, jsonb) from public;
revoke all on function public.set_order_status(uuid, text) from public;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product images are public" on storage.objects for select
  using (bucket_id = 'product-images');
-- sellers upload into a folder named after their own user id
create policy "sellers upload own images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_seller()
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sellers delete own images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
