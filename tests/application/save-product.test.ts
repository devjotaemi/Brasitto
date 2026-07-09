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
      name: 'Espeto de Carne',
      description: 'Espeto bovino assado na brasa',
      price: 40,
      active: true,
      imageUrl: 'https://example.com/espeto.jpg',
    });

    expect(product.name).toBe('Espeto de Carne');
    expect(product.imageUrl).toBe('https://example.com/espeto.jpg');
    expect(repository.products).toEqual([product]);
  });

  it('nao deve salvar produto com preco menor ou igual a zero', async () => {
    const repository = new FakeProductRepository();
    const useCase = new SaveProductUseCase(repository);

    await expect(
      useCase.execute({
        name: 'Espeto invalido',
        description: 'Preco invalido',
        price: 0,
        active: true,
      }),
    ).rejects.toThrow('Product price must be greater than zero');

    expect(repository.products).toEqual([]);
  });
});
