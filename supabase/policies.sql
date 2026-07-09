grant usage on schema public to anon;
grant usage on schema public to authenticated;

revoke insert on orders from anon;
revoke insert on orders from authenticated;
revoke insert on order_items from anon;
revoke insert on order_items from authenticated;

grant select on products to anon;
grant select on products to authenticated;
grant select on app_settings to anon;
grant select on app_settings to authenticated;
grant insert on products to authenticated;
grant update on products to authenticated;
grant select on orders to authenticated;
grant select on order_items to authenticated;
grant update on orders to authenticated;
grant select on comandas to authenticated;
grant insert on comandas to authenticated;
grant update on comandas to authenticated;
grant select on comanda_items to authenticated;
grant insert on comanda_items to authenticated;
grant update on comanda_items to authenticated;
grant usage, select on sequence comanda_number_sequence to authenticated;

alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table comandas enable row level security;
alter table comanda_items enable row level security;
alter table app_settings enable row level security;

drop policy if exists "Public can read active products" on products;
drop policy if exists "Authenticated can read all products" on products;
drop policy if exists "Authenticated can create products" on products;
drop policy if exists "Authenticated can update products" on products;
drop policy if exists "Public can read orders" on orders;
drop policy if exists "Public can create orders" on orders;
drop policy if exists "Public can update orders" on orders;
drop policy if exists "Authenticated can read orders" on orders;
drop policy if exists "Authenticated can update orders" on orders;
drop policy if exists "Public can read order items" on order_items;
drop policy if exists "Authenticated can read order items" on order_items;
drop policy if exists "Public can create order items" on order_items;
drop policy if exists "Public can delete order items" on order_items;
drop policy if exists "Public can delete order items by order" on order_items;
drop policy if exists "Public can read application lock setting" on app_settings;
drop policy if exists "Public can read public app settings" on app_settings;
drop policy if exists "Authenticated can read comandas" on comandas;
drop policy if exists "Authenticated can create comandas" on comandas;
drop policy if exists "Authenticated can update comandas" on comandas;
drop policy if exists "Authenticated can read comanda items" on comanda_items;
drop policy if exists "Authenticated can create comanda items" on comanda_items;
drop policy if exists "Authenticated can update comanda items" on comanda_items;

create policy "Public can read active products"
on products
for select
to anon
using (active = true);

-- Admin dashboard protected by Supabase Auth app_metadata.role = admin.
create policy "Authenticated can read all products"
on products
for select
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

-- Admin dashboard protected by Supabase Auth app_metadata.role = admin.
create policy "Authenticated can create products"
on products
for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

-- Admin dashboard protected by Supabase Auth app_metadata.role = admin.
create policy "Authenticated can update products"
on products
for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

-- Admin dashboard protected by Supabase Auth app_metadata.role = admin.
create policy "Authenticated can read orders"
on orders
for select
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

-- Admin dashboard protected by Supabase Auth app_metadata.role = admin.
create policy "Authenticated can update orders"
on orders
for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

-- Admin dashboard protected by Supabase Auth app_metadata.role = admin.
create policy "Authenticated can read order items"
on order_items
for select
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

create policy "Authenticated can read comandas"
on comandas
for select
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

create policy "Authenticated can create comandas"
on comandas
for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

create policy "Authenticated can update comandas"
on comandas
for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

create policy "Authenticated can read comanda items"
on comanda_items
for select
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

create policy "Authenticated can create comanda items"
on comanda_items
for insert
to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

create policy "Authenticated can update comanda items"
on comanda_items
for update
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
);

create policy "Public can read public app settings"
on app_settings
for select
to anon, authenticated
using (key in ('application_lock', 'store_settings'));
