import { describe, expect, it } from 'vitest';
import { SupabaseProductRepository } from '../../src/infrastructure/repositories/SupabaseProductRepository';
import { Product } from '../../src/domain/product/Product';

type QueryResult = {
  data?: unknown[];
  error?: Error | null;
};

class FakeSupabaseClient {
  readonly savedProducts: unknown[] = [];
  readonly rpcCalls: Array<{ functionName: string; params?: unknown }> = [];

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

  async rpc(functionName: string, params?: unknown): Promise<QueryResult> {
    this.rpcCalls.push({ functionName, params });

    return { error: null };
  }
}

describe('SupabaseProductRepository', () => {
  it('deve buscar produtos e reconstruir o dominio', async () => {
    const client = new FakeSupabaseClient([
      {
        id: 'product-1',
        name: 'Espeto de Carne',
        description: 'Espeto bovino assado na brasa',
        price: 40,
        active: true,
        category: 'Espetos',
        image_url: 'https://example.com/espeto-carne.jpg',
      },
      {
        id: 'product-2',
        name: 'Espeto de Frango',
        description: 'Espeto de frango temperado',
        price: 35,
        active: false,
        category: 'Bebidas',
      },
    ]);
    const repository = new SupabaseProductRepository(client);

    const products = await repository.findAll();

    expect(products).toHaveLength(2);
    expect(products[0].id).toBe('product-1');
    expect(products[0].name).toBe('Espeto de Carne');
    expect(products[0].price).toBe(40);
    expect(products[0].active).toBe(true);
    expect(products[0].category).toBe('Espetos');
    expect(products[0].imageUrl).toBe('https://example.com/espeto-carne.jpg');
    expect(products[1].active).toBe(false);
    expect(products[1].category).toBe('Bebidas');
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
      name: 'Espeto de Carne',
      description: 'Espeto bovino assado na brasa',
      price: 40,
      active: true,
      category: 'Espetos',
      imageUrl: 'https://example.com/espeto-carne.jpg',
    });

    await repository.save(product);

    expect(client.savedProducts).toEqual([
      {
        id: 'product-1',
        name: 'Espeto de Carne',
        description: 'Espeto bovino assado na brasa',
        price: 40,
        active: true,
        category: 'Espetos',
        image_url: 'https://example.com/espeto-carne.jpg',
      },
    ]);
  });

  it('deve excluir produto pela RPC que preserva historico', async () => {
    const client = new FakeSupabaseClient([]);
    const repository = new SupabaseProductRepository(client);

    await repository.delete('product-1');

    expect(client.rpcCalls).toEqual([
      {
        functionName: 'delete_product',
        params: {
          p_product_id: 'product-1',
        },
      },
    ]);
  });
});
