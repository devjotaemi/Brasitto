import type { ProductRepository } from '../repositories/ProductRepository';
import { Product, type ProductCategory } from '../../domain/product/Product';

export type SaveProductInput = {
  id?: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  category?: ProductCategory;
  imageUrl?: string;
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
      category: input.category,
      imageUrl: input.imageUrl,
    });

    await this.productRepository.save(product);

    return product;
  }
}
