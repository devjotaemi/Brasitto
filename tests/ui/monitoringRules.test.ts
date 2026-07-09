import { describe, expect, it } from 'vitest';
import type { StoreSettings } from '../../src/application/repositories/StoreSettingsRepository';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';
import {
  buildMonitoringAlerts,
  getMonitoringSummary,
} from '../../src/ui/admin/monitoringRules';

const now = new Date('2026-05-20T12:00:00.000Z');

const product = Product.create({
  id: 'product-1',
  name: 'Espeto de Carne',
  description: 'Espeto bovino na brasa',
  price: 50,
  active: true,
});

const inactiveProduct = Product.create({
  id: 'product-2',
  name: 'Espeto de Frango',
  description: 'Espeto de frango temperado',
  price: 50,
  active: false,
});

const storeSettings: StoreSettings = {
  storeOpen: true,
  deliveryFee: 8,
};

const createOrder = (
  id: string,
  status: OrderStatus,
  createdAt = new Date('2026-05-20T11:50:00.000Z'),
): Order =>
  Order.create({
    id,
    orderNumber: 123,
    customerName: 'Maria Silva',
    customerPhone: '11999999999',
    type: OrderType.PICKUP,
    createdAt,
    estimatedReadyAt: new Date('2026-05-20T12:30:00.000Z'),
    items: [
      {
        product,
        quantity: 1,
        unitPrice: 50,
        totalPrice: 50,
      },
    ],
  }).updateStatus(status);

describe('monitoringRules', () => {
  it('resume indicadores operacionais', () => {
    const finishedOrder = createOrder(
      'finished',
      OrderStatus.FINISHED,
    ).updateStatus(OrderStatus.FINISHED, now);
    const pendingOrder = createOrder('pending', OrderStatus.PENDING);

    expect(
      getMonitoringSummary({
        now,
        orders: [finishedOrder, pendingOrder],
        products: [product, inactiveProduct],
      }),
    ).toEqual({
      activeProducts: 1,
      activeOrders: 1,
      pendingOrders: 1,
      missingEstimateOrders: 0,
      canceledToday: 0,
      finishedToday: 1,
      todayRevenue: 50,
    });
  });

  it('gera alertas criticos para aplicacao bloqueada, loja fechada e sem produtos ativos', () => {
    const alerts = buildMonitoringAlerts({
      now,
      orders: [],
      products: [inactiveProduct],
      storeSettings: {
        storeOpen: false,
        deliveryFee: 8,
      },
      isApplicationLocked: true,
      realtimeStatus: 'connected',
    });

    expect(alerts.map((alert) => alert.id)).toEqual([
      'application-locked',
      'store-closed',
      'no-active-products',
    ]);
    expect(alerts.every((alert) => alert.severity === 'critical')).toBe(true);
  });

  it('gera alertas de realtime, pedido pendente antigo e pedido sem previsao', () => {
    const oldPendingOrder = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      createdAt: new Date('2026-05-20T11:30:00.000Z'),
      items: [
        {
          product,
          quantity: 1,
          unitPrice: 50,
          totalPrice: 50,
        },
      ],
    });

    const alerts = buildMonitoringAlerts({
      now,
      orders: [oldPendingOrder],
      products: [product],
      storeSettings,
      isApplicationLocked: false,
      realtimeStatus: 'disconnected',
    });

    expect(alerts.map((alert) => alert.id)).toEqual([
      'realtime-unavailable',
      'old-pending-orders',
      'missing-estimates',
    ]);
  });

  it('gera alerta informativo quando nao ha problemas', () => {
    const alerts = buildMonitoringAlerts({
      now,
      orders: [createOrder('order-1', OrderStatus.ACCEPTED)],
      products: [product],
      storeSettings,
      isApplicationLocked: false,
      realtimeStatus: 'connected',
    });

    expect(alerts).toEqual([
      {
        id: 'all-clear',
        severity: 'info',
        title: 'Nenhum alerta operacional',
        description:
          'Aplicacao, loja, produtos e pedidos ativos parecem normais.',
      },
    ]);
  });
});
