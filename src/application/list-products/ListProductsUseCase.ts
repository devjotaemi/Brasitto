import type { ProductRepository } from '../repositories/ProductRepository';
import type { Product } from '../../domain/product/Product';

export class ListProductsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(): Promise<Product[]> {
    return this.productRepository.findAll();
  }
}
