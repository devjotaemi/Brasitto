import { describe, expect, it } from 'vitest';
import dailyRolloverSql from '../../supabase/daily-rollover.sql?raw';
import hotfixSql from '../../supabase/hotfix-rpc-orders-store-settings.sql?raw';
import policiesSql from '../../supabase/policies.sql?raw';
import productImageStorageSql from '../../supabase/product-image-storage.sql?raw';
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

  it('permite donoloja nas policies operacionais sem liberar funcoes de owner', () => {
    const normalizedPolicies = normalizeSql(policiesSql);
    const normalizedProductImageStorage = normalizeSql(productImageStorageSql);
    const normalizedSchema = normalizeSql(schemaSql);

    expect(normalizedPolicies).toContain(
      "(auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'donoloja')",
    );
    expect(normalizedProductImageStorage).toContain(
      "(auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'donoloja')",
    );
    expect(normalizedSchema).toContain(
      "raise exception 'Only owner can change lock status'",
    );
    expect(normalizedSchema).toContain(
      "raise exception 'Only owner can view database monitoring'",
    );
  });

  it('define exclusao de produto preservando historico de itens', () => {
    const normalizedSchema = normalizeSql(schemaSql);

    expect(normalizedSchema).toContain(
      normalizeSql(`
        create or replace function public.delete_product(
          p_product_id uuid
        )
      `),
    );
    expect(normalizedSchema).toContain(
      'update order_items set product_id = null where product_id = p_product_id',
    );
    expect(normalizedSchema).toContain(
      'update comanda_items set product_id = null where product_id = p_product_id',
    );
    expect(normalizedSchema).toContain(
      'delete from products where id = p_product_id',
    );
  });

  it('define fechamento operacional diario e agendamento as 6h', () => {
    const normalizedSchema = normalizeSql(schemaSql);
    const normalizedDailyRollover = normalizeSql(dailyRolloverSql);

    expect(normalizedSchema).toContain(
      normalizeSql(`
        create or replace function public.close_operational_day(
          p_reference_at timestamptz default now()
        )
      `),
    );
    expect(normalizedSchema).toContain(
      "cancellation_reason = 'Encerrado automaticamente no fechamento diario'",
    );
    expect(normalizedSchema).toContain(
      "closed_at = v_cutoff_at - interval '1 millisecond'",
    );
    expect(normalizedDailyRollover).toContain(
      "cron.schedule( 'daily-operational-rollover', '0 9 * * *'",
    );
  });

  it('habilita realtime para atualizacoes do cardapio no cliente', () => {
    const normalizedSchema = normalizeSql(schemaSql);

    expect(normalizedSchema).toContain(
      'alter publication supabase_realtime add table public.products',
    );
  });
});
