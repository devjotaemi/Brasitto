-- Correcao das fotos do cardapio da Espetaria.
-- Imagens verificadas visualmente uma a uma (bancos abertos Pexels/Unsplash).
-- Seguro e idempotente: pode rodar novamente sem efeitos colaterais.
-- Rode no Supabase (SQL Editor) para refletir em producao.

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

-- ---------------------------------------------------------------------------
-- Espetos
-- ---------------------------------------------------------------------------
update products set image_url =
  'https://images.pexels.com/photos/11112699/pexels-photo-11112699.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Espeto de Carne';

update products set image_url =
  'https://images.pexels.com/photos/37183926/pexels-photo-37183926.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Espeto de Coracao';

update products set image_url =
  'https://images.pexels.com/photos/38138068/pexels-photo-38138068.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Espeto de Frango';

update products set image_url =
  'https://images.pexels.com/photos/37080242/pexels-photo-37080242.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Espeto de Kafta';

update products set image_url =
  'https://images.pexels.com/photos/14457754/pexels-photo-14457754.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Espeto de Linguica';

update products set image_url =
  'https://images.pexels.com/photos/32879325/pexels-photo-32879325.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Espeto de Medalhao';

update products set image_url =
  'https://images.pexels.com/photos/36912022/pexels-photo-36912022.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Espeto de Porco';

update products set image_url =
  'https://images.pexels.com/photos/8751408/pexels-photo-8751408.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Espeto de Queijo Coalho';

update products set image_url =
  'https://images.pexels.com/photos/9200388/pexels-photo-9200388.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Espeto Misto';

update products set image_url =
  'https://images.pexels.com/photos/37043987/pexels-photo-37043987.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Pao de Alho';

-- ---------------------------------------------------------------------------
-- Bebidas
-- ---------------------------------------------------------------------------
update products set image_url =
  'https://images.pexels.com/photos/327090/pexels-photo-327090.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Agua Mineral';

update products set image_url =
  'https://images.pexels.com/photos/5659174/pexels-photo-5659174.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Cerveja Long Neck';

update products set image_url =
  'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80'
where name = 'Coca-Cola Lata';

update products set image_url =
  'https://images.pexels.com/photos/8065260/pexels-photo-8065260.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Guarana Lata';

update products set image_url =
  'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=900&q=80'
where name = 'Suco Natural';

-- ---------------------------------------------------------------------------
-- Doces
-- ---------------------------------------------------------------------------
update products set image_url =
  'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=900&q=80'
where name = 'Bolo de Chocolate';

update products set image_url =
  'https://images.pexels.com/photos/33158039/pexels-photo-33158039.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Brigadeiro';

update products set image_url =
  'https://images.unsplash.com/photo-1590841609987-4ac211afdde1?auto=format&fit=crop&w=900&q=80'
where name = 'Brownie';

update products set image_url =
  'https://images.pexels.com/photos/24247238/pexels-photo-24247238.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Mousse de Maracuja';

update products set image_url =
  'https://images.pexels.com/photos/10918153/pexels-photo-10918153.jpeg?auto=compress&cs=tinysrgb&w=900'
where name = 'Pudim';

update products set image_url =
  'https://images.unsplash.com/photo-1560008581-09826d1de69e?auto=format&fit=crop&w=900&q=80'
where name = 'Sorvete';
