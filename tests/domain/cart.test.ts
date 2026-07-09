import { describe, expect, it } from 'vitest';
import { Cart } from '../../src/domain/cart/Cart';
import { Product } from '../../src/domain/product/Product';

describe('Cart', () => {
  it('deve adicionar um espeto ativa ao carrinho', () => {
    const product = Product.create({
      name: 'Espeto de Carne',
      description: 'Espeto bovino assado na brasa',
      price: 40,
      active: true,
    });

    const cart = new Cart();

    cart.addItem(product, 1);

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toEqual({
      product,
      quantity: 1,
      unitPrice: 40,
      totalPrice: 40,
    });
  });

  it('deve calcular subtotal de um item corretamente', () => {
    const product = Product.create({
      name: 'Espeto de Carne',
      description: 'Espeto bovino assado na brasa',
      price: 40,
      active: true,
    });

    const cart = new Cart();

    cart.addItem(product, 2);

    expect(cart.subtotal()).toBe(80);
  });

  it('deve calcular subtotal de multiplos itens', () => {
    const chickenPie = Product.create({
      name: 'Espeto de Carne',
      description: 'Espeto bovino na brasa',
      price: 40,
      active: true,
    });
    const heartOfPalmPie = Product.create({
      name: 'Espeto de Frango',
      description: 'Espeto de frango temperado',
      price: 30,
      active: true,
    });

    const cart = new Cart();

    cart.addItem(chickenPie, 2);
    cart.addItem(heartOfPalmPie, 1);

    expect(cart.subtotal()).toBe(110);
  });

  it('nao deve permitir item com quantidade menor ou igual a zero', () => {
    const product = Product.create({
      name: 'Espeto de Carne',
      description: 'Espeto bovino assado na brasa',
      price: 40,
      active: true,
    });

    const cart = new Cart();

    expect(() => cart.addItem(product, 0)).toThrow(
      'Cart item quantity must be greater than zero',
    );
    expect(() => cart.addItem(product, -1)).toThrow(
      'Cart item quantity must be greater than zero',
    );
  });
});
