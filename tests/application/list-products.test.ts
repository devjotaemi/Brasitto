import { describe, expect, it } from 'vitest';
import { ListProductsUseCase } from '../../src/application/list-products/ListProductsUseCase';
import type { ProductRepository } from '../../src/application/repositories/ProductRepository';
import { Product } from '../../src/domain/product/Product';

class FakeProductRepository implements ProductRepository {
  constructor(private readonly products: Product[]) {}

  async findAll(): Promise<Product[]> {
    return this.products;
  }

  async save(_product: Product): Promise<void> {}
}

describe('ListProductsUseCase', () => {
  it('deve listar produtos ativos e inativos para o admin', async () => {
    const activeProduct = Product.create({
      id: 'product-1',
      name: 'Torta de Frango',
      description: 'Torta salgada de frango com catupiry',
      price: 40,
      active: true,
    });
    const inactiveProduct = Product.create({
      id: 'product-2',
      name: 'Torta de Palmito',
      description: 'Torta salgada de palmito',
      price: 35,
      active: false,
    });
    const useCase = new ListProductsUseCase(
      new FakeProductRepository([activeProduct, inactiveProduct]),
    );

    await expect(useCase.execute()).resolves.toEqual([
      activeProduct,
      inactiveProduct,
    ]);
  });
});
