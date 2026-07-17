-- Hotfix for production Supabase RPC exposure.
-- Run this in the Supabase SQL editor for the Espetaria project.
-- It refreshes the store settings RPCs and recreates create_order_with_items
-- with the current 8-argument signature used by the frontend.

grant usage on schema public to anon;
grant usage on schema public to authenticated;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values (
  'store_settings',
  jsonb_build_object(
    'storeOpen',
    true,
    'deliveryFee',
    8,
    'deliveryRegions',
    '[]'::jsonb
  )
)
on conflict (key) do nothing;

alter table public.orders
add column if not exists customer_phone_normalized text;

alter table public.orders
add column if not exists customer_note text;

alter table public.orders
add column if not exists estimated_ready_at timestamptz;

alter table public.orders
add column if not exists cancellation_reason text;

update public.orders
set customer_phone_normalized = regexp_replace(customer_phone, '\D', '', 'g')
where customer_phone_normalized is null
  or customer_phone_normalized = '';

create index if not exists idx_orders_active_phone_normalized
on public.orders(customer_phone_normalized)
where status in (
  'PENDING',
  'ACCEPTED',
  'IN_PREPARATION',
  'OUT_FOR_DELIVERY',
  'READY_FOR_PICKUP'
);

drop function if exists public.get_store_settings();

