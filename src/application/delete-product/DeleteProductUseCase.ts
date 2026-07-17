import type { ProductRepository } from '../repositories/ProductRepository';

export class DeleteProductUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: string): Promise<void> {
    if (!id.trim()) {
      throw new Error('Product id is required');
    }

    await this.productRepository.delete(id);
  }
}
