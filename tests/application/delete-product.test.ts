import { describe, expect, it } from 'vitest';
import { DeleteProductUseCase } from '../../src/application/delete-product/DeleteProductUseCase';
import type { ProductRepository } from '../../src/application/repositories/ProductRepository';
import { Product } from '../../src/domain/product/Product';

class FakeProductRepository implements ProductRepository {
  readonly products = [
    Product.create({
      id: 'product-1',
      name: 'Espeto de Carne',
      description: 'Espeto bovino assado na brasa',
      price: 40,
      active: true,
    }),
  ];

  async findAll(): Promise<Product[]> {
    return this.products;
  }

  async save(product: Product): Promise<void> {
    this.products.push(product);
  }

  async delete(id: string): Promise<void> {
    const productIndex = this.products.findIndex((product) => product.id === id);

    if (productIndex >= 0) {
      this.products.splice(productIndex, 1);
    }
  }
}

describe('DeleteProductUseCase', () => {
  it('deve excluir produto cadastrado', async () => {
    const repository = new FakeProductRepository();
    const useCase = new DeleteProductUseCase(repository);

    await useCase.execute('product-1');

    expect(repository.products).toEqual([]);
  });

  it('deve rejeitar id vazio', async () => {
    const repository = new FakeProductRepository();
    const useCase = new DeleteProductUseCase(repository);

    await expect(useCase.execute('  ')).rejects.toThrow(
      'Product id is required',
    );
  });
});
