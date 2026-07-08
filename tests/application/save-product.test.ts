import { describe, expect, it } from 'vitest';
import type { ProductRepository } from '../../src/application/repositories/ProductRepository';
import { SaveProductUseCase } from '../../src/application/save-product/SaveProductUseCase';
import { Product } from '../../src/domain/product/Product';

class FakeProductRepository implements ProductRepository {
  readonly products: Product[] = [];

  async findAll(): Promise<Product[]> {
    return this.products;
  }

  async save(product: Product): Promise<void> {
    this.products.push(product);
  }
}

describe('SaveProductUseCase', () => {
  it('deve salvar produto valido', async () => {
    const repository = new FakeProductRepository();
    const useCase = new SaveProductUseCase(repository);

    const product = await useCase.execute({
      id: 'product-1',
      name: 'Torta de Frango',
      description: 'Torta salgada de frango com catupiry',
      price: 40,
      active: true,
    });

    expect(product.name).toBe('Torta de Frango');
    expect(repository.products).toEqual([product]);
  });

  it('nao deve salvar produto com preco menor ou igual a zero', async () => {
    const repository = new FakeProductRepository();
    const useCase = new SaveProductUseCase(repository);

    await expect(
      useCase.execute({
        name: 'Torta invalida',
        description: 'Preco invalido',
        price: 0,
        active: true,
      }),
    ).rejects.toThrow('Product price must be greater than zero');

    expect(repository.products).toEqual([]);
  });
});
