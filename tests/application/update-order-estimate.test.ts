import { describe, expect, it } from 'vitest';
import type { OrderRepository } from '../../src/application/repositories/OrderRepository';
import { UpdateOrderEstimateUseCase } from '../../src/application/update-order-estimate/UpdateOrderEstimateUseCase';
import type { CartItem } from '../../src/domain/cart/Cart';
import { Order, OrderStatus, OrderType } from '../../src/domain/order/Order';
import { Product } from '../../src/domain/product/Product';

class FakeOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  updatedEstimate: {
    id: string;
    estimatedReadyAt?: Date;
  } | null = null;

  async save(order: Order): Promise<Order> {
    if (!order.id) {
      throw new Error('Order must have an id to be saved');
    }

    this.orders.set(order.id, order);

    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async findByOrderNumberAndPhone(): Promise<Order | null> {
    return null;
  }

  async findAll(): Promise<Order[]> {
    return [...this.orders.values()];
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    finishedAt?: Date,
    cancellationReason?: string,
  ): Promise<void> {
    const order = await this.findById(id);

    if (!order) {
      throw new Error('Order not found');
    }

    this.orders.set(
      id,
      order.updateStatus(status, finishedAt, cancellationReason),
    );
  }

  async updateEstimatedReadyAt(
    id: string,
    estimatedReadyAt?: Date,
  ): Promise<void> {
    const order = await this.findById(id);

    if (!order) {
      throw new Error('Order not found');
    }

    this.updatedEstimate = { id, estimatedReadyAt };
    this.orders.set(id, order.updateEstimatedReadyAt(estimatedReadyAt));
  }
}

const product = Product.create({
  name: 'Torta de Frango',
  description: 'Torta salgada de frango com catupiry',
  price: 50,
  active: true,
});

const items: CartItem[] = [
  {
    product,
    quantity: 2,
    unitPrice: 50,
    totalPrice: 100,
  },
];

describe('UpdateOrderEstimateUseCase', () => {
  it('deve atualizar previsao de um pedido existente', async () => {
    const repository = new FakeOrderRepository();
    const order = Order.create({
      id: 'order-1',
      customerName: 'Maria Silva',
      customerPhone: '11999999999',
      type: OrderType.PICKUP,
      items,
    });
    const estimatedReadyAt = new Date('2026-05-20T11:30:00.000Z');
    await repository.save(order);

    const useCase = new UpdateOrderEstimateUseCase(repository);
    const updatedOrder = await useCase.execute({
      orderId: 'order-1',
      estimatedReadyAt,
    });

    expect(updatedOrder.estimatedReadyAt).toEqual(estimatedReadyAt);
    expect(repository.updatedEstimate).toEqual({
      id: 'order-1',
      estimatedReadyAt,
    });
  });

  it('deve falhar quando pedido nao existir', async () => {
    const repository = new FakeOrderRepository();
    const useCase = new UpdateOrderEstimateUseCase(repository);

    await expect(
      useCase.execute({
        orderId: 'missing-order',
        estimatedReadyAt: new Date('2026-05-20T11:30:00.000Z'),
      }),
    ).rejects.toThrow('Order not found');
  });
});
