import { describe, expect, it } from 'vitest';
import { CalculateOrderTotalUseCase } from '../../src/application/calculate-order-total/CalculateOrderTotalUseCase';
import { CartItem } from '../../src/domain/cart/Cart';
import { OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';

const chickenPie = Product.create({
  name: 'Torta de Frango',
  description: 'Torta salgada de frango',
  price: 40,
  active: true,
});

const heartOfPalmPie = Product.create({
  name: 'Torta de Palmito',
  description: 'Torta salgada de palmito',
  price: 30,
  active: true,
});

const items: CartItem[] = [
  {
    product: chickenPie,
    quantity: 2,
    unitPrice: 40,
    totalPrice: 80,
  },
  {
    product: heartOfPalmPie,
    quantity: 1,
    unitPrice: 30,
    totalPrice: 30,
  },
];

describe('CalculateOrderTotalUseCase', () => {
  it('deve calcular total de pedido de retirada sem taxa de entrega', () => {
    const useCase = new CalculateOrderTotalUseCase();

    const total = useCase.execute({
      type: OrderType.PICKUP,
      items,
    });

    expect(total).toEqual({
      subtotal: 110,
      deliveryFee: 0,
      total: 110,
    });
  });

  it('deve calcular total de pedido de entrega com taxa fixa', () => {
    const useCase = new CalculateOrderTotalUseCase();

    const total = useCase.execute({
      type: OrderType.DELIVERY,
      address: 'Rua das Tortas, 123',
      items,
    });

    expect(total).toEqual({
      subtotal: 110,
      deliveryFee: 8,
      total: 118,
    });
  });

  it('deve calcular total de entrega com taxa configurada', () => {
    const useCase = new CalculateOrderTotalUseCase();

    const total = useCase.execute({
      type: OrderType.DELIVERY,
      address: 'Rua das Tortas, 123',
      items,
      deliveryFee: 12,
    });

    expect(total).toEqual({
      subtotal: 110,
      deliveryFee: 12,
      total: 122,
    });
  });

  it('deve exigir endereco para calcular total de entrega', () => {
    const useCase = new CalculateOrderTotalUseCase();

    expect(() =>
      useCase.execute({
        type: OrderType.DELIVERY,
        items,
      }),
    ).toThrow('Delivery order must have an address');
  });
});
