import { describe, expect, it } from 'vitest';
import { ListActiveProductsUseCase } from '../../src/application/list-active-products/ListActiveProductsUseCase';
import { ProductRepository } from '../../src/application/repositories/ProductRepository';
import { Product } from '../../src/domain/product/Product';

class FakeProductRepository implements ProductRepository {
  constructor(private readonly products: Product[]) {}

  async findAll(): Promise<Product[]> {
    return this.products;
  }

  async save(_product: Product): Promise<void> {}
}

describe('ListActiveProductsUseCase', () => {
  it('deve listar apenas produtos ativos', async () => {
    const activeProduct = Product.create({
      id: 'product-1',
      name: 'Espeto de Carne',
      description: 'Espeto bovino assado na brasa',
      price: 40,
      active: true,
    });
    const inactiveProduct = Product.create({
      id: 'product-2',
      name: 'Espeto de Frango',
      description: 'Espeto de frango temperado',
      price: 35,
      active: false,
    });
    const repository = new FakeProductRepository([
      activeProduct,
      inactiveProduct,
    ]);
    const useCase = new ListActiveProductsUseCase(repository);

    await expect(useCase.execute()).resolves.toEqual([activeProduct]);
  });

  it('deve retornar lista vazia quando nao houver produtos ativos', async () => {
    const inactiveProduct = Product.create({
      id: 'product-1',
      name: 'Espeto de Frango',
      description: 'Espeto de frango temperado',
      price: 35,
      active: false,
    });
    const repository = new FakeProductRepository([inactiveProduct]);
    const useCase = new ListActiveProductsUseCase(repository);

    await expect(useCase.execute()).resolves.toEqual([]);
  });
});
