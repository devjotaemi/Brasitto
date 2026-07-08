import type { ProductRepository } from '../repositories/ProductRepository';
import type { Product } from '../../domain/product/Product';

export class ListActiveProductsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(): Promise<Product[]> {
    const products = await this.productRepository.findAll();

    return products.filter((product) => product.active);
  }
}
