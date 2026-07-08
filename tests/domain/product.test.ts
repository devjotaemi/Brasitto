import { describe, expect, it } from 'vitest';
import { Product } from '../../src/domain/product/Product';
import { Cart } from '../../src/domain/cart/Cart';

describe('Product', () => {
  it('deve criar uma torta com nome, descricao, preco e status ativo', () => {
    const product = Product.create({
      name: 'Torta de Frango',
      description: 'Torta salgada de frango com catupiry',
      price: 40,
      active: true,
    });

    expect(product.name).toBe('Torta de Frango');
    expect(product.description).toBe('Torta salgada de frango com catupiry');
    expect(product.price).toBe(40);
    expect(product.active).toBe(true);
  });

  it('nao deve permitir produto com preco menor ou igual a zero', () => {
    expect(() =>
      Product.create({
        name: 'Torta invalida',
        description: 'Produto com preco invalido',
        price: 0,
        active: true,
      }),
    ).toThrow('Product price must be greater than zero');

    expect(() =>
      Product.create({
        name: 'Torta invalida',
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
        description: 'Torta salgada de frango com catupiry',
        price: 40,
        active: true,
      }),
    ).toThrow('Product name is required');

    expect(() =>
      Product.create({
        name: '   ',
        description: 'Torta salgada de frango com catupiry',
        price: 40,
        active: true,
      }),
    ).toThrow('Product name is required');
  });

  it('nao deve permitir produto sem descricao', () => {
    expect(() =>
      Product.create({
        name: 'Torta de Frango',
        description: '',
        price: 40,
        active: true,
      }),
    ).toThrow('Product description is required');

    expect(() =>
      Product.create({
        name: 'Torta de Frango',
        description: '   ',
        price: 40,
        active: true,
      }),
    ).toThrow('Product description is required');
  });

  it('nao deve permitir produto com preco invalido', () => {
    expect(() =>
      Product.create({
        name: 'Torta invalida',
        description: 'Produto com preco invalido',
        price: Number.NaN,
        active: true,
      }),
    ).toThrow('Product price must be a valid number');

    expect(() =>
      Product.create({
        name: 'Torta invalida',
        description: 'Produto com preco invalido',
        price: Number.POSITIVE_INFINITY,
        active: true,
      }),
    ).toThrow('Product price must be a valid number');
  });

  it('produto inativo nao deve poder ser adicionado ao carrinho', () => {
    const inactiveProduct = Product.create({
      name: 'Torta de Palmito',
      description: 'Torta salgada de palmito',
      price: 35,
      active: false,
    });

    const cart = new Cart();

    expect(() => cart.addItem(inactiveProduct, 1)).toThrow(
      'Inactive product cannot be added to cart',
    );
  });
});
