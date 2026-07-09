create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  price numeric(10, 2) not null check (price > 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence if not exists order_number_sequence;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer not null default nextval('order_number_sequence') unique,
  customer_name text not null,
  customer_phone text not null,
  customer_phone_normalized text,
  order_type text not null check (order_type in ('DELIVERY', 'PICKUP')),
  address text,
  customer_note text,
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  delivery_fee numeric(10, 2) not null check (delivery_fee >= 0),
  total numeric(10, 2) not null check (total >= 0),
  status text not null default 'PENDING' check (
    status in (
      'PENDING',
      'ACCEPTED',
      'IN_PREPARATION',
      'OUT_FOR_DELIVERY',
      'READY_FOR_PICKUP',
      'FINISHED',
      'CANCELED'
    )
  ),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  estimated_ready_at timestamptz,
  cancellation_reason text,
  constraint delivery_orders_require_address check (
    order_type <> 'DELIVERY' or address is not null
  ),
  constraint pickup_orders_have_no_delivery_fee check (
    order_type <> 'PICKUP' or delivery_fee = 0
  )
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price > 0),
  total_price numeric(10, 2) not null check (total_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value)
values (
  'application_lock',
  jsonb_build_object(
    'locked',
    false,
    'reason',
    'payment_overdue'
  )
)
on conflict (key) do nothing;

insert into app_settings (key, value)
values (
  'store_settings',
  jsonb_build_object(
    'storeOpen',
    true,
    'deliveryFee',
    8
  )
)
on conflict (key) do nothing;

alter table orders
add column if not exists order_number integer;

alter table orders
add column if not exists finished_at timestamptz;

alter table orders
add column if not exists customer_note text;

alter table orders
add column if not exists customer_phone_normalized text;

alter table orders
add column if not exists estimated_ready_at timestamptz;

alter table orders
add column if not exists cancellation_reason text;

alter table products
add column if not exists image_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_image_url_max_length'
      and conrelid = 'products'::regclass
  ) then
    alter table products
    add constraint products_image_url_max_length
    check (image_url is null or char_length(image_url) <= 1000) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_image_url_http'
      and conrelid = 'products'::regclass
  ) then
    alter table products
    add constraint products_image_url_http
    check (image_url is null or image_url ~ '^https?://') not valid;
  end if;
end;
$$;

alter table orders
alter column order_number set default nextval('order_number_sequence');

update orders
set order_number = nextval('order_number_sequence')
where order_number is null;

alter table orders
alter column order_number set not null;

update orders
set finished_at = created_at
where status = 'FINISHED'
  and finished_at is null;

update orders
set customer_phone_normalized = regexp_replace(customer_phone, '\D', '', 'g')
where customer_phone_normalized is null
  or customer_phone_normalized = '';

create index if not exists idx_products_active on products(active);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_orders_active_phone_normalized
on orders(customer_phone_normalized)
where status in (
  'PENDING',
  'ACCEPTED',
  'IN_PREPARATION',
  'OUT_FOR_DELIVERY',
  'READY_FOR_PICKUP'
);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end;
$$;

create unique index if not exists idx_orders_order_number_unique
on orders(order_number);

