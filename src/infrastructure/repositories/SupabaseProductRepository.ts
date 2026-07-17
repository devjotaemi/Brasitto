import type { ProductRepository } from '../../application/repositories/ProductRepository';
import { Product, isProductCategory } from '../../domain/product/Product';

type SupabaseQueryResult<T = unknown> = {
  data?: T;
  error?: Error | null;
};

type SupabaseClient = {
  from(table: string): unknown;
  rpc?: (
    functionName: string,
    params?: Record<string, unknown>,
  ) => unknown;
};

type ProductRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  category?: string | null;
  image_url?: string | null;
};

export class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findAll(): Promise<Product[]> {
    const productsTable = this.supabase.from('products') as {
      select: (columns?: string) => Promise<SupabaseQueryResult<unknown[]>>;
    };

    const result = await productsTable.select('*');

    if (result.error) {
      throw result.error;
    }

    return ((result.data ?? []) as ProductRow[]).map((row) =>
      Product.create({
        id: row.id,
        name: row.name,
        description: row.description,
        price: row.price,
        active: row.active,
        category:
          row.category && isProductCategory(row.category)
            ? row.category
            : undefined,
        imageUrl: row.image_url ?? undefined,
      }),
    );
  }

  async save(product: Product): Promise<void> {
    const productsTable = this.supabase.from('products') as {
      upsert: (row: unknown) => Promise<SupabaseQueryResult>;
    };

    const result = await productsTable.upsert({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      active: product.active,
      category: product.category,
      image_url: product.imageUrl ?? null,
    });

    if (result.error) {
      throw result.error;
    }
  }

  async delete(id: string): Promise<void> {
    if (!this.supabase.rpc) {
      throw new Error('Product deletion requires Supabase RPC');
    }

    const result = (await this.supabase.rpc('delete_product', {
      p_product_id: id,
    })) as SupabaseQueryResult;

    if (result.error) {
      throw result.error;
    }
  }
}
