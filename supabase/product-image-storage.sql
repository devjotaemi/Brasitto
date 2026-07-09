insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read product images" on storage.objects;
drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Admins can update product images" on storage.objects;
drop policy if exists "Admins can delete product images" on storage.objects;

create policy "Public can read product images"
on storage.objects
for select
to public
using (bucket_id = 'product-images');

create policy "Admins can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
  )
);

create policy "Admins can update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
  )
)
with check (
  bucket_id = 'product-images'
  and (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
  )
);

create policy "Admins can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'owner', 'false') = 'true'
  )
);
