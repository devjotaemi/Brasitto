import { describe, expect, it } from 'vitest';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';
import {
  filterActiveOrdersByStatus,
  getActiveOrderStatusCounts,
  getActiveOrders,
  sortActiveOrdersByPriority,
} from '../../src/ui/admin/orderFilters';

const product = Product.create({
  id: 'product-1',
  name: 'Espeto de Carne',
  description: 'Espeto bovino na brasa',
  price: 50,
  active: true,
});

const createOrder = (
  id: string,
  status: OrderStatus,
  createdAt = new Date('2026-05-20T10:00:00.000Z'),
): Order =>
  Order.create({
    id,
    customerName: 'Maria Silva',
    customerPhone: '11999999999',
    type: OrderType.PICKUP,
    createdAt,
    items: [
      {
        product,
        quantity: 1,
        unitPrice: 50,
        totalPrice: 50,
      },
    ],
  }).updateStatus(status);

describe('orderFilters', () => {
  it('retorna apenas pedidos ativos', () => {
    const orders = [
      createOrder('pending', OrderStatus.PENDING),
      createOrder('finished', OrderStatus.FINISHED),
      createOrder('canceled', OrderStatus.CANCELED),
    ];

    expect(getActiveOrders(orders).map((order) => order.id)).toEqual([
      'pending',
    ]);
  });

  it('conta pedidos ativos por status', () => {
    const orders = [
      createOrder('pending-1', OrderStatus.PENDING),
      createOrder('pending-2', OrderStatus.PENDING),
      createOrder('accepted', OrderStatus.ACCEPTED),
      createOrder('preparing', OrderStatus.IN_PREPARATION),
      createOrder('delivery', OrderStatus.OUT_FOR_DELIVERY),
      createOrder('pickup', OrderStatus.READY_FOR_PICKUP),
      createOrder('finished', OrderStatus.FINISHED),
    ];

    expect(getActiveOrderStatusCounts(orders)).toEqual({
      [OrderStatus.PENDING]: 2,
      [OrderStatus.ACCEPTED]: 1,
      [OrderStatus.IN_PREPARATION]: 1,
      [OrderStatus.OUT_FOR_DELIVERY]: 1,
      [OrderStatus.READY_FOR_PICKUP]: 1,
      total: 6,
    });
  });

  it('filtra todos os pedidos ativos', () => {
    const orders = [
      createOrder('pending', OrderStatus.PENDING),
      createOrder('finished', OrderStatus.FINISHED),
      createOrder('accepted', OrderStatus.ACCEPTED),
    ];

    expect(filterActiveOrdersByStatus(orders, 'ALL').map((order) => order.id))
      .toEqual(['pending', 'accepted']);
  });

  it('filtra pedidos ativos por status especifico', () => {
    const orders = [
      createOrder('pending', OrderStatus.PENDING),
      createOrder('accepted', OrderStatus.ACCEPTED),
    ];

    expect(
      filterActiveOrdersByStatus(orders, OrderStatus.ACCEPTED).map(
        (order) => order.id,
      ),
    ).toEqual(['accepted']);
  });

  it('ordena pedidos ativos por prioridade operacional e horario', () => {
    const orders = [
      createOrder('preparing', OrderStatus.IN_PREPARATION),
      createOrder('pending-new', OrderStatus.PENDING, new Date('2026-05-20T10:05:00.000Z')),
      createOrder('ready', OrderStatus.READY_FOR_PICKUP),
      createOrder('accepted', OrderStatus.ACCEPTED),
      createOrder('pending-old', OrderStatus.PENDING, new Date('2026-05-20T10:00:00.000Z')),
      createOrder('delivery', OrderStatus.OUT_FOR_DELIVERY),
    ];

    expect(sortActiveOrdersByPriority(orders).map((order) => order.id)).toEqual(
      [
        'pending-old',
        'pending-new',
        'accepted',
        'preparing',
        'delivery',
        'ready',
      ],
    );
  });
});
