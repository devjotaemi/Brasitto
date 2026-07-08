import { describe, expect, it } from 'vitest';
import { SupabaseProductRepository } from '../../src/infrastructure/repositories/SupabaseProductRepository';
import { Product } from '../../src/domain/product/Product';

type QueryResult = {
  data?: unknown[];
  error?: Error | null;
};

class FakeSupabaseClient {
  readonly savedProducts: unknown[] = [];

  constructor(private readonly productRows: unknown[]) {}

  from(table: string) {
    if (table !== 'products') {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      select: async (): Promise<QueryResult> => ({
        data: this.productRows,
        error: null,
      }),
      upsert: async (row: unknown): Promise<QueryResult> => {
        this.savedProducts.push(row);
        return { error: null };
      },
    };
  }
}

describe('SupabaseProductRepository', () => {
  it('deve buscar produtos e reconstruir o dominio', async () => {
    const client = new FakeSupabaseClient([
      {
        id: 'product-1',
        name: 'Torta de Frango',
        description: 'Torta salgada de frango com catupiry',
        price: 40,
        active: true,
      },
      {
        id: 'product-2',
        name: 'Torta de Palmito',
        description: 'Torta salgada de palmito',
        price: 35,
        active: false,
      },
    ]);
    const repository = new SupabaseProductRepository(client);

    const products = await repository.findAll();

    expect(products).toHaveLength(2);
    expect(products[0].id).toBe('product-1');
    expect(products[0].name).toBe('Torta de Frango');
    expect(products[0].price).toBe(40);
    expect(products[0].active).toBe(true);
    expect(products[1].active).toBe(false);
  });

  it('deve falhar quando Supabase retornar erro', async () => {
    const client = {
      from: () => ({
        select: async (): Promise<QueryResult> => ({
          error: new Error('Supabase failed'),
        }),
      }),
    };
    const repository = new SupabaseProductRepository(client);

    await expect(repository.findAll()).rejects.toThrow('Supabase failed');
  });

  it('deve salvar produto no formato esperado pelo Supabase', async () => {
    const client = new FakeSupabaseClient([]);
    const repository = new SupabaseProductRepository(client);
    const product = Product.create({
      id: 'product-1',
      name: 'Torta de Frango',
      description: 'Torta salgada de frango com catupiry',
      price: 40,
      active: true,
    });

    await repository.save(product);

    expect(client.savedProducts).toEqual([
      {
        id: 'product-1',
        name: 'Torta de Frango',
        description: 'Torta salgada de frango com catupiry',
        price: 40,
        active: true,
      },
    ]);
  });
});