create or replace function public.get_store_settings()
returns table (
  store_open boolean,
  delivery_fee numeric
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce((value ->> 'storeOpen')::boolean, true) as store_open,
    coalesce((value ->> 'deliveryFee')::numeric, 8) as delivery_fee
  from app_settings
  where key = 'store_settings';
$$;

create or replace function public.set_store_settings(
  p_store_open boolean,
  p_delivery_fee numeric
)
returns table (
  store_open boolean,
  delivery_fee numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') <> 'true' then
    raise exception 'Only owner can change store settings';
  end if;

  if p_delivery_fee < 0 then
    raise exception 'Delivery fee must be zero or greater';
  end if;

  update app_settings
  set
    value = jsonb_build_object(
      'storeOpen',
      p_store_open,
      'deliveryFee',
      p_delivery_fee
    ),
    updated_at = now()
  where key = 'store_settings';

  return query
  select *
  from public.get_store_settings();
end;
$$;

grant execute on function public.get_store_settings() to anon, authenticated;
grant execute on function public.set_store_settings(boolean, numeric) to authenticated;

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

create or replace function public.create_order_with_items(
  p_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_order_type text,
  p_address text,
  p_customer_note text,
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
  v_normalized_customer_phone text;
begin
  select settings.store_open, settings.delivery_fee
  into v_store_open, v_delivery_fee
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

  v_delivery_fee := case when p_order_type = 'DELIVERY' then v_delivery_fee else 0 end;
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
  jsonb
) to anon, authenticated;

drop function if exists public.get_customer_order_status(integer, text);

create or replace function public.get_customer_order_status(
  p_order_number integer,
  p_customer_phone text
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
language sql
security definer
set search_path = public
as $$
  select
    orders.id,
    orders.order_number,
    orders.customer_name,
    orders.customer_phone,
    orders.order_type,
    orders.address,
    orders.status,
    orders.created_at,
    orders.finished_at,
    orders.customer_note,
    orders.estimated_ready_at,
    orders.delivery_fee,
    orders.cancellation_reason,
    order_items.product_name,
    order_items.quantity,
    order_items.unit_price,
    order_items.total_price
  from orders
  inner join order_items on order_items.order_id = orders.id
  where orders.order_number = p_order_number
    and orders.customer_phone_normalized = regexp_replace(p_customer_phone, '\D', '', 'g')
  order by order_items.created_at asc;
$$;

grant execute on function public.get_customer_order_status(integer, text)
to anon, authenticated;

drop function if exists public.cancel_customer_order(integer, text);

create or replace function public.cancel_customer_order(
  p_order_number integer,
  p_customer_phone text
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
  v_order_id uuid;
  v_order_status text;
begin
  if p_order_number is null or p_order_number <= 0 then
    raise exception 'Order number must be a positive integer';
  end if;

  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'Customer phone is required';
  end if;

  select existing_order.id, existing_order.status
  into v_order_id, v_order_status
  from orders existing_order
  where existing_order.order_number = p_order_number
    and existing_order.customer_phone_normalized = regexp_replace(p_customer_phone, '\D', '', 'g')
  limit 1;

  if v_order_id is null then
    raise exception 'Customer order not found';
  end if;

  if v_order_status not in ('PENDING', 'ACCEPTED') then
    raise exception 'Customer order cannot be canceled';
  end if;

  update orders
  set
    status = 'CANCELED',
    cancellation_reason = 'Cancelado pelo cliente'
  where orders.id = v_order_id;

  return query
  select
    canceled_order.id,
    canceled_order.order_number,
    canceled_order.customer_name,
    canceled_order.customer_phone,
    canceled_order.order_type,
    canceled_order.address,
    canceled_order.status,
    canceled_order.created_at,
    canceled_order.finished_at,
    canceled_order.customer_note,
    canceled_order.estimated_ready_at,
    canceled_order.delivery_fee,
    canceled_order.cancellation_reason,
    canceled_order_items.product_name,
    canceled_order_items.quantity,
    canceled_order_items.unit_price,
    canceled_order_items.total_price
  from orders canceled_order
  inner join order_items canceled_order_items
    on canceled_order_items.order_id = canceled_order.id
  where canceled_order.id = v_order_id
  order by canceled_order_items.created_at asc;
end;
$$;

grant execute on function public.cancel_customer_order(integer, text)
to anon, authenticated;

create or replace function public.get_application_lock_status()
returns table (
  locked boolean,
  reason text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce((value ->> 'locked')::boolean, false) as locked,
    coalesce(value ->> 'reason', 'payment_overdue') as reason,
    app_settings.updated_at
  from app_settings
  where key = 'application_lock';
$$;

create or replace function public.set_application_lock_status(
  p_locked boolean
)
returns table (
  locked boolean,
  reason text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') <> 'true' then
    raise exception 'Only owner can change lock status';
  end if;

  update app_settings
  set
    value = jsonb_build_object(
      'locked',
      p_locked,
      'reason',
      'payment_overdue'
    ),
    updated_at = now()
  where key = 'application_lock';

  return query
  select *
  from public.get_application_lock_status();
end;
$$;

grant execute on function public.get_application_lock_status() to anon, authenticated;
grant execute on function public.set_application_lock_status(boolean) to authenticated;

drop function if exists public.get_database_monitoring();

create or replace function public.get_database_monitoring()
returns table (
  metric text,
  severity text,
  label text,
  count integer,
  max_duration_seconds integer,
  sample_application_name text,
  checked_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_checked_at timestamptz := now();
  v_max_connections integer := current_setting('max_connections')::integer;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') <> 'true' then
    raise exception 'Only owner can view database monitoring';
  end if;

  return query
  with activity as (
    select
      pg_stat_activity.pid,
      case
        when pg_stat_activity.application_name ilike '%postgrest%' then 'PostgREST'
        when pg_stat_activity.application_name ilike '%supavisor%' then 'Supavisor'
        when pg_stat_activity.application_name ilike '%realtime%' then 'Supabase Realtime'
        when pg_stat_activity.application_name ilike '%dbeaver%' then 'DBeaver'
        when pg_stat_activity.application_name ilike '%postgres_exporter%' then 'Postgres exporter'
        when nullif(pg_stat_activity.application_name, '') is null then null
        else 'Outro cliente'
      end as application_name,
      pg_stat_activity.state,
      pg_stat_activity.xact_start,
      pg_stat_activity.query_start,
      pg_stat_activity.state_change
    from pg_stat_activity
    where pg_stat_activity.pid <> pg_backend_pid()
  ),
  blocked_queries as (
    select
      activity.application_name,
      greatest(
        0,
        extract(epoch from v_checked_at - coalesce(activity.query_start, activity.state_change))
      )::integer as duration_seconds
    from activity
    where exists (
      select 1
      from pg_locks
      where pg_locks.pid = activity.pid
        and pg_locks.granted = false
    )
  ),
  idle_transactions as (
    select
      activity.application_name,
      greatest(0, extract(epoch from v_checked_at - activity.xact_start))::integer as duration_seconds
    from activity
    where activity.state = 'idle in transaction'
      and activity.xact_start is not null
  ),
  long_running_queries as (
    select
      activity.application_name,
      greatest(0, extract(epoch from v_checked_at - activity.query_start))::integer as duration_seconds
    from activity
    where activity.state = 'active'
      and activity.query_start is not null
      and activity.query_start < v_checked_at - interval '15 seconds'
  ),
  connection_usage as (
    select count(*)::integer as used_connections
    from activity
  )
  select
    'blocked_queries'::text as metric,
    case
      when coalesce(max(blocked_queries.duration_seconds), 0) >= 60 then 'critical'
      when count(*) > 0 then 'warning'
      else 'info'
    end::text as severity,
    'Queries bloqueadas por lock'::text as label,
    count(*)::integer as count,
    coalesce(max(blocked_queries.duration_seconds), 0)::integer as max_duration_seconds,
    max(blocked_queries.application_name)::text as sample_application_name,
    v_checked_at as checked_at
  from blocked_queries

  union all

  select
    'idle_transactions'::text as metric,
    case
      when coalesce(max(idle_transactions.duration_seconds), 0) >= 300 then 'critical'
      when count(*) > 0 then 'warning'
      else 'info'
    end::text as severity,
    'Transacoes paradas abertas'::text as label,
    count(*)::integer as count,
    coalesce(max(idle_transactions.duration_seconds), 0)::integer as max_duration_seconds,
    max(idle_transactions.application_name)::text as sample_application_name,
    v_checked_at as checked_at
  from idle_transactions

  union all

  select
    'long_running_queries'::text as metric,
    case
      when coalesce(max(long_running_queries.duration_seconds), 0) >= 60 then 'critical'
      when count(*) > 0 then 'warning'
      else 'info'
    end::text as severity,
    'Queries ativas longas'::text as label,
    count(*)::integer as count,
    coalesce(max(long_running_queries.duration_seconds), 0)::integer as max_duration_seconds,
    max(long_running_queries.application_name)::text as sample_application_name,
    v_checked_at as checked_at
  from long_running_queries

  union all

  select
    'connection_usage'::text as metric,
    case
      when connection_usage.used_connections >= ceil(v_max_connections * 0.8) then 'critical'
      when connection_usage.used_connections >= ceil(v_max_connections * 0.7) then 'warning'
      else 'info'
    end::text as severity,
    'Uso de conexoes do banco'::text as label,
    connection_usage.used_connections::integer as count,
    0::integer as max_duration_seconds,
    null::text as sample_application_name,
    v_checked_at as checked_at
  from connection_usage;
end;
$$;

revoke all on function public.get_database_monitoring() from public, anon;
grant execute on function public.get_database_monitoring() to authenticated;
