import { describe, expect, it } from 'vitest';
import hotfixSql from '../../supabase/hotfix-rpc-orders-store-settings.sql?raw';
import schemaSql from '../../supabase/schema.sql?raw';

const normalizeSql = (value: string) => value.replace(/\s+/g, ' ').trim();

describe('Supabase schema SQL', () => {
  it('concede execute para a assinatura atual da RPC de criacao de pedido', () => {
    const normalizedSchema = normalizeSql(schemaSql);

    expect(normalizedSchema).toContain(
      normalizeSql(`
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
      `),
    );
    expect(normalizedSchema).toContain(
      normalizeSql(`
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
      `),
    );
  });

  it('mantem o hotfix de producao alinhado com a RPC atual', () => {
    const normalizedHotfix = normalizeSql(hotfixSql);

    expect(normalizedHotfix).toContain(
      normalizeSql(`
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
      `),
    );
    expect(normalizedHotfix).toContain(
      normalizeSql(`
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
      `),
    );
    expect(normalizedHotfix).toContain("notify pgrst, 'reload schema';");
  });
});
