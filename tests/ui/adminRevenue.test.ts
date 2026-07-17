import { describe, expect, it } from 'vitest';
import { Comanda } from '../../src/domain/comanda/Comanda';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';
import { calculateAdminDailyRevenue } from '../../src/ui/admin/adminRevenue';

const product = Product.create({
  id: 'product-1',
  name: 'Espeto de Carne',
  description: 'Espeto bovino assado na brasa',
  price: 12,
  active: true,
});

const createFinishedOrder = () =>
  Order.create({
    id: 'order-1',
    customerName: 'Maria Silva',
    customerPhone: '(11)99999-9999',
    type: OrderType.PICKUP,
    items: [
      {
        product,
        quantity: 2,
        unitPrice: 12,
        totalPrice: 24,
      },
    ],
  }).updateStatus(
    OrderStatus.FINISHED,
    new Date('2026-07-08T15:00:00.000Z'),
  );

const createClosedComanda = () =>
  Comanda.create({
    id: 'comanda-1',
    label: 'Mesa 4',
  })
    .addItem(product, 3, 'item-1')
    .close(new Date('2026-07-08T16:00:00.000Z'));

describe('calculateAdminDailyRevenue', () => {
  it('soma pedidos finalizados e comandas fechadas do dia operacional iniciado as 6h', () => {
    const openComanda = Comanda.create({
      id: 'comanda-2',
      label: 'Mesa 5',
    }).addItem(product, 10, 'item-2');
    const previousOperationalDayOrder = Order.create({
      id: 'order-2',
      customerName: 'Joao Silva',
      customerPhone: '(11)98888-8888',
      type: OrderType.PICKUP,
      items: [
        {
          product,
          quantity: 5,
          unitPrice: 12,
          totalPrice: 60,
        },
      ],
    }).updateStatus(
      OrderStatus.FINISHED,
      new Date('2026-07-08T08:59:59.000Z'),
    );

    const revenue = calculateAdminDailyRevenue(
      [createFinishedOrder(), previousOperationalDayOrder],
      [createClosedComanda(), openComanda],
      new Date('2026-07-08T12:00:00.000Z'),
    );

    expect(revenue.finishedOrdersCount).toBe(1);
    expect(revenue.closedCommandasCount).toBe(1);
    expect(revenue.orderRevenue).toBe(24);
    expect(revenue.comandaRevenue).toBe(36);
    expect(revenue.totalRevenue).toBe(60);
  });
});
