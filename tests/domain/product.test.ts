import { describe, expect, it } from 'vitest';
import { Product } from '../../src/domain/product/Product';
import { Cart } from '../../src/domain/cart/Cart';

describe('Product', () => {
  it('deve criar um espeto com nome, descricao, preco e status ativo', () => {
    const product = Product.create({
      name: 'Espeto de Carne',
      description: 'Espeto bovino assado na brasa',
      price: 40,
      active: true,
      imageUrl: 'https://example.com/espeto.jpg',
    });

    expect(product.name).toBe('Espeto de Carne');
    expect(product.description).toBe('Espeto bovino assado na brasa');
    expect(product.price).toBe(40);
    expect(product.active).toBe(true);
    expect(product.imageUrl).toBe('https://example.com/espeto.jpg');
  });

  it('deve permitir produto sem foto', () => {
    const product = Product.create({
      name: 'Espeto de Carne',
      description: 'Espeto bovino assado na brasa',
      price: 40,
      active: true,
    });

    expect(product.imageUrl).toBeUndefined();
  });

  it('nao deve permitir foto com URL invalida', () => {
    expect(() =>
      Product.create({
        name: 'Espeto invalido',
        description: 'Produto com foto invalida',
        price: 40,
        active: true,
        imageUrl: 'ftp://example.com/espeto.jpg',
      }),
    ).toThrow('Product image URL must start with http:// or https://');
  });

  it('nao deve permitir produto com preco menor ou igual a zero', () => {
    expect(() =>
      Product.create({
        name: 'Espeto invalido',
        description: 'Produto com preco invalido',
        price: 0,
        active: true,
      }),
    ).toThrow('Product price must be greater than zero');

    expect(() =>
      Product.create({
        name: 'Espeto invalido',
        description: 'Produto com preco invalido',
        price: -10,
        active: true,
      }),
    ).toThrow('Product price must be greater than zero');
  });

  it('nao deve permitir produto sem nome', () => {
    expect(() =>
      Product.create({
        name: '',
        description: 'Espeto bovino assado na brasa',
        price: 40,
        active: true,
      }),
    ).toThrow('Product name is required');

    expect(() =>
      Product.create({
        name: '   ',
        description: 'Espeto bovino assado na brasa',
        price: 40,
        active: true,
      }),
    ).toThrow('Product name is required');
  });

  it('nao deve permitir produto sem descricao', () => {
    expect(() =>
      Product.create({
        name: 'Espeto de Carne',
        description: '',
        price: 40,
        active: true,
      }),
    ).toThrow('Product description is required');

    expect(() =>
      Product.create({
        name: 'Espeto de Carne',
        description: '   ',
        price: 40,
        active: true,
      }),
    ).toThrow('Product description is required');
  });

  it('nao deve permitir produto com preco invalido', () => {
    expect(() =>
      Product.create({
        name: 'Espeto invalido',
        description: 'Produto com preco invalido',
        price: Number.NaN,
        active: true,
      }),
    ).toThrow('Product price must be a valid number');

    expect(() =>
      Product.create({
        name: 'Espeto invalido',
        description: 'Produto com preco invalido',
        price: Number.POSITIVE_INFINITY,
        active: true,
      }),
    ).toThrow('Product price must be a valid number');
  });

  it('produto inativo nao deve poder ser adicionado ao carrinho', () => {
    const inactiveProduct = Product.create({
      name: 'Espeto de Frango',
      description: 'Espeto de frango temperado',
      price: 35,
      active: false,
    });

    const cart = new Cart();

    expect(() => cart.addItem(inactiveProduct, 1)).toThrow(
      'Inactive product cannot be added to cart',
    );
  });
});
