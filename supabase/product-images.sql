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

update products
set image_url = 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=900&q=80'
where name = 'Espeto de Carne';

update products
set image_url = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80'
where name = 'Espeto de Frango';

update products
set image_url = 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=900&q=80'
where name = 'Espeto de Linguica';

update products
set image_url = 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=900&q=80'
where name = 'Espeto de Coracao';

update products
set image_url = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80'
where name = 'Espeto de Queijo Coalho';

update products
set image_url = 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=900&q=80'
where name = 'Espeto Misto';

update products
set image_url = 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?auto=format&fit=crop&w=900&q=80'
where name = 'Pao de Alho';

update products
set image_url = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80'
where name = 'Combo 5 Espetos';
