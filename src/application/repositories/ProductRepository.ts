import type { Product } from '../../domain/product/Product';

export interface ProductRepository {
  findAll(): Promise<Product[]>;
  save(product: Product): Promise<void>;
}