create or replace function public.get_store_settings()
returns table (
  store_open boolean,
  delivery_fee numeric,
  delivery_regions jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce((value ->> 'storeOpen')::boolean, true) as store_open,
    coalesce((value ->> 'deliveryFee')::numeric, 8) as delivery_fee,
    coalesce(value -> 'deliveryRegions', '[]'::jsonb) as delivery_regions
  from app_settings
  where key = 'store_settings';
$$;

drop function if exists public.set_store_settings(boolean, numeric);
drop function if exists public.set_store_settings(boolean, numeric, jsonb);

create or replace function public.set_store_settings(
  p_store_open boolean,
  p_delivery_fee numeric,
  p_delivery_regions jsonb default '[]'::jsonb
)
returns table (
  store_open boolean,
  delivery_fee numeric,
  delivery_regions jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_regions jsonb;
  v_region jsonb;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') <> 'true' then
    raise exception 'Only owner can change store settings';
  end if;

  if p_delivery_fee < 0 then
    raise exception 'Delivery fee must be zero or greater';
  end if;

  v_regions := coalesce(p_delivery_regions, '[]'::jsonb);

  if jsonb_typeof(v_regions) <> 'array' then
    raise exception 'Delivery regions must be a list';
  end if;

  for v_region in select * from jsonb_array_elements(v_regions)
  loop
    if coalesce(btrim(v_region ->> 'name'), '') = '' then
      raise exception 'Delivery region must have a name';
    end if;

    if (v_region ->> 'fee')::numeric < 0 then
      raise exception 'Delivery region fee must be zero or greater';
    end if;
  end loop;

  update app_settings
  set
    value = jsonb_build_object(
      'storeOpen',
      p_store_open,
      'deliveryFee',
      p_delivery_fee,
      'deliveryRegions',
      v_regions
    ),
    updated_at = now()
  where key = 'store_settings';

  return query
  select *
  from public.get_store_settings();
end;
$$;

grant execute on function public.get_store_settings() to anon, authenticated;
grant execute on function public.set_store_settings(boolean, numeric, jsonb)
to authenticated;

drop function if exists public.create_order_with_items(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  jsonb
);

drop function if exists public.create_order_with_items(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
);

drop function if exists public.create_order_with_items(
  uuid,
  text,
  text,
  text,
  text,
  jsonb
);

drop function if exists public.create_order_with_items(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
);

create or replace function public.create_order_with_items(
  p_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_order_type text,
  p_address text,
  p_customer_note text,
  p_delivery_region text,
  p_items jsonb
)
returns table (
  id uuid,
  order_number integer,
  customer_name text,
  customer_phone text,
  order_type text,
  address text,
  status text,
  created_at timestamptz,
  finished_at timestamptz,
  customer_note text,
  estimated_ready_at timestamptz,
  delivery_fee numeric,
  cancellation_reason text,
  product_name text,
  quantity integer,
  unit_price numeric,
  total_price numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(10, 2);
  v_delivery_fee numeric(10, 2);
  v_total numeric(10, 2);
  v_store_open boolean;
  v_delivery_regions jsonb;
  v_region_fee numeric(10, 2);
  v_normalized_customer_phone text;
begin
  select settings.store_open, settings.delivery_fee, settings.delivery_regions
  into v_store_open, v_delivery_fee, v_delivery_regions
  from public.get_store_settings() as settings;

  if v_store_open = false then
    raise exception 'Store is closed';
  end if;

  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'Order must have customer name and phone';
  end if;

  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'Order must have customer name and phone';
  end if;

  v_normalized_customer_phone := regexp_replace(p_customer_phone, '\D', '', 'g');

  if v_normalized_customer_phone = '' then
    raise exception 'Order must have customer name and phone';
  end if;

  if exists (
    select 1
    from orders existing_order
    where existing_order.customer_phone_normalized = v_normalized_customer_phone
      and existing_order.status in (
        'PENDING',
        'ACCEPTED',
        'IN_PREPARATION',
        'OUT_FOR_DELIVERY',
        'READY_FOR_PICKUP'
      )
  ) then
    raise exception 'Customer already has an active order';
  end if;

  if p_order_type not in ('DELIVERY', 'PICKUP') then
    raise exception 'Invalid order type';
  end if;

  if p_order_type = 'DELIVERY' and (p_address is null or btrim(p_address) = '') then
    raise exception 'Delivery order must have an address';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must have at least one item';
  end if;

  create temporary table tmp_order_items on commit drop as
  select
    products.id as product_id,
    products.name as product_name,
    input_items.quantity,
    products.price as unit_price,
    products.price * input_items.quantity as total_price
  from jsonb_to_recordset(p_items) as input_items (
    product_id uuid,
    quantity integer
  )
  inner join products on products.id = input_items.product_id
  where products.active = true
    and input_items.quantity > 0;

  if (select count(*) from tmp_order_items) <> jsonb_array_length(p_items) then
    raise exception 'Order contains inactive, missing or invalid products';
  end if;

  select coalesce(sum(tmp_order_items.total_price), 0)
  into v_subtotal
  from tmp_order_items;

  if p_order_type = 'DELIVERY' then
    if p_delivery_region is not null and btrim(p_delivery_region) <> '' then
      select (region ->> 'fee')::numeric
      into v_region_fee
      from jsonb_array_elements(coalesce(v_delivery_regions, '[]'::jsonb)) as region
      where region ->> 'name' = p_delivery_region
      limit 1;

      if v_region_fee is not null then
        v_delivery_fee := v_region_fee;
      end if;
    end if;
  else
    v_delivery_fee := 0;
  end if;

  v_total := v_subtotal + v_delivery_fee;

  insert into orders (
    id,
    customer_name,
    customer_phone,
    customer_phone_normalized,
    order_type,
    address,
    customer_note,
    subtotal,
    delivery_fee,
    total,
    status
  )
  values (
    p_id,
    p_customer_name,
    p_customer_phone,
    v_normalized_customer_phone,
    p_order_type,
    case when p_order_type = 'DELIVERY' then p_address else null end,
    nullif(btrim(coalesce(p_customer_note, '')), ''),
    v_subtotal,
    v_delivery_fee,
    v_total,
    'PENDING'
  );

  insert into order_items (
    order_id,
    product_id,
    product_name,
    quantity,
    unit_price,
    total_price
  )
  select
    p_id,
    tmp_order_items.product_id,
    tmp_order_items.product_name,
    tmp_order_items.quantity,
    tmp_order_items.unit_price,
    tmp_order_items.total_price
  from tmp_order_items;

  return query
  select
    created_order.id,
    created_order.order_number,
    created_order.customer_name,
    created_order.customer_phone,
    created_order.order_type,
    created_order.address,
    created_order.status,
    created_order.created_at,
    created_order.finished_at,
    created_order.customer_note,
    created_order.estimated_ready_at,
    created_order.delivery_fee,
    created_order.cancellation_reason,
    created_order_items.product_name,
    created_order_items.quantity,
    created_order_items.unit_price,
    created_order_items.total_price
  from orders created_order
  inner join order_items created_order_items
    on created_order_items.order_id = created_order.id
  where created_order.id = p_id;
end;
$$;

grant execute on function public.create_order_with_items(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to anon, authenticated;

notify pgrst, 'reload schema';

-- Optional owner check for the admin user that must be able to close the store:
-- select email, raw_app_meta_data
-- from auth.users
-- where raw_app_meta_data ->> 'owner' = 'true';
