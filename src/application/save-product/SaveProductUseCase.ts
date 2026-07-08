import type { ProductRepository } from '../repositories/ProductRepository';
import { Product } from '../../domain/product/Product';

export type SaveProductInput = {
  id?: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
};

export class SaveProductUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(input: SaveProductInput): Promise<Product> {
    const product = Product.create({
      id: input.id,
      name: input.name,
      description: input.description,
      price: input.price,
      active: input.active,
    });

    await this.productRepository.save(product);

    return product;
  }
}
