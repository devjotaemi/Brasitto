import { describe, expect, it } from 'vitest';
import { getNewOrders } from '../../src/ui/admin/orderNotifications';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';

const product = Product.create({
  id: 'product-1',
  name: 'Torta de Frango',
  description: 'Torta salgada de frango',
  price: 50,
  active: true,
});

const createOrder = (id: string, status = OrderStatus.PENDING): Order =>
  Order.create({
    id,
    customerName: 'Maria Silva',
    customerPhone: '11999999999',
    type: OrderType.PICKUP,
    items: [
      {
        product,
        quantity: 1,
        unitPrice: 50,
        totalPrice: 50,
      },
    ],
  }).updateStatus(status);

describe('getNewOrders', () => {
  it('nao notifica no primeiro carregamento', () => {
    const nextOrders = [createOrder('order-1')];

    expect(getNewOrders([], nextOrders, false)).toEqual([]);
  });

  it('identifica pedidos novos apos o primeiro carregamento', () => {
    const previousOrders = [createOrder('order-1')];
    const nextOrders = [createOrder('order-2'), createOrder('order-1')];

    expect(getNewOrders(previousOrders, nextOrders, true)).toEqual([
      nextOrders[0],
    ]);
  });

  it('nao notifica quando apenas muda status de pedido existente', () => {
    const previousOrders = [createOrder('order-1', OrderStatus.PENDING)];
    const nextOrders = [createOrder('order-1', OrderStatus.ACCEPTED)];

    expect(getNewOrders(previousOrders, nextOrders, true)).toEqual([]);
  });

  it('nao duplica aviso para pedido ja conhecido', () => {
    const previousOrders = [createOrder('order-1'), createOrder('order-2')];
    const nextOrders = [createOrder('order-2'), createOrder('order-1')];

    expect(getNewOrders(previousOrders, nextOrders, true)).toEqual([]);
  });
});
